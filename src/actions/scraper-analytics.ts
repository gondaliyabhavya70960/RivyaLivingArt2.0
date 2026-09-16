"use server";

/**
 * Analytics actions (B8) — the ONLY path by which snapshots and opportunity
 * scores are recomputed. Explicit and human-triggered by design: the numbers
 * are read-mostly, and the owner decides when a fresh read of the corpus is
 * worth the compute. No scrape, cron, or adapter calls this — an analytics
 * row appearing because a job ran would be a machine quietly changing what
 * the studio advises.
 */

import { revalidatePath } from "next/cache";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import {
  recomputeAnalytics,
  type RecomputeReport,
} from "@/lib/scraper/analytics-query";

const ANALYTICS_PATH = "/studio/scraper/analytics";

export type { RecomputeReport };

/**
 * Recompute every league benchmark, the funnel overview, and every scored
 * product's four opportunity components. The report says exactly what was
 * written — how many snapshots, how many products scored — so the screen
 * can confirm the run instead of implying it.
 */
export async function recomputeScraperAnalytics(): Promise<
  ActionResult<RecomputeReport>
> {
  return runAction(async () => {
    const session = await requireStaff();
    const report = await recomputeAnalytics();

    await logActivity({
      userId: session.user.id,
      action: "analytics-recompute",
      entity: "AnalyticsSnapshot",
      meta: {
        snapshotsWritten: report.snapshotsWritten,
        productsScored: report.productsScored,
        scoreRowsWritten: report.scoreRowsWritten,
        scrapeRunId: report.scrapeRunId,
      },
    });
    revalidatePath(ANALYTICS_PATH);
    return report;
  });
}
