import { describe, expect, it } from "vitest";

import { normalizeSiteUrl } from "@/lib/site-url";

/**
 * The regression these assertions exist for took production down.
 *
 * `NEXT_PUBLIC_SITE_URL` was set to the site's domain the way a hosting
 * dashboard displays it — no scheme. `src/lib/env.ts` validated it with
 * `z.string().url()`, which rejects that, and because `db.ts` imports `env`
 * the throw surfaced as `Failed to collect page data for
 * /[locale]/blog/[slug]/opengraph-image` and the deploy failed. Relaxing the
 * validator alone would not have been enough: `new URL(SITE.url)` in
 * `shared-metadata.ts` throws on the same value one build stage later.
 *
 * So the contract under test is repair, not rejection — and the blank cases
 * are kept alongside because both malformations arrive from the same place.
 */
describe("normalizeSiteUrl", () => {
  it("adds the scheme a dashboard-pasted host is missing", () => {
    // The exact shape that failed the 2026-09-07 production build.
    expect(normalizeSiteUrl("www.rivyalivingart.com")).toBe(
      "https://www.rivyalivingart.com",
    );
    // A subdomain host, to cover the case where the dashboard value has more
    // than two labels. It used to be the owner's previous store; that domain
    // is out of this repo entirely (2026-09-18), and a test fixture is still
    // a reference.
    expect(normalizeSiteUrl("shop.example.co.in")).toBe(
      "https://shop.example.co.in",
    );
  });

  it("leaves a correctly-formed origin alone", () => {
    expect(normalizeSiteUrl("https://www.rivyalivingart.com")).toBe(
      "https://www.rivyalivingart.com",
    );
    expect(normalizeSiteUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it("assumes http for a local dev host, which is what INSTALL.md documents", () => {
    expect(normalizeSiteUrl("localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeSiteUrl("127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });

  it("strips trailing slashes, because ~30 call sites append their own", () => {
    for (const given of [
      "https://example.com/",
      "https://example.com//",
      "https://example.com///",
      "example.com/",
    ]) {
      expect(normalizeSiteUrl(given)).toBe("https://example.com");
    }
  });

  it("keeps a base path but drops a query or hash", () => {
    // A path can legitimately be part of the origin a site is served from;
    // a query string cannot mean anything as the base of a canonical.
    expect(normalizeSiteUrl("https://example.com/shop/")).toBe(
      "https://example.com/shop",
    );
    expect(normalizeSiteUrl("https://example.com?utm=1")).toBe(
      "https://example.com",
    );
    expect(normalizeSiteUrl("https://example.com#top")).toBe(
      "https://example.com",
    );
  });

  it("trims surrounding whitespace before deciding anything", () => {
    expect(normalizeSiteUrl("  https://example.com  ")).toBe(
      "https://example.com",
    );
    expect(normalizeSiteUrl("\nexample.com\n")).toBe("https://example.com");
  });

  it("reports absent and blank as unset, so the caller's fallback applies", () => {
    for (const given of [undefined, "", " ", "\t", "\n"]) {
      expect(normalizeSiteUrl(given)).toBeUndefined();
    }
  });

  it("reports a value beyond repair as unset rather than throwing", () => {
    // Each of these would otherwise reach `new URL(SITE.url)` in
    // shared-metadata.ts and take the build down.
    for (const given of [
      "https://",
      "https:// ",
      "https://a b.com",
      "mailto:hi@example.com",
      "ftp://example.com",
      "/relative/path",
    ]) {
      expect(normalizeSiteUrl(given)).toBeUndefined();
    }
  });

  it("returns something new URL() always accepts", () => {
    for (const given of [
      "www.rivyalivingart.com",
      "https://example.com/",
      "localhost:3000",
      "https:////www.example.com",
    ]) {
      const normalized = normalizeSiteUrl(given);
      expect(normalized).toBeTypeOf("string");
      // metadataBase does exactly this, on every build.
      expect(() => new URL(normalized as string)).not.toThrow();
    }
  });
});
