-- Analytics + opportunity score (B8, plan §4 phase 8).
--
-- `AnalyticsSnapshot` stores precomputed JSON payloads keyed by
-- view/league/scope/source, each stamped with computedAt · scrapeRunId ·
-- normalizerVersion · analyticsVersion, and each payload carrying the B8
-- proof: `computedFrom: { included, considered, exclusions }` — every
-- number shows how many rows it stands on and what was excluded and why.
-- `OpportunityScore` holds one row per formula COMPONENT (never a lone
-- total), so every recommendation is inspectable — plan rule 7.
--
-- HAND-WRITTEN, for the seventh time, and for the same reason as
-- 20260915140000_source_policy_gate: `prisma migrate diff` still wants to
-- drop the raw-SQL trgm indexes schema.prisma does not model, and shipping
-- the generated file would delete the storefront's search indexes in
-- production.
--
-- ADDITIVE ONLY, which is what makes it safe to push. A preview build runs
-- `migrate deploy` against production, so between this push and its merge
-- production runs OLD code against this schema. Old code does not know
-- these tables exist, and nothing here touches a table it reads.

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
  "id"                TEXT PRIMARY KEY,
  "view"              TEXT NOT NULL,
  -- "" in a key part means "not applicable to this view", NEVER "all" —
  -- a league part meaning "every league at once" would be the
  -- coaster-versus-dining-table comparison B6 exists to prevent.
  "league"            TEXT NOT NULL DEFAULT '',
  "scope"             TEXT NOT NULL DEFAULT '',
  "sourceKey"         TEXT NOT NULL DEFAULT '',
  "payload"           JSONB NOT NULL,
  "includedCount"     INTEGER NOT NULL,
  "consideredCount"   INTEGER NOT NULL,
  "computedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scrapeRunId"       TEXT,
  "normalizerVersion" TEXT NOT NULL,
  "analyticsVersion"  INTEGER NOT NULL
);

CREATE UNIQUE INDEX "AnalyticsSnapshot_view_league_scope_sourceKey_key"
  ON "AnalyticsSnapshot"("view", "league", "scope", "sourceKey");
CREATE INDEX "AnalyticsSnapshot_computedAt_idx"
  ON "AnalyticsSnapshot"("computedAt");

-- CreateTable
CREATE TABLE "OpportunityScore" (
  "id"                TEXT PRIMARY KEY,
  "researchProductId" TEXT NOT NULL,
  "component"         TEXT NOT NULL,
  "value"             DOUBLE PRECISION,
  "weight"            DOUBLE PRECISION NOT NULL,
  "contribution"      DOUBLE PRECISION NOT NULL,
  "detail"            TEXT NOT NULL,
  "analyticsVersion"  INTEGER NOT NULL,
  "computedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One row per (product, component) — the formula's inspectability IS the
-- schema. A recompute rewrites the set; these are derivations, not dated
-- records (D24 protects what a source said, not what we computed from it).
CREATE UNIQUE INDEX "OpportunityScore_researchProductId_component_key"
  ON "OpportunityScore"("researchProductId", "component");
CREATE INDEX "OpportunityScore_computedAt_idx"
  ON "OpportunityScore"("computedAt");

ALTER TABLE "OpportunityScore"
  ADD CONSTRAINT "OpportunityScore_researchProductId_fkey"
  FOREIGN KEY ("researchProductId") REFERENCES "ResearchProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
