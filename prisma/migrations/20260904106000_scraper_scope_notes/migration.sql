-- B0 commit 7 — scraper: reviewer notes, a job scope, a heartbeat.
--
-- `ScrapedProduct.notes` is the one mutable field on an otherwise immutable
-- staged row (the review screen's notes; content stays what the site said).
-- `ScrapeJob.scope` records whether a job covered the whole source, one
-- listing URL or one product page — today every job is SOURCE, hence the
-- default. `ScrapeJob.updatedAt` is the heartbeat the stale-RUNNING reclaim
-- reads: a job that died mid-run stays RUNNING forever today and blocks its
-- source. All additive; defaults keep every existing row valid.
CREATE TYPE "ScrapeScope" AS ENUM ('SOURCE', 'CATEGORY', 'URL');
ALTER TABLE "ScrapedProduct" ADD COLUMN "notes" TEXT;
ALTER TABLE "ScrapeJob" ADD COLUMN "scope" "ScrapeScope" NOT NULL DEFAULT 'SOURCE';
ALTER TABLE "ScrapeJob" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
