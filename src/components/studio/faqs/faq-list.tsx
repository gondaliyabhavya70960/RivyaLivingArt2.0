"use client";

import { useMemo, useState, type FormEvent } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteFaqs, reorderFaq, upsertFaq } from "@/actions/faqs";
import { BulkBar } from "@/components/studio/bulk-bar";
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

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  order: number;
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

  return (
    <DialogContent
      className="max-h-[85vh] max-w-md overflow-y-auto"
      onInteractOutside={(e) => busy && e.preventDefault()}
      onEscapeKeyDown={(e) => busy && e.preventDefault()}
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
  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    faqs,
    PAGE_SIZE,
  );
  const rowIds = useMemo(() => pageRows.map((f) => f.id), [pageRows]);
  const selection = useSelection(rowIds);
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);

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
                Order
              </th>
              <th scope="col" className="w-16 px-4 py-3">
                <span className="sr-only">Edit</span>
              </th>
            </StudioTableHead>
          </thead>
          <tbody>
            {pageRows.map((faq, index) => (
              <StudioRow
                key={faq.id}
              >
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selection.selected.has(faq.id)}
                    onCheckedChange={() => selection.toggle(faq.id)}
                    aria-label={`Select ${faq.question}`}
                  />
                </td>
                <td className="max-w-xs px-4 py-3 font-medium text-foreground">
                  {truncate(faq.question)}
                </td>
                <td className="max-w-sm px-4 py-3 text-muted-foreground">
                  {truncate(faq.answer)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={
                        (page - 1) * pageSize + index === 0 || reordering
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
                        reordering
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
