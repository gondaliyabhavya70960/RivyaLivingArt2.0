import { describe, expect, it } from "vitest";

import { accessibleCardName, cardMetaLine } from "@/lib/card-meta";

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
