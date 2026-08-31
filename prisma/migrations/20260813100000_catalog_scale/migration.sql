-- Catalog-scale columns for the four-tier owner-sheet import (2026-08-13):
-- tier drives merchandising/filtering, inStock carries sheet availability,
-- sourceHash lets deploy-time re-imports skip unchanged rows. Indexes cover
-- the newest/price sorts and tier filters the shop now offers.
ALTER TABLE "Product" ADD COLUMN "tier" INTEGER;
ALTER TABLE "Product" ADD COLUMN "inStock" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN "sourceHash" TEXT;

CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");
CREATE INDEX "Product_status_priceMin_idx" ON "Product"("status", "priceMin");
CREATE INDEX "Product_tier_status_idx" ON "Product"("tier", "status");
