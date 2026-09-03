import { describe, expect, it } from "vitest";

import {
  CUSTOM_BLOCKS,
  CUSTOM_BLOCK_TYPES,
  defaultBlockData,
  describeBlockArrangementNotice,
  describeBlockArrangementProblem,
  describeBlockDataProblem,
  isCustomBlockType,
  parseBlockData,
  resolveBlockGrounds,
  resolveHeadingLevels,
  type CustomBlockType,
} from "./custom-blocks";
import { applyBlockTranslations, isLive, scheduleState } from "./custom-pages";

const block = (type: CustomBlockType, data?: unknown) => ({ type, data });

describe("the block catalogue", () => {
  it("stays small", () => {
    // Not a style preference — the catalogue's size is the only thing standing
    // between a page an owner assembles and layout rot (§4.8). Growing it is a
    // decision, and this test is where the decision gets made out loud.
    //
    // 7, not 6 (2026-09-03): `collectionGrid` — a row of collections picked
    // by hand, reusing `CollectionCard`'s existing doorway-tile grammar.
    // 8, not 7 (2026-09-03): `portfolioGrid` — real commissions, the newest
    // published cases or up to six the owner chose.
    // 9, not 8 (2026-09-03): `journalGrid` — the newest published posts,
    // across the journal or filtered to one category.
    // 10, not 9 (2026-09-03): `testimonial` — one customer's words, alone;
    // must be PUBLISHED and pass the demo gate at render time or it shows
    // nothing. The roadmap's Phase 11 block-catalogue growth adds ten types
    // in total, one per commit; this count keeps climbing through the rest
    // of the file's history.
    expect(CUSTOM_BLOCK_TYPES.length).toBe(10);
  });

  it("declares every type it lists", () => {
    for (const type of CUSTOM_BLOCK_TYPES) {
      const def = CUSTOM_BLOCKS[type];
      expect(def.type, type).toBe(type);
      expect(def.label, type).toBeTruthy();
      expect(def.description, type).toBeTruthy();
    }
  });

  it("recognises only the types it declares", () => {
    expect(isCustomBlockType("hero")).toBe(true);
    expect(isCustomBlockType("carousel")).toBe(false);
  });

  it("gives every type a default that its own schema accepts", () => {
    for (const type of CUSTOM_BLOCK_TYPES) {
      expect(describeBlockDataProblem(type, defaultBlockData(type)), type).toBe(
        null,
      );
    }
  });

  it("lets only the hero be dark", () => {
    // §3.1 is enforced by making the violation inexpressible; that only works
    // while the grounds stay declared this way. The closing band deliberately
    // has no dark option — the obsidian footer sits directly below it.
    const dark = CUSTOM_BLOCK_TYPES.filter(
      (t) => CUSTOM_BLOCKS[t].ground !== "alternating",
    );
    expect(dark).toEqual(["hero"]);
  });
});

describe("parsing a block's data", () => {
  it("fills in what a partial blob is missing", () => {
    const data = parseBlockData<{ headline: string; ctaHref: string }>("hero", {
      headline: "Diwali gifting",
    });
    expect(data.headline).toBe("Diwali gifting");
    expect(data.ctaHref).toBe("");
  });

  it("falls back to defaults rather than throwing on a bad blob", () => {
    // A row written by an older shape of the schema must not take a live page
    // down. It renders empty and is obvious in the studio.
    const data = parseBlockData<{ limit: number }>("productGrid", {
      limit: "lots",
    });
    expect(data.limit).toBe(4);
  });

  it("survives null and a non-object", () => {
    expect(parseBlockData("hero", null)).toBeTruthy();
    expect(parseBlockData("hero", "nope")).toBeTruthy();
  });

  it("refuses a link to a page the site does not have", () => {
    const problem = describeBlockDataProblem("hero", { ctaHref: "/diwali" });
    expect(problem).toMatch(/no page at \/diwali/);
  });

  it("accepts a link to another landing page", () => {
    expect(
      describeBlockDataProblem("hero", { ctaHref: "/p/diwali-2026" }),
    ).toBeNull();
  });

  it("accepts an external address and an empty one", () => {
    expect(
      describeBlockDataProblem("hero", { ctaHref: "https://example.com" }),
    ).toBeNull();
    expect(describeBlockDataProblem("hero", { ctaHref: "" })).toBeNull();
  });

  it("refuses a picture that is neither a path nor a URL", () => {
    expect(describeBlockDataProblem("hero", { image: "nope.jpg" })).toMatch(
      /library/,
    );
  });

  it("refuses more than six collections", () => {
    // Like the bad-blob case above: a seventh slug makes the whole blob
    // fail its own schema, so the block renders its (empty) defaults rather
    // than a silently truncated seven-turned-six list.
    const data = parseBlockData<{ slugs: string[] }>("collectionGrid", {
      slugs: ["a", "b", "c", "d", "e", "f", "g"],
    });
    expect(data.slugs).toEqual([]);
  });

  it("defaults every new block's spacing to standard", () => {
    expect(
      parseBlockData<{ spacing: string }>("collectionGrid", {}).spacing,
    ).toBe("standard");
  });
});

