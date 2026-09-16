import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCT_SIZE_TIERS } from "@/lib/product-size-tier";
import {
  LARGE_MIN_CM,
  parseMaxDimensionCm,
  scoreSizeTiers,
  SMALL_MAX_CM,
  suggestSizeTier,
} from "@/lib/scraper/size-tier-suggest";

/**
 * Workstream E step 6: the size-tier SUGGESTION for scraped listings. Pure,
 * read-time, never stored, always overridable — so what these tests pin is
 * the vocabulary (the brief's own examples), the two honesty rules (nothing
 * scores → null; a tie → null, the operator decides) and the consumption
 * rule that keeps the weights honest.
 */
const SOURCE = readFileSync(
  path.join(__dirname, "size-tier-suggest.ts"),
  "utf8",
);

describe("the keyword table is not a hand-written copy of the tier list", () => {
  it("scores exactly the tiers the vocabulary declares", () => {
    expect(Object.keys(scoreSizeTiers({ title: "" })).sort()).toEqual(
      [...PRODUCT_SIZE_TIERS].sort(),
    );
  });

  it("puts every keyword in exactly one tier — a shared keyword is a tie by construction", () => {
    // KEYWORDS is module-private on purpose (category-map.test.ts reads its
    // table the same way): nothing outside the module should key off it.
    const table = /const KEYWORDS[\s\S]*?\n\};/.exec(SOURCE);
    if (!table) throw new Error("KEYWORDS table not found");
    const keywords = [...table[0].matchAll(/\["([^"]+)",\s*[123]\]/g)].map(
      (m) => m[1],
    );
    expect(keywords.length).toBeGreaterThan(60);
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it("never reads the source's tier — a large-format studio sells coasters too", () => {
    // docs/plan/07 §"Scraper": ScrapeSource.tier is which supplier list we
    // went looking in, and it must not decide a product's tier.
    // Code only — the module's own comments are allowed to NAME the rule.
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /\/\/.*$/gm,
      "",
    );
    expect(code).not.toMatch(/ScrapeTier/);
    expect(code).not.toMatch(/sourceTier/);
  });
});

describe("suggestSizeTier — the brief's own examples, title only", () => {
  it.each([
    ["Dining Table", "LARGE_FORMAT"],
    ["Coffee Table", "LARGE_FORMAT"],
    ["Chair", "LARGE_FORMAT"],
    ["Console", "LARGE_FORMAT"],
    ["Large Wall Installation", "LARGE_FORMAT"],
    ["Varmala Preservation", "MEDIUM_FORMAT"],
    ["Wall Clock", "MEDIUM_FORMAT"],
    ["Engagement Tray", "MEDIUM_FORMAT"],
    ["Wedding Frame", "MEDIUM_FORMAT"],
    ["Invitation Preservation", "MEDIUM_FORMAT"],
    ["Rakhi", "SMALL_FORMAT"],
    ["Jewellery", "SMALL_FORMAT"],
    ["Keychain", "SMALL_FORMAT"],
    ["Bookmark", "SMALL_FORMAT"],
    ["Magnet", "SMALL_FORMAT"],
    ["Coaster", "SMALL_FORMAT"],
  ] as const)("%s → %s", (title, tier) => {
    expect(suggestSizeTier({ title })).toBe(tier);
  });
});

describe("the null rule", () => {
  it("returns null when nothing scores", () => {
    expect(suggestSizeTier({ title: "" })).toBeNull();
    expect(suggestSizeTier({ title: "Ocean wave epoxy art" })).toBeNull();
  });

  it("returns null on a tie — the operator decides, not a coin flip", () => {
    // wedding (MEDIUM 3 × 2) against ring (SMALL 3 × 2).
    expect(suggestSizeTier({ title: "Wedding Ring" })).toBeNull();
    // photo frame (MEDIUM 3 × 2) against keychain (SMALL 3 × 2).
    expect(suggestSizeTier({ title: "Photo frame keychain" })).toBeNull();
  });

  it("matches whole words only, so 'string' is not a ring", () => {
    expect(suggestSizeTier({ title: "String art" })).toBeNull();
  });
});

