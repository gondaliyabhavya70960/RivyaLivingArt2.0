/**
 * Robust product-URL discovery from a site's sitemaps (server-only). Shared
 * by the JSON-LD adapter and the fingerprint. Deliberately fault-tolerant:
 * it tries the robots.txt `Sitemap:` directives first, then a spread of
 * common sitemap paths (Yoast/WordPress use /sitemap_index.xml or
 * /wp-sitemap.xml, Shopify uses /sitemap.xml, etc.), follows a sitemap
 * index into its child sitemaps, and NEVER throws — an undiscoverable
 * sitemap yields an empty list rather than a failed scrape job.
 */
import { POLITENESS_DELAY_MS, SCRAPER_UA, sleep } from "@/lib/scraper/types";
import { safeFetch } from "@/lib/scraper/ssrf";

/** Common sitemap locations, tried in order after robots.txt hints. */
const COMMON_SITEMAP_PATHS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap-index.xml",
  "/wp-sitemap.xml",
  "/product-sitemap.xml",
  "/product_sitemap.xml",
  "/sitemap_products_1.xml",
  "/sitemap/sitemap.xml",
];

/** Cap on child sitemaps followed from an index, across all candidates. */
const MAX_NESTED_SITEMAPS = 6;

function origin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl.replace(/\/+$/, "");
  }
}

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  for (const m of xml.matchAll(/<loc[^>]*>\s*([^<]+?)\s*<\/loc>/gi)) {
    if (m[1]) locs.push(m[1].trim());
  }
  return locs;
}

export function looksLikeProductUrl(url: string): boolean {
  try {
    return /\/(product|products|shop)\//i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function fetchText(
  url: string,
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    // safeFetch validates the host (and every redirect hop) is public before
    // the request goes out — robots.txt and every sitemap/child-sitemap URL is
    // attacker-controlled content, so this closes the SSRF hole SEC-107 left in
    // the discovery path (it throws SsrfError on an internal target, which the
    // surrounding try/catch already treats as "skip").
    const res = await safeFetch(url, {
      headers: {
        "User-Agent": SCRAPER_UA,
        Accept: "application/xml, text/xml, text/plain;q=0.8, text/html;q=0.6",
      },
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : "" };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

/** Sitemap URLs advertised in robots.txt (absolute URLs, any casing). */
async function sitemapsFromRobots(base: string): Promise<string[]> {
  const res = await fetchText(`${base}/robots.txt`);
  if (!res.ok) return [];
  const out: string[] = [];
  for (const line of res.text.split(/\r?\n/)) {
    const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
    if (m?.[1]) out.push(m[1].trim());
  }
  return out;
}

/** De-duplicated candidate sitemap URLs: robots.txt hints, then common paths. */
async function candidateSitemaps(base: string): Promise<string[]> {
  const seen = new Set<string>();
  const push = (u: string) => {
    if (u && !seen.has(u)) seen.add(u);
  };
  for (const u of await sitemapsFromRobots(base)) push(u);
  for (const p of COMMON_SITEMAP_PATHS) push(`${base}${p}`);
  return [...seen];
}

const isSitemapIndex = (xml: string) => /<sitemapindex[\s>]/i.test(xml);

/**
 * Collect up to `cap` product-page URLs for a site. Returns a stable
 * (sorted) list so the JSON-LD adapter's page cursor is deterministic
 * across invocations. Empty when nothing is discoverable.
 */
export async function discoverProductUrls(
  baseUrl: string,
  cap: number,
): Promise<string[]> {
  const base = origin(baseUrl);
  const candidates = await candidateSitemaps(base);
  const found = new Set<string>();
  let nestedBudget = MAX_NESTED_SITEMAPS;

  for (const sitemapUrl of candidates) {
    if (found.size >= cap) break;
    const res = await fetchText(sitemapUrl);
    if (!res.ok || !res.text) continue;

    if (isSitemapIndex(res.text)) {
      const children = extractLocs(res.text);
      // Product-named child sitemaps first — cheaper path to real products.
      const ordered = [
        ...children.filter((u) => /product/i.test(u)),
        ...children.filter((u) => !/product/i.test(u)),
      ];
      for (const child of ordered) {
        if (found.size >= cap || nestedBudget <= 0) break;
        nestedBudget -= 1;
        await sleep(POLITENESS_DELAY_MS);
        const c = await fetchText(child);
        if (!c.ok || !c.text) continue;
        const fromProductSitemap = /product/i.test(child);
        for (const loc of extractLocs(c.text)) {
          if (fromProductSitemap || looksLikeProductUrl(loc)) found.add(loc);
        }
      }
    } else {
      for (const loc of extractLocs(res.text)) {
        if (looksLikeProductUrl(loc)) found.add(loc);
      }
    }

    // First candidate that yields product URLs wins — don't keep probing.
    if (found.size > 0) break;
  }

  return [...found].sort().slice(0, cap);
}

/** Cheap boolean hint for fingerprinting: does the site expose product URLs? */
export async function hasDiscoverableProducts(baseUrl: string): Promise<boolean> {
  const urls = await discoverProductUrls(baseUrl, 1);
  return urls.length > 0;
}
