import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `README.md`'s **Repository map** is the index for the repository root, the
 * way `docs/README.md` is the index for `docs/` — and it is pinned here for
 * the same reason `docs-index.test.ts` gives: an index nobody checks is worse
 * than none, because it reads as authoritative while quietly omitting whatever
 * was added after it was written.
 *
 * ## Why the root is INDEXED rather than rearranged
 *
 * Measured 2026-09-19: every non-blog markdown file in this repository has at
 * least one inbound reference, and several referrers are dated records that
 * owner decision D24 forbids rewriting. So a file cannot be moved and its
 * links repaired — moving it breaks `CHANGELOG.md`, `PROJECT_STATE.md`,
 * `docs/audits/` and `RENAME-MIGRATION.md` and leaves them broken. That is the
 * same conclusion `docs/README.md` reached for `docs/`, and this map is the
 * root's half of it.
 *
 * Like the docs index, this deliberately does NOT check that a document is
 * filed under the right heading. Whether something is "in force", a "dated
 * record" or "superseded" is a judgement, and a test that pinned it would have
 * to be edited for every judgement it was meant to protect.
 */
const ROOT = process.cwd();
const README = readFileSync(join(ROOT, "README.md"), "utf8");
const MAP = README.slice(README.indexOf("## Repository map"));

/**
 * Directories that are not the repository's own structure: build output,
 * dependencies, VCS, and the generated Prisma client. None of them is
 * committed, so none of them belongs in a map of what IS committed.
 */
const NOT_OURS = new Set([
  ".git",
  ".next",
  "node_modules",
  "assets-inbox",
  "coverage",
]);

describe("README.md · repository map", () => {
  it("exists, and is a section rather than a sentence", () => {
    expect(README).toContain("## Repository map");
    expect(MAP.length).toBeGreaterThan(1000);
  });

  it("names every committed top-level directory", () => {
    const dirs = readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !NOT_OURS.has(entry.name))
      .map((entry) => entry.name);
    expect(dirs.length).toBeGreaterThan(8);
    const missing = dirs.filter((name) => !MAP.includes(`\`${name}/\``));
    expect(missing, "add these to README.md's Repository map").toEqual([]);
  });

  it("names every root-level markdown document", () => {
    const docs = readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name);
    expect(docs.length).toBeGreaterThan(10);
    const missing = docs.filter((name) => !MAP.includes(name));
    expect(missing, "add these to README.md's Repository map").toEqual([]);
  });

  it("maps nothing that no longer exists", () => {
    // The other direction: a document renamed or deleted leaves a row pointing
    // at nothing, and a reader follows it before they notice.
    const present = new Set(readdirSync(ROOT));
    const linked = [...MAP.matchAll(/\]\(\.\/([A-Za-z0-9._-]+)\)/g)].map(
      (match) => match[1],
    );
    expect(linked.length).toBeGreaterThan(10);
    const dangling = linked.filter((name) => !present.has(name));
    expect(dangling, "these rows point at nothing").toEqual([]);
  });

  it("keeps the two paths that are read by code out of tidying range", () => {
    // `data/` is the catalogue importer's only source and `docs/` holds three
    // pipeline inputs. Both are called out in the map because a directory that
    // looks like documentation and is actually a build input is the expensive
    // thing to rediscover — `docs-index.test.ts` pins the docs half.
    expect(MAP).toMatch(/`data\/`[\s\S]{0,200}Read by code/);
    expect(MAP).toContain("docs/README.md");
  });
});
