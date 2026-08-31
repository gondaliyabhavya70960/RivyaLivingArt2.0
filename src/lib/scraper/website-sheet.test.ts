import { describe, expect, it } from "vitest";

import {
  WEBSITE_COLUMNS,
  WEBSITE_SHEET_TAB,
  websiteProductToRow,
  type WebsiteProductRow,
} from "@/lib/scraper/website-sheet";

const PRODUCT: WebsiteProductRow = {
  id: "prod_1",
  slug: "resin-ganesha",
  title: "Premium Resin Ganesha",
  status: "PUBLISHED",
  priceMin: 849,
  priceMax: 1299,
  showPrice: true,
  inStock: true,
  featured: false,
  confirmedAt: new Date("2026-08-24T10:00:00Z"),
  importSource: "kanha-kreation",
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-20T00:00:00Z"),
  category: { name: "Art & Craft Pieces" },
  images: [{ url: "https://x/1.jpg" }, { url: "https://x/2.jpg" }],
};

describe("the website mirror tab", () => {
  it("is titled exactly as the owner asked", () => {
    expect(WEBSITE_SHEET_TAB).toBe("Added product in website");
  });

  it("leads with Product ID — the merge key and the cross-tab reference", () => {
    expect(WEBSITE_COLUMNS[0]).toBe("Product ID");
  });

  it("emits one cell per column, in order", () => {
    // A row that drifts from the header writes values under the wrong
    // headings, which reads as corrupted data rather than a bug.
    expect(websiteProductToRow(PRODUCT)).toHaveLength(WEBSITE_COLUMNS.length);
  });

  it("puts the product id first so deletion can find the row", () => {
    expect(websiteProductToRow(PRODUCT)[0]).toBe("prod_1");
  });

  it("writes booleans as words, for a human filtering by hand", () => {
    const row = websiteProductToRow(PRODUCT);
    expect(row[WEBSITE_COLUMNS.indexOf("In Stock")]).toBe("Yes");
    expect(row[WEBSITE_COLUMNS.indexOf("Featured")]).toBe("No");
  });

  it("marks whether the product is on the confirmed list", () => {
    expect(websiteProductToRow(PRODUCT)[WEBSITE_COLUMNS.indexOf("Confirmed")]).toBe("Yes");
    expect(
      websiteProductToRow({ ...PRODUCT, confirmedAt: null })[
        WEBSITE_COLUMNS.indexOf("Confirmed")
      ],
    ).toBe("No");
  });

  it("includes DRAFT products, carrying their status", () => {
    // Added and live are different things. Dropping unpublished rows would
    // hide products the owner knows they added.
    const row = websiteProductToRow({ ...PRODUCT, status: "DRAFT" });
    expect(row[WEBSITE_COLUMNS.indexOf("Status")]).toBe("DRAFT");
  });

  it("blanks a null price rather than writing 0", () => {
    const row = websiteProductToRow({ ...PRODUCT, priceMin: null, priceMax: null });
    expect(row[WEBSITE_COLUMNS.indexOf("Price Min")]).toBe("");
    expect(row[WEBSITE_COLUMNS.indexOf("Price Max")]).toBe("");
  });

  it("credits a hand-made product to the studio, not to a blank", () => {
    const row = websiteProductToRow({ ...PRODUCT, importSource: null });
    expect(row[WEBSITE_COLUMNS.indexOf("Source")]).toBe("studio");
  });

  it("joins every image url, not just the primary", () => {
    const row = websiteProductToRow(PRODUCT);
    expect(row[WEBSITE_COLUMNS.indexOf("Primary Image")]).toBe("https://x/1.jpg");
    expect(row[WEBSITE_COLUMNS.indexOf("Images")]).toBe(
      "https://x/1.jpg | https://x/2.jpg",
    );
  });

  it("survives a product with no images or category", () => {
    const row = websiteProductToRow({
      ...PRODUCT,
      images: [],
      category: null,
    });
    expect(row[WEBSITE_COLUMNS.indexOf("Primary Image")]).toBe("");
    expect(row[WEBSITE_COLUMNS.indexOf("Category")]).toBe("");
    expect(row).toHaveLength(WEBSITE_COLUMNS.length);
  });
});
