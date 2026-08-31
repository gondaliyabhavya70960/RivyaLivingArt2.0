-- Editorial display name (audit N-01): short name for cards/PDP heroes; the
-- long SEO title stays canonical for metadata, schema.org and WhatsApp.
ALTER TABLE "Product" ADD COLUMN "displayName" TEXT;
