"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import type { ActionResult } from "@/actions/helpers";
import { searchProductsForLink } from "@/actions/products";
import {
  deleteTestimonials,
  searchPortfolioForLink,
  upsertTestimonial,
} from "@/actions/testimonials";
import { MediaPicker } from "@/components/studio/media/media-picker";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { DraftPreview } from "@/components/studio/draft-preview";
import { FieldError } from "@/components/studio/field-error";
import { FormSection } from "@/components/studio/form-section";
import {
  PERMISSION_LABELS,
  STATUS_LABELS,
} from "@/components/studio/testimonials/labels";
import {
  TranslationsSection,
  type TranslationsValue,
} from "@/components/studio/translations-section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { isOptimizableImageSrc, isRenderableSrc } from "@/lib/image-src";
import { toTranslationsRecord } from "@/lib/translations-form";
import type {
  PermissionStatus,
  TestimonialStatus,
} from "@/generated/prisma/enums";

const RATINGS = [1, 2, 3, 4, 5] as const;
// Zod's enum needs a literal tuple, not `STATUS_ORDER`'s `readonly` array
// type — same values, kept in sync with `labels.ts` by the STATUS_LABELS /
// PERMISSION_LABELS lookups used to render every option below.
const STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "VERIFIED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
const PERMISSIONS = ["UNKNOWN", "REQUESTED", "GRANTED", "DECLINED"] as const;

/** What the server page loads for an existing testimonial. Nullable columns
 *  arrive as `null`; `product`/`portfolio` carry just enough to render the
 *  linked-piece picker without a second round trip on open. */
export type TestimonialFormInitial = {
  id: string;
  name: string;
  location: string | null;
  quote: string;
  rating: number;
  avatarUrl: string | null;
  mediaId: string | null;
  translations: unknown;
  status: TestimonialStatus;
  featured: boolean;
  designation: string | null;
  category: string | null;
  /** yyyy-mm-dd, or "" when unset. */
  givenAt: string;
  language: string | null;
  product: { id: string; title: string } | null;
  portfolio: { id: string; title: string } | null;
  productTitle: string | null;
  purchaseType: string | null;
  installationImageUrl: string | null;
  installationMediaId: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  internalNotes: string | null;
  permissionStatus: PermissionStatus;
  /** Read-only — set by the server the first time a row enters VERIFIED. */
  verifiedAt: string | null;
  isDemo: boolean;
};

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  location: z.string(),
  quote: z.string().trim().min(1, "Quote is required"),
  rating: z.number().int().min(1).max(5),
  avatarUrl: z.string(),
  mediaId: z.string(),
  translations: z.record(z.string(), z.record(z.string(), z.unknown())),
  status: z.enum(STATUSES),
  featured: z.boolean(),
  designation: z.string(),
  category: z.string(),
  givenAt: z.string(),
  language: z.string(),
  productId: z.string(),
  portfolioId: z.string(),
  productTitle: z.string(),
  purchaseType: z.string(),
  installationImageUrl: z.string(),
  installationMediaId: z.string(),
  videoUrl: z.string(),
  videoPosterUrl: z.string(),
  internalNotes: z.string(),
  permissionStatus: z.enum(PERMISSIONS),
});

type FormValues = z.infer<typeof formSchema>;

function buildDefaultValues(initial?: TestimonialFormInitial): FormValues {
  return {
    name: initial?.name ?? "",
    location: initial?.location ?? "",
    quote: initial?.quote ?? "",
    rating: initial?.rating ?? 5,
    avatarUrl: initial?.avatarUrl ?? "",
    mediaId: initial?.mediaId ?? "",
    translations: toTranslationsRecord(initial?.translations),
    status: initial?.status ?? "DRAFT",
    featured: initial?.featured ?? false,
    designation: initial?.designation ?? "",
    category: initial?.category ?? "",
    givenAt: initial?.givenAt ?? "",
    language: initial?.language ?? "",
    productId: initial?.product?.id ?? "",
    portfolioId: initial?.portfolio?.id ?? "",
    productTitle: initial?.productTitle ?? "",
    purchaseType: initial?.purchaseType ?? "",
    installationImageUrl: initial?.installationImageUrl ?? "",
    installationMediaId: initial?.installationMediaId ?? "",
    videoUrl: initial?.videoUrl ?? "",
    videoPosterUrl: initial?.videoPosterUrl ?? "",
    internalNotes: initial?.internalNotes ?? "",
    permissionStatus: initial?.permissionStatus ?? "UNKNOWN",
  };
}

