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
import { FieldError } from "@/components/studio/field-error";
import { FieldHint, describedBy } from "@/components/studio/field-hint";
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

type FieldKey =
  | "source"
  | "url"
  | "title"
  | "category"
  | "materials"
  | "dimensions"
  | "price"
  | "description"
  | "images"
  | "tags"
  | "notes";

/** Top-to-bottom, as laid out — the order a refused submit walks to find the first error. */
const FIELD_ORDER: FieldKey[] = [
  "source",
  "url",
  "title",
  "category",
  "materials",
  "dimensions",
  "price",
  "description",
  "images",
  "tags",
  "notes",
];

const FIELD_ID: Record<FieldKey, string> = {
  source: "research-source",
  url: "research-url",
  title: "research-title",
  category: "research-category",
  materials: "research-materials",
  dimensions: "research-dimensions",
  price: "research-price",
  description: "research-description",
  images: "research-images",
  tags: "research-tags",
  notes: "research-notes",
};

/**
 * The limits `upsertSchema` in `src/actions/research.ts` enforces, mirrored
 * here so they can be named under the field. They have to be: `runAction`
 * flattens every zod refusal to "Something went wrong. Please try again.",
 * so a 5,000-character description used to fail with no field named.
 */
const LIMITS = {
  source: 200,
  url: 2048,
  title: 300,
  category: 200,
  materials: 300,
  dimensions: 200,
  price: 100,
  description: 4000,
  notes: 4000,
} as const;

const tooLong = (what: string, max: number) =>
  `Keep ${what} under ${max.toLocaleString("en-IN")} characters.`;

type Problems = Partial<Record<FieldKey, string>>;

