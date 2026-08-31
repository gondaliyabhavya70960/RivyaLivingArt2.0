-- Richer WhatsApp pipeline (audit OPS-01): DISCUSSION between CONTACTED and
-- QUOTED, IN_PRODUCTION between CONFIRMED and DELIVERED, LOST as a second
-- terminal state beside CLOSED. Additive enum values only.
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'DISCUSSION';
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION';
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'LOST';
