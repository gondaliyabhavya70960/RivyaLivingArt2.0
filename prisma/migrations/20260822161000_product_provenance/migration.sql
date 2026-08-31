-- Cross-tier provenance (benchmark gap 3): implicit self m2m join table for
-- Product.madeWith / Product.usedIn. (The trigram indexes the schema diff
-- suggested dropping are raw-SQL search indexes — deliberately untouched.)
-- CreateTable
CREATE TABLE "_ProductProvenance" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductProvenance_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProductProvenance_B_index" ON "_ProductProvenance"("B");

-- AddForeignKey
ALTER TABLE "_ProductProvenance" ADD CONSTRAINT "_ProductProvenance_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductProvenance" ADD CONSTRAINT "_ProductProvenance_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
