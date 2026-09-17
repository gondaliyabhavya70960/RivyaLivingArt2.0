import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { runReferenceRollout } from "../src/lib/scraper/backlog-rollout";
import {
  REFERENCE_MANUAL,
  REFERENCE_ROLLOUT,
} from "../src/lib/scraper/seed-data";

/**
 * The reference-site rollout, on deploy (the owner's 2026-09-16 instruction:
 * rebuild the emptied catalogue from the reference sites through the review
 * queue). Runs from bootstrap.ts right AFTER the registry reconcile, so the
 * rows it acts on exist. One-shot by construction — see
 * src/lib/scraper/backlog-rollout.ts for the three rules — and idempotent:
 * a second deploy finds every source reviewed or collected and changes
 * nothing.
 *
 * PREVIEW BUILDS SKIP IT. A preview runs against production; ten crawls of
 * other people's websites should start with the merge, not with the push.
 * The queued jobs are advanced by /api/cron/scrape-drain every ten minutes.
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("seed-scrape-backlog: DATABASE_URL not set — skipping.");
    return;
  }
  if (process.env.VERCEL_ENV === "preview") {
    console.log(
      "seed-scrape-backlog: preview build — not queueing crawls from a preview; the production build does.",
    );
    return;
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const summary = await runReferenceRollout(db, {
      rollout: REFERENCE_ROLLOUT,
      manual: REFERENCE_MANUAL,
    });
    const skipped = Object.entries(summary.skipped)
      .map(([key, why]) => `${key} (${why})`)
      .join(", ");
    console.log(
      `seed-scrape-backlog: queued ${summary.queued.length} first job(s) [${summary.queued.join(", ")}]; ` +
        `manual research ${summary.manual.length} [${summary.manual.join(", ")}]; ` +
        `skipped ${Object.keys(summary.skipped).length}${skipped ? ` [${skipped}]` : ""}; ` +
        `not registered ${summary.missing.length}${summary.missing.length ? ` [${summary.missing.join(", ")}]` : ""}.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  // Never fail the deploy on a rollout hiccup — the Studio's batch buttons
  // do the same job by hand.
  console.error("seed-scrape-backlog: failed (continuing build):", error);
});
