-- Human confirmation gates the final list (B7, plan §4 phase 6c + rule 8).
-- `ShortlistEntry` records where one researched product stands in the
-- seven-state funnel (NEW · REVIEW · SHORTLISTED · REJECTED · CONFIRMED ·
-- INSPIRATION_ONLY · DUPLICATE), who put it there, and why. The review inbox
-- is rebuilt on this table, and the new confirmed-products screen plus its
-- CSV/XLSX export read CONFIRMED and nothing else.
--
-- HAND-WRITTEN, for the sixth time, and for the same reason as
-- 20260915140000_source_policy_gate: `prisma migrate diff` still wants to
-- drop the raw-SQL trgm indexes schema.prisma does not model, and shipping
-- the generated file would delete the storefront's search indexes in
-- production.
--
-- ADDITIVE ONLY, which is what makes it safe to push. A preview build runs
-- `migrate deploy` against production, so between this push and its merge
-- production runs OLD code against this schema. Old code does not know this
-- table exists, and nothing here touches a table it reads.

-- CreateEnum
CREATE TYPE "ShortlistState" AS ENUM (
  'NEW', 'REVIEW', 'SHORTLISTED', 'REJECTED',
  'CONFIRMED', 'INSPIRATION_ONLY', 'DUPLICATE'
);

-- CreateTable
CREATE TABLE "ShortlistEntry" (
  "id"                TEXT PRIMARY KEY,
  "researchProductId" TEXT NOT NULL,
  "state"             "ShortlistState" NOT NULL DEFAULT 'NEW',
  "changedBy"         TEXT,
  "changedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note"              TEXT,
  "reason"            TEXT,
  "tags"              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);

-- One entry per researched product — this is the CURRENT state, not a
-- history; the audit trail of every move lives in "ActivityLog".
CREATE UNIQUE INDEX "ShortlistEntry_researchProductId_key"
  ON "ShortlistEntry"("researchProductId");
CREATE INDEX "ShortlistEntry_state_changedAt_idx"
  ON "ShortlistEntry"("state", "changedAt");

ALTER TABLE "ShortlistEntry"
  ADD CONSTRAINT "ShortlistEntry_researchProductId_fkey"
  FOREIGN KEY ("researchProductId") REFERENCES "ResearchProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the decisions the old review queue already recorded, mapped
-- forward exactly as plan §4 phase 6c prescribes:
--   PENDING → NEW · APPROVED → SHORTLISTED · REJECTED → REJECTED ·
--   IMPORTED → CONFIRMED.
-- Two deliberate choices:
--
-- 1. PENDING rows get NO entry. NEW is the implicit state of a researched
--    product nobody has touched, so writing thousands of 'NEW' rows would
--    record arrivals, not decisions. The one exception is a PENDING row that
--    carries a reviewer note — a note IS a human touch, and it must not
--    become invisible when the inbox stops reading ScrapedProduct.notes.
--
-- 2. changedBy stays NULL. The old queue never recorded who clicked, and
--    inventing an author for a decision nobody recorded would be fiction.
--    `reason` says where the row came from instead.
INSERT INTO "ShortlistEntry"
  ("id", "researchProductId", "state", "changedAt", "note", "reason")
SELECT
  'b7_' || rp.id,
  rp.id,
  CASE sp."reviewStatus"
    WHEN 'APPROVED' THEN 'SHORTLISTED'::"ShortlistState"
    WHEN 'REJECTED' THEN 'REJECTED'::"ShortlistState"
    WHEN 'IMPORTED' THEN 'CONFIRMED'::"ShortlistState"
    ELSE 'NEW'::"ShortlistState"
  END,
  CURRENT_TIMESTAMP,
  sp."notes",
  'backfill: reviewStatus ' || sp."reviewStatus"
FROM "ScrapedProduct" sp
JOIN "ResearchProduct" rp
  ON rp."sourceKey" = sp."sourceKey" AND rp."externalId" = sp."externalId"
WHERE sp."reviewStatus" IN ('APPROVED', 'REJECTED', 'IMPORTED')
   OR sp."notes" IS NOT NULL;
