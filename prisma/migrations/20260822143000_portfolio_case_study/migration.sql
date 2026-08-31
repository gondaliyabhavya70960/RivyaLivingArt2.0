-- Case-study narrative + editorial card meta (audit CS-01). All optional:
-- public sections render only when the owner fills them.
ALTER TABLE "Portfolio" ADD COLUMN "brief" TEXT;
ALTER TABLE "Portfolio" ADD COLUMN "process" TEXT;
ALTER TABLE "Portfolio" ADD COLUMN "clientNote" TEXT;
ALTER TABLE "Portfolio" ADD COLUMN "location" TEXT;
ALTER TABLE "Portfolio" ADD COLUMN "year" INTEGER;
