/**
 * WooCommerce adapter (server-only) — reads the public Store API
 * `/wp-json/wc/store/v1/products`, 100 products per page. Store API prices
 * are MINOR units (paise/cents) with `currency_minor_unit` indicating the
 * divisor exponent.
 */
import {
  POLITENESS_DELAY_MS,
  SCRAPER_UA,
  sleep,
  type Adapter,
  type AdapterContext,
  type RichProduct,
} from "@/lib/scraper/types";
import { resolveDelayMs } from "@/lib/scraper/breaker";
import { jsonldAdapter } from "@/lib/scraper/adapters/jsonld";
import { safeFetch } from "@/lib/scraper/ssrf";
import { slugify } from "@/lib/slug";
import { stripHtml } from "@/lib/scraper/adapters/strip-html";

const PAGE_SIZE = 100;

/**
 * Statuses meaning the Store API is off / bot-gated / gone (older WooCommerce
 * installs and hardened hosts don't expose it). On these we fall back to the
 * site's JSON-LD product pages rather than failing the job. Transient errors
 * (429, 5xx, timeouts) still throw so the job can be resumed.
 */
const STRUCTURAL_STATUS = new Set([401, 403, 404, 410]);
const DESCRIPTION_MAX = 2000;

type WooTerm = { name?: string };

type WooAttribute = {
  name?: string;
  terms?: WooTerm[];
};

type WooImage = {
  src?: string;
  alt?: string | null;
};

type WooPrices = {
  price?: string;
  price_range?: { min_amount?: string; max_amount?: string } | null;
  currency_code?: string;
  currency_minor_unit?: number;
};

type WooProduct = {
  id: number | string;
  name?: string;
  slug?: string;
  permalink?: string;
  description?: string | null;
  short_description?: string | null;
  is_in_stock?: boolean;
  prices?: WooPrices;
  images?: WooImage[];
  categories?: WooTerm[];
  tags?: WooTerm[];
  attributes?: WooAttribute[];
};

function toMajorUnits(
  amount: string | undefined,
  minorUnit: number,
): number | undefined {
  const n = Number.parseFloat(String(amount));
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n / 10 ** minorUnit);
}

