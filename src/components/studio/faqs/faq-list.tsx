"use client";

import { useMemo, useState, type FormEvent } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ContentStatus } from "@/generated/prisma/enums";
import {
  deleteFaqs,
  reorderFaq,
  setFaqStatus,
  upsertFaq,
} from "@/actions/faqs";
import { BulkBar } from "@/components/studio/bulk-bar";
import { DemoBadge } from "@/components/studio/demo-badge";
import { SortHead, useSort } from "@/components/studio/sort-header";
import {
  TranslationsSection,
  type TranslationsValue,
} from "@/components/studio/translations-section";
import { draftStorageKey } from "@/lib/local-draft";
import { toTranslationsRecord } from "@/lib/translations-form";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { FieldError } from "@/components/studio/field-error";
import { EmptyState } from "@/components/studio/page-header";
import { EmptyFaqsArt } from "@/components/icons/empty-art";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSelection } from "@/hooks/use-selection";
import { useDismissGuard } from "@/hooks/use-dismiss-guard";
import { removeDraft } from "@/hooks/use-local-draft";
import { useLocalDraftValue } from "@/hooks/use-local-draft-value";
import { LocalDraftBar } from "@/components/studio/local-draft-bar";

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  order: number;
  status: ContentStatus;
  isDemo: boolean;
  /** Raw per-locale overrides JSON from the database (`{ [locale]: {…} }`). */
  translations: unknown;
};

function truncate(text: string, max = 80) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Create/edit form dialog. */
function FaqFormDialog({
  open,
  onOpenChange,
  faq,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faq?: FaqRow | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Keyed by row AND by open state: Radix unmounts the CONTENT on close,
          not this body, so the create dialog's typed fields used to survive a
          Cancel and greet the next open — the local draft keeps that copy
          now, offered rather than imposed. Closing re-keys the body as
          well, which cuts the content's exit animation short — the edit
          instance already did that at HEAD when its key fell back to "new",
          and reduced motion has no exit to cut. */}
      <FaqFormBody
        key={`${faq?.id ?? "new"}:${open ? "open" : "closed"}`}
        faq={faq}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}

/** What the dialog's local draft carries — the typed fields, not the errors. */
type FaqDraft = {
  question: string;
  answer: string;
  translations: TranslationsValue;
};

