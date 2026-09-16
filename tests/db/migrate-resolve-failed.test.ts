import { readdirSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import {
  decideResolution,
  healFailedMigration,
  inspectFootprint,
  migrationChecksum,
  nothingOwned,
  parseMigrationFootprint,
  readMigrationSql,
} from "../../scripts/lib/migrate-resolve-failed.mjs";

/**
 * The P3009 guard against a real Postgres catalog.
 *
 * The unit suite proves the decision table over a catalog derived from the
 * migrations' own SQL; only a database can prove the READER — that
 * `information_schema`, `pg_indexes`, `pg_get_constraintdef` and `pg_enum`
 * come back in the shape the comparison expects, defaults and casts and
 * all — and that the heal's transaction, lock, record change and read-back
 * work against the real `_prisma_migrations` table, including two builds
 * arriving at once. So: every additive migration in the repo since the
 * last rename must read back as exactly applied on the migrated test
 * database, and a probe migration is applied, mutated, recorded failed and
 * healed for real.
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const db = await getTestDb();

const PROBE = "99990101000000_guard_probe";
const PROBE_SQL = `
CREATE TYPE "GuardProbeKind" AS ENUM ('A', 'B');
CREATE TABLE "GuardProbe" (
  "id"    TEXT PRIMARY KEY,
  "kind"  "GuardProbeKind" NOT NULL DEFAULT 'A',
  "n"     INTEGER NOT NULL DEFAULT 0,
  "note"  TEXT,
  "when"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tags"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "meta"  JSONB NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX "GuardProbe_kind_n_key" ON "GuardProbe"("kind", "n");
CREATE INDEX "GuardProbe_when_idx" ON "GuardProbe"("when");
CREATE TABLE "GuardProbeChild" (
  "id"      TEXT PRIMARY KEY,
  "probeId" TEXT NOT NULL
);
ALTER TABLE "GuardProbeChild"
  ADD CONSTRAINT "GuardProbeChild_probeId_fkey"
  FOREIGN KEY ("probeId") REFERENCES "GuardProbe"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
`;

/** A table the probe migration does NOT create, pointing at one it does —
 *  the ShortlistEntry shape of the 2026-09-16 incident. */
const OUTSIDER_SQL = `
CREATE TABLE "GuardProbeOutsider" ("id" TEXT PRIMARY KEY, "probeId" TEXT);
ALTER TABLE "GuardProbeOutsider"
  ADD CONSTRAINT "GuardProbeOutsider_probeId_fkey"
  FOREIGN KEY ("probeId") REFERENCES "GuardProbe"("id") ON DELETE SET NULL;
`;

const CLEANUP = `
DROP TABLE IF EXISTS "GuardProbeOutsider";
DROP TABLE IF EXISTS "GuardProbeChild";
DROP TABLE IF EXISTS "GuardProbe";
DROP TYPE IF EXISTS "GuardProbeKind";
DELETE FROM _prisma_migrations WHERE migration_name = '${PROBE}';
`;

describe.skipIf(!db)("the P3009 guard against a real catalog", () => {
  let client: Client;
  const query = async (text: string, params: unknown[] = []) =>
    (await client.query(text, params)).rows;
  const options = { ownedElsewhere: nothingOwned() };
  const decide = async (sql: string) => {
    const footprint = parseMigrationFootprint(sql);
    return decideResolution(
      footprint,
      await inspectFootprint(query, footprint),
      options,
    );
  };
  const markFailed = () =>
    query(
      `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, 'guard-probe', $1, now(), 0)`,
      [PROBE],
    );
  const heal = (c: Client) =>
    healFailedMigration({
      client: c,
      name: PROBE,
      footprint: parseMigrationFootprint(PROBE_SQL),
      sql: PROBE_SQL,
      log,
      ownedElsewhere: nothingOwned(),
    });
  const logs: string[] = [];
  const log = (line: string) => logs.push(line);

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(CLEANUP);
  });

  afterAll(async () => {
    await client.query(CLEANUP).catch(() => {});
    await client.end();
  });

  it("reads every additive migration since the last rename back as exactly applied — or names the data statement that withholds it", async () => {
    const dirs = readdirSync(
      new URL("../../prisma/migrations", import.meta.url),
    )
      .filter((d) => /^\d{14}_/.test(d) && d >= "20260915114500")
      .sort();
    expect(dirs.length).toBeGreaterThanOrEqual(10);
    const report: Record<string, string> = {};
    for (const dir of dirs) {
      const decision = await decide(readMigrationSql(dir) as string);
      report[dir] =
        `${decision.action}` +
        (decision.gaps.length ? ` gaps: ${decision.gaps.join(" | ")}` : "") +
        (decision.blockers.length
          ? ` blockers: ${decision.blockers.join(" | ")}`
          : "");
    }
    for (const [dir, line] of Object.entries(report)) {
      // Nothing may differ from the catalog for a migration that applied cleanly.
      expect(line, dir).not.toMatch(/gaps:/);
      // And "manual" is only ever the data statements and the DROP-only
      // tidy-ups — never a mis-read object.
      if (!line.startsWith("applied")) {
        expect(line, dir).toMatch(
          /^manual blockers: (a data statement|the migration declares nothing|a statement this guard cannot check)/,
        );
      }
    }
    expect(report["20260917090000_analytics_opportunity"]).toBe("applied");
    expect(report["20260917100000_product_embeddings"]).toBe("applied");
    expect(report["20260915170000_product_size_tier"]).toBe("applied");
  });

  it("a probe migration applied by hand reads back as applied, defaults and enum labels and the foreign key included", async () => {
    await client.query(PROBE_SQL);
    const decision = await decide(PROBE_SQL);
    expect(decision.gaps).toEqual([]);
    expect(decision.action).toBe("applied");
  });

  it("the same probe with a column it did not declare, a widened index and an outsider's foreign key is a stray partial with the right plan", async () => {
    await client.query(
      `ALTER TABLE "GuardProbe" ADD COLUMN "extra" INTEGER NOT NULL DEFAULT 1`,
    );
    await client.query(
      `DROP INDEX "GuardProbe_kind_n_key"; CREATE UNIQUE INDEX "GuardProbe_kind_n_key" ON "GuardProbe"("n", "kind", "extra")`,
    );
    await client.query(OUTSIDER_SQL);
    const decision = await decide(PROBE_SQL);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.gaps).toEqual(
      expect.arrayContaining([
        "column GuardProbe.extra exists but is not declared",
        "index GuardProbe_kind_n_key covers (n, kind, extra), declared (kind, n)",
      ]),
    );
    expect(decision.plan).toEqual([
      'ALTER TABLE "GuardProbeOutsider" DROP CONSTRAINT "GuardProbeOutsider_probeId_fkey"',
      'DROP TABLE "GuardProbeChild"',
      'DROP TABLE "GuardProbe"',
      'DROP TYPE "GuardProbeKind"',
    ]);
  });

  it("heals it for real: the drop and the record change commit together, the outsider survives without its key", async () => {
    await markFailed();
    const result = await heal(client);
    expect(result.outcome).toBe("resolved");
    expect(result.decision?.action).toBe("drop-and-rolled-back");
    expect(
      await query(
        `select count(*)::int as n from information_schema.tables where table_name in ('GuardProbe', 'GuardProbeChild')`,
      ),
    ).toEqual([{ n: 0 }]);
    expect(
      await query(
        `select count(*)::int as n from pg_type where typname = 'GuardProbeKind'`,
      ),
    ).toEqual([{ n: 0 }]);
    expect(
      await query(
        `select count(*)::int as n from information_schema.tables where table_name = 'GuardProbeOutsider'`,
      ),
    ).toEqual([{ n: 1 }]);
    expect(
      await query(
        `select count(*)::int as n from pg_constraint where conname = 'GuardProbeOutsider_probeId_fkey'`,
      ),
    ).toEqual([{ n: 0 }]);
    expect(
      await query(
        `select rolled_back_at is not null as rb, finished_at is null as unfinished from _prisma_migrations where migration_name = $1`,
        [PROBE],
      ),
    ).toEqual([{ rb: true, unfinished: true }]);
    expect(
      logs.some((l) =>
        /Dropping the stray objects and marking the migration rolled-back in one transaction/.test(
          l,
        ),
      ),
    ).toBe(true);
  });

  it("a second build arriving after that finds no failed record and stands down", async () => {
    const result = await heal(client);
    expect(result.outcome).toBe("resolved-elsewhere");
  });

  it("two builds arriving at once: exactly one heals, the other stands down, nothing is dropped twice", async () => {
    // The outsider survived the heal above (only its key went) — start clean.
    await client.query(`DROP TABLE IF EXISTS "GuardProbeOutsider"`);
    await client.query(PROBE_SQL);
    await client.query(
      `ALTER TABLE "GuardProbe" ADD COLUMN "extra" INTEGER NOT NULL DEFAULT 1`,
    );
    await client.query(OUTSIDER_SQL);
    await query(`DELETE FROM _prisma_migrations WHERE migration_name = $1`, [
      PROBE,
    ]);
    await markFailed();
    const other = new Client({ connectionString: process.env.DATABASE_URL });
    await other.connect();
    try {
      const [a, b] = await Promise.all([heal(client), heal(other)]);
      expect([a.outcome, b.outcome].sort()).toEqual([
        "resolved",
        "resolved-elsewhere",
      ]);
    } finally {
      await other.end();
    }
    expect(
      await query(
        `select count(*)::int as n from information_schema.tables where table_name in ('GuardProbe', 'GuardProbeChild')`,
      ),
    ).toEqual([{ n: 0 }]);
    expect(
      await query(
        `select count(*)::int as n from _prisma_migrations where migration_name = $1 and rolled_back_at is not null`,
        [PROBE],
      ),
    ).toEqual([{ n: 1 }]);
    expect(
      await query(
        `select count(*)::int as n from _prisma_migrations where migration_name = $1 and finished_at is null and rolled_back_at is null`,
        [PROBE],
      ),
    ).toEqual([{ n: 0 }]);
  });

  it("re-applied cleanly and recorded failed again, it is marked applied with the file's checksum — and read back", async () => {
    await client.query(`DROP TABLE IF EXISTS "GuardProbeOutsider"`);
    await query(`DELETE FROM _prisma_migrations WHERE migration_name = $1`, [
      PROBE,
    ]);
    await client.query(PROBE_SQL);
    await markFailed();
    const result = await heal(client);
    expect(result.outcome).toBe("resolved");
    expect(result.decision?.action).toBe("applied");
    expect(
      await query(
        `select finished_at is not null as done, checksum, applied_steps_count as steps from _prisma_migrations where migration_name = $1 and rolled_back_at is null`,
        [PROBE],
      ),
    ).toEqual([
      { done: true, checksum: migrationChecksum(PROBE_SQL), steps: 0 },
    ]);
    expect(
      await query(
        `select count(*)::int as n from _prisma_migrations where migration_name = $1 and rolled_back_at is not null`,
        [PROBE],
      ),
    ).toEqual([{ n: 1 }]);
  });

  it("a third heal of the same migration is refused — the re-apply itself is failing", async () => {
    await query(`DELETE FROM _prisma_migrations WHERE migration_name = $1`, [
      PROBE,
    ]);
    await query(
      `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, rolled_back_at) VALUES (gen_random_uuid()::text, 'x', $1, now(), now()), (gen_random_uuid()::text, 'x', $1, now(), now())`,
      [PROBE],
    );
    await markFailed();
    const result = await heal(client);
    expect(result.outcome).toBe("manual");
    expect(result.decision?.blockers[0]).toMatch(
      /already been marked rolled back 2 times/,
    );
    // Untouched: the failed row is still failed, the probe objects still there.
    expect(
      await query(
        `select count(*)::int as n from _prisma_migrations where migration_name = $1 and finished_at is null and rolled_back_at is null`,
        [PROBE],
      ),
    ).toEqual([{ n: 1 }]);
    expect(
      await query(
        `select count(*)::int as n from information_schema.tables where table_name = 'GuardProbe'`,
      ),
    ).toEqual([{ n: 1 }]);
  });
});
