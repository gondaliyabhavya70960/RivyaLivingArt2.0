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

/** Part 14: parallax is capped at 20–40px, never a percentage of the layer's
 *  own (often very tall, `min-h-svh`) height — 12% of a hero's height was
 *  routinely 3–4x over that cap. The multiplier stays 0.12 (the "how much
 *  slower than the page" feel is unchanged); only the ceiling is new. */
const PARALLAX_MAX_PX = 40;
const PARALLAX_SHIFT_RATIO = 0.12;

/**
 * Hero media parallax (DESIGN.md B4 "Hero: SplitText line reveal +
 * parallax"; roadmap Phase 1b refit, Phase 3 mount — mounted on the
 * homepage bespoke band since A2, see below): as the hero scrolls away, the wrapped media layer translates down by
 * `min(40px, 12% of its own height)` (`scrub: 0.5`, linear — the smoothing
 * lives in the scrub), so it reads as sitting one plane behind the page.
 *
 * Usage rules — it must wrap ONLY absolutely-positioned media inside an
 * `overflow-hidden` section:
 * - Pass the fill positioning via `className` (e.g. `"absolute inset-0 z-0"`)
 *   so the wrapper itself IS the media layer — the px cap is measured
 *   against the wrapper's own height, so the wrapper must own the layer's
 *   box, not sit as a zero-height shell around it.
 * - No oversizing/`scale` is needed: with `start: "top top"` the translation
 *   only begins once the section top passes the viewport top, so the gap it
 *   opens at the section's top edge stays above the viewport for the whole
 *   scrub (holds for any media layer that fills the section, like
 *   home-hero's `inset-0` layers).
 * - `y` is a function, not a fixed number, so it is re-measured against the
 *   element's current `offsetHeight` on every `ScrollTrigger.refresh()`
 *   (`invalidateOnRefresh: true`) — a layout change (a font swap, an image
 *   settling, a viewport resize) never leaves the tween chasing a stale
 *   height.
 *
 * Desktop-only, like the other pointer-tier effects: bails statically on
 * touch and under reduced motion, before the GSAP import (H12). SSR and the
 * initial client render emit the children plain and fully visible.
 *
 * Mounted in exactly one place: the homepage bespoke band's image layer
 * (`(v2)/page.tsx`, batch A2; motion shortlist entry 9). It sat unimported
 * between its D18 refit and that mount, and was once deleted as "dormant" in
 * that window — unimported is not unwanted, and a second mount should be
 * argued for against Part 14 rather than copied.
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
        { y: 0 },
        {
          y: () =>
            Math.min(PARALLAX_MAX_PX, el.offsetHeight * PARALLAX_SHIFT_RATIO),
          ease: "none",
          // A function-valued `y` is only re-evaluated on refresh with this
          // set — otherwise GSAP would cache the first measurement for the
          // tween's whole lifetime.
          invalidateOnRefresh: true,
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
