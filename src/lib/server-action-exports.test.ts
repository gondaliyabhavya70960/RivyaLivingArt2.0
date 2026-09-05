import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A `"use server"` module may export only async functions. Anything else a
 * client component imports from it — a constant, a lookup table, a sync
 * helper — arrives as a server-reference PROXY, not the value, and fails at
 * render in a way nothing else catches: `RESEARCH_STATUSES.map` threw
 * "map is not a function" and the whole /studio/research page fell to the
 * error boundary while typecheck, lint, the build and the Studio audit all
 * stayed green. Types are erased and are fine. The value now lives in
 * `src/lib/research.ts`; this keeps the next one from landing.
 */
const ACTIONS_DIR = join(process.cwd(), "src", "actions");

function useServerFiles(): string[] {
  return readdirSync(ACTIONS_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .filter((name) =>
      /^\s*["']use server["']/.test(readFileSync(join(ACTIONS_DIR, name), "utf8")),
    );
}

describe("server-action modules export only async functions", () => {
  it("scans a real set of action files", () => {
    expect(useServerFiles().length).toBeGreaterThan(5);
  });

  it.each(useServerFiles())("%s exports no value a client could import", (name) => {
    const source = readFileSync(join(ACTIONS_DIR, name), "utf8");
    const offenders = source
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) =>
        /^export\s+(const|let|var|class|enum|default|\{|function(?!\s*\*)\s+(?!async))/.test(line) ||
        /^export\s+function\s+\w/.test(line),
      )
      // `export async function …` is the one allowed shape.
      .filter(({ line }) => !/^export\s+async\s+function/.test(line))
      .map(({ line, number }) => `${name}:${number}: ${line.trim()}`);
    expect(offenders).toEqual([]);
  });
});
