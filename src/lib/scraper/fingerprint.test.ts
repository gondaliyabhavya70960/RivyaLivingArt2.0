import { describe, expect, it } from "vitest";

import { shopifyEndpointBase } from "@/lib/scraper/adapters/shopify";
import { normalizeBaseUrl, normalizePageUrl } from "@/lib/scraper/fingerprint";

/**
 * The two normalisers answer different questions. `normalizeBaseUrl` names a
 * SITE and is what sources, fingerprints and the robots gate key on.
 * `normalizePageUrl` names a PAGE and is what a CATEGORY or URL scoped job
 * hands its adapter. The runner used the first for both until the plan audit
 * of 2026-09-04: a category job for ".../collections/vases" was reduced to
 * "https://shop" and crawled the whole store.
 */
describe("normalizeBaseUrl", () => {
  it("reduces any URL on a site to its origin", () => {
    expect(normalizeBaseUrl("https://Shop.Example.com/collections/vases?sort=x#top")).toBe(
      "https://shop.example.com",
    );
    expect(normalizeBaseUrl("shop.example.com/products/a")).toBe("https://shop.example.com");
  });
});

describe("normalizePageUrl", () => {
  it("keeps the path and query, drops the hash, trims trailing slashes", () => {
    expect(normalizePageUrl("https://shop.example.com/collections/vases/")).toBe(
      "https://shop.example.com/collections/vases",
    );
    expect(normalizePageUrl("shop.example.com/collections/vases?sort_by=price#grid")).toBe(
      "https://shop.example.com/collections/vases?sort_by=price",
    );
    expect(normalizePageUrl("https://shop.example.com/products/geode-tray")).toBe(
      "https://shop.example.com/products/geode-tray",
    );
  });

  it("is the identity on a bare origin, so a SOURCE job is unaffected", () => {
    expect(normalizePageUrl("https://shop.example.com")).toBe("https://shop.example.com");
    expect(normalizePageUrl("https://shop.example.com/")).toBe("https://shop.example.com");
  });

  it("differs from normalizeBaseUrl exactly by the page", () => {
    const page = "https://shop.example.com/collections/vases";
    expect(normalizeBaseUrl(page)).toBe("https://shop.example.com");
    expect(normalizePageUrl(page)).toBe(page);
  });
});

describe("shopifyEndpointBase", () => {
  it("keeps the collection path and drops the query for a CATEGORY job", () => {
    expect(
      shopifyEndpointBase("https://shop.example.com/collections/vases?sort_by=price", "CATEGORY"),
    ).toBe("https://shop.example.com/collections/vases");
  });

  it("leaves a SOURCE job's origin alone", () => {
    expect(shopifyEndpointBase("https://shop.example.com", "SOURCE")).toBe(
      "https://shop.example.com",
    );
    expect(shopifyEndpointBase("https://shop.example.com", undefined)).toBe(
      "https://shop.example.com",
    );
  });
});
