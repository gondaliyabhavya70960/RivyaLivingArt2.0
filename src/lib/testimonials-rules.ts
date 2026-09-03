/**
 * The one rule a testimonial save must never break: words go public only
 * once the customer has actually said yes.
 *
 * `Testimonial.permissionStatus` has tracked whether the customer agreed to
 * have their words published since the schema landed — but nothing enforced
 * it, so a row could sit at PUBLISHED with permission still UNKNOWN. This is
 * the guard: `describeTestimonialProblem` returns a reason the save must be
 * refused, or `null` when it may proceed. The Studio action calls it BEFORE
 * every write and hands the message back as the action's error, so the
 * refusal is not a client-side nicety — a request that skips the form still
 * hits it (CLAUDE.md's "guardrails refuse, they do not warn").
 *
 * **The guard fires on the TRANSITION, not on every row that happens to be
 * PUBLISHED.** The migration that added `status` backfilled every existing
 * (already-live) testimonial to PUBLISHED so the words band did not go dark
 * the day this shipped — most of those rows have `permissionStatus: UNKNOWN`,
 * because nobody asked at the time. This function is called on every save
 * that WOULD leave a row at PUBLISHED, including a plain re-save of one of
 * those back-filled rows — so it does refuse a re-save until the owner
 * records permission, but it never touches a row nobody has opened. A
 * back-filled testimonial stays live, unexamined, exactly as it was; the
 * moment someone opens it in the Studio and saves, the same rule that
 * governs every new testimonial applies.
 *
 * Plain module — no database, no server import — so the Studio action, the
 * form's own pre-submit check and the test share one definition (the
 * `merge-policy.ts` / `fill-policy.ts` precedent: local literal types instead
 * of importing the generated Prisma enums, so this file has zero runtime
 * dependency on the client).
 */

export type TestimonialStatusValue =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "PUBLISHED"
  | "ARCHIVED";

export type PermissionStatusValue =
  | "UNKNOWN"
  | "REQUESTED"
  | "GRANTED"
  | "DECLINED";

export type TestimonialProblemInput = {
  status: TestimonialStatusValue;
  permissionStatus: PermissionStatusValue;
  quote: string;
  name: string;
};

/**
 * Returns a human-readable refusal reason, or `null` when the save may
 * proceed. Checked in a fixed order so the message always names the FIRST
 * thing wrong — a row with both an empty quote and an unpublishable
 * permission state should be told about the quote before permission, since
 * fixing the quote is what unblocks even seeing the Review tab's warning in
 * context.
 */
export function describeTestimonialProblem(
  input: TestimonialProblemInput,
): string | null {
  if (!input.name.trim()) {
    return "Name is required.";
  }
  if (!input.quote.trim()) {
    return "Quote is required.";
  }
  if (input.status === "PUBLISHED" && input.permissionStatus !== "GRANTED") {
    return "Publishing needs the customer's permission recorded as GRANTED — set Permission to Granted on the Review tab first.";
  }
  return null;
}
