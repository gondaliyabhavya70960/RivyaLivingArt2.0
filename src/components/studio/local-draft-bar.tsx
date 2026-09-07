"use client";

/**
 * "You have unsaved edits from <time> — Restore · Discard", banked above a
 * Studio form when `useLocalDraft` (or `useLocalDraftValue`) finds a local
 * autosave for this row. It is offered, never applied: the hook does not
 * compare the draft's time with the row's last save, so a draft abandoned on
 * one device can be older than a save made on another — the time in the bar
 * is what the person has to judge it by. `role="status"` — this is
 * information, not an interruption, and it must not steal focus.
 *
 * `disabled` while a save is in flight: a Restore mid-save would repaint the
 * form with values the request does not carry, and the ok branch would then
 * discard the draft and close — the restored edit neither saved nor kept.
 * The form's own buttons are already off for that window; these two follow.
 *
 * Renders nothing when there is no draft, so it never sits alongside a form
 * with nothing to restore.
 */
export function LocalDraftBar({
  savedAt,
  onRestore,
  onDiscard,
  disabled = false,
  paused = false,
}: {
  savedAt: number | null;
  onRestore: () => void;
  onDiscard: () => void;
  disabled?: boolean;
  /**
   * The draft in the slot is not this mount's, so the hook is not writing
   * over it — the person is told autosave waits on their Restore or Discard.
   */
  paused?: boolean;
}) {
  if (savedAt === null) return null;

  const time = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(savedAt);

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-sapphire-ink/30 bg-sapphire-ink/5 px-4 py-3 text-small text-foreground"
    >
      <span>
        You have unsaved edits from <span className="u-num">{time}</span> —
        saved on this device only.
        {paused ? " Autosave resumes once you restore or discard them." : ""}
      </span>
      <span className="ms-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onRestore}
          disabled={disabled}
          className="inline-flex min-h-11 items-center rounded-input font-medium text-sapphire-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 disabled:hover:no-underline"
        >
          Restore
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={disabled}
          className="inline-flex min-h-11 items-center rounded-input text-graphite underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 disabled:hover:no-underline"
        >
          Discard
        </button>
      </span>
    </div>
  );
}
