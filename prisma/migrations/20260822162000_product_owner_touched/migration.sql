-- H5 merge-protection: rows the owner edited in the studio; sheet re-imports
-- refresh availability only, never content.
ALTER TABLE "Product" ADD COLUMN "ownerTouched" BOOLEAN NOT NULL DEFAULT false;
