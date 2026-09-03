import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards HARD RULE 3: mock data must never reach a real page. Every import
 * of `design-lab/mock-data` — by relative path, the `@/app/design-lab/...`
 * alias, or a bare mention of the module specifier — must live inside
 * `src/app/design-lab/`. A hit anywhere else means someone has wired
 * placeholder products, testimonials or copy into a real route.
 */

const SRC_ROOT = join(__dirname, "..");
const DESIGN_LAB_DIR = join(SRC_ROOT, "app", "design-lab");
const MOCK_DATA_PATTERN = /mock-data/;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, out);
    } else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) {
      out.push(full);
    }
  }
  return out;
}

describe("design-lab mock-data isolation", () => {
  it("is imported only from inside src/app/design-lab", () => {
    const offenders: string[] = [];

    for (const file of walk(SRC_ROOT)) {
      if (file.startsWith(DESIGN_LAB_DIR + sep)) continue;
      // The test file itself names the pattern in prose above — skip it.
      if (file === __filename) continue;

      const content = readFileSync(file, "utf8");
      const importLines = content
        .split("\n")
        .filter((line) => /^\s*import\b/.test(line) || /require\(/.test(line));

      for (const line of importLines) {
        if (MOCK_DATA_PATTERN.test(line) && /design-lab/.test(line)) {
          offenders.push(`${relative(SRC_ROOT, file)}: ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
