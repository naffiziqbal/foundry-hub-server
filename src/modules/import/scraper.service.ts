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

/**
 * Extracts product metadata from a vendor URL using, in priority order:
 *   1. JSON-LD (schema.org Product)
 *   2. OpenGraph / Twitter / meta tags
 *   3. Heuristic HTML fallback (h1, price patterns, og:image, <img>)
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

    this.applyJsonLd($, result);
    this.applyMetaTags($, result, origin);
    this.applyHtmlFallback($, result, origin);

    // De-duplicate + cap images
    result.images = Array.from(new Set(result.images)).slice(0, 8);
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

  private applyJsonLd($: cheerio.CheerioAPI, out: ScrapedProduct): void {
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
      const product = nodes.find((n) => this.isProduct(n));
      if (!product) return;

      out.name ??= this.asString(product.name);
      out.description ??= this.asString(product.description);
      out.sku ??= this.asString(product.sku || product.mpn);

      const brand = product.brand;
      if (brand) {
        out.manufacturer ??= this.asString(
          typeof brand === 'string' ? brand : brand.name,
        );
      }

      const offers = Array.isArray(product.offers)
        ? product.offers[0]
        : product.offers;
      if (offers) {
        const price = parseFloat(offers.price ?? offers.lowPrice);
        if (Number.isFinite(price)) out.price ??= price;
        if (offers.priceCurrency) out.currency = offers.priceCurrency;
      }

      const imgs = this.asArray(product.image);
      out.images.push(...imgs.filter(Boolean).map((s) => this.asString(s)!));
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

    const ogImage =
      meta('meta[property="og:image"]') ||
      meta('meta[property="og:image:secure_url"]') ||
      meta('meta[name="twitter:image"]');
    if (ogImage) out.images.push(this.absolutize(ogImage, origin));

    out.vendor =
      meta('meta[property="og:site_name"]') || out.vendor;

    const priceMeta =
      meta('meta[property="product:price:amount"]') ||
      meta('meta[property="og:price:amount"]');
    if (priceMeta) {
      const p = parseFloat(priceMeta);
      if (Number.isFinite(p)) out.price ??= p;
    }
    const currencyMeta =
      meta('meta[property="product:price:currency"]') ||
      meta('meta[property="og:price:currency"]');
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
        $('[class*="price" i]').first().text();
      const match = priceText?.match(/([\d.,]+)/);
      if (match) {
        const num = parseFloat(match[1].replace(/,/g, ''));
        if (Number.isFinite(num)) out.price = num;
      }
    }

    if (out.images.length === 0) {
      $('img').each((_, el) => {
        if (out.images.length >= 4) return;
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.startsWith('data:')) {
          out.images.push(this.absolutize(src, origin));
        }
      });
    }

    // Spec tables: <table> rows or <dt>/<dd> pairs
    $('table tr').each((_, el) => {
      if (out.specifications.length >= 20) return;
      const cells = $(el).find('th,td');
      if (cells.length === 2) {
        const label = $(cells[0]).text().trim();
        const value = $(cells[1]).text().trim();
        if (label && value && label.length < 60) {
          out.specifications.push({ label, value });
        }
      }
    });
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
