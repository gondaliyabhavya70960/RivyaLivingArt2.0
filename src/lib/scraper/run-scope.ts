/**
 * One run per source at a time.
 *
 * Two jobs against the same site double its request rate for no extra
 * coverage — they crawl the same pages — and the second one's rows land on top
 * of the first's mid-flight. Nothing prevented it before: a double click on
 * Scrape, or a tier button pressed twice, was enough.
 *
 * The decision is pure, so it lives here rather than inside the Server Action
 * where it cannot be tested without a database. The actions supply the two
 * lists; this decides.
 *
 * A QUEUED job counts as in-flight. It has not started, so starting another is
 * the same mistake a moment earlier.
 *
 * A RUNNING job can also be a LIE: a serverless invocation that crashed mid
 * page never got to write FAILED, and without a heartbeat that source would
 * be "spoken for" forever — no scrape of it could ever be queued again.
 * `ScrapeJob.updatedAt` (bumped by every write, including the per-page
 * optimistic advance in `continueScrapeJob`) is that heartbeat, and
 * `isStaleRunning` / the optional `staleBefore` cutoff below are what let a
 * dead RUNNING job stop blocking a fresh one.
 */

/** The job states that mean "this source is spoken for". */
export const IN_FLIGHT_STATUSES = ["QUEUED", "RUNNING"] as const;

export type ScopedSource = { id: string; name: string };

/** The shape of an in-flight job `partitionByInFlight` needs to judge it. */
export type InFlightJob = {
  sourceId: string | null;
  status: string;
  updatedAt: Date;
};

export type RunScope<T extends ScopedSource> = {
  /** Sources with no job in flight — these get queued. */
  queueable: T[];
  /** Names of the sources skipped, for the operator's report. */
  skipped: string[];
};

/**
 * A RUNNING job is presumed dead once its heartbeat predates `staleBefore` —
 * a crashed invocation never got to mark it FAILED. It stays resumable by id
 * through `continueScrapeJob` (an operator can still press Resume on it), but
 * it no longer counts as "this source is busy" for a fresh run.
 *
 * QUEUED never goes stale this way, regardless of `staleBefore`: it means
 * "not started yet", not "died mid-flight", and an unattended QUEUED job is
 * exactly what the "one run per source" guard exists to leave alone.
 *
 * `staleBefore` is optional and undefined skips the check entirely — every
 * caller that has not opted into a cutoff keeps today's behaviour.
 */
export function isStaleRunning(
  job: Pick<InFlightJob, "status" | "updatedAt">,
  staleBefore: Date | undefined,
): boolean {
  return (
    staleBefore !== undefined &&
    job.status === "RUNNING" &&
    job.updatedAt.getTime() < staleBefore.getTime()
  );
}

/**
 * Split a batch into what may run and what is already running.
 *
 * Skipped rows are reported by NAME rather than id: the operator picked a tier,
 * not a set of cuids, and "skipped 3 already running" without saying which
 * three is a message that cannot be acted on.
 */
export function partitionByInFlight<T extends ScopedSource>(
  sources: readonly T[],
  inFlightJobs: readonly InFlightJob[],
  opts: { staleBefore?: Date } = {},
): RunScope<T> {
  const busy = new Set<string>();
  for (const job of inFlightJobs) {
    if (!job.sourceId) continue; // ScrapeJob.sourceId is nullable (onDelete: SetNull)
    if (isStaleRunning(job, opts.staleBefore)) continue;
    busy.add(job.sourceId);
  }
  const queueable: T[] = [];
  const skipped: string[] = [];
  for (const source of sources) {
    if (busy.has(source.id)) skipped.push(source.name);
    else queueable.push(source);
  }
  return { queueable, skipped };
}
