"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FieldValues, UseFormReset, UseFormWatch } from "react-hook-form";

import {
  coerceDraftValues,
  draftStorageKey,
  parseDraft,
  sameDraftValues,
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
 * One slot per row, but a draft that was already there when the form
 * mounted is never written over: it is the one copy of an edit a crash left
 * behind, and a stray keystroke must not replace it 800 ms later. It is the
 * person's to Restore or Discard first; until they do, this mount's typing
 * is not autosaved, and after either it is (with the next change); `paused`
 * says so, for the bar. A write still pending when the form unmounts — an
 * in-app navigation the guard let through — is flushed, not dropped; a
 * successful save discards first, so nothing is flushed behind it. (A hard
 * reload runs no cleanup, so the last 800 ms before one are still lost.)
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
  // A boolean, deliberately: the record object changes reference on every
  // write and would re-subscribe `watch` each time as a dependency.
  const hasDraft = record !== null;
  // Whether this mount wrote (or restored) the draft in the slot — the
  // gate above: a slot someone else filled is not written until they act.
  const wroteHere = useRef(false);
  // The same, for render: the bar reads `paused` off it. Set from the
  // debounce callback and the two click handlers only.
  const [owned, setOwned] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A write scheduled and not yet made, and the values it would carry —
  // `watch` hands its callback a deep-partial shape, hence not `T`.
  const unwritten = useRef<unknown>(null);

  // Flush on leave — see the header. Order-independent: the subscription
  // cleanup below cancels the timer and never touches `unwritten`.
  useEffect(
    () => () => {
      if (unwritten.current !== null) {
        writeDraft(storageKey, unwritten.current);
        unwritten.current = null;
      }
    },
    [storageKey],
  );
  // Bumped on every Restore. `reset()` repopulates every registered input,
  // but an editor that reads its value ONCE on mount (the Tiptap body,
  // which says so in its own header) keeps showing the old text — so the
  // form keys those editors on this and they remount with the restored
  // value. Everything else ignores it.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const subscription = watch((values) => {
      if (hasDraft && !wroteHere.current) {
        unwritten.current = null;
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      unwritten.current = values;
      timer.current = setTimeout(() => {
        timer.current = null;
        unwritten.current = null;
        wroteHere.current = true;
        writeDraft(storageKey, values);
        setOwned(true);
      }, DRAFT_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, hasDraft, storageKey, watch]);

  function discard() {
    // A write still pending in the debounce would put the draft straight
    // back — `reset()` on Restore notifies `watch`, so a Discard within
    // 800 ms of a Restore used to be undone by its own restore. Measured.
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    unwritten.current = null;
    wroteHere.current = false;
    setOwned(false);
    removeDraft(storageKey);
  }

  function restore() {
    if (!record) return;
    // Folded onto the values on screen: a draft written before a field was
    // added or renamed keeps this form's value for the keys it lacks, so
    // `reset` never plants `undefined` in a registered input. One with
    // nothing usable in it says nothing, and goes.
    const current = watch();
    const next = coerceDraftValues(current, record.values);
    if (sameDraftValues(next, current)) {
      discard();
      return;
    }
    // Ours from here, so the `watch` notification `reset` sends below is
    // written rather than gated.
    wroteHere.current = true;
    setOwned(true);
    // Keep the values the form MOUNTED with as the defaults: the restored
    // edit is unsaved with respect to the database, so `isDirty` must read
    // true afterwards — the footer says "Unsaved changes" and the navigation
    // guard stays armed. Replacing the defaults (the first cut) made a
    // restored draft look saved until the next keystroke.
    reset(next, { keepDefaultValues: true });
    setVersion((current) => current + 1);
  }

  return {
    hasDraft,
    savedAt: record?.savedAt ?? null,
    /** A draft this mount did not write is in the slot: autosave waits. */
    paused: hasDraft && !owned,
    /** Count of restores — key a mount-once editor on it. */
    version,
    restore,
    discard,
  };
}
