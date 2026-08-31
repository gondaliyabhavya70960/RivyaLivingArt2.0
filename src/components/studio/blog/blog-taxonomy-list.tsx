"use client";

import { useMemo, useState, type FormEvent } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import { useRouter } from "next/navigation";
import { Languages, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteBlogCategories,
  deleteTags,
  setTaxonomyTranslations,
  upsertBlogCategory,
  upsertTag,
} from "@/actions/blog";
import { useSelection } from "@/hooks/use-selection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { EmptyState } from "@/components/studio/page-header";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TranslationsSection,
  type TranslationsValue,
} from "@/components/studio/translations-section";
import { toTranslationsRecord } from "@/lib/translations-form";
import { translatableLocales } from "@/lib/localize";

export type TaxonomyRow = {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  translations: unknown;
};

/** How many of the eight non-English locales this row has a name for. */
function translatedCount(translations: unknown): number {
  const record = toTranslationsRecord(translations);
  return translatableLocales.filter((locale) => {
    const value = record[locale]?.name;
    return typeof value === "string" && value.trim() !== "";
  }).length;
}

/** One list component serves both blog categories and tags. */
export function BlogTaxonomyList({
  kind,
  rows,
}: {
  kind: "category" | "tag";
  rows: TaxonomyRow[];
}) {
  const router = useRouter();

  const { pageRows, page, setPage, pageCount, total, pageSize } =
    usePagination(rows, PAGE_SIZE);
  const rowIds = useMemo(() => pageRows.map((r) => r.id), [pageRows]);
  const selection = useSelection(rowIds);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<TaxonomyRow | null>(null);
  const [draft, setDraft] = useState<TranslationsValue>({});
  const [saving, setSaving] = useState(false);

  const isCategory = kind === "category";
  const nounPlural = isCategory ? "categories" : "tags";

  function openTranslations(row: TaxonomyRow) {
    setEditing(row);
    setDraft(toTranslationsRecord(row.translations));
  }

  async function saveTranslations() {
    if (!editing) return;
    setSaving(true);
    const result = await setTaxonomyTranslations({
      kind,
      id: editing.id,
      translations: draft,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Names saved.");
    setEditing(null);
    router.refresh();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required.");
      return;
    }
    setCreating(true);
    const result = isCategory
      ? await upsertBlogCategory(trimmed)
      : await upsertTag(trimmed);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data?.created === false) {
      toast.info(`"${trimmed}" already exists.`);
    } else {
      toast.success(isCategory ? "Category created." : "Tag created.");
    }
    setName("");
    router.refresh();
  }

  async function handleDelete() {
    const count = selection.count;
    setDeleting(true);
    const result = isCategory
      ? await deleteBlogCategories(selection.ids)
      : await deleteTags(selection.ids);
    setDeleting(false);
    setConfirmOpen(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Deleted ${count} ${count === 1 ? kind : nounPlural}.`,
    );
    selection.clear();
    router.refresh();
  }

  return (
    <div>
      {/* Inline create */}
      <form
        onSubmit={handleCreate}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isCategory ? "New category name…" : "New tag name…"}
          aria-label={isCategory ? "New category name" : "New tag name"}
          className="h-10 w-64"
        />
        <Button type="submit" size="sm" disabled={creating}>
          <Plus /> {creating ? "Adding…" : "Add"}
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={isCategory ? "No categories yet" : "No tags yet"}
          description={
            isCategory
              ? "Categories group posts into sections readers can browse."
              : "Tags let readers cross-reference posts by topic."
          }
        />
      ) : (
        <div
            tabIndex={0}
            role="region"
            aria-label="Journal categories and tags"
            className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Slug
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Languages
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Posts
                </th>
              </StudioTableHead>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <StudioRow
                  key={row.id}
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selection.selected.has(row.id)}
                      onCheckedChange={() => selection.toggle(row.id)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {row.slug}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openTranslations(row)}
                    >
                      <Languages aria-hidden />
                      <span className="tabular-nums">
                        {translatedCount(row.translations)} /{" "}
                        {translatableLocales.length}
                      </span>
                      <span className="sr-only">
                        languages — translate {row.name}
                      </span>
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.postCount}
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
        unit={nounPlural}
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 /> Delete
        </Button>
      </BulkBar>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={selection.count}
        noun={kind}
        onConfirm={handleDelete}
        busy={deleting}
        extraWarning={
          isCategory
            ? "Categories that still contain posts cannot be deleted."
            : "Deleted tags are removed from all posts."
        }
      />

      {/* Per-language names. The base name stays the row's own — this only
          overrides what a reader sees in the other eight locales, and a blank
          field falls back to English exactly as everywhere else. */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCategory ? "Category" : "Tag"} name in other languages
            </DialogTitle>
            <DialogDescription>
              English is “{editing?.name}”. The web address stays{" "}
              <span className="font-mono">{editing?.slug}</span> in every
              language, so existing links keep working.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <TranslationsSection
              value={draft}
              onChange={setDraft}
              idPrefix={`taxonomy-${editing.id}`}
              fields={[
                {
                  name: "name",
                  label: "Name",
                  kind: "text",
                  base: editing.name,
                },
              ]}
            />
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={saveTranslations} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
