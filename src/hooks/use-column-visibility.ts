"use client";

import { useSyncExternalStore } from "react";

import {
  defaultColumnVisibility,
  parseColumnVisibility,
  toggleColumnVisibility,
  type ColumnDef,
  type ColumnVisibilityState,
} from "@/lib/column-visibility";

/**
 * Per-device column visibility for a studio table, in
 * `localStorage["studio:columns:<tableKey>"]`.
 *
 * Read as an EXTERNAL STORE (`useSyncExternalStore`), the same shape as
 * `SavedViews` — no mount effect mirroring storage into `useState` (the repo
 * lints against `setState` in an effect body), and other tabs pick up a
 * change via the `storage` event. A same-tab write does not fire that event,
 * so `toggle` notifies the module-level listener set itself right after it
 * writes. Every access is guarded: blocked storage just means every column
 * stays visible, which is the same as never having opened the menu.
 */
const listeners = new Set<() => void>();
/** Snapshot cache per table key — `useSyncExternalStore` requires a STABLE
 *  reference between reads with nothing changed. */
const snapshots = new Map<
  string,
  { raw: string | null; state: ColumnVisibilityState }
>();

function storageKey(tableKey: string): string {
  return `studio:columns:${tableKey}`;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readState(
  tableKey: string,
  columns: readonly ColumnDef[],
): ColumnVisibilityState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey(tableKey));
  } catch {
    return defaultColumnVisibility(columns);
  }
  const cached = snapshots.get(tableKey);
  if (cached && cached.raw === raw) return cached.state;

  const state = parseColumnVisibility(raw, columns);
  snapshots.set(tableKey, { raw, state });
  return state;
}

export function useColumnVisibility(
  tableKey: string,
  columns: readonly ColumnDef[],
) {
  const state = useSyncExternalStore(
    subscribe,
    () => readState(tableKey, columns),
    () => defaultColumnVisibility(columns),
  );

  function toggle(key: string) {
    const next = toggleColumnVisibility(state, key);
    try {
      localStorage.setItem(storageKey(tableKey), JSON.stringify(next));
    } catch {
      // Storage write blocked — nothing to re-read, so nothing changes.
    }
    for (const listener of listeners) listener();
  }

  function isVisible(key: string): boolean {
    return state[key] ?? true;
  }

  return { state, isVisible, toggle };
}
