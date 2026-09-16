/**
 * Quote-studio mapper against the acceptance checklist — fixtures only.
 * The load-bearing test is B1: quote-only never becomes a number.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { mapQuoteStudioPage } from "@/lib/scraper/adapters/quote-studio";
import {
  derivePriceBasis,
  priceForBasis,
  toMinorUnits,
} from "@/lib/scraper/price-basis";

const CTX = { sourceKey: "fixture-studio", vertical: "resin-art" };

function fixture(name: string): string {
  return readFileSync(
    new URL(`./__fixtures__/${name}`, import.meta.url),
    "utf8",
  );
}

describe("mapQuoteStudioPage — bespoke piece fixture", () => {
  const url = "https://studio.example/works/monsoon-river-console/";
  const product = mapQuoteStudioPage(fixture("quote-studio-piece.html"), url, CTX);

  it("maps the piece with its path slug as identity (A1)", () => {
    expect(product).not.toBeNull();
    expect(product!.externalId).toBe("monsoon-river-console");
    expect(product!.title).toBe("Monsoon River Console");
    expect(product!.url).toBe(url);
  });

  it("gate B1 end to end: one variant, NULL price → QUOTE_ONLY → stored NULL", () => {
    expect(product!.variants).toEqual([{ priceMajor: null }]);
    expect(product!.showPrice).toBe(false);
    const text = [product!.title, product!.description].join(" \n ");
    const basis = derivePriceBasis({
      priceMinor: toMinorUnits(product!.variants![0]!.priceMajor),
      text,
    });
    expect(basis).toBe("QUOTE_ONLY");
    expect(priceForBasis(basis, null)).toBeNull();
    // The defect this whole module exists to prevent, asserted directly:
    expect(priceForBasis(basis, null)).not.toBe(0);
  });

  it("reads the spec list into structured fields (C3)", () => {
    expect(product!.dimensions).toBe("1200 × 450 × 780 mm");
    expect(product!.materials).toBe(
      "Reclaimed teak, deep-pour epoxy resin, brass inlay",
    );
    expect(product!.timeline).toBe("6–8 weeks");
    expect(product!.fields.specs).toMatchObject({
      finish: "Hand-polished gloss, UV-stable topcoat",
    });
    expect(product!.fields.enquiryPhrase).toMatch(/request a quote/i);
  });

  it("collects the gallery (C1)", () => {
    expect(product!.images.length).toBeGreaterThanOrEqual(4);
    expect(product!.images[0]).toBe(
      "https://studio.example/images/monsoon-river-console/hero.jpg",
    );
  });
});

describe("mapQuoteStudioPage — microdata piece fixture", () => {
  it("maps a schema-typed page that publishes no price", () => {
    const product = mapQuoteStudioPage(
      fixture("quote-studio-microdata.html"),
      "https://memories.example/work/varmala-preservation-frame/",
      CTX,
    );
    expect(product).not.toBeNull();
    expect(product!.title).toBe("Varmala Preservation Frame");
    expect(product!.dimensions).toBe("16 × 20 in");
    expect(product!.variants).toEqual([{ priceMajor: null }]);
  });
});

describe("mapQuoteStudioPage — negative gates", () => {
  it("D1: non-product pages yield null", () => {
    for (const name of ["blog-post.html", "listing-page.html", "malformed.html"]) {
      expect(
        mapQuoteStudioPage(fixture(name), "https://x.example/page/", CTX),
      ).toBeNull();
    }
  });

  it("a page WITH a published price is not this shape — routing it here would turn a real price into quote-only", () => {
    expect(
      mapQuoteStudioPage(
        fixture("priced-store-variant-json.html"),
        "https://x.example/product/x/",
        CTX,
      ),
    ).toBeNull();
  });

  it("a price-less page with no quote language is not evidence of anything", () => {
    expect(
      mapQuoteStudioPage(
        `<html><body><h1>About the studio</h1><p>We make things.</p></body></html>`,
        "https://x.example/about/",
        CTX,
      ),
    ).toBeNull();
  });
});
