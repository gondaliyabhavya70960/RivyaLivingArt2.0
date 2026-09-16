/**
 * The database half of the league guard (B6), kept apart from the pure
 * vocabulary in `leagues.ts` so that file stays importable from client
 * components and unit tests.
 *
 * The league lives on `ScrapeSource`, but snapshots hang off
 * `ResearchProduct.sourceKey` — a plain string, not a relation — so the
 * guard is a two-step: resolve the league to its source keys here, then
 * filter with `snapshotWhereForLeague` / `variantWhereForLeague`.
 */
import type { AnalyticsLeague } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/** Keys of every source currently classified in a league. */
export async function sourceKeysForLeague(
  league: AnalyticsLeague,
): Promise<string[]> {
  const rows = await db.scrapeSource.findMany({
    where: { analyticsLeague: league },
    select: { key: true },
  });
  return rows.map((r) => r.key);
}