/**
 * The form always submits its full current state — a picker cleared in the
 * UI must clear the column, not leave it untouched — so every optional
 * column is sent explicitly as its value or `null`, never omitted.
 */
function buildUpsertPayload(values: FormValues, id?: string) {
  return {
    id,
    name: values.name.trim(),
    location: values.location.trim() || undefined,
    quote: values.quote.trim(),
    rating: values.rating,
    avatarUrl: values.avatarUrl.trim() || undefined,
    mediaId: values.mediaId || null,
    translations: values.translations,
    status: values.status,
    featured: values.featured,
    designation: values.designation.trim() || undefined,
    category: values.category.trim() || undefined,
    givenAt: values.givenAt.trim() || null,
    language: values.language.trim() || undefined,
    productId: values.productId || null,
    portfolioId: values.portfolioId || null,
    productTitle: values.productTitle.trim() || undefined,
    purchaseType: values.purchaseType.trim() || undefined,
    installationImageUrl: values.installationImageUrl.trim() || undefined,
    installationMediaId: values.installationMediaId || null,
    videoUrl: values.videoUrl.trim() || undefined,
    videoPosterUrl: values.videoPosterUrl.trim() || undefined,
    internalNotes: values.internalNotes.trim() || undefined,
    permissionStatus: values.permissionStatus,
  };
}

const TABS = [
  {
    value: "quote",
    label: "Quote",
    fields: ["quote", "rating", "givenAt", "language", "translations"],
  },
  {
    value: "attribution",
    label: "Attribution",
    fields: ["name", "location", "designation", "category"],
  },
  {
    value: "links",
    label: "Links",
    fields: ["productId", "portfolioId", "productTitle", "purchaseType"],
  },
  {
    value: "media",
    label: "Media",
    fields: ["avatarUrl", "installationImageUrl", "videoUrl", "videoPosterUrl"],
  },
  {
    value: "review",
    label: "Review",
    fields: ["status", "featured", "permissionStatus", "internalNotes"],
  },
] as const;

function tabForField(field: string): string | undefined {
  const root = field.split(".")[0];
  return TABS.find((tab) => (tab.fields as readonly string[]).includes(root))
    ?.value;
}

/**
 * A one-of picker: search, pick, or clear. `search` returns the same
 * `{ id, title }` shape `searchProductsForLink` and `searchPortfolioForLink`
 * already return (product search's extra `tier` field is ignored here).
 */
function LinkPicker({
  label,
  placeholder,
  emptyHint,
  value,
  onChange,
  search,
}: {
  label: string;
  placeholder: string;
  emptyHint: string;
  value: { id: string; title: string } | null;
  onChange: (next: { id: string; title: string } | null) => void;
  search: (q: string) => Promise<ActionResult<{ id: string; title: string }[]>>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    const query = q.trim();
    if (!query) return;
    setSearching(true);
    setError(null);
    const result = await search(query);
    setSearching(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResults(result.data ?? []);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <span className="min-w-0 truncate text-sm text-foreground">
            {value.title}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 shrink-0"
            aria-label={`Unlink ${value.title}`}
            onClick={() => onChange(null)}
          >
            <X /> Unlink
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runSearch();
                }
              }}
              placeholder={placeholder}
              aria-label={label}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 shrink-0"
              disabled={searching}
              onClick={() => void runSearch()}
            >
              <Search /> {searching ? "Searching…" : "Search"}
            </Button>
          </div>
          <FieldError>{error}</FieldError>
          {results.length > 0 ? (
            <ul className="space-y-1">
              {results.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(row);
                      setResults([]);
                      setQ("");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-start text-sm text-foreground hover:border-border"
                  >
                    <span className="min-w-0 truncate">{row.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{emptyHint}</p>
          )}
        </>
      )}
    </div>
  );
}

