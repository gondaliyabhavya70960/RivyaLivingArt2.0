/**
 * Priced-store mapper against the acceptance checklist — fixtures only.
 * docs/adapter-acceptance-checklist.md gates are named per test.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { mapPricedStorePage } from "@/lib/scraper/adapters/priced-store";
import {
  derivePriceBasis,
  priceForBasis,
  toMinorUnits,
} from "@/lib/scraper/price-basis";

const CTX = { sourceKey: "fixture-store", vertical: "resin-art" };

function fixture(name: string): string {
  return readFileSync(
    new URL(`./__fixtures__/${name}`, import.meta.url),
    "utf8",
  );
}

describe("mapPricedStorePage — variant JSON fixture", () => {
  const url = "https://store.example/product/river-oak-console/";
  const product = mapPricedStorePage(fixture("priced-store-variant-json.html"), url, CTX);

  it("maps the identity fields (A1: sku beats title as externalId)", () => {
    expect(product).not.toBeNull();
    expect(product!.externalId).toBe("WRC-CONSOLE-001");
    expect(product!.title).toBe("River Oak Console Table");
    expect(product!.slug).toBe("river-oak-console");
    expect(product!.url).toBe(url);
    expect(product!.sourceKey).toBe("fixture-store");
    expect(product!.currency).toBe("INR");
  });

  it("emits one variant per published option, with axes named (B4)", () => {
    expect(product!.variants).toHaveLength(2);
    expect(product!.variants![0]).toMatchObject({
      label: "Small",
      options: { size: "Small" },
      priceMajor: 1499,
      available: true,
    });
    expect(product!.variants![1]).toMatchObject({
      label: "Large",
      options: { size: "Large" },
      priceMajor: 2999,
      available: false,
    });
  });

  it("takes the product price range from the variants, not the display price", () => {
    expect(product!.priceMin).toBe(1499);
    expect(product!.priceMax).toBe(2999);
  });

  it("collects gallery images absolutized, with alts (C1)", () => {
    expect(product!.images).toContain(
      "https://store.example/wp-content/uploads/river-oak-console-1.jpg",
    );
    expect(product!.images.length).toBeGreaterThanOrEqual(2);
    expect(
      product!.imageAlts[product!.images.indexOf(
        "https://store.example/wp-content/uploads/river-oak-console-2.jpg",
      )],
    ).toBe("Amber pour detail");
  });

  it("reads availability markup honestly (C2)", () => {
    // InStock on the page, second variant explicitly out of stock.
    expect(product!.status).toBe("active");
  });
});

describe("mapPricedStorePage — ranged price fixture", () => {
  const product = mapPricedStorePage(
    fixture("priced-store-range.html"),
    "https://royale.example/product/ocean-epoxy-flooring/",
    CTX,
  );

  it("a range becomes floor and ceiling rows, never a midpoint (B4)", () => {
    expect(product).not.toBeNull();
    expect(product!.variants).toEqual([
      { label: "from", priceMajor: 2400 },
      { label: "to", priceMajor: 4800 },
    ]);
    expect(product!.priceMin).toBe(2400);
    expect(product!.priceMax).toBe(4800);
  });

  it("keeps the 'per sq ft' basis text reachable for derivation (B3)", () => {
    // The same text assembly the job runner's variantRowsFor performs.
    const text = [product!.title, product!.shortTagline, product!.description]
      .filter(Boolean)
      .join(" \n ");
    const basis = derivePriceBasis({
      priceMinor: toMinorUnits(product!.priceMin!),
      text,
    });
    expect(basis).toBe("PER_AREA");
  });
});

describe("mapPricedStorePage — quote phrase beside a placeholder price", () => {
  it("gate B2: the phrase wins over the ₹1 placeholder, downstream stores NULL", () => {
    const product = mapPricedStorePage(
      fixture("priced-store-quote-phrase.html"),
      "https://atelier.example/work/nebula-wall-panel/",
      CTX,
    );
    expect(product).not.toBeNull();
    // The mapper reports what the markup says — ₹1 is a markup fact…
    expect(product!.variants).toEqual([{ priceMajor: 1 }]);
    // …and the phrase it preserved in shortTagline is what flips the basis at
    // persistence (the same text assembly variantRowsFor performs):
    const text = [product!.title, product!.shortTagline, product!.description]
      .filter(Boolean)
      .join(" \n ");
    const basis = derivePriceBasis({
      priceMinor: toMinorUnits(product!.variants![0]!.priceMajor),
      text,
    });
    expect(basis).toBe("QUOTE_ONLY");
    expect(priceForBasis(basis, toMinorUnits(1))).toBeNull();
  });
});

describe("mapPricedStorePage — negative gates", () => {
  it("D1: non-product pages yield null", () => {
    for (const name of ["blog-post.html", "listing-page.html", "malformed.html"]) {
      expect(
        mapPricedStorePage(fixture(name), "https://x.example/page/", CTX),
      ).toBeNull();
    }
  });

  it("B1: a page with no declared price is not a priced-store product", () => {
    expect(
      mapPricedStorePage(
        fixture("quote-studio-piece.html"),
        "https://x.example/piece/",
        CTX,
      ),
    ).toBeNull();
  });
});
