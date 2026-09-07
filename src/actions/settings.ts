"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import {
  SETTINGS_LIMITS,
  WHATSAPP_NUMBER_MESSAGE,
  WHATSAPP_NUMBER_PATTERN,
} from "@/lib/studio-limits";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { SITE_SETTINGS_TAG } from "@/lib/site-settings";
import { nullIfEmpty } from "@/lib/utils";
import { Role, type Prisma } from "@/generated/prisma/client";

const SETTINGS_ID = "main";
const STUDIO_SETTINGS_PATH = "/studio/settings";
const STUDIO_SEO_PATH = "/studio/seo";

const optionalUrl = z
  .union([z.literal(""), z.url("Enter a valid URL.")])
  .optional();

const socialsSchema = z.object({
  instagram: optionalUrl,
  facebook: optionalUrl,
  youtube: optionalUrl,
  pinterest: optionalUrl,
});

const defaultSeoSchema = z.object({
  title: z.string().trim().max(SETTINGS_LIMITS.seoTitle).optional(),
  description: z.string().trim().max(SETTINGS_LIMITS.seoDescription).optional(),
  ogImage: optionalUrl,
});

const settingsSchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, "Brand name is required.")
    .max(SETTINGS_LIMITS.brandName),
  tagline: z.string().trim().max(SETTINGS_LIMITS.tagline),
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
  appIconUrl: optionalUrl,
  heroVideoUrl: optionalUrl,
  announcement: z.string().trim().max(SETTINGS_LIMITS.announcement).optional(),
  /** Optional link for the announcement strip. */
  announcementHref: z
    .union([z.literal(""), z.url("Enter a valid URL.")])
    .optional(),
  /** Both optional and independent: either bound may be left open. */
  announcementStartsAt: z.string().trim().optional(),
  announcementEndsAt: z.string().trim().optional(),
  /** [{ days, hours }] — empty rows are dropped before saving. */
  businessHours: z
    .array(
      z.object({
        days: z.string().trim().max(SETTINGS_LIMITS.businessHoursDays),
        hours: z.string().trim().max(SETTINGS_LIMITS.businessHoursHours),
      }),
    )
    .optional(),
  responseNote: z.string().trim().max(SETTINGS_LIMITS.responseNote).optional(),
  chartTimezone: z.enum(["UTC", "IST"]).optional(),
  phone: z.string().trim().max(SETTINGS_LIMITS.phone),
  // Becomes the wa.me/<number> order link — wa.me only accepts the bare
  // international number: digits with country code, no "+", spaces or dashes.
  whatsappNumber: z
    .string()
    .trim()
    .regex(WHATSAPP_NUMBER_PATTERN, WHATSAPP_NUMBER_MESSAGE),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
  mapsUrl: z.union([z.literal(""), z.url("Enter a valid URL.")]),
  address: z.string().trim().max(SETTINGS_LIMITS.address),
  socials: socialsSchema,
  defaultSeo: defaultSeoSchema,
  defaultCareNotes: z.string().trim().max(SETTINGS_LIMITS.careNotes).optional(),
});

export type UpdateSiteSettingsInput = z.input<typeof settingsSchema>;

/** "2026-11-03" or "" → a Date or null. Never throws on a malformed value. */
function parseDate(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Drops empty entries so the Json columns only store real values. */
function pruneRecord(
  record: Record<string, string | undefined>,
): Prisma.InputJsonValue {
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) => {
      const trimmed = value?.trim();
      return trimmed ? [[key, trimmed]] : [];
    }),
  );
}

/**
 * Updates the SiteSettings singleton (id "main"), creating it if the seed
 * never ran. The whole row is written every time — partial editors (the
 * SEO page) pass the untouched current values back through.
 */
