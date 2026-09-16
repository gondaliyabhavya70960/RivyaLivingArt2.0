import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  DERIVED_TABLES,
  PRISMA_MIGRATE_LOCK,
  decideResolution,
  emptyObserved,
  expectedUdt,
  failedMigrationNames,
  healFailedMigration,
  inspectFootprint,
  manualResolveInstructions,
  migrationChecksum,
  normalizeDefault,
  nothingOwned,
  ownedByOtherMigrations,
  parseConstraintBody,
  parseIndexDef,
  parseMigrationFootprint,
  quoteIdent,
  readMigrationSql,
  sqlStatements,
  tablesCreatedBy,
} from "./migrate-resolve-failed.mjs";

/**
 * The guard behind the P3009 self-heal. Its strength is in what it REFUSES,
 * so most of the decision cases are refusals; the three resolutions are
 * pinned against the shapes that actually occurred — the 2026-09-16 stray
 * predecessor above all, replayed here from the two real migrations — and
 * against the shapes the 2026-09-16 review showed a looser check would have
 * passed (a superset, a reordered index, a foreign key on the wrong column).
 * `tests/db/migrate-resolve-failed.test.ts` runs the same reader and the
 * same transaction against a real Postgres.
 */

// The real 2026-09-16 production output, shape-preserved.
const REAL_P3009 = `
Error: P3009

migrate found failed migrations in the target database, new migrations will not be applied.
The \`20260917090000_analytics_opportunity\` migration started at 2026-09-16 09:47:06.611335 UTC failed
`;

const B8_NAME = "20260917090000_analytics_opportunity";
const B8 = readMigrationSql(B8_NAME);
const B9 = readMigrationSql("20260917100000_product_embeddings");
const B6 = readMigrationSql("20260916120000_analytics_league");
const B7 = readMigrationSql("20260916190000_shortlist_entries");
const SIZE_TIER = readMigrationSql("20260915170000_product_size_tier");
const SHEETS_DROP = readMigrationSql("20260915150000_drop_sheets_schema");
const NO_OWNER = { ownedElsewhere: nothingOwned() };

/** What the abandoned branch's preview applied to production at 08:16 UTC —
 *  the same two table names in a different shape, plus a column on
 *  ShortlistEntry with an index and a foreign key onto OpportunityScore.
 *  Commit 556168ff on feat/b8-analytics-opportunity-score, verbatim minus
 *  comments. */
const STRAY_PREDECESSOR = `
CREATE TABLE "AnalyticsSnapshot" (
  "id"                TEXT PRIMARY KEY,
  "view"              TEXT NOT NULL,
  "league"            "AnalyticsLeague" NOT NULL,
  "scope"             TEXT NOT NULL,
  "sourceKey"         TEXT NOT NULL DEFAULT '',
  "payload"           JSONB NOT NULL,
  "computedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scrapeRunId"       TEXT,
  "normalizerVersion" TEXT NOT NULL,
  "analyticsVersion"  TEXT NOT NULL,
  "computedCount"     INTEGER NOT NULL,
  "totalCount"        INTEGER NOT NULL
);
CREATE TABLE "OpportunityScore" (
  "id"                TEXT PRIMARY KEY,
  "researchProductId" TEXT NOT NULL,
  "component"         TEXT NOT NULL,
  "score"             INTEGER,
  "weight"            DOUBLE PRECISION NOT NULL,
  "evidence"          TEXT NOT NULL,
  "computedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scrapeRunId"       TEXT,
  "normalizerVersion" TEXT NOT NULL,
  "analyticsVersion"  TEXT NOT NULL
);
ALTER TABLE "ShortlistEntry" ADD COLUMN "linkedOpportunityId" TEXT;
CREATE UNIQUE INDEX "AnalyticsSnapshot_view_league_scope_sourceKey_key"
  ON "AnalyticsSnapshot"("view", "league", "scope", "sourceKey");
CREATE INDEX "AnalyticsSnapshot_league_scope_idx"
  ON "AnalyticsSnapshot"("league", "scope");
CREATE UNIQUE INDEX "OpportunityScore_researchProductId_component_key"
  ON "OpportunityScore"("researchProductId", "component");
CREATE INDEX "OpportunityScore_component_computedAt_idx"
  ON "OpportunityScore"("component", "computedAt");
CREATE INDEX "ShortlistEntry_linkedOpportunityId_idx"
  ON "ShortlistEntry"("linkedOpportunityId");
ALTER TABLE "OpportunityScore"
  ADD CONSTRAINT "OpportunityScore_researchProductId_fkey"
  FOREIGN KEY ("researchProductId") REFERENCES "ResearchProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortlistEntry"
  ADD CONSTRAINT "ShortlistEntry_linkedOpportunityId_fkey"
  FOREIGN KEY ("linkedOpportunityId") REFERENCES "OpportunityScore"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
`;

// ---------------------------------------------------------------------------
// A catalog built from SQL, so "what Postgres would show" is derived from a
// migration's own statements rather than typed out by hand — the observed
// state of a footprint applied cleanly is exactly its own declaration. The
// real-catalog proof of that equivalence is the db test's job.
// ---------------------------------------------------------------------------

const indexDefFor = (i) =>
  `CREATE ${i.unique ? "UNIQUE " : ""}INDEX "${i.name}" ON public."${i.table}" USING ${i.method} (${(i.columns ?? []).map((c) => (c === c.toLowerCase() ? c : `"${c}"`)).join(", ")})`;

/** Apply one or more migrations' footprints to a fake catalog, in order. */
function catalogAfter(...sqls) {
  const observed = emptyObserved();
  const table = (name) => {
    observed.tables.add(name);
    if (!observed.relations.has(name)) observed.relations.set(name, { kind: "r", table: "" });
  };
  const constraint = (owner, name, parsed) =>
    observed.constraints.set(`${owner}.${name}`, { contype: parsed.kind, def: "", ...parsed });
  const index = (i) => {
    observed.indexes.set(i.name, { table: i.table, unique: i.unique, method: i.method, columns: i.columns, where: i.where, include: i.include, def: indexDefFor(i) });
    observed.relations.set(i.name, { kind: "i", table: i.table });
  };
  for (const sql of sqls) {
    const fp = parseMigrationFootprint(sql);
    for (const t of fp.tables) {
      table(t.name);
      observed.rows.set(t.name, false);
      for (const c of t.columns) observed.columns.set(`${t.name}.${c.name}`, { udt: c.udt, nullable: c.nullable, default: c.default ?? "" });
      if (t.primaryKey) {
        const named = t.constraints.find((k) => k.kind === "p");
        const pkName = named ? named.name : `${t.name}_pkey`;
        constraint(t.name, pkName, { kind: "p", columns: t.primaryKeyColumns });
        index({ name: pkName, table: t.name, unique: true, method: "btree", columns: t.primaryKeyColumns, where: false, include: false });
      }
      for (const k of t.constraints) if (k.kind !== "p") constraint(t.name, k.name, k);
    }
    for (const c of fp.columns) {
      table(c.table);
      observed.columns.set(`${c.table}.${c.name}`, { udt: c.udt, nullable: c.nullable, default: c.default ?? "" });
    }
    for (const i of fp.indexes) {
      table(i.table);
      index(i);
    }
    for (const k of fp.constraints) {
      table(k.table);
      constraint(k.table, k.name, k);
    }
    for (const e of fp.enums) {
      observed.types.set(e.name, "e");
      observed.enums.set(e.name, [...e.labels]);
    }
    for (const v of fp.enumValues) observed.enums.get(v.type)?.push(v.label);
    for (const x of fp.extensions) observed.extensions.add(x.name);
  }
  return observed;
}

