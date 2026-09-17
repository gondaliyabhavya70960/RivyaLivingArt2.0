import { isRenderableSrc } from "@/lib/image-src";
import type { ContentStatusValue } from "@/lib/content-status";

/**
 * The portfolio's publish guardrail — plan §2.7's "publish guard: no cover →
 * no render", applied where the studio can act on it instead of where the
 * visitor would notice it.
 *
 * `/portfolio` already refuses to render an empty cell: a case with no
 * renderable cover paints a text-only tile on deep ocean rather than a hole
 * in the wall. That is the right thing for a row that is ALREADY live, and
 * the wrong thing to keep designing around — a case study is proof, and for
 * a studio whose whole argument is what the work looks like, proof with no
 * photograph is the weakest row on the page. So the tile stays as the
 * fallback and this refuses to make a NEW one.
 *
 * The cover rule is the index's own, so the guard and the wall can never
 * disagree about what a cover is: `afterImageUrl`, else the first gallery
 * image, and it has to be a URL `next/image` can actually resolve.
 *
 * **Scoped to the TRANSITION into published, not to the state** — the same
 * shape as `describeSizeTierPublishProblem`, and for the same reason: rows
 * published before this existed keep saving, so a guardrail introduced today
 * cannot become a lockout on content written yesterday. Unlike the size-tier
 * case the backlog here is small, but the argument is identical and the
 * asymmetry would be arbitrary.
 */
export function portfolioCoverUrl(input: {
  afterImageUrl?: string | null;
  images: readonly { url: string }[];
}): string | null {
  const cover = input.afterImageUrl ?? input.images[0]?.url ?? null;
  return isRenderableSrc(cover) ? cover : null;
}

export function describePortfolioPublishProblem(input: {
  nextStatus: ContentStatusValue;
  previousStatus: ContentStatusValue | null;
  afterImageUrl?: string | null;
  images: readonly { url: string }[];
}): string | null {
  if (input.nextStatus !== "PUBLISHED") return null;
  if (input.previousStatus === "PUBLISHED") return null;
  if (portfolioCoverUrl(input) !== null) return null;
  return "This case study has no cover image — add an after photo or a gallery image before publishing it.";
}
