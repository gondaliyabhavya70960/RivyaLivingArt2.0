import { describe, expect, it } from "vitest";

import { describeApproval, planProductApproval } from "./product-approve";

const row = (
  id: string,
  over: Partial<{
    needsRewrite: boolean;
    sizeTier: "LARGE_FORMAT" | "MEDIUM_FORMAT" | "SMALL_FORMAT" | null;
    status: string;
    coverUrl: string | null;
  }> = {},
) => ({
  id,
  needsRewrite: true,
  sizeTier: "MEDIUM_FORMAT" as const,
  status: "REVIEW",
  coverUrl: "/uploads/a-real-photograph.jpg",
  ...over,
});

const PLACEHOLDER = "/redesign/catalog/heroes/product-hero-001-4x5.webp";

describe("planProductApproval", () => {
  it("clears the guard on every row and publishes the ones that can go live", () => {
    const plan = planProductApproval([
      row("a"),
      row("b", { status: "DRAFT" }),
      row("c", { needsRewrite: false }),
    ]);
    expect(plan.reviewIds).toEqual(["a", "b", "c"]);
    expect(plan.publishIds).toEqual(["a", "b", "c"]);
    expect(plan.untieredIds).toEqual([]);
    expect(plan.alreadyLive).toBe(0);
    expect(plan.archived).toBe(0);
  });

  it("holds an untiered row back from publish — the same guard as Publish", () => {
    const plan = planProductApproval([
      row("a", { sizeTier: null }),
      row("b"),
    ]);
    expect(plan.reviewIds).toEqual(["a", "b"]);
    expect(plan.publishIds).toEqual(["b"]);
    expect(plan.untieredIds).toEqual(["a"]);
  });

  it("leaves a live row live and an archived row archived, guard cleared on both", () => {
    const plan = planProductApproval([
      row("live", { status: "PUBLISHED", sizeTier: null }),
      row("gone", { status: "ARCHIVED" }),
    ]);
    expect(plan.reviewIds).toEqual(["live", "gone"]);
    expect(plan.publishIds).toEqual([]);
    // An already-live untiered row is not "untiered" for the report: the
    // transition guard does not apply to a row that is not transitioning.
    expect(plan.untieredIds).toEqual([]);
    expect(plan.alreadyLive).toBe(1);
    expect(plan.archived).toBe(1);
  });

  it("an empty target plans nothing", () => {
    expect(planProductApproval([])).toEqual({
      reviewIds: [],
      publishIds: [],
      untieredIds: [],
      placeholderIds: [],
      alreadyLive: 0,
      archived: 0,
    });
  });
});

describe("describeApproval", () => {
  it("names every hold with its remedy, never a bare skipped count", () => {
    const { success, holds } = describeApproval({
      approved: 266,
      published: 250,
      untiered: 12,
      placeholder: 0,
      alreadyLive: 3,
      archived: 1,
    });
    expect(success).toBe("Approved 266 products — 250 products published.");
    expect(holds).toHaveLength(3);
    expect(holds[0]).toMatch(/^12 products have no product tier/);
    expect(holds[0]).toMatch(/set a tier, then Publish/);
    expect(holds[1]).toMatch(/^1 archived product stays archived/);
    expect(holds[2]).toBe("3 products were already live.");
  });

  it("singular forms and the no-publish case", () => {
    const { success, holds } = describeApproval({
      approved: 1,
      published: 0,
      untiered: 1,
      placeholder: 0,
      alreadyLive: 0,
      archived: 0,
    });
    expect(success).toBe("Approved 1 product.");
    expect(holds).toEqual([
      "1 product has no product tier and stays unpublished — set a tier, then Publish.",
    ]);
  });

  it("nothing approved means no success line", () => {
    expect(
      describeApproval({
        approved: 0,
        published: 0,
        untiered: 0,
      placeholder: 0,
        alreadyLive: 0,
        archived: 0,
      }).success,
    ).toBeNull();
  });
});

describe("planProductApproval · the placeholder cover guard", () => {
  it("holds a row whose cover is still a concept placeholder", () => {
    const plan = planProductApproval([
      row("real"),
      row("concept", { coverUrl: PLACEHOLDER }),
    ]);
    // Approve always clears the rewrite guard — the owner DID read the copy,
    // which is the act Approve records. It is publishing that is held.
    expect(plan.reviewIds).toEqual(["real", "concept"]);
    expect(plan.publishIds).toEqual(["real"]);
    expect(plan.placeholderIds).toEqual(["concept"]);
  });

  it("lets the untiered hold win when a row trips both", () => {
    // Stated as a decision, not left to branch order: the toast names one hold
    // per row, and Publish applies its guards rewrite → tier → cover.
    const plan = planProductApproval([
      row("both", { sizeTier: null, coverUrl: PLACEHOLDER }),
    ]);
    expect(plan.untieredIds).toEqual(["both"]);
    expect(plan.placeholderIds).toEqual([]);
  });

  it("does not hold the brand set — only /redesign/catalog/", () => {
    const plan = planProductApproval([
      row("brand", { coverUrl: "/redesign/hero-pour.jpg" }),
    ]);
    expect(plan.publishIds).toEqual(["brand"]);
    expect(plan.placeholderIds).toEqual([]);
  });
});

describe("describeApproval · the placeholder hold", () => {
  it("names the count and the fix", () => {
    const { holds } = describeApproval({
      approved: 3,
      published: 2,
      untiered: 0,
      placeholder: 1,
      alreadyLive: 0,
      archived: 0,
    });
    const line = holds.find((h) => h.includes("concept placeholder"));
    expect(line).toBeTruthy();
    expect(line).toContain("photograph");
  });
});
