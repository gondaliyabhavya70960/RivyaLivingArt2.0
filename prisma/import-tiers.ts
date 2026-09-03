import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  DEFAULT_FILL_POLICY,
  decideFillRun,
  type FillPolicy,
} from "../src/lib/import/fill-policy";
import { runTierFill } from "../src/lib/import/tier-fill";

/**
 * Deploy-time caller for the four-tier owner-sheet import. All the actual
 * logic — reading the tabs, normalizing rows, the H5 merge protection, the
 * blast-radius cap, conflict detection, the OwnerImportReady batch — lives
 * in `src/lib/import/tier-fill.ts`'s `runTierFill()`, so this script, the
 * studio's Preview button and its Run now button all call exactly one
 * implementation rather than three that can drift apart. This file's job is
 * just: read the owner's settings, build the policy, run it once with
 * trigger "DEPLOY".
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("import-tiers: DATABASE_URL not set — skipping.");
    return;
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    // Phase 7: the owner's switch. This importer has run on every deploy
    // since it was written. It still does; the defaults below reproduce
    // that exactly, so a fresh environment self-populates from the sheet on
    // first boot as it always has. A missing settings row IS the
    // fresh-environment case, and it fills.
    const settings = await db.siteSettings.findUnique({
      where: { id: "main" },
      select: {
        sheetFillEnabled: true,
        sheetFillOnDeploy: true,
        sheetFillMaxCreates: true,
      },
    });
    const policy: FillPolicy = settings
      ? {
          enabled: settings.sheetFillEnabled,
          onDeploy: settings.sheetFillOnDeploy,
          maxCreates: settings.sheetFillMaxCreates,
        }
      : DEFAULT_FILL_POLICY;

    const gate = decideFillRun("DEPLOY", policy);
    if (!gate.run) {
      console.log(`import-tiers: skipped — ${gate.reason}`);
      await db.importRun.create({
        data: {
          trigger: "DEPLOY",
          abortedReason: gate.reason,
          finishedAt: new Date(),
        },
      });
      return;
    }

    const result = await runTierFill({ trigger: "DEPLOY", policy, db });
    if (result.aborted) {
      console.error(`import-tiers: ABORTED — ${result.aborted.reason}`);
      return;
    }
    if (result.conflictsWritten > 0) {
      console.log(
        `import-tiers: ${result.conflictsWritten} sheet/studio conflict(s) recorded — review at /studio/sheet-import/conflicts.`,
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("import-tiers: fatal:", error);
  process.exitCode = 1;
});