describe("weights and consumption", () => {
  it("lets a decisive word outrank a supporting one", () => {
    // table (LARGE 1 × 2) against clock (MEDIUM 3 × 2).
    expect(suggestSizeTier({ title: "Table clock" })).toBe("MEDIUM_FORMAT");
  });

  it("consumes a phrase so the words inside it never score again", () => {
    // "ring tray" is one MEDIUM hit; "ring" must not also score SMALL.
    expect(suggestSizeTier({ title: "Engagement Ring Tray" })).toBe(
      "MEDIUM_FORMAT",
    );
    expect(scoreSizeTiers({ title: "Engagement Ring Tray" }).SMALL_FORMAT).toBe(
      0,
    );
  });

  it("takes plurals as the word itself", () => {
    expect(suggestSizeTier({ title: "Coasters set of 4" })).toBe(
      "SMALL_FORMAT",
    );
    expect(suggestSizeTier({ title: "Resin earrings" })).toBe("SMALL_FORMAT");
  });

  it("lets the source category suggest on its own", () => {
    expect(
      suggestSizeTier({ title: "Ocean wave", category: "Wall Clocks" }),
    ).toBe("MEDIUM_FORMAT");
  });

  it("does not count a product type that merely repeats the category", () => {
    const once = scoreSizeTiers({
      title: "Ocean wave",
      category: "Wall Clocks",
    });
    const twice = scoreSizeTiers({
      title: "Ocean wave",
      category: "Wall Clocks",
      productType: "wall clocks",
    });
    expect(twice).toEqual(once);
  });

  it("lets the description contribute without outranking a title form-factor word", () => {
    expect(
      suggestSizeTier({
        title: "Resin keychain",
        description: "a keepsake for your dining table",
      }),
    ).toBe("SMALL_FORMAT");
  });
});

describe("parseMaxDimensionCm", () => {
  it("is null with nothing to read, or nothing with a unit", () => {
    expect(parseMaxDimensionCm(null)).toBeNull();
    expect(parseMaxDimensionCm("")).toBeNull();
    expect(parseMaxDimensionCm("set of 6")).toBeNull();
    expect(parseMaxDimensionCm("24 x 36")).toBeNull();
  });

  it("gives every number in a chain the unit the last one carries", () => {
    expect(parseMaxDimensionCm("10 x 12 inches")).toBe(30.48);
    expect(parseMaxDimensionCm("48 x 24 in", { bareInches: true })).toBe(
      121.92,
    );
    expect(parseMaxDimensionCm("5 cm x 3 cm")).toBe(5);
  });

  it("reads feet, millimetres and the inch mark", () => {
    expect(parseMaxDimensionCm("2 ft")).toBe(60.96);
    expect(parseMaxDimensionCm("150mm")).toBe(15);
    expect(parseMaxDimensionCm('12"')).toBe(30.48);
  });

  it("picks the largest side across chains", () => {
    expect(parseMaxDimensionCm("top 40 cm, base 12 x 55 cm")).toBe(55);
  });

  it("treats a bare 'in' as the preposition unless told otherwise", () => {
    expect(parseMaxDimensionCm("2 in gift box")).toBeNull();
    expect(parseMaxDimensionCm("2 in gift box", { bareInches: true })).toBe(
      5.08,
    );
  });
});

describe("the dimension push", () => {
  it("suggests from dimensions alone", () => {
    expect(
      suggestSizeTier({
        title: "Custom resin piece",
        dimensions: "90 x 40 cm",
      }),
    ).toBe("LARGE_FORMAT");
    expect(
      suggestSizeTier({ title: "Custom resin piece", dimensions: "8 x 5 cm" }),
    ).toBe("SMALL_FORMAT");
  });

  it("leans MEDIUM in the middle band, where clocks, trays and frames live", () => {
    expect(
      suggestSizeTier({ title: "Ocean piece", dimensions: "12 inch" }),
    ).toBe("MEDIUM_FORMAT");
  });

  it("is outranked by a decisive keyword", () => {
    expect(suggestSizeTier({ title: "Side table", dimensions: "45 cm" })).toBe(
      "LARGE_FORMAT",
    );
  });

  it("never parses the description for a size", () => {
    expect(
      suggestSizeTier({
        title: "Keychain",
        description: "ships in a 90 cm box within 30 days",
      }),
    ).toBe("SMALL_FORMAT");
  });

  it("declares its thresholds", () => {
    expect(LARGE_MIN_CM).toBeGreaterThan(SMALL_MAX_CM);
  });
});