describe("the page's rhythm", () => {
  it("alternates the light grounds", () => {
    expect(
      resolveBlockGrounds([
        block("richText"),
        block("productGrid"),
        block("imageCta"),
      ]),
    ).toEqual(["mineral", "sand", "mineral"]);
  });

  it("keeps the hero dark and restarts the alternation after it", () => {
    expect(
      resolveBlockGrounds([
        block("hero"),
        block("richText"),
        block("productGrid"),
      ]),
    ).toEqual(["obsidian", "mineral", "sand"]);
  });

  it("gives the closing band a light ground whatever a stale row says", () => {
    // Old rows may still carry `dark: true` from before the switch was
    // removed. The ground comes from the catalogue, not the row, so they
    // render light rather than running into the footer.
    expect(
      resolveBlockGrounds([
        block("richText"),
        block("finalCta", { dark: true }),
      ]),
    ).toEqual(["mineral", "sand"]);
  });
});

describe("the arrangement guardrails", () => {
  it("allows a typical lander", () => {
    expect(
      describeBlockArrangementProblem([
        block("hero"),
        block("richText"),
        block("productGrid"),
        block("faqPicker"),
        block("finalCta"),
      ]),
    ).toBeNull();
  });

  it("allows an empty page", () => {
    expect(describeBlockArrangementProblem([])).toBeNull();
  });

  it("refuses a second hero", () => {
    expect(
      describeBlockArrangementProblem([block("hero"), block("hero")]),
    ).toMatch(/one hero/);
  });

  it("refuses a second closing invitation", () => {
    expect(
      describeBlockArrangementProblem([block("finalCta"), block("finalCta")]),
    ).toMatch(/one closing invitation/);
  });

  it("cannot produce two dark grounds edge to edge", () => {
    // The adjacency rule is still in `describeBlockArrangementProblem` as the
    // guard for a future block type, but today it is unreachable — and this is
    // why. Exactly one block paints dark, and it is `once`, so no arrangement
    // the catalogue can express puts two together.
    const darkTypes = CUSTOM_BLOCK_TYPES.filter(
      (t) => CUSTOM_BLOCKS[t].ground === "dark",
    );
    expect(darkTypes).toHaveLength(1);
    expect(CUSTOM_BLOCKS[darkTypes[0]].once).toBe(true);
  });
});

describe("the footer-adjacency notice", () => {
  it("warns when the page ends on a dark band", () => {
    // The obsidian footer sits directly below. This is the finding
    // scripts/redesign-audit.mjs reports as "the page's last band is dark and
    // runs straight into the obsidian footer".
    expect(describeBlockArrangementNotice([block("hero")])).toMatch(/footer/);
  });

  it("says nothing once a light block follows", () => {
    expect(
      describeBlockArrangementNotice([block("hero"), block("finalCta")]),
    ).toBeNull();
  });

  it("says nothing about an empty page", () => {
    expect(describeBlockArrangementNotice([])).toBeNull();
  });

  it("warns rather than refuses, so a hero can be added first", () => {
    // Refusing would mean an owner could not put a hero on an empty page.
    expect(describeBlockArrangementProblem([block("hero")])).toBeNull();
  });
});

