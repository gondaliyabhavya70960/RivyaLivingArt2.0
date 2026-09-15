import { describe, expect, it } from "vitest";

import {
  AUTOMATABLE_SOURCE_WHERE,
  describePolicyBadge,
  describeUnauthorizedRun,
  isAutomatable,
} from "./policy";

/**
 * The property that matters most here is the DEFAULT one: a source nobody has
 * reviewed must refuse. Every existing row in production got `PENDING` from the
 * migration, so if this gate let PENDING through it would have been decorative
 * from the moment it shipped — 115 sources crawlable exactly as before, with a
 * column claiming otherwise.
 */
describe("describeUnauthorizedRun", () => {
  it("allows only a reviewed, HTTP source", () => {
    expect(
      describeUnauthorizedRun("Sumaiya Resin", {
        collectionMode: "HTTP",
        policyReviewStatus: "APPROVED",
      }),
    ).toBeNull();
  });

  it("refuses an unreviewed source, and says where to clear it", () => {
    const message = describeUnauthorizedRun("Sumaiya Resin", {
      collectionMode: "HTTP",
      policyReviewStatus: "PENDING",
    });
    expect(message).not.toBeNull();
    expect(message).toMatch(/robots\.txt/);
    expect(message).toMatch(/source page/);
  });

  it("refuses a source reviewed and blocked, quoting the reviewer", () => {
    const message = describeUnauthorizedRun("Poonam Shah Art", {
      collectionMode: "HTTP",
      policyReviewStatus: "BLOCKED",
      policyReviewNote: "Terms forbid automated access.",
    });
    expect(message).toMatch(/may NOT be collected/);
    expect(message).toMatch(/Terms forbid automated access\./);
  });

  it("refuses manual-research BEFORE it looks at the review status", () => {
    // A source with no automated path does not become crawlable by being
    // approved, and "record a review" would send the owner to the wrong
    // control — they already made the decision, in the other field.
    const message = describeUnauthorizedRun("Poonam Shah Art", {
      collectionMode: "MANUAL_RESEARCH",
      policyReviewStatus: "APPROVED",
    });
    expect(message).toMatch(/manual research/);
    expect(message).not.toMatch(/has not had a policy review/);
  });

  it("still refuses manual-research when the review is blocked too", () => {
    expect(
      describeUnauthorizedRun("Poonam Shah Art", {
        collectionMode: "MANUAL_RESEARCH",
        policyReviewStatus: "BLOCKED",
      }),
    ).toMatch(/manual research/);
  });

  it("leaves a blank note out rather than trailing an empty sentence", () => {
    const message = describeUnauthorizedRun("Somewhere", {
      collectionMode: "HTTP",
      policyReviewStatus: "BLOCKED",
      policyReviewNote: "   ",
    });
    expect(message).not.toMatch(/Recorded reason/);
  });
});

describe("isAutomatable", () => {
  it.each([
    ["approved HTTP", { collectionMode: "HTTP", policyReviewStatus: "APPROVED" }, true],
    ["pending HTTP", { collectionMode: "HTTP", policyReviewStatus: "PENDING" }, false],
    ["blocked HTTP", { collectionMode: "HTTP", policyReviewStatus: "BLOCKED" }, false],
    [
      "approved manual research",
      { collectionMode: "MANUAL_RESEARCH", policyReviewStatus: "APPROVED" },
      false,
    ],
  ] as const)("%s → %s", (_label, state, expected) => {
    expect(isAutomatable(state)).toBe(expected);
  });
});

describe("AUTOMATABLE_SOURCE_WHERE", () => {
  it("is the same rule the message function applies", () => {
    // The fan-out filters in SQL and the single-source path calls the
    // function. If these two ever disagree, the tier buttons queue jobs the
    // Scrape button would refuse — so the clause is pinned against the
    // predicate rather than written out twice and hoped about.
    expect(isAutomatable(AUTOMATABLE_SOURCE_WHERE)).toBe(true);
  });
});

describe("describePolicyBadge", () => {
  it("names WHICH refusal it is, rather than always saying unreviewed", () => {
    // A source reviewed and blocked is not the same as one nobody looked at,
    // and a table with one badge for both would be telling the owner something
    // untrue about a decision they made themselves.
    expect(
      describePolicyBadge({
        collectionMode: "HTTP",
        policyReviewStatus: "BLOCKED",
      }),
    ).toBe("Not allowed");
    expect(
      describePolicyBadge({
        collectionMode: "MANUAL_RESEARCH",
        policyReviewStatus: "PENDING",
      }),
    ).toBe("Manual research");
    expect(
      describePolicyBadge({
        collectionMode: "HTTP",
        policyReviewStatus: "PENDING",
      }),
    ).toBe("No policy review");
  });

  it("is null exactly when a run is allowed", () => {
    expect(describePolicyBadge(AUTOMATABLE_SOURCE_WHERE)).toBeNull();
  });
});
