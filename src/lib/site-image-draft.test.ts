import { describe, expect, it } from "vitest";

import { readStagedImage } from "./site-image-draft";

/**
 * This reader is load-bearing in three places that must agree: the Site Images
 * board shows the owner what they staged, `getSiteImageRefs` previews it behind
 * the staff cookie, and `findMediaUsageDetails` refuses to delete the file it
 * points at. If it returned `null` for a shape the studio actually writes, the
 * delete guard would go quiet again — which is the bug these tests exist for.
 */
describe("readStagedImage", () => {
  it("reads the shape the studio actually writes", () => {
    expect(
      readStagedImage({
        url: "https://blob.example/hero.avif",
        mobileUrl: "https://blob.example/hero-mobile.avif",
        focalX: 0.25,
        focalY: 0.75,
      }),
    ).toEqual({
      url: "https://blob.example/hero.avif",
      mobileUrl: "https://blob.example/hero-mobile.avif",
      focalX: 0.25,
      focalY: 0.75,
    });
  });

  it("reads a url-only stage — the common case, and the one the guard needs", () => {
    // `setSiteImage` on an existing row writes only what changed, so the
    // overwhelmingly common staged blob is a bare { url }.
    expect(readStagedImage({ url: "https://blob.example/a.avif" })).toEqual({
      url: "https://blob.example/a.avif",
    });
  });

  it("keeps an explicit null mobileUrl, which means 'cleared' not 'unset'", () => {
    // Distinct from absent: clearing the mobile crop is a real staged edit, and
    // collapsing it to undefined would publish the old crop back.
    expect(readStagedImage({ mobileUrl: null })).toEqual({ mobileUrl: null });
  });

  it("degrades to null rather than throwing on anything malformed", () => {
    // A malformed blob must not throw: this runs on every route in the app.
    for (const value of [
      null,
      undefined,
      "a string",
      42,
      [],
      ["url"],
      {},
      { url: 42 },
      { nothing: "useful" },
    ]) {
      expect(readStagedImage(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("ignores fields it does not understand instead of passing them through", () => {
    expect(
      readStagedImage({ url: "https://blob.example/a.avif", rogue: "value" }),
    ).toEqual({ url: "https://blob.example/a.avif" });
  });

  it("drops a non-numeric focal rather than producing an off-frame crop", () => {
    expect(
      readStagedImage({ url: "https://blob.example/a.avif", focalX: "0.5" }),
    ).toEqual({ url: "https://blob.example/a.avif" });
  });
});
