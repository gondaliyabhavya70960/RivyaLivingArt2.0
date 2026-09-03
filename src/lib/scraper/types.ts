/**
 * ScrapeDeck v4-compatible rich product schema. Every adapter maps its
 * platform's payload into this shape; the staging table, CSV export and
 * Google Sheet all speak it. Merge key: `${sourceKey}|${externalId}`.
 */
export type RichProduct = {
  externalId: string;
  url: string;
  sourceKey: string;
  vertical: string;
  currency: string;
  title: string;
  slug: string;
  category?: string;
  shortTagline?: string;
  /** HTML stripped. */
  description?: string;
  priceMin?: number;
  priceMax?: number;
  showPrice?: boolean;
  timeline?: string;
  materials?: string;
  dimensions?: string;
  status?: "active" | "out_of_stock";
  featured?: boolean;
  images: string[];
  imageAlts: string[];
  /** vendor/type/tags/attributes and anything platform-specific. */
  fields: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
};

export type AdapterPage = {
  products: RichProduct[];
  /** True when another page likely exists. */
  hasMore: boolean;
};

export type AdapterContext = {
  baseUrl: string;
  sourceKey: string;
  vertical: string;
  /** 1-based page cursor. */
  page: number;
  /**
   * The source's own politeness delay (`ScrapeSource.requestDelayMs`), or
   * null for the shared default. Adapters resolve it through `resolveDelayMs`
   * (breaker.ts), which only ever makes a source SLOWER than the floor — the
   * knob exists for a site that rate-limits us, not to speed past our own
   * default. It was declared, documented and stored for a month before
   * anything read it (Phase 0 audit §8).
   */
  requestDelayMs?: number | null;
};

export type Adapter = (ctx: AdapterContext) => Promise<AdapterPage>;

/**
 * User-Agent for all upstream fetches. Defaults to a mainstream desktop
 * browser string because many storefronts (Cloudflare / Shopify bot
 * protection) 403 an identifying bot UA and return nothing. Override with
 * SCRAPER_USER_AGENT to present a different identity (e.g. the transparent
 * research-bot string) without a code change. robots.txt is honored either
 * way — see lib/scraper/robots.ts.
 */
const DEFAULT_SCRAPER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export const SCRAPER_UA =
  process.env.SCRAPER_USER_AGENT?.trim() || DEFAULT_SCRAPER_UA;

/** Politeness delay between upstream requests (ms). */
export const POLITENESS_DELAY_MS = 700;
/** JSON-LD adapter is one request per product — slower + harder capped. */
export const JSONLD_DELAY_MS = 900;
/** Hard cap on pages fetched per engine invocation (serverless budget). */
export const PAGES_PER_INVOCATION = 2;
/** Absolute per-job page cap. */
export const MAX_PAGES_PER_JOB = 40;
/** JSON-LD: absolute products per run. */
export const MAX_JSONLD_PRODUCTS_PER_RUN = 150;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
