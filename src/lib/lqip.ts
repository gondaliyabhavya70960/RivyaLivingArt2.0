/**
 * The bundled half of the site's LQIP lookup (batch D · media system).
 *
 * `scripts/media-v3-fetch.mjs` writes one 20px blur-up placeholder per Part
 * 15 master into `media-v3-blur.json`, keyed by an internal asset id. Nothing
 * ever read that file at render time — `docs/transformation-audit.md` §10.1
 * records `blurDataUrl` and `dominantHex` as "captured, read by nothing".
 * This is the read side: a plain lookup from a bundled master's PUBLIC URL
 * (`slot.fallback` in `site-images.ts`, or any other `/media/v3/*.avif` path)
 * to its `blurDataURL`.
 *
 * Deliberately keyed by URL, not by the manifest's asset id — the caller
 * (`site-images.ts`) only ever has the URL a slot resolves to, and re-deriving
 * an id from a path would be one more place for the two to drift apart.
 *
 * Plain module, no server import: `site-images.ts` is read by RSC pages, the
 * `/studio/site-images` client screen and the import script alike, and this
 * sits directly underneath it. The database-backed half — resolving a blur
 * for an OWNER UPLOAD rather than a bundled master — lives in
 * `lqip-server.ts`, which imports this module rather than duplicating it.
 */
import blurManifest from "@/lib/media-v3-blur.json";

type BlurEntry = {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
};

const BY_SRC = new Map<string, string>(
  Object.values(blurManifest as Record<string, BlurEntry>).map((entry) => [
    entry.src,
    entry.blurDataURL,
  ]),
);

/**
 * The bundled LQIP for a Part 15 master's public URL — undefined for
 * anything that is not one of the 25 masters this file knows about (an
 * owner's upload, an unrelated `/media/*` path, a remote host).
 */
export function blurFor(url: string): string | undefined {
  return BY_SRC.get(url);
}
