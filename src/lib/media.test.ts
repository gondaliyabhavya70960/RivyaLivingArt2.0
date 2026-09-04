import { describe, expect, it } from "vitest";

import {
  deriveOrientation,
  formatBytes,
  formatDuration,
  isSizeBand,
  SIZE_BANDS,
  usageLink,
} from "./media";

describe("formatBytes", () => {
  it("shows KB under a megabyte, rounded and never zero", () => {
    expect(formatBytes(500)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("shows MB with one decimal at and above a megabyte", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});

describe("formatDuration", () => {
  it("formats whole seconds as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3661)).toBe("61:01");
  });

  it("is null for anything that is not a captured duration", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });
});

describe("deriveOrientation", () => {
  it("classifies wide, tall and equal frames", () => {
    expect(deriveOrientation(1600, 900)).toBe("landscape");
    expect(deriveOrientation(900, 1600)).toBe("portrait");
    expect(deriveOrientation(1000, 1000)).toBe("square");
  });

  it("is null when either dimension is unknown", () => {
    expect(deriveOrientation(null, 900)).toBeNull();
    expect(deriveOrientation(1600, null)).toBeNull();
    expect(deriveOrientation(null, null)).toBeNull();
  });
});

describe("SIZE_BANDS / isSizeBand", () => {
  it("covers every byte count from zero upward with no gap", () => {
    for (let i = 1; i < SIZE_BANDS.length; i++) {
      expect(SIZE_BANDS[i].min).toBe(SIZE_BANDS[i - 1].max);
    }
    expect(SIZE_BANDS[0].min).toBe(0);
    expect(SIZE_BANDS[SIZE_BANDS.length - 1].max).toBeNull();
  });

  it("accepts a real band and rejects anything else", () => {
    expect(isSizeBand("medium")).toBe(true);
    expect(isSizeBand("huge")).toBe(false);
    expect(isSizeBand("")).toBe(false);
  });
});

describe("usageLink", () => {
  it("maps a known label prefix to its studio surface", () => {
    expect(usageLink("Product gallery ×3")).toBe("/studio/products");
    expect(usageLink("Site image · home.hero")).toBe("/studio/site-images");
    expect(usageLink("Blog post · A long post title")).toBe("/studio/blog");
  });

  it("is null for a label with no mapped surface", () => {
    expect(usageLink("Research · Some note")).toBeNull();
    expect(usageLink("")).toBeNull();
  });
});
