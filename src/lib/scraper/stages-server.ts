import "server-only";

import { db } from "@/lib/db";
import { shapeStageCounts, type ScrapeStage } from "@/lib/scraper/stages";

/**
 * The nine stage counts, one query each, run in parallel. `database` is
 * injectable (defaults to the real client) purely so this stays swappable —
 * the pure shaping it delegates to is what's unit-tested (`stages.test.ts`).
 */
export async function countScrapeStages(
  database: typeof db = db,
): Promise<ScrapeStage[]> {
  const [
    sources,
    discovery,
    scraping,
    staged,
    quality,
    review,
    approved,
    imported,
    confirmed,
  ] = await Promise.all([
    database.scrapeSource.count(),
    database.scrapeSource.count({ where: { platform: "UNKNOWN" } }),
    database.scrapeJob.count({
      where: { status: { in: ["QUEUED", "RUNNING"] } },
    }),
    database.scrapedProduct.count(),
    database.validationFailure.count({
      where: { status: { in: ["OPEN", "REVIEWING"] } },
    }),
    database.scrapedProduct.count({ where: { reviewStatus: "PENDING" } }),
    database.scrapedProduct.count({ where: { reviewStatus: "APPROVED" } }),
    database.scrapedProduct.count({ where: { reviewStatus: "IMPORTED" } }),
    database.product.count({ where: { confirmedAt: { not: null } } }),
  ]);

  return shapeStageCounts({
    sources,
    discovery,
    scraping,
    staged,
    quality,
    review,
    approved,
    imported,
    confirmed,
  });
}