function termNames(terms: WooTerm[] | undefined): string[] {
  return (Array.isArray(terms) ? terms : [])
    .map((t) => t?.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

function mapProduct(item: WooProduct, ctx: AdapterContext): RichProduct | null {
  if (item?.id === undefined || item.id === null) return null;
  const title = (item.name ?? "").trim();
  if (!title) return null;

  const prices = item.prices ?? {};
  const minorUnit = Number.isFinite(prices.currency_minor_unit)
    ? Number(prices.currency_minor_unit)
    : 2;

  let priceMin: number | undefined;
  let priceMax: number | undefined;
  if (prices.price_range) {
    priceMin = toMajorUnits(prices.price_range.min_amount, minorUnit);
    priceMax = toMajorUnits(prices.price_range.max_amount, minorUnit);
  } else {
    priceMin = priceMax = toMajorUnits(prices.price, minorUnit);
  }

  const images = (Array.isArray(item.images) ? item.images : []).filter(
    (i): i is WooImage & { src: string } =>
      typeof i?.src === "string" && i.src.length > 0,
  );

  const attributes = Array.isArray(item.attributes) ? item.attributes : [];
  const dimensionAttr = attributes.find((a) =>
    /dimension|size/i.test(a?.name ?? ""),
  );
  const dimensions = dimensionAttr
    ? termNames(dimensionAttr.terms).join(", ")
    : "";

  const attributeMap: Record<string, string[]> = {};
  for (const a of attributes) {
    if (a?.name) attributeMap[a.name] = termNames(a.terms);
  }

  const slug = (item.slug ?? "").trim() || slugify(title);

  return {
    externalId: String(item.id),
    url: item.permalink || `${ctx.baseUrl}/product/${slug}`,
    sourceKey: ctx.sourceKey,
    vertical: ctx.vertical,
    currency: prices.currency_code || "INR",
    title,
    slug,
    category: item.categories?.[0]?.name || undefined,
    description:
      stripHtml(item.short_description || item.description).slice(
        0,
        DESCRIPTION_MAX,
      ) || undefined,
    priceMin,
    priceMax,
    showPrice: true,
    dimensions: dimensions || undefined,
    status: item.is_in_stock === false ? "out_of_stock" : "active",
    images: images.map((i) => i.src),
    imageAlts: images.map((i) => i.alt ?? ""),
    fields: {
      categories: termNames(item.categories),
      tags: termNames(item.tags),
      attributes: attributeMap,
    },
    // The Store API gives a range, not a variant list, so a ranged product
    // becomes TWO rows — its floor and its ceiling — rather than one made-up
    // midpoint. A single price is one implicit variant. Either way a product
    // with no parseable price keeps a NULL, which is what QUOTE_ONLY reads
    // (phase 6b).
    variants:
      priceMin !== undefined && priceMax !== undefined && priceMin !== priceMax
        ? [
            { label: "from", priceMajor: priceMin, available: item.is_in_stock },
            { label: "to", priceMajor: priceMax, available: item.is_in_stock },
          ]
        : [
            {
              priceMajor: priceMin ?? null,
              available: item.is_in_stock,
            },
          ],
  };
}

export const wooAdapter: Adapter = async (ctx) => {
  if (ctx.page > 1) {
    await sleep(resolveDelayMs(ctx.requestDelayMs, POLITENESS_DELAY_MS));
  }

  // The Store API lives at the site root regardless of scope, so a CATEGORY
  // job (ctx.baseUrl = the listing page the operator pasted, e.g.
  // "https://store.tld/product-category/vases/") derives the origin to call
  // it at and passes the listing's last path segment as the `category`
  // filter — best-effort (it assumes WooCommerce's own permalink shape), and
  // if the site names categories differently the request simply returns an
  // empty page rather than throwing, so a bad guess demotes to STRUCTURAL /
  // empty output instead of failing the job.
  let origin = ctx.baseUrl;
  let categoryParam = "";
  if (ctx.scope === "CATEGORY") {
    try {
      const listing = new URL(ctx.baseUrl);
      origin = listing.origin;
      const slug = listing.pathname.split("/").filter(Boolean).pop();
      if (slug) categoryParam = `&category=${encodeURIComponent(slug)}`;
    } catch {
      // Malformed listing URL — fall through with the raw baseUrl as origin;
      // the request below then 404s and falls back to JSON-LD like any other
      // structural failure.
    }
  }

  const url = `${origin}/wp-json/wc/store/v1/products?per_page=${PAGE_SIZE}&page=${ctx.page}${categoryParam}`;
  // Validate the host + any redirect hop before the request (SEC-107) — raw
  // fetch's default redirect:"follow" bypassed the SSRF guard.
  const res = await safeFetch(url, {
    headers: { "User-Agent": SCRAPER_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    if (STRUCTURAL_STATUS.has(res.status)) return jsonldAdapter(ctx);
    throw new Error(
      `WooCommerce Store API request failed with HTTP ${res.status} (${url})`,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // 200 but not JSON (bot-challenge / HTML) — try JSON-LD instead.
    return jsonldAdapter(ctx);
  }
  // The Store API returns a bare array. Anything else means it isn't really
  // available here → fall back to JSON-LD product pages.
  if (!Array.isArray(body)) return jsonldAdapter(ctx);
  const items = body as WooProduct[];

  const products: RichProduct[] = [];
  for (const item of items) {
    try {
      const mapped = mapProduct(item, ctx);
      if (mapped) products.push(mapped);
    } catch {
      // Malformed product — skip, never fail the page.
    }
  }

  return { products, hasMore: items.length === PAGE_SIZE };
};
