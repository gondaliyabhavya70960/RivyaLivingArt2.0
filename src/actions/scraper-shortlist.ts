"use server";

/**
 * Shortlist actions (B7) — the ONLY path by which a product moves through
 * the funnel. Rule 8 of the rebuild: human confirmation gates the final
 * list. Every action here sits behind requireStaff, every move writes an
 * ActivityLog row (the audit trail — ShortlistEntry itself holds only the
 * current state), and the state machine in `lib/scraper/shortlist.ts`
 * decides which moves exist at all.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { ShortlistState } from "@/lib/scraper/shortlist";
import {
  setEntryNote,
  setEntryTags,
  transitionEntries,
  type TransitionReport,
} from "@/lib/scraper/shortlist-write";

const REVIEW_PATH = "/studio/scraper/review";
const CONFIRMED_PATH = "/studio/scraper/confirmed";

const transitionSchema = z.object({
  researchProductIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one item.")
    .max(500, "Move at most 500 items at once."),
  state: z.enum(ShortlistState),
  reason: z.string().trim().max(500).optional(),
});

export type { TransitionReport };

/**
 * Bulk move through the funnel. The machine refuses what it refuses
 * (CONFIRMED only from SHORTLISTED, same-state is a no-op) and the report
 * says exactly what happened — "4 moved, 2 skipped" — so a mixed selection
 * never silently half-applies.
 */
export async function setShortlistState(
  researchProductIds: string[],
  state: ShortlistState,
  reason?: string,
): Promise<ActionResult<TransitionReport>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = transitionSchema.parse({
      researchProductIds,
      state,
      reason: reason || undefined,
    });

    const report = await transitionEntries(
      parsed.researchProductIds,
      parsed.state,
      { changedBy: session.user.id, reason: parsed.reason ?? null },
    );

    await logActivity({
      userId: session.user.id,
      action: "shortlist-transition",
      entity: "ShortlistEntry",
      meta: {
        state: parsed.state,
        moved: report.moved,
        already: report.already,
        blocked: report.blocked.length,
        reason: parsed.reason ?? null,
      },
    });
    revalidatePath(REVIEW_PATH);
    revalidatePath(CONFIRMED_PATH);
    return report;
  });
}

const noteSchema = z.object({
  researchProductId: z.string().min(1),
  note: z.string().trim().max(4000).nullable(),
});

/**
 * The reviewer's own words on a listing — carried on the entry now, not on
 * the staged row. Creates the entry (state NEW) on first touch, so a note
 * is itself a human decision worth recording.
 */
export async function setShortlistNote(
  researchProductId: string,
  note: string | null,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const session = await requireStaff();
    const p = noteSchema.parse({ researchProductId, note });
    await setEntryNote(p.researchProductId, p.note || null, session.user.id);
    await logActivity({
      userId: session.user.id,
      action: "shortlist-note",
      entity: "ShortlistEntry",
      entityId: p.researchProductId,
    });
    revalidatePath(REVIEW_PATH);
    revalidatePath(CONFIRMED_PATH);
  });
}

const tagsSchema = z.object({
  researchProductId: z.string().min(1),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
});

/**
 * Replace an entry's tags — the owner's own labels ("large-format",
 * "diwali-benchmark"). Normalized here: trimmed, empties dropped, dupes
 * folded, so the export column stays clean.
 */
export async function setShortlistTags(
  researchProductId: string,
  tags: string[],
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const session = await requireStaff();
    const p = tagsSchema.parse({ researchProductId, tags });
    const clean = [...new Set(p.tags.map((t) => t.trim()).filter(Boolean))];
    await setEntryTags(p.researchProductId, clean, session.user.id);
    await logActivity({
      userId: session.user.id,
      action: "shortlist-tags",
      entity: "ShortlistEntry",
      entityId: p.researchProductId,
      meta: { tags: clean },
    });
    revalidatePath(REVIEW_PATH);
    revalidatePath(CONFIRMED_PATH);
  });
}
