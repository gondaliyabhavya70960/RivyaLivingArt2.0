"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  updateSiteSettings,
  type UpdateSiteSettingsInput,
} from "@/actions/settings";
import { SheetIdsSection } from "@/components/studio/settings/sheet-ids-section";
import { UploadUrlField } from "@/components/studio/settings/upload-url-field";
import { DemoContentSection } from "@/components/studio/settings/demo-content-section";
import type { SiteSettingsValues } from "@/components/studio/settings/site-settings-values";
import { FieldError } from "@/components/studio/field-error";
import { FormSection } from "@/components/studio/form-section";
import { LocalDraftBar } from "@/components/studio/local-draft-bar";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { Button } from "@/components/ui/button";
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

// ————————————————————— Schema —————————————————————

const optionalUrl = z.union([z.literal(""), z.url("Enter a valid URL.")]);

const formSchema = z.object({
  brandName: z.string().trim().min(1, "Brand name is required."),
  tagline: z.string(),
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
  appIconUrl: optionalUrl,
  heroVideoUrl: optionalUrl,
  announcement: z.string(),
  announcementHref: z.union([z.literal(""), z.url("Enter a valid URL.")]),
  announcementStartsAt: z.string(),
  announcementEndsAt: z.string(),
  businessHours: z.array(z.object({ days: z.string(), hours: z.string() })),
  responseNote: z.string(),
  chartTimezone: z.enum(["UTC", "IST"]),
  phone: z.string(),
  whatsappNumber: z
    .string()
    .trim()
    .regex(
      /^[0-9]{8,15}$/,
      "8–15 digits including the country code, no + or spaces — e.g. 917096036250.",
    ),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
  mapsUrl: optionalUrl,
  address: z.string(),
  instagram: optionalUrl,
  facebook: optionalUrl,
  youtube: optionalUrl,
  pinterest: optionalUrl,
  defaultCareNotes: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

// ————————————————————— The form —————————————————————

export function SettingsForm({
  settings,
  sheetId,
  sheetTabIds,
}: {
  settings: SiteSettingsValues;
  /** Raw SiteSettings.sheetId/sheetTabIds — outside SiteSettingsValues on
   *  purpose: SheetIdsSection below saves through its own Server Action,
   *  never through this form's submit. */
  sheetId: string | null;
  sheetTabIds: unknown;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

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
      brandName: settings.brandName,
      tagline: settings.tagline,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      appIconUrl: settings.appIconUrl,
      heroVideoUrl: settings.heroVideoUrl,
      announcement: settings.announcement,
      announcementHref: settings.announcementHref,
      announcementStartsAt: settings.announcementStartsAt,
      announcementEndsAt: settings.announcementEndsAt,
      // Always offer a blank row so adding hours is typing, not a click first.
      businessHours: settings.businessHours.length
        ? settings.businessHours
        : [{ days: "", hours: "" }],
      responseNote: settings.responseNote,
      chartTimezone: settings.chartTimezone === "IST" ? "IST" : "UTC",
      phone: settings.phone,
      whatsappNumber: settings.whatsappNumber,
      email: settings.email,
      mapsUrl: settings.mapsUrl,
      address: settings.address,
      instagram: settings.socials.instagram,
      facebook: settings.socials.facebook,
      youtube: settings.socials.youtube,
      pinterest: settings.socials.pinterest,
      defaultCareNotes: settings.defaultCareNotes,
    },
  });

  useUnsavedChangesGuard(isDirty && !saving);

  // One settings row, so one draft slot: an explicit id rather than the
  // create form's "new".
  const draft = useLocalDraft<FormValues>({
    key: "settings",
    id: "singleton",
    watch,
    reset,
    enabled: !saving,
  });

  /** Opening-hours rows. A blank row is seeded above so adding is typing. */
  const hourRows = useFieldArray({ control, name: "businessHours" });

  const whatsappNumber = useWatch({ control, name: "whatsappNumber" });

  async function onSubmit(values: FormValues) {
    setSaving(true);

    const payload: UpdateSiteSettingsInput = {
      brandName: values.brandName,
      tagline: values.tagline,
      logoUrl: values.logoUrl,
      faviconUrl: values.faviconUrl,
      appIconUrl: values.appIconUrl,
      heroVideoUrl: values.heroVideoUrl,
      announcement: values.announcement,
      announcementHref: values.announcementHref,
      announcementStartsAt: values.announcementStartsAt,
      announcementEndsAt: values.announcementEndsAt,
      businessHours: values.businessHours,
      responseNote: values.responseNote,
      chartTimezone: values.chartTimezone,
      phone: values.phone,
      whatsappNumber: values.whatsappNumber,
      email: values.email,
      mapsUrl: values.mapsUrl,
      address: values.address,
      socials: {
        instagram: values.instagram,
        facebook: values.facebook,
        youtube: values.youtube,
        pinterest: values.pinterest,
      },
      // The SEO page owns these fields — pass the current values through.
      defaultSeo: settings.defaultSeo,
      defaultCareNotes: values.defaultCareNotes,
    };

    const result = await updateSiteSettings(payload);

    if (!result.ok) {
      setSaving(false);
      toast.error(result.error);
      return;
    }
    // The save is the new baseline (see product-form.tsx), reset while
    // autosave is still off so it is never written back as a draft.
    reset(values);
    draft.discard();
    setSaving(false);
    toast.success("Settings saved.");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <LocalDraftBar
          savedAt={draft.savedAt}
          onRestore={draft.restore}
          onDiscard={draft.discard}
          disabled={saving}
          paused={draft.paused}
        />
        {/* (a) Brand */}
        <FormSection
          title="Brand"
          description="Name, tagline and the media that front the storefront."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-brand-name">Brand name</Label>
              <Input
                id="settings-brand-name"
                aria-invalid={!!errors.brandName}
                aria-describedby={
                  errors.brandName ? "settings-brand-name-error" : undefined
                }
                {...register("brandName")}
              />
              <FieldError id="settings-brand-name-error">
                {errors.brandName?.message}
              </FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-tagline">Tagline</Label>
              <Input
                id="settings-tagline"
                placeholder="Handcrafted resin art, made to order."
                {...register("tagline")}
              />
            </div>
          </div>

          <Controller
            control={control}
            name="logoUrl"
            render={({ field }) => (
              <UploadUrlField
                id="settings-logo"
                label="Logo URL"
                value={field.value}
                onChange={field.onChange}
                library="IMAGE"
                accept="image/*"
                error={errors.logoUrl?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="faviconUrl"
            render={({ field }) => (
              <UploadUrlField
                id="settings-favicon"
                label="Favicon"
                value={field.value}
                onChange={field.onChange}
                library="IMAGE"
                accept="image/png,image/webp,image/avif"
                help="The little icon in a browser tab. Square, at least 96×96. Left blank, the one that ships with the site is used."
                error={errors.faviconUrl?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="appIconUrl"
            render={({ field }) => (
              <UploadUrlField
                id="settings-app-icon"
                label="Phone home-screen icon"
                value={field.value}
                onChange={field.onChange}
                library="IMAGE"
                accept="image/png,image/webp,image/avif"
                help="Shown when someone adds the site to a phone home screen. Square, 180×180 or larger."
                error={errors.appIconUrl?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="heroVideoUrl"
            render={({ field }) => (
              <UploadUrlField
                id="settings-hero-video"
                label="Hero video URL"
                value={field.value}
                onChange={field.onChange}
                library="VIDEO"
                accept="video/mp4,video/webm"
                help="Plays behind the homepage hero — MP4 or WebM, up to 16 MB."
                error={errors.heroVideoUrl?.message}
              />
            )}
          />
        </FormSection>

        {/* (b) Announcement bar */}
        <FormSection title="Announcement bar">
          <div className="space-y-1.5">
            <Label htmlFor="settings-announcement">Announcement messages</Label>
            <Textarea
              id="settings-announcement"
              rows={3}
              placeholder={
                "Made-to-order luxury resin art — every order finalized on WhatsApp\nOne message per line — the bar rotates through them"
              }
              {...register("announcement")}
            />
            <p className="text-xs text-muted-foreground">
              One message per line — the top-of-page bar rotates through them
              (B1). Leave empty to fall back to the stock line.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-ann-from">Show from</Label>
              <Input
                id="settings-ann-from"
                type="date"
                {...register("announcementStartsAt")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-ann-to">Stop showing after</Label>
              <Input
                id="settings-ann-to"
                type="date"
                {...register("announcementEndsAt")}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Leave either blank for no limit on that side. Outside the dates
              the bar shows the stock line rather than going empty. The change
              appears within a few minutes rather than on the minute, because
              pages are cached — right for &ldquo;starts on the 3rd&rdquo;, not
              for &ldquo;at 09:00 sharp&rdquo;.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-ann-href">Announcement link</Label>
            <Input
              id="settings-ann-href"
              placeholder="https://… — optional, where the bar sends people"
              {...register("announcementHref")}
            />
            <FieldError id="settings-ann-href-error">
              {errors.announcementHref?.message}
            </FieldError>
          </div>

          <div className="space-y-1.5">
            <Label>Analytics day boundary</Label>
            <Controller
              control={control}
              name="chartTimezone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    className="w-full sm:w-72"
                    aria-label="Analytics day boundary"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC (default)</SelectItem>
                    <SelectItem value="IST">IST — UTC+05:30</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Where a chart day starts on the studio dashboard and analytics.
              IST makes &ldquo;today&rdquo; match your working day; past buckets
              reshuffle at the boundary accordingly.
            </p>
          </div>
        </FormSection>

        {/* (c) Contact */}
        <FormSection
          title="Contact"
          description="Used in the header, footer and contact page — and to build every WhatsApp order link."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-phone">Phone (display)</Label>
              <Input
                id="settings-phone"
                placeholder="+91 70960 36250"
                {...register("phone")}
              />
              <p className="text-xs text-muted-foreground">
                Shown to visitors as-is — any format works here.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-whatsapp">WhatsApp number</Label>
              <Input
                id="settings-whatsapp"
                inputMode="numeric"
                placeholder="917096036250"
                aria-invalid={!!errors.whatsappNumber}
                aria-describedby={
                  errors.whatsappNumber ? "settings-whatsapp-error" : undefined
                }
                {...register("whatsappNumber")}
              />
              <p className="text-xs text-muted-foreground">
                Digits only with country code, no + or spaces — orders open{" "}
                <span className="font-mono">
                  wa.me/{whatsappNumber.trim() || "…"}
                </span>
                .
              </p>
              <FieldError id="settings-whatsapp-error">
                {errors.whatsappNumber?.message}
              </FieldError>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                type="email"
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email ? "settings-email-error" : undefined
                }
                {...register("email")}
              />
              <FieldError id="settings-email-error">
                {errors.email?.message}
              </FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-maps">Google Maps URL</Label>
              <Input
                id="settings-maps"
                placeholder="https://maps.app.goo.gl/…"
                aria-invalid={!!errors.mapsUrl}
                aria-describedby={
                  errors.mapsUrl ? "settings-maps-error" : undefined
                }
                {...register("mapsUrl")}
              />
              <FieldError id="settings-maps-error">
                {errors.mapsUrl?.message}
              </FieldError>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-address">Address</Label>
            <Textarea
              id="settings-address"
              rows={3}
              placeholder="Studio address shown in the footer and on the contact page."
              {...register("address")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Opening hours</Label>
            <div className="space-y-2">
              {hourRows.fields.map((row, index) => (
                <div key={row.id} className="flex flex-wrap items-center gap-2">
                  <Input
                    className="w-full sm:w-44"
                    placeholder="Mon–Sat"
                    aria-label={`Days, row ${index + 1}`}
                    {...register(`businessHours.${index}.days` as const)}
                  />
                  <Input
                    className="w-full sm:w-48"
                    placeholder="10:00–19:00"
                    aria-label={`Hours, row ${index + 1}`}
                    {...register(`businessHours.${index}.hours` as const)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => hourRows.remove(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => hourRows.append({ days: "", hours: "" })}
            >
              Add a row
            </Button>
            <p className="text-xs text-muted-foreground">
              Shown on the contact page. A row needs both halves to appear — a
              day with no hours tells a visitor nothing. Leave every row empty
              to show no hours at all, which is what the page did before this
              existed.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-response-note">Response time note</Label>
            <Input
              id="settings-response-note"
              placeholder="We usually reply within 4 hours."
              {...register("responseNote")}
            />
            <p className="text-xs text-muted-foreground">
              Shown beside the WhatsApp call to action. Only promise what the
              studio can keep — it is the first thing a customer measures you
              by.
            </p>
          </div>
        </FormSection>

        {/* (d) Socials */}
        <FormSection
          title="Socials"
          description="Profile links shown in the footer — leave a field empty to hide its icon."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-instagram">Instagram URL</Label>
              <Input
                id="settings-instagram"
                placeholder="https://instagram.com/…"
                aria-invalid={!!errors.instagram}
                aria-describedby={
                  errors.instagram ? "settings-instagram-error" : undefined
                }
                {...register("instagram")}
              />
              <FieldError id="settings-instagram-error">
                {errors.instagram?.message}
              </FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-facebook">Facebook URL</Label>
              <Input
                id="settings-facebook"
                placeholder="https://facebook.com/…"
                aria-invalid={!!errors.facebook}
                aria-describedby={
                  errors.facebook ? "settings-facebook-error" : undefined
                }
                {...register("facebook")}
              />
              <FieldError id="settings-facebook-error">
                {errors.facebook?.message}
              </FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-youtube">YouTube URL</Label>
              <Input
                id="settings-youtube"
                placeholder="https://youtube.com/…"
                aria-invalid={!!errors.youtube}
                aria-describedby={
                  errors.youtube ? "settings-youtube-error" : undefined
                }
                {...register("youtube")}
              />
              <FieldError id="settings-youtube-error">
                {errors.youtube?.message}
              </FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-pinterest">Pinterest URL</Label>
              <Input
                id="settings-pinterest"
                placeholder="https://pinterest.com/…"
                aria-invalid={!!errors.pinterest}
                aria-describedby={
                  errors.pinterest ? "settings-pinterest-error" : undefined
                }
                {...register("pinterest")}
              />
              <FieldError id="settings-pinterest-error">
                {errors.pinterest?.message}
              </FieldError>
            </div>
          </div>
        </FormSection>

        {/* (e) Default care notes */}
        <FormSection title="Default care notes">
          <div className="space-y-1.5">
            <Label htmlFor="settings-care-notes">Care notes</Label>
            <Textarea
              id="settings-care-notes"
              rows={4}
              {...register("defaultCareNotes")}
            />
            <p className="text-xs text-muted-foreground">
              Products without their own care notes fall back to this text.
            </p>
          </div>
        </FormSection>

        {/* Sticky save bar */}
        <div className="sticky bottom-4 z-30 flex items-center justify-end gap-3 rounded-card border border-border bg-card p-4 shadow-e2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
      {/* Content Lab (batch G) — a separate switch with its own action, kept
        outside this form's submit so it never depends on the rest of the
        settings being valid. See src/components/studio/settings/demo-content-section.tsx. */}
      <div className="mt-6">
        <DemoContentSection />
      </div>

      {/* Standalone, own save action — see SettingsForm's prop comment. */}
      <div className="mt-6">
        <SheetIdsSection sheetId={sheetId} sheetTabIds={sheetTabIds} />
      </div>
    </>
  );
}
