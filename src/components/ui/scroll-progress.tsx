"use client";

import { useEffect, useRef, useState } from "react";

/**
 * §6.3 · the scroll progress hairline — 2px champagne pinned to the viewport
 * top, `scaleX` = page progress.
 *
 * THIS REPLACES `blog/reading-progress.tsx`, which is deleted in the same
 * commit (owner decision 12: "one progress component"). That component was
 * article-only and sapphire; this one is global and champagne, per §6.3 and
 * D30 — on obsidian, champagne is 7.5:1 where sapphire is 3.2:1, and a 2px
 * rule at 3.2:1 is a rule nobody sees.
 *
 * Four things carried over from the component it replaces, because each was
 * right and re-deriving them would be a regression:
 *
 * - **It is not motion.** The fill is a 1:1 mapping of the reader's own
 *   scroll position. Nothing eases, nothing runs on its own, so there is no
 *   `prefers-reduced-motion` frame to collapse TO — the resting frame IS the
 *   behaviour. §6.3's "static 0-width (hidden)" is what a page shorter than
 *   the viewport already renders.
 * - **Writes are `transform` only**, coalesced into one rAF per frame, on a
 *   passive listener. No layout, no paint outside the bar's own 2px strip.
 * - **It sits ABOVE the header** (`--z-progress`, the rung reserved for
 *   exactly this) rather than under its translucent bar, where an 88%-opaque
 *   ground would wash it out. It stays below `--z-scrim` so an open drawer
 *   covers it.
 * - **No GSAP.** §6.3's table row says "gsap ScrollTrigger"; owner decision
 *   13 overrules it — the budget is 45 KB spec / 49 KB ceiling and GSAP +
 *   Lenis already spend 49, so there is no headroom for a new import. A
 *   scroll listener and a transform is the whole implementation anyway;
 *   ScrollTrigger would have bought nothing here.
 *
 * TWO THINGS ARE NEW, and both come from §0's merge of the interaction notes:
 *
 * **It is announced, at a throttle.** The component it replaces was
 * `aria-hidden` on the argument that the scrollbar already conveys position.
 * That holds for a sighted mouse user and not for a screen-reader user on a
 * long article, so this exposes `role="progressbar"` with `aria-valuenow` —
 * but updates it at most 4×/sec, because an `aria-valuenow` that moves on
 * every frame is a live region that never stops talking. The visual bar still
 * tracks every frame; only the announced value is coarse.
 *
 * **It hides on pages shorter than 1.5× the viewport.** A progress bar on a
 * page with 300px of scroll is decoration reporting on nothing. Measured on
 * mount and on resize, not guessed from the route.
 */

/** §0 · the announced value moves at most this often. The bar does not. */
const ARIA_THROTTLE_MS = 250;
/** Below this ratio of scrollable content to viewport, there is nothing to report. */
const MIN_PAGE_RATIO = 1.5;

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  // Mounted-but-idle vs. genuinely absent are different: a short page renders
  // no element at all, so it cannot be read by assistive tech either.
  const [visible, setVisible] = useState(false);
  const [announced, setAnnounced] = useState(0);

  useEffect(() => {
    let frame = 0;
    let lastAria = 0;

    const paint = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const long = doc.scrollHeight >= doc.clientHeight * MIN_PAGE_RATIO;
      setVisible(long);
      if (!long) return;

      const p = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
      // The bar is a direct DOM write, never state: one per frame, no React
      // render, no reconciliation on a scroll handler.
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;

      const now = performance.now();
      if (now - lastAria >= ARIA_THROTTLE_MS) {
        lastAria = now;
        setAnnounced(Math.round(p * 100));
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      data-slot="scroll-progress"
      role="progressbar"
      aria-label="Page scrolled"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={announced}
      // `data-route-busy` is set on <html> by RouteProgress. The two bars
      // share `--z-progress` and the same 2px strip of screen, so §6.4's rule
      // — the route bar wins — is enforced HERE, in CSS, rather than by the
      // two components trying to know about each other's state.
      className="pointer-events-none fixed inset-x-0 top-0 z-(--z-progress) h-0.5 in-data-[route-busy]:opacity-0"
    >
      <div
        ref={barRef}
        className="h-full origin-left scale-x-0 bg-champagne rtl:origin-right"
      />
    </div>
  );
}
