import { describe, expect, it } from "vitest";
import {
  coerceDraftValues,
  draftStorageKey,
  parseDraft,
  sameDraftValues,
  serializeDraft,
} from "./local-draft";

describe("draftStorageKey", () => {
  it("scopes the key to entity and row id", () => {
    expect(draftStorageKey("product", "abc123")).toBe(
      "studio:draft:product:abc123",
    );
  });

  it("uses 'new' for an absent id (the create form)", () => {
    expect(draftStorageKey("blog", undefined)).toBe("studio:draft:blog:new");
  });
});

describe("serializeDraft / parseDraft", () => {
  it("round-trips values and the saved-at timestamp", () => {
    const raw = serializeDraft({ title: "Ocean Wave Tray" }, 1_700_000_000_000);
    expect(parseDraft<{ title: string }>(raw)).toEqual({
      savedAt: 1_700_000_000_000,
      values: { title: "Ocean Wave Tray" },
    });
  });

  it("defaults savedAt to now when omitted", () => {
    const before = Date.now();
    const raw = serializeDraft({ a: 1 });
    const record = parseDraft<{ a: number }>(raw);
    expect(record?.savedAt).toBeGreaterThanOrEqual(before);
  });

  it("returns null for a null input", () => {
    expect(parseDraft(null)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseDraft("{not json")).toBeNull();
  });

  it("returns null for a JSON array", () => {
    expect(parseDraft("[1,2,3]")).toBeNull();
  });

  it("returns null when savedAt is missing or the wrong type", () => {
    expect(parseDraft(JSON.stringify({ values: { a: 1 } }))).toBeNull();
    expect(
      parseDraft(JSON.stringify({ savedAt: "yesterday", values: { a: 1 } })),
    ).toBeNull();
  });

  it("returns null when values is missing", () => {
    expect(parseDraft(JSON.stringify({ savedAt: 1 }))).toBeNull();
  });
});

describe("sameDraftValues", () => {
  it("treats key order as irrelevant and nested objects deeply", () => {
    expect(
      sameDraftValues(
        { a: 1, t: { hi: { name: "x" }, ar: { name: "y" } } },
        { t: { ar: { name: "y" }, hi: { name: "x" } }, a: 1 },
      ),
    ).toBe(true);
  });

  it("ignores keys holding undefined, as JSON does", () => {
    expect(sameDraftValues({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameDraftValues({ a: 1, b: null }, { a: 1 })).toBe(false);
  });

  it("keeps array order — a reordered list is an edit", () => {
    expect(sameDraftValues({ tags: ["a", "b"] }, { tags: ["a", "b"] })).toBe(
      true,
    );
    expect(sameDraftValues({ tags: ["a", "b"] }, { tags: ["b", "a"] })).toBe(
      false,
    );
    expect(sameDraftValues([1], { 0: 1 })).toBe(false);
  });

  it("compares primitives with Object.is", () => {
    expect(sameDraftValues("a", "a")).toBe(true);
    expect(sameDraftValues("a", "b")).toBe(false);
    expect(sameDraftValues(true, "true")).toBe(false);
    expect(sameDraftValues(null, undefined)).toBe(false);
  });

  it("sees a single changed field in a wide record", () => {
    const initial = { name: "Vases", visible: true, seo: "" };
    expect(sameDraftValues({ ...initial }, initial)).toBe(true);
    expect(sameDraftValues({ ...initial, visible: false }, initial)).toBe(
      false,
    );
  });
});

describe("coerceDraftValues", () => {
  const baseline = {
    name: "Vases",
    description: "",
    visible: true,
    tags: [] as string[],
    translations: {} as Record<string, unknown>,
  };

  it("returns the baseline untouched for anything that is not an object", () => {
    expect(coerceDraftValues(baseline, null)).toEqual(baseline);
    expect(coerceDraftValues(baseline, "x")).toEqual(baseline);
    expect(coerceDraftValues(baseline, [])).toEqual(baseline);
  });

  it("drops a key the form no longer has", () => {
    const out = coerceDraftValues(baseline, { ...baseline, retired: "old" });
    expect(out).toEqual(baseline);
    expect("retired" in out).toBe(false);
  });

  it("fills a key the draft lacks or holds as undefined from the baseline", () => {
    expect(
      coerceDraftValues(baseline, { name: "Trays", visible: undefined }),
    ).toEqual({ ...baseline, name: "Trays" });
  });

  it("keeps the baseline where the stored kind differs", () => {
    expect(
      coerceDraftValues(baseline, {
        visible: "yes",
        tags: "a,b",
        name: 7,
        description: null,
      }),
    ).toEqual(baseline);
  });

  it("takes a stored value when the baseline says nothing about its kind", () => {
    const loose = {
      note: undefined as string | undefined,
      link: null as unknown,
    };
    expect(coerceDraftValues(loose, { note: "n", link: { id: "x" } })).toEqual({
      note: "n",
      link: { id: "x" },
    });
  });

  it("lets a nested record replace an empty one and a string survive", () => {
    const out = coerceDraftValues(baseline, {
      translations: { hi: { name: "x" } },
      description: "d",
      tags: ["a"],
    });
    expect(out.translations).toEqual({ hi: { name: "x" } });
    expect(out.description).toBe("d");
    expect(out.tags).toEqual(["a"]);
  });

  it("is draft-equal to the baseline when nothing stored survived", () => {
    const out = coerceDraftValues(baseline, { visible: "yes", gone: 1 });
    expect(sameDraftValues(out, baseline)).toBe(true);
  });
});
