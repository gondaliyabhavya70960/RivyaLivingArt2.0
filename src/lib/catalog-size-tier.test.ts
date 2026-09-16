import { describe, expect, it } from "vitest";

import {
  CATEGORY_SIZE_TIER,
  DECISIVE_SCORE,
  isSupplyTitle,
  LARGE_FORMAT_CATEGORY_SLUGS,
  SUPPLY_CATEGORY_SLUGS,
  suggestCatalogSizeTier,
  WEAK_MIN_SCORE,
} from "./catalog-size-tier";

/**
 * The catalogue rule, case by case, with the real titles that shaped it —
 * every example below is a row (or the shape of a row) from the live
 * catalogue's mirror on 2026-09-16. The scores are step 6's
 * (`size-tier-suggest.ts`): a weight-3 word in the title is 6, a weight-2
 * word is 4, the description counts once, a ≥ 60 cm side adds 6.
 */
describe("suggestCatalogSizeTier", () => {
  it("never tiers a row in a supplies or workshop category, whatever the title says", () => {
    expect(
      suggestCatalogSizeTier({
        title: "River Dining Table",
        categorySlug: "supplies-resin",
      }),
    ).toEqual({ tier: null, reason: "supply-category", score: 0 });
    expect(
      suggestCatalogSizeTier({
        title: "Ocean Wave Wall Clock Masterclass",
        categorySlug: "workshops",
      }),
    ).toMatchObject({ tier: null, reason: "supply-category" });
  });

  it("leaves a supply mis-filed under a piece category untiered, by its title", () => {
    const misfiled: Array<[string, string]> = [
      ["Mirror Oval Shape 40gms", "vanity-mirrors"],
      ["Black Clock Hand Design 1", "resin-wall-clocks"],
      ["Golden Hand Design 3", "resin-wall-clocks"],
      ["Golden Roman Numbers 1 to 12 in 1.5 Inch", "resin-wall-clocks"],
      ["6 Cavity Butterfly Keychain Mold", "resin-jewelry-keychains"],
      ["Glass Beads Blue Color 100 Pcs Approx", "resin-jewelry-keychains"],
      ["Golden Head Pins for Jewellery Making", "resin-jewelry-keychains"],
      ["Beige Rakhi Chain for Bracelet Making", "festive-pooja"],
      ["Dark Green Floral Tape", "resin-home-decor"],
      ["2:1 Resin Hardener 1.5 Kg", "resin-home-decor"],
      ["Candle Liquid Royal Blue Colour 30ml", "candle-tea-light-holders"],
      ["3D Tulip Candle Silicone Bouquet", "candle-tea-light-holders"],
      ["Bezel Frame Heart shape 2 cm", "wedding-photo-frames"],
      ["Help me Lou! 1-to-1 Private Tuition on Zoom", "resin-home-decor"],
    ];
    for (const [title, categorySlug] of misfiled) {
      expect(isSupplyTitle(title), title).toBe(true);
      expect(suggestCatalogSizeTier({ title, categorySlug }), title).toEqual({
        tier: null,
        reason: "supply-title",
        score: 0,
      });
    }
  });

  it("does not read a technique word as a supply — the finished piece keeps its tier", () => {
    for (const title of [
      "Epoxy Resin Ocean Wave Wall Clock",
      "Resin Alcohol Ink Abstract Wall Clock",
      "Handmade Resin Art Real Flower Earrings",
      "Glittery Flower Resin Coasters",
    ]) {
      expect(isSupplyTitle(title), title).toBe(false);
    }
    expect(
      suggestCatalogSizeTier({
        title: "Epoxy Resin Ocean Wave Wall Clock",
        categorySlug: "resin-home-decor",
      }),
    ).toEqual({ tier: "MEDIUM_FORMAT", reason: "keyword", score: 6 });
    expect(
      suggestCatalogSizeTier({
        title: "Handmade Resin Art Real Flower Earrings",
        categorySlug: "festive-pooja",
      }),
    ).toEqual({ tier: "SMALL_FORMAT", reason: "keyword", score: 6 });
  });

  it("files a row that says nothing about its form under its category's tier", () => {
    expect(
      suggestCatalogSizeTier({
        title: "Kanku – Chawal",
        categorySlug: "festive-pooja",
      }),
    ).toEqual({ tier: "SMALL_FORMAT", reason: "category", score: 0 });
    expect(
      suggestCatalogSizeTier({
        title: "Ocean Wave Charcuterie Board",
        categorySlug: "resin-trays-serving-platters",
      }),
    ).toEqual({ tier: "MEDIUM_FORMAT", reason: "category", score: 0 });
    expect(
      suggestCatalogSizeTier({
        title: "Statue of Liberty 3D Printed Statue",
        categorySlug: "sculptures-objets",
      }),
    ).toEqual({ tier: "LARGE_FORMAT", reason: "category", score: 0 });
  });

  it("lets a decisive word in the row outrank the category when the row carries nothing for the category's tier", () => {
    // "ring tray" + "engagement" are Memory words; nothing scores Personal.
    expect(
      suggestCatalogSizeTier({
        title: "Engagement Ring Tray",
        categorySlug: "resin-jewelry-keychains",
      }),
    ).toEqual({ tier: "MEDIUM_FORMAT", reason: "keyword", score: 12 });
    expect(
      suggestCatalogSizeTier({
        title: "Wedding Flower Preservation Frame – Custom Resin Keepsake",
        categorySlug: "resin-jewelry-keychains",
      }),
    ).toMatchObject({ tier: "MEDIUM_FORMAT", reason: "keyword" });
    // Both spellings of the celebration word, the same answer.
    for (const title of ["Resin Pooja Thali", "Luxury Resin Puja Thali"]) {
      expect(
        suggestCatalogSizeTier({ title, categorySlug: "festive-pooja" }),
        title,
      ).toEqual({ tier: "MEDIUM_FORMAT", reason: "keyword", score: 6 });
    }
  });

  it("lets the category settle a row that carries a word for each side", () => {
    // "bouquet" is Memory (6), "candle" is Personal (4): a margin of 2, not
    // the decisive 6 — the owner filed it under candle holders, and that holds.
    expect(
      suggestCatalogSizeTier({
        title: "Handmade Floral Candle Bouquet",
        categorySlug: "candle-tea-light-holders",
      }),
    ).toEqual({ tier: "SMALL_FORMAT", reason: "category", score: 6 });
    // A 36-inch frame: the dimension push says Collectible (6), "frame"
    // says Memory (4). A big frame is still a frame.
    expect(
      suggestCatalogSizeTier({
        title: "Big Resin Mantra Frame",
        dimensions: "36 x 24 in",
        categorySlug: "wedding-photo-frames",
      }),
    ).toEqual({ tier: "MEDIUM_FORMAT", reason: "category", score: 6 });
  });

  it("lets a ≥ 60 cm side alone decide Collectible for a row with no category default", () => {
    expect(
      suggestCatalogSizeTier({
        title: "Ocean Resin Piece",
        dimensions: "48 x 24 in",
        categorySlug: "resin-home-decor",
      }),
    ).toEqual({
      tier: "LARGE_FORMAT",
      reason: "keyword",
      score: DECISIVE_SCORE,
    });
  });

  it("never scores the category NAME — the owner's filing enters once, through the slug", () => {
    // Were "Festive & Pooja" scored, "pooja" (6) would file this Memory.
    expect(
      suggestCatalogSizeTier({
        title: "Brass Diya",
        categorySlug: "resin-home-decor",
        categoryName: "Festive & Pooja",
      }),
    ).toEqual({ tier: null, reason: "none", score: 0 });
  });

  it("with no category default, a word of title strength decides Memory or Personal", () => {
    expect(
      suggestCatalogSizeTier({
        title: "Personalised Gift Box",
        categorySlug: "resin-home-decor",
      }),
    ).toEqual({
      tier: "SMALL_FORMAT",
      reason: "weak-keyword",
      score: WEAK_MIN_SCORE,
    });
    expect(
      suggestCatalogSizeTier({
        title: "Wooden Serving Tray",
        categorySlug: "resin-home-decor",
      }),
    ).toEqual({
      tier: "MEDIUM_FORMAT",
      reason: "weak-keyword",
      score: WEAK_MIN_SCORE,
    });
  });

  it("never decides Collectible on a weak word", () => {
    // "large" and "table" are Collectible's only supporting words: 4 here,
    // enough for Memory or Personal, never for the collectible card.
    expect(
      suggestCatalogSizeTier({
        title: "Large Table Runner",
        categorySlug: "resin-home-decor",
      }),
    ).toEqual({ tier: null, reason: "none", score: WEAK_MIN_SCORE });
  });

  it("leaves a row below title strength, or tied, for a person", () => {
    expect(
      suggestCatalogSizeTier({
        title: "Handmade Small Piece",
        categorySlug: "resin-home-decor",
      }),
    ).toEqual({ tier: null, reason: "none", score: 2 });
    expect(
      suggestCatalogSizeTier({
        title: "Gift Frame",
        categorySlug: "resin-home-decor",
      }),
    ).toEqual({ tier: null, reason: "tie", score: 4 });
    expect(
      suggestCatalogSizeTier({
        title: "Round placemats",
        categorySlug: "resin-home-decor",
      }),
    ).toEqual({ tier: null, reason: "none", score: 0 });
    expect(
      suggestCatalogSizeTier({ title: "Oreo Wafers", categorySlug: null }),
    ).toEqual({ tier: null, reason: "none", score: 0 });
  });
});

describe("the category tables", () => {
  it("file every large-format category as Collectible — one set, two readers", () => {
    for (const slug of LARGE_FORMAT_CATEGORY_SLUGS) {
      expect(CATEGORY_SIZE_TIER[slug], slug).toBe("LARGE_FORMAT");
    }
  });

  it("give no supplies category a tier", () => {
    for (const slug of SUPPLY_CATEGORY_SLUGS) {
      expect(CATEGORY_SIZE_TIER[slug], slug).toBeUndefined();
    }
  });

  it("leave the three mixed categories to the row's own words", () => {
    for (const slug of ["resin-home-decor", "resin-vases", "kids-room-decor"]) {
      expect(CATEGORY_SIZE_TIER[slug], slug).toBeUndefined();
    }
  });
});
