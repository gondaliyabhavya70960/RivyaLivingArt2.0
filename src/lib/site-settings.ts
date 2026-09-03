import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { SITE } from "@/lib/constants";
import { announcementIsLive } from "@/lib/announcement-window";
import { db } from "@/lib/db";

/**
 * Resolved, render-ready site settings for the public chrome (ENG-001). The
 * studio Site Settings form writes these; before this loader existed the
 * global header/footer/announcement ignored them and showed hardcoded
 * constants, so editing them changed nothing on the live site. Every field
 * falls back to the SITE constant when unset. `cache()` dedupes the query
 * across the layout + any page that also reads settings in one request, and
 * the underlying row read is cached cross-request for 300s (M-P4) with tag
 * invalidation from the settings save action.
 */

/**
 * Cache tag for the settings row read below. Revalidated by
 * `updateSiteSettings` (src/actions/settings.ts) so a studio save reaches
 * the public chrome immediately instead of after the 300s TTL.
 */
export const SITE_SETTINGS_TAG = "site-settings";

/**
 * Announcement-bar fallback for callers with no message context — the Studio's
 * own settings preview, and any server path outside the [locale] tree.
 *
 * REDESIGN.md §5.1: "Content should be a fact, not a slogan." The two lead-time
 * bands are the studio's own published figures (small pieces 7–10 days,
 * statement pieces 3–6 weeks) — the one thing a first-time visitor most needs
 * to know before they start reading.
 *
 * The STOREFRONT does not use this string: the stock line is our copy, not the
 * owner's, so the layout passes the translated `Common.announcementDefault`
 * instead. An English lead time on the Hindi homepage is a bug, and this
 * constant is where it came from.
 */
export const DEFAULT_ANNOUNCEMENT =
  "Current lead time · Small pieces 7–10 days · Statement pieces 3–6 weeks";

export type PublicSiteSettings = {
  announcement: string;
  /**
   * The owner's switch for Content Lab rows on the public site. Off by
   * default; `showDemoContent()` in demo-content.ts is the only reader.
   */
  demoContentPublic: boolean;
  /** Brand name + tagline surfaced in the footer (UIUX-601). */
  brandName: string;
  tagline: string;
  whatsappNumber: string;
  phoneDisplay: string;
  phoneTel: string;
  email: string;
  mapsUrl: string;
  /** Studio address — empty string until the owner fills it in Settings. */
  address: string;
  /** Ambient hero loop for the home §1 hero — undefined until set. */
  heroVideoUrl?: string;
  /**
   * The brand logo. Written by Settings since the beginning and read by
   * nothing until the structured data started using it — schema.org's
   * `Organization.logo` and `LocalBusiness.image`.
   */
  logoUrl?: string;
  /** Brand marks. Undefined means the files bundled in src/app still apply. */
  faviconUrl?: string;
  appIconUrl?: string;
  /** Studio SEO defaults (studio /seo page) — undefined until set. */
  defaultSeo: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  socials: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    pinterest?: string;
  };
  /** Opening hours; empty until the owner fills them in Settings. */
  businessHours: { days: string; hours: string }[];
  /** "We usually reply within 4 hours." — undefined until set. */
  responseNote?: string;
  /** Where the announcement strip links, when it links anywhere. */
  announcementHref?: string;
};

/**
 * Opening hours from the settings Json — same defensive shape as socials.
 *
 * A malformed row must render nothing rather than throw on /contact, so every
 * entry is checked and anything unrecognised is dropped.
 */
function readBusinessHours(
  value: unknown,
): PublicSiteSettings["businessHours"] {
  if (!Array.isArray(value)) return [];
  const out: PublicSiteSettings["businessHours"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const rec = entry as Record<string, unknown>;
    const days = typeof rec.days === "string" ? rec.days.trim() : "";
    const hours = typeof rec.hours === "string" ? rec.hours.trim() : "";
    if (days && hours) out.push({ days, hours });
  }
  return out;
}

