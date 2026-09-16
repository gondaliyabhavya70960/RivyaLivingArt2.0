/**
 * Quote-studio page mapper (B5) — the QUOTE_STUDIO markup shape: a bespoke
 * atelier's piece page that publishes no price at all, only an enquiry or
 * commission CTA ("price on request", "request a quote"). This is the
 * catalog style the phase-6b schema exists to survive: the mapper emits
 * exactly ONE variant with `priceMajor: null`, which downstream
 * (`derivePriceBasis` → `priceForBasis`) turns into a QUOTE_ONLY row with a
 * NULL price — never a zero, never a made-up number (gates B1/B2).
 *
 * Pure: HTML string in, RichProduct out, no network.
 */
import type { AdapterContext, RichProduct } from "@/lib/scraper/types";
import { slugify } from "@/lib/slug";
import { stripHtml } from "@/lib/scraper/adapters/strip-html";
import {
  collectImages,
  decodeEntities,
  extractSpecs,
  firstTagText,
  looksLikeListing,
  metaContent,
  pathnameSlug,
  publishedPrices,
} from "@/lib/scraper/adapters/markup";
import { QUOTE_ONLY_PHRASES } from "@/lib/scraper/price-basis";

const DESCRIPTION_MAX = 2000;

/** The quote/enquiry phrase the page used, kept verbatim for provenance. */
export function quotePhraseIn(html: string): string | null {
  const text = stripHtml(decodeEntities(html));
  const hit = QUOTE_ONLY_PHRASES.map((re) => re.exec(text)?.[0]).find(
    (m): m is string => typeof m === "string" && m.length > 0,
  );
  return hit ?? null;
}

/**
 * Map one bespoke-studio piece page. Returns null when:
 *  - the page has no title,
 *  - no quote/enquiry phrase is present (a page with no price AND no quote
 *    language is not evidence of anything), or
 *  - a price IS published (that is the PRICED_STORE shape; routing it here
 *    would turn a real price into quote-only — the inverse lie).
 */
export function mapQuoteStudioPage(
  html: string,
  pageUrl: string,
  ctx: Pick<AdapterContext, "sourceKey" | "vertical">,
): RichProduct | null {
  if (looksLikeListing(html)) return null; // gate D3, held at mapper level too
  if (publishedPrices(html).length > 0) return null;

  const title =
    firstTagText(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ??
    metaContent(html, ["og:title"]);
  if (!title) return null;

  const phrase = quotePhraseIn(html);
  if (!phrase) return null;

  const urlSlug = pathnameSlug(pageUrl);
  const externalId = urlSlug || slugify(title);
  if (!externalId) return null;

  const { srcs, alts } = collectImages(html, pageUrl);
  const specs = extractSpecs(html);
  const description =
    metaContent(html, ["og:description"]) ??
    firstTagText(html, /<p\b[^>]*>([\s\S]*?)<\/p>/i);

  return {
    externalId,
    url: pageUrl,
    sourceKey: ctx.sourceKey,
    vertical: ctx.vertical,
    // No price, so no declared currency; the INR default is documented in
    // the priced-store mapper and the checklist (gate B5).
    currency: "INR",
    title,
    slug: externalId,
    // The phrase itself, verbatim — persistence reads title + shortTagline +
    // description for basis derivation, so the quote language survives into
    // the staged record exactly as the studio wrote it (gate B2).
    shortTagline: phrase,
    description: stripHtml(description).slice(0, DESCRIPTION_MAX) || undefined,
    // showPrice is the honest flag for this shape: there IS no price to
    // show, and staging should not pretend otherwise.
    showPrice: false,
    timeline: specs.leadTime,
    dimensions: specs.dimensions,
    materials: specs.materials,
    // The load-bearing row: one variant, NULL price. quote-only is not free.
    variants: [{ priceMajor: null }],
    status: "active",
    images: srcs,
    imageAlts: alts,
    fields: {
      specs,
      enquiryPhrase: phrase,
      markup: "quote-studio",
    },
  };
}
