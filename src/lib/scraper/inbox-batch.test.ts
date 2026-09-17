import { describe, expect, it } from "vitest";

import {
  IMPORT_BATCH_MIRRORED,
  IMPORT_BATCH_PLAIN,
  MOVE_BATCH,
  chunk,
  importBatchSize,
} from "./inbox-batch";

describe("inbox batches", () => {
  it("splits into consecutive slices and keeps the remainder", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it("refuses a size that would never advance", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
  });

  it("mirrored imports run in smaller batches than plain ones", () => {
    expect(importBatchSize(true)).toBe(IMPORT_BATCH_MIRRORED);
    expect(importBatchSize(false)).toBe(IMPORT_BATCH_PLAIN);
    expect(IMPORT_BATCH_MIRRORED).toBeLessThan(IMPORT_BATCH_PLAIN);
  });

  it("a move batch never exceeds what setShortlistState accepts", () => {
    // transitionSchema in actions/scraper-shortlist.ts caps a call at 500.
    expect(MOVE_BATCH).toBeLessThanOrEqual(500);
  });
});
