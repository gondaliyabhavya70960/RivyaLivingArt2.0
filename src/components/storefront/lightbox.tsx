"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/storefront/dialog";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { flipDelta, flipTransform } from "@/lib/flip";
import { cn } from "@/lib/utils";

export type LightboxLabels = {
  /** Translated "Previous image" / equivalent aria-label. */
  prev: string;
  /** Translated "Next image". */
  next: string;
  /** Translated "Close". */
  close: string;
};

/** §9.1's counter: mono, zero-padded — "03 / 07". */
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const FOCUS_RING =
  "inline-flex size-12 items-center justify-center rounded-full border border-hairline-dk text-mineral outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-mineral/40 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-obsidian motion-reduce:transition-none";

/**
 * The shared full-screen lightbox — REDESIGN.md §9.1 / §11.2, one
 * implementation for the product gallery and the portfolio wall (A3).
 *
 * Owns the things that were duplicated between the two: the storefront
 * `Dialog` at 96%+ obsidian, RTL-aware `ArrowLeft`/`ArrowRight` stepping (plus
 * `Home`/`End`), the mono `N / M` counter with its prev/next buttons, the
 * `role="status"` live region, and focus return to whatever opened it. What
 * each caller keeps for itself: the STAGE content (`children` — an `<Image>`,
 * a `<figure>` with a caption, whatever that gallery's frame looks like), its
 * own `data-slot` hooks, and its own dialog chrome class names.
 *
 * **The FLIP entrance.** On open, `originFor(index)` names the DOM element the
 * frame should appear to rise FROM (the thumbnail or wall tile that was
 * clicked). Its rect is measured against the stage's own (already-final) rect
 * with {@link flipDelta}; the stage is transformed to sit exactly over the
 * origin with no transition, then — next frame — the transform clears to
 * identity with the one sanctioned `transform 260ms var(--ease-luxury)`
 * transition. `prefers-reduced-motion` skips the whole mechanism: no measure,
 * no transform, the Dialog's own (also reduced-motion-safe) fade stands in.
 */
export function Lightbox({
  open,
  onOpenChange,
  index,
  count,
  onIndexChange,
  originFor,
  labels,
  dialogTitle,
  statusText,
  contentClassName,
  stageClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 0-based active frame. */
  index: number;
  count: number;
  onIndexChange: (index: number) => void;
  /** The element the opened frame should FLIP in from, keyed by index.
   *  Omit to skip the FLIP — the Dialog's own fade/zoom entrance stands in. */
  originFor?: (index: number) => HTMLElement | null;
  labels: LightboxLabels;
  /** sr-only `DialogTitle` text, e.g. `"{title} — image {index} of {count}"`. */
  dialogTitle: string;
  /** `role="status"` text announced on every step, e.g. `"Image {index} of
   *  {count}: {alt}"`. */
  statusText: string;
  /** Extra classes on `DialogContent` — each caller keeps its own surface
   *  (full-viewport for the gallery, a boxed `max-w-5xl` for the wall). */
  contentClassName?: string;
  /** Extra classes on the FLIP stage wrapper. */
  stageClassName?: string;
  /** The current frame's content — an image, a captioned figure. */
  children: ReactNode;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function step(delta: number) {
    onIndexChange((((index + delta) % count) + count) % count);
  }

  // The FLIP entrance runs once per OPEN, not per step — stepping through
  // frames afterward is a plain content swap, not a re-FLIP from a new origin.
  useEffect(() => {
    if (!open) return;
    const origin = originFor?.(index) ?? null;
    triggerRef.current = origin;
    const stage = stageRef.current;
    if (!stage || !origin || prefersReducedMotion) return;

    const originRect = origin.getBoundingClientRect();
    const raf = requestAnimationFrame(() => {
      const stageRect = stage.getBoundingClientRect();
      const delta = flipDelta(originRect, stageRect);
      stage.style.transition = "none";
      stage.style.transform = flipTransform(delta);
      const settle = requestAnimationFrame(() => {
        stage.style.transition = "transform 260ms var(--ease-luxury)";
        stage.style.transform = "";
      });
      // Stash so the outer cleanup can cancel either frame.
      stage.dataset.flipSettleFrame = String(settle);
    });
    return () => {
      cancelAnimationFrame(raf);
      const settleFrame = Number(stage?.dataset.flipSettleFrame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      if (stage) {
        stage.style.transition = "";
        stage.style.transform = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately OPEN-only, see above.
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={labels.close}
        data-theme="navy"
        className={cn(
          "grid-rows-[1fr_auto] gap-4 bg-obsidian/96 p-4 text-mineral md:p-8",
          "[&_[data-slot=sf-dialog-close]]:text-mist [&_[data-slot=sf-dialog-close]]:hover:text-mineral",
          contentClassName,
        )}
        onKeyDown={(e) => {
          // Direction-aware: under RTL the chevrons mirror, so the key that
          // visually points at "next" must advance.
          const rtl =
            e.currentTarget.closest("[dir]")?.getAttribute("dir") === "rtl" ||
            document.documentElement.dir === "rtl";
          if (e.key === "ArrowRight") step(rtl ? -1 : 1);
          if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
          if (e.key === "Home") onIndexChange(0);
          if (e.key === "End") onIndexChange(count - 1);
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>

        {/* Live region — prev/next changes are otherwise silent to AT. */}
        <p role="status" aria-live="polite" className="sr-only">
          {statusText}
        </p>

        <div
          ref={stageRef}
          className={cn("relative min-h-0 w-full", stageClassName)}
        >
          {children}
        </div>

        {count > 1 ? (
          <div className="flex items-center justify-center gap-8">
            <button
              type="button"
              aria-label={labels.prev}
              onClick={() => step(-1)}
              className={FOCUS_RING}
            >
              <ChevronLeft
                aria-hidden
                strokeWidth={1.5}
                className="size-5 rtl:-scale-x-100"
              />
            </button>
            <p className="font-mono text-14 tracking-[0.14em] text-mist tabular-nums">
              {pad(index + 1)} / {pad(count)}
            </p>
            <button
              type="button"
              aria-label={labels.next}
              onClick={() => step(1)}
              className={FOCUS_RING}
            >
              <ChevronRight
                aria-hidden
                strokeWidth={1.5}
                className="size-5 rtl:-scale-x-100"
              />
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
