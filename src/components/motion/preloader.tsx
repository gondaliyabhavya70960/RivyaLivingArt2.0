"use client";

import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { SITE } from "@/lib/constants";
import {
  armPreloaderGate,
  releasePreloaderGate,
} from "@/lib/preloader-signal";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rr-preloader-shown";
/** Wordmark holds for this long before the exit animation starts (PERF-007:
 *  a brief brand flash, not a 1.4s hold). */
const EXIT_AFTER_MS = 600;
/** Hard ceiling — the overlay is force-removed no matter what. */
const MAX_BLOCK_MS = 1200;

type Phase = "deciding" | "showing" | "exiting" | "gone";

/**
 * v2.0 "Midnight Gild" first-visit overlay (DESIGN.md B4): the wordmark on
 * navy-midnight, its letters filling left-to-right with liquid gold via a
 * background-clip:text gradient sweep (gild-fill-text + animate-gild-fill in
 * globals.css). Shows once per browser session, skips entirely for
 * reduced-motion users, and can never block interaction for longer than
 * MAX_BLOCK_MS (hard fallback removal). M-P1: pure CSS animation/transition —
 * a timed fade needs no animation runtime at all.
 */
export function Preloader() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("deciding");

  // Decide once per mount, on the client only: usePrefersReducedMotion
  // returns true during SSR, so the real matchMedia check happens here.
  useEffect(() => {
    let hideTimer: number | undefined;
    let hardStopTimer: number | undefined;

    // Deciding inside a rAF keeps the effect body free of state updates
    // (react-hooks/set-state-in-effect) at the cost of one frame.
    const raf = window.requestAnimationFrame(() => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      let alreadyShown = false;
      try {
        alreadyShown = window.sessionStorage.getItem(STORAGE_KEY) === "1";
        window.sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // Storage unavailable (privacy mode) — worst case it replays.
      }
      // Hydration landed late (slow network/device) or the user already
      // scrolled: the brand flash only reads as an intro when it genuinely
      // precedes engagement — showing it mid-read would be an interruption.
      const lateArrival = performance.now() > 1500 || window.scrollY > 0;

      if (!reduced && !alreadyShown && !lateArrival) {
        // Hold entrance motion (hero SplitText) until the exit fade starts,
        // so the overlay never eats the one first-visit reveal (S-03).
        armPreloaderGate();
        setPhase("showing");
        hideTimer = window.setTimeout(() => {
          releasePreloaderGate();
          setPhase("exiting");
        }, EXIT_AFTER_MS);
        hardStopTimer = window.setTimeout(() => setPhase("gone"), MAX_BLOCK_MS);
      } else {
        setPhase("gone");
      }
    });

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(hideTimer);
      window.clearTimeout(hardStopTimer);
      // Every teardown path frees waiting entrance effects.
      releasePreloaderGate();
    };
  }, []);

  // PERF-007: the overlay never locks scroll or blocks interaction — it's a
  // pointer-events-none fade over content the user can already scroll/tap.
  // Accepted deviation from B4's "static logo under reduced motion": a
  // reduced-motion user gets NO overlay at all — a static brand flash that
  // then vanishes is itself a (mild) animation, and skipping is the kinder
  // reading of the a11y floor than a flicker they never asked for.
  if (prefersReducedMotion || phase === "deciding" || phase === "gone") {
    return null;
  }

  const exiting = phase === "exiting";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-(--z-preloader) flex items-center justify-center bg-obsidian transition-opacity duration-(--dur-base) ease-(--ease-luxury)",
        exiting && "opacity-0",
      )}
    >
      <p
        className={cn(
          "font-display text-39 tracking-display text-mineral/30 sm:text-49",
          exiting
            ? // Exit: rise away while fading (motion parity: y 0 -> -32).
              "-translate-y-8 opacity-0 transition-[opacity,transform] duration-(--dur-base) ease-(--ease-luxury)"
            : // Enter: rise in from y 24. fill-mode-backwards ends at the
              // natural (visible, untransformed) state, so the exit
              // transition above can take over cleanly.
              "animate-in fade-in slide-in-from-bottom-6 fill-mode-backwards duration-(--dur-base) ease-(--ease-luxury)",
        )}
      >
        {/* Gold "resin fill": the same glyphs twice — a dim ivory base, and a
            gold-gradient copy clipped to the text (gild-fill-text) whose
            background sweeps once left→right during the show window, reading
            as liquid gold filling the letters. The inline-block wrapper pins
            the overlay to exactly the name's box, so the brand dot (solid
            gold from frame one — the drop the fill flows toward) never skews
            alignment. */}
        <span className="relative inline-block">
          {SITE.name}
          <span className="gild-fill-text animate-gild-fill absolute inset-0">
            {SITE.name}
          </span>
        </span>
        <span className="text-champagne">.</span>
      </p>
    </div>
  );
}
