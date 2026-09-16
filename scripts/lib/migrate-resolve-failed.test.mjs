import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DERIVED_TABLES,
  decideResolution,
  expectedUdt,
  failedMigrationNames,
  inspectFootprint,
  manualResolveInstructions,
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
 * predecessor above all, replayed here from the two real migrations.
 */

// The real 2026-09-16 production output, shape-preserved.
const REAL_P3009 = `
Error: P3009

migrate found failed migrations in the target database, new migrations will not be applied.
The \`20260917090000_analytics_opportunity\` migration started at 2026-09-16 09:47:06.611335 UTC failed
`;

const B8 = readMigrationSql("20260917090000_analytics_opportunity");
const B9 = readMigrationSql("20260917100000_product_embeddings");
const B6 = readMigrationSql("20260916120000_analytics_league");
const B7 = readMigrationSql("20260916190000_shortlist_entries");
const SIZE_TIER = readMigrationSql("20260915170000_product_size_tier");
const SHEETS_DROP = readMigrationSql("20260915150000_drop_sheets_schema");

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
// state of a footprint applied cleanly is exactly its own declaration.
// ---------------------------------------------------------------------------

function emptyObserved() {
  return {
    tables: new Set(),
    columns: new Map(),
    indexes: new Map(),
    constraints: new Map(),
    pkTables: new Set(),
    enums: new Map(),
    extensions: new Set(),
    rows: new Map(),
    dependents: [],
  };
}

