"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CarouselNav } from "@/components/storefront/carousel-nav";
import { cn } from "@/lib/utils";

export type SnapRailLabels = {
  /** Translated "Previous", passed straight to `CarouselNav`'s button. */
  prev: string;
  /** Translated "Next". */
  next: string;
  /** Translated "of" — used only for the screen-reader position
   *  announcement ("3 of 8"), never printed in the visible mono counter. */
  of: string;
};

/**
 * SnapRail — a horizontal `scroll-snap` track with a mono `N / M` counter
 * and `CarouselNav`'s prev/next buttons (its first mounted consumer).
 *
 * No autoplay: every use of this component is a browsing rail, not a
 * marquee — REDESIGN.md Part 14 lists the marquee as its own, separate
 * device with its own reduced-motion story, and this is not it.
 *
 * The track is native `overflow-x-auto` + `snap-x snap-mandatory`, so full
 * touch-swipe comes free and a keyboard user can Tab onto the track itself
 * (`tabIndex=0`) and arrow/scroll it without ever touching the buttons — the
 * buttons are a convenience, not the only path through the rail.
 *
 * The active index (for the counter and the buttons' disabled state) is
 * tracked by measuring which child's own start edge is closest to the
 * track's start edge, rather than by dividing `scrollLeft` — item widths on
 * this site are rarely uniform (a lead tile beside supporting ones), and
 * `scrollLeft`'s sign convention is not even consistent across browsers in
 * `dir="rtl"`, which the edge-distance measurement sidesteps entirely by
 * reading `getBoundingClientRect()` (already physical, already correct)
 * against `document.dir`.
 */
export function SnapRail({
  items,
  labels,
  className,
  itemClassName,
  ariaLabel,
}: {
  /** Already-rendered children — one per rail item. */
  items: ReactNode[];
  labels: SnapRailLabels;
  className?: string;
  /** Applied to each `<li>` in addition to `snap-start shrink-0`. */
  itemClassName?: string;
  ariaLabel: string;
}) {
  const railRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [active, setActive] = useState(0);
  const frame = useRef(0);

  const syncActive = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const rtl = document.dir === "rtl";
    const railRect = rail.getBoundingClientRect();
    const railStart = rtl ? railRect.right : railRect.left;

    let closest = 0;
    let closestDistance = Infinity;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const itemStart = rtl ? rect.right : rect.left;
      const distance = Math.abs(itemStart - railStart);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = i;
      }
    });
    setActive(closest);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        syncActive();
      });
    };

    // ResizeObserver fires once on observe — that first call is where the
    // initial sync happens, never synchronously in the effect body.
    const ro = new ResizeObserver(onScroll);
    ro.observe(rail);
    rail.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      rail.removeEventListener("scroll", onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [syncActive, items.length]);

  const scrollByRail = useCallback((direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const rtl = document.dir === "rtl";
    const sign = rtl ? -1 : 1;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    rail.scrollBy({
      left: direction * sign * rail.clientWidth,
      behavior: reduced ? "auto" : "smooth",
    });
  }, []);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <ul
        ref={railRef}
        role="list"
        aria-label={ariaLabel}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto md:gap-6 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <li
            key={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className={cn("shrink-0 snap-start", itemClassName)}
          >
            {item}
          </li>
        ))}
      </ul>

      {items.length > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <span
            className="u-num text-graphite in-data-[theme=navy]:text-mist"
            aria-hidden
          >
            {String(active + 1).padStart(2, "0")} /{" "}
            {String(items.length).padStart(2, "0")}
          </span>
          <span className="sr-only" aria-live="polite">
            {active + 1} {labels.of} {items.length}
          </span>
          <CarouselNav
            onPrev={() => scrollByRail(-1)}
            onNext={() => scrollByRail(1)}
            canPrev={active > 0}
            canNext={active < items.length - 1}
            prevLabel={labels.prev}
            nextLabel={labels.next}
          />
        </div>
      ) : null}
    </div>
  );
}
