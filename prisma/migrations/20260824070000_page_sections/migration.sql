-- Per-page section manifest: order, visibility and staged versions of both.
--
-- Additive. An empty table renders the registry's declared order with every
-- section visible, which is exactly what the pages do today — so this applies
-- against a live database while the previous build is still serving.
CREATE TABLE "PageSection" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "draftOrder" INTEGER,
    "draftVisible" BOOLEAN,
    "notes" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PageSection_pageKey_key_key" ON "PageSection"("pageKey", "key");
CREATE INDEX "PageSection_pageKey_order_idx" ON "PageSection"("pageKey", "order");
