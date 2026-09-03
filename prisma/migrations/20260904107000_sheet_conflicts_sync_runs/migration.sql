-- B0 commit 8 — Google Sheets: conflicts, push history, ids in settings.
--
-- SheetConflict records one field on one product where the sheet and an
-- owner edit disagree, instead of silently overwriting either side; the
-- sheet-import screen resolves them. SheetSyncRun is the push-side history
-- the screen never had (only ActivityLog held it). SiteSettings.sheetId and
-- sheetTabIds move the spreadsheet id and the tabs' numeric ids out of the
-- environment and the workflow file, with the environment as the fallback.
-- Status columns are TEXT with a code-side enum (the ImportRun.trigger
-- precedent) so a new state never needs an enum migration. No URL columns.
CREATE TABLE "SheetConflict" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "importRunId" TEXT,
    "field" TEXT NOT NULL,
    "sheetValue" TEXT,
    "dbValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "SheetConflict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SheetSyncRun" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SheetSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SheetConflict_status_createdAt_idx" ON "SheetConflict"("status", "createdAt");
CREATE INDEX "SheetConflict_productId_idx" ON "SheetConflict"("productId");
CREATE INDEX "SheetSyncRun_startedAt_idx" ON "SheetSyncRun"("startedAt");

ALTER TABLE "SheetConflict" ADD CONSTRAINT "SheetConflict_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetConflict" ADD CONSTRAINT "SheetConflict_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SiteSettings" ADD COLUMN "sheetId" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "sheetTabIds" JSONB NOT NULL DEFAULT '{}';
