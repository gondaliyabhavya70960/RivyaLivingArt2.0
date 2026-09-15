-- Workstream B, phase 6c: owner-editable normalization aliases.
--
-- ADDITIVE ONLY: one enum, one table, two indexes. Nothing renamed, altered
-- or dropped — the safe class, because a Vercel PREVIEW build applies this to
-- the PRODUCTION database on push while production still runs the OLD code.
--
-- HAND-WRITTEN, third time running: `prisma migrate diff` again proposed
-- dropping Product_{title,shortTagline,description}_trgm_idx, the raw-SQL
-- search indexes from 20260814050000_search_trgm and
-- 20260820120000_search_trgm_description that schema.prisma does not model.
-- CLAUDE.md: "Check a generated migration against the statements you meant."

-- CreateEnum
CREATE TYPE "AliasKind" AS ENUM ('UNIT', 'MATERIAL', 'RESIN_STYLE', 'COLOUR', 'PRODUCT_TYPE', 'AVAILABILITY');

-- CreateTable
CREATE TABLE "NormalizationAlias" (
    "id" TEXT NOT NULL,
    "kind" "AliasKind" NOT NULL,
    "rawValue" TEXT NOT NULL,
    "canonicalValue" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormalizationAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NormalizationAlias_kind_idx" ON "NormalizationAlias"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "NormalizationAlias_kind_rawValue_key" ON "NormalizationAlias"("kind", "rawValue");
