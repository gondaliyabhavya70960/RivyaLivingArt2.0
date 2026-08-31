import { describe, expect, it } from "vitest";

import {
  NAV_MENUS,
  NAV_MENU_DEFAULTS,
  describeHrefProblem,
  isNavMenuKey,
  resolveNavLabel,
} from "./nav-menus";

describe("the bundled menus", () => {
  it("gives every menu at least one link", () => {
    // The fallback is what renders when the table is empty or unreachable. An
    // empty menu there would mean a site with no way to get anywhere.
    for (const menu of NAV_MENUS) {
      expect(NAV_MENU_DEFAULTS[menu].length, menu).toBeGreaterThan(0);
    }
  });

  it("keeps the header's mega-menu hook", () => {
    // The header renders the shop mega menu for the item keyed "shop"; the
    // behaviour is hooked to the key, never the label, so that renaming the
    // link in the studio cannot switch the mega menu off.
    expect(NAV_MENU_DEFAULTS.header.map((l) => l.key)).toContain("shop");
  });

  it("has no duplicate key within a menu", () => {
    for (const menu of NAV_MENUS) {
      const keys = NAV_MENU_DEFAULTS[menu].map((l) => l.key);
      expect(new Set(keys).size, menu).toBe(keys.length);
    }
  });

  it("ships only hrefs its own validator accepts", () => {
    // If a seeded link could not pass the rule the studio enforces, the rule
    // is wrong — this catches that before an owner hits it.
    for (const menu of NAV_MENUS) {
      for (const link of NAV_MENU_DEFAULTS[menu]) {
        expect(
          describeHrefProblem(link.href),
          `${menu}:${link.key}`,
        ).toBeNull();
      }
    }
  });
});

describe("describeHrefProblem", () => {
  it("accepts the site's own pages", () => {
    expect(describeHrefProblem("/shop")).toBeNull();
    expect(describeHrefProblem("/")).toBeNull();
    expect(describeHrefProblem("/custom-order")).toBeNull();
  });

  it("accepts a fragment or a query onto a known page", () => {
    // Both ship in the footer today.
    expect(describeHrefProblem("/shop#collections")).toBeNull();
    expect(describeHrefProblem("/blog?category=gift-guides")).toBeNull();
  });

  it("accepts a dynamic content route", () => {
    // Whether the slug exists is a content question, not a routing one.
    expect(describeHrefProblem("/product/varmala-frame")).toBeNull();
    expect(describeHrefProblem("/shop/wedding-photo-frames")).toBeNull();
    expect(describeHrefProblem("/blog/reference-photos")).toBeNull();
  });

  it("accepts external and contact schemes", () => {
    expect(describeHrefProblem("https://instagram.com/resinriva")).toBeNull();
    expect(describeHrefProblem("mailto:hello@example.com")).toBeNull();
    expect(describeHrefProblem("tel:+919999999999")).toBeNull();
  });

  it("refuses a page that does not exist, and names it", () => {
    const problem = describeHrefProblem("/workshop");
    expect(problem).toContain("/workshop");
  });

  it("refuses a path that is not a path", () => {
    expect(describeHrefProblem("workshops")).toContain("starts with");
  });

  it("refuses an empty destination", () => {
    expect(describeHrefProblem("   ")).toContain("destination");
  });

  it("does not accept a locale-prefixed path", () => {
    // Link from @/i18n/navigation adds the prefix; storing one would produce
    // /hi/hi/shop for a Hindi visitor.
    expect(describeHrefProblem("/hi/shop")).not.toBeNull();
  });
});

describe("resolveNavLabel", () => {
  it("returns undefined with no override, so the catalogue wins", () => {
    expect(resolveNavLabel({}, "en")).toBeUndefined();
    expect(resolveNavLabel(null, "en")).toBeUndefined();
    expect(resolveNavLabel(["nope"], "en")).toBeUndefined();
  });

  it("prefers the locale's own wording", () => {
    expect(resolveNavLabel({ en: "Shop", hi: "दुकान" }, "hi")).toBe("दुकान");
  });

  it("falls back to English before giving up", () => {
    expect(resolveNavLabel({ en: "Shop" }, "ja")).toBe("Shop");
  });

  it("treats a blank override as absent", () => {
    expect(resolveNavLabel({ hi: "   " }, "hi")).toBeUndefined();
  });
});

describe("isNavMenuKey", () => {
  it("accepts the six menus and nothing else", () => {
    expect(isNavMenuKey("header")).toBe(true);
    expect(isNavMenuKey("footer-legal")).toBe(true);
    expect(isNavMenuKey("footer")).toBe(false);
    expect(isNavMenuKey("")).toBe(false);
  });
});
