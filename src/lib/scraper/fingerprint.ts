import { SCRAPER_UA } from "@/lib/scraper/types";
import { hasDiscoverableProducts } from "@/lib/scraper/sitemaps";
import { safeFetch } from "@/lib/scraper/ssrf";

export type Platform = "SHOPIFY" | "WOOCOMMERCE" | "JSONLD" | "UNKNOWN";

/** Storefront signatures in page HTML — a fallback when the API is bot-gated. */
const SHOPIFY_HTML = /cdn\.shopify\.com|\/cdn\/shop\/|Shopify\.theme|myshopify\.com|shopify-section/i;
const WOO_HTML = /woocommerce|wp-content\/plugins\/woocommerce|wc-block|\/wp-json\/wc\//i;

/** Marketplaces are never scraped — use their official APIs. */
const MARKETPLACE_PATTERNS = [
  "amazon.",
  "etsy.",
  "flipkart.",
  "meesho.",
  "indiamart.",
  "tradeindia.",
];

export function isBlockedMarketplace(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return MARKETPLACE_PATTERNS.some(
    (p) => host.includes(`.${p.slice(0, -1)}.`) || host.startsWith(p) || host.includes(p),
  );
}

export function normalizeBaseUrl(input: string): string {
  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const u = new URL(withProto);
  return `${u.protocol}//${u.host}`;
}

/**
 * The page a CATEGORY or URL scoped job targets: scheme defaulted, hash
 * dropped and trailing slashes trimmed like `normalizeBaseUrl`, but the PATH
 * AND QUERY KEPT. `normalizeBaseUrl` identifies a site; a scoped job's whole
 * point is one page on it, and reducing the pasted URL to its origin turned
 * every category and single-URL job into a whole-source crawl (the runner did
 * exactly that until the 2026-09-04 plan audit caught it — the adapters were
 * right, they were handed the wrong URL).
 */
export function normalizePageUrl(input: string): string {
  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const u = new URL(withProto);
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.protocol}//${u.host}${path}${u.search}`;
}

async function probe(url: string, timeoutMs = 10_000): Promise<Response | null> {
  try {
    // safeFetch validates the host (and each redirect hop) is a public
    // address before the request leaves the box (SEC-107).
    const res = await safeFetch(url, {
      headers: { "User-Agent": SCRAPER_UA, Accept: "application/json, text/html;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res;
  } catch {
    return null;
  }
}

/**
 * Platform auto-detect, in spec order:
 * 1. {url}/products.json           → SHOPIFY
 * 2. {url}/wp-json/wc/store/v1/products → WOOCOMMERCE
 * 3. homepage (or sitemap) exposes application/ld+json Product → JSONLD
 */
export async function fingerprint(baseUrl: string): Promise<Platform> {
  const base = normalizeBaseUrl(baseUrl);

  const shopify = await probe(`${base}/products.json?limit=1`);
  if (shopify?.ok) {
    try {
      const body = await shopify.json();
      if (Array.isArray(body?.products)) return "SHOPIFY";
    } catch {
      /* not JSON — fall through */
    }
  }

  const woo = await probe(`${base}/wp-json/wc/store/v1/products?per_page=1`);
  if (woo?.ok) {
    try {
      const body = await woo.json();
      if (Array.isArray(body)) return "WOOCOMMERCE";
    } catch {
      /* fall through */
    }
  }

  const home = await probe(base);
  if (home?.ok) {
    const html = await home.text();
    // Storefront fingerprints in the page HTML catch Shopify/Woo even when
    // their catalog API is disabled or bot-gated — the adapters then fall
    // back to JSON-LD product pages on their own.
    if (SHOPIFY_HTML.test(html)) return "SHOPIFY";
    if (WOO_HTML.test(html)) return "WOOCOMMERCE";
    if (hasProductJsonLd(html)) return "JSONLD";
  }

  // Last resort: any product URLs discoverable from robots.txt + the common
  // sitemap locations (sitemap-index aware) → generic JSON-LD extraction.
  if (await hasDiscoverableProducts(base)) return "JSONLD";

  return "UNKNOWN";
}

export function hasProductJsonLd(html: string): boolean {
  const blocks = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (!blocks) return false;
  return blocks.some((b) => /"@type"\s*:\s*"?(Product|ItemList)"?/.test(b));
}
