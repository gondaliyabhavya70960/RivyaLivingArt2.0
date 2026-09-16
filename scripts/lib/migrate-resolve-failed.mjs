/**
 * The guarded self-heal for P3009 — "migrate found failed migrations in the
 * target database".
 *
 * THE INCIDENT THIS ANSWERS. Vercel runs `npm run build` — and therefore
 * `migrate deploy` — for PREVIEW deployments too, against the production
 * database, and Vercel cancels a superseded preview build mid-flight. On
 * 2026-09-16 a cancelled preview died inside
 * `20260917090000_analytics_opportunity`; Prisma recorded the migration as
 * failed and refused every later deploy (the P3009 the production log showed
 * next). Nothing in that outcome needs a human's judgement — the human just
 * has to know it happened — IF the migration left nothing behind.
 *
 * THE GUARD, stated exactly. This repo's migrations are additive-only by
 * standing rule, and a table is the root object of every additive change
 * here: an index or a constraint cannot exist without its table, and
 * CREATE EXTENSION is idempotent. So when the failed migration's own SQL
 * names CREATE TABLEs and NONE of those tables exist in the database, the
 * migration provably applied nothing durable, and marking it rolled-back is
 * not a judgement call — it is a fact check. Anything else (a table exists,
 * or the migration creates no table we can check — an ALTER might have
 * half-applied a column) stops the build with the manual commands, exactly
 * as before.
 *
 * What this deliberately never does: resolve --applied. Whether a partial
 * application is "close enough to done" is a human's call, every time.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The failed-migration names from P3009 output — one or several. */
export function failedMigrationNames(output) {
  const text = String(output ?? "");
  const names = [];
  const re = /The `([^`]+)` migration started at [^\n]* failed/g;
  let match;
  while ((match = re.exec(text)) !== null) names.push(match[1]);
  return names;
}

/**
 * The tables a migration creates — `CREATE TABLE [IF NOT EXISTS] "Name"` or
 * the bare-word spelling. Additive migrations create their tables before the
 * indexes and constraints that depend on them, so this list is the complete
 * set of root objects the migration can leave behind.
 */
export function tablesCreatedBy(migrationSql) {
  const text = String(migrationSql ?? "");
  const names = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|(\w+))/gi;
  let match;
  while ((match = re.exec(text)) !== null) names.push(match[1] ?? match[2]);
  return [...new Set(names)];
}

/** The exact manual resolution, printed when the guard cannot prove the
 *  failed migration left nothing behind. Written for the build log — the
 *  only place anyone will read it. */
export function manualResolveInstructions(name, existingTables) {
  return [
    `migrate-deploy: NOT auto-resolving — the failed migration's footprint is not provably empty.`,
    existingTables.length > 0
      ? `  Tables it created that EXIST in the database: ${existingTables.join(", ")}`
      : "  The migration creates no table this guard can check (an ALTER may have half-applied).",
    "  Resolve it by hand, against the production DATABASE_URL:",
    `    1. npx prisma migrate status                      # see the failed record`,
    `    2. psql "$DATABASE_URL" -c '\\dt "AnalyticsSnapshot"'   # and any other table it creates`,
    `    3. If the tables exist:  drop them (they are partial) — DROP TABLE IF EXISTS ...;`,
    `       If the migration's work is actually ALL present and correct instead, skip to 4 with --applied.`,
    `    4. npx prisma migrate resolve --rolled-back ${name}   # or --applied, per step 3`,
    `    5. Redeploy — the migration re-applies from scratch.`,
  ].join("\n");
}

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../prisma/migrations", import.meta.url),
);

/** The migration's own SQL from the repo, or null when the name is not a
 *  migration directory we carry (a failed record from a deleted branch's
 *  migration is a human problem, not a guard's). */
export function readMigrationSql(name) {
  if (!/^[\w-]+$/.test(name)) return null; // a name is a directory, nothing else
  try {
    return readFileSync(`${MIGRATIONS_DIR}/${name}/migration.sql`, "utf8");
  } catch {
    return null;
  }
}
