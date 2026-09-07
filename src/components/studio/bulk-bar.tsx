"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Floating bulk-action bar — appears whenever rows are selected.
 *
 * REDESIGN.md §3.5 removes drop shadows from the whole site and grants exactly
 * two exceptions; this bar is one of them, so it is the one Studio surface that
 * wears `shadow-e3` on purpose. It has to: it floats over a scrolling table
 * and nothing else on the page is lifted, which is precisely what makes the
 * shadow read as meaning rather than decoration.
 *
 * `Esc` clears the selection and returns focus to the element that had it when
 * the bar appeared — Part 17 wants every layer dismissible that way, and a
 * persistent toolbar over a table is a layer.
 */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const visible = count > 0;
  // Captured while the bar is up so Esc can hand focus back to the checkbox
  // that raised it, rather than dumping it at the top of the document.
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!visible) {
      opener.current = null;
      return;
    }
    opener.current ??=
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // An Escape that a layer above the bar has already answered is not
      // ours: Radix marks the keydown it dismisses a dialog with, and the
      // dismiss guard marks the one it refuses. Without this, Escape inside
      // the Move or Description dialog closed (or was refused by) the dialog
      // AND dropped the selection behind it, so the rows had to be found and
      // ticked again. The target check covers a layer that does not mark it.
      if (event.defaultPrevented) return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"], [role="alertdialog"]')
      ) {
        return;
      }
      const target = opener.current;
      onClear();
      if (target && document.contains(target)) target.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClear]);

  if (!visible) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed inset-x-0 bottom-5 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-full border border-border bg-card px-3 py-2 ps-6 text-foreground shadow-e3 lg:start-64"
    >
      <span className="u-num shrink-0 text-small font-medium text-foreground">
        {count}
        <span className="u-micro ms-2">selected</span>
      </span>
      <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
      <div className="flex flex-wrap items-center justify-center gap-2">
        {children}
      </div>
      <button
        type="button"
        aria-label="Clear selection"
        onClick={onClear}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none"
      >
        <X aria-hidden strokeWidth={1.5} className="size-4" />
      </button>
    </div>
  );
}
