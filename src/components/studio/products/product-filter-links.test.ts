import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { IMPORT_LISTS } from "@/lib/import-list";
import { PRODUCT_SIZE_TIERS } from "@/lib/product-size-tier";
import {
  buildProductWhere,
  parseProductListFilter,
  productListFilterSchema,
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

/**
 * THE GAP THIS CLOSES, and why the tests above did not catch it.
 *
 * `productListHref` builds its URL from `productListFilterSchema.shape`, so it
 * can emit ANY key the schema declares. `parseProductListFilter` and
 * `buildProductWhere` both handle all of them — and every test above proves
 * that, by feeding a built href straight back into the parser.
 *
 * None of that touches the page. `/studio/products` declares its own
 * `searchParams` type and hand-lists the keys it forwards, and on 2026-09-18
 * that list was missing `rewrite` and `stale`. So the Overview's "Live, still
 * awaiting a rewrite" card counted N rows and opened all ~4,400 published
 * ones, and "Drafts untouched for a month" opened every draft — the exact
 * failure `action-queue.ts`'s own header says it exists to prevent. Both
 * params had been in the schema and the where clause since the day they were
 * added; only the page never read them.
 *
 * A round-trip test cannot see this: the parser is correct, and the page is
 * an RSC module vitest cannot import (it pulls in `next/link` and the Prisma
 * client). So this reads the page's SOURCE, the way `sidebar.test.ts` and
 * `docs-index.test.ts` already read theirs, and asserts the contract that
 * actually broke.
 */
describe("the list page reads every key a deep link can carry", () => {
  const PAGE = readFileSync(
    join(process.cwd(), "src/app/studio/(dashboard)/products/page.tsx"),
    "utf8",
  );

  /** The `searchParams: Promise<{ … }>` block. */
  const typeBlock = (() => {
    const start = PAGE.indexOf("searchParams: Promise<{");
    expect(start, "searchParams type block not found").toBeGreaterThan(-1);
    const end = PAGE.indexOf("}>;", start);
    return PAGE.slice(start, end);
  })();

  /** The object literal handed to `parseProductListFilter`. */
  const callBlock = (() => {
    const start = PAGE.indexOf("parseProductListFilter({");
    expect(start, "parseProductListFilter call not found").toBeGreaterThan(-1);
    const end = PAGE.indexOf("});", start);
    return PAGE.slice(start, end);
  })();

  const FILTER_KEYS = Object.keys(productListFilterSchema.shape);

  it("declares every filter key in its searchParams type", () => {
    expect(FILTER_KEYS.length).toBeGreaterThan(5);
    const missing = FILTER_KEYS.filter(
      (key) => !new RegExp(`\\b${key}\\?:`).test(typeBlock),
    );
    expect(
      missing,
      "these keys can be emitted into a link but the page does not declare them",
    ).toEqual([]);
  });

  it("forwards every filter key into the parser", () => {
    // Word-boundary matched: `q` is one letter and would otherwise match
    // almost anything in the block.
    const missing = FILTER_KEYS.filter(
      (key) => !new RegExp(`(^|[\\s,{])${key}\\s*[,}]`, "m").test(callBlock),
    );
    expect(
      missing,
      "these keys reach the page and are then dropped before the parser",
    ).toEqual([]);
  });

  it("covers the two params the Overview's action queue links with", () => {
    // Named explicitly so the regression that happened has its own failure
    // message, not just a diff of a key list.
    for (const key of ["rewrite", "stale"]) {
      expect(FILTER_KEYS).toContain(key);
      expect(typeBlock).toContain(`${key}?:`);
      expect(callBlock).toContain(key);
    }
  });
});
