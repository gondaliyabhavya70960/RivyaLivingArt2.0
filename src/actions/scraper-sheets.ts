"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import type { ScrapeTier } from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { rowToScrapeDeck } from "@/lib/scraper/export";
import {
  isSheetSyncConfigured,
  syncRowsToSheet,
  TAB_BY_TIER,
  upsertRowsToTab,
} from "@/lib/scraper/sheets";
import { pushJobToSheet } from "@/lib/scraper/sheet-push";
import {
  CONFIRMED_COLUMNS,
  CONFIRMED_SHEET_TAB,
} from "@/lib/scraper/confirm";
import { pushWebsiteProducts } from "@/lib/scraper/product-sheet-sync";
import { WEBSITE_SHEET_TAB } from "@/lib/scraper/website-sheet";

const STUDIO_PATH = "/studio/scraper";

const NOT_CONFIGURED_ERROR =
  "Sheet sync not configured — set GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_SERVICE_ACCOUNT_KEY_B64) and SCRAPE_SHEET_ID (or SHEET_ID). Optional; the CSV export covers the full workflow without them.";

export type SheetSyncCounts = {
  updated: number;
  appended: number;
  total: number;
};

type SyncOutcome =
  | { outcome: "unconfigured" }
  | { outcome: "missing" }
  | { outcome: "pending"; error: string; pending: number }
  | ({ outcome: "synced" } & SheetSyncCounts);

function toActionResult(
  result: ActionResult<SyncOutcome>,
): ActionResult<SheetSyncCounts> {
  if (!result.ok) return result;
  const data = result.data;
  if (!data) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (data.outcome === "unconfigured") {
    return { ok: false, error: NOT_CONFIGURED_ERROR };
  }
  if (data.outcome === "missing") {
    return { ok: false, error: "Job not found." };
  }
  if (data.outcome === "pending") {
    return {
      ok: false,
      error: `Sheet unreachable — ${data.pending} rows kept and marked pending. Retry when it is back. (${data.error})`,
    };
  }
  const { updated, appended, total } = data;
  return { ok: true, data: { updated, appended, total } };
}

/**
 * Push one job's staged products into the tier tab of the ScrapeDeck sheet.
 * Rows merge by `${sourceKey}|${externalId}` — re-syncing updates in place.
 */
export async function syncJobToSheet(
  jobId: string,
): Promise<ActionResult<SheetSyncCounts>> {
  const result = await runAction<SyncOutcome>(async () => {
    const session = await requireStaff();
    if (!isSheetSyncConfigured()) return { outcome: "unconfigured" };
    const id = z.string().min(1).parse(jobId);

    const job = await db.scrapeJob.findUnique({
      where: { id },
      include: {
        source: { select: { tier: true } },
        products: { orderBy: [{ sourceKey: "asc" }, { slug: "asc" }] },
      },
    });
    if (!job) return { outcome: "missing" };

    // Same engine the ON_COMPLETE hook uses — this action is the trigger, not
    // a second writer.
    const tier: ScrapeTier = job.source?.tier ?? "RESIN_GOODS";
    const outcome = await pushJobToSheet(job.id);
    if (outcome.status === "unconfigured") return { outcome: "unconfigured" };
    if (outcome.status === "empty") {
      return { outcome: "synced", updated: 0, appended: 0, total: 0 };
    }
    if (outcome.status === "failed") {
      // The rows are marked SYNC_PENDING and safe; say so rather than
      // pretending the push worked.
      return { outcome: "pending", error: outcome.error, pending: outcome.pending };
    }
    const { updated, appended } = outcome;
    const total = outcome.total;

    await logActivity({
      userId: session.user.id,
      action: "sheet-sync",
      entity: "ScrapeJob",
      entityId: job.id,
      meta: {
        sourceKey: job.sourceKey,
        tab: TAB_BY_TIER[tier],
        updated,
        appended,
        total,
      },
    });
    revalidatePath(STUDIO_PATH);
    return { outcome: "synced", updated, appended, total };
  });

  return toActionResult(result);
}

/**
 * Mirror every product on the website into its own tab.
 *
 * "Added product in website" is what the owner asked for and what it contains:
 * the whole catalog, DRAFT rows included, each carrying its status. Added and
 * live are different things, and a mirror that quietly dropped everything
 * unpublished would be the more confusing of the two — the owner would look
 * for a product they know they added and not find it.
 */
export async function syncWebsiteProductsToSheet(): Promise<
  ActionResult<SheetSyncCounts>
> {
  const result = await runAction<SyncOutcome>(async () => {
    const session = await requireStaff();
    const pushed = await pushWebsiteProducts();
    if (pushed === null) return { outcome: "unconfigured" };

    await logActivity({
      userId: session.user.id,
      action: "sheet-sync-website",
      entity: "Product",
      meta: {
        tab: WEBSITE_SHEET_TAB,
        updated: pushed.updated,
        appended: pushed.appended,
        total: pushed.total,
      },
    });
    revalidatePath(STUDIO_PATH);
    return {
      outcome: "synced",
      updated: pushed.updated,
      appended: pushed.appended,
      total: pushed.total,
    };
  });

  return toActionResult(result);
}

