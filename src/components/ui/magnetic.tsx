"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Magnetic pull on a primary pill — implementation plan §6.2, spec §2 move 5.
 *
 * ── This reverses a ratified decision, so it says so ────────────────────────
 *
 * `Magnetic` existed once and was DELETED under owner decision D18
 * (2026-09-03), with eight other dormant v2 components, because nothing
 * mounted it and a reader could not tell dead architecture from live. It comes
 * back on the owner's instruction (2026-09-17), and it comes back MOUNTED —
 * on the 404's escape pill and the homepage's commission ask — because an
 * unmounted copy is what D18 was about.
 *
 * It also sits against a written rule, which is worth stating plainly rather
 * than leaving for the next reader to discover. REDESIGN.md §3.6 and
 * `docs/redesign-contract.md` §6 both say of buttons: "No scale or lift on
 * hover — colour and underline only", and `button.tsx` gives the reasoning —
 * "a button that jumps under the cursor is the tell of a template". A ±6px
 * pull is a lift. The owner asked for §6.2; that is their call to make, and
 * this is the record of it.
 *
 * What is NOT built, to keep the deviation as small as the instruction needs:
 * §6.2's `scale 0.96` on click. The pull is what makes a pill feel weighted;
 * a press-scale is separate, adds nothing the fill sweep does not already say,
 * and would put a second transform on the control.
 *
 * ── The guards, which are the whole safety story ────────────────────────────
 *
 * Copied from `featured-rail.tsx`, the repo's reference implementation:
 *  - `prefers-reduced-motion: reduce` → never attaches. Part 14, and
 *    `redesign-audit.mjs` drives a reduce context per route and fails on
 *    anything still moving.
 *  - `pointer: coarse` → never attaches. There is no cursor to be attracted
 *    to, and a touch device would pay for a listener that can never fire.
 *  - gsap is loaded through a DYNAMIC import, so a visitor who trips either
 *    guard never downloads it for this component's sake, and the motion
 *    budget (48.4 KB of a 49 KB ceiling) is not spent on a pill.
 *
 * The transform lives on a wrapper span, never on the button: the child keeps
 * its own hover, focus ring and fill sweep untouched, and nothing here can
 * change the control's hit area or its layout box.
 */
export function Magnetic({
  children,
  /** Maximum displacement in px (§6.2: ±6). */
  strength = 6,
  /** Cursor distance at which the pull begins (spec §2 move 5: 80px). */
  radius = 80,
  className,
}: {
  children: ReactNode;
  strength?: number;
  radius?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let cancelled = false;
    let detach: (() => void) | null = null;

    void (async () => {
      const { gsap } = await import("@/lib/gsap");
      if (cancelled) return;
      const el = ref.current;
      if (!el) return;

      // `quickTo` keeps one tween per axis alive and re-targets it, rather
      // than spawning a tween per pointermove — the difference between a
      // smooth follow and a garbage-collection stutter on a long hover.
      const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "settle" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "settle" });

      const onMove = (event: PointerEvent) => {
        const box = el.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);
        const distance = Math.hypot(dx, dy);
        if (distance > radius) {
          xTo(0);
          yTo(0);
          return;
        }
        // Linear falloff: full pull at the centre, nothing at the radius, so
        // the control settles back on its own as the cursor leaves rather
        // than snapping at the boundary.
        const pull = 1 - distance / radius;
        xTo((dx / radius) * strength * pull * 2);
        yTo((dy / radius) * strength * pull * 2);
      };

      // On `window`, not the element: the pull has to begin BEFORE the cursor
      // arrives, which is the entire effect. Passive — it never calls
      // preventDefault, and saying so keeps it off the scroll path.
      window.addEventListener("pointermove", onMove, { passive: true });
      detach = () => {
        window.removeEventListener("pointermove", onMove);
        gsap.set(el, { x: 0, y: 0 });
      };
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [radius, strength]);

  return (
    <span ref={ref} className={cn("inline-block will-change-transform", className)}>
      {children}
    </span>
  );
}
