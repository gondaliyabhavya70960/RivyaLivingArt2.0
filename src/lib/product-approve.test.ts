import { describe, expect, it } from "vitest";

import { describeApproval, planProductApproval } from "./product-approve";

const row = (
  id: string,
  over: Partial<{
    needsRewrite: boolean;
    sizeTier: "LARGE_FORMAT" | "MEDIUM_FORMAT" | "SMALL_FORMAT" | null;
    status: string;
  }> = {},
) => ({
  id,
  needsRewrite: true,
  sizeTier: "MEDIUM_FORMAT" as const,
  status: "REVIEW",
  ...over,
});

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
        alreadyLive: 0,
        archived: 0,
      }).success,
    ).toBeNull();
  });
});
