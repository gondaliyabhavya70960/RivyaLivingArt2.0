/**
 * How the inbox's "select all matching" turns one decision into many calls.
 *
 * The writes stay the existing, audited ones — `setShortlistState` for a
 * funnel move, `addScrapedToCatalog` for the import — and the client feeds
 * them in batches. Two limits shape the batches, and both are facts about
 * the callee rather than taste:
 *
 * - `setShortlistState` refuses more than 500 ids per call (its schema).
 * - `addScrapedToCatalog` mirrors up to six images per row INSIDE the call
 *   when mirroring is on, each fetch with a 12 s timeout, so a mirrored
 *   batch has to stay small enough to finish inside the page's function
 *   budget. A plain import is a handful of database writes per row.
 *
 * Pure module: importable from the client component and the unit test.
 */

/** Rows per `addScrapedToCatalog` call when images are mirrored. */
export const IMPORT_BATCH_MIRRORED = 10;
/** Rows per `addScrapedToCatalog` call when images stay on the source host. */
export const IMPORT_BATCH_PLAIN = 100;
/** Ids per `setShortlistState` call — its schema's ceiling. */
export const MOVE_BATCH = 500;

export function importBatchSize(mirrorImages: boolean): number {
  return mirrorImages ? IMPORT_BATCH_MIRRORED : IMPORT_BATCH_PLAIN;
}

/** Split `items` into consecutive slices of at most `size`; `[]` stays `[]`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
