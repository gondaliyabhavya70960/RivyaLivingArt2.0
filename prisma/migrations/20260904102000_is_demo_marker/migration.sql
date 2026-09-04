-- B0 commit 3 — the demo-content marker.
--
-- The Content Lab (roadmap Phase 15) needs a way to tell synthetic rows from
-- the owner's real ones that survives every read path. Until now the only
-- convention was a "DEMO" title prefix, applied at seven read sites and
-- forgotten at four others — exactly the leak a column prevents. Every
-- content table that a visitor can reach gains `isDemo`, defaulted false, so
-- every existing row is untouched and the public readers can add one clause.
--
-- Product carries 4,385 rows: a constant-default ADD COLUMN is metadata-only
-- on Postgres >= 11 (no rewrite), but it still takes a brief ACCESS EXCLUSIVE
-- lock — deploy off-peak, as 20260822162000_product_owner_touched was.
-- No index on Product.isDemo: a boolean that is false on every real row
-- composes with the existing status indexes, and a partial index cannot be
-- expressed in schema.prisma without creating permanent drift.
--
-- SiteSettings.demoContentPublic is the owner's switch: demo rows render on
-- the public site only when it is on (or the deployment is not production).
-- Default off — turning it on is a deliberate act, never a side effect.
ALTER TABLE "Product"      ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BlogPost"     ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BlogCategory" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Portfolio"    ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Faq"          ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomPage"   ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Media"        ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inquiry"      ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScrapeJob"    ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ImportRun"    ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SiteSettings" ADD COLUMN "demoContentPublic" BOOLEAN NOT NULL DEFAULT false;
