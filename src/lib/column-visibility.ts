/**
 * Pure state for the studio list "Columns" control (10 remnants: "no column
 * controls"). A table declares its optional columns once; the viewer's
 * choices persist per-device in `localStorage["studio:columns:<tableKey>"]`
 * via `useColumnVisibility` (the hook is the only thing that touches
 * storage — everything here is plain data in, data out, so it is testable
 * without a DOM).
 *
 * Kept intentionally small: a column is either shown or hidden, there is no
 * ordering and no per-column width — the table's own layout still owns that.
 */
export type ColumnDef = { key: string; label: string };

export type ColumnVisibilityState = Record<string, boolean>;

/** Every declared column starts visible. */
export function defaultColumnVisibility(
  columns: readonly ColumnDef[],
): ColumnVisibilityState {
  return Object.fromEntries(columns.map((column) => [column.key, true]));
}

/**
 * Flip one column. Refuses to hide the LAST visible column — an empty table
 * is a dead end the operator cannot undo from the table itself, since the
 * control that would restore a column lives in the header row being hidden.
 */
export function toggleColumnVisibility(
  state: ColumnVisibilityState,
  key: string,
): ColumnVisibilityState {
  const next = { ...state, [key]: !(state[key] ?? true) };
  const anyVisible = Object.values(next).some(Boolean);
  return anyVisible ? next : state;
}

/**
 * Raw `localStorage` string (or `null`) → a valid state for the columns
 * declared THIS load. Unknown keys (a column since removed from the table)
 * are dropped; missing keys (a column added since the value was saved)
 * default to visible; a corrupt or all-hidden value falls back to the
 * all-visible default rather than rendering an empty table.
 */
export function parseColumnVisibility(
  raw: string | null,
  columns: readonly ColumnDef[],
): ColumnVisibilityState {
  const base = defaultColumnVisibility(columns);
  if (!raw) return base;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return base;
  }

  const out = { ...base };
  for (const column of columns) {
    const value = (parsed as Record<string, unknown>)[column.key];
    if (typeof value === "boolean") out[column.key] = value;
  }
  return Object.values(out).some(Boolean) ? out : base;
}
