"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deletePages, upsertPage, type UpsertPageInput } from "@/actions/pages";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { FieldError } from "@/components/studio/field-error";
import { FormSection } from "@/components/studio/form-section";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { isLegalPageSlug } from "@/components/studio/pages/legal";
import { RichTextEditor } from "@/components/studio/rich-text-editor";
import { TranslationsSection } from "@/components/studio/translations-section";
import { toTranslationsRecord } from "@/lib/translations-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/slug";

// ————————————————————— Types & schema —————————————————————

export type PageFormInitial = {
  id: string;
  slug: string;
  title: string;
  /** Tiptap JSON from the database. */
  content: unknown;
  seoTitle: string;
  seoDescription: string;
  /** Raw per-locale overrides JSON from the database (`{ [locale]: {…} }`). */
  translations: unknown;
};

const formSchema = z.object({
  title: z.string().trim().min(2, "Title needs at least 2 characters."),
  slug: z.string(),
  content: z.record(z.string(), z.unknown()),
  seoTitle: z.string(),
  seoDescription: z.string(),
  translations: z.record(z.string(), z.record(z.string(), z.unknown())),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_DOC = { type: "doc", content: [] } as const;

function toContentRecord(value: unknown): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "type" in value
  ) {
    return value as Record<string, unknown>;
  }
  return { ...EMPTY_DOC };
}

// ————————————————————— The form —————————————————————

export function PageForm({ page }: { page?: PageFormInitial }) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isLegal = page ? isLegalPageSlug(page.slug) : false;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: page?.title ?? "",
      slug: page?.slug ?? "",
      content: toContentRecord(page?.content),
      seoTitle: page?.seoTitle ?? "",
      seoDescription: page?.seoDescription ?? "",
      translations: toTranslationsRecord(page?.translations),
    },
  });

  useUnsavedChangesGuard(isDirty && !saving);

  const watchedTitle = useWatch({ control, name: "title" });
  const watchedSlug = useWatch({ control, name: "slug" });
  const slugPreview = slugify(watchedSlug || watchedTitle);

  async function onSubmit(values: FormValues) {
    setSaving(true);

    const payload: UpsertPageInput = {
      id: page?.id,
      // The slug is only read on create — immutable for existing rows.
      slug: page ? undefined : values.slug || undefined,
      title: values.title,
      content: values.content,
      seoTitle: values.seoTitle || undefined,
      seoDescription: values.seoDescription || undefined,
      translations: values.translations,
    };

    const result = await upsertPage(payload);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(page ? "Page saved." : "Page created.");
    if (!page && result.data) {
      router.push(`/studio/pages/${result.data.id}`);
    } else {
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!page) return;
    setDeleting(true);
    const result = await deletePages([page.id]);
    setDeleting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDeleteOpen(false);
    toast.success("Page deleted.");
    router.push("/studio/pages");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* (a) Content */}
      <FormSection title="Content">
        <div className="space-y-1.5">
          <Label htmlFor="page-title">Title</Label>
          <Input
            id="page-title"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "page-title-error" : undefined}
            {...register("title")}
          />
          <FieldError id="page-title-error">{errors.title?.message}</FieldError>
        </div>

        {page ? (
          <div className="space-y-1.5">
            <Label htmlFor="page-slug">Slug</Label>
            <div className="flex flex-wrap items-center gap-2">
              <p
                id="page-slug"
                className="rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground"
              >
                /{page.slug}
              </p>
              {isLegal && <Badge variant="secondary">Legal page</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLegal
                ? "The site footer links to this page — its slug never changes and the page cannot be deleted."
                : "Locked after creation to keep public URLs stable."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="page-slug">Slug</Label>
            <Input
              id="page-slug"
              placeholder="about-us"
              autoComplete="off"
              spellCheck={false}
              {...register("slug")}
            />
            <p className="font-mono text-xs text-muted-foreground">
              /{slugPreview || "…"}
            </p>
            <p className="text-xs text-muted-foreground">
              Leave empty to generate from the title. Locked after creation — a
              number is appended if it is already taken.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Body</Label>
          <Controller
            control={control}
            name="content"
            render={({ field }) => (
              <RichTextEditor
                value={field.value}
                onChange={field.onChange}
                placeholder="Write the page content…"
              />
            )}
          />
        </div>
      </FormSection>

      {/* (b) SEO */}
      <FormSection
        title="SEO"
        description="Overrides the site-wide defaults for this page only."
      >
        <div className="space-y-1.5">
          <Label htmlFor="page-seo-title">SEO title</Label>
          <Input id="page-seo-title" {...register("seoTitle")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="page-seo-description">SEO description</Label>
          <Textarea
            id="page-seo-description"
            rows={3}
            {...register("seoDescription")}
          />
        </div>
      </FormSection>

      {/* (c) Translations */}
      <Controller
        control={control}
        name="translations"
        render={({ field }) => (
          <TranslationsSection
            value={field.value}
            onChange={field.onChange}
            idPrefix="page"
            fields={[
              {
                name: "title",
                label: "Title",
                kind: "text",
                base: watchedTitle,
              },
              { name: "content", label: "Body", kind: "richtext" },
            ]}
          />
        )}
      />

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-4 shadow-e2">
        <div>
          {page && !isLegal && (
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
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={1}
        noun="page"
        busy={deleting}
        onConfirm={handleDelete}
      />
    </form>
  );
}