/** Apply one or more migrations' footprints to a fake catalog, in order. */
function catalogAfter(...sqls) {
  const observed = emptyObserved();
  for (const sql of sqls) {
    const fp = parseMigrationFootprint(sql);
    for (const table of fp.tables) {
      observed.tables.add(table.name);
      observed.rows.set(table.name, false);
      for (const c of table.columns) observed.columns.set(`${table.name}.${c.name}`, { udt: c.udt, nullable: c.nullable });
      if (table.primaryKey) {
        observed.pkTables.add(table.name);
        observed.constraints.set(`${table.name}.${table.name}_pkey`, { contype: "p", refTable: "" });
      }
      for (const k of table.constraints) observed.constraints.set(`${table.name}.${k.name}`, { contype: k.kind, refTable: k.refTable ?? "" });
    }
    // Objects on pre-existing tables: the table itself is there already.
    for (const c of fp.columns) {
      observed.tables.add(c.table);
      observed.columns.set(`${c.table}.${c.name}`, { udt: c.udt, nullable: c.nullable });
    }
    for (const i of fp.indexes) observed.tables.add(i.table);
    for (const k of fp.constraints) observed.tables.add(k.table);
    for (const i of fp.indexes) {
      observed.indexes.set(i.name, {
        table: i.table,
        unique: i.unique,
        def: `CREATE ${i.unique ? "UNIQUE " : ""}INDEX "${i.name}" ON public."${i.table}" USING btree (${(i.columns ?? []).map((c) => (c === c.toLowerCase() ? c : `"${c}"`)).join(", ")})`,
      });
    }
    for (const k of fp.constraints) observed.constraints.set(`${k.table}.${k.name}`, { contype: k.kind, refTable: k.refTable ?? "" });
    for (const e of fp.enums) observed.enums.set(e.name, [...e.labels]);
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

// ---------------------------------------------------------------------------

describe("failedMigrationNames", () => {
  it("parses the failed migration name from real P3009 output", () => {
    expect(failedMigrationNames(REAL_P3009)).toEqual(["20260917090000_analytics_opportunity"]);
  });

  it("parses several failed migrations when several are recorded", () => {
    const output =
      REAL_P3009 +
      "\nThe `20260917100000_product_embeddings` migration started at 2026-09-17 10:00:00 UTC failed\n";
    expect(failedMigrationNames(output)).toEqual([
      "20260917090000_analytics_opportunity",
      "20260917100000_product_embeddings",
    ]);
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

describe("parseMigrationFootprint", () => {
  it("reads the real B8 migration exactly", () => {
    const fp = parseMigrationFootprint(B8);
    expect(fp.tables.map((t) => t.name)).toEqual(["AnalyticsSnapshot", "OpportunityScore"]);
    const snapshot = fp.tables[0];
    expect(snapshot.primaryKey).toBe(true);
    expect(snapshot.columns.map((c) => c.name)).toEqual([
      "id", "view", "league", "scope", "sourceKey", "payload", "includedCount",
      "consideredCount", "computedAt", "scrapeRunId", "normalizerVersion", "analyticsVersion",
    ]);
    expect(snapshot.columns.find((c) => c.name === "scrapeRunId")).toMatchObject({ udt: "text", nullable: true });
    expect(snapshot.columns.find((c) => c.name === "analyticsVersion")).toMatchObject({ udt: "int4", nullable: false });
    expect(snapshot.columns.find((c) => c.name === "computedAt")).toMatchObject({ udt: "timestamp", nullable: false });
    expect(fp.tables[1].columns.find((c) => c.name === "value")).toMatchObject({ udt: "float8", nullable: true });
    expect(fp.indexes).toEqual([
      { name: "AnalyticsSnapshot_view_league_scope_sourceKey_key", table: "AnalyticsSnapshot", unique: true, columns: ["view", "league", "scope", "sourceKey"] },
      { name: "AnalyticsSnapshot_computedAt_idx", table: "AnalyticsSnapshot", unique: false, columns: ["computedAt"] },
      { name: "OpportunityScore_researchProductId_component_key", table: "OpportunityScore", unique: true, columns: ["researchProductId", "component"] },
      { name: "OpportunityScore_computedAt_idx", table: "OpportunityScore", unique: false, columns: ["computedAt"] },
    ]);
    expect(fp.constraints).toEqual([
      { table: "OpportunityScore", name: "OpportunityScore_researchProductId_fkey", kind: "f", refTable: "ResearchProduct" },
    ]);
    expect(fp.columns).toEqual([]);
    expect(fp.enums).toEqual([]);
    expect(fp.data).toEqual([]);
    expect(fp.unknown).toEqual([]);
  });

  it("reads B9: an extension, a pgvector column, an index pair and a foreign key", () => {
    const fp = parseMigrationFootprint(B9);
    expect(fp.extensions).toEqual([{ name: "vector", ifNotExists: true }]);
    expect(fp.tables.map((t) => t.name)).toEqual(["ProductEmbedding"]);
    const vector = fp.tables[0].columns.find((c) => c.udt === "vector");
    expect(vector).toBeDefined();
    expect(fp.unknown).toEqual([]);
    expect(fp.tables[0].columns.every((c) => c.udt !== null)).toBe(true);
  });

  it("reads B6: an enum type, an added column typed by it, and an UPDATE on a live table", () => {
    const fp = parseMigrationFootprint(B6);
    expect(fp.enums).toEqual([{ name: "AnalyticsLeague", labels: ["FINISHED_ART", "MATERIALS_DIY", "MARKETPLACE_B2B"] }]);
    expect(fp.columns).toEqual([
      { table: "ScrapeSource", name: "analyticsLeague", rawType: '"AnalyticsLeague"', udt: "AnalyticsLeague", nullable: false, primaryKey: false },
    ]);
    expect(fp.data).toEqual([{ verb: "UPDATE", table: "ScrapeSource" }]);
    expect(fp.unknown).toEqual([]);
  });

  it("reads B7: an enum, a table with an array column, and an INSERT into the table it creates", () => {
    const fp = parseMigrationFootprint(B7);
    expect(fp.enums[0].name).toBe("ShortlistState");
    expect(fp.tables[0].columns.find((c) => c.name === "tags")).toMatchObject({ udt: "_text", nullable: false });
    expect(fp.tables[0].columns.find((c) => c.name === "state")).toMatchObject({ udt: "ShortlistState", nullable: false });
    expect(fp.data).toEqual([{ verb: "INSERT", table: "ShortlistEntry" }]);
    expect(fp.unknown).toEqual([]);
  });

  it("files every DROP and RENAME under unknown — the additive vocabulary is the whole vocabulary", () => {
    const fp = parseMigrationFootprint(SHEETS_DROP);
    expect(fp.tables).toEqual([]);
    expect(fp.unknown.length).toBeGreaterThanOrEqual(11);
    expect(fp.unknown.some((u) => /DROP TABLE "SheetSyncRun"/.test(u))).toBe(true);
    expect(parseMigrationFootprint('ALTER TABLE "Product" RENAME COLUMN "a" TO "b";').unknown).toHaveLength(1);
    expect(parseMigrationFootprint('ALTER TABLE "Product" ALTER COLUMN "a" SET NOT NULL;').unknown).toHaveLength(1);
  });

  it("reads Prisma's generated spellings: named constraints in the body, multi-action ALTERs, IF NOT EXISTS", () => {
    const fp = parseMigrationFootprint(`
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
    expect(fp.tables[0]).toMatchObject({ name: "User", ifNotExists: true, primaryKey: true });
    expect(fp.tables[0].constraints).toEqual([{ name: "User_pkey", kind: "p", refTable: null }]);
    expect(fp.columns.map((c) => [c.table, c.name, c.udt, c.nullable])).toEqual([
      ["Product", "a", "text", true],
      ["Product", "b", "bool", false],
    ]);
    expect(fp.indexes).toEqual([
      { name: "Product_a_idx", table: "Product", unique: false, columns: ["a"] },
      { name: "Product_title_trgm_idx", table: "Product", unique: false, columns: ["title"] },
      { name: "Product_lower_idx", table: "Product", unique: false, columns: null },
    ]);
    expect(fp.enumValues).toEqual([{ type: "ScrapeTier", label: "LARGE_FORMAT" }]);
    expect(fp.extensions).toEqual([{ name: "pg_trgm", ifNotExists: true }]);
    expect(fp.unknown).toEqual([]);
  });

  it("folds a bare identifier to lower case, as Postgres does", () => {
    expect(tablesCreatedBy('create table OpportunityScore ("id" TEXT NOT NULL);')).toEqual(["opportunityscore"]);
    expect(tablesCreatedBy(B8)).toEqual(["AnalyticsSnapshot", "OpportunityScore"]);
  });

  it("does not read a table name out of a comment", () => {
    expect(tablesCreatedBy('-- CREATE TABLE "Ghost" ("id" TEXT);\nCREATE TABLE "Real" ("id" TEXT PRIMARY KEY);')).toEqual(["Real"]);
  });
});

describe("quoteIdent", () => {
  it("quotes a plain identifier and refuses anything else — a DROP is built from these", () => {
    expect(quoteIdent("AnalyticsSnapshot")).toBe('"AnalyticsSnapshot"');
    expect(() => quoteIdent('x"; DROP TABLE "Product')).toThrow(/refusing/);
    expect(() => quoteIdent("has space")).toThrow(/refusing/);
  });
});

describe("decideResolution — the 2026-09-16 production case", () => {
  it("drops the stray predecessor's objects, foreign keys onto them first, and marks the migration rolled-back", () => {
    const decision = decideResolution(parseMigrationFootprint(B8), productionOn0916());
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
    expect(decideResolution(parseMigrationFootprint(B8), productionOn0916(), new Map()).action).toBe(
      "drop-and-rolled-back",
    );
    // The differences it found are the real ones between the two migrations.
    expect(decision.gaps).toEqual(
      expect.arrayContaining([
        "column AnalyticsSnapshot.league is AnalyticsLeague, declared TEXT",
        "column AnalyticsSnapshot.includedCount is missing",
        "column AnalyticsSnapshot.consideredCount is missing",
        "column AnalyticsSnapshot.analyticsVersion is text, declared INTEGER",
        "index AnalyticsSnapshot_computedAt_idx is missing",
        "column OpportunityScore.value is missing",
        "column OpportunityScore.contribution is missing",
        "column OpportunityScore.detail is missing",
        "index OpportunityScore_computedAt_idx is missing",
      ]),
    );
  });

  it("still drops when the stray tables hold rows, because both are declared derivations", () => {
    const observed = productionOn0916();
    observed.rows.set("AnalyticsSnapshot", true);
    observed.rows.set("OpportunityScore", true);
    const decision = decideResolution(parseMigrationFootprint(B8), observed);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.discarded.map((d) => d.derived)).toEqual([
      DERIVED_TABLES.get("AnalyticsSnapshot"),
      DERIVED_TABLES.get("OpportunityScore"),
    ]);
  });

  it("refuses when a stray table holds rows and is NOT a declared derivation", () => {
    const observed = productionOn0916();
    observed.rows.set("OpportunityScore", true);
    const decision = decideResolution(parseMigrationFootprint(B8), observed, new Map());
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual(["table OpportunityScore has rows and is not a declared derivation"]);
    expect(decision.plan).toEqual([]);
  });
});

describe("decideResolution — the other outcomes", () => {
  it("nothing of it exists → rolled-back (#87's case)", () => {
    const decision = decideResolution(parseMigrationFootprint(B8), emptyObserved());
    expect(decision.action).toBe("rolled-back");
  });

  it("an enum type left behind by a non-atomic failure is 'something', not 'nothing' — it goes through the drop", () => {
    // Prisma does not run a migration script in one transaction (probed
    // 2026-09-16), so B7 dying at its CREATE TABLE leaves ShortlistState.
    const observed = emptyObserved();
    observed.enums.set("ShortlistState", ["NEW", "REVIEW", "SHORTLISTED", "REJECTED", "CONFIRMED", "INSPIRATION_ONLY", "DUPLICATE"]);
    const decision = decideResolution(parseMigrationFootprint(B7), observed);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.plan).toEqual(['DROP TYPE "ShortlistState"']);
  });

  it("everything exists in the declared shape → applied", () => {
    expect(decideResolution(parseMigrationFootprint(B8), catalogAfter(B8)).action).toBe("applied");
    expect(decideResolution(parseMigrationFootprint(B9), catalogAfter(B9)).action).toBe("applied");
    // An ALTER-only migration with no table of its own can still be proven complete.
    expect(decideResolution(parseMigrationFootprint(SIZE_TIER), catalogAfter(SIZE_TIER)).action).toBe("applied");
  });

  it("never says applied over a data statement, even when every object exists", () => {
    const decision = decideResolution(parseMigrationFootprint(B6), catalogAfter(B6));
    expect(decision.action).toBe("manual");
    expect(decision.gaps).toEqual([]); // every object IS there — the data statement alone withholds "applied"
    expect(decision.blockers).toContain(
      "a data statement on a table it did not create would run twice: UPDATE on ScrapeSource",
    );
    // and the drop is blocked too: the column it added sits on a live table.
    expect(decision.blockers).toContain(
      "column ScrapeSource.analyticsLeague already exists on a table it did not create — a column may hold data, and this guard never drops one",
    );
  });

  it("a data statement on a table the migration itself creates does not block the drop", () => {
    // B7's backfill INSERT goes with the table; re-applying repeats it cleanly.
    const observed = catalogAfter(B7);
    observed.indexes.delete("ShortlistEntry_state_changedAt_idx"); // partial: died before the index
    const decision = decideResolution(parseMigrationFootprint(B7), observed);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.plan).toEqual(['DROP TABLE "ShortlistEntry"', 'DROP TYPE "ShortlistState"']);
  });

  it("a column already added to a live table blocks the drop — a column may hold data", () => {
    const observed = catalogAfter(SIZE_TIER);
    observed.indexes.delete("Product_sizeTier_status_idx"); // partial
    const decision = decideResolution(parseMigrationFootprint(SIZE_TIER), observed);
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual([
      "column Product.sizeTier already exists on a table it did not create — a column may hold data, and this guard never drops one",
    ]);
  });

  it("an index or constraint already on a live table is dropped and rebuilt — neither holds data", () => {
    const fp = parseMigrationFootprint(`
ALTER TABLE "Product" ADD COLUMN "flag" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Product_flag_idx" ON "Product"("flag");
ALTER TABLE "Product" ADD CONSTRAINT "Product_flag_check" CHECK ("flag" IS NOT NULL);
`);
    const observed = emptyObserved();
    observed.tables.add("Product");
    observed.indexes.set("Product_flag_idx", { table: "Product", unique: false, def: 'CREATE INDEX "Product_flag_idx" ON public."Product" USING btree (flag)' });
    observed.constraints.set("Product.Product_flag_check", { contype: "c", refTable: "" });
    const decision = decideResolution(fp, observed);
    expect(decision.action).toBe("drop-and-rolled-back");
    expect(decision.plan).toEqual([
      'ALTER TABLE "Product" DROP CONSTRAINT "Product_flag_check"',
      'DROP INDEX "Product_flag_idx"',
    ]);
  });

  it("a wrong type, a wrong nullability, a non-unique index or a wrong reference is a gap, never 'applied'", () => {
    const fp = parseMigrationFootprint(B8);
    const wrongType = catalogAfter(B8);
    wrongType.columns.set("OpportunityScore.weight", { udt: "int4", nullable: false });
    expect(decideResolution(fp, wrongType)).toMatchObject({ action: "drop-and-rolled-back" });
    expect(decideResolution(fp, wrongType).gaps).toContain("column OpportunityScore.weight is int4, declared DOUBLE PRECISION");

    const wrongNull = catalogAfter(B8);
    wrongNull.columns.set("AnalyticsSnapshot.payload", { udt: "jsonb", nullable: true });
    expect(decideResolution(fp, wrongNull).gaps).toContain("column AnalyticsSnapshot.payload is nullable, declared NOT NULL");

    const notUnique = catalogAfter(B8);
    notUnique.indexes.get("OpportunityScore_researchProductId_component_key").unique = false;
    expect(decideResolution(fp, notUnique).gaps).toContain("index OpportunityScore_researchProductId_component_key is not unique, declared unique");

    const wrongRef = catalogAfter(B8);
    wrongRef.constraints.set("OpportunityScore.OpportunityScore_researchProductId_fkey", { contype: "f", refTable: "ScrapedProduct" });
    expect(decideResolution(fp, wrongRef).gaps).toContain("constraint OpportunityScore_researchProductId_fkey references ScrapedProduct, declared ResearchProduct");
  });

  it("a statement it cannot read blocks both applied and the drop", () => {
    const fp = parseMigrationFootprint(`${B8}\nALTER TABLE "OpportunityScore" RENAME COLUMN "detail" TO "why";`);
    expect(decideResolution(fp, catalogAfter(B8)).action).toBe("manual");
    expect(decideResolution(fp, productionOn0916()).action).toBe("manual");
    expect(decideResolution(fp, emptyObserved()).action).toBe("rolled-back"); // nothing exists — still provable
  });

  it("a migration with nothing checkable is a human problem", () => {
    const decision = decideResolution(parseMigrationFootprint(SHEETS_DROP), emptyObserved());
    expect(decision.action).toBe("manual");
    expect(decision.blockers[0]).toBe("the migration declares nothing this guard can check");
  });

  it("an enum value already present on a live type blocks the drop — Postgres cannot take one back", () => {
    const fp = parseMigrationFootprint(`
ALTER TYPE "ScrapeTier" ADD VALUE 'LARGE_FORMAT';
CREATE TABLE "Later" ("id" TEXT PRIMARY KEY);
`);
    const observed = emptyObserved();
    observed.enums.set("ScrapeTier", ["OWNER", "LARGE_FORMAT"]);
    const decision = decideResolution(fp, observed);
    expect(decision.action).toBe("manual");
    expect(decision.blockers).toEqual([
      "enum value 'LARGE_FORMAT' already exists on ScrapeTier — Postgres cannot remove an enum value",
    ]);
  });
});

describe("inspectFootprint", () => {
  it("asks the catalog only about the objects the footprint names, and reads rows only for created tables that exist", async () => {
    const calls = [];
    const query = async (text, params) => {
      calls.push({ text: text.replace(/\s+/g, " ").trim(), params });
      if (/information_schema\.tables/.test(text)) return [{ table_name: "AnalyticsSnapshot" }];
      if (/information_schema\.columns/.test(text)) return [{ table_name: "AnalyticsSnapshot", column_name: "id", udt_name: "text", is_nullable: "NO" }];
      if (/pg_indexes/.test(text)) return [];
      if (/con\.contype = 'f'/.test(text)) return [{ from_table: "ShortlistEntry", conname: "fk", to_table: "AnalyticsSnapshot" }];
      if (/pg_constraint/.test(text)) return [{ table_name: "AnalyticsSnapshot", conname: "AnalyticsSnapshot_pkey", contype: "p", ref_table: "" }];
      if (/has_rows/.test(text)) return [{ has_rows: true }];
      return [];
    };
    const observed = await inspectFootprint(query, parseMigrationFootprint(B8));
    expect(observed.tables).toEqual(new Set(["AnalyticsSnapshot"]));
    expect(observed.columns.get("AnalyticsSnapshot.id")).toEqual({ udt: "text", nullable: false });
    expect(observed.pkTables.has("AnalyticsSnapshot")).toBe(true);
    expect(observed.rows.get("AnalyticsSnapshot")).toBe(true);
    expect(observed.rows.has("OpportunityScore")).toBe(false);
    expect(observed.dependents).toEqual([{ fromTable: "ShortlistEntry", conname: "fk", toTable: "AnalyticsSnapshot" }]);
    const rowQueries = calls.filter((c) => /has_rows/.test(c.text));
    expect(rowQueries).toHaveLength(1);
    expect(rowQueries[0].text).toContain('from "AnalyticsSnapshot"');
    // No enum or extension query for a migration that declares neither.
    expect(calls.some((c) => /pg_enum|pg_extension/.test(c.text))).toBe(false);
  });

  it("refuses an identifier it would have to interpolate", async () => {
    const fp = parseMigrationFootprint('CREATE TABLE "ok" ("id" TEXT PRIMARY KEY);');
    fp.tables[0].name = 'x"; drop table "Product';
    await expect(inspectFootprint(async () => [], fp)).rejects.toThrow(/refusing/);
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
    const decision = decideResolution(parseMigrationFootprint(B8), (() => {
      const o = productionOn0916();
      o.rows.set("OpportunityScore", true);
      return o;
    })(), new Map());
    const text = manualResolveInstructions("20260917090000_analytics_opportunity", decision);
    expect(text).toContain("column AnalyticsSnapshot.includedCount is missing");
    expect(text).toContain("table OpportunityScore has rows and is not a declared derivation");
    expect(text).toContain("migrate resolve --applied 20260917090000_analytics_opportunity");
    expect(text).toContain("migrate resolve --rolled-back 20260917090000_analytics_opportunity");
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
    const statements = sqlStatements(sql);
    expect(statements).toEqual([
      'ALTER TABLE "ShortlistEntry" DROP CONSTRAINT IF EXISTS "ShortlistEntry_linkedOpportunityId_fkey"',
      'DROP INDEX IF EXISTS "ShortlistEntry_linkedOpportunityId_idx"',
      'ALTER TABLE "ShortlistEntry" DROP COLUMN IF EXISTS "linkedOpportunityId"',
    ]);
  });
});
