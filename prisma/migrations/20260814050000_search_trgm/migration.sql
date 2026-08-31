-- M-P3: trigram GIN indexes for the unanchored ILIKE searches on /search and
-- /shop?q= (`title ILIKE '%q%' OR "shortTagline" ILIKE '%q%'`), which
-- otherwise sequential-scan the full Product table on every keystroke-sized
-- query against a 4,373-product published catalog.
--
-- NOTE: these indexes are deliberately NOT declared in prisma/schema.prisma.
-- Expressing a GIN index with the `gin_trgm_ops` operator class requires
-- Prisma preview features this project does not enable, so the index lives in
-- migration history only. `prisma migrate diff` reporting drift for these two
-- indexes (and the pg_trgm extension) against the schema is expected and
-- harmless — do not "fix" it by dropping them.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_title_trgm_idx"
  ON "Product" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_shortTagline_trgm_idx"
  ON "Product" USING GIN ("shortTagline" gin_trgm_ops);
