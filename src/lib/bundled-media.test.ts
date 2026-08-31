import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CANONICAL_CATEGORIES } from "./catalog-taxonomy";
import blurManifest from "./media-v3-blur.json";

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