function readSocials(value: unknown): PublicSiteSettings["socials"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const rec = value as Record<string, unknown>;
  const pick = (k: string) =>
    typeof rec[k] === "string" && (rec[k] as string).trim()
      ? (rec[k] as string).trim()
      : undefined;
  return {
    instagram: pick("instagram"),
    facebook: pick("facebook"),
    youtube: pick("youtube"),
    pinterest: pick("pinterest"),
  };
}

/** The studio SEO page's Json column — same defensive shape as socials. */
function readDefaultSeo(value: unknown): PublicSiteSettings["defaultSeo"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const rec = value as Record<string, unknown>;
  const pick = (k: string) =>
    typeof rec[k] === "string" && (rec[k] as string).trim()
      ? (rec[k] as string).trim()
      : undefined;
  return {
    title: pick("title"),
    description: pick("description"),
    ogImage: pick("ogImage"),
  };
}

/**
 * The raw row read, wrapped in `unstable_cache`: the singleton settings row
 * is re-read on every no-store request site-wide otherwise. Selects only the
 * chrome-visible scalar/Json fields (all JSON-serializable — the cache
 * round-trips through JSON). Pure DB read — nothing here may touch
 * per-request APIs (cookies/headers), which `unstable_cache` cannot close
 * over. Errors surface to the caller so a DB hiccup is never cached as a
 * missing row for 300s.
 */
const readSiteSettingsRow = unstable_cache(
  async () =>
    db.siteSettings.findUnique({
      where: { id: "main" },
      select: {
        announcement: true,
        brandName: true,
        tagline: true,
        whatsappNumber: true,
        phone: true,
        email: true,
        mapsUrl: true,
        address: true,
        heroVideoUrl: true,
        logoUrl: true,
        faviconUrl: true,
        appIconUrl: true,
        socials: true,
        defaultSeo: true,
        businessHours: true,
        responseNote: true,
        announcementStartsAt: true,
        announcementEndsAt: true,
        announcementHref: true,
        demoContentPublic: true,
      },
    }),
  ["site-settings"],
  // 24h, not 300 — same reasoning as catalog-nav: this renders in the layout
  // on every route, and route ISR = min(segment, cached reads), so a short
  // TTL here would cap the PDP's 86400 (M-P6). The settings action's tag
  // invalidation delivers freshness; the TTL is the safety net.
  { revalidate: 86400, tags: [SITE_SETTINGS_TAG] },
);

export const getSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  const s = await readSiteSettingsRow().catch(() => null);

  const phone = s?.phone?.trim();

  // A scheduled announcement outside its window falls back to the shipped
  // default rather than to an empty strip: the bar is part of the chrome, and
  // a blank one reads as a broken page rather than as "nothing on today".
  const scheduled = announcementIsLive(
    { startsAt: s?.announcementStartsAt, endsAt: s?.announcementEndsAt },
    new Date(),
  );

  return {
    announcement:
      (scheduled ? s?.announcement?.trim() : "") || DEFAULT_ANNOUNCEMENT,
    demoContentPublic: s?.demoContentPublic === true,
    brandName: s?.brandName?.trim() || SITE.name,
    tagline: s?.tagline?.trim() || SITE.tagline,
    whatsappNumber: s?.whatsappNumber?.trim() || SITE.whatsappNumber,
    phoneDisplay: phone || SITE.phoneDisplay,
    phoneTel: phone ? phone.replace(/[^\d+]/g, "") : SITE.phoneTel,
    email: s?.email?.trim() || SITE.email,
    mapsUrl: s?.mapsUrl?.trim() || SITE.mapsUrl,
    address: s?.address?.trim() ?? "",
    heroVideoUrl: s?.heroVideoUrl?.trim() || undefined,
    logoUrl: s?.logoUrl?.trim() || undefined,
    faviconUrl: s?.faviconUrl?.trim() || undefined,
    appIconUrl: s?.appIconUrl?.trim() || undefined,
    defaultSeo: readDefaultSeo(s?.defaultSeo),
    socials: readSocials(s?.socials),
    businessHours: readBusinessHours(s?.businessHours),
    responseNote: s?.responseNote?.trim() || undefined,
    announcementHref:
      scheduled && s?.announcementHref?.trim()
        ? s.announcementHref.trim()
        : undefined,
  };
});
