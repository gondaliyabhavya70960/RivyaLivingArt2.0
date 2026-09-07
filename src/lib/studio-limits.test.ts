import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BLOG_LIMITS,
  CUSTOM_PAGE_LIMITS,
  describePassedThroughSeo,
  describePassedThroughSettings,
  PAGE_LIMITS,
  PORTFOLIO_LIMITS,
  PRODUCT_LIMITS,
  SETTINGS_LIMITS,
  TESTIMONIAL_LIMITS,
  tooLong,
  WHATSAPP_NUMBER_PATTERN,
} from "./studio-limits";

describe("tooLong", () => {
  it("names the field and groups the number the Indian way", () => {
    expect(tooLong("the title", 300)).toBe(
      "Keep the title under 300 characters.",
    );
    expect(tooLong("the care notes", 5000)).toBe(
      "Keep the care notes under 5,000 characters.",
    );
  });
});

describe("WHATSAPP_NUMBER_PATTERN", () => {
  it("takes the bare international number and nothing else", () => {
    expect(WHATSAPP_NUMBER_PATTERN.test("917096036250")).toBe(true);
    expect(WHATSAPP_NUMBER_PATTERN.test("")).toBe(false);
    expect(WHATSAPP_NUMBER_PATTERN.test("+917096036250")).toBe(false);
    expect(WHATSAPP_NUMBER_PATTERN.test("91 70960 36250")).toBe(false);
    expect(WHATSAPP_NUMBER_PATTERN.test("1234567")).toBe(false);
  });
});

/**
 * The two settings editors submit each other's fields, so either can be
 * refused by a value it does not render — and the action reports only its
 * first issue, in schema key order. These guards run first and name the
 * screen to go to.
 */
describe("describePassedThroughSettings", () => {
  const good = {
    brandName: "Rivya Living Art",
    tagline: "",
    announcement: "",
    responseNote: "",
    phone: "",
    whatsappNumber: "917096036250",
    address: "",
    defaultCareNotes: "",
    businessHours: [{ days: "Mon-Fri", hours: "10-6" }],
  };

  it("passes a healthy row", () => {
    expect(describePassedThroughSettings(good)).toBeNull();
  });

  it("catches the empty WhatsApp number that blocks every SEO save", () => {
    expect(describePassedThroughSettings({ ...good, whatsappNumber: "" })).toBe(
      "This page also saves the site settings, and the WhatsApp number is not 8-15 digits. Open Settings and fix it there first.",
    );
  });

  it("catches an over-long field and names it", () => {
    const message = describePassedThroughSettings({
      ...good,
      tagline: "x".repeat(SETTINGS_LIMITS.tagline + 1),
    });
    expect(message).toContain("the tagline is over its 300-character limit");
  });

  it("counts the trimmed value, exactly as the action does", () => {
    expect(
      describePassedThroughSettings({
        ...good,
        tagline: `${"x".repeat(SETTINGS_LIMITS.tagline)}     `,
      }),
    ).toBeNull();
  });

  it("judges an opening-hours row the action would later drop", () => {
    const message = describePassedThroughSettings({
      ...good,
      businessHours: [{ days: "x".repeat(61), hours: "" }],
    });
    expect(message).toContain("an opening-hours days cell");
  });

  it("names the column that actually overflowed", () => {
    // The two limits are equal today; saying "days" for an over-long hours
    // cell would be wrong the moment they diverge, which is the change the
    // shared module exists to make safe.
    const message = describePassedThroughSettings({
      ...good,
      businessHours: [{ days: "Mon-Fri", hours: "x".repeat(61) }],
    });
    expect(message).toContain("an opening-hours hours cell");
  });
});

describe("describePassedThroughSeo", () => {
  it("passes what fits and names what does not", () => {
    expect(describePassedThroughSeo({ title: "", description: "" })).toBeNull();
    expect(
      describePassedThroughSeo({
        title: "x".repeat(SETTINGS_LIMITS.seoTitle + 1),
        description: "",
      }),
    ).toContain("the default SEO title");
    expect(
      describePassedThroughSeo({
        title: "",
        description: "x".repeat(SETTINGS_LIMITS.seoDescription + 1),
      }),
    ).toContain("the default SEO description");
  });
});

