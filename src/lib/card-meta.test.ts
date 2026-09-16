import { describe, expect, it } from "vitest";

import {
  accessibleCardName,
  cardMetaLine,
  cardVariantFor,
  collectibleCardMeta,
} from "@/lib/card-meta";

describe("cardMetaLine", () => {
  it("joins materials and dimensions with the mono separator", () => {
    expect(
      cardMetaLine({
        materials: "Cast resin, brass inlay",
        dimensions: '8" x 10"',
      }),
    ).toBe('Cast resin, brass inlay · 8" x 10"');
  });

  it("renders just the half that is present", () => {
    expect(cardMetaLine({ materials: "Cast resin", dimensions: null })).toBe(
      "Cast resin",
    );
    expect(cardMetaLine({ materials: null, dimensions: '6" round' })).toBe(
      '6" round',
    );
  });

  it("is null when both are empty or blank", () => {
    expect(cardMetaLine({ materials: null, dimensions: null })).toBeNull();
    expect(cardMetaLine({ materials: "  ", dimensions: "" })).toBeNull();
  });
});

describe("accessibleCardName", () => {
  it("returns the full title, never truncated", () => {
    const longTitle =
      "Lord Khatu Shyam Ji Spiritual Puja Vastu Figurine – Resin LED Light Idol for Home Temple Decor";
    expect(accessibleCardName({ title: longTitle })).toBe(longTitle);
  });

  it("never contains an ellipsis, even though displayTitle may", () => {
    const cases = [
      "Lord Khatu Shyam Ji Spiritual Puja Vastu Figurine – Resin LED Light Idol for Home Temple Decor",
      "Short Name",
      "A very very very very very very very very very very long product title indeed",
    ];
    for (const title of cases) {
      const name = accessibleCardName({ title });
      expect(name).not.toContain("…");
      expect(name).not.toContain("...");
    }
  });
});

describe("cardVariantFor — the tier branch lives here, not in JSX", () => {
  it("gives the LARGE_FORMAT tier the collectible card", () => {
    expect(cardVariantFor({ sizeTier: "LARGE_FORMAT" })).toBe("collectible");
  });

  it("gives everything else the full card until step 8 builds memory and gift", () => {
    // MEDIUM and SMALL variants are docs/plan/07 step 8's; a variant name
    // the component does not render must not be returned before then.
    expect(cardVariantFor({ sizeTier: "MEDIUM_FORMAT" })).toBe("full");
    expect(cardVariantFor({ sizeTier: "SMALL_FORMAT" })).toBe("full");
    expect(cardVariantFor({ sizeTier: null })).toBe("full");
  });
});

describe("collectibleCardMeta", () => {
  const base = {
    categoryName: "Resin Furniture & Surfaces",
    materials: "Epoxy resin with solid teak",
    dimensions: "46cm diameter",
    inStock: true,
    showPrice: true,
    priceMin: 9499,
    priceMax: 9499,
  };

  it("carries the owner's words verbatim and a figure", () => {
    const meta = collectibleCardMeta(base);
    expect(meta.objectType).toBe("Resin Furniture & Surfaces");
    expect(meta.materials).toBe("Epoxy resin with solid teak");
    expect(meta.dimensions).toBe("46cm diameter");
    expect(meta.availability).toBe("madeToOrder");
    expect(meta.price).toEqual({ kind: "figure", label: "₹9,499" });
  });

  it("shows a band as a band, never as 'starting from'", () => {
    // A band's floor is not a starting price; a price TYPE is T3, open.
    const meta = collectibleCardMeta({ ...base, priceMax: 14999 });
    expect(meta.price.kind).toBe("range");
    if (meta.price.kind === "range") {
      expect(meta.price.label).toBe("₹9,499 – ₹14,999");
      expect(meta.price.label).not.toMatch(/from/i);
    }
  });

  it("is 'price on request' when there is no price to show", () => {
    // 36 of the 50 demo large-format rows: showPrice true, both nulls.
    expect(
      collectibleCardMeta({ ...base, priceMin: null, priceMax: null }).price,
    ).toEqual({ kind: "onRequest" });
    // And when the owner hid a price that exists.
    expect(collectibleCardMeta({ ...base, showPrice: false }).price).toEqual({
      kind: "onRequest",
    });
  });

  it("reads a floor with no ceiling as a figure", () => {
    expect(collectibleCardMeta({ ...base, priceMax: null }).price).toEqual({
      kind: "figure",
      label: "₹9,499",
    });
  });

  it("turns blank owner text into null so the card skips the row", () => {
    const meta = collectibleCardMeta({
      ...base,
      categoryName: "  ",
      materials: "",
      dimensions: "   ",
    });
    expect(meta.objectType).toBeNull();
    expect(meta.materials).toBeNull();
    expect(meta.dimensions).toBeNull();
  });

  it("reads inStock as the made-to-order fact (T5) and its absence as out of stock", () => {
    expect(collectibleCardMeta({ ...base, inStock: false }).availability).toBe(
      "outOfStock",
    );
  });

  it("never lets formatPriceBand's English 'Enquire' through (T6)", () => {
    const cases = [
      base,
      { ...base, priceMin: null, priceMax: null },
      { ...base, showPrice: false },
      { ...base, priceMin: null, priceMax: 5000 },
    ];
    for (const item of cases) {
      expect(JSON.stringify(collectibleCardMeta(item))).not.toContain("Enquire");
    }
  });
});
