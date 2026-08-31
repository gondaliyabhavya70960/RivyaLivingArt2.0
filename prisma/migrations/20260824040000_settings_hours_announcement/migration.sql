-- Opening hours, response note, and announcement scheduling.
--
-- Additive and defaulted. An empty businessHours renders nothing, so /contact
-- shows the address alone exactly as before; null announcement bounds mean the
-- strip behaves as it always has. Safe against a live database.
ALTER TABLE "SiteSettings"
  ADD COLUMN "businessHours"        JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "responseNote"         TEXT,
  ADD COLUMN "announcementStartsAt" TIMESTAMP(3),
  ADD COLUMN "announcementEndsAt"   TIMESTAMP(3),
  ADD COLUMN "announcementHref"     TEXT;
