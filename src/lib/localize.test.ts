import { describe, expect, it } from "vitest";

import {
  lexicalRows,
  localize,
  localizeLexical,
  normalizeTranslations,
} from "@/lib/localize";

const row = {
  title: "Star Shape small",
  description: "Base English description",
  translations: {
    hi: { title: "स्टार शेप", description: "" },
    ar: { title: 12345 },
  },
};

describe("localize", () => {
  it("is a no-op reference for the default locale", () => {
    expect(localize(row, "en", ["title"])).toBe(row);
  });

  it("overrides fields from the locale's entry", () => {
    expect(localize(row, "hi", ["title"]).title).toBe("स्टार शेप");
  });

  it("falls back to base for empty translated strings", () => {
    expect(localize(row, "hi", ["title", "description"]).description).toBe(
      "Base English description",
    );
  });

  it("rejects shape-changing translations (number over string)", () => {
    expect(localize(row, "ar", ["title"]).title).toBe("Star Shape small");
  });

  it("returns the same reference when a locale has no entry", () => {
    expect(localize(row, "fr", ["title"])).toBe(row);
  });

  it("never mutates the input row", () => {
    localize(row, "hi", ["title"]);
    expect(row.title).toBe("Star Shape small");
  });
});


/* ————————————————— lexical voice lines ————————————————— */

const LEXICAL = [
  { label: "Suited to", value: "A quiet hallway" },
  { label: "Feels like", value: "Cold glass" },
  { label: "Pour story", value: "Two layers, a week apart" },
];

describe("lexicalRows", () => {
  it("keeps only rows with both halves written", () => {
    expect(
      lexicalRows([
        { label: "Suited to", value: "A hallway" },
        { label: "  ", value: "orphaned" },
        { label: "No value", value: "   " },
        { label: 7, value: "wrong type" },
        null,
        "not a row",
      ]),
    ).toEqual([{ label: "Suited to", value: "A hallway" }]);
  });

  it("is total for anything that is not an array", () => {
    for (const bad of [null, undefined, {}, "rows", 3]) {
      expect(lexicalRows(bad)).toEqual([]);
    }
  });
});

describe("localizeLexical", () => {
  const product = {
    lexical: LEXICAL,
    translations: {
      hi: {
        lexical: [
          { label: "इनके लिए", value: "एक शांत गलियारा" },
          null,
          { label: "", value: "दो परतें" },
        ],
      },
      ar: { lexical: "not an array" },
    },
  };

  it("returns the base for the default locale", () => {
    expect(localizeLexical(product, "en")).toEqual(LEXICAL);
  });

  it("translates row by row and field by field", () => {
    expect(localizeLexical(product, "hi")).toEqual([
      { label: "इनके लिए", value: "एक शांत गलियारा" },
      // Untranslated row — English, still in position 2.
      { label: "Feels like", value: "Cold glass" },
      // Value translated, label left blank: the English label stands.
      { label: "Pour story", value: "दो परतें" },
    ]);
  });

  it("never drops a row a partial translation did not reach", () => {
    expect(localizeLexical(product, "hi")).toHaveLength(LEXICAL.length);
  });

  it("ignores an overlay that is not an array", () => {
    expect(localizeLexical(product, "ar")).toEqual(LEXICAL);
  });

  it("ignores overlay rows with no English row to translate", () => {
    const extra = {
      lexical: [{ label: "Only", value: "One" }],
      translations: { hi: { lexical: [null, { label: "Ghost", value: "Row" }] } },
    };
    expect(localizeLexical(extra, "hi")).toEqual([
      { label: "Only", value: "One" },
    ]);
  });
});

describe("normalizeTranslations with positional rows", () => {
  it("keeps a blank row's slot so later rows stay pinned", () => {
    const out = normalizeTranslations(
      {
        hi: {
          lexical: [
            { label: "", value: "" },
            { label: "दूसरा", value: "पंक्ति" },
          ],
        },
      },
      ["lexical"],
    );
    expect(out?.hi.lexical).toEqual([
      null,
      { label: "दूसरा", value: "पंक्ति" },
    ]);
  });

  it("drops trailing blanks rather than storing an array of nulls", () => {
    const out = normalizeTranslations(
      { hi: { lexical: [{ label: "क", value: "ख" }, null, null] } },
      ["lexical"],
    );
    expect(out?.hi.lexical).toEqual([{ label: "क", value: "ख" }]);
  });

  it("stores nothing for a language touched but left empty", () => {
    expect(
      normalizeTranslations({ hi: { lexical: [null, null] } }, ["lexical"]),
    ).toBeNull();
  });
});
