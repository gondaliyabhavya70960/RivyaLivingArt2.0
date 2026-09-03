-- B0 commit 9 — a journal post may point at a shop collection.
--
-- Journal categories (BlogCategory) and shop collections (Category) are
-- separate taxonomies on purpose; this is the optional cross-link that lets
-- an article about river tables surface the furniture collection beside it.
-- Nullable, set-null on delete, so no existing row and no deletion changes.
ALTER TABLE "BlogPost" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "BlogPost_categoryId_idx" ON "BlogPost"("categoryId");
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
