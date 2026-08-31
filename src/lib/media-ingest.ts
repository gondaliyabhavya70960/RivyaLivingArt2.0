import "server-only";

import { createHash } from "node:crypto";

/**
 * What an upload should know about itself.
 *
 * Until now the upload path wrote `bytes` and nothing else
 * (`docs/studio-cms/03-image-layer.md` gap 3), which is why the library could
 * not tell you a picture's size, why nothing had a placeholder colour, and why
 * the owner could upload the same varmala shot four times without being told.
 *
 * `sharp` does the work. It is already resolved in this tree — Next's image
 * optimizer depends on it — and Phase H declares it explicitly rather than
 * relying on that. Every step is best-effort: a file `sharp` cannot read still
 * uploads, it just arrives without the extras, because an owner trying to add
 * a picture at 11pm should not be blocked by a metadata step.
 */

export type AssetFacts = {
  /** sha256 of the bytes, for dedupe. Always present. */
  checksum: string;
  width: number | null;
  height: number | null;
  /** 20px LQIP as a data URI. */
  blurDataUrl: string | null;
  /** Average colour as #rrggbb. */
  dominantHex: string | null;
};

/** The LQIP edge, matching what `scripts/media-v3-fetch.mjs` writes. */
const LQIP_EDGE = 20;

export function checksumOf(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Read what can be read off an uploaded file.
 *
 * Non-images get their checksum and nothing else: a 3D model has no dominant
 * colour, and pretending otherwise would put a meaningless swatch in the
 * library.
 */
export async function finalizeAsset(
  data: Buffer,
  contentType: string,
): Promise<AssetFacts> {
  const facts: AssetFacts = {
    checksum: checksumOf(data),
    width: null,
    height: null,
    blurDataUrl: null,
    dominantHex: null,
  };

  if (!contentType.startsWith("image/")) return facts;

  try {
    const { default: sharp } = await import("sharp");
    const image = sharp(data, { failOn: "none" });
    const metadata = await image.metadata();

    // `autoOrient` first: a phone photograph carries its rotation in EXIF, so
    // the raw width and height are transposed for anything shot in portrait —
    // and a wrong aspect ratio here reserves the wrong space on the page.
    const oriented = sharp(data, { failOn: "none" }).autoOrient();
    const orientedMeta = await oriented.metadata();
    facts.width = orientedMeta.width ?? metadata.width ?? null;
    facts.height = orientedMeta.height ?? metadata.height ?? null;

    const lqip = await oriented
      .clone()
      .resize(LQIP_EDGE, LQIP_EDGE, { fit: "inside" })
      .webp({ quality: 45 })
      .toBuffer();
    facts.blurDataUrl = `data:image/webp;base64,${lqip.toString("base64")}`;

    // One pixel is the average of the whole frame — cheaper and steadier than
    // a palette pass, and all that is wanted is the ground behind the picture
    // while it loads.
    const { data: pixel } = await oriented
      .clone()
      .resize(1, 1, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (pixel.length >= 3) {
      facts.dominantHex = `#${[pixel[0], pixel[1], pixel[2]]
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")}`;
    }
  } catch (error) {
    // A file sharp cannot decode still belongs in the library. It simply
    // arrives without the extras, and the studio shows what is missing.
    console.error("Asset ingest could not read the image:", error);
  }

  return facts;
}
