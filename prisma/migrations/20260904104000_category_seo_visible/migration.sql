-- B0 commit 5 — collections gain SEO fields and a visibility switch.
--
-- Category was the one Studio-managed entity with no SEO override and no
-- way to take a shelf off the public site short of deleting it (which the
-- products FK forbids while pieces remain). `visible` defaults true so every
-- existing shelf keeps rendering; `seoTitle`/`seoDescription` are nullable
-- and fall back to today's name-derived metadata. Every public category
-- reader now selects `visible: true`; the Studio always lists every row.
ALTER TABLE "Category" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "Category" ADD COLUMN "seoDescription" TEXT;
ALTER TABLE "Category" ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;