function describeProblems(v: {
  source: string;
  url: string;
  title: string;
  category: string;
  materials: string;
  dimensions: string;
  price: string;
  description: string;
  images: string;
  tags: string;
  notes: string;
}): Problems {
  const p: Problems = {};
  const source = v.source.trim();
  if (!source) p.source = "Source is required.";
  else if (source.length > LIMITS.source)
    p.source = tooLong("the source", LIMITS.source);

  const url = v.url.trim();
  if (url.length > LIMITS.url) p.url = tooLong("the link", LIMITS.url);
  // The input is type="url", which the browser would refuse on its own with
  // a tooltip we cannot style or announce; this says the same thing in the
  // house voice. http(s) only, because that is what a research link is.
  else if (url && !/^https?:\/\/\S+$/i.test(url))
    p.url = "Paste a full address starting with https://";

  const title = v.title.trim();
  if (!title) p.title = "Title is required.";
  else if (title.length > LIMITS.title)
    p.title = tooLong("the title", LIMITS.title);

  if (v.category.trim().length > LIMITS.category)
    p.category = tooLong("the category", LIMITS.category);
  if (v.materials.trim().length > LIMITS.materials)
    p.materials = tooLong("materials", LIMITS.materials);
  if (v.dimensions.trim().length > LIMITS.dimensions)
    p.dimensions = tooLong("dimensions", LIMITS.dimensions);
  if (v.price.trim().length > LIMITS.price)
    p.price = tooLong("the price", LIMITS.price);
  if (v.description.trim().length > LIMITS.description)
    p.description = tooLong("the description", LIMITS.description);
  if (v.notes.trim().length > LIMITS.notes)
    p.notes = tooLong("notes", LIMITS.notes);

  if (splitLines(v.images).length > 20)
    p.images = "Up to 20 image links — one per line.";

  const tags = splitTags(v.tags);
  if (tags.length > 20) p.tags = "Up to 20 tags.";
  else if (tags.some((t) => t.length > 60))
    p.tags = "Keep each tag under 60 characters.";

  return p;
}

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
  const [errors, setErrors] = useState<Problems>({});
  const isEdit = Boolean(record);

  /** An edit clears that field's error; the next submit re-judges everything. */
  function clear(key: FieldKey) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  /** `aria-invalid` and the hint/error wiring for one control. */
  function a11y(key: FieldKey, hasHint = false) {
    const id = FIELD_ID[key];
    return {
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(
        hasHint && `${id}-hint`,
        errors[key] && `${id}-error`,
      ),
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const problems = describeProblems({
      source,
      url,
      title,
      category,
      materials,
      dimensions,
      price,
      description,
      images: imagesText,
      tags: tagsText,
      notes,
    });
    setErrors(problems);
    const first = FIELD_ORDER.find((key) => problems[key]);
    if (first) {
      document.getElementById(FIELD_ID[first])?.focus();
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="research-source">Source</Label>
            <Input
              id="research-source"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                clear("source");
              }}
              placeholder="e.g. a maker's Instagram, a competitor's shop"
              required
              autoFocus
              {...a11y("source")}
            />
            <FieldError id="research-source-error">{errors.source}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="research-url">Link</Label>
            <Input
              id="research-url"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                clear("url");
              }}
              placeholder="https://…"
              {...a11y("url", true)}
            />
            <FieldError id="research-url-error">{errors.url}</FieldError>
            <FieldHint id="research-url-hint">
              The address as it appears in the browser, https:// included.
            </FieldHint>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="research-title">Title</Label>
          <Input
            id="research-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clear("title");
            }}
            placeholder="What the piece is"
            required
            {...a11y("title")}
          />
          <FieldError id="research-title-error">{errors.title}</FieldError>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="research-category">Category</Label>
            <Input
              id="research-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                clear("category");
              }}
              {...a11y("category")}
            />
            <FieldError id="research-category-error">
              {errors.category}
            </FieldError>
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
              onChange={(e) => {
                setMaterials(e.target.value);
                clear("materials");
              }}
              {...a11y("materials")}
            />
            <FieldError id="research-materials-error">
              {errors.materials}
            </FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="research-dimensions">Dimensions</Label>
            <Input
              id="research-dimensions"
              value={dimensions}
              onChange={(e) => {
                setDimensions(e.target.value);
                clear("dimensions");
              }}
              {...a11y("dimensions")}
            />
            <FieldError id="research-dimensions-error">
              {errors.dimensions}
            </FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="research-price">Price</Label>
            <Input
              id="research-price"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                clear("price");
              }}
              placeholder="what THEY charge, if noted"
              {...a11y("price")}
            />
            <FieldError id="research-price-error">{errors.price}</FieldError>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="research-description">Description</Label>
          <Textarea
            id="research-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clear("description");
            }}
            rows={3}
            {...a11y("description")}
          />
          <FieldError id="research-description-error">
            {errors.description}
          </FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="research-images">
            Reference images (one URL per line)
          </Label>
          <Textarea
            id="research-images"
            value={imagesText}
            onChange={(e) => {
              setImagesText(e.target.value);
              clear("images");
            }}
            rows={3}
            placeholder="https://…"
            {...a11y("images", true)}
          />
          <FieldError id="research-images-error">{errors.images}</FieldError>
          <FieldHint id="research-images-hint">One per line, up to 20.</FieldHint>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="research-tags">Tags (comma-separated)</Label>
            <Input
              id="research-tags"
              value={tagsText}
              onChange={(e) => {
                setTagsText(e.target.value);
                clear("tags");
              }}
              placeholder="varmala, gift-set"
              {...a11y("tags", true)}
            />
            <FieldError id="research-tags-error">{errors.tags}</FieldError>
            <FieldHint id="research-tags-hint">
              Comma-separated, up to 20, each under 60 characters.
            </FieldHint>
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
            onChange={(e) => {
              setNotes(e.target.value);
              clear("notes");
            }}
            rows={3}
            placeholder="Why this is worth a look…"
            {...a11y("notes")}
          />
          <FieldError id="research-notes-error">{errors.notes}</FieldError>
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
