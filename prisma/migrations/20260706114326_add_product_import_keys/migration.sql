-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "importSource" TEXT,
ADD COLUMN     "importRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_importSource_importRef_key" ON "Product"("importSource", "importRef");
