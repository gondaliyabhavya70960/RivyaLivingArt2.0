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
 * Renders nothing when there is no draft, so it never sits alongside a form
 * with nothing to restore.
 */
export function LocalDraftBar({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: number | null;
  onRestore: () => void;
  onDiscard: () => void;
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
      </span>
      <span className="ms-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex min-h-11 items-center rounded-input font-medium text-sapphire-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          Restore
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex min-h-11 items-center rounded-input text-graphite underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          Discard
        </button>
      </span>
    </div>
  );
}
