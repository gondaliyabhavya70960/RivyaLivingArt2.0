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

import {
  entryKind,
  isPlanned,
  plannedEntries,
  tallyPlanned,
} from "./lib/media-v3-planned.mjs";

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

// 4. master paths unique — across the promoted planned rows too, since
// media-v3-fetch.mjs now builds those in the same pass and a collision would
// mean one run overwriting the other's file.
const planned = plannedEntries(m);
const seen = new Map();
for (const a of [...m.assets, ...planned.filter((e) => !isPlanned(e))]) {
  if (!a.master) continue; // reported by rule 3 or rule 6, not twice here
  if (seen.has(a.master)) problems.push(`duplicate master ${a.master}: ${seen.get(a.master)} & ${a.id}`);
  seen.set(a.master, a.id);
}

// 5. video
for (const v of m.videos ?? []) {
  const c = v.candidates?.find(x => x.variant === v.keeper);
  if (!c?.url) problems.push(`video ${v.id}: keeper "${v.keeper}" has no url`);
  for (const f of ["master","masterWebm","poster"]) if (!v[f]) problems.push(`video ${v.id}: no ${f}`);
}

// 6. plannedSets (batch D · media system) — the generation queue
// (docs/transformation-audit.md §10.3). A `status: "planned"` row is SKIPPED
// everywhere above and here: it has no keeper and no master BY DESIGN, so
// holding it to rules 1–4 would fail every row in the set and a build would
// fail for imagery nobody has generated yet. A row an owner has PROMOTED is a
// different thing — media-v3-fetch.mjs builds it alongside `assets`, so from
// that moment it answers the same questions the assets do.
const REQUIRED_PLANNED_FIELDS = [
  "id", "set", "placement", "ratio", "targetWidth", "alt", "prompt",
  "candidates", "keeper", "status",
];
for (const e of planned) {
  for (const field of REQUIRED_PLANNED_FIELDS) {
    if (!(field in e)) problems.push(`plannedSets/${e.id ?? "?"}: missing "${field}"`);
  }
  if (isPlanned(e)) continue; // nothing to verify offline yet
  // Promoted out of "planned": a real asset from here on, held to the same
  // keeper/candidate rules as everything in m.assets — and to the same field
  // rules, because media-v3-fetch.mjs builds it in the very same loop.
  const c = e.candidates?.find((x) => x.variant === e.keeper);
  if (!e.keeper) problems.push(`plannedSets/${e.id}: promoted but not culled — run --candidates, then set "keeper"`);
  else if (!c) problems.push(`plannedSets/${e.id}: no candidate "${e.keeper}"`);
  else if (!c.url) problems.push(`plannedSets/${e.id}: keeper has no url`);
  const masters = entryKind(e) === "loop" ? ["master", "masterWebm", "poster"] : ["master"];
  for (const field of masters) {
    if (!e[field]) problems.push(`plannedSets/${e.id}: no ${field} path`);
    else if (!e[field].startsWith("public/")) problems.push(`plannedSets/${e.id}: ${field} outside public/`);
  }
  if (!Number.isInteger(e.targetWidth)) problems.push(`plannedSets/${e.id}: targetWidth not an integer`);
}
const plannedIds = new Set();
for (const e of planned) {
  if (e.id && plannedIds.has(e.id)) problems.push(`plannedSets: duplicate id ${e.id}`);
  if (e.id) plannedIds.add(e.id);
}

const tally = tallyPlanned(planned);
console.log(`assets: ${m.assets.length}   videos: ${(m.videos??[]).length}   plannedSets: ${planned.length} (${tally.planned} planned, ${tally.unculled} awaiting a cull, ${tally.ready} ready to build)`);
console.log(`distinct master paths: ${seen.size}`);
console.log(`unique CDN hosts: ${[...new Set(m.assets.map(a=>new URL(a.candidates.find(c=>c.variant===a.keeper).url).host))].join(", ")}`);
console.log();
console.log(problems.length ? "PROBLEMS:\n  " + problems.join("\n  ") : "PREFLIGHT CLEAN — buildMasters() has everything it needs offline.");
