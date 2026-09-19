import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { applyStarterContent } from "../src/lib/starter/apply";
import { loadStarterFixtures } from "../src/lib/starter/fixtures";

/**
 * Starter content CLI — `npm run seed:starter [-- --apply] [-- --draft]`.
 *
 * DRY RUN IS THE DEFAULT AND THERE IS NO PROMPT TO SKIP IT. Unlike the
 * Content Lab CLI beside it, this one is MEANT to be pointed at production —
 * that is the whole purpose — so the safety is not a host guard, it is that
 * nothing is written unless `--apply` is passed, and that the writer itself
 * cannot modify a row that already exists.
 *
 * `--draft` seeds the FAQs unpublished. The default publishes them, because
 * the live FAQ page has six questions and leaving forty in DRAFT would mean
 * the owner publishing them one at a time to get the thing they asked for.
 */

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes("--apply"),
    draft: argv.includes("--draft"),
  };
}

async function main() {
  const { apply, draft } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const host = (() => {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname}`;
    } catch {
      return "(unparseable)";
    }
  })();

  const fixtures = loadStarterFixtures();
  console.log(`Starter content: target database → ${host}`);
  console.log(
    `Fixtures: ${fixtures.faqs.length} FAQs · ${fixtures.concepts.length} concept studies · ${fixtures.research.length} research records`,
  );
  if (!apply) {
    console.log("\nDRY RUN — nothing will be written. Pass --apply to write.\n");
  } else {
    console.log(
      `\nAPPLYING. FAQs will be created as ${draft ? "DRAFT" : "PUBLISHED"}; concept studies are always DRAFT.\n`,
    );
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const report = await applyStarterContent(db, fixtures, {
      apply,
      publishFaqs: !draft,
    });

    for (const outcome of report.byEntity) {
      const verb = apply ? "created" : "would create";
      console.log(
        `${outcome.entity.padEnd(15)} ${String(outcome.created).padStart(4)} ${verb} · ${outcome.skipped} already present`,
      );
      // Naming the skips is the point of the dry run: "23 already present" is
      // only reassuring if you can see WHICH 23.
      for (const key of outcome.skippedKeys.slice(0, 5)) {
        console.log(`                     skipped: ${key.slice(0, 80)}`);
      }
      if (outcome.skippedKeys.length > 5) {
        console.log(
          `                     …and ${outcome.skippedKeys.length - 5} more`,
        );
      }
    }
    console.log(
      `\nTotal: ${report.created} ${apply ? "created" : "to create"} · ${report.skipped} left untouched.`,
    );
    if (!apply && report.created > 0) {
      console.log("Re-run with --apply to write them.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
