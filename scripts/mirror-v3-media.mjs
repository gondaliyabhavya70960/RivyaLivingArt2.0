/**
 * Mirror the v3 "Midnight Gallery" ambient media (Higgsfield CDN) into the
 * repo as first-party assets under public/media/:
 *
 *   images: <name>.webp            (sharp, manifest width, q82)
 *   videos: <name>.mp4             (ffmpeg h264 CRF 28, faststart, no audio)
 *           <name>-poster.jpg      (first frame, q4 — <video poster>)
 *
 * Run on any machine with open internet + ffmpeg (GitHub Actions runners have
 * both — the build sandboxes' egress policy blocks the CDN host):
 *
 *   node scripts/mirror-v3-media.mjs
 *
 * Source of truth: scripts/v3-media.json.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(path.join(root, "scripts", "v3-media.json"), "utf8"),
);
const sharp = (
  await import(path.join(root, "node_modules", "sharp", "lib", "index.js"))
).default;

const outDir = path.join(root, "public", "media");
mkdirSync(outDir, { recursive: true });

let ok = 0;
let failed = 0;

async function fetchBuf(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

for (const [name, spec] of Object.entries(manifest.images ?? {})) {
  try {
    const buf = await fetchBuf(spec.url);
    await sharp(buf)
      .resize({ width: spec.width ?? 1920, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(outDir, `${name}.webp`));
    ok++;
    console.log(`✓ media/${name}.webp`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}: ${e instanceof Error ? e.message : e}`);
  }
}

for (const [name, spec] of Object.entries(manifest.videos ?? {})) {
  const raw = path.join(outDir, `${name}.src.mp4`);
  const out = path.join(outDir, `${name}.mp4`);
  const poster = path.join(outDir, `${name}-poster.jpg`);
  try {
    writeFileSync(raw, await fetchBuf(spec.url));
    // Compress: 1080p max, silent, web-optimized. CRF 28 keeps ambient loops
    // ~1.5-3 MB — these are decorative backgrounds, not hero footage.
    execFileSync("ffmpeg", [
      "-y", "-i", raw,
      "-an",
      "-vf", "scale='min(1920,iw)':-2",
      "-c:v", "libx264", "-preset", "slow", "-crf", "28",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      out,
    ], { stdio: ["ignore", "ignore", "inherit"] });
    execFileSync("ffmpeg", [
      "-y", "-i", out, "-frames:v", "1", "-q:v", "4", poster,
    ], { stdio: ["ignore", "ignore", "inherit"] });
    rmSync(raw);
    const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
    ok++;
    console.log(`✓ media/${name}.mp4 (${mb} MB) + poster`);
  } catch (e) {
    failed++;
    try { rmSync(raw); } catch {}
    console.error(`✗ ${name}: ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`\nMirrored ${ok} assets${failed ? `, ${failed} FAILED` : ""}.`);
if (failed) process.exitCode = 1;
