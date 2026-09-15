-- Workstream B, phase 6b (first slice): purchasable options, and what a price MEANS.
--
-- ADDITIVE ONLY: one new enum, one new table, its indexes and one foreign key.
-- Nothing existing is renamed, altered or dropped — the safe class, because a
-- Vercel PREVIEW build applies this to the PRODUCTION database on push, while
-- production is still running the OLD code.
--
-- HAND-WRITTEN, for the second time and the same reason: `prisma migrate diff`
-- again proposed dropping Product_{title,shortTagline,description}_trgm_idx.
-- Those are raw-SQL indexes from 20260814050000_search_trgm and
-- 20260820120000_search_trgm_description that schema.prisma does not model, so
-- diff reads them as drift. They back the storefront's search. See CLAUDE.md,
-- "Check a generated migration against the statements you meant."

-- CreateEnum
CREATE TYPE "PriceBasis" AS ENUM ('PER_PIECE', 'PER_AREA', 'STARTING_FROM', 'QUOTE_ONLY');

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "label" TEXT,
    "optionsJson" JSONB NOT NULL DEFAULT '{}',
    "priceMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "priceBasis" "PriceBasis" NOT NULL DEFAULT 'PER_PIECE',
    "available" BOOLEAN,
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "referenceReason" TEXT,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariant_snapshotId_idx" ON "ProductVariant"("snapshotId");

-- CreateIndex
CREATE INDEX "ProductVariant_priceBasis_idx" ON "ProductVariant"("priceBasis");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ProductSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
