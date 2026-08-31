-- MKT-201: first-touch marketing attribution captured client-side.
ALTER TABLE "Inquiry" ADD COLUMN "attribution" JSONB;
