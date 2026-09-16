/**
 * Priced-store page mapper (B5) — the PRICED_STORE markup shape: a single
 * product page that carries commerce markup but no usable JSON-LD Product
 * node (Wix, Squarespace, custom themes, WooCommerce installs whose Store
 * API is off AND whose pages lost their schema plugin).
 *
 * Pure: HTML string in, RichProduct out, no network. The engine's fetch path
 * (`jsonld.ts` fallback) is the only caller with a socket. Gates referenced
 * below are docs/adapter-acceptance-checklist.md.
 */
import type {
  AdapterContext,
  RichProduct,
  ScrapedVariant,
} from "@/lib/scraper/types";
import { slugify } from "@/lib/slug";
import { stripHtml } from "@/lib/scraper/adapters/strip-html";
import {
  collectImages,
  declaredCurrency,
  extractSpecs,
  firstTagText,
  itempropValue,
  looksLikeListing,
  metaContent,
  pathnameSlug,
  priceContextText,
  publishedPrices,
  variantBlob,
} from "@/lib/scraper/adapters/markup";

const DESCRIPTION_MAX = 2000;

type VariantEntry = {
  attributes?: Record<string, unknown>;
  price?: unknown;
  display_price?: unknown;
  is_in_stock?: unknown;
};

/** One row per variant the blob publishes, axes and prices kept (gate B4). */
function variantsFromBlob(html: string): ScrapedVariant[] {
  const out: ScrapedVariant[] = [];
  for (const entry of variantBlob(html)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as VariantEntry;
    const raw = e.display_price ?? e.price;
    const price =
      raw === null || raw === undefined
        ? null
        : Number.parseFloat(String(raw).replace(/,/g, ""));
    const options: Record<string, string> = {};
    if (e.attributes && typeof e.attributes === "object") {
      for (const [k, v] of Object.entries(e.attributes)) {
        const axis = k.replace(/^attribute_/, "").replace(/[-_]/g, " ");
        if (typeof v === "string" && v) options[axis] = v;
      }
    }
    out.push({
      label: Object.values(options).join(" / ") || undefined,
      options: Object.keys(options).length ? options : undefined,
      priceMajor: Number.isFinite(price) ? (price as number) : null,
      available:
        typeof e.is_in_stock === "boolean" ? e.is_in_stock : undefined,
    });
  }
  return out;
}

/**
 * Map one priced-store product page. Returns null when the page is not
 * confidently a single priced product — no title, or no price the markup
 * declares (gate B1's counterpart: a priced page with no price is the
 * QUOTE_STUDIO shape's job, or no product at all).
 */
export function mapPricedStorePage(
  html: string,
  pageUrl: string,
  ctx: Pick<AdapterContext, "sourceKey" | "vertical">,
): RichProduct | null {
  if (looksLikeListing(html)) return null; // gate D3, held at mapper level too
  const title =
    itempropValue(html, "name") ??
    metaContent(html, ["og:title"]) ??
    firstTagText(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!title) return null;

  const prices = publishedPrices(html);
  const amounts = [
    ...new Set(prices.map((p) => p.amount).filter(Number.isFinite)),
  ].sort((a, b) => a - b);
  if (amounts.length === 0) return null;

  const urlSlug = pathnameSlug(pageUrl);
  const externalId =
    itempropValue(html, "sku") ??
    metaContent(html, ["product:retailer_item_id"]) ??
    (/\bdata-product_id=["']([^"']+)["']/i.exec(html)?.[1] || null) ??
    urlSlug;
  if (!externalId) return null;

  // Per-variant rows when the page names them; a bare range becomes floor +
  // ceiling rows, never an invented midpoint; one price is one implicit
  // variant (gate B4).
  const blobVariants = variantsFromBlob(html);
  // When the page names its variants, their prices are the truer range —
  // the display price is often just the default option's.
  const variantAmounts = blobVariants
    .map((v) => v.priceMajor)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  const priceMin = variantAmounts[0] ?? amounts[0];
  const priceMax =
    variantAmounts[variantAmounts.length - 1] ?? amounts[amounts.length - 1];
  const variants: ScrapedVariant[] =
    blobVariants.length > 0
      ? blobVariants
      : amounts.length > 1
        ? [
            { label: "from", priceMajor: amounts[0]! },
            { label: "to", priceMajor: amounts[amounts.length - 1]! },
          ]
        : [{ priceMajor: amounts[0]! }];

  const outOfStock =
    /outofstock/i.test(itempropValue(html, "availability") ?? "") ||
    /out of stock|sold out/i.test(html);

  const { srcs, alts } = collectImages(html, pageUrl);
  const specs = extractSpecs(html);
  const description =
    itempropValue(html, "description") ??
    metaContent(html, ["og:description"]) ??
    firstTagText(html, /<p\b[^>]*>([\s\S]*?)<\/p>/i);

  return {
    externalId: String(externalId),
    url: pageUrl,
    sourceKey: ctx.sourceKey,
    vertical: ctx.vertical,
    // Structured declaration first, symbol inference second, INR last —
    // documented fallback, not silent (gate B5).
    currency: declaredCurrency(html) ?? "INR",
    title,
    slug: urlSlug || slugify(title),
    // The price block's own words ("₹2,400 – ₹4,800 per sq ft", "Price on
    // request") — persistence reads title + shortTagline + description when
    // it derives each variant's price basis, so this is where PER_AREA /
    // QUOTE_ONLY become visible to it (gates B2/B3).
    shortTagline: priceContextText(html) || undefined,
    description: stripHtml(description).slice(0, DESCRIPTION_MAX) || undefined,
    priceMin,
    priceMax,
    showPrice: true,
    dimensions: specs.dimensions,
    materials: specs.materials,
    status: outOfStock ? "out_of_stock" : "active",
    images: srcs,
    imageAlts: alts,
    variants,
    fields: {
      sku: itempropValue(html, "sku"),
      brand: itempropValue(html, "brand"),
      specs,
      markup: "priced-store",
    },
  };
}
