-- The owner's own taxonomy: sources filed by the SIZE of work they sell.
--
--   LARGE_FORMAT   furniture, side tables, river tables
--   MEDIUM_FORMAT  varmala preservation, wall clocks, engagement trays
--   SMALL_FORMAT   rakhis, jewellery
--
-- ADDITIVE ONLY. Three new values on an existing enum; nothing is renamed,
-- nothing is dropped, and no row changes. The previous four values stay, so
-- the currently deployed client keeps reading every row it could read before.
--
-- `ALTER TYPE ... ADD VALUE` is safe inside Prisma's transaction on PG12+ so
-- long as the new value is not USED in the same transaction. It is not: no
-- statement here writes one.
ALTER TYPE "ScrapeTier" ADD VALUE 'LARGE_FORMAT';
ALTER TYPE "ScrapeTier" ADD VALUE 'MEDIUM_FORMAT';
ALTER TYPE "ScrapeTier" ADD VALUE 'SMALL_FORMAT';
