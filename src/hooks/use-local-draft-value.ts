"use client";

import { useEffect, useRef, useState } from "react";

import { draftStorageKey, sameDraftValues } from "@/lib/local-draft";
import {
  DRAFT_DEBOUNCE_MS,
  removeDraft,
  useDraftRecord,
  writeDraft,
} from "@/hooks/use-local-draft";

/**
 * The value-shaped sibling of `useLocalDraft`, for the Studio's `useState`
 * dialogs — FAQ, category, research — whose fields are a dozen setters and no
 * form library, so the react-hook-form hook (typed on `watch`/`reset`) cannot
 * be attached. Same storage key, same serialisation, same `<LocalDraftBar/>`;
 * the caller hands over the current `values` object each render, the
 * `initial` values the body mounted with, and an `apply()` that fans a
 * restored record back into its setters.
 *
 * Two rules the react-hook-form hook does not need:
 *
 * - **A draft equal to what the dialog opened with is never written**, and
 *   one this mount wrote is removed again if the edit is undone. Without
 *   that, every dialog opened and closed would leave a "you have unsaved
 *   edits" bar for the next open, and the bar would be noise within a day.
 *   A draft that was ALREADY there when the body mounted is left alone until
 *   the person restores or discards it — it is theirs, not this mount's.
 * - **`initial` is read once, on mount.** The dialog bodies remount on every
 *   open (Radix unmounts the content and they are keyed by row), so the mount
 *   is the "just opened" moment and the props at that moment are the
 *   baseline; a later prop change does not move it.
 *
 * `enabled: !busy` keeps the write off during the save round trip, exactly
 * as the editors do. The write is a debounced effect that touches
 * `localStorage`, never state, so the repo's no-setState-in-effect rule holds;
 * `version` (bumped by Restore) is the one piece of state, and it changes
 * only from the Restore click.
 */
export function useLocalDraftValue<T extends Record<string, unknown>>({
  key: entity,
  id,
  values,
  initial,
  apply,
  enabled = true,
}: {
  /** Entity name — `"faq"`, `"category"`, `"research"`. */
  key: string;
  /** The row's id, or `undefined` on the create form. */
  id: string | undefined;
  /** The dialog's current values, rebuilt from its state each render. */
  values: T;
  /** The values the dialog opened with — read on mount only. */
  initial: T;
  /** Fan a restored record back into the setters. */
  apply: (values: T) => void;
  /** Off while a save is in flight. */
  enabled?: boolean;
}) {
  const storageKey = draftStorageKey(entity, id);
  const record = useDraftRecord<T>(storageKey);
  const baseline = useRef(initial);
  const wroteHere = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (sameDraftValues(values, baseline.current)) {
      // Undone back to the opening values: a draft this mount wrote says
      // nothing now, so it goes; one that pre-dates this mount stays.
      if (wroteHere.current) {
        wroteHere.current = false;
        removeDraft(storageKey);
      }
      return;
    }
    const pending = setTimeout(() => {
      timer.current = null;
      wroteHere.current = true;
      writeDraft(storageKey, values);
    }, DRAFT_DEBOUNCE_MS);
    timer.current = pending;
    return () => {
      clearTimeout(pending);
      if (timer.current === pending) timer.current = null;
    };
  }, [enabled, storageKey, values]);

  function discard() {
    // Also drop a write still pending, or it would put the draft back.
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    wroteHere.current = false;
    removeDraft(storageKey);
  }

  function restore() {
    if (!record) return;
    apply(record.values);
    // The restored values now differ from the baseline, so the effect
    // re-writes them; count that as this mount's, so an undo clears it.
    wroteHere.current = true;
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
