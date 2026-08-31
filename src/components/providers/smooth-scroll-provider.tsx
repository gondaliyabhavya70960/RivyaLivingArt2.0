"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type GsapModule = typeof import("@/lib/gsap");

/**
 * Lenis smooth scroll driven by the GSAP ticker (single rAF loop) and
 * synced with ScrollTrigger. Disabled entirely under reduced motion.
 * ScrollTriggers are killed on route change.
 *
 * Lenis + GSAP/ScrollTrigger are dynamically imported inside the effect
 * *after* the reduced-motion / coarse-pointer guards pass (PERF-301), so
 * those bytes never ship to reduced-motion or touch visitors — including on
 * static routes like /privacy and /terms where they'd bail immediately.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Set once the dynamic import lands, so the route-change cleanup below can
  // no-op when GSAP was never loaded (guarded visitors).
  const scrollTriggerRef = useRef<GsapModule["ScrollTrigger"] | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // PERF-009: keep smooth-scroll on desktop (fine pointer) but fall back to
    // native scrolling on touch/coarse-pointer devices, where hijacking the
    // scroll is the biggest INP/jank risk on low-end phones.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const [{ default: Lenis }, { gsap, ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("@/lib/gsap"),
      ]);
      if (cancelled) return;
      scrollTriggerRef.current = ScrollTrigger;

      const lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      cleanup = () => {
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    // Kill stale triggers when the route changes. No-ops when GSAP was never
    // loaded (reduced-motion / touch visitors never hydrate ScrollTrigger).
    return () => {
      scrollTriggerRef.current?.getAll().forEach((t) => t.kill());
    };
  }, [pathname]);

  return <>{children}</>;
}
