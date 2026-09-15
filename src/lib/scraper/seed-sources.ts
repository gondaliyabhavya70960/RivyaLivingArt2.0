import { db } from "@/lib/db";
import { SEED_SOURCES, seedSourceUpsertData, type SeedSource } from "./seed-data";

// The registry data now lives in seed-data.ts — a db-free module so the
// deploy-time prisma/seed-sources.ts script can import it under tsx without
// the @/ alias. Re-exported here so existing importers keep working.
export { SEED_SOURCES };
export type { SeedSource };

/**
 * Upsert every seed into ScrapeSource, keyed by `key`. A platform that was
 * verified live (verifiedAt set, platform ≠ UNKNOWN) is never overwritten by
 * the seed value, and user enable/disable choices survive re-seeding.
 * Shared by the seedScrapeSources action and the sources page's first-visit
 * auto-seed. Returns the number of sources upserted.
 */
export async function applySeedSources(): Promise<number> {
  const existing = await db.scrapeSource.findMany({
    where: { key: { in: SEED_SOURCES.map((s) => s.key) } },
    select: { key: true, platform: true, verifiedAt: true },
  });
  const byKey = new Map(existing.map((s) => [s.key, s]));

  await db.$transaction(
    SEED_SOURCES.map((seed) =>
      db.scrapeSource.upsert({
        where: { key: seed.key },
        ...seedSourceUpsertData(seed, byKey.get(seed.key)),
      }),
    ),
  );

  return SEED_SOURCES.length;
}
