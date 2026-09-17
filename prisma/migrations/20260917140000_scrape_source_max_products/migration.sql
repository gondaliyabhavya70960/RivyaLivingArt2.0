-- A source's own ceiling on how many products one run may stage. The owner
-- asked for "the top ~500 products per tier" from the reference sites; a run
-- had no ceiling but the 40-page cap, which is 4,000 rows from a WooCommerce
-- store and 10,000 from a Shopify one. NULL keeps the old behaviour.
ALTER TABLE "ScrapeSource" ADD COLUMN "maxProducts" INTEGER;
