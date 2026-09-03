/**
 * Shopify adapter (server-only) — reads the public storefront
 * `/products.json` endpoint, 250 products per page.
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

const PAGE_SIZE = 250;

/**
 * HTTP statuses that mean "this endpoint is off / bot-gated / gone" rather
 * than a transient blip. Many Shopify stores disable or bot-protect
 * /products.json, so on these we fall back to the site's JSON-LD product
 * pages instead of failing the whole job. Transient errors (429, 5xx,
 * timeouts) still throw so the job can be resumed.
 */
const STRUCTURAL_STATUS = new Set([401, 403, 404, 410]);

type ShopifyVariant = {
  price?: string | number;
  available?: boolean;
};

type ShopifyImage = {
  src?: string;
  alt?: string | null;
};

type ShopifyProduct = {
  id: number | string;
  title?: string;
  handle?: string;
  body_html?: string | null;
  vendor?: string;
  product_type?: string;
  tags?: string[] | string;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
};

function mapProduct(
  p: ShopifyProduct,
  ctx: AdapterContext,
): RichProduct | null {
  if (p?.id === undefined || p.id === null) return null;
  const title = (p.title ?? "").trim();
  const handle = (p.handle ?? "").trim();
  if (!title && !handle) return null;

  const variants = Array.isArray(p.variants) ? p.variants : [];
  // Shopify products.json prices are major units ("1499.00").
  const prices = variants
    .map((v) => Number.parseFloat(String(v?.price)))
    .filter((n) => Number.isFinite(n));

  const images = (Array.isArray(p.images) ? p.images : []).filter(
    (i): i is ShopifyImage & { src: string } =>
      typeof i?.src === "string" && i.src.length > 0,
  );

  return {
    externalId: String(p.id),
    url: `${ctx.baseUrl}/products/${handle}`,
    sourceKey: ctx.sourceKey,
    vertical: ctx.vertical,
    currency: "INR",
    title: title || handle,
    slug: handle || slugify(title),
    category: p.product_type || undefined,
    description: stripHtml(p.body_html) || undefined,
    priceMin: prices.length ? Math.round(Math.min(...prices)) : undefined,
    priceMax: prices.length ? Math.round(Math.max(...prices)) : undefined,
    showPrice: true,
    status: variants.some((v) => v?.available) ? "active" : "out_of_stock",
    images: images.map((i) => i.src),
    imageAlts: images.map((i) => i.alt ?? ""),
    fields: {
      vendor: p.vendor,
      productType: p.product_type,
      tags: p.tags,
    },
  };
}

export const shopifyAdapter: Adapter = async (ctx) => {
  if (ctx.page > 1) {
    await sleep(resolveDelayMs(ctx.requestDelayMs, POLITENESS_DELAY_MS));
  }

  // CATEGORY scope needs no branch here: `ctx.baseUrl` is then the
  // collection page the operator pasted (e.g. ".../collections/vases"), and
  // Shopify serves that exact URL's own `/products.json` — the same request
  // this line always made, just scoped by which URL it was handed.
  const url = `${ctx.baseUrl}/products.json?limit=${PAGE_SIZE}&page=${ctx.page}`;
  // Validate the host + any redirect hop before the request — a source whose
  // /products.json 30x-redirects to an internal address must not be followed
  // (SEC-107; raw fetch's default redirect:"follow" bypassed the guard).
  const res = await safeFetch(url, {
    headers: { "User-Agent": SCRAPER_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    if (STRUCTURAL_STATUS.has(res.status)) return jsonldAdapter(ctx);
    throw new Error(
      `Shopify products.json request failed with HTTP ${res.status} (${url})`,
    );
  }

  let body: { products?: ShopifyProduct[] };
  try {
    body = (await res.json()) as { products?: ShopifyProduct[] };
  } catch {
    // A 200 that isn't JSON (bot-challenge / HTML) — try JSON-LD instead.
    return jsonldAdapter(ctx);
  }
  // `products` key absent → not a real storefront feed; fall back. An empty
  // array IS valid (end of catalogue) and must NOT trigger a fallback loop.
  if (!Array.isArray(body?.products)) return jsonldAdapter(ctx);
  const raw = body.products;

  const products: RichProduct[] = [];
  for (const p of raw) {
    try {
      const mapped = mapProduct(p, ctx);
      if (mapped) products.push(mapped);
    } catch {
      // Malformed product — skip, never fail the page.
    }
  }

  return { products, hasMore: raw.length === PAGE_SIZE };
};