/** The production catalog on 2026-09-16 at 09:47 UTC, as the failed B8
 *  migration's inspector would have read it: the stray predecessor's
 *  objects, and a foreign key from ShortlistEntry onto its OpportunityScore. */
function productionOn0916() {
  const observed = catalogAfter(STRAY_PREDECESSOR);
  observed.dependents.push({
    fromTable: "ShortlistEntry",
    conname: "ShortlistEntry_linkedOpportunityId_fkey",
    toTable: "OpportunityScore",
  });
  return observed;
}

const fp = (sql) => parseMigrationFootprint(sql);

// ---------------------------------------------------------------------------

describe("failedMigrationNames", () => {
  it("parses the failed migration name from real P3009 output", () => {
    expect(failedMigrationNames(REAL_P3009)).toEqual([B8_NAME]);
  });

  it("parses several failed migrations when several are recorded", () => {
    const output =
      REAL_P3009 +
      "\nThe `20260917100000_product_embeddings` migration started at 2026-09-17 10:00:00 UTC failed\n";
    expect(failedMigrationNames(output)).toEqual([B8_NAME, "20260917100000_product_embeddings"]);
  });

  it("parses nothing out of a transient connection failure", () => {
    expect(
      failedMigrationNames('Error: db error: FATAL: too many connections for role "prisma_migration"'),
    ).toEqual([]);
  });
});

describe("sqlStatements", () => {
  it("strips line comments, keeps string literals, splits on top-level semicolons", () => {
    const sql = `
-- CREATE TABLE "InAComment" ("id" TEXT);
INSERT INTO "T" ("v") VALUES ('a; -- not a comment; it''s a value');
CREATE TABLE "U" ("id" TEXT PRIMARY KEY, "d" TEXT DEFAULT ';');
`;
    const statements = sqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("it''s a value");
    expect(statements[1]).toMatch(/^CREATE TABLE "U"/);
  });
});

describe("expectedUdt", () => {
  it("maps the spellings this repo's migrations use to information_schema's udt_name", () => {
    expect(expectedUdt("TEXT")).toBe("text");
    expect(expectedUdt("INTEGER")).toBe("int4");
    expect(expectedUdt("DOUBLE PRECISION")).toBe("float8");
    expect(expectedUdt("TIMESTAMP(3)")).toBe("timestamp");
    expect(expectedUdt("TIMESTAMP(3) WITH TIME ZONE")).toBe("timestamptz");
    expect(expectedUdt("JSONB")).toBe("jsonb");
    expect(expectedUdt("BOOLEAN")).toBe("bool");
    expect(expectedUdt("TEXT[]")).toBe("_text");
    expect(expectedUdt("DECIMAL(65,30)")).toBe("numeric");
    expect(expectedUdt("vector(512)")).toBe("vector");
    expect(expectedUdt('"ProductSizeTier"')).toBe("ProductSizeTier");
  });

  it("returns null for a spelling it does not know — the refusal, not a guess", () => {
    expect(expectedUdt("MONEY")).toBeNull();
    expect(expectedUdt("GEOGRAPHY(POINT)")).toBeNull();
  });
});

describe("normalizeDefault", () => {
  it("folds the catalog's casts and spellings onto the migration's — and nothing else", () => {
    expect(normalizeDefault("''::text")).toBe(normalizeDefault("''"));
    expect(normalizeDefault(`'NEW'::"ShortlistState"`)).toBe(normalizeDefault("'NEW'"));
    expect(normalizeDefault("ARRAY[]::text[]")).toBe(normalizeDefault("ARRAY[]::TEXT[]"));
    expect(normalizeDefault("'{}'::jsonb")).toBe(normalizeDefault("'{}'"));
    expect(normalizeDefault("now()")).toBe("CURRENT_TIMESTAMP");
    expect(normalizeDefault("CURRENT_TIMESTAMP")).toBe("CURRENT_TIMESTAMP");
    expect(normalizeDefault("FALSE")).toBe("false");
    expect(normalizeDefault("0.5")).toBe("0.5");
    expect(normalizeDefault("'a'")).not.toBe(normalizeDefault("'b'"));
    expect(normalizeDefault("0")).not.toBe(normalizeDefault("1"));
    expect(normalizeDefault(null)).toBeNull();
  });
});

