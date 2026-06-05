import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import { AppConfig } from '../../config/configuration';
import { ProductSpec } from '../products/product.entity';

export interface ScrapedProduct {
  name?: string;
  description?: string;
  vendor?: string;
  manufacturer?: string;
  sku?: string;
  price?: number | null;
  currency?: string;
  dimensions?: string;
  images: string[];
  specifications: ProductSpec[];
  sourceUrl: string;
}

const MAX_IMAGES = 8;
const MAX_SPECS = 20;

// e.g. `88"W × 38"D × 34"H`, `21 x 14 x 19 in`, `53 × 36 × 76 cm`
const DIMENSION_PATTERN =
  /(\d[\d.,]*\s*(?:"|″|in\.?|cm|mm)?\s*[WDHL]?\s*[x×]\s*){1,3}\d[\d.,]*\s*(?:"|″|in\.?|cm|mm)\s*[WDHL]?/i;

// Label-first variant, e.g. `L: 140 mm x W: 154 mm x H: 154 mm`, `W 80cm × H 35cm`
const LABELED_DIMENSION_PATTERN =
  /([LWDH]\s*[:.]?\s*\d[\d.,]*\s*(?:"|″|in\.?|cm|mm|m)\s*[x×,]?\s*){2,4}/i;

// Assets that are never product photos
const JUNK_IMAGE_PATTERN =
  /logo|icon|sprite|favicon|badge|avatar|placeholder|pixel|tracking|\.svg(\?|$)/i;

/**
 * Extracts product metadata from a vendor URL using, in priority order:
 *   1. JSON-LD (schema.org Product)
 *   2. OpenGraph / Twitter / meta tags
 *   3. Heuristic HTML fallback (h1, price patterns, gallery <img>)
 */
@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(config: ConfigService<AppConfig, true>) {
    const imp = config.get('import', { infer: true });
    this.timeoutMs = imp.timeoutMs;
    this.userAgent = imp.userAgent;
  }

  async scrape(url: string): Promise<ScrapedProduct> {
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);
    const origin = this.safeOrigin(url);

    const result: ScrapedProduct = {
      images: [],
      specifications: [],
      sourceUrl: url,
      currency: 'USD',
      vendor: this.hostName(url),
    };

    this.applyJsonLd($, result, origin);
    this.applyMetaTags($, result, origin);
    this.applyHtmlFallback($, result, origin);

    // De-duplicate (same photo often appears via JSON-LD *and* og:image with
    // different query params) + cap
    result.images = this.dedupeImages(result.images).slice(0, MAX_IMAGES);
    result.dimensions ??= this.deriveDimensions($, result);

    if (!result.name) {
      throw new Error('Could not extract a product name from the page');
    }
    return result;
  }

  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) {
        throw new Error(`Vendor responded with HTTP ${res.status}`);
      }
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private applyJsonLd(
    $: cheerio.CheerioAPI,
    out: ScrapedProduct,
    origin: string,
  ): void {
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw) return;
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      const nodes = this.collectNodes(parsed);
      for (const product of nodes.filter((n) => this.isProduct(n))) {
        out.name ??= this.asString(product.name);
        out.description ??= this.asString(product.description);
        out.sku ??= this.asString(product.sku || product.mpn);

        const brand = product.brand;
        if (brand) {
          out.manufacturer ??= this.asString(
            typeof brand === 'string' ? brand : brand.name,
          );
        }

        // Offers may be a single Offer, an array, or an AggregateOffer with
        // nested offers; price may live on priceSpecification.
        const offerNodes = this.asArray(product.offers).flatMap((o) => [
          o,
          ...this.asArray(o?.offers),
        ]);
        for (const offer of offerNodes) {
          if (!offer) continue;
          const specs = this.asArray(offer.priceSpecification);
          const rawPrice =
            offer.price ??
            offer.lowPrice ??
            specs.find((s) => s?.price != null)?.price;
          const price = this.parsePrice(rawPrice);
          if (price != null) out.price ??= price;
          const cur =
            offer.priceCurrency ??
            specs.find((s) => s?.priceCurrency)?.priceCurrency;
          if (cur) out.currency = cur;
          if (out.price != null) break;
        }

        // Images may be plain strings or ImageObject nodes
        const imgs = this.asArray(product.image)
          .map((i) => this.imageUrl(i))
          .filter((s): s is string => Boolean(s));
        out.images.push(...imgs.map((s) => this.absolutize(s, origin)));

        // Vendors commonly publish specs as additionalProperty PropertyValues
        for (const prop of this.asArray(product.additionalProperty)) {
          if (out.specifications.length >= MAX_SPECS) break;
          const label = this.asString(prop?.name);
          const value = this.asString(prop?.value);
          if (label && value) out.specifications.push({ label, value });
        }

        out.dimensions ??= this.jsonLdDimensions(product);
      }
    });
  }

  private applyMetaTags(
    $: cheerio.CheerioAPI,
    out: ScrapedProduct,
    origin: string,
  ): void {
    const meta = (selector: string) =>
      $(selector).attr('content')?.trim() || undefined;

    out.name ??=
      meta('meta[property="og:title"]') ||
      meta('meta[name="twitter:title"]');
    out.description ??=
      meta('meta[property="og:description"]') ||
      meta('meta[name="description"]') ||
      meta('meta[name="twitter:description"]');

    // Collect EVERY og/twitter image tag — galleries publish several
    $(
      'meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]',
    ).each((_, el) => {
      const content = $(el).attr('content')?.trim();
      if (content) out.images.push(this.absolutize(content, origin));
    });

    out.vendor =
      meta('meta[property="og:site_name"]') || out.vendor;

    const priceMeta =
      meta('meta[property="product:price:amount"]') ||
      meta('meta[property="og:price:amount"]') ||
      meta('meta[itemprop="price"]');
    const p = this.parsePrice(priceMeta);
    if (p != null) out.price ??= p;
    const currencyMeta =
      meta('meta[property="product:price:currency"]') ||
      meta('meta[property="og:price:currency"]') ||
      meta('meta[itemprop="priceCurrency"]');
    if (currencyMeta) out.currency = currencyMeta;
  }

  private applyHtmlFallback(
    $: cheerio.CheerioAPI,
    out: ScrapedProduct,
    origin: string,
  ): void {
    out.name ??= $('h1').first().text().trim() || $('title').text().trim();

    if (out.price == null) {
      const priceText =
        $('[itemprop="price"]').attr('content') ||
        $('[itemprop="price"]').first().text() ||
        $('[data-price]').first().attr('data-price') ||
        $('[class*="price" i]').first().text();
      const match = priceText?.match(/([\d.,]+(?:\.\d+)?)/);
      const num = this.parsePrice(match?.[1]);
      if (num != null) {
        out.price = num;
        // Infer currency from a symbol next to the price when nothing
        // explicit was found earlier
        const symbol = priceText?.match(/[£€¥]/)?.[0];
        if (symbol && out.currency === 'USD') {
          out.currency = { '£': 'GBP', '€': 'EUR', '¥': 'JPY' }[symbol]!;
        }
      }
    }

    // Structured data rarely carries the full gallery — top it up from likely
    // gallery containers first, then any <img> as a last resort.
    if (out.images.length < 2) {
      const harvest = (_: number, el: any) => {
        if (out.images.length >= MAX_IMAGES) return;
        const src = this.bestImgSrc($, el);
        if (src) out.images.push(this.absolutize(src, origin));
      };
      $(
        '[class*="gallery" i] img, [class*="carousel" i] img, [class*="product-image" i] img, [data-zoom-image]',
      ).each(harvest);
      if (out.images.length === 0) $('img').each(harvest);
    }

    // Spec tables: <table> rows or <dt>/<dd> pairs
    $('table tr').each((_, el) => {
      if (out.specifications.length >= MAX_SPECS) return;
      const cells = $(el).find('th,td');
      if (cells.length === 2) {
        const label = $(cells[0]).text().trim();
        const value = $(cells[1]).text().trim();
        if (label && value && label.length < 60) {
          out.specifications.push({ label, value });
        }
      }
    });
    $('dl').each((_, dl) => {
      const dts = $(dl).find('dt');
      const dds = $(dl).find('dd');
      if (dts.length !== dds.length) return;
      dts.each((i, dt) => {
        if (out.specifications.length >= MAX_SPECS) return;
        const label = $(dt).text().trim();
        const value = $(dds[i]).text().trim();
        if (label && value && label.length < 60) {
          out.specifications.push({ label, value });
        }
      });
    });
  }

  /**
   * Dimensions, in priority order: an explicit spec row, composed from
   * individual width/depth/height specs, or a `12"W × 24"D × 30"H`-style
   * pattern in the description/page text.
   */
  private deriveDimensions(
    $: cheerio.CheerioAPI,
    out: ScrapedProduct,
  ): string | undefined {
    const direct = out.specifications.find(
      (s) => /dimension|measurement/i.test(s.label) || /^size$/i.test(s.label),
    );
    if (direct) return direct.value.slice(0, 160);

    const spec = (re: RegExp) =>
      out.specifications.find((s) => re.test(s.label.trim()))?.value;
    const w = spec(/^(overall )?width$/i);
    const d = spec(/^(overall )?depth$/i);
    const h = spec(/^(overall )?height$/i);
    const parts = [w && `${w}W`, d && `${d}D`, h && `${h}H`].filter(Boolean);
    if (parts.length >= 2) return parts.join(' × ');

    const text = `${out.description ?? ''}\n${$('body').text()}`;
    const match =
      text.match(DIMENSION_PATTERN) ?? text.match(LABELED_DIMENSION_PATTERN);
    return match
      ? match[0].replace(/\s+/g, ' ').trim().replace(/[x×,\s]+$/, '').slice(0, 160)
      : undefined;
  }

  // ---- helpers ----
  private collectNodes(parsed: any): any[] {
    if (Array.isArray(parsed)) return parsed.flatMap((p) => this.collectNodes(p));
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed['@graph'])) {
        return [parsed, ...parsed['@graph']];
      }
      return [parsed];
    }
    return [];
  }

  private isProduct(node: any): boolean {
    const type = node?.['@type'];
    if (!type) return false;
    const types = Array.isArray(type) ? type : [type];
    return types.some((t) => String(t).toLowerCase() === 'product');
  }

  /** schema.org image values: plain URL string or ImageObject node. */
  private imageUrl(v: any): string | undefined {
    if (v == null) return undefined;
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      return this.asString(v.url ?? v.contentUrl ?? v['@id']);
    }
    return undefined;
  }

  /** schema.org width/depth/height as QuantitativeValue or string. */
  private jsonLdDimensions(product: any): string | undefined {
    const quant = (v: any): string | undefined => {
      if (v == null) return undefined;
      if (typeof v === 'object') {
        const value = v.value ?? v.maxValue;
        if (value == null) return undefined;
        const unit = v.unitText ?? v.unitCode ?? '';
        return `${value}${unit ? ` ${unit}` : ''}`;
      }
      return this.asString(v);
    };
    const w = quant(product.width);
    const d = quant(product.depth);
    const h = quant(product.height);
    const parts = [w && `${w}W`, d && `${d}D`, h && `${h}H`].filter(Boolean);
    if (parts.length >= 2) return parts.join(' × ');
    if (product.size) {
      return this.asString(
        typeof product.size === 'object' ? product.size.name : product.size,
      );
    }
    return undefined;
  }

  /** Prefer the largest srcset candidate; skip lazy-load placeholders. */
  private bestImgSrc($: cheerio.CheerioAPI, el: any): string | undefined {
    const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
    if (srcset) {
      const candidates = srcset.split(',').map((c) => c.trim().split(/\s+/)[0]);
      const last = candidates[candidates.length - 1];
      if (last && this.isUsableImage(last)) return last;
    }
    const src =
      $(el).attr('src') ||
      $(el).attr('data-src') ||
      $(el).attr('data-zoom-image');
    return src && this.isUsableImage(src) ? src : undefined;
  }

  private isUsableImage(src: string): boolean {
    return !src.startsWith('data:') && !JUNK_IMAGE_PATTERN.test(src);
  }

  /**
   * Dedupe by host+path so the same photo served with different query params
   * (or http/https) collapses to its first occurrence.
   */
  private dedupeImages(urls: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const url of urls) {
      if (!url || url.startsWith('data:')) continue;
      let key: string;
      try {
        const parsed = new URL(url);
        key = `${parsed.host}${parsed.pathname}`.toLowerCase();
      } catch {
        key = url;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(url);
    }
    return result;
  }

  /**
   * Robust price parsing: strips currency symbols/spaces and handles both
   * `1,299.00` and European `1.299,00` (naive parseFloat reads the former
   * as 1).
   */
  private parsePrice(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
    let s = String(v).replace(/[^\d.,\-]/g, '');
    if (!s) return undefined;
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
      // Both present: the later one is the decimal separator
      s =
        lastComma > lastDot
          ? s.replace(/\./g, '').replace(',', '.')
          : s.replace(/,/g, '');
    } else if (lastComma > -1) {
      // Comma only: decimal if exactly 2 digits follow, else thousands
      s =
        s.length - lastComma === 3
          ? s.replace(',', '.')
          : s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  }

  private asString(v: any): string | undefined {
    if (v == null) return undefined;
    return typeof v === 'string' ? v : String(v);
  }

  private asArray(v: any): any[] {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  }

  private absolutize(src: string, origin: string): string {
    try {
      return new URL(src, origin).toString();
    } catch {
      return src;
    }
  }

  private safeOrigin(url: string): string {
    try {
      return new URL(url).origin;
    } catch {
      return '';
    }
  }

  private hostName(url: string): string | undefined {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }
}
