import type { Prisma } from "@/generated/prisma/client";
import type { InquirySource, InquiryStatus } from "@/generated/prisma/enums";
import { STATUS_ORDER } from "@/components/studio/inquiries/labels";
import { staleInquiryWhere } from "@/components/studio/dashboard/action-queue";
import type { CommissionCard } from "@/components/studio/inquiries/commission-board";

/**
 * The board's filter contract (PR-5).
 *
 * The table's source/search/stale/demo clauses, applied to the board for the
 * first time — previously the lanes ignored every filter but `?demo=1`, so
 * the table and the board could show two different pipelines at once. The
 * board's own rule stays: lanes are always the seven active statuses. A
 * `?status=` tab drives the TABLE's view only — the board is by definition
 * the all-status pipeline, and filtering it to one status would make the
 * other six lanes lie about being empty.
 */
export function buildBoardWhere({
  source,
  q,
  stale,
  demoOnly,
  now,
}: {
  source?: InquirySource;
  q?: string;
  stale?: string;
  demoOnly: boolean;
  now: Date;
}): Prisma.InquiryWhereInput {
  return {
    status: { in: STATUS_ORDER },
    ...(source ? { source } : {}),
    // `staleInquiryWhere` carries `status: "NEW"` of its own — spread after
    // the lane clause on purpose: the stale view IS the NEW lane's overdue
    // slice, the same narrowing the table already applies.
    ...(stale === "1" ? staleInquiryWhere(now) : {}),
    ...(demoOnly ? { isDemo: true } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };
}

/**
 * The optimistic half of a card move: the card changes lanes immediately,
 * and a failed server call rolls back to the pre-move array. Pure — the
 * board's state effect feeds it the current array and keeps the old one.
 */
export function applyOptimisticMove(
  cards: CommissionCard[],
  id: string,
  next: InquiryStatus,
): CommissionCard[] {
  return cards.map((card) =>
    card.id === id ? { ...card, status: next } : card,
  );
}