/**
 * Write the confirmed list to its own tab.
 *
 * The query IS the specification:
 *
 *     where: { confirmedAt: { not: null } }
 *
 * Not "everything scraped", not "everything in the studio", not "everything
 * already in the sheet". If a row is in this tab it is because somebody
 * confirmed it, and if they unconfirm it the next sync stops writing it.
 *
 * Rows merge on Product ID, so re-running updates in place rather than
 * appending a second copy of the list.
 */
export async function syncConfirmedToSheet(): Promise<
  ActionResult<SheetSyncCounts>
> {
  const result = await runAction<SyncOutcome>(async () => {
    const session = await requireStaff();
    if (!isSheetSyncConfigured()) return { outcome: "unconfigured" };

    const products = await db.product.findMany({
      where: { confirmedAt: { not: null } },
      orderBy: { confirmedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        priceMin: true,
        priceMax: true,
        showPrice: true,
        status: true,
        confirmedAt: true,
        confirmedById: true,
        category: { select: { name: true } },
        images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
      },
    });

    const rows = products.map((p) => [
      p.id,
      p.slug,
      p.title,
      p.category?.name ?? "",
      p.showPrice && p.priceMin !== null ? String(p.priceMin) : "",
      p.showPrice && p.priceMax !== null ? String(p.priceMax) : "",
      p.showPrice ? "INR" : "",
      p.images[0]?.url ?? "",
      p.status,
      p.confirmedAt ? p.confirmedAt.toISOString() : "",
      p.confirmedById ?? "",
    ]);

    const { updated, appended } = await upsertRowsToTab({
      tab: CONFIRMED_SHEET_TAB,
      header: CONFIRMED_COLUMNS,
      rows,
      keyOf: (row) => row[0] ?? "",
    });

    await logActivity({
      userId: session.user.id,
      action: "sheet-sync-confirmed",
      entity: "Product",
      meta: { tab: CONFIRMED_SHEET_TAB, updated, appended, total: rows.length },
    });
    revalidatePath(STUDIO_PATH);
    return { outcome: "synced", updated, appended, total: rows.length };
  });

  return toActionResult(result);
}

/**
 * Re-push every row a previous attempt could not write.
 *
 * A Sheets outage must not cost scraped work: the push marks those rows
 * SYNC_PENDING and returns, leaving the data safe in the database. This drains
 * that queue when the API is back. It re-pushes whole JOBS rather than
 * individual rows because the sheet writer merges by key — pushing a job again
 * updates the rows that already made it instead of duplicating them, so the
 * retry is free of charge and cannot double-write.
 */
export async function retryPendingSheetSync(): Promise<
  ActionResult<{ jobs: number; rows: number; failed: number }>
> {
  return runAction(async () => {
    const session = await requireStaff();
    if (!isSheetSyncConfigured()) {
      throw new Error(NOT_CONFIGURED_ERROR);
    }

    const pending = await db.scrapedProduct.groupBy({
      by: ["jobId"],
      where: { sheetSyncStatus: "SYNC_PENDING" },
      _count: { _all: true },
    });
    if (pending.length === 0) return { jobs: 0, rows: 0, failed: 0 };

    let rows = 0;
    let failed = 0;
    for (const group of pending) {
      const outcome = await pushJobToSheet(group.jobId);
      if (outcome.status === "synced") rows += outcome.total;
      else failed += group._count._all;
    }

    await logActivity({
      userId: session.user.id,
      action: "sheet-sync-retry",
      entity: "ScrapeJob",
      meta: { jobs: pending.length, rows, failed },
    });
    revalidatePath(STUDIO_PATH);
    return { jobs: pending.length, rows, failed };
  });
}

const tierSchema = z.enum(["OWNER", "RESIN_GOODS", "SUPPLIES", "PRINT3D"]);

/**
 * Push every staged product of a tier into its tab — joins ScrapedProduct
 * rows to the tier via the sourceKey registry.
 */
export async function syncTierToSheet(
  tier: ScrapeTier,
): Promise<ActionResult<SheetSyncCounts>> {
  const result = await runAction<SyncOutcome>(async () => {
    const session = await requireStaff();
    if (!isSheetSyncConfigured()) return { outcome: "unconfigured" };
    const parsedTier = tierSchema.parse(tier);

    const sources = await db.scrapeSource.findMany({
      where: { tier: parsedTier },
      select: { key: true },
    });
    const keys = sources.map((s) => s.key);

    const products =
      keys.length > 0
        ? await db.scrapedProduct.findMany({
            where: { sourceKey: { in: keys } },
            orderBy: [{ sourceKey: "asc" }, { slug: "asc" }],
          })
        : [];

    const rows = products.map(rowToScrapeDeck);
    const { updated, appended } = await syncRowsToSheet(parsedTier, rows);

    await logActivity({
      userId: session.user.id,
      action: "sheet-sync",
      entity: "ScrapedProduct",
      meta: {
        tier: parsedTier,
        tab: TAB_BY_TIER[parsedTier],
        sources: keys.length,
        updated,
        appended,
        total: rows.length,
      },
    });
    revalidatePath(STUDIO_PATH);
    return { outcome: "synced", updated, appended, total: rows.length };
  });

  return toActionResult(result);
}