/**
 * The drift guard, and the reason this module exists. A `"use server"` file
 * may export only async functions, so an action cannot hand its schema or its
 * numbers to a test — a cap copied into a form could rot for a release with
 * nothing to catch it. The only defence is that both sides read the SAME
 * constant, so this asserts the converted schemas hold no bare number.
 */
describe("no literal cap survives in an editor's action", () => {
  /**
   * Whole-file, not per-schema. The first cut walked thirteen named schema
   * declarations, which let seven literal `.max()` calls sit just outside the
   * slices it read — one of them (`nameSchema` in blog.ts) backing a real
   * create form with no client mirror, a live instance of the defect this
   * module exists to close. Found by the adversarial pass. Everything that
   * stays a literal has to be named here, with the reason.
   */
  const ALLOWED: Record<string, string[]> = {
    "settings.ts": [
      "maxCreates — the sheet-fill policy form, not a Studio editor",
      "sheetId — the sheet-ids form, not a Studio editor",
    ],
    "products.ts": [
      "search query cap — a typed query, never stored",
      "slug length inside that array",
      "slug array length — a machine-built list, never typed",
      "second search query cap",
    ],
    "testimonials.ts": ["searchSchema — the link picker's typed query"],
  };

  const FILES = [
    "settings.ts",
    "pages.ts",
    "products.ts",
    "testimonials.ts",
    "custom-pages.ts",
    "blog.ts",
    "portfolio.ts",
  ];

  it.each(FILES)("%s", (file) => {
    const source = readFileSync(
      join(process.cwd(), "src", "actions", file),
      "utf8",
    );
    const literals = source.match(/\.max\(\s*\d/g) ?? [];
    expect(literals.length).toBe((ALLOWED[file] ?? []).length);
  });
});

describe("the limits are the numbers the actions enforced before the move", () => {
  /**
   * A transcription anchor for the move itself: both sides now read the same
   * constant, so the two cannot drift — but a typo made WHILE moving them
   * would have shifted the boundary silently. Every value, not a sample.
   */
  it("pins every entry", () => {
    expect(SETTINGS_LIMITS).toEqual({
      mode: "trimmed",
      brandName: 120,
      tagline: 300,
      announcement: 300,
      responseNote: 200,
      phone: 40,
      address: 2000,
      careNotes: 5000,
      businessHoursDays: 60,
      businessHoursHours: 60,
      seoTitle: 300,
      seoDescription: 500,
    });
    expect(PAGE_LIMITS).toEqual({
      mode: "trimmed",
      slug: 120,
      title: 200,
      titleMin: 2,
      seoTitle: 300,
      seoDescription: 500,
    });
    expect(CUSTOM_PAGE_LIMITS).toEqual({
      mode: "trimmed",
      slug: 120,
      title: 200,
      titleMin: 2,
      publishAt: 40,
      seoTitle: 300,
      seoDescription: 500,
      ogImage: 600,
    });
    expect(BLOG_LIMITS).toEqual({
      mode: "trimmed",
      taxonomyName: 120,
      title: 200,
      titleMin: 2,
      excerpt: 600,
      authorName: 120,
      seoTitle: 300,
      seoDescription: 500,
    });
    expect(TESTIMONIAL_LIMITS).toEqual({
      mode: "trimmed",
      name: 120,
      location: 120,
      quote: 2000,
      designation: 160,
      category: 120,
      language: 20,
      productTitle: 200,
      purchaseType: 60,
      internalNotes: 10_000,
      url: 2048,
      ratingMin: 1,
      ratingMax: 5,
    });
    expect(PRODUCT_LIMITS).toEqual({
      mode: "raw",
      titleMin: 2,
      displayName: 120,
      shortTagline: 300,
      timeline: 300,
      materials: 500,
      dimensions: 300,
      seoTitle: 300,
      seoDescription: 500,
      imageAlt: 300,
      lexicalLabel: 40,
      lexicalValue: 300,
      lexicalRows: 8,
      madeWithRows: 12,
      customFieldHelpText: 500,
      tierMin: 1,
      tierMax: 4,
    });
    expect(PORTFOLIO_LIMITS).toEqual({
      mode: "raw",
      titleMin: 2,
      location: 120,
      imageAlt: 300,
      imageCaption: 300,
      metaText: 300,
      metaComplexity: 60,
      metaTag: 60,
      metaTags: 12,
    });
  });
});