export async function updateSiteSettings(
  input: UpdateSiteSettingsInput,
): Promise<ActionResult> {
  // ADMIN-only since Phase 4 (DESIGN.md C: "editor never sees Settings") —
  // the settings + SEO pages are admin-gated, and a server action is a public
  // endpoint, so the action must match. The SEC-105 identity-field gate below
  // stays as defense in depth.
  const session = await requireStaff([Role.ADMIN]);

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid settings.",
    };
  }
  const data = parsed.data;

  // The WhatsApp number is the destination of every order deep link — a lower
  // trust EDITOR must not be able to redirect the funnel to another account
  // (SEC-105). Contact phone/email are gated for the same reason. Non-identity
  // fields (brand, SEO, announcement) stay EDITOR-editable, so the SEO editor
  // that re-submits the untouched identity values keeps working.
  const current = await db.siteSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { whatsappNumber: true, phone: true, email: true },
  });
  // Only gate *changes* to an already-established identity — an EDITOR may
  // still create the initial settings row (fresh install) and save unrelated
  // fields. Once a number/phone/email exists, changing it requires ADMIN.
  const identityChanged =
    current !== null &&
    (current.whatsappNumber !== data.whatsappNumber ||
      current.phone !== data.phone ||
      current.email !== data.email);
  if (identityChanged && session.user.role !== "ADMIN") {
    return {
      ok: false,
      error:
        "Only an admin can change the WhatsApp number, phone, or email address.",
    };
  }

  return runAction(async () => {
    const row = {
      brandName: data.brandName,
      tagline: data.tagline,
      logoUrl: nullIfEmpty(data.logoUrl),
      faviconUrl: nullIfEmpty(data.faviconUrl),
      appIconUrl: nullIfEmpty(data.appIconUrl),
      heroVideoUrl: nullIfEmpty(data.heroVideoUrl),
      announcement: nullIfEmpty(data.announcement),
      announcementHref: nullIfEmpty(data.announcementHref),
      // A blank or unparseable date means "no bound on that side" rather than
      // an error: an owner clearing the end date is saying "run it until I say
      // otherwise", which is the common case for an announcement.
      announcementStartsAt: parseDate(data.announcementStartsAt),
      announcementEndsAt: parseDate(data.announcementEndsAt),
      // Rows needing both halves — a day with no hours tells a visitor nothing.
      businessHours: (data.businessHours ?? []).filter(
        (row) => row.days.trim() && row.hours.trim(),
      ),
      responseNote: nullIfEmpty(data.responseNote),
      chartTimezone: data.chartTimezone ?? "UTC",
      phone: data.phone,
      whatsappNumber: data.whatsappNumber,
      email: data.email,
      mapsUrl: data.mapsUrl,
      address: data.address,
      socials: pruneRecord(data.socials),
      defaultSeo: pruneRecord(data.defaultSeo),
      defaultCareNotes: nullIfEmpty(data.defaultCareNotes),
    };

    await db.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: row,
      create: { id: SETTINGS_ID, ...row },
    });

    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "SiteSettings",
      entityId: SETTINGS_ID,
      meta: {
        brandName: data.brandName,
        // Audit the funnel-critical number change (SEC-105).
        ...(current && current.whatsappNumber !== data.whatsappNumber
          ? {
              whatsappNumber: {
                from: current.whatsappNumber,
                to: data.whatsappNumber,
              },
            }
          : {}),
      },
    });

    revalidatePath(STUDIO_SETTINGS_PATH);
    revalidatePath(STUDIO_SEO_PATH);
    // Brand, announcement, contact and default SEO surface on every public
    // page, so this has to reach all of them — but by TAG, not by path.
    //
    // This used to be `revalidatePath("/", "layout")`: a full-tree bust that
    // evicted every route in every locale on a settings save, including 4,373
    // product pages whose 24h ISR has nothing to do with the phone number.
    // Every page that renders settings does so through `getSiteSettings()`,
    // which is tagged — so expiring the tag evicts exactly the routes that
    // actually read it, in all nine locales, and nothing else.
    revalidateTag(SITE_SETTINGS_TAG, "max");

    return undefined;
  });
}

const fillPolicySchema = z.object({
  enabled: z.boolean(),
  onDeploy: z.boolean(),
  /** Null clears the cap. Zero is meaningful: "never create anything". */
  maxCreates: z.number().int().min(0).max(100000).nullable(),
});

/**
 * Govern the sheet → catalog fill.
 *
 * The importer itself is unchanged and still runs from bootstrap; these three
 * values decide whether it may, and how much it may create in one go. They
 * default to what the importer already did, so an environment nobody has
 * configured behaves exactly as before.
 */
export async function setSheetFillPolicy(
  input: unknown,
): Promise<ActionResult<{ enabled: boolean }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = fillPolicySchema.parse(input);

    await db.siteSettings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        sheetFillEnabled: parsed.enabled,
        sheetFillOnDeploy: parsed.onDeploy,
        sheetFillMaxCreates: parsed.maxCreates,
      },
      update: {
        sheetFillEnabled: parsed.enabled,
        sheetFillOnDeploy: parsed.onDeploy,
        sheetFillMaxCreates: parsed.maxCreates,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "sheet-fill-policy",
      entity: "SiteSettings",
      meta: {
        enabled: parsed.enabled,
        onDeploy: parsed.onDeploy,
        maxCreates: parsed.maxCreates,
      },
    });
    revalidatePath("/studio/sheet-import");
    return { enabled: parsed.enabled };
  });
}

const TAB_NAMES = [
  "Tier1_Owner",
  "Tier2_ResinGoods",
  "Tier3_Supplies",
  "Tier4_3DPrint",
  "Sheet1",
] as const;

const sheetIdsSchema = z.object({
  /** The spreadsheet id (or a full URL — the id is extracted below), or
   *  blank to fall back to SCRAPE_SHEET_ID/SHEET_ID (readSheetId). */
  sheetId: z.string().trim().max(300),
  /** Tab name → numeric sheet id, for the tabs `sheets.ts` actually writes
   *  to. A blank field is simply omitted — deleteRowsFromTab's title lookup
   *  covers it until the owner fills it in. */
  sheetTabIds: z.record(z.enum(TAB_NAMES), z.string().trim()),
});

/** A pasted spreadsheet URL's id, or the id itself if that's what was pasted. */
function extractSheetId(raw: string): string | null {
  if (!raw) return null;
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(raw);
  return fromUrl ? fromUrl[1] : raw;
}

/**
 * The owner's own spreadsheet, ADMIN-only like every other Settings write —
 * it decides which document every scraper push and sheet-fill read talks
 * to, so an EDITOR redirecting it is the same class of risk as changing the
 * WhatsApp number above.
 */
export async function setSheetIds(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff([Role.ADMIN]);
    const parsed = sheetIdsSchema.parse(input);

    const tabIds: Record<string, number> = {};
    for (const [tab, raw] of Object.entries(parsed.sheetTabIds)) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const n = Number(trimmed);
      if (Number.isFinite(n)) tabIds[tab] = n;
    }

    const sheetId = extractSheetId(parsed.sheetId);

    await db.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        sheetId: nullIfEmpty(sheetId ?? ""),
        sheetTabIds: tabIds as Prisma.InputJsonValue,
      },
      update: {
        sheetId: nullIfEmpty(sheetId ?? ""),
        sheetTabIds: tabIds as Prisma.InputJsonValue,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "sheet-ids",
      entity: "SiteSettings",
      meta: { sheetId: sheetId ?? null, tabs: Object.keys(tabIds).length },
    });
    revalidatePath(STUDIO_SETTINGS_PATH);
    revalidatePath("/studio/sheet-import");
    return undefined;
  });
}
