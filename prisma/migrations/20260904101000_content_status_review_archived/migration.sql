-- B0 commit 2 — ContentStatus grows two values for the editorial workflow.
--
-- REVIEW sits between DRAFT and PUBLISHED ("written, awaiting approval");
-- ARCHIVED is the retired-but-kept state, so a row need not be deleted to
-- leave the site. Neither is ever public: every public reader on HEAD
-- selects `status: "PUBLISHED"` or tests `=== "PUBLISHED"`, so a row in
-- either new state behaves exactly like DRAFT for visitors, and the order
-- predicate (`canOrderProduct`) already fails closed on anything that is not
-- exactly PUBLISHED.
--
-- Additive enum values only. Postgres refuses to use a value added inside
-- the same transaction, so this file contains nothing else — the same shape
-- as 20260822150000_inquiry_pipeline_statuses. The Studio gains the tabs and
-- bulk actions that write these values in a later commit; until then no
-- writer exists.
ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
