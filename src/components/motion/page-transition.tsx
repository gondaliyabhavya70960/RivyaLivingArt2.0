import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The v2.0 page-enter transition (DESIGN.md B4: fade + rise, ~0.5s, short —
 * it's e-commerce). CSS-only on purpose: App Router templates re-mount per
 * navigation and cannot keep the old tree for exit animations, so a simple
 * enter needs no animation runtime (B4's performance law prefers the
 * downgrade; the v7 audit's M-P1 measured the cost of shipping one). The
 * 450ms duration sits in A5's 400–800ms entrance window and the curve is the
 * house ease cubic-bezier(0.22, 1, 0.36, 1) via the v2.0 --ease-out token — a
 * real :root custom property (src/styles/tokens.css), unlike the theme-inlined
 * --ease-luxe, so it keeps resolving after the v7 layer retires.
 * `motion-reduce:animate-none` renders statically under reduced motion;
 * without JS the animation still ends fully visible.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-[14px] fill-mode-backwards duration-[450ms] ease-(--ease-out) motion-reduce:animate-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
