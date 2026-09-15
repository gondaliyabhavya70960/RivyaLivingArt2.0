/**
 * The confirmed export's job is to be boring and exact. These tests pin the
 * two things that would be expensive to get wrong: a price that must not
 * become zero, and a column order somebody's spreadsheet formula depends on.
 */
import { describe, expect, it } from "vitest";

import { toCsvDocument, csvCell } from "@/lib/export/csv";
import {
  CONFIRMED_EXPORT_COLUMNS,
  type ConfirmedExportProduct,
  confirmedProductToRow,
  confirmedProductsToRows,
  priceBasisOf,
} from "@/lib/export/confirmed";

const AT = new Date("2026-09-15T10:30:00.000Z");

function product(
  over: Partial<ConfirmedExportProduct> = {},
): ConfirmedExportProduct {
  return {
    id: "prd_1",
    slug: "river-table",
    title: "Teak river table",
    category: { slug: "large-format" },
    status: "PUBLISHED",
    showPrice: true,
    priceMin: 85_000,
    priceMax: 120_000,
    inStock: true,
    timeline: "8–10 weeks",
    materials: "Teak, epoxy",
    dimensions: "2100 × 900 × 760 mm",
    importSource: null,
    importRef: null,
    sizeTier: "LARGE_FORMAT",
    tier: 1,
    needsRewrite: false,
    heroImageUrl: "/media/v3/hero.avif",
    imageCount: 4,
    confirmedAt: AT,
    confirmedById: "usr_7",
    createdAt: AT,
    updatedAt: AT,
    ...over,
  };
}

const col = (row: string[], key: (typeof CONFIRMED_EXPORT_COLUMNS)[number]) =>
  row[CONFIRMED_EXPORT_COLUMNS.indexOf(key)];

describe("priceBasisOf", () => {
  it("is PER_PIECE only when a price is both shown and present", () => {
    expect(priceBasisOf({ showPrice: true, priceMin: 500 })).toBe("PER_PIECE");
  });

  it("is QUOTE_ONLY when the product hides its price", () => {
    expect(priceBasisOf({ showPrice: false, priceMin: 500 })).toBe(
      "QUOTE_ONLY",
    );
  });

  it("is QUOTE_ONLY when a price is shown but missing (a row mid-edit)", () => {
    expect(priceBasisOf({ showPrice: true, priceMin: null })).toBe(
      "QUOTE_ONLY",
    );
  });

  it("treats a genuine zero price as a price, not as absence", () => {
    expect(priceBasisOf({ showPrice: true, priceMin: 0 })).toBe("PER_PIECE");
  });
});

describe("confirmedProductToRow", () => {
  it("never exports a quote-only price as 0 — the cells are EMPTY", () => {
    // The rule the whole export exists to protect. A zero here would be
    // averaged and charted as if the piece were free.
    const row = confirmedProductToRow(
      product({ showPrice: false, priceMin: 85_000, priceMax: 120_000 }),
    );
    expect(col(row, "price_basis")).toBe("QUOTE_ONLY");
    expect(col(row, "list_price")).toBe("");
    expect(col(row, "sale_price")).toBe("");
    expect(col(row, "list_price")).not.toBe("0");
  });

  it("exports a priced product's numbers", () => {
    const row = confirmedProductToRow(product());
    expect(col(row, "price_basis")).toBe("PER_PIECE");
    expect(col(row, "list_price")).toBe("85000");
    expect(col(row, "sale_price")).toBe("120000");
    expect(col(row, "currency")).toBe("INR");
  });

  it("emits one cell per column, in order", () => {
    const row = confirmedProductToRow(product());
    expect(row).toHaveLength(CONFIRMED_EXPORT_COLUMNS.length);
    expect(col(row, "internal_product_id")).toBe("prd_1");
    expect(col(row, "canonical_product_type")).toBe("large-format");
    expect(col(row, "image_count")).toBe("4");
    expect(col(row, "hero_image_url")).toBe("/media/v3/hero.avif");
  });

  it("writes dates as ISO-8601 UTC, and absent dates as empty", () => {
    expect(col(confirmedProductToRow(product()), "confirmed_at")).toBe(
      "2026-09-15T10:30:00.000Z",
    );
    // confirmedAt is non-null for every row this export selects, but the type
    // allows null and a blank must never render as "Invalid Date".
    expect(
      col(
        confirmedProductToRow(product({ confirmedAt: null })),
        "confirmed_at",
      ),
    ).toBe("");
  });

  it("leaves missing optional text empty rather than writing 'null'", () => {
    const row = confirmedProductToRow(
      product({
        category: null,
        timeline: null,
        materials: null,
        dimensions: null,
        importSource: null,
        tier: null,
        heroImageUrl: null,
        confirmedById: null,
      }),
    );
    for (const key of [
      "canonical_product_type",
      "lead_time_text",
      "materials_raw",
      "dimensions_raw",
      "source_name",
      "tier",
      "hero_image_url",
      "confirmed_by",
    ] as const) {
      expect(col(row, key)).toBe("");
    }
  });

  it("reports availability and the rewrite flag as stable tokens", () => {
    expect(col(confirmedProductToRow(product()), "availability")).toBe(
      "in_stock",
    );
    expect(
      col(confirmedProductToRow(product({ inStock: false })), "availability"),
    ).toBe("out_of_stock");
    expect(
      col(
        confirmedProductToRow(product({ needsRewrite: true })),
        "needs_rewrite",
      ),
    ).toBe("true");
  });
});

describe("column vocabulary", () => {
  it("uses machine-friendly keys, never presentation labels", () => {
    for (const key of CONFIRMED_EXPORT_COLUMNS) {
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("has no duplicate keys", () => {
    expect(new Set(CONFIRMED_EXPORT_COLUMNS).size).toBe(
      CONFIRMED_EXPORT_COLUMNS.length,
    );
  });

  it("pins the leading column order — append only, never reorder", () => {
    // Someone's saved formula references a column by position. Reordering is
    // a silent break: the file still opens, the numbers are just wrong.
    expect(CONFIRMED_EXPORT_COLUMNS.slice(0, 8)).toEqual([
      "internal_product_id",
      "slug",
      "title",
      "canonical_product_type",
      "status",
      "price_basis",
      "currency",
      "list_price",
    ]);
  });
});

describe("csv serialization", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\r\nbreak")).toBe('"line\r\nbreak"');
    expect(csvCell("plain")).toBe("plain");
  });

  it("defuses a leading formula character", () => {
    // Scraped titles genuinely start with "-", so this is not hypothetical.
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("- Handmade river table")).toBe("'- Handmade river table");
    expect(csvCell("@here")).toBe("'@here");
  });

  it("writes the header then one CRLF line per product", () => {
    const doc = toCsvDocument(
      CONFIRMED_EXPORT_COLUMNS,
      confirmedProductsToRows([product(), product({ id: "prd_2" })]),
    );
    const lines = doc.trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(CONFIRMED_EXPORT_COLUMNS.join(","));
    expect(lines[1].startsWith("prd_1,")).toBe(true);
    expect(lines[2].startsWith("prd_2,")).toBe(true);
  });

  it("round-trips an empty list to a header-only document", () => {
    const doc = toCsvDocument(CONFIRMED_EXPORT_COLUMNS, []);
    expect(doc).toBe(CONFIRMED_EXPORT_COLUMNS.join(",") + "\r\n");
  });
});
