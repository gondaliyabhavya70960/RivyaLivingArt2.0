/**
 * Studio loading placeholders — the shapes every per-route `loading.tsx`
 * composes.
 *
 * **Flat, never a shimmer.** A pulse is motion carrying no information: it
 * says "still waiting", which the placeholder shape already says, and Part 14
 * rejects motion that is decoration. So these are still blocks at the tone the
 * real content sits on.
 *
 * **At final dimensions.** The point of a skeleton is that nothing moves when
 * the data lands — the header is the header's height, a table row is a row's
 * height. A generic stack of grey bars that then reflows into a table is worse
 * than a blank frame, because it promises a layout and breaks the promise.
 *
 * The wrapper carries `aria-busy` and one visually-hidden "Loading…", so a
 * screen reader is told once rather than reading a wall of empty boxes.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** One placeholder block. `bg-foreground/6` reads on card and on background. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("rounded-input bg-foreground/6", className)} />;
}

/** The `PageHeader` footprint: eyebrow, title, description, bottom rule. */
export function SkeletonPageHeader({ eyebrow = true }: { eyebrow?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border pb-6">
      <div className="min-w-0 flex-1 basis-64">
        {eyebrow ? <SkeletonBlock className="h-3 w-24" /> : null}
        <SkeletonBlock className="mt-3 h-8 w-56" />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-[42ch]" />
      </div>
      <div className="flex gap-3">
        <SkeletonBlock className="h-11 w-36" />
        <SkeletonBlock className="h-11 w-32" />
      </div>
    </div>
  );
}

/** A filter bar: a wide search field plus a few selects. */
export function SkeletonFilters({ selects = 3 }: { selects?: number }) {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <SkeletonBlock className="h-11 w-full max-w-80 flex-1" />
      {Array.from({ length: selects }).map((_, i) => (
        <SkeletonBlock key={i} className="h-11 w-40" />
      ))}
    </div>
  );
}

/**
 * A list table at its real row height inside the real card. `rows` should be
 * about what the route pages at, so the placeholder occupies the height the
 * data will.
 */
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-e1">
      <div className="border-b border-border px-4 py-3">
        <SkeletonBlock className="h-3 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
        >
          <SkeletonBlock className="size-12 shrink-0 rounded-image" />
          <SkeletonBlock className="h-4 min-w-0 flex-1" />
          <SkeletonBlock className="h-4 w-24 max-sm:hidden" />
          <SkeletonBlock className="h-6 w-20 rounded-full max-sm:hidden" />
        </div>
      ))}
    </div>
  );
}

/** A responsive grid of cards — the media library and the image pickers. */
export function SkeletonGrid({ tiles = 12 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: tiles }).map((_, i) => (
        <SkeletonBlock key={i} className="aspect-square rounded-card" />
      ))}
    </div>
  );
}

/** Wraps a route's placeholder and makes the wait legible to assistive tech. */
export function SkeletonScreen({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}
