import { isPlaceholderAsset } from "@/lib/placeholder-assets";
import type { ProductSizeTier } from "@/lib/product-size-tier";

/**
 * Approve — the owner's "I have read this copy" for a batch of products.
 *
 * A row that came in through the scraper (the review inbox's Add to catalog,
 * or a scraper export through Bulk Import) carries `needsRewrite`: its title
 * and description are another site's words until a person has read and
 * rewritten them, and both Publish and Confirm refuse the row while the flag
 * is up. The single product form clears it with the "confirm rewrite" tick.
 * There was no batch equivalent, so a Review tab of 266 imported rows had
 * Publish skip all 266 with the reason, and no button that did what the
 * owner meant.
 *
 * Approve is that button. For every targeted row it clears the guard and
 * marks the row owner-touched (a human decided about its content, so the
 * next import refreshes only its availability — `merge-policy.ts`), and it
 * publishes the rows that can go live: the two guards Publish applies still
 * apply here, and an archived row stays archived — a filter that reaches
 * into the archive is not a request to put those pieces on sale.
 *
 * Pure: the action reads the rows and applies the plan; this is the decision.
 */

export type ApprovalCandidate = {
  id: string;
  needsRewrite: boolean;
  sizeTier: ProductSizeTier | null;
  status: string;
  /** The gallery's lowest-`order` image url, or null — see `coverUrlOf`. */
  coverUrl: string | null;
};

export type ApprovalPlan = {
  /** Every targeted row — the rewrite guard clears and the row is owner-touched. */
  reviewIds: string[];
  /** The rows that move to PUBLISHED. */
  publishIds: string[];
  /** Kept out of publish: no product tier yet (the same guard as Publish). */
  untieredIds: string[];
  /** Kept out of publish: the cover is still a concept placeholder (plan §4.6). */
  placeholderIds: string[];
  /** Already live — nothing to publish; the guard still clears. */
  alreadyLive: number;
  /** Archived rows stay archived; the guard still clears. */
  archived: number;
};

export function planProductApproval(
  rows: readonly ApprovalCandidate[],
): ApprovalPlan {
  const plan: ApprovalPlan = {
    reviewIds: [],
    publishIds: [],
    untieredIds: [],
    placeholderIds: [],
    alreadyLive: 0,
    archived: 0,
  };
  for (const row of rows) {
    plan.reviewIds.push(row.id);
    if (row.status === "PUBLISHED") {
      plan.alreadyLive += 1;
    } else if (row.status === "ARCHIVED") {
      plan.archived += 1;
    } else if (row.sizeTier === null) {
      // Untiered wins when a row is both untiered AND on a placeholder cover,
      // matching the order Publish applies its guards in (rewrite → tier →
      // cover). Stated as a decision because the toast names only one hold per
      // row, and which one it names should not be an accident of branch order.
      plan.untieredIds.push(row.id);
    } else if (isPlaceholderAsset(row.coverUrl)) {
      plan.placeholderIds.push(row.id);
    } else {
      plan.publishIds.push(row.id);
    }
  }
  return plan;
}

export type ApproveReport = {
  /** Rows whose copy is now approved (the rewrite guard cleared). */
  approved: number;
  published: number;
  untiered: number;
  placeholder: number;
  alreadyLive: number;
  archived: number;
};

/** The toast lines for a report — one success line, then the named holds. */
export function describeApproval(report: ApproveReport): {
  success: string | null;
  holds: string[];
} {
  const n = (count: number, noun: string) =>
    `${count.toLocaleString("en-IN")} ${noun}${count === 1 ? "" : "s"}`;
  const success =
    report.approved === 0
      ? null
      : report.published > 0
        ? `Approved ${n(report.approved, "product")} — ${n(report.published, "product")} published.`
        : `Approved ${n(report.approved, "product")}.`;
  const holds: string[] = [];
  if (report.untiered > 0) {
    holds.push(
      `${n(report.untiered, "product")} ${report.untiered === 1 ? "has" : "have"} no product tier and ${report.untiered === 1 ? "stays" : "stay"} unpublished — set a tier, then Publish.`,
    );
  }
  if (report.placeholder > 0) {
    holds.push(
      `${n(report.placeholder, "product")} ${report.placeholder === 1 ? "is" : "are"} still on a concept placeholder image and ${report.placeholder === 1 ? "stays" : "stay"} unpublished — add a photograph of the real piece, then Publish.`,
    );
  }
  if (report.archived > 0) {
    holds.push(
      `${n(report.archived, "archived product")} ${report.archived === 1 ? "stays" : "stay"} archived — restore to draft first if you want ${report.archived === 1 ? "it" : "them"} on sale.`,
    );
  }
  if (report.alreadyLive > 0) {
    holds.push(
      `${n(report.alreadyLive, "product")} ${report.alreadyLive === 1 ? "was" : "were"} already live.`,
    );
  }
  return { success, holds };
}
