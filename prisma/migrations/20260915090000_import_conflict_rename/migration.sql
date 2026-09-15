-- Plan C (Google Sheets removal), phase 4 step 2 — the ADDITIVE half.
--
-- Renames only. No table, column or enum is dropped here, so this migration is
-- reversible by the inverse statements and can ship on its own. The drops
-- (SheetSyncRun, the two enums, the six sync columns, SiteSettings.sheetId and
-- sheetTabIds) are a SEPARATE migration that runs only against a tree already
-- proven to work without the Sheets code paths.
--
-- Why rename at all: `SheetConflict` never had anything to do with Google
-- Sheets. It is written by `src/lib/import/tier-fill.ts`, which reads
-- `data/tiers/*.csv.gz` off disk — the catalog importer, and the one thing in
-- this subsystem that must survive the removal. Leaving it called "Sheet…"
-- through a Sheets deletion is how someone deletes catalog ingestion by
-- following the names. Same reasoning for SiteSettings.sheetFill*, which
-- governs that CSV fill and not a spreadsheet.
--
-- Index and constraint names are renamed alongside the table so the database
-- matches what Prisma would generate for the new model name; leaving them
-- would read as drift the next time anyone runs `prisma migrate dev`.

ALTER TABLE "SheetConflict" RENAME TO "ImportConflict";
ALTER TABLE "ImportConflict" RENAME COLUMN "sheetValue" TO "importedValue";

ALTER TABLE "ImportConflict" RENAME CONSTRAINT "SheetConflict_pkey" TO "ImportConflict_pkey";
ALTER TABLE "ImportConflict" RENAME CONSTRAINT "SheetConflict_productId_fkey" TO "ImportConflict_productId_fkey";
ALTER TABLE "ImportConflict" RENAME CONSTRAINT "SheetConflict_importRunId_fkey" TO "ImportConflict_importRunId_fkey";

ALTER INDEX "SheetConflict_status_createdAt_idx" RENAME TO "ImportConflict_status_createdAt_idx";
ALTER INDEX "SheetConflict_productId_idx" RENAME TO "ImportConflict_productId_idx";

ALTER TABLE "SiteSettings" RENAME COLUMN "sheetFillEnabled" TO "catalogFillEnabled";
ALTER TABLE "SiteSettings" RENAME COLUMN "sheetFillOnDeploy" TO "catalogFillOnDeploy";
ALTER TABLE "SiteSettings" RENAME COLUMN "sheetFillMaxCreates" TO "catalogFillMaxCreates";
