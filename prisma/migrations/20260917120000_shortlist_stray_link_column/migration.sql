-- Removes what an ABANDONED branch's preview build left on production, and
-- nothing else. On 2026-09-16 at 08:16 UTC a preview of
-- `feat/b8-analytics-opportunity-score` applied its own migration
-- (`20260916210000_analytics_opportunity`, never merged) against the
-- production database: the two B8 tables in that branch's shape, plus a
-- `ShortlistEntry.linkedOpportunityId` column with an index and a foreign
-- key onto its `OpportunityScore`. The B8 that merged (#84) decided that
-- column stays ABSENT — schema.prisma records why: OpportunityScore.
-- researchProductId IS the link — and its migration under a new name then
-- failed on "relation already exists", which blocked every deploy after it.
--
-- scripts/migrate-deploy.mjs's guard drops the two stray tables (and the
-- foreign key onto them) before re-applying B8; the column and its index sit
-- on a table B8 did not create, so the guard never touches them. This
-- migration does, once the record is healed and B8 and B9 have applied.
--
-- WHY THE TWO-PR DROP RULE DOES NOT APPLY. That rule exists because the
-- currently DEPLOYED Prisma client asks for every column it knows, so a
-- column must leave schema.prisma and be deployed before it leaves the
-- database. No client ever deployed to production knew this column: it was
-- only ever in that abandoned branch's preview builds, and schema.prisma on
-- main has never carried it. Everywhere else — CI's throwaway Postgres, a
-- local database, a fresh environment — none of these objects exist and the
-- three statements are no-ops, which is what IF EXISTS is for.
--
-- HAND-WRITTEN, like every migration here since 20260915140000: `prisma
-- migrate diff` still wants to drop the raw-SQL trgm search indexes that
-- schema.prisma does not model.

ALTER TABLE "ShortlistEntry" DROP CONSTRAINT IF EXISTS "ShortlistEntry_linkedOpportunityId_fkey";
DROP INDEX IF EXISTS "ShortlistEntry_linkedOpportunityId_idx";
ALTER TABLE "ShortlistEntry" DROP COLUMN IF EXISTS "linkedOpportunityId";
