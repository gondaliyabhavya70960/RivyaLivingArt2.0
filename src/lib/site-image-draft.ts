/**
 * The reader for a staged (`draft`) site-image row.
 *
 * A pure module, deliberately: this lived in `site-images-server.ts`, which
 * opens with `import "server-only"`, so every consumer inherited that guard.
 * The delete guard in `media-usages.ts` needs the same reader, and coupling a
 * plain JSON parser to the server-only boundary made it unreachable from a
 * script or a unit test — which is how the staged half of the slot went
 * unscanned in the first place. Nothing here touches the database or the
 * request.
 *
 * ONE reader is the point. `/studio/site-images` shows the owner what they
 * staged, `getSiteImageRefs` previews it behind the staff cookie, and
 * `findMediaUsageDetails` refuses to delete the file it points at. If those
 * three disagreed about what a staged row means, the guard would protect a
 * different picture from the one the preview shows.
 */

export type StagedImage = {
  url?: string;
  mobileUrl?: string | null;
  focalX?: number;
  focalY?: number;
};

/**
 * A staged slot change, defensively.
 *
 * The column is written only by a validated action, so this guards a
 * hand-edited row rather than a code path — but a malformed blob must degrade
 * to "nothing staged" rather than throw on every route in the app.
 */
export function readStagedImage(value: unknown): StagedImage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const out: StagedImage = {};
  if (typeof rec.url === "string") out.url = rec.url;
  if (typeof rec.mobileUrl === "string") out.mobileUrl = rec.mobileUrl;
  else if (rec.mobileUrl === null) out.mobileUrl = null;
  if (typeof rec.focalX === "number") out.focalX = rec.focalX;
  if (typeof rec.focalY === "number") out.focalY = rec.focalY;
  return Object.keys(out).length ? out : null;
}
