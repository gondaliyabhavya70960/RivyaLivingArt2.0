#!/usr/bin/env node
/**
 * Deep-merge a locale patch into messages/<locale>.json.
 *
 *   node scripts/i18n-merge.mjs patch.json
 *
 * The patch is `{ "<locale>": { "<Namespace>": { … } } }` for every locale the
 * site ships (en, ar, de, es, fr, gu, hi, ja, zh). Keys are merged, never
 * replaced wholesale, and the result is written back sorted the way the files
 * already are (insertion order preserved for existing keys, new keys appended
 * inside their namespace) so the diff stays readable.
 *
 * Fails loudly when a locale is missing from the patch: a key that exists in
 * English and nowhere else renders as the raw key in eight languages.
 */
import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = ["en", "ar", "de", "es", "fr", "gu", "hi", "ja", "zh"];

const args = process.argv.slice(2);
const partial = args.includes("--partial");
const patchPath = args.find((a) => !a.startsWith("--"));
if (!patchPath) {
  console.error("usage: i18n-merge.mjs <patch.json> [--partial]");
  process.exit(1);
}

const patch = JSON.parse(readFileSync(patchPath, "utf8"));

const unknown = Object.keys(patch).filter((l) => !LOCALES.includes(l));
if (unknown.length) {
  console.error(`patch names locales that do not exist: ${unknown.join(", ")}`);
  process.exit(1);
}

const missing = LOCALES.filter((l) => !patch[l]);
if (missing.length && !partial) {
  console.error(
    `patch is missing locales: ${missing.join(", ")}\n` +
      "Pass --partial when you are deliberately translating a subset; the " +
      "default refuses, because a key that lands in English and nowhere else " +
      "renders as its own path in eight languages.",
  );
  process.exit(1);
}

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function merge(target, source, path, added) {
  for (const [key, value] of Object.entries(source)) {
    const here = path ? `${path}.${key}` : key;
    if (isPlainObject(value)) {
      if (!isPlainObject(target[key])) target[key] = {};
      merge(target[key], value, here, added);
    } else {
      if (!(key in target)) added.push(here);
      target[key] = value;
    }
  }
}

for (const locale of LOCALES) {
  if (!patch[locale]) continue;
  const file = `messages/${locale}.json`;
  const json = JSON.parse(readFileSync(file, "utf8"));
  const added = [];
  merge(json, patch[locale], "", added);
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`${locale}: ${added.length} new key(s)`);
}
