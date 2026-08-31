-- Human-readable inquiry reference (#RR-<number>) — DESIGN.md E6 Phase 3.
-- SERIAL backfills existing rows from the new sequence on ADD COLUMN.
ALTER TABLE "Inquiry" ADD COLUMN "number" SERIAL NOT NULL;

CREATE UNIQUE INDEX "Inquiry_number_key" ON "Inquiry"("number");