describe("parseConstraintBody — one parser for the migration and for pg_get_constraintdef", () => {
  it("reads a foreign key the same way from both spellings", () => {
    const declared = parseConstraintBody(
      `FOREIGN KEY ("researchProductId") REFERENCES "ResearchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    const rendered = parseConstraintBody(
      `FOREIGN KEY ("researchProductId") REFERENCES "ResearchProduct"(id) ON UPDATE CASCADE ON DELETE CASCADE`,
    );
    expect(declared).toEqual({
      kind: "f",
      columns: ["researchProductId"],
      refTable: "ResearchProduct",
      refColumns: ["id"],
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    expect(rendered).toEqual(declared);
  });

  it("defaults the actions to NO ACTION and reads SET NULL as two words", () => {
    expect(parseConstraintBody(`FOREIGN KEY ("a") REFERENCES "T"("id")`)).toMatchObject({ onDelete: "NO ACTION", onUpdate: "NO ACTION" });
    expect(parseConstraintBody(`FOREIGN KEY ("a") REFERENCES "T"("id") ON DELETE SET NULL`)).toMatchObject({ onDelete: "SET NULL", onUpdate: "NO ACTION" });
  });

  it("reads primary keys and unique constraints as column lists, and refuses to compare a CHECK", () => {
    expect(parseConstraintBody(`PRIMARY KEY ("A", "B")`)).toEqual({ kind: "p", columns: ["A", "B"] });
    expect(parseConstraintBody(`PRIMARY KEY (id)`)).toEqual({ kind: "p", columns: ["id"] });
    expect(parseConstraintBody(`UNIQUE ("email")`)).toEqual({ kind: "u", columns: ["email"] });
    expect(parseConstraintBody(`CHECK (("n" > 0))`)).toEqual({ kind: "c", checkable: false });
    expect(parseConstraintBody(`SOMETHING ELSE`)).toBeNull();
  });
});

describe("parseIndexDef — pg_indexes.indexdef as data", () => {
  it("reads a real unique btree definition, quoted and bare names alike", () => {
    expect(
      parseIndexDef(
        `CREATE UNIQUE INDEX "AnalyticsSnapshot_view_league_scope_sourceKey_key" ON public."AnalyticsSnapshot" USING btree (view, league, scope, "sourceKey")`,
      ),
    ).toEqual({
      unique: true,
      name: "AnalyticsSnapshot_view_league_scope_sourceKey_key",
      table: "AnalyticsSnapshot",
      method: "btree",
      columns: ["view", "league", "scope", "sourceKey"],
      where: false,
      include: false,
    });
  });

  it("reads the trgm gin indexes, and marks an expression or a partial index as not comparable", () => {
    expect(parseIndexDef(`CREATE INDEX "Product_title_trgm_idx" ON public."Product" USING gin (title gin_trgm_ops)`)).toMatchObject({
      method: "gin",
      columns: ["title"],
    });
    expect(parseIndexDef(`CREATE INDEX "x" ON public."Product" USING btree (lower(title))`)).toMatchObject({ columns: null });
    expect(parseIndexDef(`CREATE INDEX "x" ON public."Product" USING btree (title) WHERE (title IS NOT NULL)`)).toMatchObject({ where: true });
    expect(parseIndexDef("not an index")).toBeNull();
  });
});

describe("parseMigrationFootprint", () => {
  it("reads the real B8 migration exactly, defaults and primary keys included", () => {
    const b8 = fp(B8);
    expect(b8.tables.map((t) => t.name)).toEqual(["AnalyticsSnapshot", "OpportunityScore"]);
    const snapshot = b8.tables[0];
    expect(snapshot.primaryKey).toBe(true);
    expect(snapshot.primaryKeyColumns).toEqual(["id"]);
    expect(snapshot.columns.map((c) => c.name)).toEqual([
      "id", "view", "league", "scope", "sourceKey", "payload", "includedCount",
      "consideredCount", "computedAt", "scrapeRunId", "normalizerVersion", "analyticsVersion",
    ]);
    expect(snapshot.columns.find((c) => c.name === "league")).toMatchObject({ udt: "text", nullable: false, default: "''" });
    expect(snapshot.columns.find((c) => c.name === "computedAt")).toMatchObject({ udt: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP" });
    expect(snapshot.columns.find((c) => c.name === "includedCount")).toMatchObject({ udt: "int4", nullable: false, default: "" });
    expect(snapshot.columns.find((c) => c.name === "scrapeRunId")).toMatchObject({ udt: "text", nullable: true });
    expect(b8.tables[1].columns.find((c) => c.name === "value")).toMatchObject({ udt: "float8", nullable: true });
    expect(b8.indexes).toEqual([
      { name: "AnalyticsSnapshot_view_league_scope_sourceKey_key", table: "AnalyticsSnapshot", unique: true, method: "btree", columns: ["view", "league", "scope", "sourceKey"], where: false, include: false },
      { name: "AnalyticsSnapshot_computedAt_idx", table: "AnalyticsSnapshot", unique: false, method: "btree", columns: ["computedAt"], where: false, include: false },
      { name: "OpportunityScore_researchProductId_component_key", table: "OpportunityScore", unique: true, method: "btree", columns: ["researchProductId", "component"], where: false, include: false },
      { name: "OpportunityScore_computedAt_idx", table: "OpportunityScore", unique: false, method: "btree", columns: ["computedAt"], where: false, include: false },
    ]);
    expect(b8.constraints).toEqual([
      {
        table: "OpportunityScore",
        name: "OpportunityScore_researchProductId_fkey",
        kind: "f",
        columns: ["researchProductId"],
        refTable: "ResearchProduct",
        refColumns: ["id"],
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
    ]);
    expect(b8.columns).toEqual([]);
    expect(b8.enums).toEqual([]);
    expect(b8.data).toEqual([]);
    expect(b8.unknown).toEqual([]);
  });

  it("reads B9: an extension, a pgvector column, an index pair and a foreign key", () => {
    const b9 = fp(B9);
    expect(b9.extensions).toEqual([{ name: "vector", ifNotExists: true }]);
    expect(b9.tables.map((t) => t.name)).toEqual(["ProductEmbedding"]);
    expect(b9.tables[0].columns.find((c) => c.udt === "vector")).toBeDefined();
    expect(b9.tables[0].columns.every((c) => c.udt !== null)).toBe(true);
    expect(b9.unknown).toEqual([]);
  });

  it("reads B6: an enum type, an added column typed by it with its default, and an UPDATE on a live table", () => {
    const b6 = fp(B6);
    expect(b6.enums).toEqual([{ name: "AnalyticsLeague", labels: ["FINISHED_ART", "MATERIALS_DIY", "MARKETPLACE_B2B"] }]);
    expect(b6.columns).toEqual([
      { table: "ScrapeSource", name: "analyticsLeague", rawType: '"AnalyticsLeague"', udt: "AnalyticsLeague", nullable: false, primaryKey: false, default: "'FINISHED_ART'" },
    ]);
    expect(b6.data).toEqual([{ verb: "UPDATE", table: "ScrapeSource" }]);
    expect(b6.unknown).toEqual([]);
  });

  it("reads B7: an enum, a table with an array column, and an INSERT into the table it creates", () => {
    const b7 = fp(B7);
    expect(b7.enums[0].name).toBe("ShortlistState");
    expect(b7.tables[0].columns.find((c) => c.name === "tags")).toMatchObject({ udt: "_text", nullable: false, default: "ARRAY[]" });
    expect(b7.tables[0].columns.find((c) => c.name === "state")).toMatchObject({ udt: "ShortlistState", nullable: false, default: "'NEW'" });
    expect(b7.data).toEqual([{ verb: "INSERT", table: "ShortlistEntry" }]);
    expect(b7.unknown).toEqual([]);
  });

  it("files every DROP and RENAME under unknown — the additive vocabulary is the whole vocabulary", () => {
    const drop = fp(SHEETS_DROP);
    expect(drop.tables).toEqual([]);
    expect(drop.unknown.length).toBeGreaterThanOrEqual(11);
    expect(drop.unknown.some((u) => /DROP TABLE "SheetSyncRun"/.test(u))).toBe(true);
    expect(fp('ALTER TABLE "Product" RENAME COLUMN "a" TO "b";').unknown).toHaveLength(1);
    expect(fp('ALTER TABLE "Product" ALTER COLUMN "a" SET NOT NULL;').unknown).toHaveLength(1);
  });

  it("reads Prisma's generated spellings: named constraints in the body, multi-action ALTERs, IF NOT EXISTS, USING", () => {
    const generated = fp(`
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Product" ADD COLUMN "a" TEXT, ADD COLUMN IF NOT EXISTS "b" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Product_a_idx" ON "Product"("a");
CREATE INDEX "Product_title_trgm_idx" ON "Product" USING gin ("title" gin_trgm_ops);
CREATE INDEX "Product_lower_idx" ON "Product" (lower("title"));
ALTER TYPE "ScrapeTier" ADD VALUE IF NOT EXISTS 'LARGE_FORMAT';
CREATE EXTENSION IF NOT EXISTS pg_trgm;
`);
    expect(generated.tables[0]).toMatchObject({ name: "User", ifNotExists: true, primaryKey: true, primaryKeyColumns: ["id"] });
    expect(generated.tables[0].constraints).toEqual([{ name: "User_pkey", kind: "p", columns: ["id"] }]);
    expect(generated.columns.map((c) => [c.table, c.name, c.udt, c.nullable, c.default])).toEqual([
      ["Product", "a", "text", true, ""],
      ["Product", "b", "bool", false, "false"],
    ]);
    expect(generated.indexes).toEqual([
      { name: "Product_a_idx", table: "Product", unique: false, method: "btree", columns: ["a"], where: false, include: false },
      { name: "Product_title_trgm_idx", table: "Product", unique: false, method: "gin", columns: ["title"], where: false, include: false },
      { name: "Product_lower_idx", table: "Product", unique: false, method: "btree", columns: null, where: false, include: false },
    ]);
    expect(generated.enumValues).toEqual([{ type: "ScrapeTier", label: "LARGE_FORMAT" }]);
    expect(generated.extensions).toEqual([{ name: "pg_trgm", ifNotExists: true }]);
    expect(generated.unknown).toEqual([]);
  });

  it("folds a bare identifier to lower case, as Postgres does", () => {
    expect(tablesCreatedBy('create table OpportunityScore ("id" TEXT NOT NULL);')).toEqual(["opportunityscore"]);
    expect(tablesCreatedBy(B8)).toEqual(["AnalyticsSnapshot", "OpportunityScore"]);
  });

  it("does not read a table name out of a comment", () => {
    expect(tablesCreatedBy('-- CREATE TABLE "Ghost" ("id" TEXT);\nCREATE TABLE "Real" ("id" TEXT PRIMARY KEY);')).toEqual(["Real"]);
  });

  it("recognises all 65 additive migrations in the repo without a gap, and only the five renames and drops as unknown", () => {
    const dirs = readdirSync(new URL("../../prisma/migrations", import.meta.url)).filter((d) => !d.endsWith(".toml"));
    const withUnknown = dirs.filter((d) => fp(readMigrationSql(d)).unknown.length > 0);
    expect(withUnknown.sort()).toEqual([
      "20260915090000_import_conflict_rename",
      "20260915093000_import_conflict_map_not_rename",
      "20260915150000_drop_sheets_schema",
      "20260917110000_drop_sheets_settings_columns",
      "20260917120000_shortlist_stray_link_column",
    ]);
    const untyped = dirs.flatMap((d) => {
      const f = fp(readMigrationSql(d));
      return [...f.tables.flatMap((t) => t.columns), ...f.columns].filter((c) => c.udt === null).map((c) => `${d}:${c.name}`);
    });
    expect(untyped).toEqual([]);
  });
});

describe("quoteIdent", () => {
  it("quotes a plain identifier and refuses anything else — a DROP is built from these", () => {
    expect(quoteIdent("AnalyticsSnapshot")).toBe('"AnalyticsSnapshot"');
    expect(() => quoteIdent('x"; DROP TABLE "Product')).toThrow(/refusing/);
    expect(() => quoteIdent("has space")).toThrow(/refusing/);
  });
});

describe("ownedByOtherMigrations", () => {
  it("indexes what every OTHER migration declares — B8's tables are nobody else's, ShortlistEntry is B7's", () => {
    const owned = ownedByOtherMigrations(B8_NAME);
    expect(owned.tables.has("AnalyticsSnapshot")).toBe(false);
    expect(owned.tables.has("OpportunityScore")).toBe(false);
    expect(owned.tables.get("ShortlistEntry")).toBe("20260916190000_shortlist_entries");
    expect(owned.columns.get("Product.sizeTier")).toBe("20260915170000_product_size_tier");
    expect(owned.enums.get("ShortlistState")).toBe("20260916190000_shortlist_entries");
    expect(owned.indexes.has("AnalyticsSnapshot_computedAt_idx")).toBe(false);
  });

  it("is empty for a directory that does not exist", () => {
    expect(ownedByOtherMigrations("x", "/nonexistent/dir").tables.size).toBe(0);
  });
});

describe("decideResolution — the 2026-09-16 production case", () => {
  it("drops the stray predecessor's objects, foreign keys onto them first, and marks the migration rolled-back", () => {
    const decision = decideResolution(fp(B8), productionOn0916(), { ownedElsewhere: ownedByOtherMigrations(B8_NAME) });
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.plan).toEqual([
      'ALTER TABLE "ShortlistEntry" DROP CONSTRAINT "ShortlistEntry_linkedOpportunityId_fkey"',
      'DROP TABLE "OpportunityScore"',
      'DROP TABLE "AnalyticsSnapshot"',
    ]);
    // Empty AND declared derivations — either alone would have been enough.
    expect(decision.discarded).toEqual([
      { table: "AnalyticsSnapshot", hasRows: false, derived: DERIVED_TABLES.get("AnalyticsSnapshot") },
      { table: "OpportunityScore", hasRows: false, derived: DERIVED_TABLES.get("OpportunityScore") },
    ]);
    expect(decideResolution(fp(B8), productionOn0916(), { derivedTables: new Map(), ...NO_OWNER }).action).toBe("drop-and-rolled-back");
    // The differences it found are the real ones between the two migrations.
    expect(decision.gaps).toEqual(
      expect.arrayContaining([
        "column AnalyticsSnapshot.league is AnalyticsLeague, declared TEXT",
        "column AnalyticsSnapshot.includedCount is missing",
        "column AnalyticsSnapshot.consideredCount is missing",
        "column AnalyticsSnapshot.analyticsVersion is text, declared INTEGER",
        "column AnalyticsSnapshot.computedCount exists but is not declared",
        "index AnalyticsSnapshot_league_scope_idx on AnalyticsSnapshot exists but is not declared",
        "index AnalyticsSnapshot_computedAt_idx is missing",
        "column OpportunityScore.value is missing",
        "column OpportunityScore.evidence exists but is not declared",
        "index OpportunityScore_computedAt_idx is missing",
      ]),
    );
  });

  it("still drops when the stray tables hold rows, because both are declared derivations", () => {
    const observed = productionOn0916();
    observed.rows.set("AnalyticsSnapshot", true);
    observed.rows.set("OpportunityScore", true);
    const decision = decideResolution(fp(B8), observed, NO_OWNER);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.discarded.map((d) => d.derived)).toEqual([
      DERIVED_TABLES.get("AnalyticsSnapshot"),
      DERIVED_TABLES.get("OpportunityScore"),
    ]);
  });

  it("refuses when a stray table holds rows and is NOT a declared derivation", () => {
    const observed = productionOn0916();
    observed.rows.set("OpportunityScore", true);
    const decision = decideResolution(fp(B8), observed, { derivedTables: new Map(), ...NO_OWNER });
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual(["table OpportunityScore has rows and is not a declared derivation"]);
    expect(decision.plan).toEqual([]);
  });
});

describe("decideResolution — the three facts", () => {
  it("nothing of it exists → rolled-back (#87's case)", () => {
    expect(decideResolution(fp(B8), emptyObserved(), NO_OWNER).action).toBe("rolled-back");
  });

  it("everything exists in the declared shape, and nothing else → applied", () => {
    expect(decideResolution(fp(B8), catalogAfter(B8), NO_OWNER).action).toBe("applied");
    expect(decideResolution(fp(B9), catalogAfter(B9), NO_OWNER).action).toBe("applied");
    // An ALTER-only migration with no table of its own can still be proven complete.
    expect(decideResolution(fp(SIZE_TIER), catalogAfter(SIZE_TIER), NO_OWNER).action).toBe("applied");
  });

  it("an enum type left behind by a non-atomic failure is 'something', not 'nothing' — it goes through the drop", () => {
    // Prisma does not run a migration script in one transaction (probed
    // 2026-09-16), so B7 dying at its CREATE TABLE leaves ShortlistState.
    const observed = emptyObserved();
    observed.types.set("ShortlistState", "e");
    observed.enums.set("ShortlistState", ["NEW", "REVIEW", "SHORTLISTED", "REJECTED", "CONFIRMED", "INSPIRATION_ONLY", "DUPLICATE"]);
    const decision = decideResolution(fp(B7), observed, NO_OWNER);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.plan).toEqual(['DROP TYPE "ShortlistState"']);
  });
});

describe("decideResolution — what withholds 'applied'", () => {
  it("a data statement, even when every object exists", () => {
    const decision = decideResolution(fp(B6), catalogAfter(B6), NO_OWNER);
    expect(decision.action).toBe("manual");
    expect(decision.gaps).toEqual([]);
    expect(decision.blockers).toEqual(["a data statement it cannot verify ran: UPDATE on ScrapeSource"]);
  });

  it("an undeclared column, index or constraint on a table the migration creates — a superset is not the declared shape", () => {
    const extraColumn = catalogAfter(B8);
    extraColumn.columns.set("AnalyticsSnapshot.totalCount", { udt: "int4", nullable: false, default: "" });
    const c1 = decideResolution(fp(B8), extraColumn, NO_OWNER);
    expect(c1.action).toBe("drop-and-rolled-back");
    expect(c1.gaps).toEqual(["column AnalyticsSnapshot.totalCount exists but is not declared"]);

    const extraIndex = catalogAfter(B8);
    extraIndex.indexes.set("AnalyticsSnapshot_view_key", { table: "AnalyticsSnapshot", unique: true, method: "btree", columns: ["view"], where: false, include: false, def: "" });
    expect(decideResolution(fp(B8), extraIndex, NO_OWNER).gaps).toEqual(["index AnalyticsSnapshot_view_key on AnalyticsSnapshot exists but is not declared"]);

    const extraConstraint = catalogAfter(B8);
    extraConstraint.constraints.set("OpportunityScore.OpportunityScore_weight_check", { contype: "c", def: "", kind: "c", checkable: false });
    expect(decideResolution(fp(B8), extraConstraint, NO_OWNER).gaps).toEqual(["constraint OpportunityScore_weight_check on OpportunityScore exists but is not declared"]);
  });

  it("a reordered or widened index, a foreign key on other columns or with other actions, a wider primary key, a dropped default", () => {
    const b8 = fp(B8);
    const reordered = catalogAfter(B8);
    reordered.indexes.get("OpportunityScore_researchProductId_component_key").columns = ["component", "researchProductId", "analyticsVersion"];
    expect(decideResolution(b8, reordered, NO_OWNER).gaps).toEqual([
      "index OpportunityScore_researchProductId_component_key covers (component, researchProductId, analyticsVersion), declared (researchProductId, component)",
    ]);

    const wrongFkColumn = catalogAfter(B8);
    wrongFkColumn.constraints.get("OpportunityScore.OpportunityScore_researchProductId_fkey").columns = ["id"];
    expect(decideResolution(b8, wrongFkColumn, NO_OWNER).gaps).toEqual([
      "constraint OpportunityScore_researchProductId_fkey on OpportunityScore covers (id), declared (researchProductId)",
    ]);

    const wrongAction = catalogAfter(B8);
    wrongAction.constraints.get("OpportunityScore.OpportunityScore_researchProductId_fkey").onDelete = "SET NULL";
    expect(decideResolution(b8, wrongAction, NO_OWNER).gaps).toEqual([
      "constraint OpportunityScore_researchProductId_fkey is ON DELETE SET NULL ON UPDATE CASCADE, declared ON DELETE CASCADE ON UPDATE CASCADE",
    ]);

    const widerPk = catalogAfter(B8);
    widerPk.constraints.get("AnalyticsSnapshot.AnalyticsSnapshot_pkey").columns = ["view", "id"];
    expect(decideResolution(b8, widerPk, NO_OWNER).gaps).toEqual(["table AnalyticsSnapshot has primary key (view, id), declared (id)"]);

    const noDefault = catalogAfter(B8);
    noDefault.columns.get("AnalyticsSnapshot.league").default = "";
    expect(decideResolution(b8, noDefault, NO_OWNER).gaps).toEqual(["column AnalyticsSnapshot.league defaults to nothing, declared ''"]);
  });

  it("a wrong type, a wrong nullability, a non-unique index, a wrong method, a wrong reference", () => {
    const b8 = fp(B8);
    const wrongType = catalogAfter(B8);
    wrongType.columns.set("OpportunityScore.weight", { udt: "int4", nullable: false, default: "" });
    expect(decideResolution(b8, wrongType, NO_OWNER)).toMatchObject({ action: "drop-and-rolled-back" });
    expect(decideResolution(b8, wrongType, NO_OWNER).gaps).toContain("column OpportunityScore.weight is int4, declared DOUBLE PRECISION");

    const wrongNull = catalogAfter(B8);
    wrongNull.columns.set("AnalyticsSnapshot.payload", { udt: "jsonb", nullable: true, default: "" });
    expect(decideResolution(b8, wrongNull, NO_OWNER).gaps).toContain("column AnalyticsSnapshot.payload is nullable, declared NOT NULL");

    const notUnique = catalogAfter(B8);
    notUnique.indexes.get("OpportunityScore_researchProductId_component_key").unique = false;
    expect(decideResolution(b8, notUnique, NO_OWNER).gaps).toContain("index OpportunityScore_researchProductId_component_key is not unique, declared unique");

    const hash = catalogAfter(B8);
    hash.indexes.get("AnalyticsSnapshot_computedAt_idx").method = "hash";
    expect(decideResolution(b8, hash, NO_OWNER).gaps).toContain("index AnalyticsSnapshot_computedAt_idx uses hash, declared btree");

    const wrongRef = catalogAfter(B8);
    wrongRef.constraints.get("OpportunityScore.OpportunityScore_researchProductId_fkey").refTable = "ScrapedProduct";
    expect(decideResolution(b8, wrongRef, NO_OWNER).gaps).toContain("constraint OpportunityScore_researchProductId_fkey references ScrapedProduct, declared ResearchProduct");
  });

  it("an expression index, a partial index or a CHECK is 'cannot compare', never 'present'", () => {
    const expression = fp(`CREATE TABLE "T" ("id" TEXT PRIMARY KEY, "a" TEXT); CREATE INDEX "T_lower_idx" ON "T" (lower("a"));`);
    const observed = catalogAfter(`CREATE TABLE "T" ("id" TEXT PRIMARY KEY, "a" TEXT);`);
    observed.indexes.set("T_lower_idx", { table: "T", unique: false, method: "btree", columns: null, where: false, include: false, def: "" });
    observed.relations.set("T_lower_idx", { kind: "i", table: "T" });
    const decision = decideResolution(expression, observed, NO_OWNER);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.gaps).toEqual(["index T_lower_idx is an expression index this guard cannot compare"]);

    const check = fp(`CREATE TABLE "T" ("id" TEXT PRIMARY KEY, "n" INTEGER, CONSTRAINT "T_n_check" CHECK ("n" > 0));`);
    expect(decideResolution(check, catalogAfter(`CREATE TABLE "T" ("id" TEXT PRIMARY KEY, "n" INTEGER, CONSTRAINT "T_n_check" CHECK ("n" > 0));`), NO_OWNER).gaps).toEqual([
      "constraint T_n_check on T is one this guard cannot compare",
    ]);
  });
});

describe("decideResolution — what withholds the drop", () => {
  it("a data statement on a table the migration itself creates does not block the drop", () => {
    // B7's backfill INSERT goes with the table; re-applying repeats it cleanly.
    const observed = catalogAfter(B7);
    observed.indexes.delete("ShortlistEntry_state_changedAt_idx"); // partial: died before the index
    observed.relations.delete("ShortlistEntry_state_changedAt_idx");
    const decision = decideResolution(fp(B7), observed, NO_OWNER);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.plan).toEqual(['DROP TABLE "ShortlistEntry"', 'DROP TYPE "ShortlistState"']);
  });

  it("a column already added to a live table blocks the drop — a column may hold data", () => {
    const observed = catalogAfter(SIZE_TIER);
    observed.indexes.delete("Product_sizeTier_status_idx"); // partial
    observed.relations.delete("Product_sizeTier_status_idx");
    const decision = decideResolution(fp(SIZE_TIER), observed, NO_OWNER);
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual([
      "column Product.sizeTier already exists on a table it did not create — a column may hold data, and this guard never drops one",
    ]);
  });

  it("an index or constraint already on a live table is dropped and rebuilt — neither holds data", () => {
    const declared = fp(`
ALTER TABLE "Product" ADD COLUMN "flag" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Product_flag_idx" ON "Product"("flag");
ALTER TABLE "Product" ADD CONSTRAINT "Product_flag_check" CHECK ("flag" IS NOT NULL);
`);
    const observed = emptyObserved();
    observed.tables.add("Product");
    observed.relations.set("Product", { kind: "r", table: "" });
    observed.indexes.set("Product_flag_idx", { table: "Product", unique: false, method: "btree", columns: ["flag"], where: false, include: false, def: "" });
    observed.relations.set("Product_flag_idx", { kind: "i", table: "Product" });
    observed.constraints.set("Product.Product_flag_check", { contype: "c", def: "", kind: "c", checkable: false });
    const decision = decideResolution(declared, observed, NO_OWNER);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.plan).toEqual([
      'ALTER TABLE "Product" DROP CONSTRAINT "Product_flag_check"',
      'DROP INDEX "Product_flag_idx"',
    ]);
  });

  it("a table, column, index or enum another migration in the repo owns is live schema, never a stray", () => {
    // A future migration that re-creates Inquiry by mistake, on a database
    // where Inquiry is empty: the empty table is the init migration's.
    const rogue = fp(`CREATE TABLE "Inquiry" ("id" TEXT PRIMARY KEY);`);
    const observed = catalogAfter(`CREATE TABLE "Inquiry" ("id" TEXT PRIMARY KEY, "customerName" TEXT NOT NULL);`);
    const decision = decideResolution(rogue, observed, { ownedElsewhere: ownedByOtherMigrations("99990101000000_rogue") });
    expect(decision.action).toBe("manual");
    expect(decision.blockers[0]).toMatch(/^table Inquiry is created by migration 20260705183035_init as well — live schema, not a stray$/);
    expect(decision.blockers).toContain(
      "column Inquiry.customerName is declared by migration 20260705183035_init — Inquiry is live schema, not a stray",
    );

    const rogueEnum = fp(`CREATE TYPE "ShortlistState" AS ENUM ('NEW'); CREATE TABLE "Later" ("id" TEXT PRIMARY KEY);`);
    const withEnum = emptyObserved();
    withEnum.types.set("ShortlistState", "e");
    withEnum.enums.set("ShortlistState", ["NEW", "REVIEW"]);
    const enumDecision = decideResolution(rogueEnum, withEnum, { ownedElsewhere: ownedByOtherMigrations("99990101000000_rogue") });
    expect(enumDecision.action).toBe("manual");
    expect(enumDecision.blockers).toContain("enum type ShortlistState is created by migration 20260916190000_shortlist_entries as well — live schema, not a stray");
  });

  it("CREATE TABLE IF NOT EXISTS on a table that exists in another shape is not the migration's to replace", () => {
    const declared = fp(`CREATE TABLE IF NOT EXISTS "T" ("id" TEXT PRIMARY KEY, "a" TEXT);`);
    const observed = catalogAfter(`CREATE TABLE "T" ("id" TEXT PRIMARY KEY, "b" TEXT);`);
    const decision = decideResolution(declared, observed, NO_OWNER);
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual(["table T is created with IF NOT EXISTS and exists in another shape — the migration would not have touched it"]);
  });

  it("a declared name taken by an object on some other table is a collision, not a stray", () => {
    const observed = emptyObserved();
    observed.relations.set("OpportunityScore_computedAt_idx", { kind: "i", table: "ShortlistEntry" });
    const decision = decideResolution(fp(B8), observed, NO_OWNER);
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual([
      "the name OpportunityScore_computedAt_idx is taken by an index on ShortlistEntry, which this migration did not create",
    ]);
    expect(decision.gaps).toContain("the name OpportunityScore_computedAt_idx is taken by a index on ShortlistEntry, not an index on OpportunityScore");

    const tableTaken = emptyObserved();
    tableTaken.relations.set("AnalyticsSnapshot", { kind: "i", table: "Product" });
    expect(decideResolution(fp(B8), tableTaken, NO_OWNER).blockers).toEqual([
      "the name AnalyticsSnapshot is taken by a relation of kind i this migration did not create",
    ]);
  });

  it("an enum value already present on a live type blocks the drop — Postgres cannot take one back", () => {
    const declared = fp(`
ALTER TYPE "ScrapeTier" ADD VALUE 'LARGE_FORMAT';
CREATE TABLE "Later" ("id" TEXT PRIMARY KEY);
`);
    const observed = emptyObserved();
    observed.types.set("ScrapeTier", "e");
    observed.enums.set("ScrapeTier", ["OWNER", "LARGE_FORMAT"]);
    const decision = decideResolution(declared, observed, NO_OWNER);
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual([
      "enum value 'LARGE_FORMAT' already exists on ScrapeTier — Postgres cannot remove an enum value",
    ]);
  });
});

describe("decideResolution — what withholds even 'rolled-back'", () => {
  it("a statement it cannot read: a RENAME or DROP may have run before the first checkable object failed", () => {
    const declared = fp(`DROP TABLE "Old"; CREATE TABLE "New" ("id" TEXT PRIMARY KEY);`);
    const decision = decideResolution(declared, emptyObserved(), NO_OWNER);
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual(['a statement this guard cannot check: DROP TABLE "Old"']);
    expect(decideResolution(fp(`${B8}\nALTER TABLE "OpportunityScore" RENAME COLUMN "detail" TO "why";`), catalogAfter(B8), NO_OWNER).action).toBe("manual");
    expect(decideResolution(fp(`${B8}\nALTER TABLE "OpportunityScore" RENAME COLUMN "detail" TO "why";`), productionOn0916(), NO_OWNER).action).toBe("manual");
  });

  it("a data statement on a live table: it may already have run, and a re-apply would run it again", () => {
    const declared = fp(`UPDATE "ScrapeSource" SET "n" = "n" + 1; CREATE TABLE "New" ("id" TEXT PRIMARY KEY);`);
    const decision = decideResolution(declared, emptyObserved(), NO_OWNER);
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual([
      "a data statement on a table it did not create may already have run, and would run again: UPDATE on ScrapeSource",
    ]);
    // B7's INSERT is into the table it creates — nothing to run twice.
    expect(decideResolution(fp(B7), emptyObserved(), NO_OWNER).action).toBe("rolled-back");
  });

  it("a migration with nothing checkable is a human problem", () => {
    const decision = decideResolution(fp(SHEETS_DROP), emptyObserved(), NO_OWNER);
    expect(decision.action).toBe("manual");
    expect(decision.blockers[0]).toBe("the migration declares nothing this guard can check");
  });
});

describe("inspectFootprint", () => {
  it("asks the catalog only about the objects the footprint names, and reads rows only for created tables that exist", async () => {
    const calls = [];
    const query = async (text, params) => {
      calls.push({ text: text.replace(/\s+/g, " ").trim(), params });
      if (/information_schema\.tables/.test(text)) return [{ table_name: "AnalyticsSnapshot" }];
      if (/information_schema\.columns/.test(text)) return [{ table_name: "AnalyticsSnapshot", column_name: "id", udt_name: "text", is_nullable: "NO", column_default: null }];
      if (/pg_indexes/.test(text)) return [{ tablename: "AnalyticsSnapshot", indexname: "AnalyticsSnapshot_pkey", indexdef: 'CREATE UNIQUE INDEX "AnalyticsSnapshot_pkey" ON public."AnalyticsSnapshot" USING btree (id)' }];
      if (/con\.contype = 'f'/.test(text)) return [{ from_table: "ShortlistEntry", conname: "fk", to_table: "AnalyticsSnapshot" }];
      if (/pg_get_constraintdef/.test(text)) return [{ table_name: "AnalyticsSnapshot", conname: "AnalyticsSnapshot_pkey", contype: "p", def: "PRIMARY KEY (id)" }];
      if (/from pg_class c/.test(text)) return [{ relname: "AnalyticsSnapshot", relkind: "r", table_name: "" }];
      if (/has_rows/.test(text)) return [{ has_rows: true }];
      return [];
    };
    const observed = await inspectFootprint(query, fp(B8));
    expect(observed.tables).toEqual(new Set(["AnalyticsSnapshot"]));
    expect(observed.columns.get("AnalyticsSnapshot.id")).toEqual({ udt: "text", nullable: false, default: "" });
    expect(observed.indexes.get("AnalyticsSnapshot_pkey")).toMatchObject({ table: "AnalyticsSnapshot", unique: true, method: "btree", columns: ["id"] });
    expect(observed.constraints.get("AnalyticsSnapshot.AnalyticsSnapshot_pkey")).toMatchObject({ contype: "p", columns: ["id"] });
    expect(observed.relations.get("AnalyticsSnapshot")).toEqual({ kind: "r", table: "" });
    expect(observed.rows.get("AnalyticsSnapshot")).toBe(true);
    expect(observed.rows.has("OpportunityScore")).toBe(false);
    expect(observed.dependents).toEqual([{ fromTable: "ShortlistEntry", conname: "fk", toTable: "AnalyticsSnapshot" }]);
    const rowQueries = calls.filter((c) => /has_rows/.test(c.text));
    expect(rowQueries).toHaveLength(1);
    expect(rowQueries[0].text).toContain('from "AnalyticsSnapshot"');
    // The schema-wide name lookup asks about every table AND index name.
    const relations = calls.find((c) => /from pg_class c/.test(c.text));
    expect(relations.params[0]).toEqual(expect.arrayContaining(["AnalyticsSnapshot", "OpportunityScore", "AnalyticsSnapshot_computedAt_idx"]));
    // No enum or extension query for a migration that declares neither.
    expect(calls.some((c) => /pg_enum|pg_extension/.test(c.text))).toBe(false);
  });

  it("refuses an identifier it would have to interpolate", async () => {
    const declared = fp('CREATE TABLE "ok" ("id" TEXT PRIMARY KEY);');
    declared.tables[0].name = 'x"; drop table "Product';
    await expect(inspectFootprint(async () => [], declared)).rejects.toThrow(/refusing/);
  });
});

describe("healFailedMigration — the transaction, the lock, the record, the read-back", () => {
  /** A pg client that answers the guard's own queries from a script and
   *  records every statement in order. `catalog` answers the inspector;
   *  the two record writes behave as Postgres would unless `stuck`. */
  function fakeClient({ failedRow = [{ id: "r1" }], heals = 0, catalog = () => [], stuck = false } = {}) {
    const calls = [];
    const state = { failedRow, applied: [] };
    const client = {
      calls,
      state,
      query: vi.fn(async (text, params = []) => {
        calls.push({ text: text.replace(/\s+/g, " ").trim(), params });
        if (/finished_at is not null and rolled_back_at is null/.test(text)) return { rows: state.applied };
        if (/^select id from _prisma_migrations/i.test(text.trim())) return { rows: state.failedRow };
        if (/count\(\*\)::int as heals/.test(text)) return { rows: [{ heals }] };
        if (/^update _prisma_migrations set rolled_back_at/i.test(text.trim())) {
          if (!stuck) state.failedRow = [];
          return { rows: [] };
        }
        if (/^insert into _prisma_migrations/i.test(text.trim())) {
          if (!stuck) state.applied = [{ id: "a1" }];
          return { rows: [] };
        }
        if (/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|select pg_advisory_xact_lock|DROP |ALTER )/i.test(text.trim())) return { rows: [] };
        return { rows: catalog(text, params) };
      }),
    };
    return client;
  }
  const log = () => {};
  const name = B8_NAME;
  const footprint = fp(B8);
  const texts = (client) => client.calls.map((c) => c.text);

  it("nothing exists: locks Prisma's migrate lock, locks the record, marks it rolled back INSIDE the transaction, reads it back after", async () => {
    const client = fakeClient();
    const result = await healFailedMigration({ client, name, footprint, sql: B8, log, ownedElsewhere: nothingOwned() });
    expect(result.outcome).toBe("resolved");
    expect(result.decision.action).toBe("rolled-back");
    const t = texts(client);
    expect(t[0]).toBe("BEGIN");
    expect(t[1]).toMatch(/^SET LOCAL lock_timeout = '120s'$/);
    expect(t[2]).toBe("select pg_advisory_xact_lock($1)");
    expect(client.calls[2].params).toEqual([PRISMA_MIGRATE_LOCK]);
    expect(t[3]).toMatch(/^select id from _prisma_migrations .* for update$/);
    const update = t.findIndex((x) => /^update _prisma_migrations set rolled_back_at = now\(\) where id = any\(\$1\)$/.test(x));
    const commit = t.indexOf("COMMIT");
    expect(update).toBeGreaterThan(3);
    expect(update).toBeLessThan(commit);
    expect(client.calls[update].params).toEqual([["r1"]]);
    expect(t.filter((x) => /^(DROP|ALTER|insert)/i.test(x))).toEqual([]);
    // The read-back happens after the commit.
    expect(t.lastIndexOf("COMMIT")).toBeLessThan(t.length - 1);
  });

  it("another build resolved it first: no failed row → ROLLBACK, nothing written, 'resolved-elsewhere'", async () => {
    const client = fakeClient({ failedRow: [] });
    const result = await healFailedMigration({ client, name, footprint, sql: B8, log, ownedElsewhere: nothingOwned() });
    expect(result.outcome).toBe("resolved-elsewhere");
    const t = texts(client);
    expect(t).toContain("ROLLBACK");
    expect(t.some((x) => /^(update|insert)/i.test(x))).toBe(false);
  });

  it("a stray partial: the drop plan and the record change run between BEGIN and COMMIT", async () => {
    const catalog = (text) => {
      if (/information_schema\.tables/.test(text)) return [{ table_name: "AnalyticsSnapshot" }];
      if (/information_schema\.columns/.test(text)) return [{ table_name: "AnalyticsSnapshot", column_name: "id", udt_name: "text", is_nullable: "NO", column_default: null }];
      if (/from pg_class c/.test(text)) return [{ relname: "AnalyticsSnapshot", relkind: "r", table_name: "" }];
      if (/pg_get_constraintdef/.test(text)) return [{ table_name: "AnalyticsSnapshot", conname: "AnalyticsSnapshot_pkey", contype: "p", def: "PRIMARY KEY (id)" }];
      if (/has_rows/.test(text)) return [{ has_rows: false }];
      return [];
    };
    const client = fakeClient({ catalog });
    const result = await healFailedMigration({ client, name, footprint, sql: B8, log, ownedElsewhere: nothingOwned() });
    expect(result.outcome).toBe("resolved");
    expect(result.decision.action).toBe("drop-and-rolled-back");
    const t = texts(client);
    const begin = t.indexOf("BEGIN");
    const drop = t.indexOf('DROP TABLE "AnalyticsSnapshot"');
    const update = t.findIndex((x) => /^update _prisma_migrations/i.test(x));
    const commit = t.indexOf("COMMIT");
    expect(begin).toBeLessThan(drop);
    expect(drop).toBeLessThan(update);
    expect(update).toBeLessThan(commit);
  });

  it("a drop that fails rolls the whole transaction back — the record stays failed for a person", async () => {
    const catalog = (text) => {
      if (/information_schema\.tables/.test(text)) return [{ table_name: "AnalyticsSnapshot" }];
      if (/from pg_class c/.test(text)) return [{ relname: "AnalyticsSnapshot", relkind: "r", table_name: "" }];
      if (/has_rows/.test(text)) return [{ has_rows: false }];
      return [];
    };
    const client = fakeClient({ catalog });
    const original = client.query.getMockImplementation();
    client.query.mockImplementation(async (text, params) => {
      if (/^DROP TABLE/.test(text)) throw new Error("cannot drop table because other objects depend on it");
      return original(text, params);
    });
    const result = await healFailedMigration({ client, name, footprint, sql: B8, log, ownedElsewhere: nothingOwned() });
    expect(result.outcome).toBe("manual");
    const t = texts(client);
    expect(t).toContain("ROLLBACK");
    expect(t.some((x) => /^update _prisma_migrations/i.test(x))).toBe(false);
  });

  it("a commit that did not change the record is not believed", async () => {
    const client = fakeClient({ stuck: true });
    const result = await healFailedMigration({ client, name, footprint, sql: B8, log, ownedElsewhere: nothingOwned() });
    expect(result.outcome).toBe("manual");
  });

  it("a third heal of the same migration is refused — the re-apply itself is failing", async () => {
    const client = fakeClient({ heals: 2 });
    const result = await healFailedMigration({ client, name, footprint, sql: B8, log, ownedElsewhere: nothingOwned() });
    expect(result.outcome).toBe("manual");
    expect(result.decision.blockers[0]).toMatch(/already been marked rolled back 2 times/);
    const t = texts(client);
    expect(t).toContain("ROLLBACK");
    expect(t.some((x) => /^update _prisma_migrations/i.test(x))).toBe(false);
  });

  it("'applied' marks the failed row rolled back AND inserts the applied row with the file's checksum, then reads both back", async () => {
    const complete = catalogAfter(B8);
    const catalog = (text) => {
      if (/information_schema\.tables/.test(text)) return [...complete.tables].map((t) => ({ table_name: t }));
      if (/information_schema\.columns/.test(text))
        return [...complete.columns].map(([key, c]) => {
          const [table_name, column_name] = key.split(".");
          return { table_name, column_name, udt_name: c.udt, is_nullable: c.nullable ? "YES" : "NO", column_default: c.default || null };
        });
      if (/pg_indexes/.test(text)) return [...complete.indexes].map(([indexname, i]) => ({ tablename: i.table, indexname, indexdef: i.def }));
      if (/pg_get_constraintdef/.test(text))
        return [...complete.constraints].map(([key, c]) => {
          const [table_name, conname] = key.split(".");
          const def = c.kind === "p" ? `PRIMARY KEY (${c.columns.join(", ")})` : `FOREIGN KEY ("${c.columns[0]}") REFERENCES "${c.refTable}"(id) ON UPDATE ${c.onUpdate} ON DELETE ${c.onDelete}`;
          return { table_name, conname, contype: c.kind, def };
        });
      if (/from pg_class c/.test(text)) return [...complete.relations].map(([relname, r]) => ({ relname, relkind: r.kind, table_name: r.table }));
      if (/has_rows/.test(text)) return [{ has_rows: false }];
      return [];
    };
    const client = fakeClient({ catalog });
    const result = await healFailedMigration({ client, name, footprint, sql: B8, log, ownedElsewhere: nothingOwned() });
    expect(result.outcome).toBe("resolved");
    expect(result.decision.action).toBe("applied");
    const insert = client.calls.find((c) => /^insert into _prisma_migrations/i.test(c.text));
    expect(insert.params).toEqual([migrationChecksum(B8), name]);
    expect(migrationChecksum(B8)).toMatch(/^[0-9a-f]{64}$/);
    const t = texts(client);
    expect(t.indexOf(insert.text)).toBeLessThan(t.indexOf("COMMIT"));
  });
});

describe("readMigrationSql", () => {
  it("reads a migration this repo carries", () => {
    expect(B8).toContain('CREATE TABLE "AnalyticsSnapshot"');
  });

  it("returns null for a name that is not a carried migration, and for a path", () => {
    expect(readMigrationSql("20990101000000_not_real")).toBeNull();
    expect(readMigrationSql("../../etc/passwd")).toBeNull();
  });
});

describe("manualResolveInstructions", () => {
  it("prints the facts the guard found and both exact commands", () => {
    const observed = productionOn0916();
    observed.rows.set("OpportunityScore", true);
    const decision = decideResolution(fp(B8), observed, { derivedTables: new Map(), ...NO_OWNER });
    const text = manualResolveInstructions(B8_NAME, decision);
    expect(text).toContain("column AnalyticsSnapshot.includedCount is missing");
    expect(text).toContain("table OpportunityScore has rows and is not a declared derivation");
    expect(text).toContain(`migrate resolve --applied ${B8_NAME}`);
    expect(text).toContain(`migrate resolve --rolled-back ${B8_NAME}`);
    expect(text).toContain("migrate status");
  });

  it("copes with no decision at all — a migration this checkout does not carry", () => {
    const text = manualResolveInstructions("20990101000000_gone", null);
    expect(text).toContain("--rolled-back 20990101000000_gone");
  });
});

describe("the tidy-up migration for the stray column", () => {
  it("is three IF EXISTS drops on ShortlistEntry and nothing else", () => {
    const sql = readFileSync(
      new URL("../../prisma/migrations/20260917120000_shortlist_stray_link_column/migration.sql", import.meta.url),
      "utf8",
    );
    expect(sqlStatements(sql)).toEqual([
      'ALTER TABLE "ShortlistEntry" DROP CONSTRAINT IF EXISTS "ShortlistEntry_linkedOpportunityId_fkey"',
      'DROP INDEX IF EXISTS "ShortlistEntry_linkedOpportunityId_idx"',
      'ALTER TABLE "ShortlistEntry" DROP COLUMN IF EXISTS "linkedOpportunityId"',
    ]);
  });
});
