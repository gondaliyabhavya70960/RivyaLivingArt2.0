"use client";

import { useRef, useState } from "react";
import { isOptimizableImageSrc } from "@/lib/image-src";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Languages,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { ContentStatus } from "@/generated/prisma/enums";
import {
  deletePortfolios,
  upsertPortfolio,
  type UpsertPortfolioInput,
} from "@/actions/portfolio";
import { uploadMediaFiles } from "@/actions/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { DraftPreview } from "@/components/studio/draft-preview";
import { FieldError } from "@/components/studio/field-error";
import { FormSection } from "@/components/studio/form-section";
import { LocalDraftBar } from "@/components/studio/local-draft-bar";
import { MediaPicker } from "@/components/studio/media/media-picker";
import { TranslationsSection } from "@/components/studio/translations-section";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { translatableLocales } from "@/lib/localize";
import { toTranslationsRecord } from "@/lib/translations-form";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { CONTENT_STATUSES } from "@/lib/content-status";

// ————————————————————— Types & schema —————————————————————

export type PortfolioFormInitial = {
  id: string;
  slug: string;
  title: string;
  story: string;
  brief: string;
  process: string;
  clientNote: string;
  location: string;
  year: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  videoUrl: string;
  resultsMeta: {
    type: string;
    material: string;
    size: string;
    timeline: string;
    technique: string;
    complexity: string;
    /** Comma-separated in the form; stored as string[] in resultsMeta. */
    tags: string;
  };
  categoryId: string | null;
  status: ContentStatus;
  translations: unknown;
  images: {
    url: string;
    alt: string;
    caption: string | null;
    translations: unknown;
    order: number;
  }[];
};

/** Radix Select items cannot have an empty value — sentinel for "none". */
const NO_CATEGORY = "NONE";

const optionalUrl = z.union([z.literal(""), z.url("Enter a valid URL.")]);

const formSchema = z.object({
  title: z.string().trim().min(2, "Title needs at least 2 characters."),
  story: z.string(),
  brief: z.string(),
  process: z.string(),
  clientNote: z.string(),
  location: z.string().max(120, "Keep the location under 120 characters."),
  year: z
    .string()
    .refine((v) => v === "" || /^\d{4}$/.test(v), "Enter a 4-digit year."),
  categoryId: z.string(),
  status: z.enum(CONTENT_STATUSES),
  beforeImageUrl: optionalUrl,
  afterImageUrl: optionalUrl,
  videoUrl: optionalUrl,
  metaType: z.string(),
  metaMaterial: z.string(),
  metaSize: z.string(),
  metaTimeline: z.string(),
  metaTechnique: z.string(),
  metaComplexity: z.string(),
  metaTags: z.string(),
  images: z.array(
    z.object({
      url: z.string().min(1),
      alt: z.string(),
      caption: z.string(),
      translations: z.record(z.string(), z.record(z.string(), z.unknown())),
    }),
  ),
  translations: z.record(z.string(), z.record(z.string(), z.unknown())),
});

type FormValues = z.infer<typeof formSchema>;

/** Which tab a field belongs to (product-form.tsx pattern). */
const TABS = [
  {
    value: "story",
    label: "Story",
    fields: [
      "title",
      "story",
      "brief",
      "process",
      "clientNote",
      "location",
      "year",
    ],
  },
  {
    value: "media",
    label: "Media",
    fields: ["beforeImageUrl", "afterImageUrl", "videoUrl", "images"],
  },
  {
    value: "results",
    label: "Results",
    fields: [
      "metaType",
      "metaMaterial",
      "metaSize",
      "metaTimeline",
      "metaTechnique",
      "metaComplexity",
      "metaTags",
    ],
  },
  { value: "taxonomy", label: "Taxonomy", fields: ["categoryId", "status"] },
] as const;

