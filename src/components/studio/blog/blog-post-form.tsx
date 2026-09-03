"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ContentStatus } from "@/generated/prisma/enums";
import {
  deleteBlogPosts,
  upsertBlogPost,
  type UpsertBlogPostInput,
} from "@/actions/blog";
import { uploadMediaFiles } from "@/actions/media";
import { MediaPicker } from "@/components/studio/media/media-picker";
import { DraftPreview } from "@/components/studio/draft-preview";
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
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { RichTextEditor } from "@/components/studio/rich-text-editor";
import { TranslationsSection } from "@/components/studio/translations-section";
import { FieldError } from "@/components/studio/field-error";
import { FormSection } from "@/components/studio/form-section";
import { toTranslationsRecord } from "@/lib/translations-form";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { CONTENT_STATUSES } from "@/lib/content-status";

// ————————————————————— Types & schema —————————————————————

export type BlogPostFormInitial = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Tiptap JSON from the database. */
  content: unknown;
  coverImage: string;
  authorName: string;
  blogCategoryId: string;
  tagIds: string[];
  status: ContentStatus;
  /** ISO string, or "" when unpublished. */
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  /** Raw per-locale overrides JSON from the database (`{ [locale]: {…} }`). */
  translations: unknown;
};

const optionalUrl = z.union([z.literal(""), z.url("Enter a valid URL.")]);

const formSchema = z.object({
  title: z.string().trim().min(2, "Title needs at least 2 characters."),
  excerpt: z.string(),
  content: z.record(z.string(), z.unknown()),
  coverImage: optionalUrl,
  authorName: z.string().trim().min(1, "Author name is required."),
  blogCategoryId: z.string(),
  tagIds: z.array(z.string()),
  status: z.enum(CONTENT_STATUSES),
  publishedAt: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  translations: z.record(z.string(), z.record(z.string(), z.unknown())),
});

type FormValues = z.infer<typeof formSchema>;

// ————————————————————— Module-level date helpers —————————————————————
// Clock/Date work lives outside the component body (lint landmine).

/** ISO string → datetime-local input value in the viewer's timezone. */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local value (viewer's timezone) → ISO string, or null. */
function localInputToIso(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const EMPTY_DOC = { type: "doc", content: [] } as const;

function toContentRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value) && "type" in value) {
    return value as Record<string, unknown>;
  }
  return { ...EMPTY_DOC };
}

// ————————————————————— Small helpers —————————————————————

const NONE_CATEGORY = "none";

// ————————————————————— The form —————————————————————

