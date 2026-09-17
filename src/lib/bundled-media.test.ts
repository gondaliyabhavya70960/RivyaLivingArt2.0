import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CANONICAL_CATEGORIES } from "./catalog-taxonomy";
import blurManifest from "./media-v3-blur.json";
import redesignBlurManifest from "./redesign-blur.json";
import {
  PLACEHOLDER_ASSET_FILENAME,
  isPlaceholderAsset,
} from "./placeholder-assets";
import mediaV3Manifest from "../../docs/media-v3-manifest.json";

/**
 * Every bundled asset the storefront hardcodes, asserted to be on disk.
 *
 * `site-images.test.ts` now covers the 62 registry slots. This file covers the
 * tracks that are *deliberately* outside that registry and therefore had no
 * test at all — which is exactly why nobody noticed when `public/` arrived
 * empty and every one of them 404'd in production:
 *
 *  - the 121 pour-cure scrub frames (one animation, not editorial imagery, so
 *    CLAUDE.md keeps them out of the slot registry);
 *  - `CANONICAL_CATEGORIES[].image`, the seed defaults for `Category.image`
 *    (kept out so one picture does not get two owners);
 *  - the PWA icon named by `app/manifest.ts`;
 *  - the LQIP manifest's `src` paths, which must keep pointing at real masters
 *    or the blur-up placeholder describes a file that is not there.
 *
 * A path here is cheap to assert and expensive to lose: none of these is
 * resolved at build time, so a missing file is invisible until a visitor loads
 * the page.
 */

const publicPath = (p: string) => join(process.cwd(), "public", p);

/** Mirrors `pour-cure-showcase.tsx` — kept in sync by the count assertion. */
const FRAME_COUNT = 121;
const frameSrc = (index: number) =>
  `/sequences/pour-cure/frame_${String(index).padStart(3, "0")}.webp`;

describe("the pour-cure scrub sequence", () => {
  it("has every frame the showcase will request", () => {
    const missing: string[] = [];
    for (let i = 0; i < FRAME_COUNT; i += 1) {
      if (!existsSync(publicPath(frameSrc(i)))) missing.push(frameSrc(i));
    }
    expect(missing, `${missing.length} frame(s) absent`).toEqual([]);
  });
});

describe("the canonical category seed images", () => {
  it("points every declared image at a bundled file", () => {
    // These seed `Category.image` on a fresh environment. A missing file here
    // is silent until someone deploys into an empty database.
    for (const category of CANONICAL_CATEGORIES) {
      if (!category.image) continue;
      expect(
        existsSync(publicPath(category.image)),
        `${category.slug} → public${category.image}`,
      ).toBe(true);
    }
  });
});

describe("the web app manifest icon", () => {
  it("is in the repo", () => {
    expect(existsSync(publicPath("/icon-512.png"))).toBe(true);
  });
});

