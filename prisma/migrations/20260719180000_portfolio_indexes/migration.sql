-- Portfolio was queried by `status` (+ `createdAt` ordering) for the public
-- list, home highlights and sitemap, and by `categoryId` + `status` for the
-- detail-page "related" rail — with no supporting index, so every one of those
-- was a sequential scan + in-memory sort. Product and BlogPost already carry
-- the equivalent indexes; this brings Portfolio in line (PERF audit).
CREATE INDEX "Portfolio_status_createdAt_idx" ON "Portfolio"("status", "createdAt");
CREATE INDEX "Portfolio_categoryId_status_idx" ON "Portfolio"("categoryId", "status");
