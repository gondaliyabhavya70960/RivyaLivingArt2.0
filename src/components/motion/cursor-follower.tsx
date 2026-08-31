"use client";

import { useEffect, useRef } from "react";

/**
 * Phase 3 cursor follower (guide Part B: near-universal on Awwwards product
 * sites, restrained here to the luxury register): a single 32px ring that
 * trails the pointer with a short lerp and swells over interactive targets.
 * The NATIVE cursor is never hidden or replaced — this is an additive
 * ornament, so precision pointing, text caret, and every OS affordance stay
 * exactly as they were. mix-blend-difference keeps the ivory ring legible on
 * both the navy and canvas bands without theme plumbing.
 *
 * Hard gates: fine pointers only, prefers-reduced-motion off (the trailing
 * ease is autonomous motion), aria-hidden + pointer-events-none always. The
 * rAF loop parks itself whenever the ring has settled on the pointer and
 * wakes on the next pointermove — zero idle work.
 */
const INTERACTIVE =
  'a, button, input, select, textarea, label, [role="button"], [role="tab"], summary';

export function CursorFollower() {
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const usable = window.matchMedia(
      "(pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    // Live gate: the layout persists across the whole visit, so honor a
    // mid-session reduced-motion/pointer change (re-audit R-008) — the ring
    // hides and the listeners below stay inert while unusable.
    let enabled = usable.matches;
    const onGateChange = () => {
      enabled = usable.matches;
      if (!enabled) {
        shown = false;
        ring.style.opacity = "0";
      }
    };
    usable.addEventListener("change", onGateChange);

    let x = -100;
    let y = -100;
    let targetX = -100;
    let targetY = -100;
    let frame = 0;
    let shown = false;

    const paint = () => {
      frame = 0;
      x += (targetX - x) * 0.22;
      y += (targetY - y) * 0.22;
      ring.style.transform = `translate3d(${x - 16}px, ${y - 16}px, 0)`;
      // Park once settled; the next pointermove wakes the loop.
      if (Math.abs(targetX - x) > 0.15 || Math.abs(targetY - y) > 0.15) {
        frame = window.requestAnimationFrame(paint);
      }
    };
    const wake = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const onMove = (event: PointerEvent) => {
      if (!enabled || event.pointerType !== "mouse") return;
      targetX = event.clientX;
      targetY = event.clientY;
      if (!shown) {
        shown = true;
        // First sighting: appear AT the pointer instead of flying in.
        x = targetX;
        y = targetY;
        ring.style.opacity = "1";
      }
      wake();
    };
    const onOver = (event: PointerEvent) => {
      const el = event.target;
      const interactive =
        el instanceof Element && Boolean(el.closest(INTERACTIVE));
      if (interactive) ring.dataset.active = "";
      else delete ring.dataset.active;
    };
    const onLeave = () => {
      shown = false;
      ring.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      usable.removeEventListener("change", onGateChange);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={ringRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[120] size-8 rounded-full border border-mineral opacity-0 mix-blend-difference transition-[opacity,scale] duration-(--dur-micro) ease-(--ease-out) data-active:scale-150 data-active:border-2"
    />
  );
}
