import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SEED_SOURCES } from "../src/lib/scraper/seed-data";

/**
 * Deploy-time reconcile of the curated scrape-source registry. Runs on EVERY
 * build (from bootstrap.ts, after `prisma migrate deploy`), unlike the base
 * seed which only runs on an empty DB. Mirrors applySeedSources exactly:
 * idempotent upsert by `key`, a live-verified platform is never downgraded,
 * and the owner's enable/disable choices survive (the update never touches
 * `enabled`). This is what makes the full curated list show up automatically
 * after every deploy without anyone pasting URLs.
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("seed-sources: DATABASE_URL not set — skipping.");
    return;
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const existing = await db.scrapeSource.findMany({
      where: { key: { in: SEED_SOURCES.map((s) => s.key) } },
      select: { key: true, platform: true, verifiedAt: true },
    });
    const byKey = new Map(existing.map((s) => [s.key, s]));

    let upserted = 0;
    for (const seed of SEED_SOURCES) {
      const current = byKey.get(seed.key);
      const keepVerifiedPlatform =
        current !== undefined &&
        current.verifiedAt !== null &&
        current.platform !== "UNKNOWN";

      await db.scrapeSource.upsert({
        where: { key: seed.key },
        create: {
          key: seed.key,
          name: seed.name,
          baseUrl: seed.baseUrl,
          tier: seed.tier,
          vertical: seed.vertical,
          country: seed.country,
          platform: seed.platform,
          supply: seed.supply,
          enabled: seed.enabled,
          notes: seed.notes ?? null,
        },
        update: {
          name: seed.name,
          baseUrl: seed.baseUrl,
          tier: seed.tier,
          vertical: seed.vertical,
          country: seed.country,
          supply: seed.supply,
          ...(seed.notes !== undefined ? { notes: seed.notes } : {}),
          ...(keepVerifiedPlatform ? {} : { platform: seed.platform }),
        },
      });
      upserted += 1;
    }

    console.log(`seed-sources: reconciled ${upserted} scrape sources.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  // Never fail the deploy on a registry hiccup — the site still boots.
  console.error("seed-sources: reconcile failed (continuing build):", error);
});
