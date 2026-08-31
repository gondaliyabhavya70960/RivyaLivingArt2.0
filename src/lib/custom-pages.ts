/**
 * Page-level rules for custom landing pages: when a page is live, what the
 * studio calls its state, and how a block's per-locale text is overlaid.
 *
 * Plain module, no server imports — the studio list, the storefront route and
 * the unit tests all read it.
 */

/** Fields `localize()` may override on a page row. */
export const CUSTOM_PAGE_TRANSLATABLE = [
  "title",
  "seoTitle",
  "seoDescription",
] as const;

/**
 * A page is live when the owner published it AND its moment has arrived.
 *
 * **Scheduling is resolved here, at read time, never by a cron.** A page whose
 * `publishAt` is 06:00 tomorrow is not live until 06:00 tomorrow, in every
 * query on this site. The cron only warms the cache at the boundary; if it
 * never ran, the page would still appear on time within the route's ISR
 * window. Correctness that depends on a scheduled job having fired is
 * correctness that fails quietly on the one morning it matters.
 */
export function isLive(
  page: { status: string; publishAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (page.status !== "PUBLISHED") return false;
  return page.publishAt == null || page.publishAt.getTime() <= now.getTime();
}

/** What the studio calls the page's state, derived rather than stored. */
export type ScheduleState = "draft" | "scheduled" | "live";

export function scheduleState(
  page: { status: string; publishAt: Date | null },
  now: Date = new Date(),
): ScheduleState {
  if (page.status !== "PUBLISHED") return "draft";
  return isLive(page, now) ? "live" : "scheduled";
}

/**
 * Overlay a block's per-locale text onto its data.
 *
 * `localize()` works on a row's own columns; a block's translatable text lives
 * inside `data`, so the overlay happens a level down. Same rules as
 * `localize`: a missing or empty override falls back to English, and an
 * override may never change a value's shape — a string field stays a string, a
 * Tiptap document stays an object. A translation that could change the shape
 * would let a translator take the renderer down.
 */
export function applyBlockTranslations(
  data: unknown,
  translations: unknown,
  locale: string,
): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  if (!translations || typeof translations !== "object") return data;
  const forLocale = (translations as Record<string, unknown>)[locale];
  if (!forLocale || typeof forLocale !== "object" || Array.isArray(forLocale)) {
    return data;
  }

  const base = data as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  for (const [field, value] of Object.entries(
    forLocale as Record<string, unknown>,
  )) {
    if (value === undefined || value === null) continue;
    const baseValue = base[field];
    if (typeof baseValue === "string" || baseValue === undefined) {
      if (typeof value !== "string" || value.trim() === "") continue;
    } else if (baseValue !== null && typeof baseValue === "object") {
      if (typeof value !== "object" || Array.isArray(value)) continue;
    } else {
      continue;
    }
    if (out === null) out = { ...base };
    out[field] = value;
  }
  return out ?? base;
}
