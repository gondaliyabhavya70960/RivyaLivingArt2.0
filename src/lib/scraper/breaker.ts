/**
 * The circuit breaker: stop asking a site that keeps saying no.
 *
 * A scrape that fails five times running is not unlucky. The site is down,
 * has changed shape, or is blocking us — and continuing to send it requests
 * every time someone presses Scrape is both useless and the fastest way to
 * turn a soft block into a hard one.
 *
 * State is recorded against the `ScrapeSource` found by its stable `key`
 * (== `ScrapeJob.sourceKey`), not by the job's `sourceId` foreign key.
 * `sourceId` is nullable (`onDelete: SetNull`) — a source row can be deleted
 * out from under jobs that already reference it — while `sourceKey` is a
 * plain string column that survives that. Looking up by key means a source
 * re-registered under the same key (the common case: delete and re-add while
 * fixing a broken adapter) keeps its failure history instead of restarting
 * silently disconnected from the jobs that were failing.
 *
 * Pure module. The decision is the feature; the wiring around it needs a
 * database and a real failing site before a test could reach it.
 */

/** Consecutive failures before a source is paused. */
export const BREAKER_THRESHOLD = 5;

export type BreakerState = {
  consecutiveFailures: number;
  pausedAt: Date | null;
  pausedReason: string | null;
};

/**
 * The failure counter after a job finishes.
 *
 * A success resets to zero rather than decrementing: a source that fails,
 * succeeds, then fails is having a bad day, not blocking us, and a decaying
 * counter would eventually trip on those and pause a working source.
 */
export function nextFailureCount(
  current: number,
  outcome: "DONE" | "FAILED",
): number {
  return outcome === "DONE" ? 0 : current + 1;
}

/** Does this count trip the breaker? */
export function shouldTrip(
  failures: number,
  threshold: number = BREAKER_THRESHOLD,
): boolean {
  return failures >= threshold;
}

/** The reason recorded on the source, in the operator's words. */
export function describeTrip(sourceName: string, failures: number): string {
  return `Paused after ${failures} consecutive failed scrapes. Check the site is reachable and the adapter still matches, then resume ${sourceName}.`;
}

/**
 * Why a scrape may not start, or null when it may.
 *
 * Kept separate from the trip decision because they answer different
 * questions at different moments: one is "should I pause this now", the other
 * is "may I run right now".
 */
export function describeBlockedRun(
  sourceName: string,
  state: Pick<BreakerState, "pausedAt" | "pausedReason">,
): string | null {
  if (!state.pausedAt) return null;
  return (
    state.pausedReason ??
    `${sourceName} is paused after repeated failures. Resume it to scrape again.`
  );
}

/** Politeness delay for a source: its own, else the shared default. */
export function resolveDelayMs(
  sourceDelayMs: number | null | undefined,
  fallback: number,
): number {
  if (typeof sourceDelayMs !== "number" || !Number.isFinite(sourceDelayMs)) {
    return fallback;
  }
  // Never faster than the shared default — the per-source knob exists to slow
  // down for a site that rate-limits us, not to speed up past our own floor.
  return Math.max(fallback, Math.min(sourceDelayMs, 60_000));
}

/**
 * Log line for when a finished job's breaker bookkeeping has nowhere to go —
 * no `ScrapeSource` is registered under its `sourceKey` any more (deleted,
 * and never re-added). Not an error: the job's own row — its counts, its
 * staged products — is unaffected either way; there is simply no source row
 * left to trip or reset.
 */
export function describeBreakerSkip(sourceKey: string): string {
  return `breaker: no ScrapeSource registered under "${sourceKey}" — skipping consecutive-failure bookkeeping for this job.`;
}