function FaqFormBody({
  faq,
  onOpenChange,
}: {
  faq?: FaqRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<TranslationsValue>(() =>
    toTranslationsRecord(faq?.translations),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const isEdit = Boolean(faq);

  // The same local safety net the editors carry, value-shaped because this
  // dialog is three setters and no form library. Off once saved: the render
  // between the save and the close must not write the just-discarded draft
  // back (the body remounts on close, but only because those two updates
  // batch — the flag does not rely on it). Restore also clears the field
  // errors: they belong to the copy on screen, and the next submit re-judges.
  const draftValues = useMemo<FaqDraft>(
    () => ({ question, answer, translations }),
    [question, answer, translations],
  );
  const draft = useLocalDraftValue<FaqDraft>({
    key: "faq",
    id: faq?.id,
    values: draftValues,
    initial: {
      question: faq?.question ?? "",
      answer: faq?.answer ?? "",
      translations: toTranslationsRecord(faq?.translations),
    },
    apply: (v) => {
      setQuestion(v.question);
      setAnswer(v.answer);
      setTranslations(v.translations);
      setQuestionError(null);
      setAnswerError(null);
    },
    enabled: !busy && !saved,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let hasError = false;
    if (!question.trim()) {
      setQuestionError("Question is required.");
      hasError = true;
    } else {
      setQuestionError(null);
    }
    if (!answer.trim()) {
      setAnswerError("Answer is required.");
      hasError = true;
    } else {
      setAnswerError(null);
    }
    if (hasError) return;
    setBusy(true);
    const res = await upsertFaq({
      id: faq?.id,
      question: question.trim(),
      answer: answer.trim(),
      translations,
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      draft.discard();
      toast.success(isEdit ? "FAQ updated." : "FAQ created.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  // Blocks Escape and outside-clicks while the dialog holds unsaved
  // input, and unconditionally while a save is in flight.
  const [dismissRef, dismissProps] = useDismissGuard(busy);

  return (
    <DialogContent
      className="max-h-[85vh] max-w-md overflow-y-auto"
      ref={dismissRef}
      {...dismissProps}
    >
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit FAQ" : "New FAQ"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the question or its answer."
            : "Answer a common question shoppers ask before ordering."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <LocalDraftBar
          savedAt={draft.savedAt}
          onRestore={draft.restore}
          onDiscard={draft.discard}
          disabled={busy}
          paused={draft.paused}
        />
        <div className="space-y-1.5">
          <Label htmlFor="faq-question">Question</Label>
          <Input
            id="faq-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="How long does a custom order take?"
            required
            autoFocus
            aria-invalid={!!questionError}
            aria-describedby={questionError ? "faq-question-error" : undefined}
          />
          <FieldError id="faq-question-error">{questionError}</FieldError>
          <p className="text-xs text-muted-foreground">
            Shown exactly as typed on the public FAQ page.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="faq-answer">Answer</Label>
          <Textarea
            id="faq-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Most custom pieces are cured, finished and shipped within 2–3 weeks…"
            rows={5}
            required
            aria-invalid={!!answerError}
            aria-describedby={answerError ? "faq-answer-error" : undefined}
          />
          <FieldError id="faq-answer-error">{answerError}</FieldError>
        </div>

        <TranslationsSection
          value={translations}
          onChange={setTranslations}
          idPrefix="faq"
          fields={[
            {
              name: "question",
              label: "Question",
              kind: "text",
              base: question,
            },
            { name: "answer", label: "Answer", kind: "textarea", base: answer },
          ]}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create FAQ"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Header action — owns its own create dialog instance. */
export function NewFaqButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New FAQ
      </Button>
      <FaqFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function FaqList({ faqs }: { faqs: FaqRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const demoOnly = searchParams.get("demo") === "1";
  const [searchInput, setSearchInput] = useState(search);

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faqs.filter((faq) => {
      if (demoOnly && !faq.isDemo) return false;
      if (!q) return true;
      return (
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q)
      );
    });
  }, [faqs, search, demoOnly]);

  const {
    sorted,
    sort,
    toggle: toggleSort,
  } = useSort<FaqRow>(
    filtered,
    (row, key) => {
      switch (key) {
        case "question":
          return row.question;
        case "answer":
          return row.answer;
        case "order":
          return row.order;
        default:
          return null;
      }
    },
    { key: "order", dir: "asc" },
  );
  // Manual up/down reorder only makes sense in the un-sorted, un-filtered
  // view — it swaps a row with its neighbour in the GLOBAL order field, and
  // "neighbour" stops meaning anything once the visible order is a search
  // match or a different column's sort.
  const canReorder =
    sort.key === "order" && sort.dir === "asc" && !search.trim() && !demoOnly;

  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    sorted,
    PAGE_SIZE,
    `${search}|${demoOnly}|${sort.key}|${sort.dir}`,
  );
  const rowIds = useMemo(() => pageRows.map((f) => f.id), [pageRows]);
  const selection = useSelection(rowIds);
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleDelete() {
    const count = selection.count;
    const ids = selection.ids;
    setDeleting(true);
    const res = await deleteFaqs(ids);
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) {
      // A deleted row's local draft would otherwise sit under an id nothing
      // mounts again; the editors' own Delete does the same through the hook.
      for (const id of ids) removeDraft(draftStorageKey("faq", id));
      toast.success(`Deleted ${count} ${count === 1 ? "FAQ" : "FAQs"}.`);
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    setReordering(true);
    const res = await reorderFaq(id, direction);
    setReordering(false);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }

  async function handleToggleStatus(faq: FaqRow) {
    setTogglingId(faq.id);
    const next = faq.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    const res = await setFaqStatus(faq.id, next);
    setTogglingId(null);
    if (res.ok) {
      toast.success(
        next === "PUBLISHED"
          ? "FAQ published."
          : "FAQ moved to draft — hidden from the public FAQ page.",
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (faqs.length === 0) {
    return (
      <EmptyState
        art={EmptyFaqsArt}
        title="No FAQs yet"
        description="Answer the questions shoppers ask most — delivery times, care, customisation."
        action={<NewFaqButton />}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ q: searchInput.trim() || undefined });
          }}
        >
          <Search
            aria-hidden
            strokeWidth={1.5}
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search FAQs…"
            aria-label="Search FAQs"
            className="h-10 w-64 ps-10"
          />
        </form>
        <button
          type="button"
          aria-pressed={demoOnly}
          onClick={() => updateParams({ demo: demoOnly ? undefined : "1" })}
          className={
            demoOnly
              ? "inline-flex min-h-11 items-center rounded-full border border-sapphire-ink bg-sapphire-ink/10 px-4 text-small font-medium text-sapphire-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
              : "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-small text-graphite outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
          }
        >
          Demo only
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No FAQs found"
          description="Try clearing the search or the demo filter."
        />
      ) : (
        <>
          {/* §12.6 — on a phone the table becomes cards. */}
          <label className="mb-3 flex min-h-11 cursor-pointer items-center gap-3 text-small text-graphite md:hidden">
            <Checkbox
              checked={selection.allSelected}
              onCheckedChange={selection.toggleAll}
              aria-label="Select all"
            />
            Select all on this page
          </label>
          <ul className="space-y-3 md:hidden">
            {pageRows.map((faq) => (
              <li
                key={faq.id}
                className="rounded-card border border-border bg-card p-4 shadow-e1"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selection.selected.has(faq.id)}
                    onCheckedChange={() => selection.toggle(faq.id)}
                    aria-label={`Select ${faq.question}`}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-small font-medium text-foreground">
                        {truncate(faq.question)}
                      </p>
                      {faq.isDemo && <DemoBadge />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-small text-graphite">
                      {faq.answer}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(faq)}
                        disabled={togglingId === faq.id}
                        aria-label={
                          faq.status === "PUBLISHED"
                            ? `Move "${faq.question}" to draft`
                            : `Publish "${faq.question}"`
                        }
                      >
                        <Badge
                          variant={
                            faq.status === "PUBLISHED" ? "success" : "secondary"
                          }
                        >
                          {faq.status === "PUBLISHED" ? "Published" : "Draft"}
                        </Badge>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ms-auto"
                        onClick={() => setEditing(faq)}
                        aria-label={`Edit "${faq.question}"`}
                      >
                        <Pencil className="size-4" /> Edit
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div
            tabIndex={0}
            role="region"
            aria-label="FAQs"
            className="hidden overflow-x-auto rounded-card border border-border bg-card shadow-e1 md:block [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <table className="w-full text-sm">
              <thead>
                <StudioTableHead>
                  <th scope="col" className="w-12 px-4 py-3">
                    <Checkbox
                      checked={selection.allSelected}
                      onCheckedChange={selection.toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <SortHead
                    label="Question"
                    sortKey="question"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortHead
                    label="Answer"
                    sortKey="answer"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <SortHead
                    label="Order"
                    sortKey="order"
                    sort={sort}
                    onSort={toggleSort}
                    numeric
                  />
                  <th scope="col" className="w-16 px-4 py-3">
                    <span className="sr-only">Edit</span>
                  </th>
                </StudioTableHead>
              </thead>
              <tbody>
                {pageRows.map((faq, index) => (
                  <StudioRow key={faq.id}>
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selection.selected.has(faq.id)}
                        onCheckedChange={() => selection.toggle(faq.id)}
                        aria-label={`Select ${faq.question}`}
                      />
                    </td>
                    <td className="max-w-xs px-4 py-3 font-medium text-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{truncate(faq.question)}</span>
                        {faq.isDemo && <DemoBadge />}
                      </div>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-muted-foreground">
                      {truncate(faq.answer)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(faq)}
                        disabled={togglingId === faq.id}
                        aria-label={
                          faq.status === "PUBLISHED"
                            ? `Move "${faq.question}" to draft`
                            : `Publish "${faq.question}"`
                        }
                        className="inline-flex min-h-8 items-center rounded-input outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <Badge
                          variant={
                            faq.status === "PUBLISHED" ? "success" : "secondary"
                          }
                        >
                          {faq.status === "PUBLISHED" ? "Published" : "Draft"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={
                            (page - 1) * pageSize + index === 0 ||
                            reordering ||
                            !canReorder
                          }
                          title={
                            !canReorder
                              ? "Sort by Order and clear the search/demo filter to reorder"
                              : undefined
                          }
                          onClick={() => handleReorder(faq.id, "up")}
                          aria-label={`Move "${faq.question}" up`}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={
                            (page - 1) * pageSize + index === total - 1 ||
                            reordering ||
                            !canReorder
                          }
                          title={
                            !canReorder
                              ? "Sort by Order and clear the search/demo filter to reorder"
                              : undefined
                          }
                          onClick={() => handleReorder(faq.id, "down")}
                          aria-label={`Move "${faq.question}" down`}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setEditing(faq)}
                        aria-label={`Edit "${faq.question}"`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </StudioRow>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        unit="FAQs"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 /> Delete
        </Button>
      </BulkBar>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={selection.count}
        noun="FAQ"
        onConfirm={handleDelete}
        busy={deleting}
      />

      <FaqFormDialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        faq={editing}
      />
    </>
  );
}
