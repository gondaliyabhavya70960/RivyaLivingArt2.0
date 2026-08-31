/**
 * Offline preflight for the §15.5 masters run.
 *
 * `media-v3-fetch.mjs` fails in two ways that are cheap to catch first and
 * expensive to hit midway through 24 downloads: it exits 1 when any asset has
 * no `keeper`, and throws when a keeper names a candidate that is not there.
 * This checks both, plus the fields `buildMasters()` reads, WITHOUT touching
 * the network — so it runs anywhere, including a sandbox whose egress policy
 * blocks the Higgsfield CDN.
 *
 *   node scripts/media-v3-preflight.mjs
 *
 * Clean output means the masters run has everything it needs and only the
 * download itself can fail.
 */
import { readFileSync } from "node:fs";
const m = JSON.parse(readFileSync("docs/media-v3-manifest.json", "utf8"));
let problems = [];

// 1. every asset has a keeper (buildMasters exits 1 otherwise)
const noKeeper = m.assets.filter(a => !a.keeper);
if (noKeeper.length) problems.push(`assets without keeper: ${noKeeper.map(a=>a.id)}`);

// 2. the keeper candidate exists (it throws otherwise)
for (const a of m.assets) {
  const c = a.candidates?.find(x => x.variant === a.keeper);
  if (!c) problems.push(`${a.id}: no candidate "${a.keeper}"`);
  else if (!c.url) problems.push(`${a.id}: keeper has no url`);
  else if (!/^https:\/\//.test(c.url)) problems.push(`${a.id}: url not https`);
}

// 3. fields buildMasters reads
for (const a of m.assets) {
  if (!a.master) problems.push(`${a.id}: no master path`);
  if (!a.master?.startsWith("public/")) problems.push(`${a.id}: master outside public/`);
  if (!Number.isInteger(a.targetWidth)) problems.push(`${a.id}: targetWidth not an integer`);
  if (!a.ratio) problems.push(`${a.id}: no ratio`);
}

// 4. master paths unique
const seen = new Map();
for (const a of m.assets) {
  if (seen.has(a.master)) problems.push(`duplicate master ${a.master}: ${seen.get(a.master)} & ${a.id}`);
  seen.set(a.master, a.id);
}

// 5. video
for (const v of m.videos ?? []) {
  const c = v.candidates?.find(x => x.variant === v.keeper);
  if (!c?.url) problems.push(`video ${v.id}: keeper "${v.keeper}" has no url`);
  for (const f of ["master","masterWebm","poster"]) if (!v[f]) problems.push(`video ${v.id}: no ${f}`);
}

console.log(`assets: ${m.assets.length}   videos: ${(m.videos??[]).length}`);
console.log(`distinct master paths: ${seen.size}`);
console.log(`unique CDN hosts: ${[...new Set(m.assets.map(a=>new URL(a.candidates.find(c=>c.variant===a.keeper).url).host))].join(", ")}`);
console.log();
console.log(problems.length ? "PROBLEMS:\n  " + problems.join("\n  ") : "PREFLIGHT CLEAN — buildMasters() has everything it needs offline.");
