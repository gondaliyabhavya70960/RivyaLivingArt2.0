import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CANONICAL_CATEGORIES } from "@/lib/catalog-taxonomy";
import { matchCategoryId } from "@/lib/scraper/category-map";

/**
 * Every keyword table in category-map.ts is keyed by a catalog slug —
 * `matchCategoryId` only ever returns an id it was HANDED (one of the
 * `categories` argument's own ids), so a stale keyword key is silently
 * inert rather than broken: nothing calls this out. This test is that call.
 *
 * `KEYWORDS` isn't exported (it's module-private, deliberately — nothing
 * outside this file should key off it directly), so its keys are read the
 * same way a human would verify them: from the file's own source text.
 *
 * "Seeded" slugs are prisma/seed.ts's 16 owner categories. Reading the file
 * as text (rather than importing the script) is deliberate: seed.ts's
 * module body calls main(), which opens a database connection — importing
 * it here would turn a pure unit test into one that needs Postgres running,
 * for a script this repo's OTHER db-backed suite (test:db) already covers
 * differently.
 */

function readKeywordSlugs(): string[] {
  const src = readFileSync(path.join(__dirname, "category-map.ts"), "utf8");
  const match =
    /const KEYWORDS: Record<string, string\[\]> = \{([\s\S]*?)\n\};/.exec(src);
  if (!match) throw new Error("KEYWORDS table not found in category-map.ts");
  const body = match[1];
  return [...body.matchAll(/^\s*(?:"([^"]+)"|([a-zA-Z0-9_]+)):\s*\[/gm)].map(
    (m) => m[1] ?? m[2],
  );
}

function readSeedSlugs(): string[] {
  const src = readFileSync(
    path.join(__dirname, "../../../prisma/seed.ts"),
    "utf8",
  );
  const match = /const CATEGORIES: \{[^}]*\}\[\] = \[([\s\S]*?)\n\];/.exec(src);
  if (!match) throw new Error("CATEGORIES table not found in prisma/seed.ts");
  const body = match[1];
  return [...body.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("category-map.ts KEYWORDS", () => {
  const keywordSlugs = readKeywordSlugs();
  const seedSlugs = readSeedSlugs();
  const canonicalSlugs = CANONICAL_CATEGORIES.map((c) => c.slug);
  const validSlugs = new Set([...seedSlugs, ...canonicalSlugs]);

  it("found a non-empty keyword table to check (the test itself isn't inert)", () => {
    expect(keywordSlugs.length).toBeGreaterThan(0);
  });

  it("found the seeded categories to check against", () => {
    expect(seedSlugs.length).toBeGreaterThan(0);
  });

  it("every KEYWORDS key names a real catalog slug (seeded ∪ canonical)", () => {
    const stale = keywordSlugs.filter((slug) => !validSlugs.has(slug));
    expect(stale).toEqual([]);
  });

  it("matchCategoryId only ever returns an id from the categories it was given", () => {
    // A stale keyword key can never surface a phantom match — it simply
    // never scores against a real category — so this is a second, functional
    // check of the same property the slug audit above checks structurally.
    const categories = seedSlugs.map((slug) => ({
      id: slug,
      name: slug,
      slug,
    }));
    const id = matchCategoryId("resin river table", "River Table", categories);
    expect(id === null || seedSlugs.includes(id)).toBe(true);
  });
});
