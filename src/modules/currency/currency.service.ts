import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/** USD-based exchange-rate table. */
export interface FxRates {
  base: 'USD';
  /** ISO 4217 code → units per 1 USD (USD itself is 1). */
  rates: Record<string, number>;
  fetchedAt: string;
}

export interface FxRatesResult extends FxRates {
  /** True when live providers failed and we served the last known table. */
  stale: boolean;
}

/** Price fields added to API responses when a display currency is requested. */
export interface DisplayPrice {
  displayPrice: number | null;
  displayCurrency: string;
  /** Multiplier applied: displayPrice = price × fxRate. */
  fxRate: number | null;
}

/** Curated set offered in the navbar (all 160+ rate codes still convert). */
export const SUPPORTED_CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
];

const RATES_CACHE_KEY = 'fx:rates:usd';
const RATES_TTL_SECONDS = 12 * 60 * 60; // providers refresh daily; 12h is plenty
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Free exchange-rate client with layered fallbacks:
 *   1. Redis cache (12h TTL — one upstream call per half-day, cluster-wide)
 *   2. open.er-api.com (no API key, 160+ currencies, daily ECB-style rates)
 *   3. fawazahmed0 currency-api CDN (no key, no rate limit)
 *   4. Last table this process successfully fetched (marked stale)
 *
 * All rates are normalised to a USD base; cross-currency conversion is
 * `amount / rates[from] * rates[to]`.
 */
@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  /** Last successfully fetched table — survives Redis/provider outages. */
  private lastGood: FxRates | null = null;

  constructor(private readonly redis: RedisService) {}

  async getRates(): Promise<FxRatesResult> {
    const cached = await this.redis.get<FxRates>(RATES_CACHE_KEY);
    if (cached) {
      this.lastGood = cached;
      return { ...cached, stale: false };
    }

    try {
      const fresh = await this.fetchFromProviders();
      this.lastGood = fresh;
      await this.redis.set(RATES_CACHE_KEY, fresh, RATES_TTL_SECONDS);
      return { ...fresh, stale: false };
    } catch (err) {
      this.logger.warn(`All rate providers failed: ${err}`);
      if (this.lastGood) return { ...this.lastGood, stale: true };
      throw new ServiceUnavailableException(
        'Exchange rates are temporarily unavailable',
      );
    }
  }

  /**
   * Convert an amount between currencies. Throws BadRequest on unknown codes
   * so a typo'd ?currency= surfaces clearly instead of silently passing through.
   */
  async convert(
    amount: number,
    from: string,
    to: string,
  ): Promise<{ amount: number; rate: number; stale: boolean }> {
    const src = from.toUpperCase();
    const dst = to.toUpperCase();
    if (src === dst) return { amount, rate: 1, stale: false };

    const { rates, stale } = await this.getRates();
    const rate = this.crossRate(rates, src, dst);
    if (rate == null) {
      throw new BadRequestException(`Unsupported currency: ${rates[src] == null ? src : dst}`);
    }
    return { amount: round2(amount * rate), rate, stale };
  }

  /**
   * Attach displayPrice/displayCurrency/fxRate to price-bearing items without
   * touching the stored (scraped) price. Items whose source currency has no
   * known rate keep displayPrice null so the UI can fall back to the original.
   */
  async withDisplayPrices<T extends { price?: number | null; currency: string }>(
    items: T[],
    displayCurrency?: string,
  ): Promise<(T & Partial<DisplayPrice>)[]> {
    if (!displayCurrency) return items;
    const { rates } = await this.getRates();
    const dst = this.assertKnown(displayCurrency, rates);

    return items.map((item) => {
      const price = item.price != null ? Number(item.price) : null;
      const rate = this.crossRate(rates, item.currency?.toUpperCase() ?? 'USD', dst);
      return {
        ...item,
        displayCurrency: dst,
        fxRate: rate,
        displayPrice: price != null && rate != null ? round2(price * rate) : null,
      };
    });
  }

  /** Validate a user-supplied code against the rate table; returns it uppercased. */
  private assertKnown(code: string, rates: Record<string, number>): string {
    const upper = code.toUpperCase();
    if (rates[upper] == null) {
      throw new BadRequestException(`Unsupported currency: ${upper}`);
    }
    return upper;
  }

  /** Units of `dst` per 1 unit of `src`, or null when either code is unknown. */
  private crossRate(
    rates: Record<string, number>,
    src: string,
    dst: string,
  ): number | null {
    const from = rates[src];
    const to = rates[dst];
    if (!from || !to) return null;
    return to / from;
  }

  // ---- providers ----

  private async fetchFromProviders(): Promise<FxRates> {
    try {
      return await this.fetchErApi();
    } catch (err) {
      this.logger.warn(`open.er-api.com failed (${err}); trying fallback CDN`);
      return this.fetchFawazCdn();
    }
  }

  /** https://open.er-api.com — free, keyless, USD base, daily refresh. */
  private async fetchErApi(): Promise<FxRates> {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      result: string;
      rates?: Record<string, number>;
    };
    if (body.result !== 'success' || !body.rates?.USD) {
      throw new Error('Malformed er-api response');
    }
    return {
      base: 'USD',
      rates: body.rates,
      fetchedAt: new Date().toISOString(),
    };
  }

  /** fawazahmed0 currency-api via Cloudflare Pages — free, keyless, no limits. */
  private async fetchFawazCdn(): Promise<FxRates> {
    const res = await fetch(
      'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { usd?: Record<string, number> };
    if (!body.usd) throw new Error('Malformed currency-api response');

    const rates: Record<string, number> = { USD: 1 };
    for (const [code, rate] of Object.entries(body.usd)) {
      if (typeof rate === 'number' && rate > 0) rates[code.toUpperCase()] = rate;
    }
    return { base: 'USD', rates, fetchedAt: new Date().toISOString() };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
