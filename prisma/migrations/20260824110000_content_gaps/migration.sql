-- Phase I — the three content gaps that were schema gaps.
--
-- All additive and all nullable, so every existing row is untouched and a
-- rollback is a column DROP. Each closes a bullet in CLAUDE.md's
-- "Known gaps (data, not design)".

-- 1 · Blog category names rendered English in all nine locales, because this
-- was the one content model the I3 translations pass missed. Same shape as
-- Faq/Testimonial/Page: { "<locale>": { "name": "…" } }.
ALTER TABLE "BlogCategory" ADD COLUMN "translations" JSONB;
-- Tags were never on the known-gaps list but carry the identical defect and
-- render beside the category on every post, so they are fixed in the same
-- pass rather than left as the next bullet.
ALTER TABLE "Tag" ADD COLUMN "translations" JSONB;

-- 2 · A gallery frame could carry a plate number and the row's own
-- description, but nothing about the frame itself. Caption is the owner's
-- words about THIS photograph; alt stays what it is, a description for
-- someone who cannot see it.
ALTER TABLE "PortfolioImage" ADD COLUMN "caption" TEXT;
ALTER TABLE "PortfolioImage" ADD COLUMN "translations" JSONB;

-- 3 · Media recorded everything about an asset except where it came from,
-- so the "AI Generated" filter and indicator could not be built.
CREATE TYPE "Provenance" AS ENUM ('UPLOAD', 'BUNDLED', 'AI');
ALTER TABLE "Media" ADD COLUMN "provenance" "Provenance";
