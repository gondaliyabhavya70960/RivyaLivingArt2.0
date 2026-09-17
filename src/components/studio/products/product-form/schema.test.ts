import { describe, expect, it } from "vitest";

import { IMPORT_LISTS, importListLabel } from "@/lib/import-list";
import { PRODUCT_LIMITS } from "@/lib/studio-limits";
import {
  TIER_LABEL,
  TIER_OPTIONS,
  buildDefaultValues,
  formSchema,
} from "./schema";

/**
 * The product form's `tier` select is `Product.tier` — the IMPORT LIST a row
 * came from — and it sits one section below a select for the PRODUCT tier.
 * Until 2026-09-17 both read "Tier 1 …", from two hand-typed label tables.
 * These tests pin that the import-list words now come from ONE module and
 * that the word "tier" never appears on that select again; the numeric
 * values and the exported names are the form contract and are pinned too.
 */
describe("the product form's import-list select", () => {
  it("offers the null sentinel and then every import list, in order", () => {
    expect(TIER_OPTIONS.map((o) => o.value)).toEqual([
      "none",
      ...IMPORT_LISTS.map(String),
    ]);
  });

  it("labels each list with importListLabel, never a hand-typed copy", () => {
    for (const list of IMPORT_LISTS) {
      const option = TIER_OPTIONS.find((o) => o.value === String(list));
      expect(option?.label).toBe(importListLabel(list));
      expect(TIER_LABEL[list]).toBe(importListLabel(list));
    }
  });

  it('never says "tier" on the import-list select — that word is the product tier\'s', () => {
    for (const option of TIER_OPTIONS) {
      expect(option.label).not.toMatch(/tier/i);
    }
    for (const label of Object.values(TIER_LABEL)) {
      expect(label).not.toMatch(/tier/i);
    }
  });

  it("covers exactly the Product.tier range the action accepts", () => {
    const numbered = TIER_OPTIONS.filter((o) => o.value !== "none").map((o) =>
      Number(o.value),
    );
    expect(Math.min(...numbered)).toBe(PRODUCT_LIMITS.tierMin);
    expect(Math.max(...numbered)).toBe(PRODUCT_LIMITS.tierMax);
    expect(Object.keys(TIER_LABEL).map(Number).sort()).toEqual(numbered);
  });

  it("keeps the form contract: every option value is accepted by the zod enum", () => {
    const base = buildDefaultValues();
    for (const option of TIER_OPTIONS) {
      const result = formSchema.safeParse({
        ...base,
        title: "A piece",
        categoryId: "cat",
        tier: option.value,
      });
      expect(result.success, `tier=${option.value}`).toBe(true);
    }
  });
});
