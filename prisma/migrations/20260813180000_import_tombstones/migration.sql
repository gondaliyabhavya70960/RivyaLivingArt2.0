-- Tombstones for sheet-imported products deleted by the owner (audit H5):
-- the deploy-time importer honors these so deletions never resurrect.
CREATE TABLE "DeletedImport" (
    "id" TEXT NOT NULL,
    "importSource" TEXT NOT NULL,
    "importRef" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeletedImport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeletedImport_importSource_importRef_key" ON "DeletedImport"("importSource", "importRef");
