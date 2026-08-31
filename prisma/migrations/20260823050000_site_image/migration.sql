-- Named site-image slots: owner overrides for the storefront's editorial imagery.
-- Additive only; absence of a row means "render the bundled default".
CREATE TABLE "SiteImage" (
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mediaId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteImage_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "SiteImage_mediaId_idx" ON "SiteImage"("mediaId");
