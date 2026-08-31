"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadMediaFiles } from "@/actions/media";
import { isOptimizableImageSrc, isRenderableSrc } from "@/lib/image-src";
import {
  deleteTestimonials,
  reorderTestimonial,
  upsertTestimonial,
} from "@/actions/testimonials";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import {
  TranslationsSection,
  type TranslationsValue,
} from "@/components/studio/translations-section";
import { toTranslationsRecord } from "@/lib/translations-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSelection } from "@/hooks/use-selection";

export type TestimonialRow = {
  id: string;
  name: string;
  location: string | null;
  quote: string;
  rating: number;
  avatarUrl: string | null;
  order: number;
  /** Raw per-locale overrides JSON from the database (`{ [locale]: {…} }`). */
  translations: unknown;
};

const RATINGS = [1, 2, 3, 4, 5] as const;

function truncate(text: string, max = 80) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Create/edit form dialog. */
function TestimonialFormDialog({
  open,
  onOpenChange,
  testimonial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonial?: TestimonialRow | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts content on close, so keying the body by testimonial
          resets field state on every open without any effect. */}
      <TestimonialFormBody
        key={testimonial?.id ?? "new"}
        testimonial={testimonial}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}

function TestimonialFormBody({
  testimonial,
  onOpenChange,
}: {
  testimonial?: TestimonialRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(testimonial?.name ?? "");
  const [location, setLocation] = useState(testimonial?.location ?? "");
  const [quote, setQuote] = useState(testimonial?.quote ?? "");
  const [rating, setRating] = useState(testimonial?.rating ?? 5);
  const [avatarUrl, setAvatarUrl] = useState(testimonial?.avatarUrl ?? "");
  const [translations, setTranslations] = useState<TranslationsValue>(() =>
    toTranslationsRecord(testimonial?.translations),
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isEdit = Boolean(testimonial);

  async function handleAvatarUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("files", file);
    formData.append("folder", "site");

    setUploading(true);
    const res = await uploadMediaFiles(formData);
    setUploading(false);
    if (avatarInputRef.current) avatarInputRef.current.value = "";

    if (res.ok) {
      const url = res.data?.[0]?.url;
      if (url) {
        setAvatarUrl(url);
        toast.success("Avatar uploaded.");
      }
    } else {
      toast.error(res.error);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !quote.trim()) {
      toast.error("Name and quote are required.");
      return;
    }
    setBusy(true);
    const res = await upsertTestimonial({
      id: testimonial?.id,
      name: name.trim(),
      location: location.trim() || undefined,
      quote: quote.trim(),
      rating,
      avatarUrl: avatarUrl.trim() || undefined,
      translations,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(isEdit ? "Testimonial updated." : "Testimonial created.");
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
        <DialogTitle>
          {isEdit ? "Edit testimonial" : "New testimonial"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the customer's words, rating or avatar."
            : "Add a customer quote to feature on the storefront."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="testimonial-name">Name</Label>
          <Input
            id="testimonial-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Priya Sharma"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="testimonial-location">Location</Label>
          <Input
            id="testimonial-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Mumbai"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="testimonial-quote">Quote</Label>
          <Textarea
            id="testimonial-quote"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="The resin tray turned out even more beautiful than I imagined…"
            rows={4}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="testimonial-rating">Rating</Label>
          <Select
            value={String(rating)}
            onValueChange={(value) => setRating(Number(value))}
          >
            <SelectTrigger id="testimonial-rating" className="w-full">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              {RATINGS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  <span className="text-sapphire-ink">{"★".repeat(value)}</span>
                  <span className="text-muted-foreground">({value})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="testimonial-avatar">Photograph</Label>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAvatarUpload(e.target.files)}
          />
          <div className="flex gap-2">
            <Input
              id="testimonial-avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={uploading || busy}
              onClick={() => avatarInputRef.current?.click()}
            >
              <Upload /> {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Optional — the customer, or the piece they commissioned. It leads
            the card at 4:5 wherever their words appear. Left empty, the card
            is the quote alone; it is never given a stand-in face.
          </p>
          {/* The field took a URL long before anything rendered it, so a typo
              was invisible until someone opened the storefront. */}
          {isRenderableSrc(avatarUrl.trim()) ? (
            <div className="relative mt-2 aspect-[4/5] w-24 overflow-hidden rounded-card border border-border bg-muted">
              <Image
                src={avatarUrl.trim()}
                alt=""
                fill
                sizes="96px"
                unoptimized={!isOptimizableImageSrc(avatarUrl.trim())}
                className="object-cover"
              />
            </div>
          ) : null}
        </div>

        {/* The customer's name is never translated — only their words and place. */}
        <TranslationsSection
          value={translations}
          onChange={setTranslations}
          idPrefix="testimonial"
          fields={[
            { name: "quote", label: "Quote", kind: "textarea", base: quote },
            {
              name: "location",
              label: "Location",
              kind: "text",
              base: location,
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
          <Button type="submit" size="sm" disabled={busy || uploading}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create testimonial"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Header action — owns its own create dialog instance. */
export function NewTestimonialButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New testimonial
      </Button>
      <TestimonialFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function TestimonialList({
  testimonials,
}: {
  testimonials: TestimonialRow[];
}) {
  const router = useRouter();
  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    testimonials,
    PAGE_SIZE,
  );
  const rowIds = useMemo(() => pageRows.map((t) => t.id), [pageRows]);
  const selection = useSelection(rowIds);
  const [editing, setEditing] = useState<TestimonialRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);

  async function handleDelete() {
    const count = selection.count;
    setDeleting(true);
    const res = await deleteTestimonials(selection.ids);
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success(
        `Deleted ${count} ${count === 1 ? "testimonial" : "testimonials"}.`,
      );
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    setReordering(true);
    const res = await reorderTestimonial(id, direction);
    setReordering(false);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }

  if (testimonials.length === 0) {
    return (
      <EmptyState
        title="No testimonials yet"
        description="Add your first customer quote to build trust on the storefront."
        action={<NewTestimonialButton />}
      />
    );
  }

  return (
    <>
      <div
            tabIndex={0}
            role="region"
            aria-label="Testimonials"
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
                Location
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Quote
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Rating
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
            {pageRows.map((testimonial, index) => {
              // Reorder is global (see reorderTestimonial), so the up/down edge
              // checks use the row's position in the full list, not the page.
              const globalIndex = (page - 1) * pageSize + index;
              return (
                <StudioRow
                  key={testimonial.id}
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selection.selected.has(testimonial.id)}
                      onCheckedChange={() => selection.toggle(testimonial.id)}
                      aria-label={`Select ${testimonial.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {testimonial.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {testimonial.location ?? "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted-foreground">
                    {truncate(testimonial.quote)}
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap text-sapphire-ink"
                    aria-label={`${testimonial.rating} out of 5 stars`}
                  >
                    {"★".repeat(testimonial.rating)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={globalIndex === 0 || reordering}
                        onClick={() => handleReorder(testimonial.id, "up")}
                        aria-label={`Move ${testimonial.name} up`}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={globalIndex === total - 1 || reordering}
                        onClick={() => handleReorder(testimonial.id, "down")}
                        aria-label={`Move ${testimonial.name} down`}
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
                      onClick={() => setEditing(testimonial)}
                      aria-label={`Edit ${testimonial.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </td>
                </StudioRow>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        unit="testimonials"
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
        noun="testimonial"
        onConfirm={handleDelete}
        busy={deleting}
      />

      <TestimonialFormDialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        testimonial={editing}
      />
    </>
  );
}
