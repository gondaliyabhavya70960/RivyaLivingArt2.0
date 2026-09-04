import { describe, expect, it } from "vitest";

import {
  canonicalizeUrl,
  normalizeColour,
  normalizeMaterial,
  normalizeUnit,
} from "@/lib/scraper/normalize";

describe("normalizeMaterial", () => {
  it("returns null for empty or missing input", () => {
    expect(normalizeMaterial(null)).toBeNull();
    expect(normalizeMaterial(undefined)).toBeNull();
    expect(normalizeMaterial("")).toBeNull();
    expect(normalizeMaterial("   ")).toBeNull();
  });

  it("aliases a single known token to its canonical spelling", () => {
    expect(normalizeMaterial("epoxy resin")).toBe("Epoxy Resin");
    expect(normalizeMaterial("EPOXY RESIN")).toBe("Epoxy Resin");
    expect(normalizeMaterial("mdf")).toBe("MDF");
  });

  it("splits a delimited list on comma, slash, ampersand and 'and'", () => {
    expect(normalizeMaterial("wood, resin")).toBe("Wood, Resin");
    expect(normalizeMaterial("wood/resin")).toBe("Wood, Resin");
    expect(normalizeMaterial("wood & resin")).toBe("Wood, Resin");
    expect(normalizeMaterial("wood and resin")).toBe("Wood, Resin");
  });

  it("title-cases an unrecognised token rather than dropping it", () => {
    expect(normalizeMaterial("driftwood")).toBe("Driftwood");
  });

  it("keeps a short all-caps unknown token as-is (e.g. an acronym)", () => {
    expect(normalizeMaterial("PVC")).toBe("PVC");
  });

  it("dedupes repeated tokens after aliasing", () => {
    expect(normalizeMaterial("resin, Resin, RESIN")).toBe("Resin");
  });

  it("never appears in contentHash's input set", () => {
    // hash.ts hashes title/priceMin/priceMax/status/images only — asserted
    // here as documentation the module's own header promises, not by
    // importing hash.ts (which would make this a change-detector on an
    // unrelated file).
    const before = normalizeMaterial("wood");
    expect(before).not.toContain("title");
  });
});

describe("normalizeColour", () => {
  it("returns null for empty or missing input", () => {
    expect(normalizeColour(null)).toBeNull();
    expect(normalizeColour("")).toBeNull();
  });

  it("aliases known shades and finish words", () => {
    expect(normalizeColour("rose gold")).toBe("Rose Gold");
    expect(normalizeColour("ROSE-GOLD")).toBe("Rose Gold");
    expect(normalizeColour("golden")).toBe("Gold");
    expect(normalizeColour("transparent")).toBe("Clear");
  });

  it("splits and dedupes a delimited list", () => {
    expect(normalizeColour("blue, Blue, navy")).toBe("Blue, Navy");
  });

  it("title-cases an unrecognised colour", () => {
    expect(normalizeColour("periwinkle")).toBe("Periwinkle");
  });
});

describe("normalizeUnit", () => {
  it("returns null for empty or missing input", () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit("")).toBeNull();
  });

  it("replaces unit words inside free-text dimensions", () => {
    expect(normalizeUnit("10 x 12 inches")).toBe("10 x 12 in");
    expect(normalizeUnit("10 x 12 x 3 centimeters")).toBe("10 x 12 x 3 cm");
  });

  it("is case-insensitive and matches multiple occurrences", () => {
    expect(normalizeUnit("12 Inches x 8 INCHES")).toBe("12 in x 8 in");
  });

  it("leaves the rest of the phrase untouched", () => {
    expect(normalizeUnit("approx. 10 x 12 in, gift-boxed")).toBe(
      "approx. 10 x 12 in, gift-boxed",
    );
  });

  it("never eats a unit word inside a longer word", () => {
    // "in" must not match inside "inlay".
    expect(normalizeUnit("10 in inlay finish")).toBe("10 in inlay finish");
  });

  it("prefers the longer alias match (grams before g would be wrong either way, but centimetre vs centimeter)", () => {
    expect(normalizeUnit("5 centimetres")).toBe("5 cm");
  });

  it("passes through a phrase with no recognised unit unchanged", () => {
    expect(normalizeUnit("one of a kind")).toBe("one of a kind");
  });
});

describe("canonicalizeUrl", () => {
  it("lowercases the host", () => {
    expect(canonicalizeUrl("https://EXAMPLE.com/product/x")).toBe(
      "https://example.com/product/x",
    );
  });

  it("strips utm_* params", () => {
    expect(
      canonicalizeUrl(
        "https://example.com/p/x?utm_source=ig&utm_medium=social",
      ),
    ).toBe("https://example.com/p/x");
  });

  it("strips fbclid and gclid", () => {
    expect(canonicalizeUrl("https://example.com/p/x?fbclid=abc")).toBe(
      "https://example.com/p/x",
    );
    expect(canonicalizeUrl("https://example.com/p/x?gclid=abc")).toBe(
      "https://example.com/p/x",
    );
  });

  it("sorts the remaining query params", () => {
    expect(canonicalizeUrl("https://example.com/p?b=2&a=1")).toBe(
      "https://example.com/p?a=1&b=2",
    );
  });

  it("keeps meaningful params alongside stripping tracking ones", () => {
    expect(
      canonicalizeUrl("https://example.com/p?variant=42&utm_source=ig"),
    ).toBe("https://example.com/p?variant=42");
  });

  it("removes a trailing slash from the path", () => {
    expect(canonicalizeUrl("https://example.com/product/x/")).toBe(
      "https://example.com/product/x",
    );
  });

  it("keeps the root path as '/' rather than stripping it to nothing", () => {
    expect(canonicalizeUrl("https://example.com/")).toBe(
      "https://example.com/",
    );
  });

  it("two URLs differing only in tracking noise canonicalize identically", () => {
    const a = canonicalizeUrl("https://Example.com/p/x/?utm_source=ig");
    const b = canonicalizeUrl("https://example.com/p/x?fbclid=zzz");
    expect(a).toBe(b);
  });

  it("returns malformed input unchanged rather than throwing", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
  });
});
