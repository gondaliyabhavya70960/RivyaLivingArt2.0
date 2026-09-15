import { describe, expect, it } from "vitest";

import {
  buildProductWhere,
  parseProductListFilter,
} from "@/components/studio/products/product-filter";
import { PRODUCT_SIZE_TIERS } from "@/lib/product-size-tier";

/**
 * This module is the ONE definition three callers share — the list page's
 * where clause, the client's "select all matching" payload, and the bulk
 * actions re-validating that payload server-side. A divergence between them
 * is a bulk action writing to rows the operator was not shown.
 */
describe("the product-tier filter", () => {
  it("selects the untiered backlog on NONE, as a real null clause", () => {
    // THE CASE THAT IS EASY TO GET WRONG. `sizeTier: null` is falsy-adjacent
    // and every other clause in `buildProductWhere` rides truthiness, so a
    // NONE that fell through to the generic branch would silently apply no
    // filter at all — showing the owner the whole catalogue and reporting it
    // as the backlog.
    const where = buildProductWhere({ sizeTier: "NONE" });
    expect(where).toHaveProperty("sizeTier", null);
  });

  it("selects one tier by name", () => {
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(buildProductWhere({ sizeTier: tier })).toHaveProperty(
        "sizeTier",
        tier,
      );
    }
  });

  it("applies no tier clause when the filter is absent", () => {
    expect(buildProductWhere({})).not.toHaveProperty("sizeTier");
  });

  it("drops an unknown value rather than erroring, as every param here does", () => {
    expect(parseProductListFilter({ sizeTier: "HUGE" }).sizeTier).toBeUndefined();
    expect(buildProductWhere(parseProductListFilter({ sizeTier: "HUGE" })))
      .not.toHaveProperty("sizeTier");
  });

  it("round-trips NONE and each tier through the URL parser", () => {
    expect(parseProductListFilter({ sizeTier: "NONE" }).sizeTier).toBe("NONE");
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(parseProductListFilter({ sizeTier: tier }).sizeTier).toBe(tier);
    }
  });

  it("does not disturb the filters it sits beside", () => {
    // The content-gaps card links to ?sizeTier=NONE&status=ALL, so these two
    // have to compose: a status of ALL must still mean no status clause.
    const where = buildProductWhere({ sizeTier: "NONE", status: "ALL" });
    expect(where).toHaveProperty("sizeTier", null);
    expect(where).not.toHaveProperty("status");
  });

  it("still defaults to the Published tab when no status is given", () => {
    expect(buildProductWhere({ sizeTier: "NONE" })).toHaveProperty(
      "status",
      "PUBLISHED",
    );
  });

  it("keeps the two tier columns apart", () => {
    // `tier` is import provenance and `sizeTier` is the product taxonomy.
    // One filter setting the other is the exact confusion this repo's
    // three-columns-called-tier note exists to prevent.
    const where = buildProductWhere({ tier: "1", sizeTier: "SMALL_FORMAT" });
    expect(where).toHaveProperty("tier", 1);
    expect(where).toHaveProperty("sizeTier", "SMALL_FORMAT");
  });
});
