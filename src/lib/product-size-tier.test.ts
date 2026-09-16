import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ProductSizeTier } from "@/generated/prisma/enums";
import {
  describeSizeTierPublishProblem,
  parseSizeTierCell,
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_CELL_VALUES,
  SIZE_TIER_EXAMPLES,
  SIZE_TIER_SHORT,
  SIZE_TIER_FORM_VALUES,
  SIZE_TIER_NAME,
  SIZE_TIER_NUMBER,
  SIZE_TIER_OPTIONS,
  SIZE_TIER_SLUG,
  sizeTierFromFormValue,
  sizeTierFromSlug,
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
      expect(SIZE_TIER_SHORT[tier]).toBeTruthy();
      expect(SIZE_TIER_NUMBER[tier]).toBeGreaterThan(0);
    }
  });

  it("keeps the short labels to one word, which is why they exist", () => {
    // They exist because the four-word names pushed /studio/products to
    // 1450px in a 1440px viewport and the studio audit failed the route.
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(SIZE_TIER_SHORT[tier].split(/\s+/)).toHaveLength(1);
    }
    expect(new Set(Object.values(SIZE_TIER_SHORT)).size).toBe(
      PRODUCT_SIZE_TIERS.length,
    );
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

  it("ships the customer names to the storefront under ProductTier.<tier>, byte for byte", () => {
    // The sixth-copy guard this file's header asks for. SIZE_TIER_NAME is
    // the studio's copy and the canonical English; the storefront reads the
    // same words through next-intl from messages/en.json (workstream E step
    // 5, one nested block keyed by the enum value so a consumer can write
    // t(`${tier}.name`) with no mapping table). The two are typed by hand
    // in two files, and this is what stops them drifting apart silently.
    const en = JSON.parse(
      readFileSync(join(process.cwd(), "messages/en.json"), "utf8"),
    ) as {
      ProductTier: Record<
        string,
        { name: string; shortName: string; promise: string; primaryCta: string; secondaryCta: string }
      >;
    };
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(en.ProductTier[tier]?.name).toBe(SIZE_TIER_NAME[tier]);
      expect(en.ProductTier[tier]?.shortName).toBe(SIZE_TIER_SHORT[tier]);
      expect(en.ProductTier[tier]?.promise).toBeTruthy();
      expect(en.ProductTier[tier]?.primaryCta).toBeTruthy();
      expect(en.ProductTier[tier]?.secondaryCta).toBeTruthy();
    }
    // Part 0 / T1: Tier 03 is fast ORDERING through WhatsApp. No cart, no
    // checkout, no basket — in any tier's copy.
    const every = Object.values(en.ProductTier).flatMap((t) => Object.values(t));
    for (const value of every) {
      expect(value).not.toMatch(/\b(cart|checkout|basket|bag|buy now|pay)\b/i);
    }
  });

  it("gives every tier one lowercase URL slug, and reads only that spelling back", () => {
    // The shop facet's `?sizeTier=` value (docs/plan/07 step 8). Customer
    // words, derived from the enum so the list still lives once.
    expect(PRODUCT_SIZE_TIERS.map((t) => SIZE_TIER_SLUG[t])).toEqual([
      "large",
      "medium",
      "small",
    ]);
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(sizeTierFromSlug(SIZE_TIER_SLUG[tier])).toBe(tier);
    }
    // An unknown value is ignored, not errored, and the enum spelling is
    // deliberately NOT a second public one.
    for (const value of ["", undefined, null, "LARGE_FORMAT", "Large", "NONE", "__proto__"]) {
      expect(sizeTierFromSlug(value)).toBeUndefined();
    }
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

describe("parseSizeTierCell — the Bulk Import column", () => {
  it("takes the short word, which is what an owner types", () => {
    expect(parseSizeTierCell("LARGE")).toBe("LARGE_FORMAT");
    expect(parseSizeTierCell("medium")).toBe("MEDIUM_FORMAT");
    expect(parseSizeTierCell("  Small  ")).toBe("SMALL_FORMAT");
  });

  it("takes the full enum name too, for a re-imported export", () => {
    // The confirmed export writes `product_tier` as the enum name, and the
    // whole point of that column is that the file can be edited in a
    // spreadsheet and fed straight back through Bulk Import.
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(parseSizeTierCell(tier)).toBe(tier);
      expect(parseSizeTierCell(tier.toLowerCase())).toBe(tier);
    }
  });

  it("normalises a space or a hyphen, which a spreadsheet will produce", () => {
    expect(parseSizeTierCell("large format")).toBe("LARGE_FORMAT");
    expect(parseSizeTierCell("SMALL-FORMAT")).toBe("SMALL_FORMAT");
  });

  it("returns null for empty, which the importer reads as 'no opinion'", () => {
    // Load-bearing: an empty cell must NOT clear a tier the owner set in the
    // studio, so the importer omits the field entirely when this is null.
    expect(parseSizeTierCell("")).toBeNull();
    expect(parseSizeTierCell("   ")).toBeNull();
    expect(parseSizeTierCell(undefined)).toBeNull();
    expect(parseSizeTierCell(null)).toBeNull();
  });

  it("returns null for a value it does not recognise, rather than guessing", () => {
    expect(parseSizeTierCell("huge")).toBeNull();
    expect(parseSizeTierCell("1")).toBeNull();
    expect(parseSizeTierCell("XL_FORMAT")).toBeNull();
  });

  it("advertises every spelling it accepts", () => {
    for (const tier of PRODUCT_SIZE_TIERS) {
      expect(SIZE_TIER_CELL_VALUES).toContain(tier);
      expect(SIZE_TIER_CELL_VALUES).toContain(tier.replace("_FORMAT", ""));
    }
  });
});
