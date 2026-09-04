import { describe, expect, it } from "vitest";

import { SCRAPE_STAGES, shapeStageCounts } from "@/lib/scraper/stages";

describe("shapeStageCounts", () => {
  it("pairs every stage definition with its count, in pipeline order", () => {
    const shaped = shapeStageCounts({
      sources: 12,
      discovery: 3,
      scraping: 1,
      staged: 400,
      quality: 7,
      review: 40,
      approved: 5,
      imported: 2,
      confirmed: 1,
    });
    expect(shaped.map((s) => s.key)).toEqual(SCRAPE_STAGES.map((s) => s.key));
    expect(shaped.map((s) => s.count)).toEqual([12, 3, 1, 400, 7, 40, 5, 2, 1]);
  });

  it("reads a missing key as zero rather than throwing", () => {
    const shaped = shapeStageCounts({ sources: 5 });
    expect(shaped.find((s) => s.key === "sources")?.count).toBe(5);
    expect(shaped.find((s) => s.key === "confirmed")?.count).toBe(0);
  });

  it("shapes an entirely empty pipeline to all zeros", () => {
    const shaped = shapeStageCounts({});
    expect(shaped.every((s) => s.count === 0)).toBe(true);
    expect(shaped).toHaveLength(9);
  });

  it("carries the label and href from the definition, not the raw counts", () => {
    const shaped = shapeStageCounts({ review: 10 });
    const review = shaped.find((s) => s.key === "review");
    expect(review?.label).toBe("Review");
    expect(review?.href).toBe("/studio/scraper/review");
  });

  it("every stage has a distinct key and a non-empty href", () => {
    const keys = new Set(SCRAPE_STAGES.map((s) => s.key));
    expect(keys.size).toBe(SCRAPE_STAGES.length);
    for (const stage of SCRAPE_STAGES) {
      expect(stage.href.startsWith("/studio/")).toBe(true);
    }
  });
});
