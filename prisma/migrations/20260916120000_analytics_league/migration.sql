-- Fair comparison (B6): a coaster is never benchmarked against a dining
-- table, and a bag of pigment is never benchmarked against a finished
-- console. `AnalyticsLeague` records which market a source sells into, so the
-- analytics queries (B8) can keep like with like — enforced in the query
-- itself, not in a UI filter a user can clear.
--
-- HAND-WRITTEN, for the fifth time, and for the same reason as
-- 20260915140000_source_policy_gate: `prisma migrate diff` still wants to
-- drop the raw-SQL trgm indexes schema.prisma does not model, and shipping
-- the generated file would delete the storefront's search indexes in
-- production.
--
-- ADDITIVE ONLY, which is what makes it safe to push. A preview build runs
-- `migrate deploy` against production, so between this push and its merge
-- production runs OLD code against this schema. Old code does not know this
-- column exists, and it has a default.

-- CreateEnum
CREATE TYPE "AnalyticsLeague" AS ENUM ('FINISHED_ART', 'MATERIALS_DIY', 'MARKETPLACE_B2B');

-- AlterTable
ALTER TABLE "ScrapeSource"
  ADD COLUMN "analyticsLeague" "AnalyticsLeague" NOT NULL DEFAULT 'FINISHED_ART';

-- Backfill the one league decision that is ALREADY recorded, in another
-- column: the owner-set `supply` flag. A source flagged as a supplies catalog
-- (moulds, pigments, kits — "huge, capped runs", per the flag's own comment)
-- sells materials for MAKING resin art, not finished art, so it belongs to
-- MATERIALS_DIY. Every other source keeps the FINISHED_ART default: nothing
-- in this repo records that any source is a B2B marketplace, and inventing a
-- classification to make the backfill look busier would make the column
-- decorative on the day it shipped. The owner reclassifies individual sources
-- from the Studio source page, which is exactly where the collection-mode
-- and policy-review decisions already live.
UPDATE "ScrapeSource"
SET "analyticsLeague" = 'MATERIALS_DIY'
WHERE "supply" = true;
