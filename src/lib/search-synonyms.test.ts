import { describe, expect, it } from "vitest";

import { expandQueryTerms } from "@/lib/search-synonyms";

describe("expandQueryTerms", () => {
  it("keeps the original query as the first term", () => {
    expect(expandQueryTerms("blue tray")[0]).toBe("blue tray");
  });

  it("expands buyer vocabulary to studio vocabulary", () => {
    expect(expandQueryTerms("epoxy")).toEqual(["epoxy", "resin"]);
  });

  it("expands studio vocabulary back to buyer vocabulary", () => {
    expect(expandQueryTerms("resin")).toEqual(["resin", "epoxy"]);
  });

  it("expands per word inside a phrase", () => {
    expect(expandQueryTerms("geode tray")).toEqual(["geode tray", "agate"]);
  });

  it("is case-insensitive on the synonym lookup", () => {
    expect(expandQueryTerms("PLA")).toContain("filament");
  });

  it("dedupes when the query already contains its synonym", () => {
    const terms = expandQueryTerms("epoxy");
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("returns just the query when no vocabulary matches", () => {
    expect(expandQueryTerms("varmala frame gold")).toEqual([
      "varmala frame gold",
      "garland",
    ]);
    expect(expandQueryTerms("clock")).toEqual(["clock"]);
  });
});
