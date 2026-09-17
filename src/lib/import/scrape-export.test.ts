import { describe, expect, it } from "vitest";

import {
  CATEGORY_AUTO_MARK,
  detectScrapeExport,
  parseScrapeFields,
  PRODUCT_TIER_SUGGESTED_MARK,
  remapScrapeExportRow,
  scrapeIdentityKey,
} from "@/lib/import/scrape-export";
import { getImportTemplate, templateColumns } from "@/lib/import/templates";
import {
  rowToScrapeDeck,
  SCRAPEDECK_COLUMNS,
  type ScrapeDeckProduct,
} from "@/lib/scraper/export";

/**
 * The pure half of "a Product Scraper export imports as Products": the
 * signature detection and the column remap. The database half (the writer's
 * DRAFT + rewrite guard, the identity pair, the twin) is
 * `tests/db/bulk-import-scrape-export.test.ts`.
 */

/** A full ScrapeDeck row, built by the REAL serializer and lower-cased the
 *  way the CSV parser lower-cases headers, so the remap is tested against
 *  what the export actually writes rather than a hand-typed copy. */
function scrapeDeckRow(
  overrides: Partial<ScrapeDeckProduct> = {},
): Record<string, string> {
  const product: ScrapeDeckProduct = {
    sourceKey: "wooden-sure",
    vertical: "resin",
    externalId: "shopify-1001",
    title: "River Dining Table — Walnut & Ocean",
    slug: "River_Dining_Table Walnut",
    category: "Furniture > Tables",
    shortTagline: "Live-edge walnut with a resin river",
    description: "A 180 cm river table.",
    priceMin: 85000,
    priceMax: 120000,
    currency: "INR",
    showPrice: true,
    timeline: "6-8 weeks",
    materials: "Walnut, epoxy resin",
    dimensions: "180 x 90 cm",
    status: "active",
    featured: false,
    images: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
    imageAlts: ["Top view", "Side view"],
    fields: { productType: "Dining Table", vendor: "WoodenSure" },
    seoTitle: "River Dining Table",
    seoDescription: "Walnut river table.",
    url: "https://woodensure.example/products/river-dining-table",
    firstSeen: new Date("2026-09-01T00:00:00Z"),
    lastSeen: new Date("2026-09-17T00:00:00Z"),
    contentHash: "abc123",
    ...overrides,
  };
  const cells = rowToScrapeDeck(product);
  const row: Record<string, string> = {};
  SCRAPEDECK_COLUMNS.forEach((column, i) => {
    row[column.toLowerCase()] = cells[i];
  });
  return row;
}

describe("detectScrapeExport", () => {
  it("recognises the ScrapeDeck signature however the headers are cased", () => {
    expect(detectScrapeExport(["SourceKey", "ExternalID", "title"])).toBe(true);
    expect(detectScrapeExport(["sourcekey", "externalid"])).toBe(true);
    expect(detectScrapeExport(["source_key", "external_id"])).toBe(true);
    expect(detectScrapeExport([" Source_Key ", "externalId"])).toBe(true);
  });

  it("needs BOTH halves of the identity pair — a content hash alone is not a scraper export", () => {
    expect(detectScrapeExport(["sourcekey", "title", "slug"])).toBe(false);
    expect(detectScrapeExport(["externalid", "title", "slug"])).toBe(false);
    expect(detectScrapeExport(["contenthash", "title", "slug"])).toBe(false);
    expect(detectScrapeExport(["title", "slug", "category_slug"])).toBe(false);
  });
});

