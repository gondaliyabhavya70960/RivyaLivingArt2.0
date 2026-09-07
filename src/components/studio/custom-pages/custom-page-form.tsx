"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteCustomPage, upsertCustomPage } from "@/actions/custom-pages";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { FieldError } from "@/components/studio/field-error";
import { FormSection } from "@/components/studio/form-section";
import { MediaPicker } from "@/components/studio/media/media-picker";
import { TranslationsSection } from "@/components/studio/translations-section";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { toTranslationsRecord } from "@/lib/translations-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTENT_STATUSES,
  type ContentStatusValue,
} from "@/lib/content-status";

export type CustomPageFormInitial = {
  id: string;
  slug: string;
  title: string;
  status: ContentStatusValue;
  /** `datetime-local` value, or "" for "as soon as it is published". */
  publishAt: string;
  noindex: boolean;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  translations: unknown;
};

const formSchema = z.object({
  title: z.string().trim().min(2, "Give the page a title."),
  slug: z.string(),
  status: z.enum(CONTENT_STATUSES),
  publishAt: z.string(),
  noindex: z.boolean(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  ogImage: z.string(),
  translations: z.record(z.string(), z.record(z.string(), z.unknown())),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * A landing page's own fields — everything except its blocks.
 *
 * `status` and `publishAt` together are the page's whole publishing story:
 * DRAFT is invisible, PUBLISHED with no date is live now, PUBLISHED with a
 * future date is scheduled. There is no separate "schedule" switch, because a
 * date that only counts when a switch is also on is a way to miss a launch.
 */
export function CustomPageForm({ page }: { page?: CustomPageFormInitial }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: page?.title ?? "",
      slug: page?.slug ?? "",
      status: page?.status ?? "DRAFT",
      publishAt: page?.publishAt ?? "",
      noindex: page?.noindex ?? false,
      seoTitle: page?.seoTitle ?? "",
      seoDescription: page?.seoDescription ?? "",
      ogImage: page?.ogImage ?? "",
      translations: toTranslationsRecord(page?.translations),
    },
  });

  useUnsavedChangesGuard(isDirty && !saving);

  // `useWatch` rather than `watch()` — the repo lints the latter out
  // (react-hooks/incompatible-library) because it cannot be memoized safely.
  const status = useWatch({ control, name: "status" });
  const publishAt = useWatch({ control, name: "publishAt" });
  const title = useWatch({ control, name: "title" });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const result = await upsertCustomPage({
      id: page?.id,
      slug: values.slug || undefined,
      title: values.title,
      status: values.status,
      publishAt: values.publishAt || undefined,
      noindex: values.noindex,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
      ogImage: values.ogImage,
      translations: values.translations,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    reset(values);
    toast.success("Saved.");
    if (!page && result.data) {
      router.push(`/studio/custom-pages/${result.data.id}`);
      return;
    }
    router.refresh();
  }

  async function onDelete() {
    if (!page) return;
    setDeleting(true);
    const result = await deleteCustomPage(page.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Page deleted.");
    router.push("/studio/custom-pages");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <FormSection
        title="The page"
        description="The title is what search results and the browser tab show. The address is minted once and never moves — a link in a customer's inbox has to keep working."
      >
        <div className="space-y-2">
          <Label htmlFor="cp-title">Title</Label>
          <Input
            id="cp-title"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "cp-title-error" : undefined}
            {...register("title")}
          />
          <FieldError id="cp-title-error">{errors.title?.message}</FieldError>
        </div>

        {page ? (
          <p className="font-mono text-12 text-graphite">
            /p/{page.slug}{" "}
            <a
              href={`/p/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              open <ExternalLink aria-hidden className="inline size-3" />
            </a>
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="cp-slug">Address (optional)</Label>
            <Input
              id="cp-slug"
              placeholder="diwali-2026"
              {...register("slug")}
            />
            <p className="text-xs text-graphite">
              Leave it blank to build one from the title
              {title ? ` — “${title}” would become a URL under /p/.` : "."}
            </p>
          </div>
        )}
      </FormSection>

      <FormSection
        title="When it goes live"
        description="A draft is visible only to you. Published with a date in the future means the page appears on its own, at that moment — nobody has to be awake for it."
      >
        <div className="space-y-2">
          <Label htmlFor="cp-status">Status</Label>
          <select
            id="cp-status"
            {...register("status")}
            className="h-10 w-full rounded-input border border-border bg-transparent px-3 text-small"
          >
            <option value="DRAFT">Draft — only you can see it</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cp-publish-at">Go live at (optional)</Label>
          <Input
            id="cp-publish-at"
            type="datetime-local"
            {...register("publishAt")}
          />
          <p className="text-xs text-graphite">
            {status === "PUBLISHED" && publishAt
              ? "The page will appear at this moment and not before."
              : status === "PUBLISHED"
                ? "Live as soon as you save."
                : "A date has no effect while the page is a draft."}{" "}
            Times are your browser&rsquo;s.
          </p>
        </div>

        <label className="flex items-start gap-2 text-small">
          <input
            type="checkbox"
            {...register("noindex")}
            className="mt-1 size-4"
          />
          <span>
            Keep out of search results
            <span className="block text-xs text-graphite">
              For a page that exists for one email or one ad. It stays out of
              the sitemap too.
            </span>
          </span>
        </label>
      </FormSection>

      <FormSection
        title="Search and sharing"
        description="Left blank, search engines use the page title and the first thing they find. Filling these in is how you control both."
      >
        <div className="space-y-2">
          <Label htmlFor="cp-seo-title">Search title</Label>
          <Input id="cp-seo-title" {...register("seoTitle")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-seo-description">Search description</Label>
          <Textarea
            id="cp-seo-description"
            rows={3}
            {...register("seoDescription")}
          />
        </div>
        <Controller
          control={control}
          name="ogImage"
          render={({ field }) => (
            <div className="space-y-2">
              <Label htmlFor="cp-og">Sharing picture</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="cp-og"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Shown when the link is pasted into a chat"
                />
                <MediaPicker onSelect={(item) => field.onChange(item.url)} />
                {field.value && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => field.onChange("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        />
      </FormSection>

      <Controller
        control={control}
        name="translations"
        render={({ field }) => (
          <TranslationsSection
            idPrefix="cp"
            value={field.value}
            onChange={field.onChange}
            fields={[
              { name: "title", label: "Title", kind: "text", base: title },
              { name: "seoTitle", label: "Search title", kind: "text" },
              {
                name: "seoDescription",
                label: "Search description",
                kind: "textarea",
              },
            ]}
          />
        )}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : page ? "Save page" : "Create page"}
        </Button>
        {page && (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
            >
              <Trash2 aria-hidden className="size-4" />
              Delete
            </Button>
            <ConfirmDeleteDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              count={1}
              noun="landing page"
              busy={deleting}
              onConfirm={onDelete}
            />
          </>
        )}
      </div>
    </form>
  );
}
