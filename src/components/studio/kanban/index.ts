/**
 * The shared Studio Kanban primitives — one foundation, every board.
 *
 * Built in PR-2 of the optimization program (docs/optimization/KANBAN-SPEC.md)
 * by extraction from the orders commission board, which is also the first
 * consumer. Two rules keep this set honest:
 *
 *   1. Primitives are PRESENTATIONAL. Hooks, server calls and state live in
 *      the consumer — which is exactly why these files can be rendered to
 *      static markup in tests without a DOM or a database.
 *   2. No invented workflow. Lanes, options and counts come from the
 *      entity's real enum and the consumer's server data; nothing here
 *      knows or invents a status.
 */
export { KanbanBoard } from "./kanban-board";
export { KanbanColumn, KanbanEmptyColumn } from "./kanban-column";
export { KanbanCardShell, KanbanMoveSelect } from "./kanban-card";
export type { KanbanMoveOption } from "./kanban-card";