describe("remapScrapeExportRow", () => {
  it("maps a full ScrapeDeck row onto the products template columns", () => {
    const remapped = remapScrapeExportRow(scrapeDeckRow());

    expect(remapped.title).toBe("River Dining Table — Walnut & Ocean");
    expect(remapped.short_tagline).toBe("Live-edge walnut with a resin river");
    expect(remapped.description).toBe("A 180 cm river table.");
    expect(remapped.price_min).toBe("85000");
    expect(remapped.price_max).toBe("120000");
    expect(remapped.show_price).toBe("TRUE");
    expect(remapped.timeline).toBe("6-8 weeks");
    expect(remapped.materials).toBe("Walnut, epoxy resin");
    expect(remapped.dimensions).toBe("180 x 90 cm");
    expect(remapped.featured).toBe("FALSE");
    expect(remapped.images).toBe(
      "https://cdn.example.com/a.jpg | https://cdn.example.com/b.jpg",
    );
    expect(remapped.image_alts).toBe("Top view | Side view");
    expect(remapped.seo_title).toBe("River Dining Table");
    expect(remapped.seo_description).toBe("Walnut river table.");

    // Provenance the writer and the validator need.
    expect(remapped.source_key).toBe("wooden-sure");
    expect(remapped.external_id).toBe("shopify-1001");
    expect(remapped.source_category).toBe("Furniture > Tables");
    expect(remapped.source_url).toBe(
      "https://woodensure.example/products/river-dining-table",
    );
    expect(parseScrapeFields(remapped.fields)).toEqual({
      productType: "Dining Table",
      vendor: "WoodenSure",
    });

    // Every column the products template knows is present (blank or not),
    // so the required-column check reads the remapped row, not the export.
    const template = getImportTemplate("products")!;
    for (const column of templateColumns(template)) {
      if (column.startsWith("custom")) continue;
      expect(remapped).toHaveProperty(column);
    }
  });

  it("makes the slug URL-safe, falling back to the title", () => {
    expect(remapScrapeExportRow(scrapeDeckRow()).slug).toBe(
      "river-dining-table-walnut",
    );
    expect(remapScrapeExportRow(scrapeDeckRow({ slug: "" })).slug).toBe(
      "river-dining-table-walnut-ocean",
    );
  });

  it("status is ALWAYS blank — a scraped row lands as a draft whatever the sheet says", () => {
    expect(
      remapScrapeExportRow(scrapeDeckRow({ status: "active" })).status,
    ).toBe("");
    expect(
      remapScrapeExportRow(scrapeDeckRow({ status: "out_of_stock" })).status,
    ).toBe("");
    // Even a hand-added ContentStatus cell is ignored.
    expect(
      remapScrapeExportRow({ ...scrapeDeckRow(), status: "PUBLISHED" }).status,
    ).toBe("");
  });

  it("derives in_stock from the listing's availability", () => {
    expect(
      remapScrapeExportRow(scrapeDeckRow({ status: "active" })).in_stock,
    ).toBe("TRUE");
    expect(
      remapScrapeExportRow(scrapeDeckRow({ status: "out_of_stock" })).in_stock,
    ).toBe("FALSE");
    expect(remapScrapeExportRow(scrapeDeckRow({ status: null })).in_stock).toBe(
      "",
    );
    expect(
      remapScrapeExportRow(scrapeDeckRow({ status: "preorder" })).in_stock,
    ).toBe("");
  });

  it("tier (the import list) is always blank — a scraped row came from no CSV list", () => {
    expect(remapScrapeExportRow(scrapeDeckRow()).tier).toBe("");
    expect(remapScrapeExportRow({ ...scrapeDeckRow(), tier: "2" }).tier).toBe(
      "",
    );
  });

  it("keeps an explicit product_tier and category_slug the owner added by hand", () => {
    const remapped = remapScrapeExportRow({
      ...scrapeDeckRow(),
      product_tier: "LARGE",
      category_slug: "resin-furniture-surfaces",
    });
    expect(remapped.product_tier).toBe("LARGE");
    expect(remapped.category_slug).toBe("resin-furniture-surfaces");

    const blank = remapScrapeExportRow(scrapeDeckRow());
    expect(blank.product_tier).toBe("");
    expect(blank.category_slug).toBe("");
  });

  it("is idempotent — the wizard echoes remapped rows back for a second validation", () => {
    const once = remapScrapeExportRow(
      scrapeDeckRow({ status: "out_of_stock" }),
    );
    // The validator's own fills and marks ride along unchanged.
    once.category_slug = "resin-furniture-surfaces";
    once[CATEGORY_AUTO_MARK] = "TRUE";
    once.product_tier = "LARGE_FORMAT";
    once[PRODUCT_TIER_SUGGESTED_MARK] = "TRUE";

    const twice = remapScrapeExportRow(once);
    expect(twice).toEqual(once);
    expect(twice.in_stock).toBe("FALSE");
    expect(twice.status).toBe("");
    expect(detectScrapeExport(Object.keys(twice))).toBe(true);
  });
});

describe("scrapeIdentityKey", () => {
  it("is the (source_key, external_id) pair, and null when either half is missing", () => {
    const remapped = remapScrapeExportRow(scrapeDeckRow());
    expect(scrapeIdentityKey(remapped)).toBe("wooden-sure|shopify-1001");
    expect(scrapeIdentityKey({ ...remapped, external_id: "" })).toBeNull();
    expect(scrapeIdentityKey({ ...remapped, source_key: " " })).toBeNull();
  });
});

describe("parseScrapeFields", () => {
  it("returns null for an empty or broken cell rather than throwing", () => {
    expect(parseScrapeFields("")).toBeNull();
    expect(parseScrapeFields(undefined)).toBeNull();
    expect(parseScrapeFields("{not json")).toBeNull();
    expect(parseScrapeFields('{"productType":"Clock"}')).toEqual({
      productType: "Clock",
    });
  });
});

describe("the export's own guards do not enter the catalogue", () => {
  it("strips the apostrophe csvCell added, and only that one", () => {
    const row = remapScrapeExportRow({
      sourcekey: "saashi",
      externalid: "ext-1",
      // What `csvCell` writes for a title the supplier begins with "-", and
      // what a spreadsheet eats on the way back in. A program does not.
      title: "'- Handmade river table",
      description: "'- 180 cm long",
      // A legitimate leading apostrophe is not a guard and must survive.
      short_tagline: "'90s revival, cast in one pour",
      materials: "'=Walnut",
    });
    expect(row.title).toBe("- Handmade river table");
    expect(row.description).toBe("- 180 cm long");
    expect(row.short_tagline).toBe("'90s revival, cast in one pour");
    expect(row.materials).toBe("=Walnut");
  });

  it("keeps the hand-added customization columns the wizard invites", () => {
    const row = remapScrapeExportRow({
      sourcekey: "saashi",
      externalid: "ext-1",
      title: "A table",
      custom1_label: "Engraving text",
      custom1_type: "TEXT",
      custom1_required: "TRUE",
    });
    expect(row.custom1_label).toBe("Engraving text");
    expect(row.custom1_type).toBe("TEXT");
    expect(row.custom1_required).toBe("TRUE");
  });
});
