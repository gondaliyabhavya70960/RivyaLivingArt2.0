"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  updateSiteSettings,
  type UpdateSiteSettingsInput,
} from "@/actions/settings";
import { SerpPreview } from "@/components/studio/seo/serp-preview";
import { UploadUrlField } from "@/components/studio/settings/upload-url-field";
import type { SiteSettingsValues } from "@/components/studio/settings/site-settings-values";
import { FieldError } from "@/components/studio/field-error";
import { describedBy } from "@/components/studio/field-hint";
import { LocalDraftBar } from "@/components/studio/local-draft-bar";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import {
  describePassedThroughSettings,
  SETTINGS_LIMITS,
  tooLong,
} from "@/lib/studio-limits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Mirrors `defaultSeoSchema` in `src/actions/settings.ts` — same numbers,
// from the same module, and `.trim()` first because the action trims before
// it counts. Without these the action refuses over-long copy with zod's own
// "Too big: expected string to have <=300 characters" in a toast, which names
// no field and shows a number that appears nowhere on this screen (the
// counters here are the 60/160 search-result budgets, not the limits).
const formSchema = z.object({
  title: z
    .string()
    .trim()
    .max(SETTINGS_LIMITS.seoTitle, tooLong("the default title", SETTINGS_LIMITS.seoTitle)),
  description: z
    .string()
    .trim()
    .max(
      SETTINGS_LIMITS.seoDescription,
      tooLong("the default description", SETTINGS_LIMITS.seoDescription),
    ),
  ogImage: z.union([z.literal(""), z.url("Enter a valid URL.")]),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Edits ONLY SiteSettings.defaultSeo — every other field is passed back
 * through updateSiteSettings untouched.
 */
export function SeoForm({ settings }: { settings: SiteSettingsValues }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  /** A problem in the settings half this form submits but does not show. */
  const [blocked, setBlocked] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: settings.defaultSeo.title,
      description: settings.defaultSeo.description,
      ogImage: settings.defaultSeo.ogImage,
    },
  });

  useUnsavedChangesGuard(isDirty && !saving);

  const draft = useLocalDraft<FormValues>({
    key: "seo",
    id: "singleton",
    watch,
    reset,
    enabled: !saving,
  });

  // Watched rather than read on submit: the whole point is seeing the budget
  // blow while typing, not after saving. `useWatch` rather than `watch()` —
  // the latter returns a function the React Compiler cannot memoize, so it
  // skips optimising the entire component (react-hooks/incompatible-library).
  const previewTitle = useWatch({ control, name: "title" });
  const previewDescription = useWatch({ control, name: "description" });

  async function onSubmit(values: FormValues) {
    // This form saves the whole settings row, so a value on the Settings page
    // can refuse the save — and the action reports only its first issue in
    // schema key order, which puts `defaultSeo` twentieth of twenty-one. Say
    // which screen to go to rather than passing on a message about a field
    // that is not here.
    const elsewhere = describePassedThroughSettings(settings);
    if (elsewhere) {
      setBlocked(elsewhere);
      return;
    }
    setBlocked(null);
    setSaving(true);

    const payload: UpdateSiteSettingsInput = {
      ...settings,
      defaultSeo: {
        title: values.title,
        description: values.description,
        ogImage: values.ogImage,
      },
    };

    const result = await updateSiteSettings(payload);

    if (!result.ok) {
      setSaving(false);
      toast.error(result.error);
      return;
    }
    reset(values);
    draft.discard();
    setSaving(false);
    toast.success("Default SEO saved.");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-card border border-border bg-card p-6 shadow-e1"
    >
      <LocalDraftBar
        savedAt={draft.savedAt}
        onRestore={draft.restore}
        onDiscard={draft.discard}
        disabled={saving}
        paused={draft.paused}
      />
      {blocked && (
        <p
          role="alert"
          className="mb-4 rounded-card border border-alert/30 bg-alert/5 px-4 py-3 text-small text-foreground"
        >
          {blocked}
        </p>
      )}
      <h2 className="font-display text-lg text-foreground">Site-wide defaults</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Used when a page/product has no specific SEO fields.
      </p>

      <div className="mt-5 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="seo-title">Default title</Label>
          <Input
            id="seo-title"
            placeholder="Rivya Living Art — Handcrafted Resin Art & Commissions"
            aria-invalid={!!errors.title}
            aria-describedby={describedBy(errors.title && "seo-title-error")}
            {...register("title")}
          />
          <FieldError id="seo-title-error">{errors.title?.message}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="seo-description">Default description</Label>
          <Textarea
            id="seo-description"
            rows={3}
            placeholder="Bespoke resin art, personalized gifts and custom 3D printing — handcrafted to order in India."
            aria-invalid={!!errors.description}
            aria-describedby={describedBy(
              errors.description && "seo-description-error",
            )}
            {...register("description")}
          />
          <FieldError id="seo-description-error">
            {errors.description?.message}
          </FieldError>
        </div>

        {/* These two fields cascade to every page that sets none of its own,
            so a missing description here is missing on the whole long tail. */}
        <SerpPreview
          title={previewTitle}
          description={previewDescription}
          path="/"
        />

        <Controller
          control={control}
          name="ogImage"
          render={({ field }) => (
            <UploadUrlField
              id="seo-og-image"
              label="Default OG image"
              value={field.value}
              onChange={field.onChange}
              library="IMAGE"
                accept="image/*"
              help="The image shown when a link to the site is shared — 1200×630 works best."
              error={errors.ogImage?.message}
            />
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save defaults"}
          </Button>
        </div>
      </div>
    </form>
  );
}
