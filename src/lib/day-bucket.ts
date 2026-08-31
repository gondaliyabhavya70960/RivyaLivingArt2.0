/**
 * Chart day-bucketing (closes the tracked UTC-vs-IST owner decision by
 * making it a SiteSettings toggle instead). Both studio chart surfaces
 * (dashboard, analytics) bucket inquiry timestamps into calendar days; the
 * boundary the owner thinks in is IST, the default stays UTC so nothing
 * changes until they flip the setting. IST is a fixed +05:30 — no DST — so
 * a constant offset is exact.
 */

export type ChartTimezone = "UTC" | "IST";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Narrow a stored settings string to a supported timezone (default UTC). */
export function asChartTimezone(
  value: string | null | undefined,
): ChartTimezone {
  return value === "IST" ? "IST" : "UTC";
}

/** YYYY-MM-DD key of the calendar day `date` falls in, per the timezone. */
export function dayKey(date: Date, tz: ChartTimezone): string {
  const shifted =
    tz === "IST" ? new Date(date.getTime() + IST_OFFSET_MS) : date;
  return shifted.toISOString().slice(0, 10);
}

/** Start instant (UTC) of "today" as the timezone sees it. */
export function startOfToday(tz: ChartTimezone, now = Date.now()): Date {
  if (tz === "UTC") {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  const shifted = new Date(now + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

/** Human note for chart captions ("IST day buckets"). */
export function bucketNote(tz: ChartTimezone): string {
  return tz === "IST" ? "IST day buckets" : "UTC day buckets";
}
