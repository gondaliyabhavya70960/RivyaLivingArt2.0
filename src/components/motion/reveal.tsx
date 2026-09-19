"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useIsTouch } from "@/hooks/use-is-touch";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

// Type-only view of the GSAP module — ships no code (H12).
type GsapModule = typeof import("@/lib/gsap");
type ScrollTriggerInstance = InstanceType<GsapModule["ScrollTrigger"]>;
type Tween = ReturnType<GsapModule["gsap"]["fromTo"]>;

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay before the reveal starts, in seconds. */
  delay?: number;
  /** Distance the content rises from, in px. Defaults to 24. */
  y?: number;
  /**
   * Seconds between direct children. 0 (default) animates the wrapper as
   * one block; > 0 staggers each direct child instead.
   */
  stagger?: number;
  /** Reveal only the first time it enters the viewport. Defaults to true. */
  once?: boolean;
}

/**
 * The v2.0 section reveal (DESIGN.md B4): fade-up + slight scale, optionally
 * staggered across direct children, `power2.out`, 0.7s — inside A5's
 * 400–800ms entrance window. SSR and the initial client render always emit
 * plain, fully visible markup — the hidden state only applies once the
 * dynamically imported runtime lands, so content is never hidden without JS.
 * Under reduced motion AND on touch-primary devices the effect bails before
 * the import (PR-6: static render, zero motion bytes — the same degraded
 * path, and the same guard, as SmoothScrollProvider and HeroParallax).
 * For BELOW-the-fold sections only: the from-state applies when the runtime
 * lands, so an above-the-fold Reveal would flash on slow connections.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  stagger = 0,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  // PERF (A1/PR-6): bail on touch before the GSAP import, on the same guard
  // SmoothScrollProvider (PERF-009) and HeroParallax already use — a low-end
  // phone runs no ScrollTrigger work and downloads no motion bytes for this,
  // and the content shows exactly as it does under reduced motion. This was
  // the last unguarded scroll effect: mobile Lighthouse measured script
  // evaluation and layout as the entire TBT problem.
  const isTouch = useIsTouch();
  const disabled = prefersReducedMotion || isTouch;

  useEffect(() => {
    const el = ref.current;
    if (disabled || !el) return;

    let cancelled = false;
    // Set once the dynamic import lands, so unmount before (or during) the
    // load tears nothing down — there is nothing to tear down yet.
    let cleanup: (() => void) | undefined;

    void (async () => {
      const { gsap } = await import("@/lib/gsap");
      if (cancelled) return;

      const targets: Element | Element[] =
        stagger > 0 ? Array.from(el.children) : el;

      let tween: Tween | null = gsap.fromTo(
        targets,
        // No scale: Part 14 lists rise and opacity only. A scaling text
        // block re-rasterises its glyphs mid-animation, which is exactly the
        // "technology demo" the motion section opens by rejecting.
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          // Part 14: card/text reveal is a 16–24px rise + opacity over
          // 350ms, triggered at 85% of the viewport, once. The old 0.7s was
          // twice the specified duration and read as a page that hesitates.
          duration: 0.35,
          delay,
          ...(stagger > 0 && { stagger }),
          // Part 3.8's house curve — registered on the shared gsap instance
          // by src/lib/gsap.ts, from the same control points tokens.css's
          // `--ease-luxury` uses, so this reveal moves on the identical
          // curve every CSS transition on the site does.
          ease: "luxury",
          // A settled reveal needs no transform layer — release it so the
          // browser can drop the compositing surface.
          onComplete: () => {
            if (once) gsap.set(targets, { clearProps: "transform" });
          },
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: once
              ? "play none none none"
              : "play reverse play reverse",
          },
        },
      );

      cleanup = () => {
        if (tween) {
          // The instance property isn't in gsap's type augmentations, only
          // the vars — narrow it manually so the trigger dies with the tween.
          (
            tween as unknown as { scrollTrigger?: ScrollTriggerInstance }
          ).scrollTrigger?.kill();
          tween.kill();
          tween = null;
        }
        gsap.set(targets, { clearProps: "opacity,transform" });
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [disabled, delay, y, stagger, once]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
