import { describe, expect, it } from "vitest";

import {
  CONFIRMED_COLUMNS,
  canConfirm,
  describeConfirmBlockers,
  describeConfirmRefusal,
  type ConfirmCandidate,
} from "@/lib/scraper/confirm";

const READY: ConfirmCandidate = {
  title: "Premium Resin Ganesha",
  description: "Hand-poured, cured over a week.",
  showPrice: true,
  priceMin: 849,
  needsRewrite: false,
  imageCount: 3,
};

describe("describeConfirmBlockers", () => {
  it("passes a complete product", () => {
    expect(describeConfirmBlockers(READY)).toEqual([]);
    expect(canConfirm(READY)).toBe(true);
  });

  it("blocks a product with no images", () => {
    expect(describeConfirmBlockers({ ...READY, imageCount: 0 })).toEqual([
      "at least one image",
    ]);
  });

  it("blocks a product with no description", () => {
    expect(describeConfirmBlockers({ ...READY, description: "   " })).toEqual([
      "a description",
    ]);
  });

  it("blocks copy still awaiting rewrite", () => {
    // Confirming here would put the competitor's own prose on the final list.
    expect(
      describeConfirmBlockers({ ...READY, needsRewrite: true }),
    ).toContain("an editorial rewrite (still flagged)");
  });

  it("blocks a priced product with no price", () => {
    expect(
      describeConfirmBlockers({ ...READY, priceMin: null }),
    ).toEqual(["a price"]);
  });

  it("does NOT require a price when the product hides it", () => {
    // "Price on request" is a complete product, not an incomplete one.
    expect(
      describeConfirmBlockers({ ...READY, showPrice: false, priceMin: null }),
    ).toEqual([]);
  });

  it("names every blocker at once, not just the first", () => {
    // An operator fixing one thing at a time, told only about the next
    // failure each round, gives up.
    const blockers = describeConfirmBlockers({
      title: "",
      description: "",
      showPrice: true,
      priceMin: null,
      needsRewrite: true,
      imageCount: 0,
    });
    expect(blockers).toHaveLength(5);
  });
});

describe("describeConfirmRefusal", () => {
  it("says nothing when there is nothing to say", () => {
    expect(describeConfirmRefusal("Anything", [])).toBeNull();
  });

  it("reads as a sentence for one blocker", () => {
    expect(describeConfirmRefusal("Ganesha", ["a price"])).toBe(
      '"Ganesha" needs a price before it can be confirmed.',
    );
  });

  it("reads as a sentence for several", () => {
    expect(
      describeConfirmRefusal("Ganesha", ["a title", "a price", "a description"]),
    ).toBe(
      '"Ganesha" needs a title, a price and a description before it can be confirmed.',
    );
  });
});

describe("the confirmed sheet contract", () => {
  it("leads with Product ID — the stable reference in every other tab", () => {
    expect(CONFIRMED_COLUMNS[0]).toBe("Product ID");
  });

  it("carries the audit columns, so the tab says who blessed each row", () => {
    expect(CONFIRMED_COLUMNS).toContain("Confirmed At");
    expect(CONFIRMED_COLUMNS).toContain("Confirmed By");
  });
});
