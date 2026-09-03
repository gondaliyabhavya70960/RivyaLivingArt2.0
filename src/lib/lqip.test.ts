import { describe, expect, it } from "vitest";

import { blurFor } from "./lqip";
import { SITE_IMAGE_SLOTS } from "./site-images";
import blurManifest from "./media-v3-blur.json";

describe("blurFor", () => {
  it("resolves a bundled Part 15 master's URL to its blur-up placeholder", () => {
    const [firstId, firstEntry] = Object.entries(blurManifest)[0];
    const blur = blurFor(firstEntry.src);
    expect(blur, firstId).toBe(firstEntry.blurDataURL);
    expect(blur?.startsWith("data:image/webp;base64,")).toBe(true);
  });

  it("resolves every entry in the manifest, not just the first", () => {
    for (const [id, entry] of Object.entries(blurManifest)) {
      expect(blurFor(entry.src), id).toBe(entry.blurDataURL);
    }
  });

  it("is undefined for a URL the manifest has never heard of", () => {
    expect(blurFor("/uploads/owner-photo-a1b2c3d4.jpg")).toBeUndefined();
    expect(blurFor("https://example.com/not-ours.png")).toBeUndefined();
    expect(blurFor("")).toBeUndefined();
  });

  // A repointed slot must never paint the DEFAULT'S blur behind a picture it
  // no longer shows — the failure mode `docs/transformation-audit.md` §10.4
  // calls out by name for the naive "key on the slot" design. Every slot's
  // bundled fallback still resolves correctly on its own — this is the
  // negative case: an override URL for that same slot must not accidentally
  // hit the bundled map just because two different keys share a manifest
  // entry.
  it("a repointed slot's override URL carries no bundled blur", () => {
    const heroSlot = SITE_IMAGE_SLOTS.find((slot) => slot.key === "home.hero");
    expect(heroSlot).toBeTruthy();
    // The bundled default DOES resolve...
    expect(blurFor(heroSlot!.fallback)).toBeTruthy();
    // ...but an owner override — an upload living outside /media/v3 — does
    // not, even though it now serves the exact same slot.
    const overrideUrl = "/uploads/home-hero-repointed-9f8e7d6c.jpg";
    expect(overrideUrl).not.toBe(heroSlot!.fallback);
    expect(blurFor(overrideUrl)).toBeUndefined();
  });
});
