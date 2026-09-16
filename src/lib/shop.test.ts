import { describe, expect, it } from "vitest";
import { CATALOG_GROUPS } from "@/lib/catalog-taxonomy";
import { demoClause } from "@/lib/demo-clause";
import { buildProductWhere } from "./shop";

describe("buildProductWhere (Prompt 07)", () => {
  it("builds baseline published non-demo clause with empty filters", () => {
    const where = buildProductWhere({});
    expect(where.status).toBe("PUBLISHED");
    expect(where.isDemo).toBe(false);
    expect(where.NOT).toBeUndefined();
    expect(where.AND).toBeUndefined();
  });

  it("drops the demo gate only when the caller shows demo content", () => {
    expect(buildProductWhere({}, demoClause(true)).isDemo).toBeUndefined();
    expect(buildProductWhere({}, demoClause(false)).isDemo).toBe(false);
  });

  it("builds case-insensitive search clause on title and shortTagline", () => {
    const where = buildProductWhere({ q: "geode coaster" });
    expect(where.AND).toBeDefined();
    const and = where.AND as Array<Record<string, unknown>>;
    const searchClause = and.find((c) => "OR" in c);
    expect(searchClause).toEqual({
      OR: [
        { title: { contains: "geode coaster", mode: "insensitive" } },
        { shortTagline: { contains: "geode coaster", mode: "insensitive" } },
      ],
    });
  });

  it("adds ecosystem category containment for 'art' group", () => {
    const where = buildProductWhere({ type: "art" });
    const and = where.AND as Array<Record<string, unknown>>;
    const groupClause = and.find((c) => "category" in c);
    expect(groupClause).toEqual({
      category: { slug: { in: [...CATALOG_GROUPS.art.slugs] } },
    });
  });

  it("does NOT add category clause for 'all' ecosystem sentinel", () => {
    const where = buildProductWhere({ type: "all" });
    expect(where.AND).toBeUndefined();
  });

  it("adds specific category filter when requested", () => {
    const where = buildProductWhere({ category: "resin-clocks" });
    const and = where.AND as Array<Record<string, unknown>>;
    expect(and).toContainEqual({
      category: { slug: "resin-clocks" },
    });
  });

  it("adds jsonb array containment for occasion", () => {
    const where = buildProductWhere({ occasion: "wedding" });
    const and = where.AND as Array<Record<string, unknown>>;
    expect(and).toContainEqual({
      occasions: { array_contains: ["wedding"] },
    });
  });

  it("adds inStock: true when stock === 'in'", () => {
    const where = buildProductWhere({ stock: "in" });
    const and = where.AND as Array<Record<string, unknown>>;
    expect(and).toContainEqual({ inStock: true });
  });

  it("adds a sizeTier equality clause for a known slug — Product.sizeTier, not Product.tier", () => {
    const where = buildProductWhere({ sizeTier: "large" });
    const and = where.AND as Array<Record<string, unknown>>;
    expect(and).toContainEqual({ sizeTier: "LARGE_FORMAT" });
    for (const clause of and) expect(clause).not.toHaveProperty("tier");
  });

  it("ignores an unknown sizeTier value rather than matching nothing", () => {
    // The enum spelling is deliberately not a second public one, and the
    // untiered backlog is a Studio concern, not a storefront facet.
    for (const value of ["LARGE_FORMAT", "none", "huge"]) {
      expect(buildProductWhere({ sizeTier: value }).AND).toBeUndefined();
    }
  });

  it("filters price band with min and max bounds correctly", () => {
    // 1k-5k: min 1000, max 5000
    const where = buildProductWhere({ band: "1k-5k" });
    const and = where.AND as Array<Record<string, unknown>>;
    expect(and).toContainEqual({ priceMin: { not: null } });
    expect(and).toContainEqual({ priceMin: { lte: 5000 } });
    expect(and).toContainEqual({
      OR: [
        { priceMax: { gte: 1000 } },
        { priceMax: null, priceMin: { gte: 1000 } },
      ],
    });
  });

  it("filters lower-bounded price band (above-50k)", () => {
    const where = buildProductWhere({ band: "above-50k" });
    const and = where.AND as Array<Record<string, unknown>>;
    expect(and).toContainEqual({ priceMin: { not: null } });
    // No lte max clause for above-50k
    expect(and.some((c) => "priceMin" in c && typeof c.priceMin === "object" && c.priceMin !== null && "lte" in (c.priceMin as Record<string, unknown>))).toBe(false);
    expect(and).toContainEqual({
      OR: [
        { priceMax: { gte: 50000 } },
        { priceMax: null, priceMin: { gte: 50000 } },
      ],
    });
  });
});
