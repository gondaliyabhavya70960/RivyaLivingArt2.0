#!/usr/bin/env node
/**
 * ALT-TEXT AUDIT — read-only, no browser, no database, no network.
 *
 * `redesign-audit.mjs` already checks the two things you can only see in a
 * RENDERED page: an `<img>` with no `alt` attribute at all, and an alt that
 * names the brand instead of describing the picture. This script checks what
 * a rendered page cannot show you, which is everything about the alt text
 * that is never on screen:
 *
 *  1. **An English alt literal in a nine-locale surface.** `alt="Blue resin
 *     river table"` renders perfectly and is a bug in eight languages. The
 *     storefront routes it through next-intl today; nothing enforced it, and
 *     one hardcoded string would never fail a gate — the audits read the
 *     English render. The Studio is exempt: it is English-only by design
 *     (CLAUDE.md), so a literal there is correct.
 *
 *  2. **Alt copy that describes the medium instead of the subject.** "Image
 *     of a table" is read aloud as "image, image of a table" — the role is
 *     already announced. Only the English registry is checked, because that
 *     is where copy is authored (`messages/en.json` first, then the batch).
 *
 *  3. **An alt key that exists and says nothing**, and one long enough to be
 *     a caption. Both are invisible to a sighted reviewer by definition.
 *
 * It reports and exits 1 on any FAIL. It writes nothing, reads only the repo,
 * and needs no server — which is the point: this is the one audit in the set
 * that can run before anything is built.
 *
 *   node scripts/alt-audit.mjs [--list]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const LIST = process.argv.includes("--list");

/* The nine-locale surfaces. Everything under `src/app/studio` and
   `src/components/studio` is deliberately NOT here. */
const LOCALIZED_DIRS = [
  "src/app/[locale]",
  "src/components/storefront",
  "src/components/product",
  "src/components/sections",
];

/** Copy that announces the medium — a screen reader has already said "image". */
const REDUNDANT =
  /^\s*(an?\s+)?(image|photo|photograph|picture|graphic|illustration|icon|screenshot)\s+(of|showing|depicting)\b/i;

/** A filename that escaped into the copy. */
const FILENAME = /\.(jpe?g|png|webp|avif|gif|svg)\b/i;

/** §19 gives alt text one sentence; past ~125 chars it is a caption. */
const MAX_ALT = 125;

const fails = [];
const notes = [];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/* ————————————— 1 · hardcoded alt literals in localized surfaces ————————————— */

const files = LOCALIZED_DIRS.flatMap((d) => walk(join(ROOT, d)));
let literalCount = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  // `alt="…"` with anything between the quotes. `alt=""` is the decorative
  // case and is correct — an empty alt is not copy.
  for (const match of src.matchAll(/\balt="([^"]+)"/g)) {
    literalCount += 1;
    fails.push(
      `${relative(ROOT, file)} — alt="${match[1]}" is a hardcoded string on a nine-locale surface; put it in messages/en.json and translate the batch`,
    );
  }
}

/* ————————————— 2 · the English alt copy itself ————————————— */

const messages = JSON.parse(
  readFileSync(join(ROOT, "messages/en.json"), "utf8"),
);

/** Every leaf whose key path names it as alt text. */
const altEntries = [];
(function collect(node, path) {
  if (typeof node === "string") {
    if (/(^|\.)([a-z0-9]*)alt([A-Z0-9][A-Za-z0-9]*)?$/i.test(path)) {
      altEntries.push([path, node]);
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      collect(value, path ? `${path}.${key}` : key);
    }
  }
})(messages, "");

for (const [path, value] of altEntries) {
  if (value.trim() === "") {
    fails.push(
      `${path} — alt key exists but is empty; delete the key or write the sentence`,
    );
    continue;
  }
  if (REDUNDANT.test(value)) {
    fails.push(
      `${path} — "${value}" announces the medium; describe the subject instead`,
    );
  }
  if (FILENAME.test(value)) {
    fails.push(`${path} — "${value}" contains a filename`);
  }
  if (value.length > MAX_ALT) {
    notes.push(
      `${path} — ${value.length} chars; alt text is one sentence, a caption is a caption`,
    );
  }
}

/* ————————————— report ————————————— */

if (LIST) {
  for (const [path, value] of altEntries) console.log(`${path}\n    ${value}`);
  console.log("");
}

console.log(
  `alt-audit · ${files.length} localized components (${literalCount} hardcoded alt literals) · ${altEntries.length} alt strings in messages/en.json`,
);
for (const note of notes) console.log(`NOTE  ${note}`);
for (const fail of fails) console.log(`FAIL  ${fail}`);

if (fails.length > 0) {
  console.log(`\n${fails.length} failure(s).`);
  process.exit(1);
}
console.log(
  notes.length > 0 ? `\nClean (${notes.length} note(s)).` : "\nClean.",
);
