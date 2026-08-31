"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * CarouselNav — REDESIGN.md §4.6 and §20.4.
 *
 * 48×48px circular buttons, 1px hairline, Lucide chevron, hover raises the
 * border contrast, `active:scale-95`, disabled at 30% opacity with pointer
 * events off. Never smaller than 44px. The press feedback is the one place
 * §3.6's "no scale on hover" does not apply — it is an *active* state on a
 * control with no label, and without it the button gives no feedback at all.
 *
 * Chevrons mirror under RTL; the buttons themselves keep their DOM order and
 * swap meaning with the writing direction, which is what `start`/`end` already
 * does for the flex row.
 */
export function CarouselNav({
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  prevLabel,
  nextLabel,
  className,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  /** Translated, e.g. "Previous pieces". Required — an icon-only control
   *  with no accessible name is unusable (Part 17). */
  prevLabel: string;
  nextLabel: string;
  className?: string;
}) {
  const base =
    "inline-flex size-12 items-center justify-center rounded-full border border-hairline bg-transparent text-ink outline-none " +
    "transition-[border-color,color] duration-(--dur-fast) ease-(--ease-luxury) " +
    "hover:border-ink/40 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 " +
    "disabled:pointer-events-none disabled:opacity-30 " +
    "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 " +
    "in-data-[theme=navy]:border-hairline-dk in-data-[theme=navy]:text-mineral in-data-[theme=navy]:hover:border-mineral/40";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={prevLabel}
        className={base}
      >
        <ChevronLeft
          aria-hidden
          strokeWidth={1.5}
          className="size-5 rtl:-scale-x-100"
        />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label={nextLabel}
        className={base}
      >
        <ChevronRight
          aria-hidden
          strokeWidth={1.5}
          className="size-5 rtl:-scale-x-100"
        />
      </button>
    </div>
  );
}

/**
 * The scroll-snap rail the nav drives. Full touch-swipe on mobile and tablet
 * (§4.6) comes free from `overflow-x-auto` + `snap-x`; the buttons page it by
 * one viewport-width of track, and their disabled states track the real
 * scroll position rather than an index the rail might not agree with.
 *
 * The scrollbar is hidden visually but the rail stays keyboard-scrollable and
 * `tabIndex={0}` gives it a focus stop, so a keyboard user is never trapped
 * behind a swipe gesture.
 */
export function useCarouselRail() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ canPrev: false, canNext: false });

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setState({
      canPrev: el.scrollLeft > 4,
      canNext: el.scrollLeft < max - 4,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    // ResizeObserver fires once on observe — that is where the first sync
    // happens, never synchronously in the effect body.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  const page = useCallback((direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({
      left: direction * Math.round(el.clientWidth * 0.85),
      behavior: reduced ? "auto" : "smooth",
    });
  }, []);

  return {
    ref,
    canPrev: state.canPrev,
    canNext: state.canNext,
    prev: () => page(-1),
    next: () => page(1),
  };
}
