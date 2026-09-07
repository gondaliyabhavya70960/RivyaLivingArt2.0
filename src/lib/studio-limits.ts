/**
 * The lengths, ranges and formats the Studio's Server Actions enforce, in one
 * place, so a form and the action behind it cannot drift apart.
 *
 * They have to be SHARED rather than repeated. A file carrying `"use server"`
 * may export only async functions, so an action cannot hand its schema — or
 * even its numbers — to a test; a cap copied into a form could rot for a
 * release with nothing to catch it. Both sides import this instead.
 *
 * WHETHER A CAP COUNTS THE TRIMMED VALUE OR THE RAW ONE IS PART OF THE RULE.
 * `settings`, `pages`, `blog`, `custom-pages` and `testimonials` declare
 * `z.string().trim().max(n)`, so trailing spaces do not count; `products` and
 * `portfolio` declare `z.string().max(n)`, so they do. Measured, not assumed:
 * 300 characters plus one space passes the first group and is refused by the
 * second. Mirroring the number but not the trimming makes the form disagree
 * with the server in one direction or the other — refusing what the action
 * accepts, or accepting what it refuses, which is the whole defect this
 * module exists to close. `cappedText()` takes the trimming as an argument
 * for that reason, and each entity's table below records which it uses.
 */

/** Trim-then-count (settings · pages · blog · custom-pages · testimonials). */
export const TRIMMED = "trimmed" as const;
/** Count the raw value (products · portfolio). */
export const RAW = "raw" as const;
export type CountMode = typeof TRIMMED | typeof RAW;

export const SETTINGS_LIMITS = {
  mode: TRIMMED,
  brandName: 120,
  tagline: 300,
  announcement: 300,
  responseNote: 200,
  phone: 40,
  address: 2000,
  careNotes: 5000,
  businessHoursDays: 60,
  businessHoursHours: 60,
  /** SiteSettings.defaultSeo — edited by BOTH the settings and SEO forms. */
  seoTitle: 300,
  seoDescription: 500,
} as const;

export const PAGE_LIMITS = {
  mode: TRIMMED,
  slug: 120,
  title: 200,
  titleMin: 2,
  seoTitle: 300,
  seoDescription: 500,
} as const;

export const CUSTOM_PAGE_LIMITS = {
  mode: TRIMMED,
  slug: 120,
  title: 200,
  titleMin: 2,
  publishAt: 40,
  seoTitle: 300,
  seoDescription: 500,
  ogImage: 600,
} as const;

export const BLOG_LIMITS = {
  mode: TRIMMED,
  /** The journal's own taxonomy names, created inline on /studio/blog. */
  taxonomyName: 120,
  title: 200,
  titleMin: 2,
  excerpt: 600,
  authorName: 120,
  seoTitle: 300,
  seoDescription: 500,
} as const;

export const TESTIMONIAL_LIMITS = {
  mode: TRIMMED,
  name: 120,
  location: 120,
  quote: 2000,
  designation: 160,
  category: 120,
  language: 20,
  productTitle: 200,
  purchaseType: 60,
  internalNotes: 10_000,
  url: 2048,
  ratingMin: 1,
  ratingMax: 5,
} as const;

/** products.ts caps the RAW string — no `.trim()` before `.max()`. */
export const PRODUCT_LIMITS = {
  mode: RAW,
  titleMin: 2,
  displayName: 120,
  shortTagline: 300,
  timeline: 300,
  materials: 500,
  dimensions: 300,
  seoTitle: 300,
  seoDescription: 500,
  imageAlt: 300,
  lexicalLabel: 40,
  lexicalValue: 300,
  lexicalRows: 8,
  madeWithRows: 12,
  customFieldHelpText: 500,
  tierMin: 1,
  tierMax: 4,
} as const;

/** portfolio.ts caps the RAW string too. */
export const PORTFOLIO_LIMITS = {
  mode: RAW,
  titleMin: 2,
  location: 120,
  imageAlt: 300,
  imageCaption: 300,
  /** `resultsMeta` — the chips beside the plate number on the case page. */
  metaText: 300,
  metaComplexity: 60,
  metaTag: 60,
  metaTags: 12,
} as const;

