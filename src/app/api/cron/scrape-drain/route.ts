import { timingSafeEqual } from "node:crypto";

import { requireStaff } from "@/actions/helpers";
import { db } from "@/lib/db";
import { advanceScrapeJob } from "@/lib/scraper/job-runner";

/**
 * Drive unattended scrape jobs forward (workstream B, step B1).
 *
 * Until this existed a scrape advanced ONLY while an operator's browser tab
 * sat open on `/studio/scraper`: `continueScrapeJob` had exactly one caller,
 * the `use-scrape-runner.ts` polling hook. Close the laptop mid-source and the
 * crawl stopped there — `cursorPage` made it resumable, but nothing resumed
 * it. This route is what finishes the job with the laptop closed.
 *
 * WHICH JOBS IT TOUCHES, and why the rule is what it is. Only jobs whose
 * heartbeat (`ScrapeJob.updatedAt`) has been still for `IDLE_MS` — nobody is
 * driving them. An actively polled job writes that column roughly once a
 * second, so a live tab's job never looks idle and the cron leaves it alone.
 *
 * That rule is about POLITENESS, not correctness. The per-page write is
 * already a compare-and-swap on `cursorPage` (see `job-runner.ts`), so two
 * workers on one job cannot both fold the same page's counts in. What the
 * CAS cannot undo is the HTTP request that was already sent: fetching a
 * supplier's pages twice over is exactly what `requestDelayMs` and the robots
 * gate exist to prevent, so the drain stays off jobs somebody else has.
 *
 * QUEUED jobs are included. A queued job has no driver by definition — that
 * is the "pressed Scrape, closed the tab" case, and the whole point.
 *
 * Authorization, matching `/api/cron/mirror-images`: the Vercel cron's
 * `Authorization: Bearer <CRON_SECRET>`, or a staff session so the owner can
 * kick a drain by hand from the browser.
 *
 * Budget: `maxDuration` is 300s, and each `advanceScrapeJob` call does up to
 * `PAGES_PER_INVOCATION` pages with the source's politeness delay between
 * them, so a single job can legitimately take tens of seconds. The loop stops
 * at `TIME_BUDGET_MS` and leaves the rest for the next tick rather than being
 * killed mid-page — an interrupted invocation is what `STALE_RUNNING_MS`
 * reclaim exists to clean up, and not needing it is better.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** A heartbeat older than this means nobody is driving the job. */
const IDLE_MS = 2 * 60 * 1000;

/** Stop starting new work past this, so the invocation ends on its own terms. */
const TIME_BUDGET_MS = 240 * 1000;

/** Most jobs to touch in one tick, so one stuck source cannot hog the budget. */
const MAX_JOBS = 5;

/** Constant-time string compare (re-audit R-005). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

type JobResult = {
  id: string;
  sourceKey: string;
  status: string;
  cursorPage: number;
  totalScraped: number;
  error?: string;
};

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  let authorized =
    Boolean(cronSecret) &&
    timingSafeEqualStr(
      request.headers.get("authorization") ?? "",
      `Bearer ${cronSecret}`,
    );

  if (!authorized) {
    try {
      await requireStaff();
      authorized = true;
    } catch {
      // fall through — no valid staff session either
    }
  }
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const idleBefore = new Date(startedAt - IDLE_MS);

  const candidates = await db.scrapeJob.findMany({
    where: {
      status: { in: ["QUEUED", "RUNNING"] },
      updatedAt: { lt: idleBefore },
      // Content Lab fixtures are a staged APPEARANCE of a scraper mid-flight,
      // not work anybody queued. Found by running this: the first drain drove
      // `demo-job-003` to FAILED, which quietly rewrites what the demo set
      // looks like. Demo rows are excluded by clause here, the way every
      // public reader spreads `demoWhere()`.
      isDemo: false,
    },
    // Oldest heartbeat first: the job that has been abandoned longest is the
    // one most likely to be genuinely unattended.
    orderBy: { updatedAt: "asc" },
    take: MAX_JOBS,
    select: { id: true, sourceKey: true },
  });

  const drained: JobResult[] = [];

  for (const candidate of candidates) {
    // Advance each job until it finishes or the budget runs out. A job left
    // mid-crawl is picked up by the next tick — `cursorPage` is the resume
    // point and always has been.
    for (;;) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      let snapshot;
      try {
        snapshot = await advanceScrapeJob(candidate.id, null);
      } catch (err) {
        // One bad source must not abort the whole drain. The job itself keeps
        // whatever state the runner left it in; the breaker counts the failure.
        drained.push({
          id: candidate.id,
          sourceKey: candidate.sourceKey,
          status: "ERROR",
          cursorPage: -1,
          totalScraped: -1,
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }
      if (snapshot.status !== "RUNNING") {
        drained.push({
          id: snapshot.id,
          sourceKey: candidate.sourceKey,
          status: snapshot.status,
          cursorPage: snapshot.cursorPage,
          totalScraped: snapshot.totalScraped,
          ...(snapshot.error ? { error: snapshot.error } : {}),
        });
        break;
      }
      // Still RUNNING — record progress and keep going within the budget.
      const last = drained[drained.length - 1];
      const entry: JobResult = {
        id: snapshot.id,
        sourceKey: candidate.sourceKey,
        status: snapshot.status,
        cursorPage: snapshot.cursorPage,
        totalScraped: snapshot.totalScraped,
      };
      if (last && last.id === snapshot.id) drained[drained.length - 1] = entry;
      else drained.push(entry);
    }
  }

  return Response.json({
    checked: candidates.length,
    drained,
    elapsedMs: Date.now() - startedAt,
    budgetExhausted: Date.now() - startedAt > TIME_BUDGET_MS,
  });
}
