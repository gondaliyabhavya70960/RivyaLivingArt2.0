/**
 * JSON-LD adapter (server-only) — generic fallback for sites without a
 * catalog API. Discovers product URLs from the sitemap, then fetches each
 * page and extracts the schema.org Product node from its
 * `application/ld+json` blocks. One HTTP request per product, so it is
 * slower (JSONLD_DELAY_MS) and hard-capped (MAX_JSONLD_PRODUCTS_PER_RUN).
 *
 * The sitemap is re-fetched on every call (each call handles one 8-URL
 * page) — acceptable: it is a single cheap request per invocation.
 */
import {
  JSONLD_DELAY_MS,
  MAX_JSONLD_PRODUCTS_PER_RUN,
  SCRAPER_UA,
  sleep,
  type Adapter,
  type AdapterContext,
  type RichProduct,
} from "@/lib/scraper/types";
import { discoverProductUrls } from "@/lib/scraper/sitemaps";
import { safeFetch } from "@/lib/scraper/ssrf";
import { slugify } from "@/lib/slug";
import { stripHtml } from "@/lib/scraper/adapters/strip-html";

const PAGE_SIZE = 8;

/* ------------------------------------------------------------ JSON-LD map */

type JsonLdNode = Record<string, unknown>;

function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    if (m[1]) blocks.push(m[1]);
  }
  return blocks;
}

function isProductNode(node: unknown): node is JsonLdNode {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const type = (node as JsonLdNode)["@type"];
  if (typeof type === "string") return type === "Product";
  if (Array.isArray(type)) return type.includes("Product");
  return false;
}

/** Tolerant parse of every ld+json block; flattens arrays and @graph. */
function findProductNode(html: string): JsonLdNode | null {
  for (const block of extractJsonLdBlocks(html)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue; // malformed block — keep looking
    }
    const roots = Array.isArray(parsed) ? parsed : [parsed];
    const nodes: unknown[] = [];
    for (const root of roots) {
      nodes.push(root);
      const graph = (root as JsonLdNode | null)?.["@graph"];
      if (Array.isArray(graph)) nodes.push(...graph);
    }
    const product = nodes.find(isProductNode);
    if (product) return product;
  }
  return null;
}

function normalizeImages(image: unknown): { srcs: string[]; alts: string[] } {
  const items = Array.isArray(image) ? image : image ? [image] : [];
  const srcs: string[] = [];
  const alts: string[] = [];
  for (const item of items) {
    if (typeof item === "string" && item) {
      srcs.push(item);
      alts.push("");
    } else if (item && typeof item === "object") {
      const obj = item as JsonLdNode;
      const src = obj.url ?? obj.contentUrl;
      if (typeof src === "string" && src) {
        srcs.push(src);
        alts.push(typeof obj.caption === "string" ? obj.caption : "");
      }
    }
  }
  return { srcs, alts };
}

function pathnameSlug(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  } catch {
    return "";
  }
}

function mapProduct(node: JsonLdNode, pageUrl: string, ctx: AdapterContext): RichProduct | null {
  const title = typeof node.name === "string" ? node.name.trim() : "";
  if (!title) return null;

  const offers = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : [];
  const prices: number[] = [];
  let currency: string | undefined;
  let availability: string | undefined;
  for (const offer of offers) {
    if (!offer || typeof offer !== "object") continue;
    const o = offer as JsonLdNode;
    for (const key of ["price", "lowPrice", "highPrice"] as const) {
      const n = Number.parseFloat(String(o[key]));
      if (Number.isFinite(n)) prices.push(n);
    }
    if (!currency && typeof o.priceCurrency === "string" && o.priceCurrency) {
      currency = o.priceCurrency;
    }
    if (!availability && typeof o.availability === "string" && o.availability) {
      availability = o.availability;
    }
  }

  const { srcs, alts } = normalizeImages(node.image);
  const sku = typeof node.sku === "string" ? node.sku.trim() : "";
  const productID = typeof node.productID === "string" ? node.productID.trim() : "";
  const urlSlug = pathnameSlug(pageUrl);
  const externalId = sku || productID || urlSlug;
  if (!externalId) return null;

  const brand = node.brand as JsonLdNode | string | undefined;
  const brandName =
    typeof brand === "string" ? brand : typeof brand?.name === "string" ? brand.name : undefined;

  return {
    externalId,
    url: pageUrl,
    sourceKey: ctx.sourceKey,
    vertical: ctx.vertical,
    currency: currency || "INR",
    title,
    slug: urlSlug || slugify(title),
    description:
      typeof node.description === "string"
        ? stripHtml(node.description) || undefined
        : undefined,
    priceMin: prices.length ? Math.round(Math.min(...prices)) : undefined,
    priceMax: prices.length ? Math.round(Math.max(...prices)) : undefined,
    showPrice: true,
    // No availability markup at all → assume purchasable rather than OOS.
    status: availability
      ? /instock/i.test(availability)
        ? "active"
        : "out_of_stock"
      : "active",
    images: srcs,
    imageAlts: alts,
    fields: { sku, productID, brand: brandName },
  };
}

/* ---------------------------------------------------------------- adapter */

export const jsonldAdapter: Adapter = async (ctx) => {
  const collected = await discoverProductUrls(ctx.baseUrl, MAX_JSONLD_PRODUCTS_PER_RUN);
  const slice = collected.slice((ctx.page - 1) * PAGE_SIZE, ctx.page * PAGE_SIZE);

  const products: RichProduct[] = [];
  for (const pageUrl of slice) {
    await sleep(JSONLD_DELAY_MS);
    try {
      // Product URLs come from the (attacker-controllable) sitemap, so each
      // page fetch — and its redirects — must clear the SSRF guard (SEC-107).
      const res = await safeFetch(pageUrl, {
        headers: { "User-Agent": SCRAPER_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue; // one dead product page must not fail the run
      const node = findProductNode(await res.text());
      if (!node) continue; // page without a Product node — skip, do not fail
      const mapped = mapProduct(node, pageUrl, ctx);
      if (mapped) products.push(mapped);
    } catch {
      // Timeout / parse issue on a single page — skip and continue.
    }
  }

  return { products, hasMore: ctx.page * PAGE_SIZE < collected.length };
};
