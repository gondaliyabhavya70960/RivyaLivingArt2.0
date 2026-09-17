import { describe, expect, it } from "vitest";

import {
  describePortfolioPublishProblem,
  portfolioCoverUrl,
} from "./portfolio-rules";

describe("portfolioCoverUrl", () => {
  it("prefers the after image over the gallery", () => {
    expect(
      portfolioCoverUrl({
        afterImageUrl: "/uploads/after.jpg",
        images: [{ url: "/uploads/first.jpg" }],
      }),
    ).toBe("/uploads/after.jpg");
  });

  it("falls back to the FIRST gallery image", () => {
    expect(
      portfolioCoverUrl({
        afterImageUrl: null,
        images: [{ url: "/uploads/first.jpg" }, { url: "/uploads/second.jpg" }],
      }),
    ).toBe("/uploads/first.jpg");
  });

  it("treats an unrenderable src as no cover at all", () => {
    // `next/image` resolves site-root paths and absolute URLs; anything else
    // 404s at request time, which on the wall is a hole, not a photograph.
    expect(portfolioCoverUrl({ afterImageUrl: "", images: [] })).toBeNull();
    expect(
      portfolioCoverUrl({ afterImageUrl: null, images: [{ url: "cover.jpg" }] }),
    ).toBeNull();
    expect(
      portfolioCoverUrl({
        afterImageUrl: null,
        images: [{ url: "data:image/png;base64,iVBOR" }],
      }),
    ).toBeNull();
  });
});

describe("describePortfolioPublishProblem", () => {
  const coverless = { afterImageUrl: null, images: [] as { url: string }[] };

  it("refuses a move INTO published with no cover", () => {
    expect(
      describePortfolioPublishProblem({
        nextStatus: "PUBLISHED",
        previousStatus: "DRAFT",
        ...coverless,
      }),
    ).toMatch(/cover image/i);
  });

  it("refuses a brand-new published piece with no cover", () => {
    expect(
      describePortfolioPublishProblem({
        nextStatus: "PUBLISHED",
        previousStatus: null,
        ...coverless,
      }),
    ).not.toBeNull();
  });

  it("allows a save of a row that is ALREADY published", () => {
    // Transition-scoped, not state-scoped — the same shape as the size-tier
    // guard, so a rule added today cannot lock an owner out of editing a case
    // study that went live before it existed. `/portfolio` still renders such
    // a row: a text-only tile, never a blank cell.
    expect(
      describePortfolioPublishProblem({
        nextStatus: "PUBLISHED",
        previousStatus: "PUBLISHED",
        ...coverless,
      }),
    ).toBeNull();
  });

  it("never blocks a draft or an unpublish", () => {
    for (const nextStatus of ["DRAFT", "ARCHIVED"] as const) {
      expect(
        describePortfolioPublishProblem({
          nextStatus,
          previousStatus: "PUBLISHED",
          ...coverless,
        }),
      ).toBeNull();
    }
  });

  it("passes a piece that has a cover", () => {
    expect(
      describePortfolioPublishProblem({
        nextStatus: "PUBLISHED",
        previousStatus: "DRAFT",
        afterImageUrl: null,
        images: [{ url: "/uploads/first.jpg" }],
      }),
    ).toBeNull();
  });
});
