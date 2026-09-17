import { describe, expect, it } from "vitest";

import {
  coverUrlOf,
  describePlaceholderPublishProblem,
  isPlaceholderAsset,
  looksLikePlaceholderAsset,
} from "./placeholder-assets";

describe("isPlaceholderAsset", () => {
  it("catches the Drive catalog library", () => {
    expect(
      isPlaceholderAsset("/redesign/catalog/heroes/product-hero-001-4x5.webp"),
    ).toBe(true);
    expect(
      isPlaceholderAsset("/redesign/catalog/scenes/product-scene-010-16x9.webp"),
    ).toBe(true);
  });

  it("LEAVES THE BRAND SET ALONE", () => {
    // The fifteen brand assets sit in /redesign/ but NOT under catalog/, and
    // they are publishable imagery — twelve site-image slots resolve to them.
    // A prefix of "/redesign/" instead of "/redesign/catalog/" would refuse
    // every product whose cover is the hero pour.
    for (const url of [
      "/redesign/hero-pour.jpg",
      "/redesign/texture-resin-flow.jpg",
      "/redesign/product-bangle.jpg",
      "/media/v3/tile-preserve.avif",
      "/uploads/owner-photo-9f8e7d.jpg",
      "https://cdn.example.com/product-hero-001-4x5.webp",
    ]) {
      expect(isPlaceholderAsset(url), url).toBe(false);
    }
  });

  it("is total over null and empty", () => {
    expect(isPlaceholderAsset(null)).toBe(false);
    expect(isPlaceholderAsset(undefined)).toBe(false);
    expect(isPlaceholderAsset("")).toBe(false);
  });
});

describe("looksLikePlaceholderAsset", () => {
  it("catches a re-uploaded placeholder that lost its path — and only warns", () => {
    // The documented gap, pinned as a decision rather than left as a surprise:
    // an owner who downloads a placeholder and re-uploads it gets a Blob URL,
    // so the PATH test cannot see it while the NAME test still can. The lint
    // uses this; no refusal ever does.
    const reuploaded =
      "https://abc.public.blob.vercel-storage.com/product-hero-001-4x5.webp";
    expect(isPlaceholderAsset(reuploaded)).toBe(false);
    expect(looksLikePlaceholderAsset(reuploaded)).toBe(true);
  });

  it("does not fire on an ordinary owner upload", () => {
    expect(looksLikePlaceholderAsset("/uploads/river-table-hero.jpg")).toBe(
      false,
    );
  });
});

describe("coverUrlOf", () => {
  it("picks the lowest order, not the first array entry", () => {
    expect(
      coverUrlOf([
        { url: "/b.jpg", order: 2 },
        { url: "/a.jpg", order: 0 },
        { url: "/c.jpg", order: 1 },
      ]),
    ).toBe("/a.jpg");
  });

  it("breaks ties by array position and survives a missing order", () => {
    expect(
      coverUrlOf([
        { url: "/first.jpg", order: 0 },
        { url: "/second.jpg", order: 0 },
      ]),
    ).toBe("/first.jpg");
    expect(coverUrlOf([{ url: "/only.jpg" }])).toBe("/only.jpg");
  });

  it("is total over empty and null", () => {
    expect(coverUrlOf([])).toBeNull();
    expect(coverUrlOf(null)).toBeNull();
    expect(coverUrlOf(undefined)).toBeNull();
  });
});

describe("describePlaceholderPublishProblem", () => {
  const placeholder = "/redesign/catalog/heroes/product-hero-001-4x5.webp";

  it("refuses a draft going live on a placeholder cover", () => {
    expect(
      describePlaceholderPublishProblem({
        nextStatus: "PUBLISHED",
        coverUrl: placeholder,
      }),
    ).toBeTruthy();
  });

  it("REFUSES A RE-SAVE OF AN ALREADY-PUBLISHED ROW — unlike the size-tier guard", () => {
    // This is the one deliberate divergence from
    // `describeSizeTierPublishProblem`, and the reason is a premise rather
    // than a principle. That guard exempts already-published rows because a
    // backlog of ~4,385 untiered products would otherwise have locked the
    // owner out of editing any of them. Here the backlog is zero — the
    // placeholders arrived with the ingestion and nothing points at one — so
    // exempting the published state would buy nothing and would leave the
    // hole open: publish clean, swap the cover, re-save.
    //
    // There is no `currentStatus` parameter at all, so there is nothing to
    // pass that could reopen it.
    expect(
      describePlaceholderPublishProblem({
        nextStatus: "PUBLISHED",
        coverUrl: placeholder,
      }),
    ).toBeTruthy();
  });

  it("always allows saving as something other than published", () => {
    for (const nextStatus of ["DRAFT", "ARCHIVED"] as const) {
      expect(
        describePlaceholderPublishProblem({ nextStatus, coverUrl: placeholder }),
        nextStatus,
      ).toBeNull();
    }
  });

  it("allows a real cover, and says nothing about a missing one", () => {
    expect(
      describePlaceholderPublishProblem({
        nextStatus: "PUBLISHED",
        coverUrl: "/uploads/real-piece.jpg",
      }),
    ).toBeNull();
    // An absent cover is `describeConfirmBlockers`' business, not this guard's.
    expect(
      describePlaceholderPublishProblem({
        nextStatus: "PUBLISHED",
        coverUrl: null,
      }),
    ).toBeNull();
  });

  it("speaks the owner's language, not the schema's", () => {
    const message = describePlaceholderPublishProblem({
      nextStatus: "PUBLISHED",
      coverUrl: placeholder,
    })!;
    expect(message).not.toMatch(/\/redesign|catalog\/|PUBLISHED|null/);
    expect(message.toLowerCase()).toContain("draft");
  });
});
