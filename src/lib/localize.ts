import { defaultLocale, locales } from "@/i18n/config";

/**
 * Per-locale content overrides live in a nullable `translations` JSON column on
 * Product / Category / BlogPost / Portfolio / Faq / Testimonial / Page, shaped
 *   { [locale]: { [field]: value } }
 * The base row is the default locale (English). This module resolves the value
 * for the active locale with fallback to the base, so the public site can
 * localize catalog content unconditionally (I3).
 */

type LocaleFieldMap = Record<string, Record<string, unknown>>;

function asLocaleMap(value: unknown): LocaleFieldMap | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LocaleFieldMap)
    : null;
}

/**
 * Return `entity` with `fields` overridden by its `translations[locale]` entry,
 * falling back to the base value when a translation is missing, empty, or the
 * wrong shape. A no-op for the default locale or when nothing is stored (returns
 * the same reference), so it is safe to call on every render.
 */
export function localize<T extends { translations?: unknown }>(
  entity: T,
  locale: string,
  fields: readonly (keyof T)[],
): T {
  if (locale === defaultLocale) return entity;
  const forLocale = asLocaleMap(entity.translations)?.[locale];
  if (!forLocale) return entity;

  let out: T | null = null;
  for (const field of fields) {
    const value = forLocale[field as string];
    if (value === undefined || value === null) continue;
    const base = entity[field];
    // A string field only accepts a non-empty string; a structured field (e.g.
    // Tiptap `content`) only accepts an object — never let a translation change
    // a value's shape out from under the renderer.
    if (typeof base === "string") {
      if (typeof value !== "string" || value.trim() === "") continue;
    } else if (Array.isArray(base)) {
      // Positional overrides resolve per row, not by swapping the array —
      // a partial translation must not delete the rows it did not cover.
      // `localizeLexical` owns that; this generic path leaves it alone.
      continue;
    } else if (base !== null && typeof base === "object") {
      if (typeof value !== "object") continue;
    }
    if (out === null) out = { ...entity };
    (out as Record<string, unknown>)[field as string] = value;
  }
  return out ?? entity;
}

/**
 * The reader-facing name of a blog category or tag in the active locale.
 *
 * These two labels render in eight places across three pages, and every one of
 * them wants the same one-line answer. `translations` is selected alongside
 * `name` at each query — a taxonomy row is two short strings, so the extra
 * column costs nothing next to the round trip.
 */
export function localizeName<
  T extends { name: string; translations?: unknown },
>(row: T, locale: string): string {
  return localize(row, locale, ["name"]).name;
}

/** One owner-authored voice line on the product spec sheet. */
export type LexicalRow = { label: string; value: string };

/**
 * Read a stored `lexical` blob into rows, dropping anything malformed.
 *
 * Total: the column is free-form JSON, so a hand-edited row, a half-written
 * import or a translation typed into the wrong shape must render as fewer
 * rows, never as a crash on a product page.
 */
export function lexicalRows(value: unknown): LexicalRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const { label, value: text } = row as Record<string, unknown>;
    if (typeof label !== "string" || typeof text !== "string") return [];
    return label.trim() && text.trim()
      ? [{ label: label.trim(), value: text.trim() }]
      : [];
  });
}

/**
 * The spec sheet's voice lines in the active locale.
 *
 * Resolved PER ROW AND PER FIELD rather than by swapping the whole array: an
 * owner who translates the labels but not the values — or three rows of five —
 * gets exactly what they typed, with English underneath. Swapping wholesale
 * would make a partial translation delete the rows it did not cover.
 *
 * Rows are matched by position, which is what the editor shows: each block is
 * pinned to the English row above it. A translation longer than the base is
 * ignored, because there is no English row for it to be a translation OF.
 */
export function localizeLexical(
  entity: { lexical?: unknown; translations?: unknown },
  locale: string,
): LexicalRow[] {
  const base = lexicalRows(entity.lexical);
  if (locale === defaultLocale || base.length === 0) return base;

  const forLocale = asLocaleMap(entity.translations)?.[locale];
  const overlay = forLocale?.lexical;
  if (!Array.isArray(overlay)) return base;

  return base.map((row, i) => {
    const candidate = overlay[i];
    if (!candidate || typeof candidate !== "object") return row;
    const { label, value } = candidate as Record<string, unknown>;
    const nextLabel =
      typeof label === "string" && label.trim() ? label.trim() : row.label;
    const nextValue =
      typeof value === "string" && value.trim() ? value.trim() : row.value;
    return nextLabel === row.label && nextValue === row.value
      ? row
      : { label: nextLabel, value: nextValue };
  });
}

