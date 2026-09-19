import type { ReactNode } from "react";

/**
 * KanbanBoard — the shared horizontal lane scroller.
 *
 * One scroller for the whole board, with lanes keeping a fixed width so a
 * long lane never squeezes its neighbours to nothing. This is layout only:
 * lanes, counts and moves are the consumers' — a board that owns layout AND
 * workflow is the duplication this component set exists to end (KANBAN-SPEC).
 */
export function KanbanBoard({ children }: { children: ReactNode }) {
  return (
    <div className="relative -mx-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
      <ol className="flex min-w-max items-start gap-4">{children}</ol>
    </div>
  );
}
