/**
 * The v4 leading scale — six tokens, and the reason they exist.
 *
 * Part 3.2 defines the type SIZES and stops there, so every heading on the
 * site chose its own line-height. Before this scale landed there were 79 raw
 * `leading-[…]` literals across src/ in 21 distinct values, clustered around
 * one modal value per role with drift either side of it (the full count is in
 * `tokens.css`, under "v4 · Leading").
 *
 * Naming the five modal values plus the body default changed no pixel: the 44
 * call sites that already used them were converted in the same commit, and the
 * 35 that did not are deliberately still literals, because a heading set at
 * 1.04 where the role says 1.02 is either a considered exception or a slip and
 * only a designer can say which (workstream A2).
 *
 * This file is what stops the pile growing back while that decision is
 * pending. The count is a ratchet; the value guard is the sharper half.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

/** The scale, exactly as `tokens.css` declares it. */
const SCALE = {
  "leading-hero": "0.95",
  "leading-h1": "1.02",
  "leading-h2": "1.08",
  "leading-h3": "1.15",
  "leading-body": "1.65",
  "leading-longform": "1.8",
} as const;

/**
 * The number of raw `leading-[…]` literals left in src/. A RATCHET: it may
 * fall as A2 resolves each outlier into a token or a documented exception, and
 * it may never rise. Lower it in the commit that removes one.
 */
const RAW_LEADING_BUDGET = 35;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(path));
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const sources = tsxFiles("src").map((file) => ({
  file,
  text: readFileSync(file, "utf8"),
}));

describe("v4 leading scale", () => {
  it("declares every role in tokens.css at its recorded value", () => {
    for (const [name, value] of Object.entries(SCALE)) {
      expect(tokens, `--${name} missing from tokens.css`).toMatch(
        new RegExp(`--${name}:\\s*${value.replace(".", "\\.")};`),
      );
    }
  });

  it("bridges every role to a Tailwind utility", () => {
    // Without this the token exists and `leading-h1` silently does nothing —
    // Tailwind treats an unknown utility as no utility, so the heading falls
    // back to the inherited body leading and the page looks *almost* right.
    for (const name of Object.keys(SCALE)) {
      expect(globals, `--${name} not bridged in globals.css`).toMatch(
        new RegExp(`--${name}:\\s*var\\(--${name}\\);`),
      );
    }
  });

  it("takes no name from Tailwind's own leading scale", () => {
    // `leading-relaxed` has 120 call sites here and snug/tight/none another
    // 53, nearly all of them in the Studio. Redefining one of those names in
    // @theme would re-leading screens this scale was never aimed at.
    const builtIns = ["none", "tight", "snug", "normal", "relaxed", "loose"];
    for (const name of Object.keys(SCALE)) {
      expect(builtIns).not.toContain(name.replace("leading-", ""));
    }
  });

  it("does not let a scale value reappear as a literal", () => {
    // The regression that matters: `leading-[1.02]` and `leading-h1` render
    // identically, so nothing else would ever catch the literal coming back —
    // and once one is back, the next heading copies it.
    const offenders: string[] = [];
    for (const { file, text } of sources) {
      for (const [name, value] of Object.entries(SCALE)) {
        if (text.includes(`leading-[${value}]`)) {
          offenders.push(`${file}: leading-[${value}] → leading-${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("holds the raw-leading count at or below its ratchet", () => {
    const raw = sources.flatMap(({ file, text }) =>
      [...text.matchAll(/leading-\[[0-9.]+\]/g)].map((m) => `${file}: ${m[0]}`),
    );
    expect(
      raw.length,
      `${raw.length} raw leading literals (budget ${RAW_LEADING_BUDGET}):\n${raw.join("\n")}`,
    ).toBeLessThanOrEqual(RAW_LEADING_BUDGET);
  });

  it("keeps the body default a token rather than a base-rule literal", () => {
    expect(globals).toMatch(/line-height: var\(--leading-body\);/);
    expect(globals).not.toMatch(/line-height: 1\.65;/);
  });
});
