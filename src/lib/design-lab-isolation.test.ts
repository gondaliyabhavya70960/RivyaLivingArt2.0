import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards HARD RULE 3: mock data must never reach a real page. Every import
 * of `design-lab/mock-data` — by relative path, the `@/app/design-lab/...`
 * alias, a `require`, or a dynamic `import()` — must live inside the design
 * lab: `src/app/design-lab/` (the staff-gated route) or
 * `src/components/design-lab/` (the lab's own sections, rendered only by that
 * route). A hit anywhere else means someone has wired placeholder products,
 * testimonials or copy into a real route.
 *
 * The scan reads the module specifier out of the WHOLE file, not line by
 * line: the first version filtered to lines starting with `import`, so a
 * multi-line `import {\n  A,\n  B,\n} from "…/mock-data"` — the shape the lab's
 * own sections file has — was never examined at all (plan audit, 2026-09-04).
 * A second assertion closes the other half of the hole: the lab's component
 * folder may itself be imported only from inside the lab, so quarantining
 * mock data there does not just move the leak one hop.
 */

const SRC_ROOT = join(__dirname, "..");
const DESIGN_LAB_DIRS = [
  join(SRC_ROOT, "app", "design-lab"),
  join(SRC_ROOT, "components", "design-lab"),
];
/** Any module specifier that names the mock-data file, in every import shape. */
const MOCK_DATA_SPECIFIER =
  /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)["'][^"'\n]*design-lab\/mock-data[^"'\n]*["']/g;
/** Any module specifier that reaches into the lab's component folder. */
const LAB_COMPONENT_SPECIFIER =
  /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)["'](?:@\/components\/design-lab|[^"'\n]*\/components\/design-lab)[^"'\n]*["']/g;
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

const insideLab = (file: string) =>
  DESIGN_LAB_DIRS.some((dir) => file.startsWith(dir + sep));

function offendersOf(pattern: RegExp): string[] {
  const offenders: string[] = [];
  for (const file of walk(SRC_ROOT)) {
    if (insideLab(file)) continue;
    // The test file itself names the patterns in prose above — skip it.
    if (file === __filename) continue;
    const content = readFileSync(file, "utf8");
    for (const hit of content.match(pattern) ?? []) {
      offenders.push(`${relative(SRC_ROOT, file)}: ${hit.replace(/\s+/g, " ").trim()}`);
    }
  }
  return offenders;
}

describe("design-lab mock-data isolation", () => {
  it("mock-data is imported only from inside the design lab", () => {
    expect(offendersOf(MOCK_DATA_SPECIFIER)).toEqual([]);
  });

  it("the lab's component folder is imported only from inside the design lab", () => {
    expect(offendersOf(LAB_COMPONENT_SPECIFIER)).toEqual([]);
  });

  it("the scan sees a multi-line import (the shape that slipped past the line filter)", () => {
    const sample = 'import {\n  MOCK_PRODUCTS,\n} from "@/app/design-lab/mock-data";\n';
    expect(sample.match(MOCK_DATA_SPECIFIER)).toHaveLength(1);
    expect('const m = await import("../app/design-lab/mock-data")'.match(MOCK_DATA_SPECIFIER)).toHaveLength(1);
    expect('import { x } from "@/lib/mock-data-shapes";'.match(MOCK_DATA_SPECIFIER)).toBeNull();
  });
});
