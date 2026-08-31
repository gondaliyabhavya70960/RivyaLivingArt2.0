-- Phase 8 — stop hammering a source that is failing.
--
-- Additive and defaulted: every existing source starts at zero failures and
-- unpaused, which is exactly today's behaviour. The breaker only changes what
-- happens AFTER a run of consecutive failures, which currently is nothing.

ALTER TABLE "ScrapeSource"
  ADD COLUMN "requestDelayMs" INTEGER,
  ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pausedAt" TIMESTAMP(3),
  ADD COLUMN "pausedReason" TEXT;
