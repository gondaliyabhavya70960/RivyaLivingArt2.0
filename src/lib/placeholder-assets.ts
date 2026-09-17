/**
 * The placeholder honesty rule (implementation plan §4.6), in one place.
 *
 * The plan, verbatim: "every Drive-catalog image lives under
 * `public/redesign/catalog/` and is a design/dev placeholder for products that
 * don't exist yet. They may render in dev, preview deployments, captioned
 * 'concept visualisation' marketing frames, and Studio seed data — never as
 * imagery of a purchasable product."
 *
 * 45 such files landed with the Drive ingestion: 35 furniture/wall/gift heroes
 * and 10 room scenes, all generated, none photographs of anything Rivya has
 * made. They exist so the redesign can be built and reviewed against realistic
 * content while the owner's own photography is shot product by product.
 *
 * WHY A PLACEHOLDER COVER IS WORSE THAN A MISSING ONE. The cover is not only
 * the card and the PDP stage: `product/[slug]/page.tsx` resolves
 * `product.ogImage || product.images[0]?.url`, so with no explicit OG image the
 * cover becomes the WhatsApp link-preview card. Every order on this site
 * finalizes in WhatsApp, which means a placeholder cover is the picture the
 * customer is looking at while they agree to buy something else.
 *
 * ENFORCEMENT IS PATH-BASED AND PRESENTATION-LAYER ONLY — no column, no
 * migration (plan §7). The path is the honest test for the same reason it is
 * in `bundledProvenance`: the path is what the pipeline writes and what the
 * manifest is keyed on.
 *
 * ── Why this refuses on every SAVE, where the size-tier guard refuses only at
 *    the TRANSITION into published ──────────────────────────────────────────
 *
 * `describeSizeTierPublishProblem` deliberately lets an already-PUBLISHED row
 * save untiered, and its header gives the reason: a pre-existing backlog of
 * ~4,385 untiered rows meant a state-scoped refusal would have stopped the
 * owner editing any of them before a bulk tool existed — a guardrail that
 * turns into a lockout.
 *
 * That is a PREMISE, not a principle, and here it is false. These files landed
 * with the ingestion commit and nothing points at one: no `Product` row, no
 * fixture, no site-image slot (the twelve `/redesign/` slot fallbacks are all
 * brand-set `.jpg`, none under `catalog/`). The backlog is zero, so there is
 * nobody to lock out — and copying the transition scoping without the premise
 * would import its known hole for free: publish with a real cover, swap the
 * cover to a placeholder, re-save, and the guard never fires. The size-tier
 * guard pays for that hole with 4,385 rescued rows. This one would be paying
 * nothing for it.
 *
 * So: any save that leaves a product PUBLISHED on a placeholder cover is
 * refused. Saving it as a draft is always allowed, which is the escape hatch.
 */
import type { ContentStatus } from "@/generated/prisma/enums";

/**
 * The binding path from plan §4.6. Everything the redesign pipeline writes for
 * a product that does not exist yet goes under here; the brand set
 * (`/redesign/hero-pour.jpg` and its fourteen siblings) deliberately does not,
 * because those are publishable brand imagery.
 */
export const PLACEHOLDER_ASSET_PREFIX = "/redesign/catalog/";

/**
 * The Drive library's own naming convention — `product-hero-001-4x5.webp`,
 * `product-scene-007-16x9.webp`. FOR THE LINT ONLY, never for a refusal: see
 * `looksLikePlaceholderAsset`.
 */
export const PLACEHOLDER_ASSET_FILENAME =
  /(?:^|\/)product-(?:hero|scene)-\d{3}-\d+x\d+\.[a-z0-9]+$/i;

/** THE RULE. A path under the placeholder directory, and nothing else. */
export function isPlaceholderAsset(url: string | null | undefined): boolean {
  return Boolean(url && url.startsWith(PLACEHOLDER_ASSET_PREFIX));
}

/**
 * The same suspicion, widened by filename — for a WARNING and never a refusal.
 *
 * An owner who downloads a placeholder and re-uploads it through /studio/media
 * gets a Blob URL, which loses the path and passes `isPlaceholderAsset`.
 * `media-filename.ts` keeps an informative stem, so the name usually survives
 * and the lint can still say something useful. It must not block, because a
 * real photograph that happens to be named this way is a file the owner is
 * entitled to publish, and a guard that refuses the owner's own photo of their
 * own work is worse than the leak it prevents.
 */
export function looksLikePlaceholderAsset(
  url: string | null | undefined,
): boolean {
  return isPlaceholderAsset(url) || PLACEHOLDER_ASSET_FILENAME.test(url ?? "");
}

/**
 * The cover, in memory: the gallery entry with the lowest `order`.
 *
 * Mirrors the `orderBy: { order: "asc" }, take: 1` convention every DB reader
 * already uses (`shop.ts`, the products list, the confirmed export, the PDP).
 * It lives here so the form path — which validates images the database has not
 * seen yet — and the query path cannot disagree about which picture is the
 * cover, which is the only way this guard could pass one and refuse the other.
 */
export function coverUrlOf(
  images: readonly { url: string; order?: number | null }[] | null | undefined,
): string | null {
  if (!images?.length) return null;
  let best = images[0];
  for (const image of images) {
    if ((image.order ?? 0) < (best.order ?? 0)) best = image;
  }
  return best.url ?? null;
}

/**
 * Why this product may not be published, or null if it may.
 *
 * Total over the transition like its two neighbours, but state-scoped rather
 * than transition-scoped — the header above argues why. The message names the
 * fix and the escape hatch, and mentions neither a path nor an enum: the owner
 * did not choose the word "placeholder" and should not have to decode it.
 */
export function describePlaceholderPublishProblem(input: {
  nextStatus: ContentStatus;
  coverUrl: string | null;
}): string | null {
  if (input.nextStatus !== "PUBLISHED") return null;
  if (!isPlaceholderAsset(input.coverUrl)) return null;
  return "This product's main image is a concept placeholder, not a photograph of a real piece — it stands in for something that hasn't been made yet. Replace it with a Rivya Living Art photograph, or save this as a draft.";
}

/**
 * Why this product may not be published for lack of a photograph, or null if
 * it may — plan §3 S5's "publish guard: no hero image".
 *
 * It lives beside the placeholder rule because they are the same question
 * asked twice: **what does a customer see?** A placeholder cover shows them
 * the wrong piece; no cover at all shows them a monogram tile on every rail
 * the product appears in, and a WhatsApp link preview with no picture at the
 * moment they are agreeing to buy.
 *
 * **Transition-scoped, unlike the placeholder rule right above it.** The
 * difference is the backlog, which is the same argument `describeSizeTier-
 * PublishProblem` makes: there are ~27 imageless products already published
 * on this catalogue and the guard must not lock the owner out of editing
 * them. The placeholders had no such backlog to pay with, and so are refused
 * on every save. `/studio/products?status=PUBLISHED&media=none` is the list
 * to work through, and the Overview counts it.
 *
 * `imageCount` rather than a url: a row with images is already past this, and
 * whether the first one is renderable is `describeConfirmBlockers`' question
 * on a different screen.
 */
export function describeMissingImagePublishProblem(input: {
  nextStatus: ContentStatus;
  currentStatus: ContentStatus | null;
  imageCount: number;
}): string | null {
  if (input.nextStatus !== "PUBLISHED") return null;
  if (input.currentStatus === "PUBLISHED") return null;
  if (input.imageCount > 0) return null;
  return "This product has no photograph, so its card would render as a monogram tile everywhere it appears. Add at least one image, or save this as a draft.";
}
