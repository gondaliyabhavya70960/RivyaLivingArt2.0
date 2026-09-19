import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `docs/README.md` is the index for 35 loose files and seven subdirectories,
 * and an index nobody checks is worse than none: it reads as authoritative
 * while quietly omitting whatever was added after it was written.
 *
 * So this pins the two directions that actually rot — a document that exists
 * and is not indexed, and an index entry whose file is gone — plus the three
 * paths that are READ BY CODE, which is the expensive fact on that page.
 *
 * It deliberately does NOT check that each file is filed under the right
 * heading. Whether something is "in force" or "superseded" is a judgement, and
 * a test that pinned it would have to be edited for every judgement it was
 * meant to protect.
 */
const DOCS = join(process.cwd(), "docs");
const INDEX = readFileSync(join(DOCS, "README.md"), "utf8");

/** Paths the index warns are pipeline inputs, not documentation. */
const READ_BY_CODE = [
  "docs/media-v3-manifest.json",
  "docs/plan/drive-asset-map.json",
  "docs/media-v3-review",
];

describe("docs/README.md", () => {
  it("names every loose document in docs/", () => {
    const loose = readdirSync(DOCS, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name !== "README.md")
      .map((entry) => entry.name);
    expect(loose.length).toBeGreaterThan(20);
    const missing = loose.filter((name) => !INDEX.includes(name));
    expect(missing, "add these to docs/README.md").toEqual([]);
  });

  it("names every subdirectory of docs/", () => {
    const dirs = readdirSync(DOCS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const missing = dirs.filter((name) => !INDEX.includes(`${name}/`));
    expect(missing, "add these to docs/README.md").toEqual([]);
  });

  it("indexes nothing that no longer exists", () => {
    // The other direction: a file renamed or deleted leaves a row pointing at
    // nothing, and a reader follows it before they notice.
    // Every name under docs/, at any depth. It was the top level only until
    // `reference-design/` arrived (2026-09-19) and its files started being
    // named in the index: the shallow read made every row about a
    // subdirectory's contents look dangling, and the fix on offer was to keep
    // growing the hand-written exception list below — which is the thing that
    // rots. The rule this asserts is "no row points at nothing", and a file
    // one level down is not nothing.
    const present = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        present.add(entry.name);
        if (entry.isDirectory()) walk(join(dir, entry.name));
      }
    };
    walk(DOCS);
    const referenced = [...INDEX.matchAll(/`([A-Za-z0-9._-]+\.(?:md|json))`/g)]
      .map((match) => match[1])
      // Rows that deliberately name files OUTSIDE docs/ — the spec, the build
      // plan, and the two root-level dated records the page explains.
      .filter(
        (name) =>
          ![
            "REDESIGN.md",
            "implementation-plan.md",
            "DESIGN.md",
            "CLAUDE.md",
            "AGENTS.md",
            "CHANGELOG.md",
            "PROJECT_STATE.md",
            "RIVYA LIVING ART_2.0_UI_MASTER_PLAN.md",
            "README.md",
            "schema.prisma",
            "generated-cover.ts",
          ].includes(name),
      );
    expect(referenced.length).toBeGreaterThan(15);
    const dangling = referenced.filter((name) => !present.has(name));
    expect(dangling, "these rows point at nothing").toEqual([]);
  });

  it("still warns about every path that is read by code", () => {
    // The one fact on that page that costs a broken build to rediscover. If a
    // pipeline stops reading one of these, delete the row deliberately — do
    // not let it lapse.
    for (const path of READ_BY_CODE) {
      expect(INDEX, `${path} must stay in the do-not-move table`).toContain(
        path,
      );
    }
  });
});
