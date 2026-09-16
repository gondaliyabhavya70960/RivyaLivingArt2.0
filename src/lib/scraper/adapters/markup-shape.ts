/**
 * Markup-shape detection (B5) — the switch that keys extraction on what a
 * page's markup LOOKS like rather than which platform built it.
 *
 * A page reaching here has already failed JSON-LD extraction (no schema.org
 * Product node). Three outcomes:
 *
 *   PRICED_STORE  structural evidence of ONE product + a declared price
 *   QUOTE_STUDIO  no price + a quote/enquiry CTA + piece-page structure
 *   NONE          anything else — a blog post, a listing, an about page
 *
 * Strictness is the whole design (checklist section D): a false positive
 * stages an invented product into the research corpus, while a false
 * negative costs one skipped page. Price text ALONE never promotes a page —
 * a category grid is full of it — and a page carrying several product
 * identities is a listing, whatever its cards claim (gate D3).
 */
import type { AdapterContext, RichProduct } from "@/lib/scraper/types";
import { mapPricedStorePage } from "@/lib/scraper/adapters/priced-store";
import {
  mapQuoteStudioPage,
  quotePhraseIn,
} from "@/lib/scraper/adapters/quote-studio";
import {
  extractSpecs,
  looksLikeListing,
  metaContent,
  publishedPrices,
} from "@/lib/scraper/adapters/markup";

export type MarkupShape = "PRICED_STORE" | "QUOTE_STUDIO" | "NONE";

/** Structural evidence the page represents ONE purchasable/commissionable
 *  product — product-typed meta or microdata, product id/variant attributes. */
function hasProductMarkup(html: string): boolean {
  const ogType = metaContent(html, ["og:type"]);
  if (ogType && /^product/i.test(ogType)) return true;
  return (
    /itemtype=["'][^"']*schema\.org\/Product/i.test(html) ||
    /itemprop=["']price["']/i.test(html) ||
    /\bdata-product_(id|variants)\s*=/i.test(html) ||
    metaContent(html, ["product:price:amount", "product:retailer_item_id"]) !==
      null
  );
}

export function detectMarkupShape(html: string): MarkupShape {
  if (!html || looksLikeListing(html)) return "NONE";

  const productish = hasProductMarkup(html);
  const priced = publishedPrices(html).length > 0;

  if (priced && productish) return "PRICED_STORE";

  if (!priced && productish && quotePhraseIn(html)) return "QUOTE_STUDIO";

  // A page without product-typed markup can still be a bespoke piece page —
  // but only when it argues its case twice over: a quote CTA AND the
  // structure of a piece (a spec list with two or more known labels). A
  // contact page says "request a quote" too; it has no Dimensions row.
  if (!priced && !productish && quotePhraseIn(html)) {
    const specCount = Object.keys(extractSpecs(html)).length;
    if (specCount >= 2) return "QUOTE_STUDIO";
  }

  return "NONE";
}

/**
 * Dispatch one page by its shape. Returns null for NONE — the page is not a
 * product and staging hears nothing about it.
 */
export function mapPageByShape(
  html: string,
  pageUrl: string,
  ctx: Pick<AdapterContext, "sourceKey" | "vertical">,
): RichProduct | null {
  switch (detectMarkupShape(html)) {
    case "PRICED_STORE":
      return mapPricedStorePage(html, pageUrl, ctx);
    case "QUOTE_STUDIO":
      return mapQuoteStudioPage(html, pageUrl, ctx);
    case "NONE":
      return null;
  }
}
