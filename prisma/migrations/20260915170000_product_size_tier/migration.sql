-- The owner's three-tier PRODUCT architecture, on its own column.
-- docs/plan/07-three-tier-architecture.md
--
--   LARGE_FORMAT   Collectible Furniture & Spatial Art
--   MEDIUM_FORMAT  Memory & Celebration Art
--   SMALL_FORMAT   Personal Art & Gifting
--
-- WHY A NEW COLUMN RATHER THAN `Product.tier`. That column is taken: it is the
-- owner-sheet IMPORT tier (1 owner · 2 resin goods · 3 supplies · 4 3D-print),
-- an indexed Int written by `tier-fill.ts` from data/tiers/*.csv.gz and read by
-- the shop's default sort, the search group ranking, `groupForTier`, the import
-- validator, the confirmed export and the demo fixtures. Retyping it would be a
-- rename of an indexed column that live queries sort on — and this migration
-- reaches PRODUCTION on push, while the old client is still running.
--
-- ADDITIVE ONLY, and every statement is backward compatible with the currently
-- deployed client: a new type it never names, a nullable column it never
-- selects, and an index that changes no result.
--
-- NO BACKFILL. Not one UPDATE. There is no rule that could assign a tier
-- without inventing it, and this file runs against production before any screen
-- exists to check what it did. The ~4,385 existing rows stay NULL and are
-- tiered by the owner from the studio.
CREATE TYPE "ProductSizeTier" AS ENUM ('LARGE_FORMAT', 'MEDIUM_FORMAT', 'SMALL_FORMAT');

ALTER TABLE "Product" ADD COLUMN "sizeTier" "ProductSizeTier";

-- Matches the shape every tier-filtered read will take (tier + status), and
-- mirrors the existing `Product_tier_status_idx`.
CREATE INDEX "Product_sizeTier_status_idx" ON "Product"("sizeTier", "status");
