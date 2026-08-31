import { describe, expect, it } from "vitest";

import { SITE_IMAGE_SLOTS } from "@/lib/site-images";
import { bundledProvenance } from "@/lib/site-images-import";

/**
 * The provenance rule for the images this repository ships.
 *
 * This is asserted rather than trusted because it is the one claim the media
 * library makes on the owner's behalf — "a model drew this" — and it is made
 * about files nobody re-checks after the import runs once.
 */
describe("bundledProvenance", () => {
  it("marks the §15.4 masters as AI", () => {
    expect(bundledProvenance("/media/v3/hero-pour.avif")).toBe("AI");
  });

  it("marks everything else bundled", () => {
    expect(bundledProvenance("/media/hands-polish.webp")).toBe("BUNDLED");
    expect(bundledProvenance("/media/pour-cure/frame-001.webp")).toBe("BUNDLED");
  });

  it("never claims a path outside /media/v3 was generated", () => {
    // A near-miss must not slip through: the guard is a path prefix, so
    // anything merely CONTAINING the segment stays photography.
    expect(bundledProvenance("/uploads/2025/media/v3/decoy.avif")).toBe(
      "BUNDLED",
    );
  });

  it("classifies every real slot, and the only non-AI one is the maker", () => {
    const bundled = [
      ...new Set(
        SITE_IMAGE_SLOTS.map((slot) => slot.fallback).filter(
          (file) => bundledProvenance(file) === "BUNDLED",
        ),
      ),
    ].sort();

    // The process video and its poster used to sit here: no §15.4 loop had been
    // generated, so both slots kept pre-v3 files. They are v3 masters now and
    // are correctly reported as AI, which leaves exactly one bundled file.
    //
    // And that one is a problem worth stating rather than carrying quietly.
    // `/media/hands-polish.webp` backs `home.maker` and `about.maker`, whose
    // slot notes read "A real photograph of the studio, never a generated one"
    // — but the file is itself a Higgsfield generation, so this row asserts
    // something untrue about the only two slots §15.2 explicitly protects.
    // Relabelling it AI would make the provenance honest and still leave §15.2
    // violated; the fix is a real photograph of the studio, which is the
    // owner's to supply. Recorded here because this assertion is the closest
    // thing the repo has to a claim about it.
    expect(bundled).toEqual(["/media/hands-polish.webp"]);
  });
});
