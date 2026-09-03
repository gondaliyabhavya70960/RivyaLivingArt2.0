import type { TestimonialItem } from "@/lib/testimonials";

/** One schema.org `Review` node. */
export type ReviewJsonLd = {
  "@type": "Review";
  reviewRating: {
    "@type": "Rating";
    ratingValue: number;
    bestRating: 5;
    worstRating: 1;
  };
  author: { "@type": "Person"; name: string };
  reviewBody: string;
  itemReviewed: { "@type": "Product"; name: string };
  datePublished?: string;
};

export type AggregateRatingJsonLd = {
  "@type": "AggregateRating";
  ratingValue: number;
  reviewCount: number;
  bestRating: 5;
  worstRating: 1;
};

/**
 * `Review`/`AggregateRating` JSON-LD nodes for a product or case study page.
 *
 * Three gates, all of them, before a testimonial becomes structured data a
 * search engine will index as a genuine review:
 *
 *  - **PUBLISHED** — implicit rather than checked here. Every row this
 *    function is ever handed already came through `getTestimonials()`, whose
 *    query is `status: "PUBLISHED"` unconditionally (see `lib/testimonials.ts`)
 *    — there is no code path that hands this function a draft, a
 *    pending-review or an archived row. `TestimonialItem` carries no `status`
 *    field for exactly that reason: it would be redundant to check.
 *  - **`isDemo === false`** — a seeded fixture is marked on the page (Part 0's
 *    demo-content rule), and structured data is read by machines that never
 *    see that mark. Feeding Google a fabricated five-star review because a
 *    preview environment happened to have `demoContentPublic` on would be
 *    exactly the kind of invented proof the hard rules forbid.
 *  - **`permissionStatus === "GRANTED"`** — the same guard
 *    `describeTestimonialProblem` enforces before a row may even reach
 *    PUBLISHED, checked again here defensively: JSON-LD is machine-read
 *    structured data with its own audience (search engines, not the page's
 *    visitor), so it gets its own check rather than trusting a upstream
 *    invariant to hold forever.
 *
 * Returns `null` when nothing survives the filter — Product/CreativeWork
 * JSON-LD should carry no `review`/`aggregateRating` at all rather than an
 * empty array, which some validators read as a claim of zero reviews.
 */
export function reviewJsonld(
  items: TestimonialItem[],
  subjectName: string,
): { review: ReviewJsonLd[]; aggregateRating: AggregateRatingJsonLd } | null {
  const eligible = items.filter(
    (item) => !item.isDemo && item.permissionStatus === "GRANTED",
  );
  if (eligible.length === 0) return null;

  const review: ReviewJsonLd[] = eligible.map((item) => ({
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: item.rating,
      bestRating: 5,
      worstRating: 1,
    },
    author: { "@type": "Person", name: item.name },
    reviewBody: item.quote,
    itemReviewed: { "@type": "Product", name: subjectName },
    ...(item.givenAt ? { datePublished: item.givenAt.slice(0, 10) } : {}),
  }));

  const ratingValue =
    Math.round(
      (eligible.reduce((sum, item) => sum + item.rating, 0) / eligible.length) *
        10,
    ) / 10;

  return {
    review,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue,
      reviewCount: eligible.length,
      bestRating: 5,
      worstRating: 1,
    },
  };
}
