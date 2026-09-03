"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useIsTouch } from "@/hooks/use-is-touch";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

// Type-only view of the GSAP module — ships no code (H12).
type GsapModule = typeof import("@/lib/gsap");
type ScrollTriggerInstance = InstanceType<GsapModule["ScrollTrigger"]>;
type Tween = ReturnType<GsapModule["gsap"]["fromTo"]>;

export interface HeroParallaxProps {
  children: ReactNode;
  className?: string;
}

// How much slower the media appears to scroll than the page.
const PARALLAX_SHIFT_PERCENT = 12;

/**
 * Hero media parallax (DESIGN.md B4 "Hero: SplitText line reveal +
 * parallax"): as the hero scrolls away, the wrapped media layer translates
 * down by 12% of its own height (`scrub: 0.5`, linear — the smoothing lives
 * in the scrub), so it reads as sitting one plane behind the page.
 *
 * Usage rules — it must wrap ONLY absolutely-positioned media inside an
 * `overflow-hidden` section:
 * - Pass the fill positioning via `className` (e.g. `"absolute inset-0 z-0"`)
 *   so the wrapper itself IS the media layer — `yPercent` is measured
 *   against the wrapper's own height, so the wrapper must own the layer's
 *   box, not sit as a zero-height shell around it.
 * - No oversizing/`scale` is needed: with `start: "top top"` the translation
 *   only begins once the section top passes the viewport top, so the gap it
 *   opens at the section's top edge stays above the viewport for the whole
 *   scrub (holds for any media layer that fills the section, like
 *   home-hero's `inset-0` layers).
 *
 * Desktop-only, like the other pointer-tier effects: bails statically on
 * touch and under reduced motion, before the GSAP import (H12). SSR and the
 * initial client render emit the children plain and fully visible.
 */
export function HeroParallax({ children, className }: HeroParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
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

      let tween: Tween | null = gsap.fromTo(
        el,
        { yPercent: 0 },
        {
          yPercent: PARALLAX_SHIFT_PERCENT,
          ease: "none",
          scrollTrigger: {
            // The overflow-hidden hero section drives the scrub; the media
            // layer itself only carries the transform.
            trigger: el.parentElement ?? el,
            start: "top top",
            end: "bottom top",
            scrub: 0.5,
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
        gsap.set(el, { clearProps: "transform" });
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [disabled]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
