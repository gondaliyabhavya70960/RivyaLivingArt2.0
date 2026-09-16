-- B9 (plan §4 phase 8): ProductEmbedding — hash · model · version · vector.
--
-- HAND-WRITTEN, for the eighth time in this rebuild, because
-- `prisma migrate diff` output is a REFERENCE, never the migration: the
-- schema does not model the raw-SQL indexes earlier migrations created, so
-- generated diffs try to drop them. The table/index/FK statements below are
-- byte-identical to that diff (verified in CI review); the extension line is
-- the part Prisma cannot know.
--
-- ADDITIVE ONLY: one extension, one new table, its indexes, one FK. No
-- existing table, column, or index is touched.
--
-- pgvector is the plan's own choice ("Postgres + pgvector is adequate at this
-- corpus size; if the deployment cannot install the extension, the honest
-- answer is a managed vector service, not a hand-rolled index"). CI must run
-- on pgvector/pgvector:pg16, a drop-in postgres:16 replacement — the
-- workflow-file edit is documented in the PR body because the API token may
-- not touch workflow files.

CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "ProductEmbedding" (
    "id" TEXT NOT NULL,
    "researchProductId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "vector" vector(512) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductEmbedding_researchProductId_model_key" ON "ProductEmbedding"("researchProductId", "model");

-- CreateIndex
CREATE INDEX "ProductEmbedding_computedAt_idx" ON "ProductEmbedding"("computedAt");

-- AddForeignKey
ALTER TABLE "ProductEmbedding" ADD CONSTRAINT "ProductEmbedding_researchProductId_fkey" FOREIGN KEY ("researchProductId") REFERENCES "ResearchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
