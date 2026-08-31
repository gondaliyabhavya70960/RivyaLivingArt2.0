import { describe, expect, it } from "vitest";

import {
  applyCopyOverrides,
  describeCopyProblem,
  icuVars,
  isCopyKey,
  richTags,
  type CopySlot,
  type MessageTree,
} from "./site-copy";

const slot = (over: Partial<CopySlot> = {}): CopySlot => ({
  key: "Home.hero.headline",
  group: "Homepage",
  section: "hero",
  label: "Hero headline",
  kind: "heading",
  tier: "editorial",
  max: 80,
  ...over,
});

describe("applyCopyOverrides", () => {
  const base: MessageTree = {
    Home: {
      hero: { headline: "Liquid luxury, cast forever.", lead: "A lead." },
      cta: { heading: "Begin." },
    },
    Footer: { rights: "© {year} ResinRiva." },
  };

  it("returns the base catalogue by reference when there is nothing to apply", () => {
    // The overlay must cost nothing until the owner actually edits something.
    expect(applyCopyOverrides(base, {})).toBe(base);
  });

  it("replaces one leaf", () => {
    const out = applyCopyOverrides(base, {
      "Home.hero.headline": "Poured by hand.",
    });
    expect((out.Home as MessageTree).hero).toMatchObject({
      headline: "Poured by hand.",
      lead: "A lead.",
    });
  });

  it("never mutates the base — it is a shared module namespace", () => {
    // The bug this guards against would leak one request's overrides into
    // every subsequent request in the process, in every locale.
    const snapshot = JSON.parse(JSON.stringify(base));
    applyCopyOverrides(base, { "Home.hero.headline": "Changed." });
    expect(base).toEqual(snapshot);
  });

  it("shares untouched branches by reference", () => {
    const out = applyCopyOverrides(base, {
      "Home.hero.headline": "Changed.",
    });
    expect(out.Footer).toBe(base.Footer);
    expect((out.Home as MessageTree).cta).toBe((base.Home as MessageTree).cta);
  });

  it("ignores a key that no longer exists in the catalogue", () => {
    // A renamed key survives in the table until someone clears it; a stale row
    // must not graft a property onto an object that no longer expects one.
    const out = applyCopyOverrides(base, { "Home.hero.title": "Nope." });
    expect((out.Home as MessageTree).hero).not.toHaveProperty("title");
  });

  it("refuses to flatten a namespace into a string", () => {
    const out = applyCopyOverrides(base, { "Home.hero": "Nope." });
    expect(typeof (out.Home as MessageTree).hero).toBe("object");
  });

  it("applies several overrides at once", () => {
    const out = applyCopyOverrides(base, {
      "Home.hero.headline": "One.",
      "Home.cta.heading": "Two.",
    });
    const home = out.Home as MessageTree;
    expect((home.hero as MessageTree).headline).toBe("One.");
    expect((home.cta as MessageTree).heading).toBe("Two.");
  });
});

describe("icuVars / richTags", () => {
  it("finds simple placeholders", () => {
    expect(icuVars("Page {number}")).toEqual(["number"]);
  });

  it("finds the argument of a plural form", () => {
    expect(icuVars("{count, plural, one {# piece} other {# pieces}}")).toEqual([
      "count",
    ]);
  });

  it("finds markup tags", () => {
    expect(richTags("Ask us <commission>about it</commission>")).toEqual([
      "commission",
    ]);
  });
});

describe("describeCopyProblem", () => {
  it("accepts ordinary wording", () => {
    expect(describeCopyProblem(slot(), "Poured by hand.")).toBeNull();
  });

  it("accepts an empty value — blanking means reset", () => {
    expect(describeCopyProblem(slot(), "   ")).toBeNull();
  });

  it("refuses a dropped placeholder, and names it", () => {
    const problem = describeCopyProblem(
      slot({ vars: ["count"] }),
      "pieces in this collection",
    );
    expect(problem).toContain("{count}");
  });

  it("accepts wording that keeps the placeholder", () => {
    expect(
      describeCopyProblem(slot({ vars: ["count"] }), "{count} pieces"),
    ).toBeNull();
  });

  it("refuses a dropped markup tag", () => {
    const problem = describeCopyProblem(
      slot({ tags: ["commission"] }),
      "Ask us about it",
    );
    expect(problem).toContain("<commission>");
  });

  it("refuses unbalanced braces", () => {
    expect(describeCopyProblem(slot(), "{count pieces")).toContain(
      "curly brackets",
    );
  });

  it("refuses script-shaped input", () => {
    expect(
      describeCopyProblem(slot(), "<script>alert(1)</script>"),
    ).not.toBeNull();
  });

  it("allows going over the budget, but not absurdly over", () => {
    expect(describeCopyProblem(slot({ max: 10 }), "a".repeat(15))).toBeNull();
    expect(
      describeCopyProblem(slot({ max: 10 }), "a".repeat(25)),
    ).not.toBeNull();
  });
});

describe("isCopyKey", () => {
  it("accepts a key from the generated registry", () => {
    expect(isCopyKey("Home.hero.headline")).toBe(true);
  });

  it("rejects anything not in the registry", () => {
    expect(isCopyKey("Home.hero.nope")).toBe(false);
    expect(isCopyKey("")).toBe(false);
  });
});
