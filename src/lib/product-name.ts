/**
 * Editorial product naming (external audit N-01). Scraped/imported titles are
 * marketplace-length ("Lord Khatu Shyam Ji Spiritual Puja Vastu Figurine –
 * Resin LED Light …"); a luxury card wants the short editorial name. The
 * owner-set `displayName` always wins; otherwise the name is DERIVED from the
 * owned title — cut at the first qualifier separator, never invented — so the
 * storefront improves immediately while every derivation stays reviewable
 * (the owner can override any product in the studio). Full titles remain
 * canonical for SEO metadata, JSON-LD and the frozen WhatsApp message.
 */

/** Qualifier separators, most explicit first. A separator only cuts when it
 *  appears past index 8 so names that OPEN with a dash segment survive. */
const SEPARATORS = [" – ", " — ", " | ", " (", " - "] as const;

const MAX_LENGTH = 60;

export function editorialName(
  displayName: string | null | undefined,
  title: string,
): string {
  const owned = displayName?.trim();
  if (owned) return owned;

  let name = title.trim();
  let cutAt = name.length;
  for (const separator of SEPARATORS) {
    const index = name.indexOf(separator);
    if (index > 8 && index < cutAt) cutAt = index;
  }
  name = name.slice(0, cutAt).trim();

  if (name.length > MAX_LENGTH) {
    const wordBreak = name.lastIndexOf(" ", MAX_LENGTH - 1);
    name = `${name.slice(0, wordBreak > 24 ? wordBreak : MAX_LENGTH - 1).trimEnd()}…`;
  }
  // A cut can strand list punctuation at the end ("Frame,").
  return name.replace(/[,;:·]+$/, "");
}
