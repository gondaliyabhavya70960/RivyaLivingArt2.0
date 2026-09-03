"use client";

import { useEffect, useRef } from "react";

/**
 * The article reading-progress bar — REDESIGN.md §11.9: "Sticky reading
 * progress bar (2px sapphire at the top of the viewport)."
 *
 * Four things it is deliberately not:
 *
 * - **Not motion.** The fill is a 1:1 mapping of the reader's own scroll
 *   position, so there is nothing to collapse under
 *   `prefers-reduced-motion` — no transition, no easing, nothing that moves
 *   on its own. It is an indicator, the same class of object as a scrollbar.
 * - **Not announced.** `aria-hidden`: the scrollbar already conveys position
 *   to assistive technology, and a second live position readout is noise.
 * - **Not below the header.** The spec puts it at the top of the *viewport*,
 *   so it sits above the sticky header (--z-header) rather than under its
 *   translucent bar, where an 88%-opaque ground would have washed it out.
 *   It stays below the drawer scrim (--z-scrim) so an open menu covers it.
 * - **Not a layout cost.** Writes are `transform` only, coalesced into one
 *   rAF per frame, on a passive listener.
 *
 * Sapphire rather than champagne: Part 3.1 gives champagne to hairlines and
 * micro accents and caps it at two elements per viewport, and the article
 * already spends both on the pull-quote rule and the eyebrow.
 */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let frame = 0;

    const paint = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
      bar.style.transform = `scaleX(${p})`;
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

  return (
    <div
      aria-hidden
      data-slot="sf-reading-progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-(--z-progress) h-0.5 origin-left scale-x-0 bg-sapphire rtl:origin-right"
      ref={barRef}
    />
  );
}
