"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FieldValues, UseFormReset, UseFormWatch } from "react-hook-form";

import {
  draftStorageKey,
  parseDraft,
  serializeDraft,
  type LocalDraftRecord,
} from "@/lib/local-draft";

export const DRAFT_DEBOUNCE_MS = 800;

/**
 * Local-only autosave for the studio's react-hook-form editors (10 remnants:
 * "no autosave"). Debounces every RHF value change into
 * `localStorage["studio:draft:<entity>:<id|new>"]` — never the database, and
 * never sent anywhere. `<LocalDraftBar/>` reads `hasDraft`/`savedAt` off the
 * same hook to offer Restore/Discard. The `useState` dialogs (FAQ, category,
 * research) use the value-shaped sibling `useLocalDraftValue`, which shares
 * the store below.
 *
 * Read as an EXTERNAL STORE (`useSyncExternalStore`), the pattern
 * `use-column-visibility.ts` and `SavedViews` already use: no effect
 * mirrors storage into `useState`, and a same-tab write notifies the
 * module-level listener set directly since the `storage` event only fires
 * in OTHER tabs.
 */
const listeners = new Set<() => void>();
const snapshots = new Map<
  string,
  { raw: string | null; record: LocalDraftRecord<unknown> | null }
>();

function readRecord(key: string): LocalDraftRecord<unknown> | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.record;

  const record = parseDraft(raw);
  snapshots.set(key, { raw, record });
  return record;
}

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

/** The stored draft under `storageKey`, read as an external store. */
export function useDraftRecord<T>(
  storageKey: string,
): LocalDraftRecord<T> | null {
  return useSyncExternalStore(
    subscribe,
    () => readRecord(storageKey),
    () => null,
  ) as LocalDraftRecord<T> | null;
}

/** Write `values` under `storageKey` and tell every subscriber. */
export function writeDraft<T>(storageKey: string, values: T): void {
  try {
    localStorage.setItem(storageKey, serializeDraft(values));
  } catch {
    // Storage write blocked (private mode, quota) — the edit just isn't
    // backed up locally; the real Save still works.
  }
  notify();
}

/** Remove the draft under `storageKey` and tell every subscriber. */
export function removeDraft(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Nothing to clear if storage was never reachable.
  }
  notify();
}

export function useLocalDraft<T extends FieldValues>({
  key: entity,
  id,
  watch,
  reset,
  enabled = true,
}: {
  /** Entity name — `"product"`, `"blog"`, `"portfolio"`, … */
  key: string;
  /** The row's id, or `undefined` on the create form. */
  id: string | undefined;
  watch: UseFormWatch<T>;
  reset: UseFormReset<T>;
  /** Off while a save is in flight, so autosave never races the real one. */
  enabled?: boolean;
}) {
  const storageKey = draftStorageKey(entity, id);
  const record = useDraftRecord<T>(storageKey);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every Restore. `reset()` repopulates every registered input,
  // but an editor that reads its value ONCE on mount (the Tiptap body,
  // which says so in its own header) keeps showing the old text — so the
  // form keys those editors on this and they remount with the restored
  // value. Everything else ignores it.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const subscription = watch((values) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        writeDraft(storageKey, values);
      }, DRAFT_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, storageKey, watch]);

  function discard() {
    // A write still pending in the debounce would put the draft straight
    // back — `reset()` on Restore notifies `watch`, so a Discard within
    // 800 ms of a Restore used to be undone by its own restore. Measured.
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    removeDraft(storageKey);
  }

  function restore() {
    if (!record) return;
    // Keep the values the form MOUNTED with as the defaults: the restored
    // edit is unsaved with respect to the database, so `isDirty` must read
    // true afterwards — the footer says "Unsaved changes" and the navigation
    // guard stays armed. Replacing the defaults (the first cut) made a
    // restored draft look saved until the next keystroke.
    reset(record.values, { keepDefaultValues: true });
    setVersion((current) => current + 1);
  }

  return {
    hasDraft: record !== null,
    savedAt: record?.savedAt ?? null,
    /** Count of restores — key a mount-once editor on it. */
    version,
    restore,
    discard,
  };
}
