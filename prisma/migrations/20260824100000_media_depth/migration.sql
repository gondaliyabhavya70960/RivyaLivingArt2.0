-- Media depth: the metadata an asset should have carried since the first
-- upload, plus brand marks as settings.
--
-- Additive and all-nullable. Existing rows keep working with every new column
-- null: the library shows what it knows, and `finalizeAsset` fills the rest in
-- for anything uploaded from here on. A backfill is a separate, optional job —
-- nothing on the storefront depends on these being present.
ALTER TABLE "Media" ADD COLUMN "originalName" TEXT;
ALTER TABLE "Media" ADD COLUMN "alt" TEXT;
ALTER TABLE "Media" ADD COLUMN "checksum" TEXT;
ALTER TABLE "Media" ADD COLUMN "blurDataUrl" TEXT;
ALTER TABLE "Media" ADD COLUMN "dominantHex" TEXT;

-- Unique so the upload path can dedupe on it. Nulls do not collide in
-- Postgres, so every pre-existing row stays valid.
CREATE UNIQUE INDEX "Media_checksum_key" ON "Media"("checksum");

-- The default sharing picture is NOT here: SiteSettings.defaultSeo.ogImage
-- already holds it and the root layout already reads it. A second column for
-- the same picture would give it two owners.
ALTER TABLE "SiteSettings" ADD COLUMN "faviconUrl" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "appIconUrl" TEXT;
