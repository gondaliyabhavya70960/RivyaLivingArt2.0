/**
 * Low-Quality Image Placeholder (LQIP) lookup for bundled master imagery.
 *
 * Implements REDESIGN.md §15.5 and wires `src/lib/media-v3-blur.json` (25 entries).
 *
 * Keying rule:
 * Lookups key strictly on the RESOLVED image URL/pathname rather than slot
 * keys or slot fallbacks. If an owner provides a custom upload or override,
 * keying on the slot would paint master A's blur under photograph B. If an
 * image URL does not match a known bundled master in the manifest, this
 * returns `undefined`, and the image renders with empty placeholder.
 *
 * Caveat:
 * `prisma/bootstrap.ts` repoints every slot at a random-suffixed Blob URL on a
 * fresh production deploy, after which every lookup misses and the feature is
 * silently inert in production while local dev (or environments pointing at
 * bundled paths) still shows blurs.
 */
import blurManifest from "@/lib/media-v3-blur.json";

interface BlurEntry {
  src?: string;
  width?: number;
  height?: number;
  blurDataURL?: string;
}

const BLUR_MAP = new Map<string, string>();

for (const entry of Object.values(blurManifest as Record<string, BlurEntry>)) {
  if (entry.src && entry.blurDataURL) {
    BLUR_MAP.set(entry.src, entry.blurDataURL);
  }
}

/**
 * Returns the base64 data URL blur placeholder for a bundled master image,
 * or `undefined` if the image is not in the blur manifest.
 */
export function getLqipBlur(src: unknown): string | undefined {
  if (typeof src !== "string") return undefined;
  const trimmed = src.trim();
  if (!trimmed) return undefined;

  // Direct match (e.g. "/media/v3/hero-pour.avif")
  const direct = BLUR_MAP.get(trimmed);
  if (direct) return direct;

  // Pathname match for absolute URLs (e.g. "https://domain.com/media/v3/hero-pour.avif")
  try {
    const url = new URL(trimmed, "http://localhost");
    return BLUR_MAP.get(url.pathname);
  } catch {
    return undefined;
  }
}
