import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  describePassedThroughSeo,
  describePassedThroughSettings,
  PAGE_LIMITS,
  SETTINGS_LIMITS,
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
    expect(message).toContain("an opening-hours row");
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
describe("the converted action schemas carry no literal cap", () => {
  const CONVERTED: { file: string; schema: string }[] = [
    { file: "settings.ts", schema: "settingsSchema" },
    { file: "settings.ts", schema: "defaultSeoSchema" },
    { file: "pages.ts", schema: "upsertSchema" },
    { file: "products.ts", schema: "upsertProductSchema" },
    { file: "products.ts", schema: "imageSchema" },
    { file: "products.ts", schema: "customFieldSchema" },
    { file: "testimonials.ts", schema: "upsertSchema" },
    { file: "testimonials.ts", schema: "urlFieldSchema" },
    { file: "custom-pages.ts", schema: "pageSchema" },
    { file: "blog.ts", schema: "upsertPostSchema" },
    { file: "portfolio.ts", schema: "upsertPortfolioSchema" },
    { file: "portfolio.ts", schema: "resultsMetaSchema" },
    { file: "portfolio.ts", schema: "imageSchema" },
  ];

  /** One declaration, from `const <name> = z` to the next top-level one. */
  function declaration(source: string, name: string): string {
    const start = source.indexOf(`const ${name} = z`);
    expect(start).toBeGreaterThan(-1);
    const rest = source.slice(start + 1);
    const next = rest.search(/\n(?:export |const |function |\/\*\*)/);
    return next === -1 ? rest : rest.slice(0, next);
  }

  it.each(CONVERTED)("$file › $schema", ({ file, schema }) => {
    const source = readFileSync(
      join(process.cwd(), "src", "actions", file),
      "utf8",
    );
    // `.min(1)` is the non-empty idiom, not a length anyone tunes; only the
    // caps have to be shared.
    expect(declaration(source, schema).match(/\.max\(\s*\d/g) ?? []).toEqual(
      [],
    );
  });
});

describe("the limits are the numbers the actions enforced before the move", () => {
  it("keeps every value that was a literal", () => {
    expect(SETTINGS_LIMITS).toMatchObject({
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
    expect(PAGE_LIMITS).toMatchObject({
      slug: 120,
      title: 200,
      titleMin: 2,
      seoTitle: 300,
      seoDescription: 500,
    });
  });
});
