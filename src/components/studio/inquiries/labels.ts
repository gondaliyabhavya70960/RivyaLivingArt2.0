import type { InquirySource, InquiryStatus } from "@/generated/prisma/enums";

type BadgeVariant = "default" | "secondary" | "gold" | "outline";

/** Humanized labels shared by the list and detail views (server + client). */
export const SOURCE_LABELS: Record<InquirySource, string> = {
  PRODUCT: "Product",
  CUSTOM_ORDER: "Custom order",
  CONTACT: "Contact",
};

// Royal blue marks the high-value custom leads — gold is reserved for the
// dashboard's single top-product highlight (DESIGN.md Part C).
export const SOURCE_BADGE_VARIANTS: Record<InquirySource, BadgeVariant> = {
  PRODUCT: "secondary",
  CUSTOM_ORDER: "default",
  CONTACT: "outline",
};

/** The active pipeline — drives the stats cards (CLOSED and LOST are
 *  terminal, not stages). */
export const STATUS_ORDER: InquiryStatus[] = [
  "NEW",
  "CONTACTED",
  "DISCUSSION",
  "QUOTED",
  "CONFIRMED",
  "IN_PRODUCTION",
  "DELIVERED",
];

/** Every status a user can filter by or set, including the terminal pair. */
export const SELECTABLE_STATUSES: InquiryStatus[] = [
  ...STATUS_ORDER,
  "CLOSED",
  "LOST",
];

export const STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  DISCUSSION: "In discussion",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In production",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  LOST: "Lost",
};

// No gold here either (Part C) — QUOTED reads hollow ("ball in the customer's
// court"), CONFIRMED reads solid royal like the fresh lead that started it.
export const STATUS_BADGE_VARIANTS: Record<InquiryStatus, BadgeVariant> = {
  NEW: "default",
  CONTACTED: "secondary",
  DISCUSSION: "secondary",
  QUOTED: "outline",
  CONFIRMED: "default",
  IN_PRODUCTION: "default",
  DELIVERED: "outline",
  CLOSED: "outline",
  LOST: "outline",
};
