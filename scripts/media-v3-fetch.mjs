#!/usr/bin/env node
/**
 * REDESIGN.md §15.5 as an executable pipeline.
 *
 *   node scripts/media-v3-fetch.mjs --planned            # what is queued, and why
 *   node scripts/media-v3-fetch.mjs --promote <id> <url>… # a plan becomes an asset
 *   node scripts/media-v3-fetch.mjs --candidates         # cull step: contact sheet
 *   node scripts/media-v3-fetch.mjs                      # build step: masters + LQIP
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
 *
 * THE PLANNED SETS ARE PART OF THIS SCRIPT'S JOB TOO
 * `docs/media-v3-manifest.json` also carries `plannedSets` — 28 entries batch D
 * recorded as the next photography batch. They have a prompt but no candidates
 * and no master, so nothing here could fetch them; for a while this script did
 * not even look at them, and a documented "run media-v3-fetch.mjs on an ordinary
 * machine" therefore produced an empty result and no explanation. Every run now
 * reports the queue, `--planned` prints it in full with the order to work it in,
 * and `--promote` turns one row into an ordinary asset the paths above already
 * handle. The state machine itself lives in scripts/lib/media-v3-planned.mjs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

import {
  describePlanned,
  isPlanned,
  plannedEntries,
  promotePlanned,
  promotedStills,
  tallyPlanned,
} from "./lib/media-v3-planned.mjs";

const ROOT = join(import.meta.dirname, "..");
const MANIFEST = join(ROOT, "docs/media-v3-manifest.json");
const OUT_DIR = join(ROOT, "public/media/v3");
const BLUR_FILE = join(ROOT, "src/lib/media-v3-blur.json");
const SHEET_DIR = join(ROOT, ".media-v3-candidates");
// Committed review sheets. The candidate AVIFs above stay out of git; these
// composites are the one artefact a reviewer (or an agent that cannot reach
// the CDN) actually needs in order to cull.
const REVIEW_DIR = join(ROOT, "docs/media-v3-review");

const USAGE = `Usage:
  node scripts/media-v3-fetch.mjs --planned
  node scripts/media-v3-fetch.mjs --promote <id> [<candidate url> …]
  node scripts/media-v3-fetch.mjs --candidates [--force]
  node scripts/media-v3-fetch.mjs [--force]`;

const args = process.argv.slice(2);
const wantCandidates = args.includes("--candidates");
const wantPlanned = args.includes("--planned");
const force = args.includes("--force");
const promoteAt = args.indexOf("--promote");
// Everything after --promote up to the next flag: the id, then the result URLs.
const promoteArgs =
  promoteAt === -1 ? [] : args.slice(promoteAt + 1).filter((a) => !a.startsWith("--"));
const [promoteId, ...promoteUrls] = promoteArgs;

/* A typo used to be indistinguishable from the default run — `--promot bench-x`
   silently rebuilt every master instead of promoting anything. Refuse instead. */
