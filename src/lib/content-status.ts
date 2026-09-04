/**
 * The editorial statuses a content row can carry, as data.
 *
 * `ContentStatus` grew REVIEW and ARCHIVED in migration
 * 20260904101000; the Studio's zod schemas used to spell the two original
 * values inline in eleven places, and each of them would have refused to
 * save a row that had legitimately entered one of the new states. They now
 * read this tuple, so the vocabulary lives once.
 *
 * What is PUBLIC is a separate question with a single answer: exactly
 * `PUBLISHED`. Every public reader selects it and `canOrderProduct` fails
 * closed on anything else — the new values never widen that.
 *
 * Plain module, no server imports: read by forms, actions and tests alike.
 */
export const CONTENT_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;

export type ContentStatusValue = (typeof CONTENT_STATUSES)[number];

/** The one status visitors can see. */
export const PUBLIC_CONTENT_STATUS = "PUBLISHED" as const;

export function isContentStatus(value: string): value is ContentStatusValue {
  return (CONTENT_STATUSES as readonly string[]).includes(value);
}
