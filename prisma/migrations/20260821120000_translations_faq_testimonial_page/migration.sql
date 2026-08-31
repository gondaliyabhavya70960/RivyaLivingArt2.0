-- Per-locale content overrides for the remaining site-content models (I3,
-- Phase 6 follow-up). Nullable JSONB so every existing row is untouched: a
-- null value means "no translations", and the base (English) columns render
-- exactly as they do today. Shape:
--   { "<locale>": { "<field>": <value>, ... }, ... }
-- The base row is the default locale (English); missing locales/fields fall
-- back to it at render time.
ALTER TABLE "Faq" ADD COLUMN "translations" JSONB;
ALTER TABLE "Testimonial" ADD COLUMN "translations" JSONB;
ALTER TABLE "Page" ADD COLUMN "translations" JSONB;
