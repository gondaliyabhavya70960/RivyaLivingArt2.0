#!/usr/bin/env node
/**
 * ALT-BACKFILL — write reviewed alt text into the media library, batch by
 * batch, against the Q2 backlog (2,854 files with no description).
 *
 * DRY RUN IS THE DEFAULT — the same owner-safety pattern as
 * `scripts/seed-starter.ts`: read the plan first, then `--apply` to write.
 *
 *   npx tsx scripts/alt-backfill.ts docs/alt-backfill/batch-01-bundled.json
 *   npx tsx scripts/alt-backfill.ts docs/alt-backfill/batch-01-bundled.json --apply
 *
 * The batch file is REVIEWED INPUT, not generated output: each entry is
 * { "match": "<pathname | url suffix | basename>", "alt": "<description>" }.
 * Matching is exact pathname, then URL suffix, then identical basename; an
 * ambiguous basename is SKIPPED and reported — writing the wrong picture's
 * alt is worse than leaving it empty.
 *
 * Guards, all reported, none silent:
 *   - entries fail validation (empty, medium-words, filename inside, >300)
 *     are refused and listed — the run exits 1 even in dry-run
 *   - only IMAGE rows are touched (video/3D/documents skipped)
 *   - a row that already HAS an alt is never overwritten (skipped-existing)
 *   - every write is one update per row, and the report counts each outcome
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { checkAlt, matchMediaRow } from "./lib/alt-backfill.mjs";

const APPLY = process.argv.includes("--apply");
const batchPath = process.argv.find(
  (arg) => arg.endsWith(".json") && !arg.startsWith("--"),
);

if (!batchPath) {
  console.error(
    "Usage: npx tsx scripts/alt-backfill.ts <batch.json> [--apply]\n" +
      "Batch entries: [{ \"match\": \"<pathname|url-suffix|basename>\", \"alt\": \"<description>\" }]",
  );
  process.exit(1);
}

const entries = JSON.parse(readFileSync(path.resolve(batchPath as string), "utf8"));
if (!Array.isArray(entries)) {
  console.error("Batch file must be a JSON array of { match, alt } entries.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const counts: Record<string, number> = {
  entries: entries.length,
  invalid: 0,
  unmatched: 0,
  ambiguous: 0,
  skippedExisting: 0,
  skippedNonImage: 0,
  applied: 0,
};
const failures: string[] = [];
const notes: string[] = [];

async function main() {
  console.log(
    `Alt-backfill: ${path.basename(batchPath as string)} · ${entries.length} entries · ${APPLY ? "APPLY" : "DRY RUN"}`,
  );

  // 1 · validate every entry BEFORE any matching — a bad batch stops here.
  for (const [index, entry] of entries.entries()) {
    if (
      !entry ||
      typeof entry.match !== "string" ||
      typeof entry.alt !== "string"
    ) {
      counts.invalid += 1;
      failures.push(`#${index}: malformed entry (needs { match, alt })`);
      continue;
    }
    const verdict = checkAlt(entry.alt);
    if (verdict?.startsWith("FAIL")) {
      counts.invalid += 1;
      failures.push(`${entry.match}: ${verdict}`);
    } else if (verdict?.startsWith("NOTE")) {
      notes.push(`${entry.match}: ${verdict}`);
    }
  }
  if (counts.invalid > 0) {
    for (const failure of failures) console.error(`FAIL  ${failure}`);
    console.error(
      `\n${counts.invalid} invalid entr${counts.invalid === 1 ? "y" : "ies"} — fix the batch and re-run. Nothing was written.`,
    );
    process.exit(1);
  }

  // 2 · match against the library.
  const rows = await db.media.findMany({
    select: { id: true, pathname: true, url: true, type: true, alt: true },
  });
  const plan = [];
  for (const entry of entries) {
    const found = matchMediaRow(rows, entry.match);
    if (!found) {
      counts.unmatched += 1;
      notes.push(`unmatched: ${entry.match}`);
      continue;
    }
    if ("ambiguous" in found) {
      counts.ambiguous += 1;
      notes.push(
        `ambiguous: ${entry.match} → ${found.ambiguous.join(" · ")} (skipped)`,
      );
      continue;
    }
    const row = found.row as {
      id: string;
      pathname: string;
      type: string;
      alt: string | null;
    };
    if (row.type !== "IMAGE") {
      counts.skippedNonImage += 1;
      continue;
    }
    if (row.alt && row.alt.trim() !== "") {
      counts.skippedExisting += 1;
      continue;
    }
    plan.push({ id: row.id, pathname: row.pathname, alt: entry.alt.trim() });
  }

  console.log(
    `Plan: ${plan.length} to write · ${counts.unmatched} unmatched · ${counts.ambiguous} ambiguous · ${counts.skippedExisting} already described · ${counts.skippedNonImage} non-image`,
  );

  // 3 · apply (only with --apply).
  if (APPLY) {
    for (const item of plan) {
      await db.media.update({
        where: { id: item.id },
        data: { alt: item.alt },
      });
    }
    counts.applied = plan.length;
    console.log(`Applied ${counts.applied} descriptions.`);
  } else {
    console.log("\nDRY RUN — nothing was written. Re-run with --apply.");
    for (const item of plan.slice(0, 10)) {
      console.log(`  ${item.pathname}\n    → ${item.alt}`);
    }
    if (plan.length > 10) console.log(`  …and ${plan.length - 10} more`);
  }

  for (const note of notes) console.log(`NOTE  ${note}`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});