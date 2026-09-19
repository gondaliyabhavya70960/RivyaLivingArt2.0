import { describe, expect, it } from "vitest";

import {
  applyOptimisticMove,
  buildBoardWhere,
} from "@/components/studio/inquiries/board-filter";
import { STATUS_ORDER } from "@/components/studio/inquiries/labels";
import type { CommissionCard } from "@/components/studio/inquiries/commission-board";

const NOW = new Date("2026-09-19T12:00:00Z");

const card = (id: string, status: CommissionCard["status"]): CommissionCard => ({
  id,
  number: `#RR-${id}`,
  customerName: `Customer ${id}`,
  phone: "+91 90000 00000",
  source: "PRODUCT",
  projectTitle: "Ocean Table",
  thumbnailUrl: null,
  status,
  timeline: null,
  createdAtIso: "2026-09-18T09:00:00Z",
  createdAt: "18 Sep 2026",
});

describe("buildBoardWhere", () => {
  it("always queries the seven active statuses — never a single ?status= tab", () => {
    const where = buildBoardWhere({ demoOnly: false, now: NOW });
    expect(where.status).toEqual({ in: STATUS_ORDER });
  });

  it("applies the source, search and demo clauses the table already had", () => {
    const where = buildBoardWhere({
      source: "CUSTOM_ORDER",
      q: "asha",
      demoOnly: true,
      now: NOW,
    });
    expect(where.source).toBe("CUSTOM_ORDER");
    expect(where.isDemo).toBe(true);
    expect(where.OR).toEqual([
      { customerName: { contains: "asha", mode: "insensitive" } },
      { phone: { contains: "asha" } },
    ]);
  });

  it("narrows to the NEW lane's overdue slice when ?stale=1 (same as the table)", () => {
    const where = buildBoardWhere({ stale: "1", demoOnly: false, now: NOW });
    // staleInquiryWhere carries its own status:"NEW" — the stale view IS the
    // NEW lane's overdue slice, not the whole pipeline.
    expect(where.status).toBe("NEW");
    expect(where.createdAt).toBeDefined();
  });

  it("emits no search clause for an absent or blank query", () => {
    const where = buildBoardWhere({ demoOnly: false, now: NOW });
    expect(where.OR).toBeUndefined();
    expect(where.isDemo).toBeUndefined();
    expect(where.source).toBeUndefined();
  });
});

describe("applyOptimisticMove", () => {
  it("moves only the target card and never mutates the original array", () => {
    const cards = [card("1", "NEW"), card("2", "CONTACTED"), card("3", "QUOTED")];
    const next = applyOptimisticMove(cards, "2", "CONFIRMED");
    expect(next.map((c) => c.status)).toEqual(["NEW", "CONFIRMED", "QUOTED"]);
    // Rollback safety: the pre-move array is untouched.
    expect(cards.map((c) => c.status)).toEqual(["NEW", "CONTACTED", "QUOTED"]);
    expect(next).not.toBe(cards);
    expect(next[1]).not.toBe(cards[1]);
  });
});
