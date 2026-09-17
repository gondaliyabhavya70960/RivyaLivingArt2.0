import type { InquirySource } from "@/generated/prisma/enums";

import { SOURCE_LABELS } from "@/components/studio/inquiries/labels";
import { buildWaLink } from "@/lib/whatsapp";

/**
 * The studio's reply opener, in ONE place.
 *
 * It used to live inline on the inquiry detail page, which is why the
 * inquiry LIST could not offer the same action — the greeting would have had
 * to be typed a second time, and two openers drifting apart is a customer
 * being greeted differently depending on which studio screen the owner
 * happened to be looking at.
 *
 * UIUX-604 is baked in: the deep link goes to the CUSTOMER's number, never
 * the studio's own. `buildWaLink` strips everything that is not a digit, so
 * an owner-typed `+91 98765 43210` resolves the same as `919876543210`.
 */
export function inquiryReplyGreeting(inquiry: {
  customerName: string;
  source: InquirySource;
}): string {
  const firstName =
    inquiry.customerName.trim().split(/\s+/)[0] || inquiry.customerName;
  return `Hi ${firstName}, thanks for reaching out to Rivya Living Art about your ${SOURCE_LABELS[
    inquiry.source
  ].toLowerCase()}.`;
}

export function inquiryReplyWaLink(inquiry: {
  customerName: string;
  source: InquirySource;
  phone: string;
}): string {
  return buildWaLink(inquiryReplyGreeting(inquiry), inquiry.phone);
}
