-- C-tail (plan C, `docs/plan/03-sheets-removal.md` §2.3 + §4 step 4): drop
-- `SiteSettings.sheetId` and `SiteSettings.sheetTabIds` — the last Google
-- Sheets artifacts in the schema.
--
-- These columns have had no reader and no writer since the 2026-09-15
-- removal (the credentials env vars, the sync tables and the push engine are
-- long gone; the CSV catalog fill reads `data/tiers/*.csv.gz` and never
-- touched them). A drop of a dead column is the one destructive migration
-- that cannot break the preview-window: old code does not reference the
-- columns either, which is exactly what "dead" means.
--
-- HAND-WRITTEN, as every migration in this repo is: the schema does not
-- model the raw-SQL indexes earlier migrations created, so
-- `prisma migrate diff` output is a reference, never the migration. Verified
-- against that diff — it produces exactly these two drops and nothing else.

-- AlterTable
ALTER TABLE "SiteSettings" DROP COLUMN "sheetId",
DROP COLUMN "sheetTabIds";
