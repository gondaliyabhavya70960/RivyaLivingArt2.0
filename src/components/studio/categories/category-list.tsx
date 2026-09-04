"use client";

import { useMemo, useState, type FormEvent } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteCategories,
  reorderCategory,
  upsertCategory,
} from "@/actions/categories";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { FieldError } from "@/components/studio/field-error";
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
import { TranslationsSection } from "@/components/studio/translations-section";
import { useSelection } from "@/hooks/use-selection";
import { slugify } from "@/lib/slug";
import { toTranslationsRecord } from "@/lib/translations-form";
import { useDismissGuard } from "@/hooks/use-dismiss-guard";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  order: number;
  productCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  visible: boolean;
  translations: unknown;
};

/** Create/edit form. Slug is previewed on create and locked on edit. */
function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryRow | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts content on close, so keying the body by category
          resets field state on every open without any effect. */}
      <CategoryFormBody
        key={category?.id ?? "new"}
        category={category}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}

function CategoryFormBody({
  category,
  onOpenChange,
}: {
  category?: CategoryRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState(category?.description ?? "");
  const [image, setImage] = useState(category?.image ?? "");
  const [seoTitle, setSeoTitle] = useState(category?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    category?.seoDescription ?? "",
  );
  const [visible, setVisible] = useState(category?.visible ?? true);
  const [translations, setTranslations] = useState(() =>
    toTranslationsRecord(category?.translations),
  );
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(category);

  const slugPreview = category ? category.slug : slugify(name);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }
    setNameError(null);
    setBusy(true);
    const res = await upsertCategory({
      id: category?.id,
      name: name.trim(),
      description: description.trim() || undefined,
      image: image.trim() || undefined,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      visible,
      translations,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(isEdit ? "Category updated." : "Category created.");
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
    <DialogContent className="max-w-md" ref={dismissRef} {...dismissProps}>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the name, description or image. The slug never changes."
            : "Group products under a collection shoppers can browse."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ocean Trays"
            required
            autoFocus
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "category-name-error" : undefined}
          />
          <FieldError id="category-name-error">{nameError}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-slug">Slug</Label>
          <p
            id="category-slug"
            className="rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground"
          >
            /{slugPreview || "…"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Locked after creation to keep public URLs stable."
              : "Generated from the name; a number is appended if it is already taken."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-description">Description</Label>
          <Textarea
            id="category-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short blurb shown on the collection page."
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-image">Image URL</Label>
          <Input
            id="category-image"
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://…"
          />
          <p className="text-xs text-muted-foreground">
            Optional — paste a URL for now, the media picker is coming soon.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-seo-title">SEO title</Label>
          <Input
            id="category-seo-title"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder="Falls back to the category name."
          />
          <p className="text-xs text-muted-foreground">
            Optional — overrides the page title search engines and link previews
            show.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-seo-description">SEO description</Label>
          <Textarea
            id="category-seo-description"
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            placeholder="Falls back to the category description."
            rows={2}
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-input">
          <Checkbox
            checked={visible}
            onCheckedChange={(checked) => setVisible(checked === true)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Visible on the public site
            </span>
            <span className="block text-xs text-muted-foreground">
              Off takes the shelf off every public surface (shop menu, sitemap,
              search) without deleting it or its products.
            </span>
          </span>
        </label>

        <TranslationsSection
          value={translations}
          onChange={setTranslations}
          idPrefix="category"
          fields={[
            { name: "name", label: "Name", kind: "text", base: name },
            {
              name: "description",
              label: "Description",
              kind: "textarea",
              base: description,
            },
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
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create category"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Header action — owns its own create dialog instance. */
export function NewCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New category
      </Button>
      <CategoryFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function CategoryList({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (category) =>
        category.name.toLowerCase().includes(q) ||
        category.slug.toLowerCase().includes(q),
    );
  }, [categories, search]);
  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    filtered,
    PAGE_SIZE,
    search,
  );
  const rowIds = useMemo(() => pageRows.map((c) => c.id), [pageRows]);
  const selection = useSelection(rowIds);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);

  async function handleDelete() {
    const count = selection.count;
    setDeleting(true);
    const res = await deleteCategories(selection.ids);
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success(
        `Deleted ${count} ${count === 1 ? "category" : "categories"}.`,
      );
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    setReordering(true);
    const res = await reorderCategory(id, direction);
    setReordering(false);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        title="No categories yet"
        description="Create your first category to start organising products into collections."
        action={<NewCategoryButton />}
      />
    );
  }

  return (
    <>
      <div className="mb-4">
        <div className="relative w-64">
          <Search
            aria-hidden
            strokeWidth={1.5}
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories…"
            aria-label="Search categories"
            className="h-10 ps-10"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No categories found"
          description="Try a different search."
        />
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Categories"
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
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Slug
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Visible
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Products
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
              {pageRows.map((category, index) => (
                <StudioRow key={category.id}>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selection.selected.has(category.id)}
                      onCheckedChange={() => selection.toggle(category.id)}
                      aria-label={`Select ${category.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {category.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={category.visible ? "success" : "secondary"}>
                      {category.visible ? "Visible" : "Hidden"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {category.productCount}
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
                          search.trim() !== ""
                        }
                        title={
                          search.trim() !== ""
                            ? "Clear the search to reorder"
                            : undefined
                        }
                        onClick={() => handleReorder(category.id, "up")}
                        aria-label={`Move ${category.name} up`}
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
                          search.trim() !== ""
                        }
                        title={
                          search.trim() !== ""
                            ? "Clear the search to reorder"
                            : undefined
                        }
                        onClick={() => handleReorder(category.id, "down")}
                        aria-label={`Move ${category.name} down`}
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
                      onClick={() => setEditing(category)}
                      aria-label={`Edit ${category.name}`}
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
        unit="categories"
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
        noun="category"
        onConfirm={handleDelete}
        busy={deleting}
        extraWarning="Categories that still contain products cannot be deleted."
      />

      <CategoryFormDialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        category={editing}
      />
    </>
  );
}
