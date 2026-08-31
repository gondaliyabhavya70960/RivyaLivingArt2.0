-- Phase 10 — remember what a price was.
--
-- Append-only by design: nothing in the codebase updates or deletes a point.
-- Overwriting the most recent one would turn a price history into a price.
--
-- Plain ids rather than foreign keys, on purpose. History outlives the staged
-- row it came from: a scrape job can be deleted to tidy the queue, and losing
-- months of price movement along with it would be a poor trade.

CREATE TABLE "PriceHistory" (
  "id" TEXT NOT NULL,
  "scrapedProductId" TEXT,
  "productId" TEXT,
  "sourceKey" TEXT NOT NULL,
  "priceMin" INTEGER,
  "priceMax" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- The three ways the series is read: by staged row, by catalog product, and
-- by source for a whole-catalogue view.
CREATE INDEX "PriceHistory_scrapedProductId_capturedAt_idx" ON "PriceHistory"("scrapedProductId", "capturedAt");
CREATE INDEX "PriceHistory_productId_capturedAt_idx" ON "PriceHistory"("productId", "capturedAt");
CREATE INDEX "PriceHistory_sourceKey_capturedAt_idx" ON "PriceHistory"("sourceKey", "capturedAt");
