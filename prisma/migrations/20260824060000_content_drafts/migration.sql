-- Staged edits and revision history for the content layers.
--
-- Additive and nullable throughout: a row with no draft behaves exactly as it
-- did before, and an empty ContentRevision table is simply an empty history.
-- Safe against a live database while the previous build is still serving.
ALTER TABLE "SiteCopy"  ADD COLUMN "draftValue" TEXT;
ALTER TABLE "SiteImage" ADD COLUMN "draft" JSONB;

CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "summary" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentRevision_surface_createdAt_idx" ON "ContentRevision"("surface", "createdAt");
