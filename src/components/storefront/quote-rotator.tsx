"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

/** §5.1's cadence, reused: the announcement strip rotates on the same clock. */
const ROTATE_MS = 6000;
const FADE_MS = 350;

export type QuoteRotatorLabels = {
  /** Accessible name of the pause control while it is running. */
  pause: string;
  /** …and once it is paused. */
  resume: string;
  /**
   * One dot label per slide, already translated.
   *
   * An array rather than a `(index) => string` formatter: this is a client
   * component, and a function cannot cross the server boundary — React
   * refuses the prop outright ("Functions cannot be passed directly to Client
   * Components"). The server knows how many slides there are, so it can
   * resolve the labels before handing them over.
   */
  show: string[];
};

/**
 * One quote at a time, on the announcement bar's clock — spec §3.1 S6.
 *
 * The spec asks for "a single oversized quote … auto-rotates every 6s with a
 * vertical mask transition; 3 tiny mono dots as progress". This is the
 * rotation half; the slides themselves are whatever the server renders and
 * hands down as `items` (on the homepage, `FeaturedTestimonial`, which is an
 * async server component and so cannot be constructed inside a client one —
 * the same arrangement `SnapRail` already uses).
 *
 * ── Three decisions worth stating ──────────────────────────────────────────
 *
 * IT STACKS RATHER THAN SWAPS. Every slide occupies the same grid cell, so the
 * band is always as tall as its LONGEST quote. Rendering one node and
 * replacing it would have made the section's height a function of which
 * testimonial happened to be showing, and a band that resizes itself every six
 * seconds is cumulative layout shift on a timer — against a CLS budget of 0.1.
 * The cost is that all three slides are in the DOM, which is why the inactive
 * ones carry BOTH `aria-hidden` and `inert`: without them a screen reader
 * would read three quotes as one run-on paragraph and the keyboard would tab
 * into the invisible ones.
 *
 * IT IS NOT A LIVE REGION, deliberately, and `announcement-bar.tsx` states the
 * same rule for the same reason: content that changes on a timer the visitor
 * did not ask for must not interrupt them. The dots carry `aria-current`, so
 * position is available on demand rather than announced.
 *
 * IT CAN ALWAYS BE STOPPED — WCAG 2.2.2. Rotation halts on hover, on focus
 * anywhere inside, on an explicit pause control, and entirely under
 * `prefers-reduced-motion`, where the first quote simply stands. `axe-core`
 * does not test for this, so it is a rule the component has to keep itself.
 */
export function QuoteRotator({
  items,
  labels,
  className,
}: {
  items: ReactNode[];
  labels: QuoteRotatorLabels;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [faded, setFaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const rotating = !reducedMotion && items.length > 1 && !paused && !hovered;

  /* Every 6s: fade out… */
  useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => setFaded(true), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotating]);

  /* …then swap once the crossfade has finished. Two effects rather than one
     because the swap must happen at the END of the fade, and setState in the
     interval body would change the quote under a visitor mid-read. */
  useEffect(() => {
    if (!faded) return;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % items.length);
      setFaded(false);
    }, FADE_MS);
    return () => window.clearTimeout(id);
  }, [faded, items.length]);

  if (items.length === 0) return null;

  const active = reducedMotion ? 0 : index % items.length;
  const showControls = items.length > 1;

  const jumpTo = (next: number) => {
    setPaused(true); // a deliberate choice outranks the timer
    setFaded(false);
    setIndex(next);
  };

  return (
    <div
      data-slot="sf-quote-rotator"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={cn("flex flex-col gap-10", className)}
    >
      {/* The stack. `grid-area: 1/1` on every child is what keeps the height
          at the tallest quote instead of the current one. */}
      <div className="grid">
        {items.map((item, i) => {
          const isActive = i === active;
          return (
            <div
              key={i}
              {...(isActive ? {} : { "aria-hidden": true, inert: true })}
              className={cn(
                "col-start-1 row-start-1 transition-opacity ease-(--ease-luxury) motion-reduce:transition-none",
                isActive && !faded
                  ? "opacity-100"
                  : "pointer-events-none opacity-0",
              )}
              style={{ transitionDuration: `${FADE_MS}ms` }}
            >
              {item}
            </div>
          );
        })}
      </div>

      {showControls ? (
        <div className="flex items-center gap-4">
          {/* Dots: progress AND direct access. Buttons, not decoration — a
              visitor who wants the second quote should not have to wait. */}
          <ul className="flex items-center gap-2">
            {items.map((_, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-label={labels.show[i]}
                  aria-current={i === active ? "true" : undefined}
                  onClick={() => jumpTo(i)}
                  // 44px target via an expanded hit area rather than a 44px
                  // dot, which would stop being a dot.
                  className={cn(
                    "relative block size-1.5 rounded-full outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) after:absolute after:-inset-3 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 motion-reduce:transition-none",
                    i === active ? "bg-ink" : "bg-ink/25 hover:bg-ink/50",
                  )}
                />
              </li>
            ))}
          </ul>

          {!reducedMotion ? (
            <button
              type="button"
              aria-pressed={paused}
              aria-label={paused ? labels.resume : labels.pause}
              onClick={() => setPaused((p) => !p)}
              className="relative inline-flex size-7 items-center justify-center rounded-full text-ink/55 outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) after:absolute after:-inset-2.5 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {paused ? (
                <Play aria-hidden strokeWidth={1.5} className="size-3.5" />
              ) : (
                <Pause aria-hidden strokeWidth={1.5} className="size-3.5" />
              )}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