const KNOWN_FLAGS = new Set(["--candidates", "--force", "--planned", "--promote"]);
const stray = args.filter(
  (a, i) =>
    (a.startsWith("--") && !KNOWN_FLAGS.has(a)) ||
    (!a.startsWith("--") && (promoteAt === -1 || i < promoteAt)),
);
if (stray.length) {
  console.error(`Unrecognised argument: ${stray.join(", ")}\n\n${USAGE}`);
  process.exit(1);
}
if (wantPlanned && promoteAt !== -1) {
  console.error(`--planned lists the queue and --promote changes it; run one at a time.\n\n${USAGE}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

/**
 * The rows this run treats as assets: the 25 originals plus any planned entry
 * an owner has promoted. A promoted row carries the same fields, so everything
 * below it — contact sheet, review sheets, masters, LQIP — is unchanged.
 */
function assetsForRun() {
  const promoted = promotedStills(manifest);
  for (const entry of promoted) {
    if (!entry.master) {
      throw new Error(
        `plannedSets/${entry.id} left "planned" without a master path. ` +
          `Re-run: node scripts/media-v3-fetch.mjs --promote ${entry.id}`,
      );
    }
  }
  return [...manifest.assets, ...promoted];
}

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
  for (const asset of assetsForRun()) {
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
        // A promoted row's candidates come from a pasted URL, which may carry
        // no job id — a caption is not worth a crash three downloads in.
        `<figure><img src="${name}" alt=""><figcaption>${cand.variant}${cand.jobId ? ` · ${cand.jobId.slice(0, 8)}` : ""}</figcaption></figure>`,
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

  const assets = assetsForRun();
  const sets = [...new Set(assets.map((a) => a.set))];
  for (const set of sets) {
    const cells = [];
    for (const asset of assets.filter((a) => a.set === set)) {
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
  const assets = assetsForRun();
  const pending = assets.filter((a) => !a.keeper);
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
  for (const asset of assets) {
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

/* ————————————————— the planned queue —————————————————
 * `plannedSets` is the generation plan: a prompt, a placement and a ratio, with
 * no candidates and no file. Nothing here can fetch one — the pictures do not
 * exist yet — so the only useful thing a script can do is say so precisely, and
 * name the one command that moves a row forward.
 */

const SEQUENCE = `The sequence, on a machine with ordinary internet:
  1. Generate the entry's prompt from docs/media-v3-manifest.json. It already
     carries §15.3's palette suffix and the "no faces, no logos, no text" clause.
  2. node scripts/media-v3-fetch.mjs --promote <id> <url> [<url>]
     Records the results as candidates and fills in the master path.
  3. node scripts/media-v3-fetch.mjs --candidates
     Contact sheet; cull to one variant and set "keeper" on the entry.
     (SET F loops: media-v3-video-fetch.mjs --candidates instead.)
  4. node scripts/media-v3-fetch.mjs
     Writes the AVIF master and its LQIP. (SET F: media-v3-video-fetch.mjs.)
  5. Point a slot at the new file in /studio/site-images. Nothing on the site
     reads a new master until a slot names it — a built master is not a wired one.`;

function listPlanned() {
  const entries = plannedEntries(manifest);
  if (entries.length === 0) {
    console.log("No `plannedSets` in docs/media-v3-manifest.json — nothing queued.");
    return;
  }

  const sets = manifest.plannedSets?.sets ?? {};
  for (const set of [...new Set(entries.map((e) => e.set))]) {
    console.log(`\n${set}${sets[set] ? ` — ${sets[set]}` : ""}`);
    for (const entry of entries.filter((e) => e.set === set)) {
      const { state, needs } = describePlanned(entry);
      console.log(
        `  ${entry.id.padEnd(26)} ${String(entry.ratio).padEnd(5)} ` +
          `${String(entry.targetWidth).padStart(4)}  ${state.padEnd(10)} needs ${needs}`,
      );
    }
  }

  const tally = tallyPlanned(entries);
  console.log(
    `\n${entries.length} entries: ${tally.planned} planned · ${tally.generated} generated · ` +
      `${tally.incomplete} incomplete · ${tally.unculled} awaiting a cull · ` +
      `${tally.ready} ready to build.\n`,
  );
  console.log(SEQUENCE);
}

/**
 * The rule this script broke from the day batch D wrote the queue: never
 * finish silently.
 *
 * A default run with every master already on disk prints "25 masters" and
 * exits — which, while 28 planned entries sat unfetchable in the same file,
 * read as "the media set is complete". Every mode ends here instead.
 */
function reportPlannedTail() {
  const entries = plannedEntries(manifest);
  const waiting = entries.map(describePlanned).filter((d) => d.state !== "ready");
  if (waiting.length === 0) return;

  const byNeed = new Map();
  for (const d of waiting) byNeed.set(d.needs, [...(byNeed.get(d.needs) ?? []), d.id]);

  console.log(
    `\n${waiting.length} of ${entries.length} plannedSets entries could not be built by this run:`,
  );
  for (const [needs, ids] of byNeed) {
    console.log(`  · ${ids.length} ${ids.length === 1 ? "needs" : "need"} ${needs}`);
    console.log(`      ${ids.join(", ")}`);
  }
  console.log("\n  node scripts/media-v3-fetch.mjs --planned   — the full queue and the order to work it in");
}

/** Promote ONE row: candidates in, master path filled, status flipped. */
function promote(id, urls) {
  const entries = plannedEntries(manifest);
  const entry = entries.find((e) => e.id === id);
  if (!entry) {
    console.error(
      `No planned entry "${id}" in docs/media-v3-manifest.json.\n` +
        "  node scripts/media-v3-fetch.mjs --planned   — the ids that do exist",
    );
    process.exit(1);
  }
  if (!isPlanned(entry)) {
    // Idempotent like the rest of the script: say where the row already is.
    const { state, needs } = describePlanned(entry);
    console.log(`${id} was promoted already (${state}). It needs ${needs}.`);
    return;
  }

  let promoted;
  try {
    promoted = promotePlanned(entry, urls);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  /* Replace rather than Object.assign: a promoted row's fields are ordered to
     match an `assets` row, and assigning into the old object would append
     `master` at the end instead. The manifest is read by people. */
  entries[entries.indexOf(entry)] = promoted;
  write(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`✓ ${id} promoted — ${promoted.candidates.length} candidate(s), master ${promoted.master}`);
  console.log(`  docs/media-v3-manifest.json updated. Next: ${describePlanned(promoted).needs}`);
  if (promoted.masterWebm) {
    console.log(
      "  This is a SET F loop: media-v3-video-fetch.mjs builds it (MP4 + WebM + poster), not this script.",
    );
  }
}

if (wantPlanned) {
  console.log("REDESIGN.md §15.5 — the generation queue (docs/media-v3-manifest.json → plannedSets)");
  listPlanned();
} else if (promoteAt !== -1) {
  if (!promoteId) {
    console.error(`--promote needs the id of a planned entry.\n\n${USAGE}`);
    process.exit(1);
  }
  promote(promoteId, promoteUrls);
  reportPlannedTail();
} else {
  console.log(
    wantCandidates
      ? "REDESIGN.md §15.5 — downloading candidates for the cull\n"
      : "REDESIGN.md §15.5 — building masters + LQIP\n",
  );
  await (wantCandidates ? buildContactSheet() : buildMasters());
  reportPlannedTail();
}
