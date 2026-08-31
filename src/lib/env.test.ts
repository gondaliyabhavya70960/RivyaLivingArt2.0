import { describe, expect, it, vi } from "vitest";

import { withoutBlanks } from "@/lib/env";

/**
 * A blank environment variable cost a production deploy.
 *
 * `NEXT_PUBLIC_SITE_URL` is declared `z.string().url().optional()`. Adding the
 * key in a hosting dashboard without a value delivers `""` — a string, so
 * `.optional()` (which admits only `undefined`) does not apply, `.url()` runs
 * against the empty value, and the build dies with `Invalid URL`: a message
 * describing a malformed value rather than a missing one.
 *
 * These assertions pin the fix at the boundary, because the failure mode is
 * silent in every local run — a developer's shell simply has no such key.
 */
describe("withoutBlanks", () => {
  it("drops a key declared with an empty value", () => {
    expect(withoutBlanks({ NEXT_PUBLIC_SITE_URL: "" })).toEqual({});
  });

  it("drops whitespace-only values, which read as blank in a dashboard", () => {
    expect(withoutBlanks({ A: " ", B: "\t", C: "\n" })).toEqual({});
  });

  it("keeps real values untouched, including ones with surrounding meaning", () => {
    expect(
      withoutBlanks({
        NEXT_PUBLIC_SITE_URL: "https://www.rivyalivingart.com",
        AUTH_TRUST_HOST: "true",
        VERCEL: "1",
      }),
    ).toEqual({
      NEXT_PUBLIC_SITE_URL: "https://www.rivyalivingart.com",
      AUTH_TRUST_HOST: "true",
      VERCEL: "1",
    });
  });

  it("does not trim the values it keeps", () => {
    // Only the blank TEST is trim-based; a value that merely has padding is
    // still the operator's value and must reach the validator intact.
    expect(withoutBlanks({ A: " padded " })).toEqual({ A: " padded " });
  });

  it("ignores undefined entries without inventing keys", () => {
    expect(withoutBlanks({ A: undefined, B: "x" })).toEqual({ B: "x" });
  });

  it("turns a blank REQUIRED var into a missing one, so the error names it", () => {
    // Before the fix, a blank DATABASE_URL failed `.min(1)` with a length
    // complaint. Absent, it reports "DATABASE_URL is required", which is the
    // message an operator can act on.
    expect(withoutBlanks({ DATABASE_URL: "" })).not.toHaveProperty(
      "DATABASE_URL",
    );
  });
});

/**
 * The same blank-variable trap, in the one place a green build hides it.
 *
 * `src/lib/constants.ts` cannot import the server-only env module, so it
 * repeats the rule locally. It used `??`, which keeps `""` — meaning a blank
 * `NEXT_PUBLIC_SITE_URL` produced `SITE.url === ""` (breaking canonicals, OG
 * cards, the sitemap and `metadataBase`) and a blank
 * `NEXT_PUBLIC_WHATSAPP_NUMBER` produced an empty `wa.me` link, which on a
 * WhatsApp-only business is the whole conversion path — with a passing build
 * either way.
 *
 * These read the module fresh per case, because the values are captured at
 * module load from the build-time inlined `process.env`.
 */
describe("SITE public-value fallbacks", () => {
  const load = async (env: Record<string, string | undefined>) => {
    const previous = { ...process.env };
    Object.assign(process.env, env);
    vi.resetModules();
    try {
      return (await import("@/lib/constants")).SITE;
    } finally {
      process.env = previous;
    }
  };

  it("falls back when the variables are blank, not just absent", async () => {
    const site = await load({
      NEXT_PUBLIC_SITE_URL: "",
      NEXT_PUBLIC_WHATSAPP_NUMBER: "",
    });
    expect(site.url).toBe("https://www.rivyalivingart.com");
    expect(site.whatsappNumber).toBe("917096036250");
  });

  it("still prefers a real value", async () => {
    const site = await load({
      NEXT_PUBLIC_SITE_URL: "https://preview.example.com",
      NEXT_PUBLIC_WHATSAPP_NUMBER: "911234567890",
    });
    expect(site.url).toBe("https://preview.example.com");
    expect(site.whatsappNumber).toBe("911234567890");
  });

  it("strips trailing slashes, because ~30 call sites append their own", async () => {
    // A URL entered as it appears in a browser address bar. This shipped: the
    // live homepage carried 14 double slashes, including the JSON-LD @ids for
    // #organization, #website and #localbusiness — identifiers whose whole
    // job is to be referenced by other nodes in the graph.
    for (const given of [
      "https://example.com/",
      "https://example.com//",
      "https://example.com///",
    ]) {
      const site = await load({ NEXT_PUBLIC_SITE_URL: given });
      expect(site.url).toBe("https://example.com");
      expect(`${site.url}/#organization`).toBe("https://example.com/#organization");
    }
  });

  it("leaves a correctly-formed origin alone", async () => {
    const site = await load({ NEXT_PUBLIC_SITE_URL: "https://example.com" });
    expect(site.url).toBe("https://example.com");
  });

  it("never yields an empty url or number, whatever the input", async () => {
    for (const blank of ["", " ", "\t"]) {
      const site = await load({
        NEXT_PUBLIC_SITE_URL: blank,
        NEXT_PUBLIC_WHATSAPP_NUMBER: blank,
      });
      expect(site.url).not.toBe("");
      expect(site.whatsappNumber).not.toBe("");
    }
  });
});
