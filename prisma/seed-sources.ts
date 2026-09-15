import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  SEED_SOURCES,
  seedSourceUpsertData,
} from "../src/lib/scraper/seed-data";

/**
 * Deploy-time reconcile of the curated scrape-source registry. Runs on EVERY
 * build (from bootstrap.ts, after `prisma migrate deploy`), unlike the base
 * seed which only runs on an empty DB. This is what makes the full curated
 * list show up automatically after every deploy without anyone pasting URLs.
 *
 * The payload comes from `seedSourceUpsertData`, shared with
 * `applySeedSources` — this file used to carry its own hand-copy under a
 * comment promising it "mirrors applySeedSources exactly", and that stopped
 * being true the moment a column was added to one of them. The rule now lives
 * in one place, in a db-free module both callers can reach.
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
      await db.scrapeSource.upsert({
        where: { key: seed.key },
        ...seedSourceUpsertData(seed, byKey.get(seed.key)),
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
