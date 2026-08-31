-- Owner overrides for storefront copy: the text twin of SiteImage.
--
-- Additive only. An empty table renders the site byte-for-byte as the message
-- catalogues in /messages do, so this migration is safe to run against a live
-- database while the previous build is still serving traffic, and a rollback
-- needs no down-migration — the old code simply ignores the table.
CREATE TABLE "SiteCopy" (
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteCopy_pkey" PRIMARY KEY ("key","locale")
);

-- The resolver reads every override for ONE locale per request.
CREATE INDEX "SiteCopy_locale_idx" ON "SiteCopy"("locale");