function tabForField(field: string): string | undefined {
  const root = field.split(".")[0];
  return TABS.find((tab) => (tab.fields as readonly string[]).includes(root))
    ?.value;
}

// ————————————————————— Small helpers —————————————————————

/** next/image throws on unparseable src — only preview absolute URLs. */
const isPreviewable = (url: string) => /^https?:\/\/.+/.test(url);

// ————————————————————— The form —————————————————————

export function PortfolioForm({
  categories,
  portfolio,
}: {
  categories: { id: string; name: string }[];
  portfolio?: PortfolioFormInitial;
}) {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tab, setTab] = useState<string>(TABS[0].value);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: portfolio?.title ?? "",
      story: portfolio?.story ?? "",
      brief: portfolio?.brief ?? "",
      process: portfolio?.process ?? "",
      clientNote: portfolio?.clientNote ?? "",
      location: portfolio?.location ?? "",
      year: portfolio?.year ?? "",
      categoryId: portfolio?.categoryId ?? NO_CATEGORY,
      status: portfolio?.status ?? "DRAFT",
      beforeImageUrl: portfolio?.beforeImageUrl ?? "",
      afterImageUrl: portfolio?.afterImageUrl ?? "",
      videoUrl: portfolio?.videoUrl ?? "",
      metaType: portfolio?.resultsMeta.type ?? "",
      metaMaterial: portfolio?.resultsMeta.material ?? "",
      metaSize: portfolio?.resultsMeta.size ?? "",
      metaTimeline: portfolio?.resultsMeta.timeline ?? "",
      metaTechnique: portfolio?.resultsMeta.technique ?? "",
      metaComplexity: portfolio?.resultsMeta.complexity ?? "",
      metaTags: portfolio?.resultsMeta.tags ?? "",
      images:
        portfolio?.images.map((img) => ({
          url: img.url,
          alt: img.alt,
          caption: img.caption ?? "",
          translations: toTranslationsRecord(img.translations),
        })) ?? [],
      translations: toTranslationsRecord(portfolio?.translations),
    },
  });

  useUnsavedChangesGuard(isDirty && !saving);
  const dirty = isDirty && !saving;

  const draft = useLocalDraft<FormValues>({
    key: "portfolio",
    id: portfolio?.id,
    watch,
    reset,
    enabled: !saving,
  });

  const errored = new Set(
    Object.keys(errors)
      .map(tabForField)
      .filter((value): value is string => Boolean(value)),
  );

  function onInvalid(fieldErrors: Record<string, unknown>) {
    const first = Object.keys(fieldErrors)[0];
    const target = first ? tabForField(first) : undefined;
    if (target) setTab(target);
  }

  const imagesArray = useFieldArray({ control, name: "images" });

  const watchedImages = useWatch({ control, name: "images" });
  // Which gallery frame's per-language captions are open, by index.
  const [captionLocaleIndex, setCaptionLocaleIndex] = useState<number | null>(
    null,
  );
  const beforeImageUrl = useWatch({ control, name: "beforeImageUrl" });
  const afterImageUrl = useWatch({ control, name: "afterImageUrl" });
  const [
    titleBase,
    storyBase,
    briefBase,
    processBase,
    clientNoteBase,
    locationBase,
  ] = useWatch({
    control,
    name: ["title", "story", "brief", "process", "clientNote", "location"],
  });

  /** Shared upload path — everything lands in the "portfolio" folder. */
  async function uploadToPortfolio(files: File[]) {
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    formData.append("folder", "portfolio");

    setUploading(true);
    const result = await uploadMediaFiles(formData);
    setUploading(false);

    if (!result.ok) {
      toast.error(result.error);
      return [];
    }
    return result.data ?? [];
  }

  async function handleGalleryUpload(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    const uploaded = await uploadToPortfolio(list);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (uploaded.length === 0) return;

    for (const media of uploaded) {
      imagesArray.append({
        url: media.url,
        alt: "",
        caption: "",
        translations: {},
      });
    }
    toast.success(
      `Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}.`,
    );
  }

  async function handleSingleUpload(
    field: "beforeImageUrl" | "afterImageUrl",
    files: FileList | null,
  ) {
    const list = Array.from(files ?? []).slice(0, 1);
    if (list.length === 0) return;

    const uploaded = await uploadToPortfolio(list);
    const ref = field === "beforeImageUrl" ? beforeInputRef : afterInputRef;
    if (ref.current) ref.current.value = "";
    if (uploaded.length === 0) return;

    setValue(field, uploaded[0].url, { shouldDirty: true });
    toast.success(
      field === "beforeImageUrl"
        ? "Before image uploaded."
        : "After image uploaded.",
    );
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);

    const payload: UpsertPortfolioInput = {
      id: portfolio?.id,
      title: values.title,
      story: values.story,
      brief: values.brief,
      process: values.process,
      clientNote: values.clientNote,
      location: values.location,
      year: values.year,
      beforeImageUrl: values.beforeImageUrl,
      afterImageUrl: values.afterImageUrl,
      videoUrl: values.videoUrl,
      resultsMeta: {
        type: values.metaType || undefined,
        material: values.metaMaterial || undefined,
        size: values.metaSize || undefined,
        timeline: values.metaTimeline || undefined,
        technique: values.metaTechnique || undefined,
        complexity: values.metaComplexity || undefined,
        tags: values.metaTags
          ? values.metaTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      },
      categoryId: values.categoryId === NO_CATEGORY ? null : values.categoryId,
      status: values.status,
      images: values.images.map((img, index) => ({
        url: img.url,
        alt: img.alt,
        caption: img.caption,
        translations: img.translations,
        order: index,
      })),
      translations: values.translations,
    };

    const result = await upsertPortfolio(payload);

    if (!result.ok) {
      setSaving(false);
      toast.error(result.error);
      return;
    }
    // The save is the new baseline — see product-form.tsx for why, and why
    // it happens before autosave is re-enabled.
    reset(values);
    draft.discard();
    setSaving(false);
    toast.success(
      portfolio ? "Portfolio piece saved." : "Portfolio piece created.",
    );
    if (!portfolio && result.data) {
      router.push(`/studio/portfolio/${result.data.id}`);
    } else {
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!portfolio) return;
    setDeleting(true);
    const result = await deletePortfolios([portfolio.id]);
    setDeleting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDeleteOpen(false);
    // The row is gone; its draft would only ever be an orphan in storage.
    draft.discard();
    toast.success("Portfolio piece deleted.");
    router.push("/studio/portfolio");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      <LocalDraftBar
        savedAt={draft.savedAt}
        onRestore={draft.restore}
        onDiscard={draft.discard}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Portfolio sections">
          {TABS.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value}>
              {entry.label}
              {errored.has(entry.value) && (
                <>
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-destructive"
                  />
                  <span className="sr-only"> (has an error)</span>
                </>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent forceMount value="story" className="space-y-6">
          <FormSection title="Essentials">
            <div className="space-y-1.5">
              <Label htmlFor="portfolio-title">Title</Label>
              <Input
                id="portfolio-title"
                aria-invalid={!!errors.title}
                aria-describedby={
                  errors.title ? "portfolio-title-error" : undefined
                }
                {...register("title")}
              />
              <FieldError id="portfolio-title-error">
                {errors.title?.message}
              </FieldError>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="portfolio-story">Story</Label>
              <Textarea
                id="portfolio-story"
                rows={10}
                placeholder="The brief, the process, the reveal — tell the piece's journey."
                {...register("story")}
              />
            </div>
          </FormSection>

          {/* Case study (audit CS-01) — optional narrative; each filled
              field becomes its own section on the public piece page. */}
          <FormSection title="Case study">
            <div className="space-y-1.5">
              <Label htmlFor="portfolio-brief">The brief</Label>
              <Textarea
                id="portfolio-brief"
                rows={3}
                placeholder="What the client asked for — shown as its own section when filled"
                {...register("brief")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="portfolio-process">The process</Label>
              <Textarea
                id="portfolio-process"
                rows={4}
                placeholder="How the piece was made — stages, decisions, time"
                {...register("process")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="portfolio-client-note">Client&apos;s words</Label>
              <Textarea
                id="portfolio-client-note"
                rows={3}
                placeholder="Their reaction, verbatim — real words only, never invented"
                {...register("clientNote")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-location">Location</Label>
                <Input
                  id="portfolio-location"
                  placeholder="Surat"
                  aria-invalid={!!errors.location}
                  aria-describedby={
                    errors.location ? "portfolio-location-error" : undefined
                  }
                  {...register("location")}
                />
                <FieldError id="portfolio-location-error">
                  {errors.location?.message}
                </FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-year">Year</Label>
                <Input
                  id="portfolio-year"
                  inputMode="numeric"
                  placeholder="2026"
                  aria-invalid={!!errors.year}
                  aria-describedby={
                    errors.year ? "portfolio-year-error" : undefined
                  }
                  {...register("year")}
                />
                <FieldError id="portfolio-year-error">
                  {errors.year?.message}
                </FieldError>
              </div>
            </div>
          </FormSection>

          <Controller
            control={control}
            name="translations"
            render={({ field }) => (
              <TranslationsSection
                value={field.value}
                onChange={field.onChange}
                idPrefix="portfolio"
                fields={[
                  {
                    name: "title",
                    label: "Title",
                    kind: "text",
                    base: titleBase,
                  },
                  {
                    name: "story",
                    label: "Story",
                    kind: "textarea",
                    base: storyBase,
                  },
                  {
                    name: "brief",
                    label: "The brief",
                    kind: "textarea",
                    base: briefBase,
                  },
                  {
                    name: "process",
                    label: "The process",
                    kind: "textarea",
                    base: processBase,
                  },
                  {
                    name: "clientNote",
                    label: "Client's words",
                    kind: "textarea",
                    base: clientNoteBase,
                  },
                  {
                    name: "location",
                    label: "Location",
                    kind: "text",
                    base: locationBase,
                  },
                ]}
              />
            )}
          />
        </TabsContent>

        <TabsContent forceMount value="media" className="space-y-6">
          <FormSection
            title="Before & after"
            description="The transformation pair shown at the top of the case study."
          >
            <input
              ref={beforeInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                handleSingleUpload("beforeImageUrl", e.target.files)
              }
            />
            <input
              ref={afterInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                handleSingleUpload("afterImageUrl", e.target.files)
              }
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-before">Before image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="portfolio-before"
                    placeholder="https://…"
                    aria-invalid={!!errors.beforeImageUrl}
                    aria-describedby={
                      errors.beforeImageUrl
                        ? "portfolio-before-error"
                        : undefined
                    }
                    {...register("beforeImageUrl")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={uploading}
                    onClick={() => beforeInputRef.current?.click()}
                  >
                    <Upload /> Upload
                  </Button>
                </div>
                <FieldError id="portfolio-before-error">
                  {errors.beforeImageUrl?.message}
                </FieldError>
                {isPreviewable(beforeImageUrl) && (
                  <Image
                    src={beforeImageUrl}
                    unoptimized={!isOptimizableImageSrc(beforeImageUrl)}
                    alt="Before preview"
                    width={320}
                    height={180}
                    className="aspect-video w-full rounded-lg border border-border object-cover"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="portfolio-after">After image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="portfolio-after"
                    placeholder="https://…"
                    aria-invalid={!!errors.afterImageUrl}
                    aria-describedby={
                      errors.afterImageUrl ? "portfolio-after-error" : undefined
                    }
                    {...register("afterImageUrl")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={uploading}
                    onClick={() => afterInputRef.current?.click()}
                  >
                    <Upload /> Upload
                  </Button>
                </div>
                <FieldError id="portfolio-after-error">
                  {errors.afterImageUrl?.message}
                </FieldError>
                {isPreviewable(afterImageUrl) && (
                  <Image
                    src={afterImageUrl}
                    unoptimized={!isOptimizableImageSrc(afterImageUrl)}
                    alt="After preview"
                    width={320}
                    height={180}
                    className="aspect-video w-full rounded-lg border border-border object-cover"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="portfolio-video">Video URL</Label>
              {/* A film from the media library, or a pasted address — the
                  pair the testimonial form and the film blocks carry. */}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="portfolio-video"
                  className="min-w-56 flex-1"
                  placeholder="Choose from the library, or paste a full https:// address"
                  aria-invalid={!!errors.videoUrl}
                  aria-describedby={
                    errors.videoUrl ? "portfolio-video-error" : undefined
                  }
                  {...register("videoUrl")}
                />
                <MediaPicker
                  accept="VIDEO"
                  defaultFolder="portfolio"
                  onSelect={(item) =>
                    setValue("videoUrl", item.url, { shouldDirty: true })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A short making-of or reveal clip, shown with the case study.
              </p>
              <FieldError id="portfolio-video-error">
                {errors.videoUrl?.message}
              </FieldError>
            </div>
          </FormSection>

          <FormSection
            title="Gallery"
            description="The first image is the cover on the portfolio grid. Reorder with the arrows."
          >
            <div>
              <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleGalleryUpload(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImagePlus /> {uploading ? "Uploading…" : "Upload images"}
              </Button>
              <MediaPicker
                defaultFolder="portfolio"
                onSelect={(item) =>
                  imagesArray.append({
                    url: item.url,
                    alt: "",
                    caption: "",
                    translations: {},
                  })
                }
              />
            </div>

            {imagesArray.fields.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {imagesArray.fields.map((item, index) => (
                  <div
                    key={item.id}
                    className="space-y-2 rounded-card border border-border p-3"
                  >
                    <Image
                      src={watchedImages[index]?.url ?? item.url}
                      unoptimized={
                        !isOptimizableImageSrc(
                          watchedImages[index]?.url ?? item.url,
                        )
                      }
                      alt={watchedImages[index]?.alt ?? ""}
                      width={320}
                      height={320}
                      className="aspect-square w-full rounded-lg border border-border object-cover"
                    />
                    <Input
                      aria-label={`Alt text for image ${index + 1}`}
                      placeholder="Alt text"
                      {...register(`images.${index}.alt`)}
                    />
                    {/* Alt describes the picture for someone who cannot see
                        it; the caption tells every reader something the
                        picture does not. Both, or either, or neither. */}
                    <Input
                      aria-label={`Caption for image ${index + 1}`}
                      placeholder="Caption (printed beside the plate number)"
                      {...register(`images.${index}.caption`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setCaptionLocaleIndex(index)}
                    >
                      <Languages aria-hidden className="size-4" />
                      <span className="tabular-nums">
                        {
                          translatableLocales.filter((locale) => {
                            const value =
                              watchedImages?.[index]?.translations?.[locale]
                                ?.caption;
                            return (
                              typeof value === "string" && value.trim() !== ""
                            );
                          }).length
                        }{" "}
                        / {translatableLocales.length}
                      </span>
                      <span className="sr-only">
                        languages — translate the caption for image {index + 1}
                      </span>
                    </Button>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Move image up"
                          disabled={index === 0}
                          onClick={() => imagesArray.move(index, index - 1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Move image down"
                          disabled={index === imagesArray.fields.length - 1}
                          onClick={() => imagesArray.move(index, index + 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove image"
                        onClick={() => imagesArray.remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </TabsContent>

        <TabsContent forceMount value="results" className="space-y-6">
          <FormSection
            title="Results"
            description="ADM-style case study meta — shown as a facts strip on the public page."
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-meta-type">Type</Label>
                <Input
                  id="portfolio-meta-type"
                  placeholder="e.g. Wedding preservation"
                  {...register("metaType")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-meta-material">Material</Label>
                <Input
                  id="portfolio-meta-material"
                  placeholder="e.g. Epoxy resin, bridal florals"
                  {...register("metaMaterial")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-meta-size">Size</Label>
                <Input
                  id="portfolio-meta-size"
                  placeholder='e.g. 12" × 16" block'
                  {...register("metaSize")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-meta-timeline">Timeline</Label>
                <Input
                  id="portfolio-meta-timeline"
                  placeholder="e.g. 6 weeks"
                  {...register("metaTimeline")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-meta-technique">Technique</Label>
                <Input
                  id="portfolio-meta-technique"
                  placeholder="e.g. Botanical preservation casting"
                  {...register("metaTechnique")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portfolio-meta-complexity">Complexity</Label>
                <Input
                  id="portfolio-meta-complexity"
                  placeholder="e.g. Signature / High / Moderate"
                  {...register("metaComplexity")}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="portfolio-meta-tags">Tags</Label>
                <Input
                  id="portfolio-meta-tags"
                  placeholder="comma separated — e.g. varmala, wedding, preservation"
                  {...register("metaTags")}
                />
              </div>
            </div>
          </FormSection>
        </TabsContent>

        <TabsContent forceMount value="taxonomy" className="space-y-6">
          <FormSection title="Classification">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full" aria-label="Category">
                        <SelectValue placeholder="No category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full" aria-label="Status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="REVIEW">Review</SelectItem>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </FormSection>
        </TabsContent>
      </Tabs>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-4 shadow-e2">
        <div className="flex flex-wrap items-center gap-3">
          {portfolio && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleting || saving}
              onClick={() => setDeleteOpen(true)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 /> Delete
            </Button>
          )}
          {/* The same always-mounted live region the product and journal
              footers carry (§12.5) — the third form on this footer pattern
              had no indicator at all. */}
          <span
            role="status"
            className="u-micro inline-flex items-center gap-2 text-graphite"
          >
            {dirty && (
              <>
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-warning"
                />
                Unsaved changes
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {portfolio && <DraftPreview path={`/portfolio/${portfolio.slug}`} />}
          <Button type="submit" disabled={saving || uploading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Per-language captions for one frame. Bound through the same form
          values as everything else, so they are saved by the same Save and
          survive the gallery's replace-all write. */}
      <Dialog
        open={captionLocaleIndex !== null}
        onOpenChange={(open) => {
          if (!open) setCaptionLocaleIndex(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Caption in other languages</DialogTitle>
            <DialogDescription>
              Frame{" "}
              {captionLocaleIndex === null
                ? ""
                : String(captionLocaleIndex + 1).padStart(2, "0")}
              . Leave a language blank and it falls back to the English caption.
            </DialogDescription>
          </DialogHeader>

          {captionLocaleIndex !== null && (
            <Controller
              control={control}
              name={`images.${captionLocaleIndex}.translations`}
              render={({ field }) => (
                <TranslationsSection
                  value={field.value ?? {}}
                  onChange={field.onChange}
                  idPrefix={`frame-caption-${captionLocaleIndex}`}
                  fields={[
                    {
                      name: "caption",
                      label: "Caption",
                      kind: "text",
                      base: watchedImages?.[captionLocaleIndex]?.caption ?? "",
                    },
                  ]}
                />
              )}
            />
          )}

          <DialogFooter>
            <Button type="button" onClick={() => setCaptionLocaleIndex(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={1}
        noun="portfolio piece"
        busy={deleting}
        onConfirm={handleDelete}
        extraWarning="Its gallery and before/after images are removed from storage too."
      />
    </form>
  );
}
