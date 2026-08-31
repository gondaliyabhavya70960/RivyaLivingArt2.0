import { describe, expect, it } from "vitest";

import {
  CHECKED_FIELDS,
  describeFieldFailures,
  resolvedFields,
  type ExtractedProduct,
} from "@/lib/scraper/validation";

const CLEAN: ExtractedProduct = {
  title: "Premium Resin Ganesha",
  description: "Hand-poured.",
  priceMin: 849,
  priceMax: null,
  images: ["a.jpg", "b.jpg"],
  category: "Idols",
};

describe("describeFieldFailures", () => {
  it("reports nothing for a complete extraction", () => {
    expect(describeFieldFailures(CLEAN)).toEqual([]);
  });

  it("flags a missing title as an ERROR — the row is unusable", () => {
    const [f] = describeFieldFailures({ ...CLEAN, title: "   " });
    expect(f.field).toBe("title");
    expect(f.severity).toBe("ERROR");
  });

  it("flags no images as an ERROR", () => {
    const [f] = describeFieldFailures({ ...CLEAN, images: [] });
    expect(f.field).toBe("images");
    expect(f.severity).toBe("ERROR");
  });

  it("flags a missing price as a WARNING, not an error", () => {
    // A price-on-request product is thin, not broken.
    const [f] = describeFieldFailures({
      ...CLEAN,
      priceMin: null,
      priceMax: null,
    });
    expect(f.field).toBe("price");
    expect(f.severity).toBe("WARNING");
  });

  it("accepts a product priced only by its ceiling", () => {
    expect(
      describeFieldFailures({ ...CLEAN, priceMin: null, priceMax: 1200 }),
    ).toEqual([]);
  });

  it("treats a non-array images value as no images", () => {
    // `images` is a JSON column; a malformed blob must read as zero, not crash.
    expect(
      describeFieldFailures({ ...CLEAN, images: null }).map((f) => f.field),
    ).toContain("images");
    expect(
      describeFieldFailures({ ...CLEAN, images: "oops" }).map((f) => f.field),
    ).toContain("images");
  });

  it("reports every failure at once", () => {
    const all = describeFieldFailures({
      title: "",
      description: null,
      priceMin: null,
      priceMax: null,
      images: [],
      category: null,
    });
    expect(all.map((f) => f.field).sort()).toEqual(
      [...CHECKED_FIELDS].sort(),
    );
  });

  it("does NOT flag fields most storefronts never publish", () => {
    // Flagging tagline/timeline/dimensions would bury the failures that matter
    // under tens of thousands that do not.
    const fields = describeFieldFailures(CLEAN).map((f) => f.field);
    expect(fields).not.toContain("shortTagline");
    expect(fields).not.toContain("timeline");
    expect(fields).not.toContain("dimensions");
  });
});

describe("resolvedFields", () => {
  it("returns every checked field for a clean product", () => {
    expect(resolvedFields(CLEAN).sort()).toEqual([...CHECKED_FIELDS].sort());
  });

  it("omits the fields that are still failing", () => {
    const resolved = resolvedFields({ ...CLEAN, images: [] });
    expect(resolved).not.toContain("images");
    expect(resolved).toContain("price");
  });

  it("returns nothing when everything failed", () => {
    expect(
      resolvedFields({
        title: "",
        description: null,
        priceMin: null,
        priceMax: null,
        images: [],
        category: null,
      }),
    ).toEqual([]);
  });
});
