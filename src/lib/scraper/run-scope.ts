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
 */

/** The job states that mean "this source is spoken for". */
export const IN_FLIGHT_STATUSES = ["QUEUED", "RUNNING"] as const;

export type ScopedSource = { id: string; name: string };

export type RunScope<T extends ScopedSource> = {
  /** Sources with no job in flight — these get queued. */
  queueable: T[];
  /** Names of the sources skipped, for the operator's report. */
  skipped: string[];
};

/**
 * Split a batch into what may run and what is already running.
 *
 * Skipped rows are reported by NAME rather than id: the operator picked a tier,
 * not a set of cuids, and "skipped 3 already running" without saying which
 * three is a message that cannot be acted on.
 */
export function partitionByInFlight<T extends ScopedSource>(
  sources: readonly T[],
  busySourceIds: readonly (string | null)[],
): RunScope<T> {
  const busy = new Set(busySourceIds.filter((id): id is string => Boolean(id)));
  const queueable: T[] = [];
  const skipped: string[] = [];
  for (const source of sources) {
    if (busy.has(source.id)) skipped.push(source.name);
    else queueable.push(source);
  }
  return { queueable, skipped };
}
