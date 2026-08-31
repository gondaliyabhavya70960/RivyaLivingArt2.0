"use client";

import { type ReactNode, useEffect, useState } from "react";

import { MotionPauseToggle, useMotionPaused } from "@/hooks/use-motion-paused";
import { cn } from "@/lib/utils";

/**
 * v2.0 storefront Marquee (DESIGN.md B3 · B2 §2 featured rail). CSS-only
 * motion via the animate-marquee keyframes (globals.css): the track
 * renders its content TWICE so the -50% translate loops seamlessly. Pauses
 * on hover; the global reduced-motion collapse (Appendix A) stops it, and
 * motion-reduce:animate-none guarantees the duplicate never scrolls for
 * reduced-motion users (B4 performance & a11y law: every effect has a
 * static fallback).
 *
 * Client component since the Part 0 audit (A10-001): an infinite >5s loop
 * needs a user-reachable pause beyond hover, so the marquee registers the
 * shared WCAG 2.2.2 MotionPauseToggle chip (deduped, portalled to <body> —
 * the band wrapper is aria-hidden) and honors the shared paused state via
 * an inline animation-play-state, which outranks the hover rule. The chip
 * registers only where the loop can actually run: hover-capable pointers
 * with no reduced-motion preference (the classes already keep the track
 * static everywhere else).
 */
export function Marquee({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const paused = useMotionPaused();
  const [loopCanRun, setLoopCanRun] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(
      "(hover: hover) and (prefers-reduced-motion: no-preference)",
    );
    const update = () => setLoopCanRun(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <div data-slot="sf-marquee" className={cn("overflow-hidden", className)}>
      <div
        style={paused ? { animationPlayState: "paused" } : undefined}
        className="flex w-max animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] [@media(hover:none)]:animate-none motion-reduce:animate-none"
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden className="flex shrink-0 items-center">
          {children}
        </div>
      </div>
      {loopCanRun && <MotionPauseToggle />}
    </div>
  );
}
