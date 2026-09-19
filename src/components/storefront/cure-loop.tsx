import { cn } from "@/lib/utils";

/**
 * §2.10 · the maintenance page's cure loop.
 *
 * A hairline that fills to 90%, holds, fades and starts again — the site's
 * signature device (§2.6) reduced to its one legible idea for a page that has
 * nothing to measure. The animation and the reason for every number in it are
 * in `globals.css` (`sf-cure-loop`), including why it stops at 90% and why
 * reduced motion gets an authored resting frame rather than the global 0.01ms
 * collapse.
 *
 * **It is decoration, and the markup says so.** `aria-hidden`, no `role`, no
 * `aria-valuenow`, no percentage printed beside it. The page's actual message
 * is its sentence and its newsletter field; this is the ground those sit on.
 * Marking it up as a progressbar would tell a screen-reader user that the site
 * is 90% of the way back, which nothing here knows.
 *
 * Server component: no state, no effect, no `"use client"` — it can render
 * inside a page whose whole premise is that the database may be down.
 */
export function CureLoop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      /* `redesign-audit.mjs` excludes this subtree from Part 3.1's
         two-champagne cap on the same sentence it excludes the cure RAIL
         with: a 1px hairline is not what the cap is protecting. The marker is
         here rather than in the audit's route list so it stays true if this
         moves. */
      data-slot="cure-loop"
      className={cn(
        "h-px w-full max-w-[22rem] overflow-hidden bg-hairline",
        className,
      )}
    >
      <span className="sf-cure-loop block h-full w-full bg-champagne" />
    </div>
  );
}