/** Non-default locales content can be translated into (English is the base). */
export const translatableLocales = locales.filter((l) => l !== defaultLocale);

/** A Tiptap document object (rich-text `content`), as opposed to a plain string. */
function isTiptapDoc(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "type" in value
  );
}

/** An empty rich-text doc: no content, or a single blank paragraph. */
function isEmptyDoc(doc: Record<string, unknown>): boolean {
  const content = doc.content;
  if (!Array.isArray(content) || content.length === 0) return true;
  if (content.length === 1) {
    const only = content[0] as Record<string, unknown> | undefined;
    if (only?.type === "paragraph" && !("content" in only)) return true;
  }
  return false;
}

/**
 * Sanitize a raw translations payload from the studio into the stored shape
 * `{ [locale]: { [field]: value } }`. Only known non-default locales and the
 * given `fields` survive; string values are trimmed and empties dropped; a
 * rich-text field is kept only when it is a non-empty Tiptap doc. Locales that
 * end up empty are dropped, and the whole thing collapses to `null` when
 * nothing remains — so the DB column stays clean and the read side no-ops.
 *
 * Pure and client-safe (no Prisma import); callers map `null` to the DB's null
 * sentinel themselves.
 */
export function normalizeTranslations(
  input: unknown,
  fields: readonly string[],
): Record<string, Record<string, unknown>> | null {
  const map = asLocaleMap(input);
  if (!map) return null;
  const out: Record<string, Record<string, unknown>> = {};
  for (const locale of translatableLocales) {
    const forLocale = map[locale];
    if (!forLocale || typeof forLocale !== "object") continue;
    const source = forLocale as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const field of fields) {
      const value = source[field];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) cleaned[field] = trimmed;
      } else if (isTiptapDoc(value) && !isEmptyDoc(value)) {
        cleaned[field] = value;
      } else if (Array.isArray(value)) {
        // Positional overrides (today: `lexical`). Entries are kept SPARSE —
        // a row translated at index 2 must stay at index 2, so a blank row is
        // stored as null rather than dropped, which would shift every row
        // after it onto the wrong English line.
        const rows = value.map((row) => {
          if (!row || typeof row !== "object") return null;
          const { label, text } = {
            label: (row as Record<string, unknown>).label,
            text: (row as Record<string, unknown>).value,
          };
          const nextLabel = typeof label === "string" ? label.trim() : "";
          const nextValue = typeof text === "string" ? text.trim() : "";
          return nextLabel || nextValue
            ? { label: nextLabel, value: nextValue }
            : null;
        });
        // Trailing blanks carry no information — drop them so an untouched
        // language does not persist an array of nulls.
        while (rows.length > 0 && rows[rows.length - 1] === null) rows.pop();
        if (rows.length > 0) cleaned[field] = rows;
      }
    }
    if (Object.keys(cleaned).length > 0) out[locale] = cleaned;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Field sets that are translatable per model — the single source callers share. */
export const TRANSLATABLE_FIELDS = {
  product: [
    "title",
    "displayName",
    "shortTagline",
    "description",
    "careNotes",
    "seoTitle",
    "seoDescription",
    /** Owner-authored label/value voice lines — an ARRAY, not a string; see
        `localizeLexical` for how a partial translation resolves. */
    "lexical",
  ],
  /** What a product CARD renders. A card has no spec sheet and no SEO tags,
      and its query selects neither — asking for them would be a type error
      rather than a silent miss, which is the point of keeping this separate. */
  productCard: ["title", "displayName", "shortTagline"],
  category: ["name", "description"],
  blogPost: ["title", "excerpt", "content", "seoTitle", "seoDescription"],
  portfolio: ["title", "story", "brief", "process", "clientNote", "location"],
  faq: ["question", "answer"],
  /** The customer's name is never translated — only their words, place, the
      line under their name and (when they wrote no catalogue product) what
      they said they bought. */
  testimonial: ["quote", "location", "designation", "productTitle"],
  page: ["title", "content"],
  /** A taxonomy label is one word to a reader and a URL to everything else —
      the slug is deliberately not translatable. */
  blogCategory: ["name"],
  tag: ["name"],
} as const;
