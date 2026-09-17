import { describe, expect, it } from "vitest";

import { IMPORT_LISTS } from "@/lib/import-list";
import { PRODUCT_SIZE_TIERS } from "@/lib/product-size-tier";
import {
  buildProductWhere,
  parseProductListFilter,
  type ProductListFilter,
} from "./product-filter";
import {
  importListStripHref,
  productListHref,
  sizeTierStripHref,
} from "./product-filter-links";

/** What the list page does with a URL: searchParams → parser. */
function parseHref(href: string): ProductListFilter {
  const url = new URL(href, "http://studio.test");
  expect(url.pathname).toBe("/studio/products");
  return parseProductListFilter(Object.fromEntries(url.searchParams));
}

/**
 * The overview's strips deep-link into /studio/products, and the two
 * "tier" params mean different columns. These pin that every href the
 * overview emits parses back into exactly the filter it was built from —
 * the untiered backlog as a real null clause, each product tier by name,
 * each import list by its column value.
 */
describe("the product-list deep links the overview emits", () => {
  it("round-trips each product tier through the parser", () => {
    for (const tier of PRODUCT_SIZE_TIERS) {
      const href = sizeTierStripHref(tier);
      expect(href).toBe(`/studio/products?sizeTier=${tier}`);
      expect(parseHref(href)).toEqual({ sizeTier: tier });
      expect(buildProductWhere(parseHref(href))).toHaveProperty(
        "sizeTier",
        tier,
      );
    }
  });

  it("links the Untiered count to the backlog — a real null clause", () => {
    const href = sizeTierStripHref("NONE");
    expect(href).toBe("/studio/products?sizeTier=NONE");
    expect(parseHref(href)).toEqual({ sizeTier: "NONE" });
    expect(buildProductWhere(parseHref(href))).toHaveProperty("sizeTier", null);
  });

  it("links each import list by its column value, on the OTHER param", () => {
    for (const list of IMPORT_LISTS) {
      const href = importListStripHref(list);
      expect(href).toBe(`/studio/products?tier=${list}`);
      const filter = parseHref(href);
      expect(filter).toEqual({ tier: String(list) });
      expect(filter.sizeTier).toBeUndefined();
      expect(buildProductWhere(filter)).toHaveProperty("tier", list);
    }
  });

  it("counts the same population the strips count: the Published tab", () => {
    // No status param → the parser's absent status → the Published default.
    for (const href of [sizeTierStripHref("NONE"), importListStripHref(1)]) {
      expect(buildProductWhere(parseHref(href))).toHaveProperty(
        "status",
        "PUBLISHED",
      );
    }
  });

  it("is the parser's inverse for a full filter, in a stable key order", () => {
    const filter: ProductListFilter = {
      q: "table",
      status: "ALL",
      category: "cat_1",
      tier: "3",
      sizeTier: "LARGE_FORMAT",
      stock: "out",
      demo: "1",
    };
    const href = productListHref(filter);
    expect(href).toBe(
      "/studio/products?q=table&status=ALL&category=cat_1&tier=3&sizeTier=LARGE_FORMAT&stock=out&demo=1",
    );
    expect(parseHref(href)).toEqual(filter);
    expect(productListHref({})).toBe("/studio/products");
  });
});

describe("the imagery worklist filter (plan §3 S4)", () => {
  it("round-trips 'no image at all' into an images-none clause", () => {
    const href = productListHref({ status: "PUBLISHED", media: "none" });
    expect(href).toBe("/studio/products?status=PUBLISHED&media=none");
    expect(parseHref(href)).toEqual({ status: "PUBLISHED", media: "none" });
    expect(buildProductWhere(parseHref(href))).toMatchObject({
      status: "PUBLISHED",
      images: { none: {} },
    });
  });

  it("asks for a placeholder ANYWHERE, not for the cover", () => {
    // The cover is min(order) and Prisma has no predicate for it, so the
    // filter is a superset that never misses a blocked row. If this ever
    // becomes an exact cover test, the label in product-list.tsx ("Has a
    // concept placeholder") has to change with it.
    const where = buildProductWhere(parseHref(productListHref({ media: "placeholder" })));
    expect(where).toMatchObject({
      images: { some: { url: { startsWith: "/redesign/catalog/" } } },
    });
  });

  it("drops a media value the schema does not know", () => {
    expect(parseProductListFilter({ media: "blurry" }).media).toBeUndefined();
  });
});