export function TestimonialForm({
  testimonial,
}: {
  testimonial?: TestimonialFormInitial;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isEdit = Boolean(testimonial);

  const methods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaultValues(testimonial),
  });
  const { control, register, handleSubmit, setValue, formState } = methods;

  useUnsavedChangesGuard(formState.isDirty && !saving);

  const [productLink, setProductLink] = useState(testimonial?.product ?? null);
  const [portfolioLink, setPortfolioLink] = useState(
    testimonial?.portfolio ?? null,
  );

  const [tab, setTab] = useState<string>(TABS[0].value);
  const errored = new Set(
    Object.keys(formState.errors)
      .map(tabForField)
      .filter((value): value is string => Boolean(value)),
  );

  function onInvalid(errors: Record<string, unknown>) {
    const first = Object.keys(errors)[0];
    const target = first ? tabForField(first) : undefined;
    if (target) setTab(target);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const result = await upsertTestimonial(
      buildUpsertPayload(values, testimonial?.id),
    );
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Testimonial saved." : "Testimonial created.");
    if (!isEdit && result.data) {
      router.push(`/studio/testimonials/${result.data.id}`);
    } else {
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!testimonial) return;
    setDeleting(true);
    const result = await deleteTestimonials([testimonial.id]);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDeleteOpen(false);
    toast.success("Testimonial deleted.");
    router.push("/studio/testimonials");
    router.refresh();
  }

  const avatarUrl = useWatch({ control, name: "avatarUrl" });
  const installationImageUrl = useWatch({
    control,
    name: "installationImageUrl",
  });
  const videoPosterUrl = useWatch({ control, name: "videoPosterUrl" });
  const quote = useWatch({ control, name: "quote" });
  const location = useWatch({ control, name: "location" });
  const designation = useWatch({ control, name: "designation" });
  const productTitle = useWatch({ control, name: "productTitle" });
  const translations = useWatch({
    control,
    name: "translations",
  }) as TranslationsValue;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        {testimonial?.isDemo && (
          <div className="rounded-card border border-hairline-dk bg-card px-4 py-3 text-sm text-muted-foreground">
            This is a seeded demo row, not a customer&apos;s words — see the
            Content Lab before treating it as real proof.
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Testimonial sections">
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

          {/* forceMount — a hidden tab still holds registered RHF fields and
              (on Media) in-flight upload state, so unmounting on tab change
              would drop both mid-edit. Same contract as the product form. */}
          <TabsContent forceMount value="quote" className="space-y-6">
            <FormSection title="The words">
              <div className="space-y-1.5">
                <Label htmlFor="testimonial-quote">Quote</Label>
                <Textarea
                  id="testimonial-quote"
                  rows={5}
                  aria-invalid={!!formState.errors.quote}
                  aria-describedby={
                    formState.errors.quote
                      ? "testimonial-quote-error"
                      : undefined
                  }
                  {...register("quote")}
                />
                <FieldError id="testimonial-quote-error">
                  {formState.errors.quote?.message}
                </FieldError>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Rating</Label>
                  <Controller
                    control={control}
                    name="rating"
                    render={({ field }) => (
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <SelectTrigger className="w-full" aria-label="Rating">
                          <SelectValue placeholder="Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          {RATINGS.map((value) => (
                            <SelectItem key={value} value={String(value)}>
                              <span className="text-sapphire-ink">
                                {"★".repeat(value)}
                              </span>
                              <span className="text-muted-foreground">
                                ({value})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="testimonial-given-at">Given on</Label>
                  <Input
                    id="testimonial-given-at"
                    type="date"
                    {...register("givenAt")}
                  />
                  <p className="text-xs text-muted-foreground">
                    When the customer said this — not when it was entered.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="testimonial-language">Language</Label>
                  <Input
                    id="testimonial-language"
                    placeholder="e.g. hi, gu, en"
                    {...register("language")}
                  />
                  <p className="text-xs text-muted-foreground">
                    The language the quote was given in, if not English.
                  </p>
                </div>
              </div>
            </FormSection>

            <TranslationsSection
              value={translations ?? {}}
              onChange={(next) =>
                setValue("translations", next, { shouldDirty: true })
              }
              idPrefix="testimonial"
              fields={[
                {
                  name: "quote",
                  label: "Quote",
                  kind: "textarea",
                  base: quote,
                },
                {
                  name: "location",
                  label: "Location",
                  kind: "text",
                  base: location,
                },
                {
                  name: "designation",
                  label: "Designation",
                  kind: "text",
                  base: designation,
                },
                {
                  name: "productTitle",
                  label: "What they bought (free text)",
                  kind: "text",
                  base: productTitle,
                },
              ]}
            />
          </TabsContent>

          <TabsContent forceMount value="attribution" className="space-y-6">
            <FormSection title="Who said it">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="testimonial-name">Name</Label>
                  <Input
                    id="testimonial-name"
                    aria-invalid={!!formState.errors.name}
                    aria-describedby={
                      formState.errors.name
                        ? "testimonial-name-error"
                        : undefined
                    }
                    {...register("name")}
                  />
                  <FieldError id="testimonial-name-error">
                    {formState.errors.name?.message}
                  </FieldError>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="testimonial-location">Location</Label>
                  <Input
                    id="testimonial-location"
                    placeholder="Mumbai"
                    {...register("location")}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="testimonial-designation">Designation</Label>
                  <Input
                    id="testimonial-designation"
                    placeholder="Interior designer, Surat"
                    {...register("designation")}
                  />
                  <p className="text-xs text-muted-foreground">
                    The line under the name.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="testimonial-category">Category</Label>
                  <Input
                    id="testimonial-category"
                    placeholder="e.g. varmala-preservation"
                    {...register("category")}
                  />
                  <p className="text-xs text-muted-foreground">
                    A category slug, for a per-collection words wall.
                  </p>
                </div>
              </div>
            </FormSection>
          </TabsContent>

          <TabsContent forceMount value="links" className="space-y-6">
            <FormSection
              title="What this is about"
              description="Link the catalogue piece or the case study these words are about — or leave both unlinked and describe it in free text."
            >
              <LinkPicker
                label="Linked product"
                placeholder="Search products…"
                emptyHint="Search the catalogue by title."
                value={productLink}
                onChange={(next) => {
                  setProductLink(next);
                  setValue("productId", next?.id ?? "", { shouldDirty: true });
                }}
                search={searchProductsForLink}
              />
              <LinkPicker
                label="Linked case study"
                placeholder="Search the portfolio…"
                emptyHint="Search past commissions by title."
                value={portfolioLink}
                onChange={(next) => {
                  setPortfolioLink(next);
                  setValue("portfolioId", next?.id ?? "", {
                    shouldDirty: true,
                  });
                }}
                search={searchPortfolioForLink}
              />

              <div className="space-y-1.5">
                <Label htmlFor="testimonial-product-title">
                  What they bought (free text)
                </Label>
                <Input
                  id="testimonial-product-title"
                  placeholder="e.g. a custom varmala frame"
                  {...register("productTitle")}
                />
                <p className="text-xs text-muted-foreground">
                  Shown when the words are about a commission rather than a
                  catalogue product — ignored once a product is linked above.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="testimonial-purchase-type">Purchase type</Label>
                <Input
                  id="testimonial-purchase-type"
                  placeholder="commission, catalogue, or workshop"
                  {...register("purchaseType")}
                />
              </div>
            </FormSection>
          </TabsContent>

          <TabsContent forceMount value="media" className="space-y-6">
            <FormSection
              title="Photograph"
              description="The customer, or the piece they commissioned. Left empty, the card is the quote alone — never a placeholder face."
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-56 flex-1"
                  placeholder="https://… or /uploads/…"
                  aria-label="Photograph URL"
                  {...register("avatarUrl")}
                />
                <MediaPicker
                  defaultFolder="site"
                  onSelect={(item) => {
                    setValue("avatarUrl", item.url, { shouldDirty: true });
                    setValue("mediaId", item.id, { shouldDirty: true });
                  }}
                />
              </div>
              {isRenderableSrc(avatarUrl) ? (
                <div className="relative mt-1 aspect-[4/5] w-24 overflow-hidden rounded-card border border-border bg-muted">
                  <Image
                    src={avatarUrl}
                    alt=""
                    fill
                    sizes="96px"
                    unoptimized={!isOptimizableImageSrc(avatarUrl)}
                    className="object-cover"
                  />
                </div>
              ) : null}
            </FormSection>

            <FormSection
              title="The installed piece"
              description="A photo of the finished commission in the customer's space."
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-56 flex-1"
                  placeholder="https://… or /uploads/…"
                  aria-label="Installation photo URL"
                  {...register("installationImageUrl")}
                />
                <MediaPicker
                  defaultFolder="site"
                  onSelect={(item) => {
                    setValue("installationImageUrl", item.url, {
                      shouldDirty: true,
                    });
                    setValue("installationMediaId", item.id, {
                      shouldDirty: true,
                    });
                  }}
                />
              </div>
              {isRenderableSrc(installationImageUrl) ? (
                <div className="relative mt-1 aspect-[4/5] w-24 overflow-hidden rounded-card border border-border bg-muted">
                  <Image
                    src={installationImageUrl}
                    alt=""
                    fill
                    sizes="96px"
                    unoptimized={!isOptimizableImageSrc(installationImageUrl)}
                    className="object-cover"
                  />
                </div>
              ) : null}
            </FormSection>

            <FormSection
              title="A short film"
              description="A film from the media library, or a full https:// address of one hosted elsewhere. The poster shows while it loads and stands in for it on phones."
            >
              <div className="space-y-1.5">
                <Label htmlFor="testimonial-video-url">Video</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="testimonial-video-url"
                    className="min-w-56 flex-1"
                    placeholder="https://… or /uploads/…"
                    {...register("videoUrl")}
                  />
                  <MediaPicker
                    accept="VIDEO"
                    defaultFolder="site"
                    onSelect={(item) =>
                      setValue("videoUrl", item.url, { shouldDirty: true })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="testimonial-video-poster">Poster image</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="testimonial-video-poster"
                    className="min-w-56 flex-1"
                    placeholder="https://… or /uploads/…"
                    {...register("videoPosterUrl")}
                  />
                  <MediaPicker
                    defaultFolder="site"
                    onSelect={(item) =>
                      setValue("videoPosterUrl", item.url, {
                        shouldDirty: true,
                      })
                    }
                  />
                </div>
                {isRenderableSrc(videoPosterUrl) ? (
                  <div className="relative mt-1 aspect-video w-40 overflow-hidden rounded-card border border-border bg-muted">
                    <Image
                      src={videoPosterUrl}
                      alt=""
                      fill
                      sizes="160px"
                      unoptimized={!isOptimizableImageSrc(videoPosterUrl)}
                      className="object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </FormSection>
          </TabsContent>

          <TabsContent forceMount value="review" className="space-y-6">
            <FormSection title="Editorial state">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full" aria-label="Status">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {STATUS_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Permission</Label>
                  <Controller
                    control={control}
                    name="permissionStatus"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label="Permission"
                        >
                          <SelectValue placeholder="Permission" />
                        </SelectTrigger>
                        <SelectContent>
                          {PERMISSIONS.map((value) => (
                            <SelectItem key={value} value={value}>
                              {PERMISSION_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Publishing is refused until this reads Granted.
                  </p>
                </div>
              </div>

              <Controller
                control={control}
                name="featured"
                render={({ field }) => (
                  <Label className="cursor-pointer font-normal">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                    />
                    Featured — highlighted wherever testimonials are shown
                  </Label>
                )}
              />

              {testimonial?.verifiedAt ? (
                <p className="u-micro">Verified {testimonial.verifiedAt}</p>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="testimonial-internal-notes">
                  Internal notes
                </Label>
                <Textarea
                  id="testimonial-internal-notes"
                  rows={4}
                  placeholder="Staff-only — how this was collected, follow-ups, anything not for the storefront."
                  {...register("internalNotes")}
                />
                <p className="text-xs text-muted-foreground">
                  Never shown to visitors.
                </p>
              </div>
            </FormSection>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-4 shadow-e2">
          <div>
            {testimonial && (
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
          </div>
          <div className="flex items-center gap-2">
            <DraftPreview path="/custom-order" />
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {testimonial && (
          <ConfirmDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            count={1}
            noun="Testimonial"
            busy={deleting}
            onConfirm={handleDelete}
          />
        )}
      </form>
    </FormProvider>
  );
}
