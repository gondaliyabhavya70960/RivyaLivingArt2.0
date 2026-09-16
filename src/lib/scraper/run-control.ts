/**
 * Retry and cancel for scrape runs (A9) — the db-writing core behind
 * `src/actions/scraper-runs.ts`, kept out of the action file so a database
 * test can drive it without an auth session (the same split as B8/B9's
 * recompute cores).
 *
 * The two rules the actions' header states are implemented here:
 * RETRY queues a FRESH job for the failed run's exact target and never
 * touches the failed row; CANCEL terminal-writes an in-flight job as FAILED
 * with the operator's name in the error line, and is an idempotent no-op on
 * jobs already terminal.
 */
import { db } from "@/lib/db";
import { isStaleRunning } from "@/lib/scraper/run-scope";

/** Same cutoff as scraper-jobs.ts's STALE_RUNNING_MS: a RUNNING job whose
 *  heartbeat is older than this is presumed dead and does not block a retry. */
const STALE_RUNNING_MS = 10 * 60 * 1000;

export type RetryRunOutcome =
  | { jobId: string; userError?: never }
  | { jobId?: never; userError: string };

/** Queue a fresh run for a FAILED job's exact target; refuse anything else. */
export async function retryRun(jobId: string): Promise<RetryRunOutcome> {
  const job = await db.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return { userError: "That run no longer exists." };
  if (job.status !== "FAILED") {
    return {
      userError: `Only a failed run is retried — this one is ${job.status.toLowerCase()}.`,
    };
  }

  // The one-run-per-source rule applies to retries too; a stale heartbeat
  // does not block (B1's reclaim rule).
  if (job.sourceId) {
    const busy = await db.scrapeJob.findFirst({
      where: { sourceId: job.sourceId, status: { in: ["QUEUED", "RUNNING"] } },
      select: { status: true, updatedAt: true },
    });
    if (
      busy &&
      !isStaleRunning(busy, new Date(Date.now() - STALE_RUNNING_MS))
    ) {
      return {
        userError: "This source already has a run queued or in progress.",
      };
    }
  }

  const fresh = await db.scrapeJob.create({
    data: {
      sourceId: job.sourceId,
      inputUrl: job.inputUrl,
      sourceKey: job.sourceKey,
      sourceName: job.sourceName,
      platform: job.platform,
      vertical: job.vertical,
      scope: job.scope,
    },
    select: { id: true },
  });
  return { jobId: fresh.id };
}

/**
 * Cancel a QUEUED or RUNNING job: FAILED with the operator's name and the
 * reason in the error line, so nobody later reads the row as the source
 * being at fault. Terminal jobs are a reported no-op, not an error.
 */
export async function cancelRun(
  jobId: string,
  operatorName: string,
): Promise<{ cancelled: boolean }> {
  const job = await db.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return { cancelled: false };
  if (job.status !== "QUEUED" && job.status !== "RUNNING") {
    return { cancelled: false };
  }

  await db.scrapeJob.update({
    where: { id: job.id },
    data: {
      status: "FAILED",
      error: `Cancelled by ${operatorName} — the source did not fail; the run was stopped by hand.`,
      finishedAt: new Date(),
    },
  });
  return { cancelled: true };
}
