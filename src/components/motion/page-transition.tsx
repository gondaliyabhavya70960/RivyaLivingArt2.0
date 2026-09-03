import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The page-enter transition: a short fade and rise on every navigation.
 *
 * CSS-only on purpose. App Router templates re-mount per navigation and
 * cannot keep the old tree, so there is no exit to animate and an enter this
 * small needs no animation runtime — Part 14 opens by rejecting motion that
 * is a technology demo, and a JS transition here would be one.
 *
 * The duration is `--dur-base`. It was a bespoke `450ms` inherited from the
 * v2.0 system, which is not one of Part 3.8's four durations; the whole point
 * of a four-value scale is that a fifth value never gets in on the grounds
 * that it looked right in one place. `motion-reduce:animate-none` renders it
 * statically, and without JS the animation still ends fully visible.
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
        "animate-in fade-in slide-in-from-bottom-[14px] fill-mode-backwards duration-(--dur-base) ease-(--ease-luxury) motion-reduce:animate-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
