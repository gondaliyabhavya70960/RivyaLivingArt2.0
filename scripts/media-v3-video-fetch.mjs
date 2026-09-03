/**
 * REDESIGN.md §15.3 — the video half of the Part 15 pipeline.
 *
 * `media-v3-fetch.mjs` turns the manifest's `assets` into AVIF stills. This is
 * its sibling for `videos`: the site has exactly one motion surface (the
 * process hero) and §15.3 asks for something a still pipeline cannot produce —
 * "seamless 6–16s loops, exported as MP4 (H.264, yuv420p) + WebM (VP9),
 * ≤2.5 MB per loop, always muted playsinline loop preload='metadata' with a
 * poster."
 *
 * Two modes, run in the same order as the stills:
 *
 *   --candidates  Downloads every candidate and writes ONE flat contact sheet
 *                 per video into docs/media-v3-review/ — a strip of frames
 *                 across the clip, plus its real duration, resolution and
 *                 size. The generating session cannot reach Higgsfield's CDN
 *                 (its egress answers 403 on CONNECT), so this sheet is the
 *                 only way it can cull. Set `"keeper": "a" | "b"` on the video
 *                 in docs/media-v3-manifest.json, then re-run without the flag.
 *
 *   (default)     Downloads the keeper and writes three files: an H.264 MP4, a
 *                 VP9 WebM and an AVIF poster cut from frame 0 of that same
 *                 clip. The poster is cut rather than generated separately
 *                 because it stands in for the video under reduced motion, on
 *                 touch and with no JS — a poster that does not match the
 *                 footage is a worse lie than no video at all, which is why
 *                 this pair was deferred when the stills shipped.
 *
 * Both MP4 and WebM are encoded down until they clear §15.3's 2.5 MB ceiling;
 * the script fails rather than committing an oversized loop, because the file
 * sits behind the LCP poster on the one page that is meant to feel like the
 * material.
 *
 * ffmpeg is required and is NOT assumed: it was dropped from the ubuntu-24.04
 * runner image, so the workflow installs it and this script checks for it
 * before doing any work. The first run failed on a raw ENOENT three steps in,
 * which is a bad way to learn a dependency is missing.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..");
const MANIFEST = join(ROOT, "docs/media-v3-manifest.json");
const OUT_DIR = join(ROOT, "public/media/v3");
const BLUR_FILE = join(ROOT, "src/lib/media-v3-blur.json");
const REVIEW_DIR = join(ROOT, "docs/media-v3-review");
const TMP = join(ROOT, ".media-v3-video-tmp");

const args = process.argv.slice(2);
const wantCandidates = args.includes("--candidates");
const force = args.includes("--force");

/** §15.3's hard ceiling, per encoded loop. */
const MAX_BYTES = 2.5 * 1024 * 1024;
/** Frames across the clip on the contact sheet — enough to judge a loop. */
const SHEET_FRAMES = 6;

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const videos = manifest.videos ?? [];