export function BlogPostForm({
  categories,
  tags,
  post,
}: {
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  post?: BlogPostFormInitial;
}) {
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: post?.title ?? "",
      excerpt: post?.excerpt ?? "",
      content: toContentRecord(post?.content),
      coverImage: post?.coverImage ?? "",
      authorName: post?.authorName ?? "Rivya Living Art Studio",
      blogCategoryId: post?.blogCategoryId ?? "",
      tagIds: post?.tagIds ?? [],
      status: post?.status ?? "DRAFT",
      publishedAt: isoToLocalInput(post?.publishedAt ?? ""),
      seoTitle: post?.seoTitle ?? "",
      seoDescription: post?.seoDescription ?? "",
      translations: toTranslationsRecord(post?.translations),
    },
  });

  useUnsavedChangesGuard(isDirty && !saving);

  const tagIds = useWatch({ control, name: "tagIds" });

  const [titleBase, excerptBase, seoTitleBase, seoDescBase] = useWatch({
    control,
    name: ["title", "excerpt", "seoTitle", "seoDescription"],
  });

  function toggleTag(id: string) {
    setValue(
      "tagIds",
      tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id],
      { shouldDirty: true },
    );
  }

  async function handleCoverUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("files", file);
    formData.append("folder", "blog");

    const result = await uploadMediaFiles(formData);
    setUploading(false);
    if (coverInputRef.current) coverInputRef.current.value = "";

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const url = result.data?.[0]?.url;
    if (url) {
      setValue("coverImage", url, { shouldDirty: true, shouldValidate: true });
      toast.success("Cover image uploaded.");
    }
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);

    const payload: UpsertBlogPostInput = {
      id: post?.id,
      title: values.title,
      excerpt: values.excerpt || undefined,
      content: values.content,
      coverImage: values.coverImage,
      authorName: values.authorName,
      blogCategoryId: values.blogCategoryId || null,
      tagIds: values.tagIds,
      status: values.status,
      publishedAt: localInputToIso(values.publishedAt),
      seoTitle: values.seoTitle || undefined,
      seoDescription: values.seoDescription || undefined,
      translations: values.translations,
    };

    const result = await upsertBlogPost(payload);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(post ? "Post saved." : "Post created.");
    if (!post && result.data) {
      router.push(`/studio/blog/${result.data.id}`);
    } else {
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!post) return;
    setDeleting(true);
    const result = await deleteBlogPosts([post.id]);
    setDeleting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDeleteOpen(false);
    toast.success("Post deleted.");
    router.push("/studio/blog");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* (a) Story */}
      <FormSection title="Story">
        <div className="space-y-1.5">
          <Label htmlFor="post-title">Title</Label>
          <Input
            id="post-title"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "post-title-error" : undefined}
            {...register("title")}
          />
          <FieldError id="post-title-error">{errors.title?.message}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-excerpt">Excerpt</Label>
          <Textarea
            id="post-excerpt"
            rows={3}
            placeholder="A short teaser shown on the blog index and in link previews."
            {...register("excerpt")}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Content</Label>
          <Controller
            control={control}
            name="content"
            render={({ field }) => (
              <RichTextEditor
                value={field.value}
                onChange={field.onChange}
                placeholder="Write your story…"
              />
            )}
          />
        </div>
      </FormSection>

      {/* (b) Cover & author */}
      <FormSection title="Cover & author">
        <div className="space-y-1.5">
          <Label htmlFor="post-cover">Cover image URL</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="post-cover"
              placeholder="https://…"
              className="flex-1 min-w-64"
              aria-invalid={!!errors.coverImage}
              aria-describedby={errors.coverImage ? "post-cover-error" : undefined}
              {...register("coverImage")}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleCoverUpload(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => coverInputRef.current?.click()}
            >
              <ImagePlus /> {uploading ? "Uploading…" : "Upload"}
            </Button>
            <MediaPicker
              defaultFolder="blog"
              onSelect={(item) =>
                setValue("coverImage", item.url, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </div>
          <FieldError id="post-cover-error">
            {errors.coverImage?.message}
          </FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-author">Author name</Label>
          <Input
            id="post-author"
            aria-invalid={!!errors.authorName}
            aria-describedby={errors.authorName ? "post-author-error" : undefined}
            {...register("authorName")}
          />
          <FieldError id="post-author-error">
            {errors.authorName?.message}
          </FieldError>
        </div>
      </FormSection>

      {/* (c) Organisation */}
      <FormSection
        title="Organisation"
        description="Category and tags drive the public blog's browsing and filtering."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Controller
              control={control}
              name="blogCategoryId"
              render={({ field }) => (
                <Select
                  value={field.value || NONE_CATEGORY}
                  onValueChange={(value) =>
                    field.onChange(value === NONE_CATEGORY ? "" : value)
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Category">
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_CATEGORY}>No category</SelectItem>
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
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Tags</Label>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tags yet — create some under Blog → Tags.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    aria-pressed={active}
                    className={
                      active
                        ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-e1 transition-colors"
                        : "rounded-full border border-foreground/15 px-4 py-1.5 text-sm text-foreground/70 transition-colors hover:border-sapphire-ink/40 hover:text-sapphire-ink"
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-published-at">Publish date</Label>
          <Input
            id="post-published-at"
            type="datetime-local"
            className="w-fit"
            {...register("publishedAt")}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to stamp the moment of publishing automatically.
          </p>
        </div>
      </FormSection>

      {/* (d) SEO */}
      <FormSection title="SEO">
        <div className="space-y-1.5">
          <Label htmlFor="post-seo-title">SEO title</Label>
          <Input id="post-seo-title" {...register("seoTitle")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="post-seo-description">SEO description</Label>
          <Textarea
            id="post-seo-description"
            rows={3}
            {...register("seoDescription")}
          />
        </div>
      </FormSection>

      {/* (e) Translations */}
      <Controller
        control={control}
        name="translations"
        render={({ field }) => (
          <TranslationsSection
            value={field.value}
            onChange={field.onChange}
            idPrefix="post"
            fields={[
              { name: "title", label: "Title", kind: "text", base: titleBase },
              {
                name: "excerpt",
                label: "Excerpt",
                kind: "textarea",
                base: excerptBase,
              },
              { name: "content", label: "Content", kind: "richtext" },
              {
                name: "seoTitle",
                label: "SEO title",
                kind: "text",
                base: seoTitleBase,
              },
              {
                name: "seoDescription",
                label: "SEO description",
                kind: "textarea",
                base: seoDescBase,
              },
            ]}
          />
        )}
      />

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-4 shadow-e2">
        <div>
          {post && (
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
          {post && (
            // Enables Next draft mode via the staff-gated route handler and
            // frames the public page (audit C2); the dialog keeps the new-tab
            // link inside it, so nothing is lost.
            <DraftPreview path={`/blog/${post.slug}`} />
          )}
          <Button type="submit" disabled={saving || uploading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={1}
        noun="post"
        busy={deleting}
        onConfirm={handleDelete}
      />
    </form>
  );
}
