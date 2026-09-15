/**
 * The canonical category seed reaches the database.
 *
 * `CANONICAL_CATEGORIES` declares an `image` for all eight categories, and
 * `catalog-taxonomy.ts`'s own comment calls it "the value a fresh environment
 * seeds". It was not. `tier-fill.ts` is the ONLY code path that creates those
 * rows, and its `category.create` listed slug, name, description, order and
 * translations — never image — so every environment came up with
 * `Category.image` null on all eight.
 *
 * That is not cosmetic: the homepage collections band paints `Category.image`,
 * and on the live site two of its six doorways — Gift and Print, the
 * commercial core — rendered as a two-letter monogram on a flat block. The
 * pictures for both were generated for that band, committed, and sitting in
 * `public/media/v3/`.
 *
 * `bundled-media.test.ts` already asserted those files exist on disk, under a
 * comment promising they seed a fresh environment — a gate guarding the file
 * for a value nothing wrote. This is the other half.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CANONICAL_CATEGORIES } from "@/lib/catalog-taxonomy";

const taxonomy = readFileSync("src/lib/catalog-taxonomy.ts", "utf8");
const tierFill = readFileSync("src/lib/import/tier-fill.ts", "utf8");

/** The `data: {…}` object of the one `category.create` in the fill. */
function categoryCreateBody(): string {
  const anchor = "const created = await db.category.create({";
  const start = tierFill.indexOf(anchor);
  expect(start, "the canonical-category create moved or was renamed").not.toBe(
    -1,
  );
  return tierFill.slice(start, tierFill.indexOf("select: { id: true }", start));
}

describe("the canonical category seed", () => {
  it("declares an image for every category", () => {
    // The band has six doorways and no design for a missing picture beyond the
    // monogram, so a category without one is a blank tile on the homepage.
    const missing = CANONICAL_CATEGORIES.filter((c) => !c.image).map(
      (c) => c.slug,
    );
    expect(missing).toEqual([]);
  });

  it("is written by the one path that creates those rows", () => {
    // Every field the type declares must appear in the create. The bug this
    // pins was a single omitted key, and the next field added to
    // `CanonicalCategory` would have been dropped exactly the same way.
    const typeBlock = taxonomy.slice(
      taxonomy.indexOf("type CanonicalCategory = {"),
      taxonomy.indexOf("export const CANONICAL_CATEGORIES"),
    );
    const fields = [...typeBlock.matchAll(/^\s{2}(\w+)\??:/gm)].map(
      (m) => m[1],
    );
    expect(fields).toContain("image"); // the regex still finds something

    const body = categoryCreateBody();
    const dropped = fields.filter((f) => !new RegExp(`\\b${f}:`).test(body));
    expect(dropped, "declared on the seed, never written").toEqual([]);
  });

  it("backs the homepage collections band when the column is empty", () => {
    // The band is the seed's only visible consumer, and it read
    // `Category.image` alone — registry in code, override in the database, and
    // a resolver that was not total, which is the one shape this app does not
    // allow. Pinned as text because the failure renders as a monogram rather
    // than as an error: nothing else would notice it going back.
    const home = readFileSync("src/app/[locale]/(v2)/page.tsx", "utf8");
    expect(home).toMatch(/CANONICAL_CATEGORIES/);
    expect(home).toMatch(
      /row\.image \?\? canonicalTileImage\.get\(row\.slug\)/,
    );
  });

  it("writes the image on CREATE only, never on update", () => {
    // The safety property. The loop returns early for a row that already
    // exists, so an owner's own image — or one the Cloudinary reconcile put
    // there — is never overwritten. Owner edits outrank every writer.
    const loop = tierFill.slice(
      tierFill.indexOf("for (const cat of CANONICAL_CATEGORIES)"),
      tierFill.indexOf("const allCats = await db.category.findMany"),
    );
    expect(loop).toMatch(/if \(existingCat\) \{[\s\S]*?continue;[\s\S]*?\}/);
    expect(loop).not.toMatch(/category\.update|category\.upsert/);
  });
});
