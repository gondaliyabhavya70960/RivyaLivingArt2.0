"use server";

/**
 * Workflow-run actions (A9, plan §6 "Workflow runs — filterable feed,
 * stages, retry/cancel") — thin staff-gated wrappers over
 * `src/lib/scraper/run-control.ts`, which owns the semantics:
 *
 * RETRY is a NEW run. A failed job's row is a dated record of what happened
 * — it is never reopened, reset, or rewritten. Retrying queues a fresh
 * QUEUED job for the same source, URL and scope, so the feed keeps both:
 * "run 41 failed at 14:02" and "run 48 (retry of 41) is running".
 *
 * CANCEL is a terminal write with the honest reason on the row: the job's
 * status becomes FAILED and its error says "Cancelled by …", because the
 * enum has no CANCELLED value and inventing one is a migration; what matters
 * is that nobody later reads the row as the source being at fault. A live
 * runner polling a cancelled job gets the terminal snapshot back and stops
 * (advanceScrapeJob returns terminal jobs untouched), so cancelling a
 * RUNNING job is safe, not racy.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { cancelRun, retryRun } from "@/lib/scraper/run-control";

const RUNS_PATH = "/studio/scraper/runs";

/** Queue a fresh run for a FAILED job's exact target. */
export async function retryScrapeJob(
  jobId: string,
): Promise<ActionResult<{ jobId?: string; userError?: string }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const id = z.string().min(1).parse(jobId);
    const outcome = await retryRun(id);

    if (outcome.jobId) {
      await logActivity({
        userId: session.user.id,
        action: "retry",
        entity: "ScrapeJob",
        entityId: outcome.jobId,
        meta: { retriedJobId: id },
      });
      revalidatePath(RUNS_PATH);
      revalidatePath("/studio/scraper");
    }
    return outcome;
  });
}

/** Cancel a QUEUED or RUNNING run; idempotent on terminal jobs. */
export async function cancelScrapeJob(
  jobId: string,
): Promise<ActionResult<{ cancelled: boolean }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const id = z.string().min(1).parse(jobId);

    const operator = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    const outcome = await cancelRun(
      id,
      operator?.name ?? operator?.email ?? "an operator",
    );

    if (outcome.cancelled) {
      await logActivity({
        userId: session.user.id,
        action: "cancel",
        entity: "ScrapeJob",
        entityId: id,
      });
      revalidatePath(RUNS_PATH);
      revalidatePath("/studio/scraper");
    }
    return outcome;
  });
}
