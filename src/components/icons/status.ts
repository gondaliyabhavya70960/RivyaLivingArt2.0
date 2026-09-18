import type {
  ContentStatus,
  InquirySource,
  InquiryStatus,
  MediaType,
  Provenance,
  ProductImageRole,
  ProductSizeTier,
  ReviewStatus,
  Role,
  ScrapeJobStatus,
  TestimonialStatus,
} from "@/generated/prisma/enums";

import type { IconName } from "./index";

/**
 * ENUM VALUE → ICON NAME, and every map here is EXHAUSTIVE BY TYPE.
 *
 * `Record<InquiryStatus, IconName>` is the whole mechanism: add a state to
 * `prisma/schema.prisma`, regenerate the client, and this file stops
 * compiling until the new state has a mark. A status with no icon should be a
 * build error rather than a blank cell somebody notices in production.
 *
 * The enums are imported from the GENERATED client, not re-typed here. A
 * hand-written copy of an enum compiles forever while drifting from the
 * database — this project has a written scar from exactly that (CLAUDE.md: the
 * scrape-tier list reached five hand-written copies, and the fifth is why
 * three new tiers once shipped invisible).
 *
 * ## Shapes carry the meaning; colour is never alone
 *
 * §16 forbids communicating state by colour alone, and a status dot that
 * differs only in hue breaks that rule with an icon instead of a swatch. Every
 * mark below is distinguishable at 16px in a single ink — that is what the
 * design-lab sheet is for checking.
 *
 * ## Several states deliberately SHARE a mark
 *
 * `PUBLISHED`, `APPROVED` and `VERIFIED` all take the ring-and-check, because
 * they are the same event in three tables and giving each its own glyph would
 * invent a distinction the product does not make. What must never share is a
 * pair a person has to act on differently: `CLOSED` (it simply ended) and
 * `LOST` (they declined) are separate marks for that reason, though both are
 * terminal.
 */

export const INQUIRY_STATUS_ICON: Record<InquiryStatus, IconName> = {
  NEW: "status-new",
  CONTACTED: "status-talking",
  DISCUSSION: "status-talking",
  QUOTED: "status-quoted",
  CONFIRMED: "status-confirmed",
  IN_PRODUCTION: "status-in-production",
  DELIVERED: "status-delivered",
  CLOSED: "status-closed",
  LOST: "status-declined",
};

export const CONTENT_STATUS_ICON: Record<ContentStatus, IconName> = {
  DRAFT: "status-draft",
  REVIEW: "status-review",
  PUBLISHED: "status-published",
  ARCHIVED: "status-archived",
};

export const TESTIMONIAL_STATUS_ICON: Record<TestimonialStatus, IconName> = {
  DRAFT: "status-draft",
  PENDING_REVIEW: "status-review",
  VERIFIED: "status-published",
  PUBLISHED: "status-published",
  ARCHIVED: "status-archived",
};

/**
 * The scraper review inbox's four states — and `IMPORTED` is the one worth
 * naming, because the exhaustive `Record` above caught it being missed.
 *
 * It is not a fourth opinion about the staged row; it means the row HAS
 * ALREADY BECOME A CATALOGUE PRODUCT (`shortlist-write.ts` excludes it from
 * the importable set by `reviewStatus: { not: "IMPORTED" }`, which is what
 * lets a stopped 500-row approval resume). So it takes the delivered mark —
 * the same "it has left this queue" idea the inquiry pipeline uses for a piece
 * that has left the studio — rather than the approved check, which would say
 * "someone said yes" about a row whose yes was acted on days ago.
 */
export const REVIEW_STATUS_ICON: Record<ReviewStatus, IconName> = {
  PENDING: "status-review",
  APPROVED: "status-published",
  REJECTED: "status-declined",
  IMPORTED: "status-delivered",
};

export const SCRAPE_JOB_STATUS_ICON: Record<ScrapeJobStatus, IconName> = {
  QUEUED: "status-queued",
  RUNNING: "status-running",
  DONE: "status-published",
  FAILED: "status-failed",
};

/** Where a commission came in from. Three sources, exactly these. */
export const INQUIRY_SOURCE_ICON: Record<InquirySource, IconName> = {
  PRODUCT: "table",
  CUSTOM_ORDER: "pour",
  CONTACT: "status-talking",
};

export const MEDIA_TYPE_ICON: Record<MediaType, IconName> = {
  IMAGE: "media-image",
  VIDEO: "media-video",
  DOCUMENT: "media-document",
  MODEL3D: "media-model3d",
};

/**
 * Provenance. `AI` is the one that has to be unmistakable — §12.5's filter and
 * indicator exist so a generated picture is never mistaken for a photograph —
 * so it gets a mark of its own, while UPLOAD and BUNDLED take the media
 * vocabulary. `BUNDLED` is a box because that is what it is: something this
 * repository shipped with.
 */
export const PROVENANCE_ICON: Record<Provenance, IconName> = {
  UPLOAD: "media-image",
  BUNDLED: "status-archived",
  AI: "provenance-ai",
};

/**
 * What a product photograph SHOWS. `PROCESS` takes the pour deliberately —
 * that is the same event the storefront's process band names, and one mark for
 * one idea is the point of a registry.
 */
export const PRODUCT_IMAGE_ROLE_ICON: Record<ProductImageRole, IconName> = {
  HERO: "media-image",
  DETAIL: "polish",
  IN_ROOM: "wall-panel",
  PROCESS: "pour",
};

/**
 * The SIZE taxonomy — `Product.sizeTier`, three values, and NOT the legacy
 * `Product.tier Int?` (CLAUDE.md is emphatic: three columns are called "tier"
 * and they mean different things). The marks are the tiers' own objects: a
 * table for collectible furniture, a frame for memory and celebration work, a
 * keychain for personal gifting.
 */
export const SIZE_TIER_ICON: Record<ProductSizeTier, IconName> = {
  LARGE_FORMAT: "table",
  MEDIUM_FORMAT: "frame",
  SMALL_FORMAT: "keychain",
};

/** Two roles. Not five — `Role` is `ADMIN | EDITOR`. */
export const ROLE_ICON: Record<Role, IconName> = {
  ADMIN: "role-admin",
  EDITOR: "role-editor",
};
