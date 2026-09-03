/**
 * First-visit sequencing between the Preloader overlay and entrance motion
 * (Part 0 audit S-03, closed in Phase 1). The --z-preloader overlay covered
 * the hero heading's SplitText reveal for its whole show window, wasting the
 * one playback a first-time visitor gets. The Preloader arms this gate the
 * moment it decides to show and releases it when its exit fade STARTS (the
 * heading then animates through the overlay's fade-out — a brand→hero
 * crossfade), with release guaranteed by the Preloader's own hard-stop path.
 *
 * Client-only module state; both parties are client components. A consumer
 * that runs before the Preloader's decision frame simply sees no gate —
 * worst case is the pre-fix behavior.
 */

let pending: Promise<void> | null = null;
let release: (() => void) | null = null;

/** Preloader: call when the overlay WILL show this page view. */
export function armPreloaderGate(): void {
  if (pending) return;
  pending = new Promise<void>((resolve) => {
    release = resolve;
  });
}

/** Preloader: call when the exit fade starts (and from every teardown path). */
export function releasePreloaderGate(): void {
  release?.();
  release = null;
  pending = null;
}

/**
 * Entrance effects: await this before hiding content for a reveal. Resolves
 * immediately when no overlay is showing.
 */
export function preloaderGate(): Promise<void> {
  return pending ?? Promise.resolve();
}
