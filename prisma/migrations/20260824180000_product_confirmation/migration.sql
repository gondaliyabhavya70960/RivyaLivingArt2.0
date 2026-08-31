-- Phase 6 — only explicitly selected products reach the confirmed list.
--
-- CONFIRMED_PRODUCTS is defined as { p : p.confirmedAt IS NOT NULL }, and
-- nothing sets that except an operator pressing Confirm. Additive and
-- nullable: every existing product starts unconfirmed, which is correct —
-- none of them has been through the confirmation the feature introduces.

ALTER TABLE "Product"
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedById" TEXT;

-- The confirmed list is read whole on every sync.
CREATE INDEX "Product_confirmedAt_idx" ON "Product"("confirmedAt");
