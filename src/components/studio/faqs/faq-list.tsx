"use client";

import { useMemo, useState, type FormEvent } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import { useRouter } from "next/navigation";
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
import {
  TranslationsSection,
  type TranslationsValue,
} from "@/components/studio/translations-section";
import { toTranslationsRecord } from "@/lib/translations-form";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { EmptyState } from "@/components/studio/page-header";
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
      {/* Radix unmounts content on close, so keying the body by faq
          resets field state on every open without any effect. */}
      <FaqFormBody
        key={faq?.id ?? "new"}
        faq={faq}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}

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
  const [translations, setTranslations] = useState<TranslationsValue>(() =>
    toTranslationsRecord(faq?.translations),
  );
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(faq);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast.error("Question and answer are required.");
      return;
    }
    setBusy(true);
    const res = await upsertFaq({
      id: faq?.id,
      question: question.trim(),
      answer: answer.trim(),
      translations,
    });
    setBusy(false);
    if (res.ok) {
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
        <div className="space-y-1.5">
          <Label htmlFor="faq-question">Question</Label>
          <Input
            id="faq-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="How long does a custom order take?"
            required
            autoFocus
          />
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
          />
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
  const [search, setSearch] = useState("");
  const [demoOnly, setDemoOnly] = useState(false);

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

  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    filtered,
    PAGE_SIZE,
    `${search}|${demoOnly}`,
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
    setDeleting(true);
    const res = await deleteFaqs(selection.ids);
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) {
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

  const filtering = search.trim() !== "" || demoOnly;

  if (faqs.length === 0) {
    return (
      <EmptyState
        title="No FAQs yet"
        description="Answer the questions shoppers ask most — delivery times, care, customisation."
        action={<NewFaqButton />}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            aria-hidden
            strokeWidth={1.5}
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FAQs…"
            aria-label="Search FAQs"
            className="h-10 w-64 ps-10"
          />
        </div>
        <button
          type="button"
          aria-pressed={demoOnly}
          onClick={() => setDemoOnly((v) => !v)}
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
        <div
          tabIndex={0}
          role="region"
          aria-label="FAQs"
          className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                <th scope="col" className="px-4 py-3 font-medium">
                  Question
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Answer
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Order
                </th>
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
                          filtering
                        }
                        title={
                          filtering
                            ? "Clear the search and demo filter to reorder"
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
                          filtering
                        }
                        title={
                          filtering
                            ? "Clear the search and demo filter to reorder"
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
