import { describe, expect, it } from "vitest";

import {
  buildProductWhere,
  parseProductListFilter,
  STALE_PRODUCT_DAYS,
} from "@/components/studio/products/product-filter";
import {
  buildActionQueue,
  STALE_INQUIRY_HOURS,
  staleInquiryWhere,
  type ActionQueueCounts,
} from "./action-queue";

const EMPTY: ActionQueueCounts = {
  staleInquiries: 0,
  publishedNoImage: 0,
  publishedPlaceholder: 0,
  publishedNeedsRewrite: 0,
  staleDrafts: 0,
};

describe("buildActionQueue", () => {
  it("builds NOTHING when nothing is waiting", () => {
    // Part 9: "a panel with nothing in it is never constructed". A queue that
    // always shows six rows teaches an owner to stop reading it.
    expect(buildActionQueue(EMPTY)).toEqual([]);
  });

  it("drops only the zero cards, keeping the rest in order", () => {
    const cards = buildActionQueue({
      ...EMPTY,
      staleInquiries: 3,
      publishedNeedsRewrite: 12,
    });
    expect(cards.map((c) => c.key)).toEqual([
      "staleInquiries",
      "publishedNeedsRewrite",
    ]);
    expect(cards.map((c) => c.count)).toEqual([3, 12]);
  });

  it("every card links to the LIST OF THE ROWS IT COUNTED", () => {
    // The whole point of the band. A card that says 27 and opens a list of
    // 4,399 spends the owner's trust and their time at once — so each href is
    // pinned to the filter whose where-clause the Overview counts.
    const byKey = Object.fromEntries(
      buildActionQueue({
        staleInquiries: 1,
        publishedNoImage: 1,
        publishedPlaceholder: 1,
        publishedNeedsRewrite: 1,
        staleDrafts: 1,
      }).map((c) => [c.key, c.href]),
    );
    expect(byKey.staleInquiries).toBe("/studio/inquiries?stale=1");
    expect(byKey.publishedNoImage).toBe(
      "/studio/products?status=PUBLISHED&media=none",
    );
    expect(byKey.publishedPlaceholder).toBe(
      "/studio/products?status=PUBLISHED&media=placeholder",
    );
    expect(byKey.publishedNeedsRewrite).toBe(
      "/studio/products?status=PUBLISHED&rewrite=flagged",
    );
    expect(byKey.staleDrafts).toBe("/studio/products?status=DRAFT&stale=30d");
  });

  it("each product href parses back into the filter it was built from", () => {
    for (const card of buildActionQueue({
      ...EMPTY,
      publishedNoImage: 1,
      staleDrafts: 1,
    })) {
      const url = new URL(card.href, "http://studio.test");
      if (url.pathname !== "/studio/products") continue;
      const filter = parseProductListFilter(
        Object.fromEntries(url.searchParams),
      );
      expect(Object.keys(filter).length).toBeGreaterThan(0);
    }
  });
});

describe("the two age windows", () => {
  const NOW = new Date("2026-09-17T12:00:00.000Z");

  it("a late first reply is a STATUS clause as well as an age one", () => {
    // An answered inquiry is not late however old it is.
    const where = staleInquiryWhere(NOW);
    expect(where.status).toBe("NEW");
    expect(where.createdAt.lt.toISOString()).toBe("2026-09-16T12:00:00.000Z");
    expect(STALE_INQUIRY_HOURS).toBe(24);
  });

  it("a stale draft is 30 days of no edit, measured from the caller's clock", () => {
    const where = buildProductWhere({ status: "DRAFT", stale: "30d" }, NOW);
    expect(where).toMatchObject({ status: "DRAFT" });
    const cutoff = (where.updatedAt as { lt: Date }).lt;
    expect(cutoff.toISOString()).toBe("2026-08-18T12:00:00.000Z");
    expect(STALE_PRODUCT_DAYS).toBe(30);
  });

  it("leaves updatedAt alone when nobody asked for stale rows", () => {
    expect(buildProductWhere({ status: "DRAFT" }, NOW)).not.toHaveProperty(
      "updatedAt",
    );
  });
});
