/**
 * Whether an announcement is inside its scheduled window.
 *
 * Its own module because `site-settings.ts` is `server-only` and this is pure
 * date arithmetic — the repo's unit suite covers exactly this kind of function,
 * and a scheduling rule that decides what every visitor sees at the top of
 * every page deserves the cover.
 *
 * Either bound may be absent, meaning "no bound on that side" — so a strip with
 * neither behaves exactly as it did before scheduling existed.
 *
 * **Not second-accurate, by design.** The comparison runs per request, but the
 * page around it is ISR-cached — 300s on most routes and 86400s on a PDP — so a
 * strip switches on within the route's own revalidate window rather than on the
 * minute. That is right for "the Diwali message starts on the 3rd" and wrong
 * for "at 09:00 sharp". If the sharp version is ever needed, a cron that
 * expires SITE_SETTINGS_TAG at the boundary is the fix; scheduling the render
 * itself is not.
 */
export function announcementIsLive(
  window: { startsAt?: Date | null; endsAt?: Date | null },
  now: Date,
): boolean {
  if (window.startsAt && now < window.startsAt) return false;
  if (window.endsAt && now > window.endsAt) return false;
  return true;
}
