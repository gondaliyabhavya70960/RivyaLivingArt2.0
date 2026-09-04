import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PAGE_SECTIONS,
  applyReorder,
  PAGE_SECTION_LABELS,
  SECTION_PAGES,
  SUBLIST_PAGES,
  describeArrangementProblem,
  isSectionPageKey,
  sectionDef,
} from "./page-sections";
import { PROCESS_STEP_COUNT } from "./process-steps";

/** The shipped homepage, in registry order, with everything showing. */
function shipped() {
  return PAGE_SECTIONS.home.map((s) => ({ ...s, visible: true }));
}

describe("the section manifest", () => {
  it("labels every page it declares", () => {
    for (const page of SECTION_PAGES) {
      expect(PAGE_SECTION_LABELS[page].title, page).toBeTruthy();
      expect(PAGE_SECTION_LABELS[page].path.startsWith("/"), page).toBe(true);
    }
  });

  it("has no duplicate key within a page", () => {
    for (const page of SECTION_PAGES) {
      const keys = PAGE_SECTIONS[page].map((s) => s.key);
      expect(new Set(keys).size, page).toBe(keys.length);
    }
  });

  it("gives every routable page exactly one section carrying the h1", () => {
    // REDESIGN.md Part 19.1, and `scripts/redesign-audit.mjs` fails on it. Two
    // sections claiming the heading would let an owner hide the wrong one.
    // `SUBLIST_PAGES` are arrangements INSIDE a page, not a page of their
    // own — the page around them already has an h1, so they carry none.
    for (const page of SECTION_PAGES) {
      const owners = PAGE_SECTIONS[page].filter((s) => s.ownsH1);
      expect(owners.length, page).toBe(SUBLIST_PAGES.has(page) ? 0 : 1);
    }
  });

  it("never lets the h1 section be hidden or moved", () => {
    for (const page of SECTION_PAGES) {
      if (SUBLIST_PAGES.has(page)) continue;
      const owner = PAGE_SECTIONS[page].find((s) => s.ownsH1);
      expect(owner?.hideable).toBe(false);
      expect(owner?.movable).toBe(false);
    }
  });

  it("keeps the process-steps registry in step with PROCESS_STEPS", () => {
    expect(PAGE_SECTIONS["process-steps"].length).toBe(PROCESS_STEP_COUNT);
  });

  it("ships an arrangement its own validator accepts", () => {
    // If the page as it ships could not pass the rule the studio enforces, the
    // rule is wrong — this catches that before an owner hits it.
    for (const page of SECTION_PAGES) {
      const all = PAGE_SECTIONS[page].map((s) => ({ ...s, visible: true }));
      expect(describeArrangementProblem(all), page).toBeNull();
    }
  });

  it("resolves a key to its definition and rejects a stranger", () => {
    expect(sectionDef("home", "pour")?.label).toBe("Hero");
    expect(sectionDef("home", "nope")).toBeUndefined();
  });

  it("recognises only the pages it declares", () => {
    expect(isSectionPageKey("home")).toBe(true);
    expect(isSectionPageKey("checkout")).toBe(false);
  });
});

/**
 * Every page's DEFAULT arrangement — `defaultVisible` applied, everything
 * else at its registry order — is what a fresh install and an empty
 * `PageSection` table both render (`page-sections-server.ts`). It has to
 * clear the same guardrail a hand-edited row would, or the page the repo
 * ships with is already the violation the studio exists to prevent.
 */
function defaultShipped(page: (typeof SECTION_PAGES)[number]) {
  return PAGE_SECTIONS[page].map((s) => ({
    ...s,
    visible: s.hideable ? (s.defaultVisible ?? true) : true,
  }));
}

describe("registry-wide, across every page", () => {
  it("keeps every page's default arrangement inside its own band rhythm", () => {
    // A generic form of "allows the shipped homepage" above, run over every
    // page rather than just home — new pages and new off-by-default sections
    // inherit the check rather than needing their own copy of it.
    for (const page of SECTION_PAGES) {
      expect(describeArrangementProblem(defaultShipped(page)), page).toBeNull();
    }
  });

  it("resolves every cureLabelKey against messages/en.json", () => {
    const en = JSON.parse(
      readFileSync(join(process.cwd(), "messages/en.json"), "utf8"),
    ) as Record<string, unknown>;
    // "large-format" → "LargeFormat", "custom-order" → "CustomOrder" — the
    // same PascalCase join `t()` already uses to key its own namespace on
    // each of these pages.
    const namespaceFor = (page: string) =>
      page
        .split("-")
        .map((word) => word[0]!.toUpperCase() + word.slice(1))
        .join("");

    let checked = 0;
    for (const page of SECTION_PAGES) {
      const namespace = namespaceFor(page);
      for (const section of PAGE_SECTIONS[page]) {
        if (!section.cureLabelKey) continue;
        checked += 1;
        const path = `${namespace}.${section.cureLabelKey}`;
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, key) =>
              node && typeof node === "object"
                ? (node as Record<string, unknown>)[key]
                : undefined,
            en,
          );
        expect(typeof value, `${page} → ${path}`).toBe("string");
      }
    }
    // A registry with no cureLabelKey anywhere would pass this test having
    // checked nothing — make sure it is actually exercising the pages that
    // declare one (home and large-format, at minimum).
    expect(checked).toBeGreaterThan(0);
  });
});