function sh(cmd, cmdArgs) {
  return execFileSync(cmd, cmdArgs, { stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * Fail on the missing dependency, not three steps later on a spawn error.
 *
 * `execFileSync` throws ENOENT with a stack pointing at child_process, which
 * says nothing about what to install — and the first run of this script hit
 * exactly that after downloading a file it then could not read.
 */
function requireFfmpeg() {
  for (const bin of ["ffmpeg", "ffprobe"]) {
    try {
      sh(bin, ["-version"]);
    } catch {
      console.error(
        `${bin} is not on PATH. Install it first ` +
          "(`sudo apt-get install -y ffmpeg`, or `brew install ffmpeg`). The " +
          "fetch-media-v3-video.yml workflow that used to install it for you " +
          "was deleted under D24 once the masters were committed.",
      );
      process.exit(1);
    }
  }
}

function ffprobe(file) {
  const out = sh("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,duration,nb_frames",
    "-show_entries",
    "format=duration,size",
    "-of",
    "json",
    file,
  ]).toString();
  const p = JSON.parse(out);
  const s = p.streams?.[0] ?? {};
  return {
    width: Number(s.width) || 0,
    height: Number(s.height) || 0,
    duration: Number(s.duration || p.format?.duration) || 0,
    bytes: Number(p.format?.size) || statSync(file).size,
  };
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/* ————————————————— cull step —————————————————
 * One horizontal strip per candidate, frames sampled evenly across the clip,
 * with the numbers that decide it printed to stdout. A loop is judged on
 * whether the first and last frames could sit next to each other, so the
 * strip always includes both ends.
 */
async function buildReviewSheets() {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(REVIEW_DIR, { recursive: true });

  for (const video of videos) {
    const rows = [];
    for (const cand of video.candidates ?? []) {
      if (!cand.url) {
        console.log(`  · ${video.id}-${cand.variant}: no url yet — skipped`);
        continue;
      }
      const src = join(TMP, `${video.id}-${cand.variant}.mp4`);
      if (!existsSync(src) || force) await download(cand.url, src);
      const meta = ffprobe(src);
      console.log(
        `  · ${video.id}-${cand.variant}: ${meta.width}x${meta.height} ` +
          `${meta.duration.toFixed(2)}s ${(meta.bytes / 1024).toFixed(0)} KB` +
          (meta.duration < 6 || meta.duration > 16
            ? "  ⚠ outside §15.3's 6–16s loop range"
            : ""),
      );

      const frames = [];
      for (let i = 0; i < SHEET_FRAMES; i++) {
        // Last sample sits just inside the final frame rather than on the
        // duration itself, which ffmpeg seeks past and returns empty.
        const t = (meta.duration * i) / (SHEET_FRAMES - 1);
        const at = Math.max(0, Math.min(t, meta.duration - 0.05));
        const out = join(TMP, `${video.id}-${cand.variant}-${i}.png`);
        sh("ffmpeg", ["-y", "-ss", String(at), "-i", src, "-frames:v", "1", out]);
        frames.push(await sharp(out).resize({ width: 420 }).toBuffer());
      }
      rows.push({ label: `${video.id}-${cand.variant}`, meta, frames });
    }

    if (rows.length === 0) continue;

    const cellW = 420;
    const cellH = Math.round((cellW * 9) / 16);
    const sheet = await sharp({
      create: {
        width: cellW * SHEET_FRAMES,
        height: cellH * rows.length,
        channels: 3,
        background: { r: 8, g: 10, b: 14 },
      },
    })
      .composite(
        rows.flatMap((row, r) =>
          row.frames.map((buf, c) => ({
            input: buf,
            left: c * cellW,
            top: r * cellH,
          })),
        ),
      )
      .jpeg({ quality: 82 })
      .toBuffer();

    // `video.id`, not `videos[0].id` — inside the per-video loop the latter
    // names every sheet after the first entry, so a second video would
    // silently overwrite the first one's sheet. Harmless with one video today,
    // wrong the moment there are two.
    const out = join(REVIEW_DIR, `${video.id}-video.jpg`);
    writeFileSync(out, sheet);
    console.log(
      `\n✓ ${out}\n  rows, top to bottom: ${rows.map((r) => r.label).join(", ")}`,
    );
  }

  console.log(
    '\nSet "keeper": "a" | "b" on the video in docs/media-v3-manifest.json, then re-run without --candidates.',
  );
}

/* ————————————————— master step —————————————————
 * Encode down until it fits. Two passes of CRF rather than a bitrate target:
 * the clip is a dark gradient, where a fixed bitrate either bands the shadows
 * or wastes bytes on a frame that barely moves.
 */
function encodeUnderCeiling(src, out, kind) {
  const ladder =
    kind === "mp4"
      ? [24, 27, 30, 33, 36]
      : // VP9 sits roughly 6–8 CRF points higher for the same look.
        [32, 35, 38, 41, 44];

  for (const crf of ladder) {
    const common = [
      "-y",
      "-i",
      src,
      // Decorative background loop — §15.3 says muted, so the track is dropped
      // rather than silenced: bytes nobody will ever hear.
      "-an",
      "-vf",
      "scale=1920:-2",
      "-pix_fmt",
      "yuv420p",
    ];
    const enc =
      kind === "mp4"
        ? ["-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-movflags", "+faststart"]
        : ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(crf), "-row-mt", "1"];
    sh("ffmpeg", [...common, ...enc, out]);
    const bytes = statSync(out).size;
    console.log(
      `  ${kind} crf ${crf}: ${(bytes / 1024).toFixed(0)} KB` +
        (bytes <= MAX_BYTES ? "  ✓" : "  — over 2.5 MB, retrying"),
    );
    if (bytes <= MAX_BYTES) return bytes;
  }
  throw new Error(
    `${kind} could not be brought under §15.3's 2.5 MB ceiling for ${src}. ` +
      "Shorten the loop or lower the resolution rather than shipping it over.",
  );
}

async function buildMasters() {
  const pending = videos.filter((v) => !v.keeper);
  if (pending.length) {
    console.error(
      `No keeper chosen for: ${pending.map((v) => v.id).join(", ")}.\n` +
        "Run with --candidates, open the sheet in docs/media-v3-review/, then set keeper.",
    );
    process.exitCode = 1;
    return;
  }

  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const blur = existsSync(BLUR_FILE)
    ? JSON.parse(readFileSync(BLUR_FILE, "utf8"))
    : {};

  for (const video of videos) {
    const cand = video.candidates.find((c) => c.variant === video.keeper);
    if (!cand?.url) throw new Error(`${video.id}: keeper "${video.keeper}" has no url`);

    const src = join(TMP, `${video.id}-keeper.mp4`);
    if (!existsSync(src) || force) await download(cand.url, src);
    const meta = ffprobe(src);
    console.log(
      `${video.id}: source ${meta.width}x${meta.height} ${meta.duration.toFixed(2)}s`,
    );
    if (meta.duration < 6 || meta.duration > 16) {
      throw new Error(
        `${video.id}: keeper is ${meta.duration.toFixed(2)}s — §15.3 asks for a 6–16s loop.`,
      );
    }

    encodeUnderCeiling(src, join(ROOT, video.master), "mp4");
    encodeUnderCeiling(src, join(ROOT, video.masterWebm), "webm");

    // The poster is frame 0 of the encoded MP4, not of the source: it has to
    // match the first thing the visitor actually sees when the loop starts.
    const frame = join(TMP, `${video.id}-poster.png`);
    sh("ffmpeg", ["-y", "-i", join(ROOT, video.master), "-frames:v", "1", frame]);
    const posterPath = join(ROOT, video.poster);
    const poster = await sharp(frame).avif({ quality: 50, effort: 6 }).toBuffer();
    writeFileSync(posterPath, poster);
    const dims = await sharp(poster).metadata();
    console.log(
      `  poster ${dims.width}x${dims.height} ${(poster.length / 1024).toFixed(0)} KB`,
    );

    const lqip = await sharp(poster).resize({ width: 20 }).webp({ quality: 20 }).toBuffer();
    blur[`${video.id}-poster`] = {
      src: `/${video.poster.replace(/^public\//, "")}`,
      width: dims.width,
      height: dims.height,
      blurDataURL: `data:image/webp;base64,${lqip.toString("base64")}`,
    };
  }

  writeFileSync(BLUR_FILE, `${JSON.stringify(blur, null, 2)}\n`);
  console.log(`\n✓ ${BLUR_FILE} — ${Object.keys(blur).length} entries`);
}

if (videos.length === 0) {
  console.log("No `videos` in docs/media-v3-manifest.json — nothing to do.");
} else {
  requireFfmpeg();
  if (wantCandidates) await buildReviewSheets();
  else await buildMasters();
  if (existsSync(TMP) && !wantCandidates) rmSync(TMP, { recursive: true, force: true });
}
