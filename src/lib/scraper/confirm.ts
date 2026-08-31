/**
 * Confirmation — the gate between "in the studio" and "on the final list".
 *
 * The invariant the whole feature exists to protect:
 *
 *     CONFIRMED_PRODUCTS  ≡  { p : p.confirmedAt !== null }
 *
 * Not every scraped product. Not every studio product. Not everything that
 * happens to be sitting in the Google Sheet. Only rows an operator explicitly
 * blessed. There is deliberately no code path from scrape to confirmed.
 *
 * Pure module: the checks below decide, and they are the interesting part, so
 * they live where a test can reach them without a database.
 */

/** The tab the confirmed list is written to. Its own tab, on purpose. */
export const CONFIRMED_SHEET_TAB = "CONFIRMED_PRODUCTS";

/** Product ID first: it is the stable reference in every other tab. */
export const CONFIRMED_COLUMNS: readonly string[] = [
  "Product ID",
  "Slug",
  "Title",
  "Category",
  "Price Min",
  "Price Max",
  "Currency",
  "Primary Image",
  "Status",
  "Confirmed At",
  "Confirmed By",
];

/** The shape confirmation needs to judge — not the whole Product row. */
export type ConfirmCandidate = {
  title: string;
  description: string;
  showPrice: boolean;
  priceMin: number | null;
  needsRewrite: boolean;
  imageCount: number;
};

/**
 * What stops this product being confirmed, in the owner's words.
 *
 * Returns an empty array when it is ready. Each entry names a FIELD, because
 * "cannot confirm" without saying what is missing is a dead end — the operator
 * is left clicking around looking for the problem.
 */
export function describeConfirmBlockers(p: ConfirmCandidate): string[] {
  const blockers: string[] = [];
  if (!p.title.trim()) blockers.push("a title");
  if (p.imageCount === 0) blockers.push("at least one image");
  if (!p.description.trim()) blockers.push("a description");
  // The repo blocks publishing while needsRewrite; confirming a row whose copy
  // is still the scraped original would put competitor prose on the final list.
  if (p.needsRewrite) blockers.push("an editorial rewrite (still flagged)");
  // Only when the product actually shows a price. A "price on request" piece
  // is complete without one.
  if (p.showPrice && p.priceMin === null) blockers.push("a price");
  return blockers;
}

/** Convenience for call sites that only need the yes/no. */
export function canConfirm(p: ConfirmCandidate): boolean {
  return describeConfirmBlockers(p).length === 0;
}

/**
 * One sentence naming everything missing, for a refusal the operator can act
 * on. `null` when there is nothing to say.
 */
export function describeConfirmRefusal(
  title: string,
  blockers: string[],
): string | null {
  if (blockers.length === 0) return null;
  const list =
    blockers.length === 1
      ? blockers[0]
      : `${blockers.slice(0, -1).join(", ")} and ${blockers[blockers.length - 1]}`;
  return `"${title}" needs ${list} before it can be confirmed.`;
}
