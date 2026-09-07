import { describe, expect, it } from "vitest";
import {
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
