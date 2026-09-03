import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SITE_IMAGE_DEFAULT_REFS,
  SITE_IMAGE_FALLBACKS,
  SITE_IMAGE_SLOTS,
  isSiteImageKey,
  needsMobileCrop,
  siteImageMinWidth,
  type SiteImageKey,
  type SiteImageSlot,
} from "./site-images";
import { blurFor } from "./lqip";
import { isCopyKey } from "./site-copy";

/**
 * `SITE_IMAGE_SLOTS` is `as const`, so each element carries its own literal
 * type and only the members that actually declare `altKey` have the property.
 * Production code reads the registry through helpers that already widen it;
 * the tests read it raw, so they widen it here.
 */
const SLOTS: readonly SiteImageSlot[] = SITE_IMAGE_SLOTS;

describe("the slot registry", () => {
  it("gives every slot a bundled default that lives in the repo", () => {
    // The whole safety story rests on this: an unset slot, a deleted row and a
    // database outage all resolve to a file that is checked in.
    //
    // The filesystem assertion is the load-bearing half, and it was missing.
    // This test asserted only that the string began with "/" while its own
    // comment promised the file was checked in — so `public/` being absent
    // from the imported ZIP took all 62 slots down to a 400 from the image
    // optimizer while every gate stayed green: the resolver is total by
    // construction, the build never resolves these runtime strings, and the
    // design and a11y audits check alt text rather than whether a picture
    // actually arrived.
    for (const slot of SLOTS) {
      expect(SITE_IMAGE_FALLBACKS[slot.key as SiteImageKey]).toBe(
        slot.fallback,
      );
      expect(slot.fallback.startsWith("/")).toBe(true);
      expect(
        existsSync(join(process.cwd(), "public", slot.fallback)),
        `${slot.key} → public${slot.fallback} is not in the repo`,
      ).toBe(true);
    }
  });

  it("has no duplicate keys", () => {
    const keys = SLOTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("defaults every slot to a centred crop with no mobile file", () => {
    for (const slot of SLOTS) {
      expect(SITE_IMAGE_DEFAULT_REFS[slot.key as SiteImageKey]).toEqual({
        url: slot.fallback,
        mobileUrl: null,
        focalX: 0.5,
        focalY: 0.5,
        blurDataUrl: blurFor(slot.fallback) ?? null,
      });
    }
  });
});

describe("blurDataUrl on the default refs (batch D · media system)", () => {
  it("carries the bundled LQIP for every Part 15 master the blur manifest knows", () => {
    // Every default ref's blur is resolved on the SLOT'S OWN fallback url —
    // never guessed from the key — so this is really re-asserting that the
    // two registries (site-images.ts's fallbacks, media-v3-blur.json's
    // `src`s) still agree on which slots are Part 15 masters.
    const withBlur = SLOTS.filter((s) => blurFor(s.fallback));
    expect(withBlur.length).toBeGreaterThan(0);
    for (const slot of withBlur) {
      expect(
        SITE_IMAGE_DEFAULT_REFS[slot.key as SiteImageKey].blurDataUrl,
      ).toBe(blurFor(slot.fallback));
    }
  });

  it("is null, not undefined, for a slot the blur manifest has never heard of", () => {
    // `home.maker` / `about.maker` are backed by `hands-polish.webp`, a
    // pre-v3 file outside the Part 15 masters (CLAUDE.md's Site Images
    // section names it explicitly) — the case a null default has to cover.
    const maker = SLOTS.find((s) => s.key === "home.maker");
    expect(maker).toBeTruthy();
    expect(blurFor(maker!.fallback)).toBeUndefined();
    expect(SITE_IMAGE_DEFAULT_REFS["home.maker"].blurDataUrl).toBeNull();
  });
});

describe("alt keys", () => {
  it("only ever names a copy slot that exists", () => {
    // A wrong key here would silently edit some OTHER picture's description.
    for (const slot of SLOTS) {
      if (!slot.altKey) continue;
      expect(isCopyKey(slot.altKey), `${slot.key} → ${slot.altKey}`).toBe(true);
    }
  });

  it("leaves the decorative slots without one", () => {
    // alt="" is a deliberate accessibility decision, not an omission — giving
    // these an alt field would invite an owner to undo it.
    const decorative = ["home.hero", "about.hero", "nav.art", "studio.login"];
    for (const key of decorative) {
      const slot = SLOTS.find((s) => s.key === key);
      expect(slot, key).toBeDefined();
      expect(slot && "altKey" in slot, key).toBe(false);
    }
  });

  it("covers the slots that carry real descriptions", () => {
    const withAlt = SLOTS.filter((s) => s.altKey);
    expect(withAlt.length).toBe(52);
  });
});

describe("siteImageMinWidth", () => {
  it("asks most of the widest crops", () => {
    expect(siteImageMinWidth("21:9")).toBe(2400);
    expect(siteImageMinWidth("16:9")).toBe(2400);
  });

  it("asks least of the portrait tiles", () => {
    expect(siteImageMinWidth("4:5")).toBe(1200);
    expect(siteImageMinWidth("3:4")).toBe(1200);
  });

  it("falls back rather than throwing on a ratio it does not know", () => {
    expect(siteImageMinWidth("7:3")).toBe(1200);
  });
});

describe("needsMobileCrop", () => {
  it("is true exactly for the wide crops", () => {
    expect(needsMobileCrop("16:9")).toBe(true);
    expect(needsMobileCrop("21:9")).toBe(true);
    expect(needsMobileCrop("4:5")).toBe(false);
    expect(needsMobileCrop("1:1")).toBe(false);
  });

  it("matches the wide slots the guidance calls out", () => {
    const wide = SLOTS.filter((s) => needsMobileCrop(s.ratio));
    // 13 since /large-resin-art: its hero is a 16:9 full-bleed band, and a
    // 16:9 crop on a 390px phone keeps a sliver of the frame's height.
    expect(wide.length).toBe(13);
  });
});

describe("isSiteImageKey", () => {
  it("accepts a real slot and rejects anything else", () => {
    expect(isSiteImageKey("home.hero")).toBe(true);
    expect(isSiteImageKey("home.nope")).toBe(false);
    expect(isSiteImageKey("")).toBe(false);
  });
});
