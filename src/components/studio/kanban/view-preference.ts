"use client";

import { useSyncExternalStore } from "react";

/**
 * The Table | Kanban preference — one tiny module so every board screen
 * resolves it the same way (KANBAN-SPEC): the URL wins when it carries a
 * real value (share/refresh/back stay predictable), the stored preference is
 * the fallback, and a UI preference never needs a database field.
 *
 * Storage is read as an EXTERNAL STORE (`useSyncExternalStore`), the same
 * shape as `use-column-visibility` — no mount effect mirroring storage into
 * `useState` (the repo lints against setState in an effect body), and other
 * tabs pick up a change via the `storage` event. A same-tab write does not
 * fire that event, so `writeStoredView` notifies the listener set itself.
 */

export type KanbanView = "table" | "kanban";

/**
 * URL first, storage second. Anything that is not exactly "kanban" or
 * "table" — a typo, a stale link — falls through to the stored choice rather
 * than inventing a third view.
 */
export function resolveKanbanView(
  raw: string | null,
  stored: KanbanView,
): KanbanView {
  return raw === "kanban" || raw === "table" ? raw : stored;
}

export function readStoredView(key: string): KanbanView {
  try {
    return localStorage.getItem(key) === "kanban" ? "kanban" : "table";
  } catch {
    // Private mode / storage disabled — the URL still carries the view.
    return "table";
  }
}

export function writeStoredView(key: string, view: KanbanView): void {
  try {
    localStorage.setItem(key, view);
  } catch {
    // Same reasoning as the read — never let a preference break the screen.
  }
  notify();
}

const listeners = new Set<() => void>();
/** Snapshot cache per key — `useSyncExternalStore` requires a STABLE
 *  reference between reads with nothing changed (a string union, so ===
 *  answers it). */
const snapshots = new Map<string, KanbanView>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

function getSnapshot(key: string): KanbanView {
  const next = readStoredView(key);
  if (snapshots.get(key) === next) return snapshots.get(key) as KanbanView;
  snapshots.set(key, next);
  return next;
}

/** The server cannot know the stored view — "table" is every screen's
 *  default, and an explicit `?view=kanban` still wins on first paint. */
function getServerSnapshot(): KanbanView {
  return "table";
}

/**
 * The stored half of the pair. The URL side is applied by the consumer
 * through `resolveKanbanView`, so server render and first paint never
 * disagree; `set` writes storage and notifies every mounted user of the key.
 */
export function useStoredView(
  key: string,
): [KanbanView, (view: KanbanView) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key),
    getServerSnapshot,
  );
  const set = (view: KanbanView) => writeStoredView(key, view);
  return [stored, set];
}
