"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Row-selection state for studio list views (bulk-actions pattern). Selection
 * is always SCOPED TO THE CURRENTLY-VISIBLE ROWS (`allIds`): `ids`/`count`
 * intersect the internal set with `allIds`, and select-all / deselect-all only
 * touch visible rows. So when a client-side filter or search narrows the list,
 * bulk Enable/Disable/Delete can never act on a row the operator can no longer
 * see. For a list with no client filtering (`allIds` == every row) this is
 * identical to selecting the raw set.
 */
export function useSelection(allIds: string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Only visible-and-selected ids are ever surfaced or acted on.
  const ids = useMemo(
    () => allIds.filter((id) => selected.has(id)),
    [allIds, selected],
  );

  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allIds.length > 0 && allIds.every((id) => prev.has(id))) {
        // Deselect only the visible rows — any hidden selection stays intact.
        for (const id of allIds) next.delete(id);
      } else {
        for (const id of allIds) next.add(id);
      }
      return next;
    });
  }, [allIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  return {
    selected,
    ids,
    count: ids.length,
    toggle,
    toggleAll,
    allSelected,
    clear,
  };
}
