"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  RESEARCH_STATUSES,
  upsertResearchRecord,
  type ResearchStatus,
} from "@/actions/research";
import { Button } from "@/components/ui/button";
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
import { useDismissGuard } from "@/hooks/use-dismiss-guard";

export type ResearchRow = {
  id: string;
  source: string;
  url: string | null;
  title: string;
  category: string | null;
  materials: string | null;
  dimensions: string | null;
  price: string | null;
  images: string[];
  description: string | null;
  tags: string[];
  notes: string | null;
  /** yyyy-mm-dd for the date input, or "" when unset. */
  extractedAtInput: string;
  status: ResearchStatus;
  isDemo: boolean;
};

const STATUS_LABELS: Record<ResearchStatus, string> = {
  RESEARCH: "Research",
  SHORTLISTED: "Shortlisted",
  DISCARDED: "Discarded",
};

const splitLines = (raw: string) =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const splitTags = (raw: string) =>
  raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** Create/edit form dialog. */
export function ResearchFormDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: ResearchRow | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts content on close, so keying the body by record
          resets field state on every open without any effect. */}
      <ResearchFormBody
        key={record?.id ?? "new"}
        record={record}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}

function ResearchFormBody({
  record,
  onOpenChange,
}: {
  record?: ResearchRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [source, setSource] = useState(record?.source ?? "");
  const [url, setUrl] = useState(record?.url ?? "");
  const [title, setTitle] = useState(record?.title ?? "");
  const [category, setCategory] = useState(record?.category ?? "");
  const [materials, setMaterials] = useState(record?.materials ?? "");
  const [dimensions, setDimensions] = useState(record?.dimensions ?? "");
  const [price, setPrice] = useState(record?.price ?? "");
  const [imagesText, setImagesText] = useState(
    (record?.images ?? []).join("\n"),
  );
  const [description, setDescription] = useState(record?.description ?? "");
  const [tagsText, setTagsText] = useState((record?.tags ?? []).join(", "));
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [extractedAt, setExtractedAt] = useState(
    record?.extractedAtInput ?? "",
  );
  const [status, setStatus] = useState<ResearchStatus>(
    record?.status ?? "RESEARCH",
  );
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(record);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!source.trim() || !title.trim()) {
      toast.error("Source and title are required.");
      return;
    }
    setBusy(true);
    const res = await upsertResearchRecord({
      id: record?.id,
      source: source.trim(),
      url: url.trim() || null,
      title: title.trim(),
      category: category.trim() || null,
      materials: materials.trim() || null,
      dimensions: dimensions.trim() || null,
      price: price.trim() || null,
      images: splitLines(imagesText),
      description: description.trim() || null,
      tags: splitTags(tagsText),
      notes: notes.trim() || null,
      extractedAt: extractedAt || null,
      status,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(
        isEdit ? "Research record updated." : "Research record added.",
      );
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  // Blocks Escape and outside-clicks while the dialog holds unsaved input,
  // and unconditionally while a save is in flight.
  const [dismissRef, dismissProps] = useDismissGuard(busy);

  return (
    <DialogContent
      className="max-h-[85vh] max-w-lg overflow-y-auto"
      ref={dismissRef}
      {...dismissProps}
    >
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit research record" : "New research record"}
        </DialogTitle>
        <DialogDescription>
          A hand-kept reference from another site — never a product, never
          imported into the catalogue.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="research-source">Source</Label>
            <Input
              id="research-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. a maker's Instagram, a competitor's shop"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="research-url">Link</Label>
            <Input
              id="research-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="research-title">Title</Label>
          <Input
            id="research-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What the piece is"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="research-category">Category</Label>
            <Input
              id="research-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="research-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ResearchStatus)}
            >
              <SelectTrigger id="research-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESEARCH_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="research-materials">Materials</Label>
            <Input
              id="research-materials"
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="research-dimensions">Dimensions</Label>
            <Input
              id="research-dimensions"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="research-price">Price</Label>
            <Input
              id="research-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="what THEY charge, if noted"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="research-description">Description</Label>
          <Textarea
            id="research-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="research-images">
            Reference images (one URL per line)
          </Label>
          <Textarea
            id="research-images"
            value={imagesText}
            onChange={(e) => setImagesText(e.target.value)}
            rows={3}
            placeholder="https://…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="research-tags">Tags (comma-separated)</Label>
            <Input
              id="research-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="varmala, gift-set"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="research-extracted-at">Found on</Label>
            <Input
              id="research-extracted-at"
              type="date"
              value={extractedAt}
              onChange={(e) => setExtractedAt(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="research-notes">Notes</Label>
          <Textarea
            id="research-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Why this is worth a look…"
          />
        </div>

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
            {busy ? "Saving…" : isEdit ? "Save changes" : "Add record"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Header action — owns its own create dialog instance. */
export function NewResearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New record
      </Button>
      <ResearchFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
