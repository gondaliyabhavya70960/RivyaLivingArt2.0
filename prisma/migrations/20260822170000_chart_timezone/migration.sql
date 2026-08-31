-- Chart day-boundary setting (closes the UTC-vs-IST owner decision as a
-- toggle; default UTC keeps current behavior).
ALTER TABLE "SiteSettings" ADD COLUMN "chartTimezone" TEXT NOT NULL DEFAULT 'UTC';
