-- Workstream B, phase 6a: stable product identity + an immutable snapshot trail.
--
-- ADDITIVE ONLY. Two new tables, their indexes, and one foreign key between
-- them. Nothing existing is renamed, altered or dropped, which is what makes
-- this safe to push: a Vercel PREVIEW build runs `prisma migrate deploy`
-- against the PRODUCTION database, so between a push and its merge production
-- runs the OLD code against this schema. Old code does not know these tables
-- exist and is unaffected by them.
--
-- HAND-WRITTEN, deliberately. `prisma migrate diff` generated this plus three
-- DROP INDEX statements for `Product_{title,shortTagline,description}_trgm_idx`
-- and two ALTER COLUMN default changes. Those indexes are real and intentional
-- — created by `20260814050000_search_trgm` and
-- `20260820120000_search_trgm_description` as raw SQL, which schema.prisma
-- does not model, so `diff` reads them as drift and proposes dropping them.
-- Shipping that would have deleted the storefront's search indexes in
-- production. Check generated migrations against the statements you meant.

-- CreateTable
CREATE TABLE "ResearchProduct" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSnapshot" (
    "id" TEXT NOT NULL,
    "researchProductId" TEXT NOT NULL,
    "jobId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "ProductSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchProduct_lastSeen_idx" ON "ResearchProduct"("lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchProduct_sourceKey_externalId_key" ON "ResearchProduct"("sourceKey", "externalId");

-- CreateIndex
CREATE INDEX "ProductSnapshot_researchProductId_capturedAt_idx" ON "ProductSnapshot"("researchProductId", "capturedAt");

-- CreateIndex
CREATE INDEX "ProductSnapshot_contentHash_idx" ON "ProductSnapshot"("contentHash");

-- AddForeignKey
ALTER TABLE "ProductSnapshot" ADD CONSTRAINT "ProductSnapshot_researchProductId_fkey" FOREIGN KEY ("researchProductId") REFERENCES "ResearchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
