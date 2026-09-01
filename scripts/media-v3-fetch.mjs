#!/usr/bin/env node
/**
 * REDESIGN.md §15.5 as an executable pipeline.
 *
 *   node scripts/media-v3-fetch.mjs --candidates   # cull step: contact sheet
 *   node scripts/media-v3-fetch.mjs                # build step: masters + LQIP
 *
 * Part 15's assets were generated through the Higgsfield MCP on 2026-08-23 and
 * are recorded in `docs/media-v3-manifest.json` — every asset id, its §15.4
 * placement, ratio, target width, the exact prompt (already carrying §15.3's
 * mandatory palette suffix and the negative list), and the job id + result URL
 * of each candidate. This script turns that manifest into the files the site
 * actually loads. It is the whole post pipeline in one command, and it is
 * idempotent: an asset whose master already exists is skipped unless --force.
 *
 * WHY THIS IS A SCRIPT AND NOT A COMMITTED SET OF IMAGES
 * The session that generated these ran behind an egress allowlist that does not
 * include Higgsfield's CDN (`d8j0ntlcm91z4.cloudfront.net` — the proxy answers
 * 403 to CONNECT), so it could neither download the results nor render them to
 * cull. Run this anywhere with ordinary network access and the set lands.
 *
 * TWO DELIBERATE ADAPTATIONS TO §15.5, both because of this stack:
 *
 * 1. §15.5 says "upscale_image to ≥2560px". The masters come off the model at
 *    3584px on the long edge, so the upscale pass is already satisfied at
 *    generation time and would only add a resampling generation.
 *
 * 2. §15.5 says "Export AVIF + WebP at 640/960/1440/1920/2560". That describes
 *    a CDN that serves a fixed ladder. next/image already IS that ladder here —
 *    `next.config.ts` sets formats: ["image/avif", "image/webp"], and the
 *    optimizer resizes per the `sizes` attribute and content-negotiates the
 *    format per request. Committing 10 derivatives per asset would put ~240
 *    files in git that the optimizer would ignore. So one AVIF master per asset
 *    is written at the largest width its `sizes` can actually request, and the
 *    ladder is generated at request time from it. The 20px LQIP is real and is
 *    written to src/lib/media-v3-blur.json as a base64 data URL per asset.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..");
const MANIFEST = join(ROOT, "docs/media-v3-manifest.json");
const OUT_DIR = join(ROOT, "public/media/v3");
const BLUR_FILE = join(ROOT, "src/lib/media-v3-blur.json");
const SHEET_DIR = join(ROOT, ".media-v3-candidates");
// Committed review sheets. The candidate AVIFs above stay out of git; these
// composites are the one artefact a reviewer (or an agent that cannot reach
// the CDN) actually needs in order to cull.
const REVIEW_DIR = join(ROOT, "docs/media-v3-review");

const args = process.argv.slice(2);
const wantCandidates = args.includes("--candidates");
const force = args.includes("--force");

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

/** AVIF quality by role. Macros and tiles sit in small columns and can take a
 *  lower number than a full-bleed band, where banding in a dark gradient shows. */
const QUALITY = { "16:9": 50, "21:9": 50, "3:4": 52, "4:5": 52, "1:1": 52 };

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function write(file, buf) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
}

/* ————————————————— cull step —————————————————
 * §15.5: "cull to one keeper per ID". Downloads every candidate at review size
 * and writes an HTML contact sheet beside them. Open it, pick a variant per
 * asset, then set `keeper` in the manifest to that variant letter.
 */
