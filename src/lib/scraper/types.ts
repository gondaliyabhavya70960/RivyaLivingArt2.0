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
  /**
   * What this job was asked to cover (`ScrapeJob.scope`): the whole source
   * (default, every adapter's ordinary behaviour), one category/listing page
   * (`baseUrl` IS that listing, paginated — a platform adapter that already
   * derives its endpoint from `baseUrl` needs no change), or one product page
   * (`baseUrl` IS that page — routed to the JSON-LD path centrally in
   * `continueScrapeJob` regardless of platform, since a store's product API
   * has no "just this one" request the way a JSON-LD fetch does).
   */
  scope?: "SOURCE" | "CATEGORY" | "URL";
};

export type Adapter = (ctx: AdapterContext) => Promise<AdapterPage>;

/**
 * Our product token. `robots.ts` matches `User-agent:` groups against it, and
 * the User-Agent below announces it — one constant, because a crawler that
 * obeys rules written for a name it never sends is only theoretically polite.
 */
export const SCRAPER_BOT_TOKEN = "RivyaLivingArtResearchBot";

/**
 * User-Agent for all upstream fetches.
 *
 * This used to default to a Chrome string, for a reason its own comment
 * stated plainly: "many storefronts (Cloudflare / Shopify bot protection) 403
 * an identifying bot UA and return nothing". That is the definition of a
 * stealth mechanism — the 403 IS the site's answer, and dressing up as a
 * browser to get a different one is evading an access control rather than
 * honouring it. It also made `robots.ts` incoherent: a site operator could
 * write a rule for `RivyaLivingArtResearchBot` and never see that name in
 * their logs, so they had no way to rate-limit us, contact us, or block us
 * short of blocking Chrome.
 *
 * So the default identifies us and carries a contact URL, per RFC 9309 §2.2.1
 * convention. Sources that refuse an honest crawler are sources this project
 * does not scrape — that is `manual_research` mode's entire purpose
 * (docs/plan/02-scraper-rebuild.md §5), not a problem to route around.
 *
 * SCRAPER_USER_AGENT still overrides it, because an operator may need to add
 * a more specific contact address. It is not an invitation to put the browser
 * string back.
 */
const DEFAULT_SCRAPER_UA = `${SCRAPER_BOT_TOKEN}/1.0 (+https://rivyalivingart.com/contact)`;

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