/** wa.me takes the bare international number: digits only, no + or spaces. */
export const WHATSAPP_NUMBER_PATTERN = /^[0-9]{8,15}$/;
export const WHATSAPP_NUMBER_MESSAGE =
  "WhatsApp number must be 8–15 digits including the country code, with no + or spaces (it becomes the wa.me link).";

export const YEAR_PATTERN = /^\d{4}$/;
export const YEAR_MESSAGE = "Enter a 4-digit year.";

/**
 * The one sentence a length refusal says, everywhere. `what` names the field
 * as the person would say it, lower case and article-first: "the title",
 * "materials", "the default description".
 */
export function tooLong(what: string, max: number): string {
  return `Keep ${what} under ${max.toLocaleString("en-IN")} characters.`;
}

/**
 * The two settings editors each submit fields the other one owns.
 * `/studio/seo` sends the whole `SiteSettings` row back with only
 * `defaultSeo` replaced, and `/studio/settings` sends `defaultSeo` back
 * untouched — so either form can be refused by a value it does not render,
 * with a message naming a length the owner cannot find on the page. Worse,
 * the action reports only its FIRST issue in schema key order, and
 * `defaultSeo` is the twentieth of twenty-one keys: on a row whose WhatsApp
 * number has never been filled, every SEO save is refused with
 * "WhatsApp number must be 8-15 digits…", a field on another screen.
 *
 * These two run over the passed-through half before the action is called, so
 * the form can say which screen to go and fix instead of dead-ending.
 */
export function describePassedThroughSettings(values: {
  brandName: string;
  tagline: string;
  announcement: string;
  responseNote: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  defaultCareNotes: string;
  businessHours: { days: string; hours: string }[];
}): string | null {
  const over = (what: string, value: string, max: number) =>
    value.trim().length > max
      ? `${what} is over its ${max}-character limit`
      : null;
  const problem =
    (values.brandName.trim() ? null : "the brand name is empty") ??
    over("the brand name", values.brandName, SETTINGS_LIMITS.brandName) ??
    over("the tagline", values.tagline, SETTINGS_LIMITS.tagline) ??
    over(
      "the announcement",
      values.announcement,
      SETTINGS_LIMITS.announcement,
    ) ??
    over(
      "the response note",
      values.responseNote,
      SETTINGS_LIMITS.responseNote,
    ) ??
    over("the phone number", values.phone, SETTINGS_LIMITS.phone) ??
    over("the address", values.address, SETTINGS_LIMITS.address) ??
    over(
      "the care notes",
      values.defaultCareNotes,
      SETTINGS_LIMITS.careNotes,
    ) ??
    // Named per column: the two limits are equal today, and saying "days"
    // for an over-long hours cell would be wrong the moment they diverge —
    // which is exactly the change this module exists to make safe.
    (values.businessHours.some(
      (row) => row.days.trim().length > SETTINGS_LIMITS.businessHoursDays,
    )
      ? `an opening-hours days cell is over its ${SETTINGS_LIMITS.businessHoursDays}-character limit`
      : null) ??
    (values.businessHours.some(
      (row) => row.hours.trim().length > SETTINGS_LIMITS.businessHoursHours,
    )
      ? `an opening-hours hours cell is over its ${SETTINGS_LIMITS.businessHoursHours}-character limit`
      : null) ??
    (WHATSAPP_NUMBER_PATTERN.test(values.whatsappNumber.trim())
      ? null
      : "the WhatsApp number is not 8-15 digits");
  return problem
    ? `This page also saves the site settings, and ${problem}. Open Settings and fix it there first.`
    : null;
}

/** The mirror image: what `/studio/settings` passes through for the SEO page. */
export function describePassedThroughSeo(seo: {
  title: string;
  description: string;
}): string | null {
  const over =
    seo.title.trim().length > SETTINGS_LIMITS.seoTitle
      ? `the default SEO title is over its ${SETTINGS_LIMITS.seoTitle}-character limit`
      : seo.description.trim().length > SETTINGS_LIMITS.seoDescription
        ? `the default SEO description is over its ${SETTINGS_LIMITS.seoDescription}-character limit`
        : null;
  return over
    ? `This page also saves the SEO defaults, and ${over}. Open SEO and fix it there first.`
    : null;
}
