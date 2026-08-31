import { existsSync } from "node:fs";
import path from "node:path";

import covers from "./generated-covers.json";

/**
 * Step-4 generated brand imagery (Higgsfield, Seedream 5.0 Pro — prompts in
 * docs/image-inventory.md). Two hosting states, resolved per slug at seed
 * time:
 *
 *  1. First-party (preferred): `public/images/{categories,blog}/<slug>.webp`
 *     exists in the repo → seed the root-relative path. Produced by
 *     `node scripts/mirror-generated-images.mjs` on any open network.
 *  2. Remote fallback: the public Higgsfield CDN URL from
 *     `generated-covers.json` (allow-listed in next.config remotePatterns +
 *     CSP img-src) — what ships until the mirror script has been run.
 *
 * Callers must stay NON-DESTRUCTIVE: only fill a cover that is still empty,
 * never overwrite an owner-set image.
 */
export function generatedCategoryCover(slug: string): string | undefined {
  return resolve("categories", slug, covers.categories);
}

export function generatedBlogCover(slug: string): string | undefined {
  return resolve("blog", slug, covers.blog);
}

function resolve(
  dir: "categories" | "blog",
  slug: string,
  remote: Record<string, string>,
): string | undefined {
  const local = `/images/${dir}/${slug}.webp`;
  if (existsSync(path.join(process.cwd(), "public", local))) return local;
  return remote[slug];
}

/**
 * Whether a stored cover is one WE machine-set (the generated CDN URL for
 * that same slug) and may therefore be replaced by a re-seed — e.g. flipped
 * to the first-party /images/... path after the mirror script runs. An
 * owner-set cover (anything else non-empty) is never replaced (IMG-901).
 */
export function isReplaceableGeneratedCover(
  kind: "categories" | "blog",
  slug: string,
  stored: string | null | undefined,
): boolean {
  if (!stored) return true;
  const remote =
    kind === "categories" ? covers.categories : (covers.blog as Record<string, string>);
  return stored === remote[slug as keyof typeof remote];
}

/** The raw generated CDN URL for a category slug (for seed WHERE clauses). */
export function generatedCategoryRemoteUrl(slug: string): string | undefined {
  return (covers.categories as Record<string, string>)[slug];
}
