import { describe, expect, it } from "vitest";

import { ProductSizeTier } from "@/generated/prisma/enums";
import {
  describeSizeTierPublishProblem,
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_EXAMPLES,
  SIZE_TIER_FORM_VALUES,
  SIZE_TIER_NAME,
  SIZE_TIER_NUMBER,
  SIZE_TIER_OPTIONS,
  sizeTierFromFormValue,
  sizeTierStudioLabel,
  sizeTierToFormValue,
} from "@/lib/product-size-tier";

describe("the tier list is not a hand-written copy", () => {
  it("holds exactly the values the Prisma enum declares", () => {
    // THE ANTI-DRIFT GUARD, and it is here because the cost is recorded: the
    // scrape-tier list existed in five hand-written copies, and the fifth —
    // a `TIER_ORDER` array in the sources screen — is why three new tiers
    // shipped invisible. Adding a value to schema.prisma and forgetting this
    // module must fail a test, not a screen.
    expect([...PRODUCT_SIZE_TIERS].sort()).toEqual(
      Object.values(ProductSizeTier).sort(),
    );
  });

  it("gives every tier a customer name, an examples line and a number", () => {
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(SIZE_TIER_NAME[tier]).toBeTruthy();
      expect(SIZE_TIER_EXAMPLES[tier]).toBeTruthy();
      expect(SIZE_TIER_NUMBER[tier]).toBeGreaterThan(0);
    }
  });

  it("numbers them large → small, which is the owner's own order", () => {
    expect(PRODUCT_SIZE_TIERS.map((t) => SIZE_TIER_NUMBER[t])).toEqual([
      1, 2, 3,
    ]);
  });

  it("offers every tier in the studio select, plus the null sentinel", () => {
    expect(SIZE_TIER_OPTIONS.map((o) => o.value)).toEqual([
      "none",
      ...PRODUCT_SIZE_TIERS,
    ]);
    const labels = SIZE_TIER_OPTIONS.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("labels a tier with both vocabularies at once", () => {
    // "Tier 1" is what the owner says; the second half is what a customer
    // reads. A studio label that carried only one of them would make the
    // other untranslatable at the point of choosing.
    expect(sizeTierStudioLabel("LARGE_FORMAT")).toBe(
      "Tier 1 — Collectible Furniture & Spatial Art",
    );
    expect(sizeTierStudioLabel("SMALL_FORMAT")).toBe(
      "Tier 3 — Personal Art & Gifting",
    );
  });
});

describe("form value ↔ column value", () => {
  it("round-trips every tier", () => {
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(sizeTierFromFormValue(sizeTierToFormValue(tier))).toBe(tier);
    }
  });

  it("maps null to the sentinel and back, because a select cannot hold null", () => {
    expect(sizeTierToFormValue(null)).toBe("none");
    expect(sizeTierToFormValue(undefined)).toBe("none");
    expect(sizeTierFromFormValue("none")).toBeNull();
  });

  it("offers exactly the values the select offers", () => {
    expect([...SIZE_TIER_FORM_VALUES]).toEqual(
      SIZE_TIER_OPTIONS.map((o) => o.value),
    );
  });
});

describe("describeSizeTierPublishProblem", () => {
  it("refuses a draft going live without a tier", () => {
    expect(
      describeSizeTierPublishProblem({
        nextStatus: "PUBLISHED",
        currentStatus: "DRAFT",
        sizeTier: null,
      }),
    ).toMatch(/tier before publishing/i);
  });

  it("refuses a brand-new product published straight away", () => {
    expect(
      describeSizeTierPublishProblem({
        nextStatus: "PUBLISHED",
        currentStatus: null,
        sizeTier: null,
      }),
    ).toBeTruthy();
  });

  it("ALLOWS saving a product that is already published", () => {
    // The load-bearing case. This column is new, so all ~4,385 rows in the
    // catalogue are untiered; refusing this would stop the owner editing any
    // of them — a guardrail that turns into a lockout, with no bulk tool yet
    // built to clear the backlog. Nothing NEW goes live untiered; what is
    // already live keeps saving.
    expect(
      describeSizeTierPublishProblem({
        nextStatus: "PUBLISHED",
        currentStatus: "PUBLISHED",
        sizeTier: null,
      }),
    ).toBeNull();
  });

  it("allows a tiered product to publish", () => {
    expect(
      describeSizeTierPublishProblem({
        nextStatus: "PUBLISHED",
        currentStatus: "DRAFT",
        sizeTier: "MEDIUM_FORMAT",
      }),
    ).toBeNull();
  });

  it("allows an untiered product to stay a draft, or be archived", () => {
    for (const nextStatus of ["DRAFT", "REVIEW", "ARCHIVED"] as const) {
      expect(
        describeSizeTierPublishProblem({
          nextStatus,
          currentStatus: "DRAFT",
          sizeTier: null,
        }),
      ).toBeNull();
    }
  });

  it("names the three worlds rather than the enum", () => {
    // The message an owner reads should be the vocabulary they chose, not
    // LARGE_FORMAT — every other refusal in this studio reads that way.
    const message = describeSizeTierPublishProblem({
      nextStatus: "PUBLISHED",
      currentStatus: "DRAFT",
      sizeTier: null,
    });
    expect(message).not.toMatch(/_FORMAT/);
  });
});
