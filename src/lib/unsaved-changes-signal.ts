/**
 * Module store for the Studio's unsaved-changes guard.
 *
 * Two facts live here because the two halves of the guard are not in the same
 * tree, which is the same reason `overlay-signal.ts` exists: the FORM knows it
 * is dirty, and the CONFIRMATION renders once in the dashboard layout — an
 * ancestor of every form, so a form cannot render it and cannot reach it
 * through props.
 *
 * - `dirty` — is some form on screen holding unsaved edits. It is a count, not
 *   a boolean: a screen can mount two guarded forms, and the last one to
 *   unmount must not clear a flag the other still needs.
 * - `pending` — the destination a click was intercepted on the way to, held
 *   until the owner answers. `null` means no question is being asked.
 *
 * A store rather than context, so `beforeunload` and the document-level click
 * listener can read the current value without a component re-render, and so
 * `useSyncExternalStore` can subscribe without an effect writing state.
 */
export type UnsavedChangesSnapshot = {
  dirty: boolean;
  /** Destination awaiting confirmation, or null when nothing is pending. */
  pending: string | null;
};

const listeners = new Set<() => void>();

let dirtyCount = 0;
let pending: string | null = null;
/** Recomputed on every change so `getSnapshot` can return a stable reference —
 *  returning a fresh object each call makes React loop. */
let snapshot: UnsavedChangesSnapshot = { dirty: false, pending: null };
/** One object, not one per call — React compares server snapshots by
 *  reference and warns (then re-renders) when they differ. */
const SERVER_SNAPSHOT: UnsavedChangesSnapshot = { dirty: false, pending: null };

function emit() {
  snapshot = { dirty: dirtyCount > 0, pending };
  for (const listener of listeners) listener();
}

export const unsavedChanges = {
  subscribe(onChange: () => void) {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  },
  getSnapshot(): UnsavedChangesSnapshot {
    return snapshot;
  },
  /** The server renders nothing dirty and nothing pending. */
  getServerSnapshot(): UnsavedChangesSnapshot {
    return SERVER_SNAPSHOT;
  },

  /** Read without subscribing — for the event listeners, which are not React. */
  isDirty() {
    return dirtyCount > 0;
  },

  /** Called by the guard hook as a form becomes dirty or clean. */
  setDirty(next: boolean) {
    const wasDirty = dirtyCount > 0;
    dirtyCount = Math.max(0, dirtyCount + (next ? 1 : -1));
    if (wasDirty !== dirtyCount > 0) emit();
  },

  /** Ask the owner about a destination. */
  ask(href: string) {
    pending = href;
    emit();
  },

  /** Dismiss the question, staying put. */
  cancel() {
    if (pending === null) return;
    pending = null;
    emit();
  },

  /**
   * Answer "leave". Clears the question AND the dirty count: the navigation is
   * about to unmount the form, and its cleanup would otherwise decrement a
   * counter it had already been removed from.
   */
  confirm(): string | null {
    const href = pending;
    pending = null;
    dirtyCount = 0;
    emit();
    return href;
  },
};