describe("the arrangement guardrails", () => {
  it("allows the shipped homepage", () => {
    expect(describeArrangementProblem(shipped())).toBeNull();
  });

  it("refuses to hide the section carrying the heading", () => {
    const sections = shipped().map((s) =>
      s.ownsH1 ? { ...s, visible: false } : s,
    );
    expect(describeArrangementProblem(sections)).toMatch(/only heading/);
  });

  it("refuses to hide a section the page cannot lose", () => {
    // The closing invitation is unhideable but does not carry the h1, so this
    // exercises the second rule rather than the first.
    const sections = shipped().map((s) =>
      s.key === "closing" ? { ...s, visible: false } : s,
    );
    expect(describeArrangementProblem(sections)).toMatch(/cannot be hidden/);
  });

  it("refuses a fourth dark band", () => {
    const sections = [
      ...shipped(),
      {
        key: "extra",
        label: "A fourth dark band",
        dark: true,
        visible: true,
        hideable: true,
      },
    ];
    const problem = describeArrangementProblem(sections);
    expect(problem).toMatch(/4 dark bands/);
    // The refusal has to name them, or the owner has nothing to act on.
    expect(problem).toMatch(/Hero/);
  });

  it("refuses two dark bands sitting edge to edge", () => {
    const problem = describeArrangementProblem([
      { key: "a", label: "Hero", dark: true, visible: true, hideable: false },
      {
        key: "b",
        label: "Commission band",
        dark: true,
        visible: true,
        hideable: true,
      },
    ]);
    expect(problem).toMatch(/edge to edge/);
    expect(problem).toMatch(/Hero/);
    expect(problem).toMatch(/Commission band/);
  });

  it("counts only the sections that show", () => {
    // Two dark bands adjacent in the LIST but with the second hidden is a page
    // with one dark band, not a violation.
    expect(
      describeArrangementProblem([
        { key: "a", label: "Hero", dark: true, visible: true, hideable: false },
        {
          key: "b",
          label: "Commission band",
          dark: true,
          visible: false,
          hideable: true,
        },
        { key: "c", label: "Journal", visible: true, hideable: true },
      ]),
    ).toBeNull();
  });

  it("sees through a hidden light section between two dark ones", () => {
    // Hiding the light band in the middle is what makes the two dark ones
    // adjacent — the rule has to read the rendered order, not the stored one.
    expect(
      describeArrangementProblem([
        { key: "a", label: "Hero", dark: true, visible: true, hideable: false },
        { key: "b", label: "Manifesto", visible: false, hideable: true },
        {
          key: "c",
          label: "Commission band",
          dark: true,
          visible: true,
          hideable: true,
        },
      ]),
    ).toMatch(/edge to edge/);
  });

  it("allows an empty page rather than throwing on one", () => {
    expect(describeArrangementProblem([])).toBeNull();
  });

  it("refuses to hide every one of the ten process steps", () => {
    const allHidden = PAGE_SECTIONS["process-steps"].map((s) => ({
      ...s,
      visible: false,
    }));
    expect(describeArrangementProblem(allHidden)).toMatch(/cannot lose all/);
  });

  it("still refuses a fourth dark band once the sections list is long", () => {
    // The "hide everything" guard above must not fire just because SOME
    // sections are hidden — only when NONE are left showing.
    const sections = shipped().map((s) =>
      s.key === "why" ? { ...s, visible: false } : s,
    );
    expect(describeArrangementProblem(sections)).toBeNull();
  });
});

describe("applyReorder", () => {
  const current = [
    { key: "pour", movable: false },
    { key: "manifesto", movable: true },
    { key: "pieces", movable: true },
    { key: "material", movable: false },
    { key: "collections", movable: true },
  ];

  it("applies a swap of two movable sections", () => {
    const next = applyReorder(current, [
      "pour",
      "pieces",
      "manifesto",
      "material",
      "collections",
    ]);
    expect(next.map((s) => s.key)).toEqual([
      "pour",
      "pieces",
      "manifesto",
      "material",
      "collections",
    ]);
  });

  it("keeps a pinned section at its index whatever the caller asks", () => {
    // A client that tried to drag the hero into the middle gets the hero back
    // where it was, with the movable sections closing up around it.
    const next = applyReorder(current, [
      "manifesto",
      "pieces",
      "pour",
      "collections",
      "material",
    ]);
    expect(next.map((s) => s.key)).toEqual([
      "pour",
      "manifesto",
      "pieces",
      "material",
      "collections",
    ]);
  });

  it("keeps every section when the caller sends a short list", () => {
    // A truncated or stale request must not silently drop a section off the
    // page — the ones it forgot keep their place in the tail.
    const next = applyReorder(current, ["manifesto"]);
    expect(next.map((s) => s.key)).toEqual([
      "pour",
      "manifesto",
      "pieces",
      "material",
      "collections",
    ]);
  });

  it("ignores a key the caller sent twice", () => {
    const next = applyReorder(current, [
      "collections",
      "collections",
      "manifesto",
      "pieces",
    ]);
    expect(next.map((s) => s.key)).toEqual([
      "pour",
      "collections",
      "manifesto",
      "material",
      "pieces",
    ]);
  });

  it("ignores a key that is not on the page", () => {
    const next = applyReorder(current, [
      "ghost",
      "manifesto",
      "pieces",
      "collections",
    ]);
    expect(next.map((s) => s.key)).toEqual([
      "pour",
      "manifesto",
      "pieces",
      "material",
      "collections",
    ]);
  });

  it("agrees with the shipped homepage when handed its own order", () => {
    const home = PAGE_SECTIONS.home.map((s) => ({ ...s }));
    const next = applyReorder(
      home,
      home.map((s) => s.key),
    );
    expect(next.map((s) => s.key)).toEqual(home.map((s) => s.key));
  });
});
