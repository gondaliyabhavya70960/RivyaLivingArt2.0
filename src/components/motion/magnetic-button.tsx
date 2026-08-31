"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useIsTouch } from "@/hooks/use-is-touch";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

// Type-only view of the GSAP module — ships no code (H12).
type GsapModule = typeof import("@/lib/gsap");
type Tween = ReturnType<GsapModule["gsap"]["to"]>;

export interface MagneticProps {
  children: ReactNode;
  className?: string;
  /** How strongly the element follows the pointer. Defaults to 0.3. */
  strength?: number;
  /** Activation radius in px, measured from the element center. Defaults to 120. */
  radius?: number;
}

// Hard ceiling on the pull so it always stays subtle, whatever the props.
const MAX_PULL = 24;

// B4 CTA pull: pointer pursuit eases in with `power2.out`. The 0.45s is a
// pursuit LAG constant (how far the element trails a continuously-moving
// pointer), not a discrete transition — the A5 micro band doesn't apply, and
// shortening it makes the follow twitchy rather than snappier.
const QUICK_TO = { duration: 0.45, ease: "power2.out" } as const;

// B4 CTA release: elastic settle back to rest on pointer leave. 0.7s sits
// mid A5 entrance band (400–800ms) — the elastic needs the room to complete
// its overshoot cycle at amplitude 1 / period 0.3.
const SNAP_BACK = { duration: 0.7, ease: "elastic.out(1,0.3)" } as const;

/** gsap.quickTo setter — one animatable property, retargeted per call. */
type QuickSetter = (value: number) => void;

interface MagneticSetters {
  x: QuickSetter;
  y: QuickSetter;
  innerX: QuickSetter;
  innerY: QuickSetter;
  /** Elastic release toward rest (both layers), for pointer leave. */
  snapBack: () => void;
  /** Kill an in-flight snap-back so the quickTo pursuit wins again. */
  cancelSnapBack: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generic magnetic wrapper — place around any child (typically a Button).
 * The child is gently pulled toward the pointer while it is within
 * `radius` px of the element center, and springs back elastically on
 * leave (B4 CTA feel: `power2.out` in, `elastic.out(1,0.3)` back). Inner
 * content gets a second transform at 0.5x for depth. Fully disabled on
 * touch devices and under reduced motion (children render statically).
 *
 * M-P1/H12: driven by GSAP `quickTo`, dynamically imported inside the
 * effect so the runtime never rides first-load JS — until it lands,
 * pointer moves are simply ignored.
 */
export function Magnetic({
  children,
  className,
  strength = 0.3,
  radius = 120,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pullRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const settersRef = useRef<MagneticSetters | null>(null);
  // Element center, measured once per hover (see handlePointerEnter).
  const centerRef = useRef<{ x: number; y: number } | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isTouch = useIsTouch();
  const disabled = prefersReducedMotion || isTouch;

  useEffect(() => {
    if (disabled) return;

    let cancelled = false;
    // Set once the dynamic import lands — before that there is nothing to
    // tear down (H12 pattern).
    let cleanup: (() => void) | undefined;

    void (async () => {
      const { gsap } = await import("@/lib/gsap");
      const pullEl = pullRef.current;
      const innerEl = innerRef.current;
      if (cancelled || !pullEl || !innerEl) return;

      // The elastic release overwrites the quickTo tweens; safe on re-entry
      // because `resetTo` (GSAP 3.11+) revives an overwritten quickTo.
      let snapTween: Tween | null = null;

      settersRef.current = {
        x: gsap.quickTo(pullEl, "x", QUICK_TO),
        y: gsap.quickTo(pullEl, "y", QUICK_TO),
        innerX: gsap.quickTo(innerEl, "x", QUICK_TO),
        innerY: gsap.quickTo(innerEl, "y", QUICK_TO),
        snapBack: () => {
          // Both layers head to the same rest point, so one tween covers the
          // inner half-travel layer too.
          snapTween = gsap.to([pullEl, innerEl], {
            x: 0,
            y: 0,
            ...SNAP_BACK,
            overwrite: "auto",
            onComplete: () => {
              snapTween = null;
            },
          });
        },
        cancelSnapBack: () => {
          if (snapTween) {
            snapTween.kill();
            snapTween = null;
          }
        },
      };

      cleanup = () => {
        settersRef.current = null;
        snapTween = null;
        gsap.killTweensOf([pullEl, innerEl]);
        gsap.set([pullEl, innerEl], { clearProps: "transform" });
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [disabled]);

  if (disabled) {
    return <div className={cn("inline-block", className)}>{children}</div>;
  }

  const maxPull = Math.min(radius * strength, MAX_PULL);
  // Slightly padded hit area so the pull engages just before the pointer
  // reaches the element itself, without listening on the whole window.
  // Capped at 8px — half the tightest gap between adjacent Magnetic CTAs
  // (the hero pair sits gap-4 apart): the aria-hidden pad span paints above
  // later siblings in tree order, so a larger pad would put a click-dead
  // strip over the neighboring button's edge.
  const hitPadding = 8;

  // Inner content trails at half the pull for a subtle depth effect.
  const applyPull = (x: number, y: number) => {
    const setters = settersRef.current;
    if (!setters) return;
    // A still-settling elastic release must not out-render the pursuit.
    setters.cancelSnapBack();
    setters.x(x);
    setters.y(y);
    setters.innerX(x * 0.5);
    setters.innerY(y * 0.5);
  };

  const handlePointerEnter = () => {
    // One layout read per hover: pointermove interleaves with quickTo
    // transform writes every frame, so a per-move getBoundingClientRect
    // would force a style/layout flush at pointer frequency. The wrapper
    // itself never transforms, so the center only drifts if the page
    // scrolls mid-hover — corrected on the next pointerenter.
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const center = centerRef.current;
    if (!center) return;
    const dx = event.clientX - center.x;
    const dy = event.clientY - center.y;
    if (Math.hypot(dx, dy) > radius) {
      applyPull(0, 0);
      return;
    }
    applyPull(
      clamp(dx * strength, -maxPull, maxPull),
      clamp(dy * strength, -maxPull, maxPull),
    );
  };

  const handlePointerLeave = () => {
    settersRef.current?.snapBack();
  };

  return (
    <div
      ref={ref}
      className={cn("relative inline-block", className)}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <span
        aria-hidden="true"
        className="absolute"
        style={{ inset: -hitPadding }}
      />
      <div ref={pullRef} className="will-change-transform">
        <div ref={innerRef}>{children}</div>
      </div>
    </div>
  );
}
