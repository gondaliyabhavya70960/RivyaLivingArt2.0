import type { SiteSettings } from "@/generated/prisma/client";

/**
 * Flat, all-string view of the SiteSettings singleton used by the studio
 * forms. Plain module (no "use client" / "use server") so the RSC pages
 * that fetch the row and the client forms that edit it share one shape —
 * it is structurally assignable to `UpdateSiteSettingsInput`.
 */
export type SiteSettingsValues = {
  brandName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  appIconUrl: string;
  heroVideoUrl: string;
  announcement: string;
  announcementHref: string;
  /** yyyy-mm-dd for <input type="date">; empty means no bound. */
  announcementStartsAt: string;
  announcementEndsAt: string;
  businessHours: { days: string; hours: string }[];
  responseNote: string;
  chartTimezone: "UTC" | "IST";
  phone: string;
  whatsappNumber: string;
  email: string;
  mapsUrl: string;
  address: string;
  socials: {
    instagram: string;
    facebook: string;
    youtube: string;
    pinterest: string;
  };
  defaultSeo: {
    title: string;
    description: string;
    ogImage: string;
  };
  defaultCareNotes: string;
};

const str = (value: unknown): string =>
  typeof value === "string" ? value : "";

/** A Date to the yyyy-mm-dd an <input type="date"> expects. */
const dateInput = (value: Date | null | undefined): string =>
  value ? value.toISOString().slice(0, 10) : "";

/** The hours Json to form rows, dropping anything malformed. */
function readHours(value: unknown): { days: string; hours: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const rec = entry as Record<string, unknown>;
    const days = str(rec.days).trim();
    const hours = str(rec.hours).trim();
    return days && hours ? [{ days, hours }] : [];
  });
}

/** Maps the Prisma row (or a missing singleton) to form-ready strings. */
export function toSiteSettingsValues(
  row: SiteSettings | null,
): SiteSettingsValues {
  const socials = (row?.socials ?? {}) as Record<string, unknown>;
  const seo = (row?.defaultSeo ?? {}) as Record<string, unknown>;

  return {
    brandName: row?.brandName ?? "ResinRiva",
    tagline: row?.tagline ?? "",
    logoUrl: row?.logoUrl ?? "",
    faviconUrl: row?.faviconUrl ?? "",
    appIconUrl: row?.appIconUrl ?? "",
    heroVideoUrl: row?.heroVideoUrl ?? "",
    announcement: row?.announcement ?? "",
    announcementHref: row?.announcementHref ?? "",
    announcementStartsAt: dateInput(row?.announcementStartsAt),
    announcementEndsAt: dateInput(row?.announcementEndsAt),
    businessHours: readHours(row?.businessHours),
    responseNote: row?.responseNote ?? "",
    chartTimezone: row?.chartTimezone === "IST" ? "IST" : "UTC",
    phone: row?.phone ?? "",
    whatsappNumber: row?.whatsappNumber ?? "",
    email: row?.email ?? "",
    mapsUrl: row?.mapsUrl ?? "",
    address: row?.address ?? "",
    socials: {
      instagram: str(socials.instagram),
      facebook: str(socials.facebook),
      youtube: str(socials.youtube),
      pinterest: str(socials.pinterest),
    },
    defaultSeo: {
      title: str(seo.title),
      description: str(seo.description),
      ogImage: str(seo.ogImage),
    },
    defaultCareNotes: row?.defaultCareNotes ?? "",
  };
}
