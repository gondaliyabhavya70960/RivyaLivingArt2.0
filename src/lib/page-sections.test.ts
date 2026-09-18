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
  sublistsForPage,
} from "./page-sections";
import { PROCESS_STEP_COUNT } from "./process-steps";
import { GENERATED_COPY_SLOTS } from "./site-copy.generated";
import { isSiteImageKey } from "./site-images";

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

  it("matches at least one real copy slot for every copyPrefixes entry", () => {
    // A STRING prefix over slot keys, which is what the field says it is
    // ("Copy slots this section owns, as key prefixes") — `CustomOrder.page.hero`
    // legitimately owns `heroEyebrow`, `heroHeadline`, `heroLead` and the rest
    // without there being a `hero` node to resolve.
    //
    // The rule this enforces is that the prefix owns SOMETHING. Six entries
    // owned nothing at all: `Workshops.why` and `Workshops.session` (the bands
    // render `Workshops.intro` and `Workshops.experience`), and four on
    // /custom-order — `page.brief`, `page.faq`, `page.work`, `page.testimonials`
    // — against a page whose copy is `formHeading`, `proofHeading`,
    // `seeCommissions`. Nothing threw, because `copyPrefixes` has exactly one
    // consumer, `copyCount` on the sections board, so the only symptom was an
    // integer in front of the owner that counted a tree that does not exist.
    const keys = GENERATED_COPY_SLOTS.map((slot) => slot.key);

    let checked = 0;
    for (const page of SECTION_PAGES) {
      for (const section of PAGE_SECTIONS[page]) {
        for (const prefix of section.copyPrefixes) {
          checked += 1;
          expect(
            keys.some((key) => key === prefix || key.startsWith(prefix)),
            `${page} · ${section.key} → ${prefix} owns no copy slot`,
          ).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("names a real slot for every imageKeys entry", () => {
    // Same rule on the other half of the row. `isSiteImageKey` is the registry
    // itself, so a renamed or deleted slot is caught here rather than by an
    // owner opening a board that offers nothing.
    let checked = 0;
    for (const page of SECTION_PAGES) {
      for (const section of PAGE_SECTIONS[page]) {
        for (const key of section.imageKeys) {
          checked += 1;
          expect(isSiteImageKey(key), `${page} · ${section.key} → ${key}`).toBe(
            true,
          );
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
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

  /* D30 retired both band-rhythm rules, and these two tests are kept — inverted
     — rather than deleted, because a removed test leaves no record that the
     behaviour was REVERSED rather than lost.

     They used to assert a refusal. They now assert the arrangement is allowed,
     and the reason is in `describeArrangementProblem`: `[data-theme="navy"]` is
     a no-op alias, so "two adjacent dark bands" is two bands of the page's own
     obsidian, and the refusal's advice — "put a light section between them" —
     named a light ground that D30 removed from the design. */
  it("allows a fourth dark band, which D30 made meaningless", () => {
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
    expect(describeArrangementProblem(sections)).toBeNull();
  });

  it("allows two dark bands sitting edge to edge", () => {
    // The arrangement the old rule called impossible is now the default: on an
    // obsidian ground every band is this colour, so there is nothing to see at
    // the seam and nothing the owner could put there instead.
    expect(
      describeArrangementProblem([
        { key: "a", label: "Hero", dark: true, visible: true, hideable: false },
        {
          key: "b",
          label: "Commission band",
          dark: true,
          visible: true,
          hideable: true,
        },
      ]),
    ).toBeNull();
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

  it("no longer cares that hiding a light section makes two dark ones adjacent", () => {
    // This case was the sharpest version of the old rule: hiding the middle
    // band is what CREATED the adjacency, so the guard had to read the rendered
    // order rather than the stored one. That reading was correct and is now
    // moot — the adjacency it detected has no visual consequence on one ground.
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
    ).toBeNull();
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

  it("does not fire the hide-everything guard just because some are hidden", () => {
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

describe("sublistsForPage — S9's Order-tab fold", () => {
  it("gives Process its two sublists, in declaration order", () => {
    expect(sublistsForPage("process")).toEqual(["process-steps", "materials"]);
  });

  it("gives a page with no fragment-path sublist nothing", () => {
    // Six of the seven surfaces are unchanged by the fold; the picker is not
    // drawn for them at all.
    for (const key of ["home", "about", "large-format", "custom-order", "contact", "workshops"] as const) {
      expect(sublistsForPage(key)).toEqual([]);
    }
  });

  it("does NOT hand Materials to About, though its band renders there", () => {
    // `materials`' recorded home is `/process#materials`. Its cards do render
    // on About too, and moving one moves it on both pages — but inventing an
    // about↔materials edge the data does not state is how two maps begin to
    // disagree. The relation is derived from the path and nowhere else.
    expect(sublistsForPage("about")).toEqual([]);
  });

  it("gives a sublist no sublists of its own", () => {
    expect(sublistsForPage("process-steps")).toEqual([]);
    expect(sublistsForPage("materials")).toEqual([]);
  });

  it("derives from the recorded paths, so a sublist joins by being given one", () => {
    // The guard against a second hand-written map: every sublist's path must
    // be some page's path plus a fragment, or it silently belongs to nothing.
    const pagePaths = new Set(
      SECTION_PAGES.filter((k) => !SUBLIST_PAGES.has(k)).map(
        (k) => PAGE_SECTION_LABELS[k].path,
      ),
    );
    for (const key of SUBLIST_PAGES) {
      const [parent, fragment] = PAGE_SECTION_LABELS[key].path.split("#");
      expect(fragment, `${key} needs a fragment path`).toBeTruthy();
      expect(pagePaths.has(parent), `${key} → ${parent}`).toBe(true);
    }
  });
});
