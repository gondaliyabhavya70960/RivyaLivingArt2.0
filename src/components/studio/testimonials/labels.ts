import type {
  PermissionStatus,
  TestimonialStatus,
} from "@/generated/prisma/enums";

type BadgeVariant =
  | "default"
  | "secondary"
  | "gold"
  | "outline"
  | "success"
  | "warning"
  | "alert";

/** Every status a testimonial can carry, in the order the pipeline moves
 *  through it — DRAFT → PENDING_REVIEW → VERIFIED → PUBLISHED, with ARCHIVED
 *  as the terminal shelf. Drives the list's status tabs and the form's
 *  Select, so the vocabulary lives once. */
export const STATUS_ORDER = [
  "DRAFT",
  "PENDING_REVIEW",
  "VERIFIED",
  "PUBLISHED",
  "ARCHIVED",
] as const satisfies readonly TestimonialStatus[];

export const STATUS_LABELS: Record<TestimonialStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  VERIFIED: "Verified",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

// PUBLISHED is the one state a visitor ever sees, so it is the only one that
// reads as success. VERIFIED is a step closer than PENDING_REVIEW but still
// invisible on the storefront, so it stays a neutral outline rather than
// borrowing the green that means "this is live".
export const STATUS_BADGE_VARIANTS: Record<TestimonialStatus, BadgeVariant> = {
  DRAFT: "secondary",
  PENDING_REVIEW: "outline",
  VERIFIED: "outline",
  PUBLISHED: "success",
  ARCHIVED: "secondary",
};

export const PERMISSION_LABELS: Record<PermissionStatus, string> = {
  UNKNOWN: "Unknown",
  REQUESTED: "Requested",
  GRANTED: "Granted",
  DECLINED: "Declined",
};

// GRANTED is the only state that clears the way to Published (see
// `describeTestimonialProblem`), so it is the only one that reads as
// success; DECLINED is the one that must read as a stop, not a neutral note.
export const PERMISSION_BADGE_VARIANTS: Record<PermissionStatus, BadgeVariant> =
  {
    UNKNOWN: "secondary",
    REQUESTED: "outline",
    GRANTED: "success",
    DECLINED: "alert",
  };
