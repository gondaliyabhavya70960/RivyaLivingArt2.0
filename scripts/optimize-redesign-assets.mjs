/**
 * The redesign asset pipeline (implementation plan §5.4).
 *
 * Reads the Drive download drop in `assets-inbox/` and writes the only two
 * things the repo is allowed to carry: web-optimized WebP under
 * `public/redesign/catalog/{heroes,scenes}/`, and one LQIP manifest at
 * `src/lib/redesign-blur.json`. Sources stay OUT of git — the raw Drive PNGs
 * are ~2.2 MB each and would bloat the repo to ~100 MB (plan §7, binary
 * hygiene).
 *
 * WHY A SEPARATE BLUR MANIFEST, and not `media-v3-blur.json`:
 * `scripts/media-v3-fetch.mjs` REWRITES that file wholesale on every run
 * (`write(BLUR_FILE, JSON.stringify(blur))` over a freshly built object), so
 * redesign rows added there would survive exactly until the next Part 15
 * fetch and then vanish — taking every redesign placeholder with them, with
 * no test to say why. Two manifests with one owner each; `lqip.ts` merges
 * them at read time.
 *
 * The brand set (`public/redesign/*.jpg`) is NOT re-encoded. Those fifteen
 * files arrive already graded and web-optimized (83–432 KB) from the design
 * handoff; a second lossy pass would cost quality to save nothing. They are
 * read here only to derive their blur placeholders.
 *
 * Usage:
 *   node scripts/optimize-redesign-assets.mjs            # build everything
 *   node scripts/optimize-redesign-assets.mjs --brand-only
 *   node scripts/optimize-redesign-assets.mjs --check     # verify, write nothing
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const INBOX = join(ROOT, "assets-inbox");
const PUBLIC_REDESIGN = join(ROOT, "public", "redesign");
const CATALOG = join(PUBLIC_REDESIGN, "catalog");
const BLUR_FILE = join(ROOT, "src", "lib", "redesign-blur.json");

const args = new Set(process.argv.slice(2));
const CHECK = args.has("--check");
const BRAND_ONLY = args.has("--brand-only");

/**
 * Slot maxima (plan §5.4 step 2). The Drive library measures 1122×1402
 * (heroes) and 1672×941 (scenes) — BELOW these caps — so `withoutEnlargement`
 * makes this a no-op for the current library rather than a silent upscale.
 * Plan §5.4 step 3 files real upscaling as an explicit, separate pass; a
 * resize filter is not an upscaler and pretending otherwise would ship soft
 * pixels labelled "2048w".
 */
const GROUPS = [
  { dir: "heroes", out: "heroes", width: 1200 },
  { dir: "scenes", out: "scenes", width: 1920 },
];

const blur = {};

/** The 20px placeholder, byte-for-byte the recipe media-v3-fetch.mjs uses. */
async function lqip(buf) {
  const small = await sharp(buf).resize({ width: 20 }).webp({ quality: 40 }).toBuffer();
  return `data:image/webp;base64,${small.toString("base64")}`;
}

async function record(id, src, buf) {
  const { width, height } = await sharp(buf).metadata();
  blur[id] = { src, width, height, blurDataURL: await lqip(buf) };
}

/* ── the brand set: already-delivered JPEGs, blur only ─────────────────── */
const brandFiles = existsSync(PUBLIC_REDESIGN)
  ? readdirSync(PUBLIC_REDESIGN).filter((f) => f.endsWith(".jpg")).sort()
  : [];
for (const file of brandFiles) {
  const buf = readFileSync(join(PUBLIC_REDESIGN, file));
  await record(basename(file, ".jpg"), `/redesign/${file}`, buf);
}
console.log(`brand:   ${brandFiles.length} files → blur entries (not re-encoded)`);

/* ── the catalog library: Drive PNG → WebP q82 ─────────────────────────── */
let written = 0;
let skipped = 0;
if (!BRAND_ONLY) {
  for (const group of GROUPS) {
    const from = join(INBOX, group.dir);
    if (!existsSync(from)) {
      console.log(`${group.dir}: no assets-inbox/${group.dir}/ — skipped`);
      continue;
    }
    const outDir = join(CATALOG, group.out);
    if (!CHECK) mkdirSync(outDir, { recursive: true });
    const files = readdirSync(from).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
    for (const file of files) {
      const id = basename(file, extname(file));
      const outPath = join(outDir, `${id}.webp`);
      let buf;
      if (CHECK) {
        if (!existsSync(outPath)) { skipped++; continue; }
        buf = readFileSync(outPath);
      } else {
        buf = await sharp(readFileSync(join(from, file)))
          .resize({ width: group.width, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        writeFileSync(outPath, buf);
        written++;
      }
      await record(id, `/redesign/catalog/${group.out}/${id}.webp`, buf);
    }
    console.log(`${group.dir}: ${files.length} files → ${group.width}w WebP q82`);
  }
}

/* ── the manifest ──────────────────────────────────────────────────────── */
const json = JSON.stringify(blur, null, 2) + "\n";
if (CHECK) {
  const current = existsSync(BLUR_FILE) ? readFileSync(BLUR_FILE, "utf8") : "";
  if (current !== json) {
    console.error("✗ redesign-blur.json is stale — run without --check");
    process.exit(1);
  }
  if (skipped) {
    console.error(`✗ ${skipped} catalog file(s) missing from public/redesign/catalog`);
    process.exit(1);
  }
  console.log(`✓ redesign-blur.json is up to date (${Object.keys(blur).length} entries)`);
} else {
  writeFileSync(BLUR_FILE, json);
  console.log(`\n${written} WebP written · ${Object.keys(blur).length} blur entries → ${BLUR_FILE}`);
}
