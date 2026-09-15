/**
 * Archive the Google Sheets sync history before it is dropped.
 *
 *   DATABASE_URL=… npx tsx scripts/export-sheets-history.ts
 *
 * Plan C (Sheets removal) phase 4, **step 1**, and the step that cannot be
 * undone if it is skipped: `SheetSyncRun` is push-side history that exists
 * nowhere else, and step 4's migration drops the table. `ImportConflict` is
 * NOT dropped — it survives the removal as the CSV importer's conflict queue —
 * but it is archived here too, because a conflict row read against a sync run
 * is how anyone would reconstruct what the spreadsheet did on a given day, and
 * that pairing stops being reconstructable the moment the runs are gone.
 *
 * Writes `docs/archive/sheets-YYYY-MM-DD/{sheet-sync-runs,import-conflicts}.csv`
 * and a `README.md` recording what the files are and what dropped them. Commit
 * the directory: the plan calls it "the only copy of the sync history", and an
 * archive that lives on the machine that ran the script is not an archive.
 *
 * Read-only. It opens a Prisma client, selects, and writes files — it does not
 * migrate, delete or alter anything, so it is safe to run more than once and
 * safe to run before you have decided whether to go ahead with the removal.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { toCsvDocument } from "@/lib/export/csv";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is required — this reads the live sync history.\n" +
      "  DATABASE_URL=… npx tsx scripts/export-sheets-history.ts",
  );
  process.exit(1);
}

// The same adapter shape as src/lib/db.ts and scripts/seed-demo.ts. Its own
// client is used rather than the app's singleton so this stays a plain script
// with no Next.js env validation to satisfy.
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

/** `null`/`undefined` → "", Date → ISO 8601, everything else → String(). */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function main(): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const dir = join("docs", "archive", `sheets-${day}`);
  mkdirSync(dir, { recursive: true });

  const runColumns = [
    "id",
    "direction",
    "tab",
    "rows",
    "status",
    "error",
    "startedAt",
    "finishedAt",
  ] as const;
  const runs = await db.sheetSyncRun.findMany({
    orderBy: { startedAt: "asc" },
  });
  writeFileSync(
    join(dir, "sheet-sync-runs.csv"),
    toCsvDocument(
      runColumns,
      runs.map((r) => runColumns.map((c) => cell(r[c]))),
    ),
    "utf8",
  );

  const conflictColumns = [
    "id",
    "productId",
    "importRunId",
    "field",
    "importedValue",
    "dbValue",
    "status",
    "createdAt",
    "resolvedAt",
    "resolvedById",
  ] as const;
  const conflicts = await db.importConflict.findMany({
    orderBy: { createdAt: "asc" },
  });
  writeFileSync(
    join(dir, "import-conflicts.csv"),
    toCsvDocument(
      conflictColumns,
      conflicts.map((c) => conflictColumns.map((k) => cell(c[k]))),
    ),
    "utf8",
  );

  writeFileSync(
    join(dir, "README.md"),
    [
      `# Google Sheets history — archived ${day}`,
      "",
      "Written by `scripts/export-sheets-history.ts` before plan C phase 4 dropped",
      "the Sheets schema. Do not delete: `sheet-sync-runs.csv` is the only copy.",
      "",
      `- **sheet-sync-runs.csv** — ${runs.length} row(s). The push-side history of`,
      "  every write this project made to the owner's spreadsheet. The",
      "  `SheetSyncRun` table was dropped; this file replaces it.",
      `- **import-conflicts.csv** — ${conflicts.length} row(s). A point-in-time copy of`,
      "  the CSV importer's conflict queue. That table was **not** dropped — it",
      "  survives as `ImportConflict` — so this file is a snapshot for reading",
      "  alongside the runs, not a replacement.",
      "",
      "Both are RFC-4180 CSV with a formula-injection guard, written through the",
      "same `toCsvDocument` the Studio's own exports use.",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`sheet-sync-runs.csv    ${runs.length} row(s)`);
  console.log(`import-conflicts.csv   ${conflicts.length} row(s)`);
  console.log(`→ ${dir}  — commit this directory.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
