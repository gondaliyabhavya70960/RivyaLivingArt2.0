-- Phase 7 — put the owner in charge of the sheet → catalog fill.
--
-- The importer has always run on every deploy (bootstrap.ts shells out to
-- prisma/import-tiers.ts). This does not change that: all three settings
-- default to today's behaviour, so a fresh environment still self-populates
-- from the sheet on first boot. What changes is that it can now be turned
-- off, capped, and — for the first time — seen.

ALTER TABLE "SiteSettings"
  ADD COLUMN "sheetFillEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sheetFillOnDeploy" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sheetFillMaxCreates" INTEGER;

-- The record of what each fill did. Previously this existed only as build-log
-- output, which nobody keeps.
CREATE TABLE "ImportRun" (
  "id" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "rowsRead" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "unchanged" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "abortedReason" TEXT,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportRun_startedAt_idx" ON "ImportRun"("startedAt");
