import { describe, expect, it } from "vitest";

import { pinnedItemsOf } from "@/lib/studio-pins";

/**
 * Only the pure half is tested here. `togglePin` and the snapshot readers
 * touch `window.localStorage`, and this suite runs in node with no DOM — the
 * same reason `shelfVariant` had to leave a component file to become testable.
 * What matters is pinned BELOW, and it is pure by construction.
 */
const SECTIONS = [
  {
    items: [
      { href: "/studio", label: "Overview" },
      { href: "/studio/inquiries", label: "Commissions" },
    ],
  },
  {
    items: [
      { href: "/studio/products", label: "Products" },
      { href: "/studio/media", label: "Media Library" },
    ],
  },
];

describe("pinnedItemsOf", () => {
  it("is empty when nothing is pinned", () => {
    expect(pinnedItemsOf(SECTIONS, [])).toEqual([]);
  });

  it("returns the nav's own order, not the order things were pinned in", () => {
    // Otherwise the pinned row reads as a second, differently sorted nav
    // rather than a shortcut into the one below it.
    const items = pinnedItemsOf(SECTIONS, [
      "/studio/media",
      "/studio",
      "/studio/products",
    ]);
    expect(items.map((i) => i.href)).toEqual([
      "/studio",
      "/studio/products",
      "/studio/media",
    ]);
  });

  it("drops an href the nav no longer has", () => {
    // The whole reason this FILTERS the nav instead of mapping the stored
    // list: browser storage outlives a rename, and a pinned row built by
    // mapping would render a dead link forever.
    const items = pinnedItemsOf(SECTIONS, ["/studio/sheet-import", "/studio"]);
    expect(items.map((i) => i.href)).toEqual(["/studio"]);
  });

  it("returns nothing at all when every pin is stale", () => {
    // Not an empty row with a heading over it — the caller skips the section
    // on a zero-length result.
    expect(pinnedItemsOf(SECTIONS, ["/studio/gone", "/studio/also-gone"])).toEqual(
      [],
    );
  });

  it("never duplicates a row that was somehow pinned twice", () => {
    expect(pinnedItemsOf(SECTIONS, ["/studio", "/studio"])).toHaveLength(1);
  });
});
