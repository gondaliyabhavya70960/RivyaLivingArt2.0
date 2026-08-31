#!/usr/bin/env node
/**
 * Report keys that exist in messages/en.json but are missing from (or
 * identical to English in) the other eight locales.
 *
 *   node scripts/i18n-missing.mjs            # counts per locale
 *   node scripts/i18n-missing.mjs --list     # every missing key path
 *   node scripts/i18n-missing.mjs --json out.json   # {locale: {path: english}}
 *
 * A key that renders as its English source in eight languages is a bug that
 * typecheck cannot see, so this is the gate that catches it. Identical-to-
 * English values are reported separately: some (brand names, "WhatsApp") are
 * correct, so they are listed, not failed.
 */
import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = ["ar", "de", "es", "fr", "gu", "hi", "ja", "zh"];
const args = process.argv.slice(2);
const wantList = args.includes("--list");
const jsonIndex = args.indexOf("--json");
const jsonOut = jsonIndex === -1 ? null : args[jsonIndex + 1];

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

const en = flatten(JSON.parse(readFileSync("messages/en.json", "utf8")));
const report = {};
let missingTotal = 0;

for (const locale of LOCALES) {
  const other = flatten(
    JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")),
  );
  const missing = {};
  const echoed = [];
  for (const [path, value] of Object.entries(en)) {
    if (!(path in other)) missing[path] = value;
    else if (
      typeof value === "string" &&
      value.length > 3 &&
      other[path] === value
    ) {
      echoed.push(path);
    }
  }
  report[locale] = missing;
  missingTotal += Object.keys(missing).length;
  console.log(
    `${locale}: ${Object.keys(missing).length} missing, ${echoed.length} identical to English`,
  );
  if (wantList) {
    for (const path of Object.keys(missing)) console.log(`    missing  ${path}`);
    for (const path of echoed) console.log(`    echoed   ${path}`);
  }
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nwrote ${jsonOut}`);
}

process.exitCode = missingTotal > 0 ? 1 : 0;
