import type { ScrapeTier } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { rowToScrapeDeck } from "@/lib/scraper/export";
import {
  isSheetSyncConfigured,
  syncRowsToSheet,
  TAB_BY_TIER,
  type SheetIdSettings,
} from "@/lib/scraper/sheets";

/**
 * The one writer that pushes a job's staged rows into its tier tab.
 *
 * There is exactly one of these on purpose. The manual "Sync to Sheet" action
 * and the automatic ON_COMPLETE hook are the same push with different
 * triggers — two write paths into a shared document is how rows get
 * duplicated, and the merge key only protects against that if every writer
 * uses it.
 *
 * It never throws. A scrape that succeeded must not be reported as failed
 * because a third party's API was down: the rows are already saved, so the
 * push marks them SYNC_PENDING and the drain picks them up later.
 */

export type PushOutcome =
  | { status: "unconfigured" }
  | { status: "empty" }
  | { status: "synced"; updated: number; appended: number; total: number }
  | { status: "failed"; error: string; pending: number };

/** The tier a job's rows belong to. Jobs outlive their source (SetNull). */
const FALLBACK_TIER: ScrapeTier = "RESIN_GOODS";

/**
 * Record one row of push history (B0's `SheetSyncRun`) — the sheet-import
 * screen's "last 20" table. Never throws: a push that succeeded (or failed
 * and was already marked SYNC_PENDING) must not be reported as broken just
 * because the history row itself could not be written.
 */
export async function recordSheetSyncRun(opts: {
  tab: string;
  rows: number;
  status: "SYNCED" | "FAILED" | "UNCONFIGURED" | "EMPTY";
  error?: string | null;
  startedAt: Date;
}): Promise<void> {
  try {
    await db.sheetSyncRun.create({
      data: {
        direction: "PUSH",
        tab: opts.tab,
        rows: opts.rows,
        status: opts.status,
        error: opts.error ?? null,
        startedAt: opts.startedAt,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(
      "sheet-push: could not record SheetSyncRun (continuing):",
      err,
    );
  }
}

/**
 * Push one job's staged products to their tier tab. `settings` (the owner's
 * `SiteSettings.sheetId`) is optional — every existing caller that has not
 * been updated to fetch and pass it keeps resolving the sheet id from the
 * deploy environment exactly as before (`readSheetId`).
 */
export async function pushJobToSheet(
  jobId: string,
  settings?: SheetIdSettings,
): Promise<PushOutcome> {
  const startedAt = new Date();
  if (!isSheetSyncConfigured(settings)) return { status: "unconfigured" };

  const job = await db.scrapeJob.findUnique({
    where: { id: jobId },
    include: {
      source: { select: { id: true, tier: true } },
      products: { orderBy: [{ sourceKey: "asc" }, { slug: "asc" }] },
    },
  });
  if (!job || job.products.length === 0) return { status: "empty" };

  const tier = job.source?.tier ?? FALLBACK_TIER;
  const ids = job.products.map((p) => p.id);
  const tab = TAB_BY_TIER[tier];

  try {
    const { updated, appended } = await syncRowsToSheet(
      tier,
      job.products.map(rowToScrapeDeck),
      settings,
    );

    await db.$transaction([
      db.scrapedProduct.updateMany({
        where: { id: { in: ids } },
        data: {
          sheetSyncStatus: "SYNCED",
          sheetSyncedAt: new Date(),
          sheetSyncError: null,
        },
      }),
      db.scrapeJob.update({
        where: { id: job.id },
        data: { sheetSynced: true },
      }),
      ...(job.source
        ? [
            db.scrapeSource.update({
              where: { id: job.source.id },
              data: { lastSheetSyncAt: new Date(), lastSheetSyncError: null },
            }),
          ]
        : []),
    ]);

    await recordSheetSyncRun({
      tab,
      rows: ids.length,
      status: "SYNCED",
      startedAt,
    });
    return { status: "synced", updated, appended, total: ids.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Sheet write failed.";

    // The rows are safe in the database. Mark them so the drain can find them
    // and so the operator sees "failed" rather than "nobody pushed this yet" —
    // those look identical without it, and only one of them needs action.
    await db.$transaction([
      db.scrapedProduct.updateMany({
        where: { id: { in: ids } },
        data: { sheetSyncStatus: "SYNC_PENDING", sheetSyncError: error },
      }),
      ...(job.source
        ? [
            db.scrapeSource.update({
              where: { id: job.source.id },
              data: { lastSheetSyncError: error },
            }),
          ]
        : []),
    ]);

    await recordSheetSyncRun({
      tab,
      rows: ids.length,
      status: "FAILED",
      error,
      startedAt,
    });
    return { status: "failed", error, pending: ids.length };
  }
}
