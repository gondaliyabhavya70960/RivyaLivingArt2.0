import { describe, expect, it } from "vitest";

import {
  accessibleCardName,
  cardMetaLine,
  cardVariantFor,
  collectibleCardMeta,
  giftCardMeta,
  memoryCardMeta,
  shelfVariant,
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

  it("gives MEDIUM the memory card and SMALL the gift card (step 8)", () => {
    expect(cardVariantFor({ sizeTier: "MEDIUM_FORMAT" })).toBe("memory");
    expect(cardVariantFor({ sizeTier: "SMALL_FORMAT" })).toBe("gift");
  });

  it("leaves the untiered backlog on the full card", () => {
    // ~4,385 rows carry no sizeTier. Giving them a tier variant would invent
    // the tier for every one of them; `full` is the variant that claims
    // nothing. This is the null check's purpose, not a gap in it.
    expect(cardVariantFor({ sizeTier: null })).toBe("full");
  });
});

describe("memoryCardMeta", () => {
  const base = {
    categoryName: "Varmala Preservation",
    variantChips: ["Colours +4", "Sizes S/M/L"],
    timeline: "3 weeks",
    inStock: true,
    showPrice: true,
    priceMin: 6499,
    priceMax: 6499,
  };

  it("counts the choices rather than carrying their strings", () => {
    // `variantChips` are hardcoded English built in shop.ts. The card must
    // never paint them; it gets a number and translates around it.
    const meta = memoryCardMeta(base);
    expect(meta.choices).toBe(2);
    expect(JSON.stringify(meta)).not.toContain("Colours");
  });

  it("carries the occasion and the lead time as written", () => {
    const meta = memoryCardMeta(base);
    expect(meta.occasion).toBe("Varmala Preservation");
    expect(meta.leadTime).toBe("3 weeks");
  });

  it("renders a row with no lead time and no choices", () => {
    const meta = memoryCardMeta({
      ...base,
      variantChips: [],
      timeline: "   ",
      categoryName: "",
    });
    expect(meta.choices).toBe(0);
    expect(meta.leadTime).toBeNull();
    expect(meta.occasion).toBeNull();
  });

  it("falls back to price-on-request, never to a bare English 'Enquire'", () => {
    // The T6 leak: formatPriceBand's hardcoded English must not reach a card.
    expect(memoryCardMeta({ ...base, showPrice: false }).price).toEqual({
      kind: "onRequest",
    });
    expect(memoryCardMeta({ ...base, priceMin: null }).price).toEqual({
      kind: "onRequest",
    });
  });

  it("reads out of stock from inStock, the one fulfilment fact (T5)", () => {
    expect(memoryCardMeta({ ...base, inStock: false }).availability).toBe(
      "outOfStock",
    );
  });
});

describe("giftCardMeta", () => {
  const base = {
    variantChips: ["Colours +6"],
    inStock: true,
    showPrice: true,
    priceMin: 499,
    priceMax: 1299,
  };

  it("keeps a price band a band", () => {
    expect(giftCardMeta(base).price.kind).toBe("range");
  });

  it("still resolves to on-request when the owner published no price", () => {
    // "Price visible" is how the tier is MEANT to be filled in, not something
    // the card can promise on a row that has no figure.
    expect(giftCardMeta({ ...base, showPrice: false }).price).toEqual({
      kind: "onRequest",
    });
  });

  it("counts choices the same way the memory card does", () => {
    expect(giftCardMeta(base).choices).toBe(1);
    expect(giftCardMeta({ ...base, variantChips: [] }).choices).toBe(0);
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

describe("shelfVariant — one ratio per grid, and the tier column outranks price", () => {
  const cheapPart = { showPrice: true, priceMin: 8, sizeTier: null };
  const cheapPiece = {
    showPrice: true,
    priceMin: 399,
    sizeTier: "SMALL_FORMAT" as const,
  };

  it("still goes compact for a shelf of untiered parts", () => {
    expect(shelfVariant(Array(10).fill(cheapPart))).toBe("compact");
  });

  it("stays full for cheap TIERED pieces — a ₹399 jhumka is not a bezel finding", () => {
    // Measured on the real catalogue: 373 of 425 published SMALL_FORMAT rows
    // are under ₹1,000, so the price heuristic alone sent the gift tier's own
    // grid compact and the gift variant could never render.
    expect(shelfVariant(Array(10).fill(cheapPiece))).toBe("full");
  });

  it("never compacts a large-format shelf, whatever it costs", () => {
    // All 12 published LARGE_FORMAT rows sit under ₹1,000 today. Large format
    // is the editorial tier by definition; a dense 1:1 supplies shelf is the
    // one thing it must never be.
    const large = { showPrice: true, priceMin: 500, sizeTier: "LARGE_FORMAT" as const };
    expect(shelfVariant(Array(8).fill(large))).toBe("full");
  });

  it("keeps a thin shelf full — under four priced rows decides nothing", () => {
    expect(shelfVariant(Array(3).fill(cheapPart))).toBe("full");
  });

  it("counts a mixed shelf by the untiered parts alone", () => {
    // 7 parts + 3 tiered pieces = 0.7 exactly, which still compacts; adding
    // one more piece drops it below the threshold.
    expect(
      shelfVariant([...Array(7).fill(cheapPart), ...Array(3).fill(cheapPiece)]),
    ).toBe("compact");
    expect(
      shelfVariant([...Array(7).fill(cheapPart), ...Array(4).fill(cheapPiece)]),
    ).toBe("full");
  });
});
