-- Custom landing pages: a page the owner invents, assembled from a small
-- catalogue of blocks.
--
-- Additive and self-contained. Nothing outside /p/[slug] reads these tables,
-- so this applies against a live database while the previous build serves.
CREATE TABLE "CustomPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImage" TEXT,
    "translations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CustomPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomPage_slug_key" ON "CustomPage"("slug");
CREATE INDEX "CustomPage_status_publishAt_idx" ON "CustomPage"("status", "publishAt");

CREATE TABLE "CustomBlock" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "translations" JSONB,

    CONSTRAINT "CustomBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomBlock_pageId_order_idx" ON "CustomBlock"("pageId", "order");

ALTER TABLE "CustomBlock" ADD CONSTRAINT "CustomBlock_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "CustomPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
