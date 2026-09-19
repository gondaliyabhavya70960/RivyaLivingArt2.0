"use client";

import { useSyncExternalStore } from "react";

/**
 * "Is this visitor asking us not to spend their data?"
 *
 * ## Why this exists — 1.6 MB, measured
 *
 * The homepage transfers ~1.8 MB on a cold desktop load and **1.6 MB of that
 * is the hero loop** (`/redesign/hero-pour-loop.webm`). `preload="metadata"`
 * is set and does nothing here, because `autoPlay` overrides it: a browser
 * told to play a video downloads the video.
 *
 * That is within §15.4's 2.5 MB ceiling and it is not a bug — the loop is
 * meant to play. `HeroMedia` already withholds it on `prefers-reduced-motion`
 * and on coarse pointers, so phones never pay it. What was left uncovered is
 * the visitor on a metered or slow connection who is NOT on a phone: a laptop
 * tethered to a handset, café or hotel wifi, a rural line. This site sells to
 * India and finalises every order over WhatsApp; that visitor is not a corner
 * case.
 *
 * Nothing is lost by withholding it. The poster is a `priority` image and the
 * LCP element either way (`hero-media.tsx`), so the hero renders identically —
 * it simply does not animate.
 *
 * ## Chromium-only, and that is fine
 *
 * `navigator.connection` is not implemented in Safari or Firefox. There is no
 * polyfill worth having: the honest answer there is "unknown", and unknown
 * must mean "behave as before" rather than "withhold". So every branch that
 * cannot answer returns false and the video plays exactly as it does today.
 * This can only ever REMOVE bytes from someone who asked for fewer.
 */

/** The shape we use, narrowed from the Network Information API. */
type ConnectionLike = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

function connection(): ConnectionLike | undefined {
  return (navigator as Navigator & { connection?: ConnectionLike }).connection;
}

/**
 * The decision, as a pure function, so it can be tested without a browser.
 *
 * `slow-2g` and `2g` are withheld; `3g` is NOT. A 3G connection carries 1.6 MB
 * in a few seconds and the loop is the brand's one piece of motion — the bar
 * for taking it away is an explicit Data Saver request or a connection where
 * the video would still be buffering when the visitor has left.
 */
export function prefersLessData(c: ConnectionLike | undefined): boolean {
  if (!c) return false;
  if (c.saveData === true) return true;
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

function subscribe(onChange: () => void) {
  const c = connection();
  c?.addEventListener?.("change", onChange);
  return () => c?.removeEventListener?.("change", onChange);
}

/**
 * True when the visitor has Data Saver on, or is on a 2G-class connection.
 *
 * Defaults to FALSE during SSR — deliberately the opposite of
 * `usePrefersReducedMotion`, which defaults true. That hook defaults to the
 * safe answer because motion can harm; this one defaults to the UNCHANGED
 * answer, because withholding the hero loop from everyone for one hydration
 * tick would be a visible regression paid by every visitor to save bytes for
 * a few.
 */
export function useSaveData(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => prefersLessData(connection()),
    () => false,
  );
}
