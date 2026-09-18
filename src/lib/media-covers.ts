/**
 * S7's "Set as product cover", as a pure rule.
 *
 * ## Why the cover matters more than any other picture
 *
 * The PDP resolves `product.ogImage || product.images[0]?.url`, so with no
 * explicit OG image the cover BECOMES the WhatsApp link-preview card — and
 * every order here finalizes in WhatsApp. It is the picture a customer sees
 * while agreeing to buy. That is the same reasoning `placeholder-assets.ts`
 * gives for guarding it, and this module hands that guard the URL it needs.
 *
 * ## Why the branch is here and not in the action
 *
 * `runAction` reports every throw as "something went wrong", and there is no
 * component-test runner in this repo — so a reordering rule living inside a
 * Server Action is a rule nothing can check. The action does the session, the
 * guard and the writes; the arithmetic is here, where a test can reach it.
 */

/** One gallery row, as both the query and the form see it. */
export type CoverImage = {
  id: string;
  url: string;
  order: number;
};

/**
 * The new `order` for every row that has to move, so `targetUrl` becomes the
 * cover — or `null` when nothing needs to change.
 *
 * **It renumbers from zero rather than handing the target `min - 1`.** Orders
 * in this table are owner-edited and arrive with gaps and duplicates; a
 * decrement strategy drifts negative over repeated use and leaves ties that
 * `orderBy: { order: "asc" }` breaks by whatever the planner feels like, which
 * is how a cover silently becomes a different picture on the next read. A
 * dense 0..n-1 has one answer.
 *
 * Returns only the rows whose order actually changes, so a no-op writes
 * nothing and a re-cover of the existing cover is free.
 */
export function reorderForCover(
  images: readonly CoverImage[],
  targetUrl: string,
): { id: string; order: number }[] | null {
  const target = images.find((image) => image.url === targetUrl);
  if (!target) return null;

  // Stable: equal orders keep their existing relative position rather than
  // being shuffled by the sort, which matters because duplicates are common.
  const rest = images
    .filter((image) => image.id !== target.id)
    .map((image, index) => ({ image, index }))
    .sort((a, b) => a.image.order - b.image.order || a.index - b.index)
    .map((entry) => entry.image);

  const next = [target, ...rest];
  const changes = next
    .map((image, order) => ({ id: image.id, order }))
    .filter((change, order) => next[order].order !== change.order);

  return changes.length > 0 ? changes : null;
}

/**
 * True when this media is already the cover — the drawer uses it to render a
 * marker instead of a button, so the control never offers a no-op.
 */
export function isCoverImage(
  images: readonly CoverImage[],
  url: string,
): boolean {
  if (images.length === 0) return false;
  let best = images[0];
  for (const image of images) {
    if (image.order < best.order) best = image;
  }
  return best.url === url;
}
