/**
 * Markup-shape detection gates (docs/adapter-acceptance-checklist.md §D).
 * Fixture files only — no network, ever.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  detectMarkupShape,
  mapPageByShape,
} from "@/lib/scraper/adapters/markup-shape";

const CTX = { sourceKey: "fixture-source", vertical: "resin-art" };
const URL_BASE = "https://source.example";

function fixture(name: string): string {
  return readFileSync(
    new URL(`./__fixtures__/${name}`, import.meta.url),
    "utf8",
  );
}

describe("detectMarkupShape", () => {
  it("routes a product page with commerce markup and a price to PRICED_STORE", () => {
    expect(detectMarkupShape(fixture("priced-store-variant-json.html"))).toBe(
      "PRICED_STORE",
    );
    expect(detectMarkupShape(fixture("priced-store-range.html"))).toBe(
      "PRICED_STORE",
    );
  });

  it("routes a priced page carrying a quote phrase to PRICED_STORE — the price is markup fact, the phrase decides the basis downstream", () => {
    expect(detectMarkupShape(fixture("priced-store-quote-phrase.html"))).toBe(
      "PRICED_STORE",
    );
  });

  it("routes a bespoke piece page with a quote CTA and specs to QUOTE_STUDIO", () => {
    expect(detectMarkupShape(fixture("quote-studio-piece.html"))).toBe(
      "QUOTE_STUDIO",
    );
    expect(detectMarkupShape(fixture("quote-studio-microdata.html"))).toBe(
      "QUOTE_STUDIO",
    );
  });

  it("gate D1: a blog post is NONE even when its prose mentions a price", () => {
    expect(detectMarkupShape(fixture("blog-post.html"))).toBe("NONE");
  });

  it("gate D3: a listing page is NONE even with price text and product ids on every card", () => {
    expect(detectMarkupShape(fixture("listing-page.html"))).toBe("NONE");
  });

  it("gate E1: malformed HTML is NONE, never a throw", () => {
    expect(() => detectMarkupShape(fixture("malformed.html"))).not.toThrow();
    expect(detectMarkupShape(fixture("malformed.html"))).toBe("NONE");
  });

  it("an empty page is NONE", () => {
    expect(detectMarkupShape("")).toBe("NONE");
  });
});

describe("mapPageByShape", () => {
  it("dispatches each shape to its mapper", () => {
    const priced = mapPageByShape(
      fixture("priced-store-variant-json.html"),
      `${URL_BASE}/product/river-oak-console/`,
      CTX,
    );
    expect(priced?.title).toBe("River Oak Console Table");

    const quote = mapPageByShape(
      fixture("quote-studio-piece.html"),
      `${URL_BASE}/works/monsoon-river-console/`,
      CTX,
    );
    expect(quote?.title).toBe("Monsoon River Console");
  });

  it("NONE yields null — staging hears nothing about a non-product page", () => {
    for (const name of ["blog-post.html", "listing-page.html", "malformed.html"]) {
      expect(
        mapPageByShape(fixture(name), `${URL_BASE}/some-page/`, CTX),
      ).toBeNull();
    }
  });
});