describe("heading levels", () => {
  it("gives the hero the h1 and everything else an h2", () => {
    expect(
      resolveHeadingLevels([
        block("hero"),
        block("richText"),
        block("finalCta"),
      ]),
    ).toEqual(["h1", "h2", "h2"]);
  });

  it("promotes the first block when there is no hero", () => {
    // Part 17 wants one h1 per page. A lander built without a hero is still a
    // document, not a pile of h2s.
    expect(
      resolveHeadingLevels([block("richText"), block("productGrid")]),
    ).toEqual(["h1", "h2"]);
  });

  it("finds the hero wherever it sits", () => {
    expect(resolveHeadingLevels([block("richText"), block("hero")])).toEqual([
      "h2",
      "h1",
    ]);
  });

  it("returns nothing for an empty page", () => {
    expect(resolveHeadingLevels([])).toEqual([]);
  });
});

describe("when a page is live", () => {
  const at = (iso: string) => new Date(iso);
  const now = at("2026-11-08T06:30:00Z");

  it("keeps a draft invisible whatever its date says", () => {
    expect(isLive({ status: "DRAFT", publishAt: null }, now)).toBe(false);
    expect(
      isLive({ status: "DRAFT", publishAt: at("2020-01-01T00:00:00Z") }, now),
    ).toBe(false);
  });

  it("publishes immediately with no date", () => {
    expect(isLive({ status: "PUBLISHED", publishAt: null }, now)).toBe(true);
  });

  it("holds a published page until its moment", () => {
    const page = { status: "PUBLISHED", publishAt: at("2026-11-08T07:00:00Z") };
    expect(isLive(page, now)).toBe(false);
    expect(isLive(page, at("2026-11-08T07:00:00Z"))).toBe(true);
    expect(isLive(page, at("2026-11-08T07:00:01Z"))).toBe(true);
  });

  it("names the three states the studio shows", () => {
    expect(scheduleState({ status: "DRAFT", publishAt: null }, now)).toBe(
      "draft",
    );
    expect(scheduleState({ status: "PUBLISHED", publishAt: null }, now)).toBe(
      "live",
    );
    expect(
      scheduleState(
        { status: "PUBLISHED", publishAt: at("2026-12-01T00:00:00Z") },
        now,
      ),
    ).toBe("scheduled");
  });
});

describe("a block's per-locale text", () => {
  const base = { headline: "Diwali gifting", ctaHref: "/shop", limit: 4 };

  it("overlays a translation", () => {
    expect(
      applyBlockTranslations(base, { hi: { headline: "दिवाली उपहार" } }, "hi"),
    ).toMatchObject({ headline: "दिवाली उपहार", ctaHref: "/shop" });
  });

  it("falls back to English for a missing or blank override", () => {
    expect(applyBlockTranslations(base, { hi: {} }, "hi")).toMatchObject(base);
    expect(
      applyBlockTranslations(base, { hi: { headline: "   " } }, "hi"),
    ).toMatchObject(base);
    expect(applyBlockTranslations(base, { de: { headline: "x" } }, "hi")).toBe(
      base,
    );
  });

  it("refuses an override that would change a value's shape", () => {
    // A translator must not be able to take the renderer down by turning a
    // string into an object, or a number into a string.
    expect(
      applyBlockTranslations(base, { hi: { headline: { x: 1 } } }, "hi"),
    ).toMatchObject({ headline: "Diwali gifting" });
    expect(
      applyBlockTranslations(base, { hi: { limit: "many" } }, "hi"),
    ).toMatchObject({ limit: 4 });
  });

  it("carries a Tiptap document across", () => {
    const doc = { type: "doc", content: [] };
    const translated = { type: "doc", content: [{ type: "paragraph" }] };
    expect(
      applyBlockTranslations({ body: doc }, { hi: { body: translated } }, "hi"),
    ).toMatchObject({ body: translated });
  });

  it("returns the same reference when nothing applies", () => {
    expect(applyBlockTranslations(base, null, "hi")).toBe(base);
    expect(applyBlockTranslations(base, {}, "hi")).toBe(base);
  });
});
