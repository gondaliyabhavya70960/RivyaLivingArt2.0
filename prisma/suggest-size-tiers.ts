import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  applySizeTierBackfill,
  describeSizeTierCounts,
  planSizeTierBackfill,
  summarizeSizeTierPlan,
} from "../src/lib/catalog-size-tier-backfill";

/**
 * File the untiered catalogue backlog by rule, on deploy (docs/plan/07
 * step 3, worked). Runs from bootstrap.ts AFTER the CSV fill, so a row the
 * fill created seconds earlier is filed in the same deploy — the fill
 * creates products already PUBLISHED, past the form's publish refusal, and
 * this is the only path by which those rows ever get a tier without a
 * person working the backlog by hand.
 *
 * NON-DESTRUCTIVE and IDEMPOTENT: only rows with no tier, never a row a
 * person has edited, never a demo row; the rule and the reasons live in
 * src/lib/catalog-size-tier.ts and the "which rows" contract in
 * src/lib/catalog-size-tier-backfill.ts. Supplies stay untiered on purpose.
 *
 * PREVIEW BUILDS SKIP IT. Vercel runs bootstrap for preview deployments
 * against the production database; a classification a person may want to
 * see first (the PR shows the local numbers) should land with the merge,
 * from the production build, not from the push. Local and CI runs (no
 * VERCEL_ENV) file their own databases, which is how the numbers in the PR
 * were produced and how CI exercises this script every run.
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("suggest-size-tiers: DATABASE_URL not set — skipping.");
    return;
  }
  if (process.env.VERCEL_ENV === "preview") {
    console.log(
      "suggest-size-tiers: preview build — not filing tiers in the shared database; the production build does.",
    );
    return;
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const plan = await planSizeTierBackfill(db);
    const summary = summarizeSizeTierPlan(plan);
    const left = `${plan.skipped.supplies} supplies or workshops, ${plan.skipped.unsure} unsure`;
    if (summary.total === 0) {
      console.log(
        `suggest-size-tiers: nothing to file (${plan.scanned} untiered row(s) scanned: ${left}).`,
      );
      return;
    }
    const result = await applySizeTierBackfill(db, plan, { source: "deploy" });
    console.log(
      `suggest-size-tiers: filed ${result.total} untiered product(s) — ${describeSizeTierCounts(result.updated)}; ` +
        `left untiered: ${left}. Owner-edited rows are never touched.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("suggest-size-tiers: failed:", error);
  process.exit(1);
});
