"use server";

/**
 * Embedding actions (B9) — the ONLY path by which product embeddings are
 * recomputed. Explicit and human-triggered for the same reason analytics
 * are: a vector that changed because a scrape ran would be a machine
 * quietly changing what "similar" means.
 */

import { revalidatePath } from "next/cache";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import {
  recomputeEmbeddings,
  type EmbeddingRecomputeReport,
} from "@/lib/scraper/embedding-query";

const ANALYTICS_PATH = "/studio/scraper/analytics";

export type { EmbeddingRecomputeReport };

/**
 * Re-embed the researched corpus: rewrite rows whose feature hash moved,
 * keep the rest, prune other model generations. The report says exactly
 * what happened — written, unchanged, no-signal, pruned — so the screen
 * can confirm the run instead of implying it.
 */
export async function recomputeScraperEmbeddings(): Promise<
  ActionResult<EmbeddingRecomputeReport>
> {
  return runAction(async () => {
    const session = await requireStaff();
    const report = await recomputeEmbeddings();

    await logActivity({
      userId: session.user.id,
      action: "embeddings-recompute",
      entity: "ProductEmbedding",
      meta: {
        model: report.model,
        version: report.version,
        considered: report.considered,
        written: report.written,
        unchanged: report.unchanged,
        noSignal: report.noSignal,
        prunedGenerations: report.prunedGenerations,
      },
    });
    revalidatePath(ANALYTICS_PATH);
    return report;
  });
}
