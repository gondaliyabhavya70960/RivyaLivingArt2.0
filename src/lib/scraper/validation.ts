/**
 * What a scrape failed to extract.
 *
 * The fields checked here are deliberately the same ones that block a product
 * from being confirmed (`describeConfirmBlockers`). That is the point: a
 * validation failure is the early, per-source view of the thing that will
 * later stop the product reaching the final list. An operator fixing the
 * backlog here is unblocking confirmations there, and the two screens agree
 * about what "incomplete" means because they ask the same question.
 *
 * What is NOT checked matters as much. A missing `shortTagline`, `timeline` or
 * `dimensions` is normal — most storefronts do not publish them, and flagging
 * every one would bury the failures that matter under tens of thousands that
 * do not. A gate that cries wolf stops being read.
 */

export type ExtractedProduct = {
  title: string;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  images: unknown;
  category: string | null;
};

export type FieldFailure = {
  field: string;
  reason: string;
  severity: "ERROR" | "WARNING";
};

/** The fields this module can report on — the triage screen's grouping. */
export const CHECKED_FIELDS = [
  "title",
  "price",
  "images",
  "description",
  "category",
] as const;

function imageCount(images: unknown): number {
  return Array.isArray(images) ? images.length : 0;
}

/**
 * Everything this scrape could not extract, or an empty array.
 *
 * Severity separates "this product is unusable" from "this product is thin".
 * A row with no title cannot be shown at all; a row with no category needs a
 * decision before import but is otherwise fine.
 */
export function describeFieldFailures(p: ExtractedProduct): FieldFailure[] {
  const failures: FieldFailure[] = [];

  if (!p.title.trim()) {
    failures.push({
      field: "title",
      reason: "No title found on the page.",
      severity: "ERROR",
    });
  }
  if (p.priceMin === null && p.priceMax === null) {
    failures.push({
      field: "price",
      reason: "No price could be parsed — the page may show it only after a variant is chosen.",
      severity: "WARNING",
    });
  }
  if (imageCount(p.images) === 0) {
    failures.push({
      field: "images",
      reason: "No product images found.",
      severity: "ERROR",
    });
  }
  if (!p.description?.trim()) {
    failures.push({
      field: "description",
      reason: "No description found.",
      severity: "WARNING",
    });
  }
  if (!p.category?.trim()) {
    failures.push({
      field: "category",
      reason: "The source page carried no category — one must be chosen on import.",
      severity: "WARNING",
    });
  }

  return failures;
}

/** Fields that came out clean, so their old failures can be closed. */
export function resolvedFields(p: ExtractedProduct): string[] {
  const failed = new Set(describeFieldFailures(p).map((f) => f.field));
  return CHECKED_FIELDS.filter((field) => !failed.has(field));
}
