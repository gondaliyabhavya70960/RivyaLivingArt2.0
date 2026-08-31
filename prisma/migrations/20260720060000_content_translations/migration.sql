-- Per-locale content overrides for the public catalog (I3). Nullable JSONB so
-- every existing row is untouched: a null value means "no translations", and
-- the base (English) columns render exactly as they do today. Shape:
--   { "<locale>": { "<field>": <value>, ... }, ... }
-- The base row is the default locale (English); missing locales/fields fall
-- back to it at render time.
ALTER TABLE "Product" ADD COLUMN "translations" JSONB;
ALTER TABLE "Category" ADD COLUMN "translations" JSONB;
ALTER TABLE "BlogPost" ADD COLUMN "translations" JSONB;
ALTER TABLE "Portfolio" ADD COLUMN "translations" JSONB;
