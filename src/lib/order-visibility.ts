/**
 * Who may order which product — the rule the public order action enforces.
 *
 * Kept here as a pure predicate rather than inline in `submitProductOrder`
 * so it can be unit-tested without a database or a request scope, which is
 * the same reason every other rule in this folder lives in `src/lib`.
 *
 * The rule itself: PUBLISHED is orderable by anyone; anything else is
 * orderable ONLY inside staff draft preview. Preview is the owner placing a
 * test order against a piece before releasing it — a real workflow, and the
 * reason the action cannot simply reject every non-published product.
 *
 * "Preview is on" is equivalent to "a verified staff session turned it on":
 * Next's draft-mode cookie is minted in exactly one place, `/api/draft`,
 * behind the same DB-revalidated `requireStaff()` guard as the rest of the
 * studio. So this predicate is an authorization check, not a UI hint.
 *
 * The public product page applies the same test at render time
 * (`src/app/[locale]/(v2)/product/[slug]/page.tsx` — `notFound()` unless
 * PUBLISHED or preview). Both sides must agree, or the page hides a product
 * the action still accepts.
 */
export function canOrderProduct(input: {
  /** `Product.status` — a `ContentStatus` value (DRAFT | REVIEW | PUBLISHED | ARCHIVED); only PUBLISHED passes. */
  status: string;
  /** `(await draftMode()).isEnabled` for the current request. */
  previewEnabled: boolean;
}): boolean {
  return input.status === "PUBLISHED" || input.previewEnabled;
}
