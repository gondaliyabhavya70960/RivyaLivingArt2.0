-- Phase 11 — record what could not be extracted.
--
-- "The price is missing" and "the price is null because nobody looked" are
-- indistinguishable in a nullable column, and only one of them is a problem
-- somebody should fix.
--
-- One row per (staged product, field). Re-scraping the same broken field
-- updates that row rather than adding another, so the backlog measures how
-- many things are wrong — not how often we looked at them.

CREATE TABLE "ValidationFailure" (
  "id" TEXT NOT NULL,
  "scrapedProductId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "jobId" TEXT,
  "field" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'WARNING',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  CONSTRAINT "ValidationFailure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ValidationFailure_scrapedProductId_field_key" ON "ValidationFailure"("scrapedProductId", "field");
-- The triage screen groups by field within a status.
CREATE INDEX "ValidationFailure_status_field_idx" ON "ValidationFailure"("status", "field");
-- The per-source health view.
CREATE INDEX "ValidationFailure_sourceKey_status_idx" ON "ValidationFailure"("sourceKey", "status");
