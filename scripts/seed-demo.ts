import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { describeDemoHost } from "../src/lib/demo/guard";
import { seedDemo, removeDemo, demoStatus } from "../src/lib/demo/apply";

/**
 * Content Lab CLI — `npm run seed:demo [-- --remove | --status] [--allow-production]`.
 *
 * Loads and writes 400+ demo rows across every content table, which is
 * harmless on a throwaway database and would be a real incident on the
 * production one. `describeDemoHost` is asked BEFORE anything else runs, and
 * the host it found is always printed — a `--status` call included, so a
 * confused operator sees the same host that a write would have refused.
 *
 * A refusal on a production-looking host can be overridden only by passing
 * `--allow-production` AND then typing the exact phrase "DEMO INTO
 * PRODUCTION" at an interactive prompt. A non-interactive shell (CI, a piped
 * command) has no prompt to answer, so it refuses outright — there is no
 * environment variable that skips the phrase.
 */

const CONFIRM_PHRASE = "DEMO INTO PRODUCTION";

function parseArgs(argv: string[]) {
  return {
    remove: argv.includes("--remove"),
    status: argv.includes("--status"),
    allowProduction: argv.includes("--allow-production"),
  };
}

async function confirmProductionWrite(host: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      "refusing: this shell is not interactive, so the typed confirmation cannot be collected.",
    );
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.warn(`\n⚠ ${host} does not look like a local or CI database.`);
    console.warn(
      `Type exactly "${CONFIRM_PHRASE}" to continue, or anything else to cancel.\n`,
    );
    const answer = await rl.question("> ");
    return answer.trim() === CONFIRM_PHRASE;
  } finally {
    rl.close();
  }
}

async function main() {
  const { remove, status, allowProduction } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  const info = describeDemoHost(url);
  console.log(`Content Lab: target database → ${info.host}`);

  if (status) {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    const result = await demoStatus(db);
    await db.$disconnect();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (info.production) {
    if (!allowProduction) {
      console.error(
        `refusing: ${info.host} looks like production and --allow-production was not passed.`,
      );
      process.exit(1);
    }
    const confirmed = await confirmProductionWrite(info.host);
    if (!confirmed) {
      console.error(
        "refusing: confirmation did not match. Nothing was written.",
      );
      process.exit(1);
    }
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    if (remove) {
      console.log("Removing every demo row…");
      const counts = await removeDemo(db);
      console.log("Removed. Remaining demo counts (should all be zero):");
      console.log(JSON.stringify(counts, null, 2));
    } else {
      console.log("Seeding Content Lab fixtures…");
      const counts = await seedDemo(db, { log: (m) => console.log(`  ${m}`) });
      console.log("Seeded. Demo counts:");
      console.log(JSON.stringify(counts, null, 2));
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
