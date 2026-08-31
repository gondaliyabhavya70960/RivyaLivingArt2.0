-- Mobile crop + focal point for the editorial image slots.
--
-- Additive and defaulted: an existing row gets focal (0.5, 0.5), which is what
-- object-position already resolves to, and a null mobileUrl, which renders the
-- desktop file at every width — exactly the behaviour before this migration.
-- So the storefront is byte-identical until an owner sets one.
ALTER TABLE "SiteImage"
  ADD COLUMN "mobileUrl"     TEXT,
  ADD COLUMN "mobileMediaId" TEXT,
  ADD COLUMN "focalX"        DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "focalY"        DOUBLE PRECISION NOT NULL DEFAULT 0.5;
