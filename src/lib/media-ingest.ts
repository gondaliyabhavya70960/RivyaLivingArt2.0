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
 * The content types this module can read off a file's own bytes — the
 * subset of `ACCEPTED_UPLOAD_TYPES` (`src/lib/storage.ts`) that carries a
 * magic-byte signature. USDZ is deliberately absent: it is a zip container,
 * and "PK\x03\x04" is shared by every zip-based format (docx, apk, jar, an
 * ordinary .zip renamed to spoof one) — there is nothing more specific to
 * sniff, so it is not a type this function claims to detect.
 */
export type SniffedType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif"
  | "video/mp4"
  | "video/webm"
  | "model/gltf-binary";

type MediaFamily = "image" | "video" | "model";

/** Which broad family each sniffable type belongs to. */
const SNIFF_FAMILY: Record<SniffedType, MediaFamily> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/avif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "model/gltf-binary": "model",
};

/** The `isom`/`mp42`/… ISO-BMFF brands this repo accepts as MP4. */
const MP4_BRANDS = new Set(["isom", "mp42", "avc1", "iso5"]);

/**
 * Identify a file from its own bytes, ignoring whatever content type the
 * browser or upload form declared. Returns `null` when nothing recognized
 * matches — an unrecognized signature is not evidence of any particular
 * type, only that it is not one of these seven.
 *
 * Signatures, each read at a fixed offset so a well-formed file of that type
 * always matches regardless of size:
 *  - JPEG: `FF D8 FF` at offset 0.
 *  - PNG: `89 50 4E 47` at offset 0.
 *  - WebP: `RIFF` at offset 0, `WEBP` at offset 8 (the RIFF chunk size sits
 *    in between and is irrelevant here).
 *  - AVIF: an ISO-BMFF `ftyp` box (`ftyp` at offset 4) whose major brand
 *    (offset 8) is `avif` or `avis` — i.e. the 8 bytes from offset 4 spell
 *    `ftypavif` / `ftypavis`.
 *  - MP4: the same `ftyp` box with a brand in `MP4_BRANDS`.
 *  - WebM: the EBML header `1A 45 DF A3` at offset 0.
 *  - GLB: the glTF binary magic `glTF` at offset 0.
 */
export function sniffContentType(data: Buffer): SniffedType | null {
  if (data.length < 3) return null;

  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    data[0] === 0x1a &&
    data[1] === 0x45 &&
    data[2] === 0xdf &&
    data[3] === 0xa3
  ) {
    return "video/webm";
  }
  if (
    data[0] === 0x67 &&
    data[1] === 0x6c &&
    data[2] === 0x54 &&
    data[3] === 0x46
  ) {
    return "model/gltf-binary";
  }

  if (data.length >= 12) {
    if (
      data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP"
    ) {
      return "image/webp";
    }
    if (data.toString("ascii", 4, 8) === "ftyp") {
      const brand = data.toString("ascii", 8, 12);
      if (brand === "avif" || brand === "avis") return "image/avif";
      if (MP4_BRANDS.has(brand)) return "video/mp4";
    }
  }

  return null;
}

/**
 * Thrown by `validateDeclaredType` when a file's bytes and its declared
 * content type disagree on FAMILY (image vs video vs 3D model) — the case
 * that matters for security, since it is how a spoofed upload (an
 * executable or a script declared as `image/png`) gets past a type check
 * that only reads the form field. A same-family mismatch (an actual PNG
 * declared as `image/webp`) is not what this guards against and is not
 * raised here; sharp reads the real bytes regardless.
 */
export class MediaTypeMismatchError extends Error {
  readonly declared: string;
  readonly sniffed: SniffedType | null;

  constructor(declared: string, sniffed: SniffedType | null) {
    super(
      sniffed
        ? `Declared type "${declared}" does not match this file's contents (looks like ${sniffed}).`
        : `Declared type "${declared}" does not match this file's contents (unrecognized signature).`,
    );
    this.name = "MediaTypeMismatchError";
    this.declared = declared;
    this.sniffed = sniffed;
  }
}

function familyOf(mime: string): MediaFamily | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("model/")) return "model";
  return null;
}

/**
 * Checks a declared content type against what the bytes actually are.
 * Throws `MediaTypeMismatchError` when they disagree on family; returns
 * normally when they agree, or when there is nothing this function can
 * verify (see below) — it never widens what is accepted, only narrows what
 * upstream size/extension checks (`ACCEPTED_UPLOAD_TYPES`) already allowed
 * through.
 *
 * Two declared types are deliberately NOT sniffed:
 *  - `model/vnd.usdz+zip` — a zip container with no signature specific
 *    enough to tell a real USDZ from any other zip-based file (see
 *    `SniffedType`'s doc comment). Accepted on the declaration alone.
 *  - anything outside the image/video/model families this module knows —
 *    there is nothing to compare it against, so it passes through
 *    unexamined rather than being rejected for a check that was never
 *    attempted.
 *
 * An UNRECOGNIZED signature for a type this function DOES know how to sniff
 * (i.e. `sniffContentType` returns `null` for a declared image/video/model)
 * is treated as a mismatch and rejected — the safer read of "no family
 * detected" when one was declared.
 */
export function validateDeclaredType(data: Buffer, declared: string): void {
  if (declared === "model/vnd.usdz+zip") return;

  const declaredFamily = familyOf(declared);
  if (!declaredFamily) return;

  const sniffed = sniffContentType(data);
  const sniffedFamily = sniffed ? SNIFF_FAMILY[sniffed] : null;

  if (sniffedFamily !== declaredFamily) {
    throw new MediaTypeMismatchError(declared, sniffed);
  }
}

/**
 * Read what can be read off an uploaded file.
 *
 * Non-images get their checksum and nothing else: a 3D model has no dominant
 * colour, and pretending otherwise would put a meaningless swatch in the
 * library.
 *
 * Validates the declared `contentType` against the bytes FIRST
 * (`validateDeclaredType`) — an upload action trusted `file.type` alone
 * before this, which is a value the browser sends and the client controls;
 * a mismatch throws `MediaTypeMismatchError` and nothing below it runs, so a
 * spoofed file is never fingerprinted, deduped, stored or written to the
 * library.
 */
export async function finalizeAsset(
  data: Buffer,
  contentType: string,
): Promise<AssetFacts> {
  validateDeclaredType(data, contentType);

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
