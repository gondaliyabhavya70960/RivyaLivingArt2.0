/**
 * The shortlist write path (B7) — server-only. The vocabulary and the state
 * machine live in `shortlist.ts`; this module is the only place that turns
 * them into database rows.
 *
 * Two doors lead to CONFIRMED, and both are human hands:
 *
 * 1. `transitionEntries(..., CONFIRMED)` — the Studio confirm action, which
 *    the state machine only allows from SHORTLISTED.
 * 2. `markImportedConfirmed` — the catalog import path recording that a
 *    confirmed product has now also been promoted (the backfill's
 *    IMPORTED→CONFIRMED mapping, applied going forward).
 *
 * No scrape, cron, or adapter ever calls either. Rule 8: nothing
 * auto-confirms.
 *
 * The legacy mirror: `ScrapedProduct.reviewStatus` is still read by the
 * promote path (it imports APPROVED rows), so state moves that have a legacy
 * counterpart are mirrored down to the staged twins — except IMPORTED twins,
 * which are terminal and never rewritten. The upward mirror
 * (`mirrorLegacyReviewStatus`) synchronizes decisions made in the older
 * surfaces, with one hard rule: it never moves an entry OUT of CONFIRMED.
 * Un-confirming is a deliberate act, not a side effect of a stray approve.
 */
import { ShortlistState, canTransition, legacyReviewStatusFor, shortlistStateForLegacy } from "@/lib/scraper/shortlist";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/** The (sourceKey, externalId) pair that ties a staged twin to its identity. */
export type ProductRef = { sourceKey: string; externalId: string };

export type TransitionReport = {
  /** Entries that moved to the target state. */
  moved: number;
  /** Already in the target state — counted apart, not an error. */
  already: number;
  /** Refused by the state machine, with the from/to that was attempted. */
  blocked: { researchProductId: string; from: ShortlistState; to: ShortlistState }[];
};

/**
 * Move researched products to a new funnel state, one upsert per product.
 * Entry-less products start from NEW (the implicit state). Same-state moves
 * and machine-refused moves are reported, not thrown — a bulk action over a
 * mixed selection must tell the owner "3 moved, 2 skipped", not fail the
 * whole batch because one row was in the wrong state.
 *
 * `reason` is recorded verbatim on every moved entry ("duplicate of …",
 * "owner picked for Diwali benchmark"). ActivityLog gets one row per call
 * from the calling action — that is the audit trail.
 */
export async function transitionEntries(
  researchProductIds: string[],
  to: ShortlistState,
  options: { changedBy: string | null; reason?: string | null },
): Promise<TransitionReport> {
  const ids = [...new Set(researchProductIds)];
  const report: TransitionReport = { moved: 0, already: 0, blocked: [] };
  if (ids.length === 0) return report;

  const [entries, products] = await Promise.all([
    db.shortlistEntry.findMany({
      where: { researchProductId: { in: ids } },
      select: { researchProductId: true, state: true },
    }),
    db.researchProduct.findMany({
      where: { id: { in: ids } },
      select: { id: true, sourceKey: true, externalId: true },
    }),
  ]);
  const stateById = new Map(entries.map((e) => [e.researchProductId, e.state]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const legacy = legacyReviewStatusFor(to);
  const mirrorRefs: ProductRef[] = [];

  for (const id of ids) {
    if (!productById.has(id)) continue; // id from a stale selection — skip
    const from = stateById.get(id) ?? ShortlistState.NEW;
    if (from === to) {
      report.already += 1;
      continue;
    }
    if (!canTransition(from, to)) {
      report.blocked.push({ researchProductId: id, from, to });
      continue;
    }
    await db.shortlistEntry.upsert({
      where: { researchProductId: id },
      create: {
        researchProductId: id,
        state: to,
        changedBy: options.changedBy,
        changedAt: new Date(),
        reason: options.reason || null,
      },
      update: {
        state: to,
        changedBy: options.changedBy,
        changedAt: new Date(),
        reason: options.reason || null,
      },
    });
    report.moved += 1;
    const product = productById.get(id);
    if (legacy && product) {
      mirrorRefs.push({
        sourceKey: product.sourceKey,
        externalId: product.externalId,
      });
    }
  }

  // Mirror down to the staged twins the promote path still reads. IMPORTED
  // twins are terminal — a product already in the catalog stays marked so.
  if (legacy && mirrorRefs.length > 0) {
    await db.scrapedProduct.updateMany({
      where: {
        OR: mirrorRefs,
        reviewStatus: { not: "IMPORTED" },
      },
      data: { reviewStatus: legacy },
    });
  }

  return report;
}

/**
 * Set the reviewer note on an entry, creating the entry (state NEW) if this
 * is the first human touch. A note is not a state decision, so an existing
 * entry's state/changedBy/changedAt are left alone — only the words change.
 */
export async function setEntryNote(
  researchProductId: string,
  note: string | null,
  changedBy: string | null,
): Promise<void> {
  await db.shortlistEntry.upsert({
    where: { researchProductId },
    create: { researchProductId, note, changedBy },
    update: { note },
  });
}

/** Replace an entry's tag list (already trimmed/deduped by the caller). */
export async function setEntryTags(
  researchProductId: string,
  tags: string[],
  changedBy: string | null,
): Promise<void> {
  await db.shortlistEntry.upsert({
    where: { researchProductId },
    create: { researchProductId, tags, changedBy },
    update: { tags },
  });
}

/**
 * Upward mirror: a legacy reviewStatus change (the import dialog's
 * approve-first step) recorded on the entries. Never touches a CONFIRMED
 * entry — un-confirming is only ever a deliberate Studio action.
 */
export async function mirrorLegacyReviewStatus(
  refs: ProductRef[],
  status: ReviewStatus,
  changedBy: string | null,
): Promise<void> {
  if (refs.length === 0) return;
  const state = shortlistStateForLegacy(status);
  const products = await db.researchProduct.findMany({
    where: { OR: refs },
    select: { id: true, shortlistEntry: { select: { state: true } } },
  });
  for (const product of products) {
    if (product.shortlistEntry?.state === ShortlistState.CONFIRMED) continue;
    await db.shortlistEntry.upsert({
      where: { researchProductId: product.id },
      create: {
        researchProductId: product.id,
        state,
        changedBy,
        changedAt: new Date(),
        reason: `legacy reviewStatus ${status}`,
      },
      update: {
        state,
        changedBy,
        changedAt: new Date(),
        reason: `legacy reviewStatus ${status}`,
      },
    });
  }
}

/**
 * The import path's confirmation: a staged twin was just promoted into the
 * catalog as a locked draft, which is the backfill's IMPORTED→CONFIRMED
 * mapping applied going forward. Direct upsert, not a state-machine
 * transition — the human decision happened when the owner clicked import,
 * and the entry may be sitting in any state when it does.
 */
export async function markImportedConfirmed(
  ref: ProductRef,
  changedBy: string | null,
): Promise<void> {
  const product = await db.researchProduct.findUnique({
    where: {
      sourceKey_externalId: {
        sourceKey: ref.sourceKey,
        externalId: ref.externalId,
      },
    },
    select: { id: true },
  });
  if (!product) return;
  await db.shortlistEntry.upsert({
    where: { researchProductId: product.id },
    create: {
      researchProductId: product.id,
      state: ShortlistState.CONFIRMED,
      changedBy,
      changedAt: new Date(),
      reason: "imported to catalog",
    },
    update: {
      state: ShortlistState.CONFIRMED,
      changedBy,
      changedAt: new Date(),
      reason: "imported to catalog",
    },
  });
}
