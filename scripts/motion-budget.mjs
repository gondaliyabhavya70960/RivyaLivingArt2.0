#!/usr/bin/env node
/**
 * Part 14 motion budget — "Motion JS ≤ 45 KB gzipped" (REDESIGN.md:895,
 * docs/redesign-contract.md:134).
 *
 *   node scripts/motion-budget.mjs [--dir .next/static/chunks] [--json]
 *
 * The Phase 0 audit recorded this budget as "unmeasured" (§47). It is now
 * measured, and the measurement is the reason this script has two numbers
 * rather than one:
 *
 *   BUDGET  45 KB — the spec.
 *   CEILING 49 KB — what the repository actually ships today.
 *
 * The gate FAILS above the ceiling and WARNS between the two. That is a
 * ratchet, not a re-spec: the shipped payload can only go down from here,
 * and the ceiling is lowered in the same commit as any change that reduces
 * it. It has already moved once — 52 KB to 49 KB — when D18 turned out to
 * have made `SplitText` dead (it lost its only consumer with
 * `kinetic-heading.tsx`) and dropping its registration from `lib/gsap.ts`
 * took 2.9 KB gzipped off every route that uses any GSAP effect.
 *
 * That is worth noting because this header used to claim the remaining gap
 * was "not a hygiene call". Part of it was. What is left needs an owner
 * decision (D10 — which motion patterns the site keeps), because closing
 * 3.2 KB more means giving up ScrollTrigger or Lenis, and those carry the
 * two sanctioned pinned scrubs and the smooth-scroll layer.
 *
 * WHAT COUNTS. Only the chunks that CONTAIN a motion library, never the
 * component chunks that import one — those hold app code that would exist
 * either way, and counting a chunk because the string "gsap" appears in a
 * module reference inflates the figure by whatever else Turbopack put beside
 * it. Detection is therefore on implementation markers with a count floor,
 * and every counted chunk is printed with its markers so a reshuffled build
 * shows up in the table instead of silently measuring nothing.
 */
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const dirIndex = args.indexOf("--dir");
const DIR = dirIndex === -1 ? ".next/static/chunks" : args[dirIndex + 1];
const asJson = args.includes("--json");

const BUDGET_BYTES = 45 * 1024;
const CEILING_BYTES = 49 * 1024;

/** A library is present only when its own implementation is in the file. */
const LIBRARIES = [
  { name: "gsap + ScrollTrigger", markers: ["_gsap", "registerPlugin"], min: 8 },
  { name: "lenis", markers: ["wheelMultiplier", "syncTouch", "virtualScroll"], min: 3 },
];

/**
 * Motion runtimes this project does not ship (owner decision D29).
 *
 * The budget is 45 KB gzipped and GSAP + Lenis already spend 49. There is no
 * room for a second animation runtime, and `motion` alone is ~30 KB — so the
 * question is not "does it fit" but "which one goes". That is an owner call,
 * not something a component library decides by being convenient.
 *
 * This is checked against package.json rather than the bundle, because the
 * marker table above only finds a library that is already installed AND whose
 * minified internals still carry the name guessed for it. Nothing in it looked
 * for framer-motion — so a new runtime could pass the very gate that exists to
 * keep it out. A declared dependency is a fact, not a guess, and it fails on
 * the commit that adds the package rather than on whichever later build
 * finally grows past the ceiling.
 *
 * `three` is deliberately NOT listed. It is installed and it is a motion
 * library, but it renders the PDP's 3D model behind a demand-loaded viewer
 * that no other route pays for — an exception the budget was never meant to
 * cover. Listing it would fail the gate for architecture that is correct.
 */
const BANNED_RUNTIMES = [
  "motion",
  "framer-motion",
  "@react-spring/web",
  "react-spring",
  "@formkit/auto-animate",
  "animejs",
  "popmotion",
  "react-motion",
  "@motionone/dom",
];

/** Banned runtimes that are declared in package.json. Empty is the pass. */
function bannedDependencies() {
  const pkg = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
  );
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  return BANNED_RUNTIMES.filter((name) => declared.has(name));
}

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

/* The dependency guard runs FIRST, before the chunk walk. It needs no build,
   so it still fires in a tree nobody has built yet — which is exactly when
   somebody has just run `npm i motion` and not yet found out. */
const banned = bannedDependencies();
if (banned.length) {
  console.error(
    `\n✗ motion-budget: ${banned.join(", ")} in package.json.\n` +
      `  This project ships GSAP + Lenis and they already spend the whole\n` +
      `  49 KB ceiling. A second animation runtime is an owner decision\n` +
      `  (D29), not a dependency — remove it, or change D29 and this list\n` +
      `  in the same commit.`,
  );
  process.exit(1);
}

const files = walk(DIR);
if (files.length === 0) {
  console.error(
    `motion-budget: no .js chunks under ${DIR} — run \`npm run build\` first.`,
  );
  process.exit(1);
}

const counted = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const library of LIBRARIES) {
    const hits = library.markers.reduce(
      (n, marker) => n + (source.split(marker).length - 1),
      0,
    );
    if (hits >= library.min) {
      const raw = Buffer.byteLength(source);
      const gzip = gzipSync(source).length;
      counted.push({ file, library: library.name, hits, raw, gzip });
      break;
    }
  }
}

const total = counted.reduce((sum, c) => sum + c.gzip, 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

if (asJson) {
  console.log(JSON.stringify({ chunks: counted, totalGzip: total }, null, 2));
} else {
  console.log(`Motion payload under ${DIR}`);
  for (const c of counted) {
    console.log(
      `  ${kb(c.gzip).padStart(9)} gzipped  ${kb(c.raw).padStart(9)} raw   ${c.file}  ⟵ ${c.library} (${c.hits} markers)`,
    );
  }
  console.log(`  ${kb(total).padStart(9)} gzipped  TOTAL`);
  console.log(`  budget ${kb(BUDGET_BYTES)} · enforced ceiling ${kb(CEILING_BYTES)}`);
}

// No library found at all means the detector broke, not that the site got
// fast: this repo ships GSAP and Lenis, and a silent zero is the one result
// a budget gate must never report as a pass.
if (counted.length === 0) {
  console.error(
    "\n✗ motion-budget: no chunk contained a motion library. The build layout changed — update the markers in this script rather than trusting the zero.",
  );
  process.exit(1);
}

if (total > CEILING_BYTES) {
  console.error(
    `\n✗ motion JS is ${kb(total)} gzipped, over the enforced ceiling of ${kb(CEILING_BYTES)} (spec budget ${kb(BUDGET_BYTES)}).`,
  );
  process.exit(1);
}

if (total > BUDGET_BYTES) {
  console.warn(
    `\n! motion JS is ${kb(total)} gzipped — over Part 14's ${kb(BUDGET_BYTES)} budget, under the ${kb(CEILING_BYTES)} ceiling this gate holds. Closing the gap is owner decision D10.`,
  );
  process.exit(0);
}

console.log(`\n✓ motion JS ${kb(total)} gzipped, within the ${kb(BUDGET_BYTES)} budget.`);
