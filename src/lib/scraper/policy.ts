/**
 * May we crawl this source at all?
 *
 * A REGISTERED SOURCE IS NOT AN AUTHORISED ONE. `ScrapeSource` is a list of
 * places the owner is interested in — 115 of them, curated by hand — and until
 * now the only thing standing between a row in that list and an HTTP request
 * was `enabled`, which answers a different question: does the operator WANT
 * this source. Whether anyone read its robots rules and its terms was never
 * asked anywhere, and the registry already contains a source whose own note
 * says "NO scrapeable catalog (verified: enquiry-only). Do NOT scrape" — a
 * decision that survived only as prose.
 *
 * So this module answers "may I run right now" for POLICY, exactly as
 * `breaker.ts` answers it for a site that keeps failing, and it is composed at
 * the same call sites. The two are deliberately separate: a breaker pause is
 * temporary and about the SITE (it is down, it is blocking us, resume when it
 * is fixed); a policy block is about US (we have not established that we are
 * allowed) and no amount of waiting clears it.
 *
 * IT FAILS CLOSED, and that is the whole design. `PENDING` — the default every
 * existing row got — refuses. A gate whose unreviewed state is "go ahead" only
 * ever says yes, and would have been worth nothing on the day it shipped. The
 * cost is real and is meant to be: the owner records a review per source, once,
 * and the Studio's bulk action makes that one gesture rather than 115.
 *
 * Pure module. Every decision here is a function of two enum values, which is
 * exactly the shape that should be tested without a database.
 */
import type {
  CollectionMode,
  PolicyReviewStatus,
} from "@/generated/prisma/enums";

export type SourcePolicyState = {
  collectionMode: CollectionMode;
  policyReviewStatus: PolicyReviewStatus;
  /** The reviewer's own words, shown in the refusal when there are any. */
  policyReviewNote?: string | null;
};

/**
 * The one pair of values an automated job may run under.
 *
 * Exported as an object so it can be spread straight into a Prisma `where`.
 * The plan is explicit that this kind of rule is enforced in the QUERY and not
 * in a UI filter a user can clear, and the tier fan-out is precisely the place
 * where a forgotten check would queue a hundred jobs at once.
 */
export const AUTOMATABLE_SOURCE_WHERE = {
  collectionMode: "HTTP",
  policyReviewStatus: "APPROVED",
} as const satisfies SourcePolicyState;

/** Human labels, so the Studio and the refusal messages agree on wording. */
export const COLLECTION_MODE_LABELS: Record<CollectionMode, string> = {
  HTTP: "Automated (HTTP)",
  MANUAL_RESEARCH: "Manual research only",
};

export const POLICY_REVIEW_LABELS: Record<PolicyReviewStatus, string> = {
  PENDING: "Not reviewed",
  APPROVED: "Reviewed — allowed",
  BLOCKED: "Reviewed — not allowed",
};

/**
 * Why an automated scrape of this source may not start, or null when it may.
 *
 * Order matters. `MANUAL_RESEARCH` is checked first because it is the stronger
 * statement: a source with no automated path does not become crawlable by
 * being approved, and telling an owner who set it to manual research to "record
 * a review" would send them to the wrong control.
 */
export function describeUnauthorizedRun(
  sourceName: string,
  state: SourcePolicyState,
): string | null {
  const note = state.policyReviewNote?.trim();
  const suffix = note ? ` Recorded reason: ${note}` : "";

  if (state.collectionMode === "MANUAL_RESEARCH") {
    return (
      `${sourceName} is set to manual research, so it has no automated path — ` +
      `nothing here will fetch it. Record what you find by hand instead.${suffix}`
    );
  }

  if (state.policyReviewStatus === "BLOCKED") {
    return (
      `${sourceName} was reviewed and may NOT be collected automatically.${suffix}`
    );
  }

  if (state.policyReviewStatus === "PENDING") {
    return (
      `${sourceName} has not had a policy review. Read its robots.txt and its ` +
      `terms, then record the review on the source page — automated collection ` +
      `refuses until someone has.`
    );
  }

  return null;
}

/**
 * A two-or-three word version of the refusal, for a badge in a list, or null
 * when nothing is wrong. The long message says what to do about it; a table
 * row has space only to say WHICH thing is wrong, and saying "no policy
 * review" on a source that was reviewed and blocked would be false.
 */
export function describePolicyBadge(state: SourcePolicyState): string | null {
  if (state.collectionMode === "MANUAL_RESEARCH") return "Manual research";
  if (state.policyReviewStatus === "BLOCKED") return "Not allowed";
  if (state.policyReviewStatus === "PENDING") return "No policy review";
  return null;
}

/** The same decision as a boolean, for list rendering and filters. */
export function isAutomatable(state: SourcePolicyState): boolean {
  return describeUnauthorizedRun("source", state) === null;
}
