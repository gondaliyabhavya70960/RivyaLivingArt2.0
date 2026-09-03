-- Testimonial system (plan B0 · 1): a testimonial becomes a reviewed piece of
-- content rather than a bare quote row.
--
-- Until now every Testimonial row was live the moment it existed — the studio
-- form, the bulk importer and the public resolver all agreed that "in the
-- table" meant "on the homepage". That left no room for a quote that is still
-- being checked, one the customer has not yet agreed to publish, or a demo
-- fixture that must never reach a visitor. This migration adds the lifecycle
-- (status + permission), the provenance (which product or case the words are
-- about), the richer media (an installation photograph, a film, its poster)
-- and the audit trail (who verified it, when).
--
-- Additive only. Every column is either nullable or carries a default, so the
-- ALTER is a metadata change and the lock is held for milliseconds. The two
-- new foreign keys are ON DELETE SET NULL: deleting a product or a case study
-- must never delete a customer's words.
--
-- The one non-obvious statement is the UPDATE. `status` defaults to DRAFT so
-- that NEW rows — a studio save, an imported sheet row — start unpublished
-- and have to be reviewed. But every row that exists today is live on the
-- site, and a deploy must not change what visitors see, so the back-fill sets
-- every existing row to PUBLISHED before the public resolver starts filtering
-- on it. Fresh databases have no rows and the UPDATE is a no-op.

CREATE TYPE "TestimonialStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "PermissionStatus" AS ENUM ('UNKNOWN', 'REQUESTED', 'GRANTED', 'DECLINED');

ALTER TABLE "Testimonial"
  ADD COLUMN "status" "TestimonialStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "designation" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "givenAt" TIMESTAMP(3),
  ADD COLUMN "language" TEXT,
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "portfolioId" TEXT,
  ADD COLUMN "productTitle" TEXT,
  ADD COLUMN "purchaseType" TEXT,
  ADD COLUMN "mediaId" TEXT,
  ADD COLUMN "installationImageUrl" TEXT,
  ADD COLUMN "installationMediaId" TEXT,
  ADD COLUMN "videoUrl" TEXT,
  ADD COLUMN "videoPosterUrl" TEXT,
  ADD COLUMN "internalNotes" TEXT,
  ADD COLUMN "permissionStatus" "PermissionStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Every existing row is live today; the site must not change on deploy.
UPDATE "Testimonial" SET "status" = 'PUBLISHED';

ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_portfolioId_fkey"
  FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The public resolver filters status (+ featured) and orders by `order`; the
-- PDP and case-study readers filter by the linked row; the demo gate filters
-- isDemo on every public read.
CREATE INDEX "Testimonial_status_featured_order_idx" ON "Testimonial"("status", "featured", "order");
CREATE INDEX "Testimonial_productId_idx" ON "Testimonial"("productId");
CREATE INDEX "Testimonial_portfolioId_idx" ON "Testimonial"("portfolioId");
CREATE INDEX "Testimonial_isDemo_idx" ON "Testimonial"("isDemo");
