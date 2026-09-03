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
 *   CEILING 52 KB — what the repository actually ships today.
 *
 * The gate FAILS above the ceiling and WARNS between the two. That is a
 * ratchet, not a re-spec: the shipped payload can only go down from here,
 * while closing the remaining gap stays an owner decision (D10 — which
 * motion patterns the site keeps), because the only ways to drop ~6 KB are
 * to give up a GSAP plugin or Lenis, and neither is a hygiene call. Lower
 * the ceiling in the same commit as any change that reduces the payload.
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
const CEILING_BYTES = 52 * 1024;

/** A library is present only when its own implementation is in the file. */
const LIBRARIES = [
  { name: "gsap + ScrollTrigger + SplitText", markers: ["_gsap", "registerPlugin"], min: 8 },
  { name: "lenis", markers: ["wheelMultiplier", "syncTouch", "virtualScroll"], min: 3 },
];

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
