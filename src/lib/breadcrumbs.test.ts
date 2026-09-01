import { describe, expect, it } from "vitest";
import {
  buildCategoryBreadcrumbs,
  buildProductBreadcrumbs,
} from "./breadcrumbs";

describe("Group-aware Breadcrumbs (Prompt Deck Decision 3)", () => {
  describe("buildCategoryBreadcrumbs", () => {
    it("builds 3-item breadcrumbs for art categories without group crumb", () => {
      const items = buildCategoryBreadcrumbs({
        homeLabel: "Home",
        shopLabel: "Shop",
        categoryName: "Resin Clocks",
        group: "art",
        groupLabel: "Art Pieces",
      });

      expect(items).toEqual([
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: "Resin Clocks" },
      ]);
    });

    it("inserts ecosystem group crumb for supplies categories", () => {
      const items = buildCategoryBreadcrumbs({
        homeLabel: "Home",
        shopLabel: "Shop",
        categoryName: "Silicone Moulds",
        group: "supplies",
        groupLabel: "Supplies",
      });

      expect(items).toEqual([
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: "Supplies", href: "/shop?type=supplies" },
        { label: "Silicone Moulds" },
      ]);
    });

    it("inserts ecosystem group crumb for 3D print categories", () => {
      const items = buildCategoryBreadcrumbs({
        homeLabel: "Home",
        shopLabel: "Shop",
        categoryName: "3D Lithophanes",
        group: "print",
        groupLabel: "3D Print",
      });

      expect(items).toEqual([
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: "3D Print", href: "/shop?type=print" },
        { label: "3D Lithophanes" },
      ]);
    });
  });

  describe("buildProductBreadcrumbs", () => {
    it("builds 4-item breadcrumbs for art products without group crumb", () => {
      const items = buildProductBreadcrumbs({
        homeLabel: "Home",
        shopLabel: "Shop",
        categoryName: "Resin Wall Clocks",
        categorySlug: "resin-wall-clocks",
        productTitle: "Ocean Azure Clock",
        group: "art",
        groupLabel: "Art Pieces",
      });

      expect(items).toEqual([
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: "Resin Wall Clocks", href: "/shop/resin-wall-clocks" },
        { label: "Ocean Azure Clock" },
      ]);
    });

    it("inserts ecosystem group crumb for supplies products", () => {
      const items = buildProductBreadcrumbs({
        homeLabel: "Home",
        shopLabel: "Shop",
        categoryName: "Mica Pigments",
        categorySlug: "mica-pigments",
        productTitle: "Sapphire Pearl Powder",
        group: "supplies",
        groupLabel: "Supplies",
      });

      expect(items).toEqual([
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: "Supplies", href: "/shop?type=supplies" },
        { label: "Mica Pigments", href: "/shop/mica-pigments" },
        { label: "Sapphire Pearl Powder" },
      ]);
    });

    it("inserts ecosystem group crumb for 3D print products", () => {
      const items = buildProductBreadcrumbs({
        homeLabel: "Home",
        shopLabel: "Shop",
        categoryName: "Custom Lithophanes",
        categorySlug: "custom-lithophanes",
        productTitle: "Curved Photo Lithophane",
        group: "print",
        groupLabel: "3D Print",
      });

      expect(items).toEqual([
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: "3D Print", href: "/shop?type=print" },
        { label: "Custom Lithophanes", href: "/shop/custom-lithophanes" },
        { label: "Curved Photo Lithophane" },
      ]);
    });
  });
});