describe("the media-v3 generation queue (docs/transformation-audit.md §10.3)", () => {
  const entries = mediaV3Manifest.plannedSets?.entries ?? [];

  it("has every SET A–K entry batches D and E added", () => {
    // Not a file-existence check — these are jobs nobody has run yet. This
    // just guards the count so a future edit that silently drops an entry
    // (a bad merge, a copy-paste that skipped one) is caught here rather
    // than discovered the day someone runs the fetch script and gets 27
    // masters instead of 28. The count survives the whole queue being worked:
    // `--promote` flips a row's status in place rather than moving it into
    // `assets` (scripts/lib/media-v3-planned.mjs), precisely so this number
    // keeps meaning something.
    //
    // 28 → 57 → 55 on 2026-09-05: batch E added five sets (varmala-preservation,
    // gifting 6, workshops 6, atelier 5, studio-chrome 5) chosen from a slot
    // audit — 76 registry slots share only 25 files, `tile-live.avif` carrying
    // eight of them — so each new entry names the over-worked master it is
    // meant to relieve. Two of the seven varmala rows were then withdrawn the
    // same day: `varmala-before-after` restated `excluded[0]` (§15.2 forbids a
    // generated picture standing in for a customer's own flowers, and a
    // different aspect ratio does not change that claim) and
    // `varmala-floret-macro` had no slot to land in, because the only 1:1 slots
    // are the four §15.3 material macros generated as one batch on identical
    // ground and light. The maker portrait is deliberately absent for the same
    // family of reason: §15.2 forbids a generated maker, and a row in a
    // generation queue is an invitation to generate it.
    expect(entries.length).toBe(55);
  });

  it('never claims a master file exists for a status: "planned" entry', () => {
    // The whole point of "planned": there is nothing on disk to check yet.
    // A planned entry that grew a `master` path would be lying about that,
    // and `media-v3-preflight.mjs`'s rule 3 would then expect a file this
    // test never asserts is there.
    for (const entry of entries) {
      if (entry.status !== "planned") continue;
      expect(entry, entry.id).not.toHaveProperty("master");
    }
  });

  it("gives every non-planned entry a master this file DOES check exists", () => {
    // Forward-looking: the day an owner promotes an entry out of "planned"
    // (fills in candidates, culls a keeper, runs media-v3-fetch.mjs), its
    // master path needs to start passing the same disk check every other
    // bundled asset passes above. Nothing is promoted yet, so this loop is
    // empty today — it exists so that day does not slip through silently.
    //
    // A row still marked "planned" is skipped and can never fail a build; a
    // promoted one names a file, and this repository commits `public/`, so the
    // manifest edit and the master belong in the same commit.
    for (const entry of entries) {
      if (entry.status === "planned") continue;
      const master = (entry as { master?: string }).master;
      expect(
        master,
        `${entry.id} has left "planned" but has no master`,
      ).toBeTruthy();
      if (master) {
        expect(
          existsSync(publicPath(master.replace(/^public\//, ""))),
          `${master} — promoted but not built. Finish the sequence ` +
            "(`node scripts/media-v3-fetch.mjs --planned`) before committing, " +
            'or leave the entry at status "planned".',
        ).toBe(true);
      }
    }
  });

  it("has unique ids that do not collide with a real asset or video id", () => {
    const realIds = new Set([
      ...mediaV3Manifest.assets.map((a) => a.id),
      ...mediaV3Manifest.videos.map((v) => v.id),
    ]);
    const seen = new Set<string>();
    for (const entry of entries) {
      expect(seen.has(entry.id), `duplicate planned id ${entry.id}`).toBe(
        false,
      );
      seen.add(entry.id);
      expect(
        realIds.has(entry.id),
        `${entry.id} collides with a real asset/video id`,
      ).toBe(false);
    }
  });
});

describe("the Part 15 LQIP manifest", () => {
  it("describes a master that exists, at the size it recorded", () => {
    // The blur data is generated FROM the master, so a mismatch means the two
    // have drifted apart — the placeholder would then be a picture of a file
    // the page no longer loads.
    for (const [id, entry] of Object.entries(blurManifest)) {
      expect(
        existsSync(publicPath(entry.src)),
        `${id} → public${entry.src}`,
      ).toBe(true);
      expect(entry.blurDataURL.startsWith("data:image/webp;base64,")).toBe(
        true,
      );
      expect(entry.width, id).toBeGreaterThan(0);
      expect(entry.height, id).toBeGreaterThan(0);
    }
  });
});

describe("the redesign LQIP manifest", () => {
  /**
   * Same contract as the Part 15 manifest above, for the second generated set
   * (`scripts/optimize-redesign-assets.mjs`). It matters more here, not less:
   * these files were missing from the repo entirely while eleven slot
   * fallbacks pointed at them, and the only reason that surfaced was
   * `site-images.test.ts` asserting the same thing one directory over.
   */
  it("describes a file that exists, at the size it recorded", () => {
    for (const [id, entry] of Object.entries(redesignBlurManifest)) {
      expect(existsSync(publicPath(entry.src)), `${id} → public${entry.src}`).toBe(
        true,
      );
      expect(entry.blurDataURL.startsWith("data:image/webp;base64,")).toBe(true);
      expect(entry.width, id).toBeGreaterThan(0);
      expect(entry.height, id).toBeGreaterThan(0);
    }
  });

  /**
   * The placeholder rule (plan §4.6) is path-based and binding: anything under
   * `/redesign/catalog/` stands in for a product that does not exist yet. A
   * catalog file that escaped into the brand directory would lose that marking
   * and become publishable by accident, so the two sets are kept apart here.
   */
  it("files every Drive catalog image under the placeholder path", () => {
    // Both halves of the test read `placeholder-assets.ts` rather than
    // re-typing the pattern and the prefix. That module is the single copy of
    // this vocabulary on purpose: CLAUDE.md's scrape-tier story ends with five
    // hand-written copies and three tiers that shipped invisible, and this
    // file held copy #2 for exactly one commit.
    const catalog = Object.values(redesignBlurManifest).filter((entry) =>
      PLACEHOLDER_ASSET_FILENAME.test(entry.src),
    );
    expect(catalog.length).toBe(45);
    for (const entry of catalog) {
      expect(isPlaceholderAsset(entry.src), entry.src).toBe(true);
    }
  });
});
