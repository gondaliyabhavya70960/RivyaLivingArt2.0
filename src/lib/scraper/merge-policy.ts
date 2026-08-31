/**
 * Who owns a field once a human has touched it.
 *
 * The pipeline has two writers that can land on the same catalog row: the
 * deploy-time sheet importer and the scraper's review-and-promote path. Both
 * can legitimately update a product. Neither may quietly undo an owner's work.
 *
 * The rule the sheet importer has always followed (H5) is written down here so
 * the scraper path can follow the same one, rather than each remembering it
 * separately — which is how they came to disagree:
 *
 *     owner has edited this row  →  refresh availability, nothing else
 *     otherwise                  →  refresh everything
 *
 * "Nothing else" specifically includes IMAGES. The scraper's update deletes a
 * product's gallery and recreates it from the source, so a rule that protected
 * the copy but not the pictures would still lose the owner's work — and lose
 * it in the least recoverable way, since the replaced files may be gone.
 */

export type MergeTarget = {
  /** Set by every studio save. */
  ownerTouched: boolean;
  /** Scraped copy not yet rewritten by a human. */
  needsRewrite: boolean;
};

export type MergeAction =
  /** No catalog row yet — write the whole thing. */
  | "create"
  /** Owner has edited it: availability may refresh, content may not. */
  | "refresh-availability"
  /** Untouched scraped row: safe to refresh in full. */
  | "overwrite"
  /** Already rewritten and left alone — nothing to do. */
  | "skip";

export function decideMerge(existing: MergeTarget | null): MergeAction {
  if (!existing) return "create";
  // Owner edits win over both other conditions. Checked FIRST, because a row
  // can be owner-touched AND still flagged needsRewrite: saving in the studio
  // only clears that flag when the operator ticks "confirm rewrite", and most
  // edits are not rewrites. That combination is exactly the case the scraper
  // path used to overwrite.
  if (existing.ownerTouched) return "refresh-availability";
  if (!existing.needsRewrite) return "skip";
  return "overwrite";
}

/** What to tell the operator about a row the merge protected. */
export function describeProtected(count: number): string | null {
  if (count === 0) return null;
  return `${count} product${count === 1 ? "" : "s"} left as you edited ${count === 1 ? "it" : "them"} — the scrape refreshed availability only.`;
}
