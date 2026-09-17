import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  IMPORT_LISTS,
  IMPORT_LIST_FILE,
  IMPORT_LIST_NAME,
  IMPORT_LIST_SHORT,
  importListLabel,
  importListOf,
} from "./import-list";
import { PRODUCT_LIMITS } from "./studio-limits";

describe("import lists — the provenance vocabulary", () => {
  it("covers exactly the Product.tier range the form and the importer accept", () => {
    const range = [];
    for (let n = PRODUCT_LIMITS.tierMin; n <= PRODUCT_LIMITS.tierMax; n++) {
      range.push(n);
    }
    expect([...IMPORT_LISTS]).toEqual(range);
    expect(Object.keys(IMPORT_LIST_NAME).map(Number).sort()).toEqual(range);
    expect(Object.keys(IMPORT_LIST_SHORT).map(Number).sort()).toEqual(range);
    expect(Object.keys(IMPORT_LIST_FILE).map(Number).sort()).toEqual(range);
  });

  it("never calls a list a tier — that word is the product tier's now", () => {
    for (const list of IMPORT_LISTS) {
      expect(importListLabel(list)).toMatch(/^List \d — /);
      expect(importListLabel(list)).not.toMatch(/tier/i);
      expect(IMPORT_LIST_NAME[list]).not.toMatch(/tier/i);
      expect(IMPORT_LIST_SHORT[list]).not.toMatch(/tier/i);
    }
  });

  it("names and short forms are distinct, and the short form fits a cell", () => {
    expect(new Set(Object.values(IMPORT_LIST_NAME)).size).toBe(IMPORT_LISTS.length);
    expect(new Set(Object.values(IMPORT_LIST_SHORT)).size).toBe(IMPORT_LISTS.length);
    for (const short of Object.values(IMPORT_LIST_SHORT)) {
      expect(short.split(" ").length).toBeLessThanOrEqual(2);
    }
  });

  it("file stems are the ones tier-fill.ts actually reads, list by list", () => {
    // The reader keeps its table private; pin against the source text the
    // way catalog-taxonomy.test.ts already does, so a renamed stem on either
    // side fails here rather than in a deploy that imports nothing.
    const source = readFileSync(
      new URL("./import/tier-fill.ts", import.meta.url),
      "utf8",
    );
    for (const list of IMPORT_LISTS) {
      expect(source).toContain(
        `{ tab: "${IMPORT_LIST_FILE[list]}", tier: ${list},`,
      );
    }
  });

  it("maps a column value to its list and everything else to null", () => {
    expect(importListOf(1)).toBe(1);
    expect(importListOf(4)).toBe(4);
    expect(importListOf(0)).toBeNull();
    expect(importListOf(5)).toBeNull();
    expect(importListOf(null)).toBeNull();
    expect(importListOf(undefined)).toBeNull();
  });
});
