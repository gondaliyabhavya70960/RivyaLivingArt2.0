import { describe, expect, it } from "vitest";

import {
  buildPublishReport,
  summarisePublish,
  type StagedCopy,
  type StagedImage,
} from "./publish";
import type { CopySlot } from "./site-copy";
import type { SiteImageSlot } from "./site-images";

const copySlot = (over: Partial<CopySlot> = {}): CopySlot => ({
  key: "Home.hero.headline",
  group: "Homepage",
  section: "hero",
  label: "Hero headline",
  kind: "heading",
  tier: "editorial",
  max: 80,
  ...over,
});

const imageSlot = (over: Partial<SiteImageSlot> = {}): SiteImageSlot => ({
  key: "home.maker",
  group: "Homepage",
  label: "The maker",
  where: "Homepage · 06",
  ratio: "4:5",
  fallback: "/media/hands-polish.webp",
  ...over,
});

const staged = (over: Partial<StagedCopy> = {}): StagedCopy => ({
  slot: copySlot(),
  locale: "en",
  value: "Poured by hand.",
  ...over,
});

const image = (over: Partial<StagedImage> = {}): StagedImage => ({
  slot: imageSlot(),
  url: "/media/x.webp",
  alt: "A maker polishing a resin block",
  ...over,
});

describe("buildPublishReport", () => {
  it("passes clean content", () => {
    const report = buildPublishReport([staged()], [image()]);
    expect(report.blocking).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.counts).toEqual({ copy: 1, images: 1 });
  });

  it("blocks a staged string that dropped its placeholder", () => {
    // Save-time validation catches this, but a row can be staged before a slot
    // gains a placeholder, or edited straight in the database.
    const report = buildPublishReport(
      [staged({ slot: copySlot({ vars: ["count"] }), value: "pieces" })],
      [],
    );
    expect(report.blocking).toHaveLength(1);
    expect(report.blocking[0].message).toContain("{count}");
    expect(report.blocking[0].where).toContain("Hero headline");
  });

  it("blocks a picture that describes itself to nobody", () => {
    const report = buildPublishReport(
      [],
      [image({ slot: imageSlot({ altKey: "Home.maker.imageAlt" }), alt: "" })],
    );
    expect(report.blocking).toHaveLength(1);
    expect(report.blocking[0].message).toContain("screen readers");
  });

  it("does not ask a decorative picture for a description", () => {
    // alt="" is a deliberate accessibility decision. Blocking on it would push
    // an owner to invent a description for a frame that carries no meaning.
    const report = buildPublishReport([], [image({ alt: null })]);
    expect(report.blocking).toEqual([]);
  });

  it("warns about a long string without blocking it", () => {
    // The budget is design guidance and some languages need more room. A gate
    // that blocks here is a gate people learn to work around.
    const report = buildPublishReport(
      [staged({ slot: copySlot({ max: 10 }), value: "a".repeat(15) })],
      [],
    );
    expect(report.blocking).toEqual([]);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0].message).toContain("15 characters");
  });

  it("names the language, so a Hindi problem is not mistaken for English", () => {
    const report = buildPublishReport(
      [
        staged({
          slot: copySlot({ vars: ["count"] }),
          locale: "hi",
          value: "टुकड़े",
        }),
      ],
      [],
    );
    expect(report.blocking[0].where).toContain("hi");
  });

  it("reports every problem, not just the first", () => {
    const report = buildPublishReport(
      [
        staged({ slot: copySlot({ vars: ["count"] }), value: "one" }),
        staged({
          slot: copySlot({
            key: "Home.hero.lead",
            label: "Hero lead",
            vars: ["n"],
          }),
          value: "two",
        }),
      ],
      [],
    );
    expect(report.blocking).toHaveLength(2);
  });
});

describe("summarisePublish", () => {
  it("says so when nothing changed", () => {
    expect(summarisePublish([], [])).toBe("No changes");
  });

  it("names the fields when there are few", () => {
    expect(summarisePublish([staged()], [image()])).toBe(
      "Hero headline, The maker",
    );
  });

  it("collapses one field edited in several languages", () => {
    // The same slot in nine languages is one thing changed, not nine.
    const many = ["en", "hi", "gu"].map((locale) => staged({ locale }));
    expect(summarisePublish(many, [])).toBe("Hero headline");
  });

  it("caps the list rather than printing forty names", () => {
    const many = ["a", "b", "c", "d", "e"].map((k) =>
      staged({ slot: copySlot({ key: k, label: `Field ${k}` }) }),
    );
    expect(summarisePublish(many, [])).toBe(
      "Field a, Field b, Field c, 2 more",
    );
  });
});
