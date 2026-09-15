-- Reverts 20260915090000_import_conflict_rename at the DATABASE level.
--
-- WHY: preview deployments run `prisma migrate deploy` against the SAME
-- database as production (verified in the build log — the same build then ran
-- import-tiers over 1000 real catalog rows). So a migration reaches production
-- the moment a branch is pushed, long before its code is merged and deployed.
--
-- That makes a RENAME uniquely unsafe here, in a way an additive migration is
-- not: for the window between the preview build and the merge, production runs
-- OLD code against a NEW schema. `db.sheetConflict` and
-- `SiteSettings.sheetFillEnabled` stop existing, which breaks the Studio's
-- sheet-import screens, its settings form and the dashboard inbox — while the
-- public storefront, which touches none of them, stays up.
--
-- The plan said `@@map keeps the table` and I overrode it, reasoning that a
-- model/table mismatch is its own readability trap. The plan was right and the
-- reasoning was wrong: @@map renames in Prisma-land only, which is backward
-- compatible with running code and therefore the only safe way to rename
-- against a shared database.
--
-- So the database goes back to the names it had, and the rename survives where
-- it was always meant to be — in the code that humans read. The @map
-- annotations in schema.prisma carry the old names, and the columns they point
-- at are dropped wholesale by phase 4's drop migration anyway.

ALTER TABLE "ImportConflict" RENAME CONSTRAINT "ImportConflict_importRunId_fkey" TO "SheetConflict_importRunId_fkey";
ALTER TABLE "ImportConflict" RENAME CONSTRAINT "ImportConflict_productId_fkey" TO "SheetConflict_productId_fkey";
ALTER TABLE "ImportConflict" RENAME CONSTRAINT "ImportConflict_pkey" TO "SheetConflict_pkey";

ALTER INDEX "ImportConflict_status_createdAt_idx" RENAME TO "SheetConflict_status_createdAt_idx";
ALTER INDEX "ImportConflict_productId_idx" RENAME TO "SheetConflict_productId_idx";

ALTER TABLE "ImportConflict" RENAME COLUMN "importedValue" TO "sheetValue";
ALTER TABLE "ImportConflict" RENAME TO "SheetConflict";

ALTER TABLE "SiteSettings" RENAME COLUMN "catalogFillEnabled" TO "sheetFillEnabled";
ALTER TABLE "SiteSettings" RENAME COLUMN "catalogFillOnDeploy" TO "sheetFillOnDeploy";
ALTER TABLE "SiteSettings" RENAME COLUMN "catalogFillMaxCreates" TO "sheetFillMaxCreates";
