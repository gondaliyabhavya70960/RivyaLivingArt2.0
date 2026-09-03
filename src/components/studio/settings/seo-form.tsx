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
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  title: z.string(),
  description: z.string(),
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

  const {
    register,
    control,
    handleSubmit,
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

  // Watched rather than read on submit: the whole point is seeing the budget
  // blow while typing, not after saving. `useWatch` rather than `watch()` —
  // the latter returns a function the React Compiler cannot memoize, so it
  // skips optimising the entire component (react-hooks/incompatible-library).
  const previewTitle = useWatch({ control, name: "title" });
  const previewDescription = useWatch({ control, name: "description" });

  async function onSubmit(values: FormValues) {
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
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Default SEO saved.");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-card border border-border bg-card p-6 shadow-e1"
    >
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
            {...register("title")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="seo-description">Default description</Label>
          <Textarea
            id="seo-description"
            rows={3}
            placeholder="Bespoke resin art, personalized gifts and custom 3D printing — handcrafted to order in India."
            {...register("description")}
          />
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
