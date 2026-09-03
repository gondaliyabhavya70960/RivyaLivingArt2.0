-- B0 commit 4 — a status on FAQs.
--
-- Faq was the last content model on which every saved row was live: the
-- Studio had no way to hold a half-written answer back. The column defaults
-- to PUBLISHED so every existing row keeps rendering exactly as today, and
-- uses a value the ContentStatus type has carried since its creation, so
-- this file has no ordering dependency on 20260904101000 (which added
-- REVIEW and ARCHIVED). Every public FAQ reader now selects PUBLISHED.
ALTER TABLE "Faq" ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED';
