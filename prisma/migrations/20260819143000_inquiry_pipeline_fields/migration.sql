-- C1 inquiry pipeline (DESIGN.md Phase 4): QUOTED stage + owner-entered
-- pricing record and internal staff notes. Pricing is settled manually in
-- WhatsApp (Part 0) — these columns record it, nothing charges.
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'QUOTED' BEFORE 'CONFIRMED';

ALTER TABLE "Inquiry" ADD COLUMN "quotedPrice" INTEGER;
ALTER TABLE "Inquiry" ADD COLUMN "finalPrice" INTEGER;
ALTER TABLE "Inquiry" ADD COLUMN "staffNotes" TEXT;
