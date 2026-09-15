-- The governance gate: a registered source is not an authorised one.
--
-- HAND-WRITTEN, for the fourth time, and for the same reason. `prisma migrate
-- diff` proposed these two enums and five columns together with:
--
--     DROP INDEX "Product_description_trgm_idx";
--     DROP INDEX "Product_shortTagline_trgm_idx";
--     DROP INDEX "Product_title_trgm_idx";
--     ALTER TABLE "BlogPost"     ALTER COLUMN "authorName" SET DEFAULT …;
--     ALTER TABLE "SiteSettings" ALTER COLUMN "brandName"  SET DEFAULT …;
--
-- The three indexes are raw SQL from 20260814050000_search_trgm and
-- 20260820120000_search_trgm_description, which schema.prisma does not model,
-- so diff reads them as drift — shipping the generated file would delete the
-- storefront's search indexes in production. The two defaults are unrelated to
-- this change and belong to whoever introduces them.
--
-- ADDITIVE ONLY, which is what makes it safe to push. A preview build runs
-- `migrate deploy` against production, so between this push and its merge
-- production runs OLD code against this schema. Old code does not know these
-- columns exist, and every one of them has a default or is nullable.

-- CreateEnum
CREATE TYPE "CollectionMode" AS ENUM ('HTTP', 'MANUAL_RESEARCH');

-- CreateEnum
CREATE TYPE "PolicyReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'BLOCKED');

-- AlterTable
ALTER TABLE "ScrapeSource"
  ADD COLUMN "collectionMode"     "CollectionMode"     NOT NULL DEFAULT 'HTTP',
  ADD COLUMN "policyReviewStatus" "PolicyReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "policyReviewedAt"   TIMESTAMP(3),
  ADD COLUMN "policyReviewedBy"   TEXT,
  ADD COLUMN "policyReviewNote"   TEXT;

-- Backfill the one row where a policy review has ALREADY been done and
-- written down. `poonam-shah-art` carries, in the curated registry itself:
--
--     "NO scrapeable catalog (verified: enquiry-only). Do NOT scrape …"
--
-- That is a recorded review with a NO in it, and leaving it at the PENDING
-- default would lose a decision somebody already made. Every other source
-- stays PENDING, because nothing in this repo records that anyone read its
-- robots rules or its terms, and inventing an approval to spare the owner a
-- click would make the column decorative on the day it shipped.
UPDATE "ScrapeSource"
SET "collectionMode"     = 'MANUAL_RESEARCH',
    "policyReviewStatus" = 'BLOCKED',
    "policyReviewedAt"   = NOW(),
    "policyReviewedBy"   = 'curated registry (seed-data.ts)',
    "policyReviewNote"   = 'NO scrapeable catalog (verified: enquiry-only). Do NOT scrape.'
WHERE "key" = 'poonam-shah-art';
