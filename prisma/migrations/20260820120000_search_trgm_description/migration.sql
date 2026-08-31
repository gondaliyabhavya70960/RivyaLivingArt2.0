-- /search's secondary match ILIKEs Product.description, but only title and
-- shortTagline had trigram indexes — the OR forced a sequential scan of the
-- full catalog on a force-dynamic route (Phase 7 perf review). Large-ish
-- index (long text column) accepted: it turns every /search request's worst
-- query into a bitmap-OR of three GIN lookups.
CREATE INDEX IF NOT EXISTS "Product_description_trgm_idx"
  ON "Product" USING GIN ("description" gin_trgm_ops);
