// Mirrors the v6 brand media (scripts/v6-media.json) from the Higgsfield CDN
// into public/media/v6/ as first-party WebP. Runs in the mirror-v6-media
// Actions workflow because the build sandbox's egress policy blocks the CDN
// host. Same shape as mirror-v3-media.mjs, images only.
//
// Run: node scripts/mirror-v6-media.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public/media/v6");
const MANIFEST = path.join(ROOT, "scripts/v6-media.json");

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
await mkdir(OUT, { recursive: true });

let failed = 0;
for (const [name, spec] of Object.entries(manifest.images)) {
  try {
    const res = await fetch(spec.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const out = path.join(OUT, `${name}.webp`);
    await writeFile(
      out,
      await sharp(buf)
        .resize({ width: spec.width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
    );
    console.log(`mirrored ${name}.webp`);
  } catch (error) {
    failed++;
    console.error(`FAILED ${name}:`, error.message ?? error);
  }
}

if (failed > 0) {
  console.error(`${failed} asset(s) failed`);
  process.exit(1);
}
