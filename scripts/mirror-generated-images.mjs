/**
 * Mirror the Step-4 generated brand imagery (Higgsfield CDN) into the repo as
 * first-party assets: public/images/{categories,blog}/<slug>.webp.
 *
 * Run on any machine with open internet access (a laptop, CI — the remote
 * build sandboxes block the CDN host):
 *
 *   node scripts/mirror-generated-images.mjs
 *   git add public/images && git commit -m "Mirror generated covers first-party"
 *
 * Then re-run the seeds (`npm run db:seed:blogs`; category covers reconcile
 * automatically on the next deploy) — prisma/generated-cover.ts prefers the
 * local file when it exists, and both seeds replace a cover only when it is
 * empty OR still the machine-set generated CDN URL for that slug, so
 * owner-set imagery is never overwritten while the CDN→local flip DOES land
 * (IMG-901). Once mirrored and re-seeded, remove the cloudfront entries from
 * next.config.ts (remotePatterns + CSP img-src) AND the matching host in
 * src/lib/image-src.ts isOptimizableImageSrc in the same commit.
 *
 * Uses sharp (already a Next.js dependency) to resize + convert to WebP:
 * categories 1200w (3:4 card/hero crops), blog 1600w (16:9 covers).
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const covers = JSON.parse(
  readFileSync(path.join(root, "prisma", "generated-covers.json"), "utf8"),
);
const sharp = (await import(path.join(root, "node_modules", "sharp", "lib", "index.js")))
  .default;

let ok = 0;
let failed = 0;
for (const [dir, width, map] of [
  ["categories", 1200, covers.categories],
  ["blog", 1600, covers.blog],
]) {
  const outDir = path.join(root, "public", "images", dir);
  mkdirSync(outDir, { recursive: true });
  for (const [slug, url] of Object.entries(map)) {
    const out = path.join(outDir, `${slug}.webp`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(out);
      ok++;
      console.log(`✓ ${dir}/${slug}.webp`);
    } catch (e) {
      failed++;
      console.error(`✗ ${dir}/${slug}: ${e instanceof Error ? e.message : e}`);
    }
  }
}
console.log(`\nMirrored ${ok} images${failed ? `, ${failed} FAILED` : ""}.`);
if (failed) process.exitCode = 1;
