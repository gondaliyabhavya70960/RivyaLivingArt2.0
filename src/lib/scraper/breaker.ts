/**
 * The circuit breaker: stop asking a site that keeps saying no.
 *
 * A scrape that fails five times running is not unlucky. The site is down,
 * has changed shape, or is blocking us — and continuing to send it requests
 * every time someone presses Scrape is both useless and the fastest way to
 * turn a soft block into a hard one.
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
export function describeTrip(
  sourceName: string,
  failures: number,
): string {
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
