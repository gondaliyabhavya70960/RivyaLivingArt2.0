import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * REDESIGN.md §12.5's editor shape — "two columns: information left, live
 * preview right" for the product editor, "editor left, preview right" for
 * the journal. The form is the left column; `aside` is the right one.
 *
 * The split is decided by a CONTAINER query, not a viewport breakpoint, on
 * purpose. The Studio's content area is the viewport minus a sidebar that is
 * 256px, or 80px once the owner collapses it to the rail — so the same
 * 1280px laptop has 960px of room with the panel open and 1136px with the
 * rail. A viewport breakpoint would have to pick one and be wrong for the
 * other; measuring the container is right for both. `@5xl` (64rem) leaves
 * the form at least 584px beside the 26rem preview column, which is the
 * width a 640px landscape phone already gives it.
 *
 * Below the threshold the aside is `display: none` and the editor keeps its
 * single column and the dialog behind the footer's Preview button. The aside
 * is rendered regardless, so the layout is right at first paint — no
 * measuring step, no one-column flash — which is why anything expensive in
 * it (the preview iframe) must be lazy: see `DraftPreviewPanel`.
 */
export function EditorSplit({
  children,
  aside,
  className,
}: {
  children: ReactNode;
  /** The right column. Omit it and the editor is simply full width. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("@container/editor", className)}>
      <div
        className={cn(
          "grid gap-6",
          aside &&
            "@5xl/editor:grid-cols-[minmax(0,1fr)_26rem] @5xl/editor:items-start",
        )}
      >
        <div className="min-w-0">{children}</div>
        {aside && (
          <aside
            aria-label="Draft preview"
            className="hidden @5xl/editor:sticky @5xl/editor:top-20 @5xl/editor:block"
          >
            {aside}
          </aside>
        )}
      </div>
    </div>
  );
}
