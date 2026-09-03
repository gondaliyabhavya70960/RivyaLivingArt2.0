-- B0 commit 11 — the research library.
--
-- ScrapedProduct is immutable, needs a job and a unique (sourceKey,
-- externalId); a hand-entered note about a website has none of those, so
-- research gets its own table. RESEARCH is structurally separate from
-- PRODUCTION (Product); nothing here can become a public product without
-- the owner creating one. `images` holds URLs, so media-usages.ts registers
-- it in the same commit.
CREATE TABLE "ResearchRecord" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "materials" TEXT,
    "dimensions" TEXT,
    "price" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "extractedAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RESEARCH',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchRecord_status_createdAt_idx" ON "ResearchRecord"("status", "createdAt");
