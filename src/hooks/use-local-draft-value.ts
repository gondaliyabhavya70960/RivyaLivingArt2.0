"use client";

import { useEffect, useRef, useState } from "react";

import {
  coerceDraftValues,
  draftStorageKey,
  sameDraftValues,
} from "@/lib/local-draft";
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
 *   A draft that was ALREADY there when the body mounted is never written
 *   over either: it is the one copy of an edit a crash left behind, and a
 *   stray keystroke into an autofocused field must not replace it 800 ms
 *   later. It is the person's to Restore or Discard first; until they do,
 *   this mount's typing is not autosaved, and after either it is (a Restore
 *   makes the slot this mount's; a Discard empties it — with the next change,
 *   so Discard does not see the bar come straight back). Same rule in the
 *   react-hook-form hook. `paused` says so, for the bar.
 * - **A write still pending when the body unmounts is flushed**, not
 *   dropped: Cancel and the ✕ unmount the body in the same commit, and the
 *   last 800 ms of typing — the end of a transcription — is what "kept on
 *   Cancel" has to mean. A successful save discards first, so nothing is
 *   flushed behind it.
 * - **`initial` is read once, on mount.** The dialog bodies remount on every
 *   open (they are keyed by row AND by open state — Radix unmounts only the
 *   content on close, never the body), so the mount is the "just opened"
 *   moment and the props at that moment are the baseline; a later prop
 *   change does not move it.
 *
 * Restore folds the stored record onto that baseline (`coerceDraftValues`):
 * a draft written before a field was added or renamed restores what it can
 * and never hands a setter `undefined`. If nothing of it survives, the
 * restored values equal the baseline and the effect removes the draft — it
 * heals rather than lingers.
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
  // A boolean, deliberately: the record object changes reference on every
  // write, and as an effect dependency it would re-arm an 800 ms write loop.
  const hasDraft = record !== null;
  const baseline = useRef(initial);
  const wroteHere = useRef(false);
  // `wroteHere` for render: the bar reads `paused` off it. Set only from the
  // debounce callback and the two click handlers, never in an effect body.
  const [owned, setOwned] = useState(false);
  // The `values` object storage already holds, or the one Discard was pressed
  // on: nothing to write until the person changes something.
  const settled = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A write scheduled and not yet made, and the values it would carry — for
  // the flush on unmount below.
  const unwritten = useRef<T | null>(null);
  const [version, setVersion] = useState(0);

  // Flush on leave: the debounce cleanup below only cancels, so this one
  // writes what it cancelled. Order-independent — it reads `unwritten`, which
  // the other cleanup never touches; `discard()` clears it first on a save.
  useEffect(
    () => () => {
      if (unwritten.current !== null) {
        writeDraft(storageKey, unwritten.current);
        unwritten.current = null;
      }
    },
    [storageKey],
  );

  useEffect(() => {
    if (!enabled) return;
    if (sameDraftValues(values, baseline.current)) {
      // Undone back to the opening values: a draft this mount wrote says
      // nothing now, so it goes; one that pre-dates this mount stays.
      unwritten.current = null;
      if (wroteHere.current) {
        wroteHere.current = false;
        removeDraft(storageKey);
      }
      return;
    }
    // A draft this mount did not write is the person's to Restore or
    // Discard first — see the header. And the values already in storage,
    // or just discarded, wait for the next change.
    if ((hasDraft && !wroteHere.current) || values === settled.current) {
      unwritten.current = null;
      return;
    }
    unwritten.current = values;
    const pending = setTimeout(() => {
      timer.current = null;
      unwritten.current = null;
      wroteHere.current = true;
      settled.current = values;
      writeDraft(storageKey, values);
      setOwned(true);
    }, DRAFT_DEBOUNCE_MS);
    timer.current = pending;
    return () => {
      clearTimeout(pending);
      if (timer.current === pending) timer.current = null;
    };
  }, [enabled, hasDraft, storageKey, values]);

  function discard() {
    // Also drop a write still pending, or it would put the draft back.
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    unwritten.current = null;
    wroteHere.current = false;
    setOwned(false);
    settled.current = values;
    removeDraft(storageKey);
  }

  function restore() {
    if (!record) return;
    const next = coerceDraftValues(baseline.current, record.values);
    if (sameDraftValues(next, baseline.current)) {
      // Nothing usable survived the fold: the draft says nothing, so it goes
      // here and now — the effect cannot be relied on to notice, because
      // setters handed values equal to state do not re-render.
      discard();
      return;
    }
    apply(next);
    // The restored values now differ from the baseline, so the effect
    // re-writes them; count that as this mount's, so an undo clears it.
    wroteHere.current = true;
    setOwned(true);
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
