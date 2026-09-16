import { describe, expect, it } from "vitest";
import {
  failedMigrationNames,
  manualResolveInstructions,
  readMigrationSql,
  tablesCreatedBy,
} from "./migrate-resolve-failed.mjs";

/**
 * The parsers behind the P3009 self-heal. The guard's strength is entirely
 * in what it REFUSES to do, so most of these cases are refusals: no failed
 * name parsed, no table parsed, a table present in the database — each one
 * must leave the human exactly where they were, with better instructions.
 */

// The real 2026-09-16 production output, shape-preserved.
const REAL_P3009 = `
Error: P3009

migrate found failed migrations in the target database, new migrations will not be applied.
The \`20260917090000_analytics_opportunity\` migration started at 2026-09-16 09:47:06.611335 UTC failed
`;

describe("failedMigrationNames", () => {
  it("parses the failed migration name from real P3009 output", () => {
    expect(failedMigrationNames(REAL_P3009)).toEqual([
      "20260917090000_analytics_opportunity",
    ]);
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
      failedMigrationNames(
        'Error: db error: FATAL: too many connections for role "prisma_migration"',
      ),
    ).toEqual([]);
  });
});

describe("tablesCreatedBy", () => {
  it("extracts quoted table names and ignores indexes, constraints and extensions", () => {
    const sql = `
CREATE EXTENSION IF NOT EXISTS vector;
-- CreateTable
CREATE TABLE "ProductEmbedding" (
    "id" TEXT NOT NULL
);
-- CreateIndex
CREATE UNIQUE INDEX "ProductEmbedding_researchProductId_model_key" ON "ProductEmbedding"("researchProductId", "model");
-- AddForeignKey
ALTER TABLE "ProductEmbedding" ADD CONSTRAINT "ProductEmbedding_researchProductId_fkey" FOREIGN KEY ("researchProductId") REFERENCES "ResearchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;
    expect(tablesCreatedBy(sql)).toEqual(["ProductEmbedding"]);
  });

  it("handles IF NOT EXISTS, bare-word names, and several tables", () => {
    const sql = `
CREATE TABLE IF NOT EXISTS "AnalyticsSnapshot" ("id" TEXT NOT NULL);
create table OpportunityScore ("id" TEXT NOT NULL);
`;
    expect(tablesCreatedBy(sql)).toEqual([
      "AnalyticsSnapshot",
      "OpportunityScore",
    ]);
  });

  it("an ALTER-only migration yields nothing — and nothing is the refusal", () => {
    expect(
      tablesCreatedBy(
        'ALTER TABLE "Product" ADD COLUMN "sizeTier" INTEGER;',
      ),
    ).toEqual([]);
  });
});

describe("readMigrationSql", () => {
  it("reads a migration this repo carries", () => {
    const sql = readMigrationSql("20260917090000_analytics_opportunity");
    expect(sql).toContain('CREATE TABLE "AnalyticsSnapshot"');
  });

  it("returns null for a name that is not a carried migration, and for a path", () => {
    expect(readMigrationSql("20990101000000_not_real")).toBeNull();
    expect(readMigrationSql("../../etc/passwd")).toBeNull();
  });
});

describe("manualResolveInstructions", () => {
  it("names the tables that blocked the guard and the exact commands", () => {
    const text = manualResolveInstructions(
      "20260917090000_analytics_opportunity",
      ["AnalyticsSnapshot"],
    );
    expect(text).toContain("AnalyticsSnapshot");
    expect(text).toContain(
      "migrate resolve --rolled-back 20260917090000_analytics_opportunity",
    );
    expect(text).toContain("migrate status");
  });

  it("says why when the migration has no checkable table", () => {
    const text = manualResolveInstructions("20990101000000_alter_only", []);
    expect(text).toContain("creates no table");
    expect(text).toContain("--rolled-back 20990101000000_alter_only");
  });
});
