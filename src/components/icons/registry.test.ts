import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ICON_NAMES, ICONS } from "./index";
import {
  CONTENT_STATUS_ICON,
  INQUIRY_SOURCE_ICON,
  INQUIRY_STATUS_ICON,
  MEDIA_TYPE_ICON,
  PRODUCT_IMAGE_ROLE_ICON,
  PROVENANCE_ICON,
  REVIEW_STATUS_ICON,
  ROLE_ICON,
  SCRAPE_JOB_STATUS_ICON,
  SIZE_TIER_ICON,
  TESTIMONIAL_STATUS_ICON,
} from "./status";

/**
 * The icon registry's STYLE CONTRACT, as a test.
 *
 * `registry.tsx`'s header states the rules — 24px grid, 1.5px stroke,
 * `currentColor`, no fill — and a rule stated only in prose is a rule that
 * quietly stops being true on the eleventh mark, when someone drops in an SVG
 * from elsewhere and it happens to look fine. These assertions are cheap and
 * they are the difference between a registry and a folder.
 *
 * ## The one that actually matters is `currentColor`
 *
 * Every mark inherits the ink of wherever it is dropped. A hard-coded stroke
 * would be invisible the day someone uses that mark in a champagne row, or a
 * light patch on a dark screen in a new scope — and neither shows up in a
 * review of the file that introduced it, because that file's own screenshot
 * looks correct.
 *
 * ## The enum maps are already checked by the COMPILER
 *
 * `Record<InquiryStatus, IconName>` in `status.ts` means a new schema value
 * fails `tsc` until it has a mark. This file does not re-assert that. What it
 * DOES assert is the half the type system cannot see: that every name a map
 * points at actually exists in the registry — the maps are typed against
 * `IconName`, so a typo is caught, but a name that was removed from `ICONS`
 * while a map still referenced it would only fail at render.
 */

/**
 * Comments are STRIPPED before any of these assertions run, and the first
 * version of this file is why: both source files explain their own rules in
 * prose ("`pathLength=\"1\"` on every path is what makes one keyframe work"),
 * and a test that greps the raw text counts the explanation as a usage. That
 * produced 30 normalised paths against 29 shapes — a failure whose only cause
 * was the documentation being good.
 *
 * Block comments and line comments both go. What is left is the code these
 * rules are actually about.
 */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SOURCE = strip(readFileSync(join(__dirname, "registry.tsx"), "utf8"));
const EMPTY_ART = strip(readFileSync(join(__dirname, "empty-art.tsx"), "utf8"));
const BRAND_MARKS = strip(
  readFileSync(join(__dirname, "brand-marks.tsx"), "utf8"),
);

