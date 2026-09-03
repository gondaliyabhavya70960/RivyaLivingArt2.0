#!/usr/bin/env node
/**
 * Report keys that exist in messages/en.json but are missing from (or
 * identical to English in) the other eight locales.
 *
 *   node scripts/i18n-missing.mjs            # counts per locale
 *   node scripts/i18n-missing.mjs --list     # every missing key path
 *   node scripts/i18n-missing.mjs --json out.json   # {locale: {path: english}}
 *   node scripts/i18n-missing.mjs --stale [--base origin/main]
 *                                            # stale-translation mode, below
 *
 * A key that renders as its English source in eight languages is a bug that
 * typecheck cannot see, so this is the gate that catches it. Identical-to-
 * English values are reported separately: some (brand names, "WhatsApp") are
 * correct, so they are listed, not failed.
 *
 * STALE MODE. The presence check above has a hole that AGENTS.md records
 * under "Traps": editing an ENGLISH value and leaving the other eight locales
 * alone passes every gate — the keys exist and the values differ from
 * English — and ships eight stale translations. `--stale` closes it by
 * comparing every catalogue against a git ref (the PR's base branch in CI,
 * `origin/main` by default): for each key whose English value changed since
 * the ref, every other locale's value must have changed too. A copy change is
 * a nine-file edit, always. Keys added since the ref are the presence
 * check's business, not this one's.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = ["ar", "de", "es", "fr", "gu", "hi", "ja", "zh"];
const args = process.argv.slice(2);
const wantList = args.includes("--list");
const wantStale = args.includes("--stale");
const jsonIndex = args.indexOf("--json");
const jsonOut = jsonIndex === -1 ? null : args[jsonIndex + 1];
const baseIndex = args.indexOf("--base");
const baseRef = baseIndex === -1 ? "origin/main" : args[baseIndex + 1];

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

const readCatalogue = (locale) =>
  flatten(JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")));

/** The catalogue as committed at `ref`, or null when the ref lacks it. */
function readCatalogueAtRef(ref, locale) {
  try {
    const raw = execFileSync("git", ["show", `${ref}:messages/${locale}.json`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return flatten(JSON.parse(raw));
  } catch {
    return null;
  }
}

const en = readCatalogue("en");
const report = {};
let missingTotal = 0;
const current = {};

for (const locale of LOCALES) {
  const other = readCatalogue(locale);
  current[locale] = other;
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

let staleTotal = 0;
if (wantStale) {
  const baseEn = readCatalogueAtRef(baseRef, "en");
  if (!baseEn) {
    console.error(
      `\n--stale: cannot read messages/en.json at ${baseRef} — fetch the ref first (git fetch origin main).`,
    );
    staleTotal = 1;
  } else {
    const changedEn = Object.keys(en).filter(
      (path) =>
        path in baseEn &&
        typeof en[path] === "string" &&
        baseEn[path] !== en[path],
    );
    console.log(
      `\nstale check against ${baseRef}: ${changedEn.length} English value(s) changed`,
    );
    for (const locale of LOCALES) {
      const baseOther = readCatalogueAtRef(baseRef, locale) ?? {};
      const other = current[locale];
      const stale = changedEn.filter(
        (path) =>
          path in baseOther &&
          path in other &&
          baseOther[path] === other[path],
      );
      staleTotal += stale.length;
      console.log(
        `${locale}: ${stale.length} stale (English changed, translation did not)`,
      );
      for (const path of stale) console.log(`    stale    ${path}`);
    }
  }
}

process.exitCode = missingTotal > 0 || staleTotal > 0 ? 1 : 0;
