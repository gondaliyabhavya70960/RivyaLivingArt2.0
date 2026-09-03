import { describe, expect, it } from "vitest";

import { reviewJsonld } from "./review-jsonld";
import type { TestimonialItem } from "./testimonials";

function makeItem(overrides: Partial<TestimonialItem> = {}): TestimonialItem {
  return {
    id: "t1",
    name: "Priya Sharma",
    location: "Mumbai",
    quote: "Beautiful work.",
    rating: 5,
    avatarUrl: null,
    designation: null,
    productTitle: null,
    productSlug: null,
    portfolioSlug: null,
    installationImageUrl: null,
    videoUrl: null,
    videoPosterUrl: null,
    featured: false,
    isDemo: false,
    givenAt: "2026-01-15T00:00:00.000Z",
    permissionStatus: "GRANTED",
    ...overrides,
  };
}

describe("reviewJsonld", () => {
  it("returns null when there is nothing eligible", () => {
    expect(reviewJsonld([], "Varmala Frame")).toBeNull();
  });

  it("excludes demo rows even when permission is GRANTED", () => {
    const result = reviewJsonld(
      [makeItem({ isDemo: true, permissionStatus: "GRANTED" })],
      "Varmala Frame",
    );
    expect(result).toBeNull();
  });

  it("excludes rows without GRANTED permission", () => {
    for (const permissionStatus of [
      "UNKNOWN",
      "REQUESTED",
      "DECLINED",
    ] as const) {
      const result = reviewJsonld(
        [makeItem({ permissionStatus })],
        "Varmala Frame",
      );
      expect(result).toBeNull();
    }
  });

  it("builds Review + AggregateRating from eligible rows only", () => {
    const result = reviewJsonld(
      [
        makeItem({ id: "t1", rating: 5, permissionStatus: "GRANTED" }),
        makeItem({ id: "t2", rating: 3, permissionStatus: "GRANTED" }),
        makeItem({ id: "t3", rating: 1, permissionStatus: "DECLINED" }),
        makeItem({
          id: "t4",
          rating: 1,
          isDemo: true,
          permissionStatus: "GRANTED",
        }),
      ],
      "Varmala Frame",
    );

    expect(result).not.toBeNull();
    expect(result?.review).toHaveLength(2);
    expect(result?.review.map((r) => r.reviewRating.ratingValue)).toEqual([
      5, 3,
    ]);
    expect(result?.review[0]?.itemReviewed).toEqual({
      "@type": "Product",
      name: "Varmala Frame",
    });
    expect(result?.review[0]?.datePublished).toBe("2026-01-15");
    expect(result?.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4,
      reviewCount: 2,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("omits datePublished when givenAt is unset", () => {
    const result = reviewJsonld([makeItem({ givenAt: null })], "Varmala Frame");
    expect(result?.review[0]?.datePublished).toBeUndefined();
  });
});
