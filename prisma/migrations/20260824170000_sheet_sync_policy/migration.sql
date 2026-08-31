-- Phase 5 — gate the scrape→sheet push behind a per-source policy.
--
-- Additive and defaulted, so every existing source keeps today's behaviour:
-- nothing fires on its own. MANUAL is not a new restriction, it is what the
-- code already did — no completion hook existed — now written down and made
-- changeable.

CREATE TYPE "SheetSyncPolicy" AS ENUM ('MANUAL', 'ON_COMPLETE', 'OFF');
CREATE TYPE "SheetSyncStatus" AS ENUM ('NOT_SYNCED', 'SYNC_PENDING', 'SYNCED', 'SYNC_FAILED');

ALTER TABLE "ScrapeSource"
  ADD COLUMN "sheetSyncPolicy" "SheetSyncPolicy" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "lastSheetSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastSheetSyncError" TEXT;

-- Per-row state. The job-level ScrapeJob.sheetSynced flag says a push RAN;
-- it cannot say which rows made it, which is exactly what a retry needs.
ALTER TABLE "ScrapedProduct"
  ADD COLUMN "sheetSyncStatus" "SheetSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
  ADD COLUMN "sheetSyncedAt" TIMESTAMP(3),
  ADD COLUMN "sheetSyncError" TEXT;

-- The retry drain filters on this; tens of thousands of staged rows exist.
CREATE INDEX "ScrapedProduct_sheetSyncStatus_idx" ON "ScrapedProduct"("sheetSyncStatus");
