-- Phase 9 — when the studio last edited a product.
--
-- `ownerTouched` already says THAT a human edited a row. This says WHEN, which
-- is what conflict detection needs in order to decide whether the sheet or the
-- studio holds the newer version. Nullable: existing rows genuinely do not
-- know, and guessing a timestamp would be worse than admitting that.

ALTER TABLE "Product" ADD COLUMN "studioEditedAt" TIMESTAMP(3);
