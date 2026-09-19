import type { ContentStatus } from "@/generated/prisma/enums";
import type { KanbanMoveOption } from "@/components/studio/kanban";

/**
 * The products Kanban's pure model — the bits worth testing without a DOM:
 * which lanes exist, what a card may do, and what a move result says.
 *
 * LANES ARE THE FOUR REAL STATUSES, nothing conceptual. The craft prompt's
 * "incomplete / needs review / ready" examples collapse onto `ContentStatus`
 * plus flags the card already carries — `needsRewrite`, no-tier, no-image —
 * which are card MARKERS, never lanes (the prompt's own rule: no duplicate
 * workflow state where status + flags already express it).
 */

/** Lane order is the workflow order a product moves through. */
export const PRODUCT_KANBAN_STATUSES = [
  "DRAFT",
  "REVIEW",
  "PUBLISHED",
  "ARCHIVED",
] as const satisfies readonly ContentStatus[];

export const PRODUCT_STATUS_LABEL: Record<ContentStatus, string> = {
  PUBLISHED: "Published",
  REVIEW: "Review",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
};

/**
 * Every card may attempt every status — the GUARDS, not the menu, decide
 * what is allowed. `setProductsStatus` refuses publishes that fail the
 * rewrite/tier/placeholder/photograph checks and reports each reason, so
 * hiding options here would only make the guard's answer harder to reach
 * (KANBAN-SPEC: the options ARE the state machine; the server enforces it).
 */
export const PRODUCT_MOVE_OPTIONS: readonly KanbanMoveOption<ContentStatus>[] =
  PRODUCT_KANBAN_STATUSES.map((status) => ({
    value: status,
    label: PRODUCT_STATUS_LABEL[status],
  }));

/** The counters `setProductsStatus` returns for a refused publish. */
export type ProductMoveReport = {
  updated: number;
  skippedRewrite: number;
  skippedUntiered: number;
  skippedPlaceholder: number;
  skippedNoImage: number;
};

export type ProductMoveToast =
  | { kind: "success"; message: string }
  | { kind: "warning"; message: string };

/**
 * What the toast says after a move. Every refusal is NAMED with its reason —
 * "skipped 1" with no cause is the toast that sends an owner looking for a
 * bug that is a guardrail (the same rule the table's bulk handler already
 * toasts by; the board reuses the wording).
 */
export function describeMoveToast(
  status: ContentStatus,
  title: string,
  report: ProductMoveReport,
): ProductMoveToast {
  if (status === "PUBLISHED" && report.updated === 0) {
    const reasons = [
      report.skippedRewrite > 0 && "it still needs a rewrite of scraped content",
      report.skippedUntiered > 0 && "no product tier is set",
      report.skippedPlaceholder > 0 &&
        "its cover is a concept placeholder, not a photograph",
      report.skippedNoImage > 0 && "it has no photograph at all",
    ].filter((line): line is string => typeof line === "string");
    if (reasons.length > 0) {
      return {
        kind: "warning",
        message: `"${title}" was not published — ${reasons.join(", and ")}.`,
      };
    }
  }
  if (status === "PUBLISHED") {
    return { kind: "success", message: `"${title}" is published.` };
  }
  return {
    kind: "success",
    message: `"${title}" moved to ${PRODUCT_STATUS_LABEL[status].toLowerCase()}.`,
  };
}
