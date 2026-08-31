"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Loader2,
  Lock,
  Moon,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  discardSectionDraft,
  publishSections,
  reorderSections,
  resetSections,
  setSectionNote,
  setSectionVisible,
} from "@/actions/page-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyReorder, describeArrangementProblem } from "@/lib/page-sections";
import { cn } from "@/lib/utils";

export type SectionRow = {
  key: string;
  label: string;
  description: string;
  dark: boolean;
  hideable: boolean;
  movable: boolean;
  conditional: boolean;
  ownsH1: boolean;
  visible: boolean;
  unpublished: boolean;
  notes: string;
  copyCount: number;
  imageCount: number;
};

/**
 * The section board — one row per part of the page, in the order it reads.
 *
 * Up/down rather than drag: a keyboard user gets the same control as a mouse
 * user without a drag-and-drop library, and the list is thirteen items rather
 * than a hundred. A pinned section shows a lock instead of arrows, so the
 * reason it will not move is on the row rather than in a failed attempt.
 *
 * Every change is staged. The bar at the foot publishes the whole arrangement
 * at once — a page half-rearranged is worse than either version of it.
 */
export function SectionsBoard({
  pageKey,
  pages,
  previewPath,
  sections,
  pending,
  canReset,
}: {
  pageKey: string;
  pages: readonly { key: string; title: string }[];
  previewPath: string;
  sections: readonly SectionRow[];
  pending: number;
  canReset: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const visible = sections.filter((s) => s.visible);
  const darkShown = visible.filter((s) => s.dark).length;

  async function move(key: string, delta: number) {
    const order = sections.map((s) => s.key);
    const from = order.indexOf(key);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];

    // Predict the arrangement the action will write and check it here, the
    // way the navigation board checks an href before it calls. The action
    // refuses too, but `runAction` reports every throw as "something went
    // wrong" — and a refusal that does not name the two dark bands involved
    // leaves the owner with nowhere to go.
    const problem = describeArrangementProblem(applyReorder(sections, order));
    if (problem) {
      toast.error(problem);
      return;
    }

    setBusy(true);
    const res = await reorderSections({ pageKey, keys: order });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function toggle(row: SectionRow) {
    const problem = describeArrangementProblem(
      sections.map((s) =>
        s.key === row.key ? { ...s, visible: !s.visible } : s,
      ),
    );
    if (problem) {
      toast.error(problem);
      return;
    }

    setBusy(true);
    const res = await setSectionVisible({
      pageKey,
      key: row.key,
      visible: !row.visible,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function publish() {
    setBusy(true);
    const res = await publishSections(pageKey);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("The new arrangement is live.");
    router.refresh();
  }

  async function discard() {
    setBusy(true);
    const res = await discardSectionDraft(pageKey);
    setBusy(false);
    setConfirmDiscard(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Back to the arrangement visitors are seeing.");
    router.refresh();
  }

  async function reset() {
    setBusy(true);
    const res = await resetSections(pageKey);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Back to the arrangement the page ships with.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {pages.length > 1 && (
        <nav aria-label="Page" className="flex flex-wrap gap-1.5">
          {pages.map((p) => (
            <Link
              key={p.key}
              href={`/studio/sections?page=${p.key}`}
              aria-current={p.key === pageKey ? "page" : undefined}
              className={cn(
                "rounded-md border px-3 py-1.5 text-small transition-colors",
                p.key === pageKey
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-graphite hover:border-foreground hover:text-foreground",
              )}
            >
              {p.title}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3 text-small text-graphite">
        <span>
          <span className="tabular-nums text-foreground">{visible.length}</span>{" "}
          of {sections.length} sections showing
        </span>
        <span className="flex items-center gap-1.5">
          <Moon aria-hidden className="size-3.5" />
          <span className="tabular-nums text-foreground">{darkShown}</span> of 3
          dark bands used
        </span>
        {canReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={busy}
            className="ms-auto"
          >
            <RotateCcw aria-hidden className="size-4" />
            Back to the shipped arrangement
          </Button>
        )}
      </div>

      <ol className="divide-y divide-border">
        {sections.map((row, index) => (
          <li
            key={row.key}
            className={cn("py-3", !row.visible && "opacity-60")}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-72">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="u-num text-12 text-graphite">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-small font-medium text-foreground">
                    {row.label}
                  </span>
                  {row.dark && (
                    <Badge variant="secondary">
                      <Moon aria-hidden className="me-1 size-3" />
                      Dark band
                    </Badge>
                  )}
                  {!row.visible && <Badge variant="outline">Hidden</Badge>}
                  {row.unpublished && (
                    <Badge variant="outline">Not published</Badge>
                  )}
                  {row.conditional && (
                    <Badge variant="outline">Shows when there is content</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-graphite">
                  {row.description}
                </p>
                <p className="mt-0.5 font-mono text-12 text-graphite">
                  {row.copyCount > 0 && `${row.copyCount} copy group`}
                  {row.copyCount > 0 && row.imageCount > 0 && " · "}
                  {row.imageCount > 0 &&
                    `${row.imageCount} picture${row.imageCount === 1 ? "" : "s"}`}
                </p>
                <NoteField
                  pageKey={pageKey}
                  sectionKey={row.key}
                  note={row.notes}
                />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {row.movable ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy || index === 0}
                      onClick={() => move(row.key, -1)}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                      <span className="sr-only">Move {row.label} up</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy || index === sections.length - 1}
                      onClick={() => move(row.key, 1)}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                      <span className="sr-only">Move {row.label} down</span>
                    </Button>
                  </>
                ) : (
                  <span
                    className="flex items-center gap-1 pe-2 text-12 text-graphite"
                    title={
                      row.ownsH1
                        ? "Carries the page's heading"
                        : "Pinned where the page is paced for it"
                    }
                  >
                    <Lock aria-hidden className="size-3.5" />
                    Pinned
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy || !row.hideable}
                  onClick={() => toggle(row)}
                  className={cn(!row.hideable && "opacity-50")}
                >
                  {row.visible ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {pending > 0 && (
        <div className="sticky bottom-0 z-40 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-small text-foreground">
              <span className="font-medium tabular-nums">{pending}</span> change
              {pending === 1 ? "" : "s"} to the arrangement are not published.
            </p>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <a
                  href={`/api/draft?redirect=${encodeURIComponent(previewPath)}`}
                >
                  <Eye aria-hidden className="size-4" />
                  Preview
                </a>
              </Button>
              {confirmDiscard ? (
                <>
                  <span className="text-small text-alert">
                    Throw them away?
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={discard}
                    disabled={busy}
                  >
                    Yes, discard
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDiscard(false)}
                    disabled={busy}
                  >
                    Keep
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDiscard(true)}
                  disabled={busy}
                >
                  <Trash2 aria-hidden className="size-4" />
                  Discard
                </Button>
              )}
              <Button size="sm" onClick={publish} disabled={busy}>
                {busy ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Upload aria-hidden className="size-4" />
                )}
                Publish arrangement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A staff note on a section — why it is arranged the way it is. */
function NoteField({
  pageKey,
  sectionKey,
  note,
}: {
  pageKey: string;
  sectionKey: string;
  note: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (draft === null) return;
    setBusy(true);
    const res = await setSectionNote({ pageKey, key: sectionKey, note: draft });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDraft(null);
    router.refresh();
  }

  if (draft === null) {
    return note ? (
      <p className="mt-1 text-xs text-graphite">
        <span className="text-foreground">Note:</span> {note}{" "}
        <button
          type="button"
          className="underline"
          onClick={() => setDraft(note)}
        >
          edit
        </button>
      </p>
    ) : (
      <button
        type="button"
        className="mt-1 text-xs text-graphite underline"
        onClick={() => setDraft("")}
      >
        Add a note
      </button>
    );
  }

  return (
    <div className="mt-2 flex max-w-[46ch] flex-wrap items-center gap-2">
      <Input
        value={draft}
        autoFocus
        aria-label={`Note on ${sectionKey}`}
        placeholder="Why it sits here — for whoever looks next"
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button type="button" size="sm" onClick={save} disabled={busy}>
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setDraft(null)}
        disabled={busy}
      >
        Cancel
      </Button>
    </div>
  );
}