describe("icon registry · style contract", () => {
  it("draws every mark on the 24px grid", () => {
    // ONE viewBox in the file, on the shared <Svg>. A mark that declared its
    // own would be a second grid, which is how two marks end up optically
    // different sizes at the same `size` prop.
    const viewBoxes = [...SOURCE.matchAll(/viewBox="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(viewBoxes).toEqual(["0 0 24 24"]);
  });

  it("strokes in currentColor and fills nothing, in exactly one place", () => {
    expect(SOURCE).toContain('stroke="currentColor"');
    expect(SOURCE).toContain('fill="none"');
    // A mark that sets its own stroke colour cannot follow the scope it is
    // dropped into. The only `fill` allowed is the shared "none" plus the
    // `fill="currentColor"` on the three dots inside the QUEUED mark, which
    // are dots rather than strokes.
    const strokeAttrs = [...SOURCE.matchAll(/stroke="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(new Set(strokeAttrs)).toEqual(new Set(["currentColor", "none"]));
  });

  it("carries no raw hex", () => {
    // The storefront-wide rule (CLAUDE.md: "No raw hex in components"), and
    // the one place a hand-authored SVG would most plausibly smuggle one in.
    expect(SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(EMPTY_ART).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(BRAND_MARKS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("keeps one stroke width for the 24px set", () => {
    const widths = [...SOURCE.matchAll(/strokeWidth=\{([\d.]+)\}/g)].map(
      (m) => m[1],
    );
    expect(widths).toEqual(["1.5"]);
  });

  it("is aria-hidden unless it is given a title", () => {
    // A mark beside visible text that announces itself reads the state twice.
    expect(SOURCE).toContain('"aria-hidden": true');
    expect(SOURCE).toContain("<title>{title}</title>");
  });
});

describe("empty-state art", () => {
  it("normalises every path to pathLength 1", () => {
    // ONE keyframe draws every mark only because SVG normalises the path's
    // length to 1. Without it each would need its own measured dash value, and
    // a path edited later would silently stop drawing all the way — a bug that
    // looks like a design choice.
    const shapes = [...EMPTY_ART.matchAll(/<(path|circle|rect)\s/g)].length;
    const normalised = [...EMPTY_ART.matchAll(/pathLength="1"/g)].length;
    expect(normalised).toBe(shapes);
  });

  it("draws at 1px on a 96 grid, not a scaled-up 24px mark", () => {
    expect(EMPTY_ART).toContain('viewBox="0 0 96 96"');
    expect(EMPTY_ART).toContain("strokeWidth={1}");
  });
});

describe("status maps", () => {
  const MAPS = {
    InquiryStatus: INQUIRY_STATUS_ICON,
    InquirySource: INQUIRY_SOURCE_ICON,
    ContentStatus: CONTENT_STATUS_ICON,
    TestimonialStatus: TESTIMONIAL_STATUS_ICON,
    ReviewStatus: REVIEW_STATUS_ICON,
    ScrapeJobStatus: SCRAPE_JOB_STATUS_ICON,
    MediaType: MEDIA_TYPE_ICON,
    Provenance: PROVENANCE_ICON,
    ProductImageRole: PRODUCT_IMAGE_ROLE_ICON,
    ProductSizeTier: SIZE_TIER_ICON,
    Role: ROLE_ICON,
  };

  for (const [name, map] of Object.entries(MAPS)) {
    it(`${name} points only at marks that exist`, () => {
      for (const [value, icon] of Object.entries(map)) {
        expect(
          ICONS[icon],
          `${name}.${value} → "${icon}" is not in the registry`,
        ).toBeTypeOf("function");
      }
    });
  }

  it("keeps CLOSED and LOST distinguishable", () => {
    // Both are terminal, and a person has to act on them differently: CLOSED
    // simply ended, LOST was declined after real discussion. Sharing a mark
    // would erase a distinction the pipeline makes on purpose (schema.prisma
    // documents both), where PUBLISHED/APPROVED/VERIFIED share one because
    // they are the same event in three tables.
    expect(INQUIRY_STATUS_ICON.CLOSED).not.toBe(INQUIRY_STATUS_ICON.LOST);
  });

  it("gives Provenance.AI a mark of its own", () => {
    // §12.5's filter and indicator exist so a generated picture is never
    // mistaken for a photograph. Sharing UPLOAD's mark would defeat the one
    // thing this enum is surfaced for.
    expect(PROVENANCE_ICON.AI).not.toBe(PROVENANCE_ICON.UPLOAD);
    expect(PROVENANCE_ICON.AI).not.toBe(PROVENANCE_ICON.BUNDLED);
  });
});

describe("the name union", () => {
  it("lists every mark exactly once", () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    expect(ICON_NAMES.length).toBe(Object.keys(ICONS).length);
  });
});

describe("brand marks", () => {
  it("draws in one ink, at two opacities", () => {
    // The whole reason `brand-marks.tsx` is not in the registry is that it
    // paints AREAS. Those areas are `currentColor` at a low opacity, never a
    // second colour: a champagne wash across a 4:3 panel would be the largest
    // fill on the page, and the palette rule says champagne is never a fill.
    const fills = [...BRAND_MARKS.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(fills)).toEqual(new Set(["none", "currentColor"]));
    const strokes = [...BRAND_MARKS.matchAll(/stroke="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(new Set(strokes)).toEqual(new Set(["currentColor", "none"]));
  });
});
