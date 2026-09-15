-- Plan C phase 4 step 4b: drop the Google Sheets schema.
--
-- THIS IS THE ONLY DESTRUCTIVE MIGRATION IN THE PROJECT AND IT HAS NO REVERT.
-- Three things had to be true before it could be written, and all three are:
--
--   1. The CODE stopped reading these columns, and that change is DEPLOYED.
--      Not merged — deployed. `findMany()` with no `select` makes Prisma emit
--      an explicit column list, so a client that still knows about a dropped
--      column fails every query on its table. Step 4a (PR #74) removed the
--      fields from the schema; this waits for its production deployment.
--   2. The DATA was exported and committed: docs/archive/sheets-2026-09-15/.
--      `SheetSyncRun` was the only copy. It held exactly one row — a PUSH that
--      never ran, status UNCONFIGURED — but "thin" is not "expendable", and
--      that was established by reading it, not by assuming it.
--   3. The service account is revoked and the spreadsheet un-shared (step 6),
--      so nothing can write to this schema even in principle.
--
-- HAND-WRITTEN, the fifth time and for the fifth identical reason: alongside
-- these statements `prisma migrate diff` proposed
--
--     DROP INDEX "Product_description_trgm_idx";
--     DROP INDEX "Product_shortTagline_trgm_idx";
--     DROP INDEX "Product_title_trgm_idx";
--     ALTER TABLE "BlogPost"     ALTER COLUMN "authorName" SET DEFAULT …;
--     ALTER TABLE "SiteSettings" ALTER COLUMN "brandName"  SET DEFAULT …;
--
-- The indexes are raw SQL from 20260814050000_search_trgm and
-- 20260820120000_search_trgm_description that schema.prisma does not model, so
-- diff reads them as drift. In a migration that is ALREADY dropping things,
-- shipping the generated file would have deleted the storefront's search
-- indexes under cover of an expected deletion — the worst version of this
-- mistake, because the diff would have looked plausible.

-- The retry drain's index. Dropping the column would take it anyway; naming it
-- keeps the statement list honest about everything that disappears here.
DROP INDEX IF EXISTS "ScrapedProduct_sheetSyncStatus_idx";

-- AlterTable — the per-source push policy and its last-run bookkeeping.
ALTER TABLE "ScrapeSource"
  DROP COLUMN "sheetSyncPolicy",
  DROP COLUMN "lastSheetSyncAt",
  DROP COLUMN "lastSheetSyncError";

-- AlterTable — job-level "a push ran".
ALTER TABLE "ScrapeJob" DROP COLUMN "sheetSynced";

-- AlterTable — per-row push state.
ALTER TABLE "ScrapedProduct"
  DROP COLUMN "sheetSyncStatus",
  DROP COLUMN "sheetSyncedAt",
  DROP COLUMN "sheetSyncError";

-- DropTable — the push history itself, archived above.
DROP TABLE "SheetSyncRun";

-- DropEnum — last, because the columns above were the only things using them.
DROP TYPE "SheetSyncPolicy";
DROP TYPE "SheetSyncStatus";