async function buildContactSheet() {
  mkdirSync(SHEET_DIR, { recursive: true });
  const rows = [];
  for (const asset of manifest.assets) {
    const cells = [];
    for (const cand of asset.candidates) {
      const name = `${asset.id}-${cand.variant}.avif`;
      const path = join(SHEET_DIR, name);
      if (!existsSync(path) || force) {
        process.stdout.write(`  ↓ ${name}\n`);
        const src = await fetchBuffer(cand.url);
        write(path, await sharp(src).resize({ width: 640 }).avif({ quality: 55 }).toBuffer());
      }
      cells.push(
        `<figure><img src="${name}" alt=""><figcaption>${cand.variant} · ${cand.jobId.slice(0, 8)}</figcaption></figure>`,
      );
    }
    rows.push(
      `<section><h2>${asset.id} <small>${asset.ratio} · ${asset.placement}</small></h2><div class="row">${cells.join("")}</div></section>`,
    );
  }
  write(
    join(SHEET_DIR, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Part 15 candidates</title>
<style>body{background:#101014;color:#f4f1e9;font:14px/1.5 system-ui;margin:32px}
h2{font-size:15px;font-weight:600;margin:32px 0 10px}small{color:#a9b4bc;font-weight:400}
.row{display:flex;gap:14px;flex-wrap:wrap}figure{margin:0;width:300px}
img{width:100%;border-radius:2px;display:block}figcaption{color:#a9b4bc;font-size:12px;margin-top:6px}</style>
<h1>REDESIGN.md §15.5 — cull to one keeper per id</h1>${rows.join("")}`,
  );
  await writeReviewSheets();

  console.log(`\nContact sheet: ${join(SHEET_DIR, "index.html")}`);
  console.log(`Committed review sheets: ${REVIEW_DIR}`);
  console.log('Set "keeper": "a" | "b" on each asset in docs/media-v3-manifest.json, then re-run without --candidates.');
}

/**
 * One composite JPEG per set, captioned with each candidate's id and variant.
 *
 * The HTML sheet above needs a browser and the loose AVIFs need the CDN. A
 * flat image per set can be opened anywhere — including by an agent whose
 * egress blocks Higgsfield but not this repository, which is exactly the
 * situation these assets were generated in.
 */
async function writeReviewSheets() {
  const COLS = 4;
  const CELL = 460;
  const LABEL = 26;

  const sets = [...new Set(manifest.assets.map((a) => a.set))];
  for (const set of sets) {
    const cells = [];
    for (const asset of manifest.assets.filter((a) => a.set === set)) {
      for (const cand of asset.candidates) {
        const file = join(SHEET_DIR, `${asset.id}-${cand.variant}.avif`);
        if (existsSync(file)) {
          cells.push({ file, caption: `${asset.id} · ${cand.variant}` });
        }
      }
    }
    if (cells.length === 0) continue;

    const rows = Math.ceil(cells.length / COLS);
    const composites = [];
    for (const [i, cell] of cells.entries()) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * (CELL + LABEL);
      const img = await sharp(cell.file)
        .resize({ width: CELL - 8, height: CELL - 8, fit: "contain",
                  background: { r: 16, g: 16, b: 20 } })
        .toBuffer();
      composites.push({ input: img, left: x + 4, top: y + 4 });
      composites.push({
        input: Buffer.from(
          `<svg width="${CELL}" height="${LABEL}"><text x="6" y="18" fill="#ffcc55"` +
            ` font-family="monospace" font-size="15">${cell.caption}</text></svg>`,
        ),
        left: x,
        top: y + CELL,
      });
    }

    const out = join(REVIEW_DIR, `${set}.jpg`);
    write(
      out,
      await sharp({
        create: {
          width: COLS * CELL,
          height: rows * (CELL + LABEL),
          channels: 3,
          background: { r: 16, g: 16, b: 20 },
        },
      })
        .composite(composites)
        .jpeg({ quality: 72 })
        .toBuffer(),
    );
    console.log(`  sheet ${set}.jpg — ${cells.length} candidate(s)`);
  }
}

/* ————————————————— build step ————————————————— */
async function buildMasters() {
  const pending = manifest.assets.filter((a) => !a.keeper);
  if (pending.length) {
    console.error(
      `${pending.length} asset(s) have no keeper yet: ${pending.map((a) => a.id).join(", ")}\n` +
        "Run with --candidates first and cull (§15.5).",
    );
    process.exitCode = 1;
    return;
  }

  /* Seed from what is already on disk rather than starting empty — the same
     thing `media-v3-video-fetch.mjs` does before it writes.
     This file is written by TWO scripts: the 24 image masters here, and the
     video poster there. Starting from `{}` meant re-running this one silently
     dropped `process-pour-poster`, so the poster kept its master on disk but
     lost the placeholder that stands in while the video loads — and nothing
     would have reported it, because the manifest would still look complete at
     24 entries. */
  const blur = existsSync(BLUR_FILE)
    ? JSON.parse(readFileSync(BLUR_FILE, "utf8"))
    : {};
  for (const asset of manifest.assets) {
    const cand = asset.candidates.find((c) => c.variant === asset.keeper);
    if (!cand) throw new Error(`${asset.id}: no candidate "${asset.keeper}"`);

    const out = join(ROOT, asset.master);
    if (!existsSync(out) || force) {
      const src = await fetchBuffer(cand.url);
      const master = await sharp(src)
        .resize({ width: asset.targetWidth, withoutEnlargement: true })
        .avif({ quality: QUALITY[asset.ratio] ?? 50, effort: 6 })
        .toBuffer();
      write(out, master);
      const { width, height } = await sharp(master).metadata();
      console.log(
        `  ✓ ${asset.id.padEnd(18)} ${String(width).padStart(4)}×${String(height).padEnd(4)} ${(master.length / 1024).toFixed(0)}kB`,
      );
    }

    // 20px LQIP (§15.5), as a data URL the pages hand to next/image.
    const lqip = await sharp(readFileSync(out))
      .resize({ width: 20 })
      .webp({ quality: 40 })
      .toBuffer();
    const { width, height } = await sharp(readFileSync(out)).metadata();
    blur[asset.id] = {
      src: `/${asset.master.replace(/^public\//, "")}`,
      width,
      height,
      blurDataURL: `data:image/webp;base64,${lqip.toString("base64")}`,
    };
  }

  write(BLUR_FILE, JSON.stringify(blur, null, 2) + "\n");
  console.log(`\n${Object.keys(blur).length} masters in ${OUT_DIR}`);
  console.log(`LQIP manifest: ${BLUR_FILE}`);
}

console.log(
  wantCandidates
    ? "REDESIGN.md §15.5 — downloading candidates for the cull\n"
    : "REDESIGN.md §15.5 — building masters + LQIP\n",
);
await (wantCandidates ? buildContactSheet() : buildMasters());
