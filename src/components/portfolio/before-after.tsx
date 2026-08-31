"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { isOptimizableImageSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

export type BeforeAfterImage = {
  /** Renderable src only ("/uploads/…" or "http…") — guarded server-side. */
  url: string;
  alt: string;
};

interface BeforeAfterProps {
  before: BeforeAfterImage;
  after: BeforeAfterImage;
  className?: string;
}

/**
 * BeforeAfterSlider — REDESIGN.md §4.6 and §20.5.
 *
 * "Draggable vertical divider, 1px sapphire line, 40px circular handle with a
 * champagne hairline ring. Corner labels in mono (`BEFORE` / `AFTER`).
 * Keyboard operable with arrow keys, `role="slider"`, `aria-valuenow`."
 *
 * Three decisions the reference sketch in §20.5 leaves open:
 *
 * 1. **The whole frame drags, not the handle.** Pointer events live on the
 *    container with pointer capture, so a drag that starts anywhere on the
 *    photograph works and a 40px handle never has to be hit precisely. That
 *    is also how the 40px handle and Part 17's 44px floor coexist: the
 *    target is the frame, the handle is the affordance.
 * 2. **No blur, no glow.** Part 3.5 permits blur in exactly one place on the
 *    site — the sticky header. The labels sit on a flat obsidian chip and the
 *    handle on a flat obsidian disc; separation comes from the champagne
 *    hairline ring, not from elevation.
 * 3. **No reduced-motion branch.** Nothing here moves on its own — every
 *    frame of movement is a finger or an arrow key. There is nothing to
 *    disable.
 *
 * The section only ever renders where a real transformation exists: the case
 * study passes this component `before`/`after` **only when both images are
 * present** (Part 0 — nothing invented, and a "before" that is really the
 * finished piece would be a lie about the work).
 */
export function BeforeAfter({ before, after, className }: BeforeAfterProps) {
  const t = useTranslations("Portfolio.beforeAfter");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [pos, setPos] = useState(50);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    // Right-to-left locales mirror the frame, so the pointer's distance is
    // measured from the INLINE START edge, not the physical left one.
    const rtl = getComputedStyle(el).direction === "rtl";
    const offset = rtl ? rect.right - clientX : clientX - rect.left;
    setPos(Math.min(100, Math.max(0, (offset / rect.width) * 100)));
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = Math.max(0, pos - 5);
    else if (e.key === "ArrowRight") next = Math.min(100, pos + 5);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 100;
    if (next === null) return;
    e.preventDefault();
    setPos(next);
  }

  const rounded = Math.round(pos);

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label={t("sliderLabel")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      aria-valuetext={t("sliderValue", { percent: rounded })}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      data-slot="sf-before-after"
      data-theme="navy"
      className={cn(
        "relative aspect-[4/3] cursor-ew-resize touch-none overflow-hidden rounded-image bg-obsidian select-none",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-mineral",
        className,
      )}
    >
      {/* AFTER — fills the frame, revealed as the divider travels back. */}
      <Image
        src={after.url}
        alt={after.alt}
        fill
        sizes="(min-width: 1024px) 56rem, 100vw"
        unoptimized={!isOptimizableImageSrc(after.url)}
        draggable={false}
        className="pointer-events-none object-cover"
      />

      {/* BEFORE — on top, clipped from the end edge back to the divider. */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 calc(100% - ${pos}%) 0 0)` }}
      >
        <Image
          src={before.url}
          alt={before.alt}
          fill
          sizes="(min-width: 1024px) 56rem, 100vw"
          unoptimized={!isOptimizableImageSrc(before.url)}
          draggable={false}
          className="pointer-events-none object-cover"
        />
      </div>

      {/* Corner labels — mono micro on a flat obsidian chip (§4.6). */}
      <span className="u-micro pointer-events-none absolute start-4 top-4 bg-obsidian/80 px-3 py-1.5 text-mineral">
        {t("before")}
      </span>
      <span className="u-micro pointer-events-none absolute end-4 top-4 bg-obsidian/80 px-3 py-1.5 text-mineral">
        {t("after")}
      </span>

      {/* The divider: a 1px sapphire line carrying a 40px obsidian disc with
          a champagne hairline ring. `left` rather than `inset-inline-start`
          on purpose — `pos` is measured from the inline start above, and
          under RTL the clip-path and the line have to agree on which edge
          that is; both are mirrored by the container's own direction. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-sapphire rtl:translate-x-1/2"
        style={{ insetInlineStart: `${pos}%` }}
      >
        <span className="absolute top-1/2 start-1/2 flex size-10 -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full border border-champagne bg-obsidian text-mineral rtl:translate-x-1/2">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            className="size-4"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 6 4 12l5 6M15 6l5 6-5 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
