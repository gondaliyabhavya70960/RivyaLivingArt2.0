import { describe, expect, it } from "vitest";

import { applyAuthUrlRepairs, repairedAuthUrls } from "@/lib/auth.config";

/**
 * `AUTH_URL` took the studio down in production for two days.
 *
 * It was set to a bare host — the form a hosting dashboard displays a domain
 * in — and Auth.js calls `new URL()` on the raw value inside the middleware
 * (`reqWithEnvURL`, and again in `createActionURL`). Neither catches, the
 * middleware is what guards `/studio/:path*`, so every studio route answered
 * `500 Internal Server Error` while the public site served normally. Vercel's
 * runtime error read `TypeError: Invalid URL … input: 'rivyalivingart.com'`
 * on route `/middleware`, which names neither the variable nor the fix.
 *
 * These assertions pin the repair at the boundary. Like the blank-env case in
 * env.test.ts, the failure is invisible locally: a developer's shell has no
 * such variable, so nothing on the way to production exercises the value that
 * breaks it.
 */
describe("repairedAuthUrls", () => {
  it("repairs the bare host that a dashboard shows and an operator pastes", () => {
    expect(repairedAuthUrls({ AUTH_URL: "rivyalivingart.com" })).toEqual([
      {
        key: "AUTH_URL",
        from: "rivyalivingart.com",
        to: "https://rivyalivingart.com",
      },
    ]);
  });

  it("repairs the legacy NEXTAUTH_URL too — Auth.js still falls back to it", () => {
    expect(
      repairedAuthUrls({ NEXTAUTH_URL: "rivya-living-art.vercel.app" }),
    ).toEqual([
      {
        key: "NEXTAUTH_URL",
        from: "rivya-living-art.vercel.app",
        to: "https://rivya-living-art.vercel.app",
      },
    ]);
  });

  it("leaves a usable value completely alone, trailing slash and all", () => {
    // The test for "needs repair" is the one Auth.js applies — `new URL()` —
    // not a stricter house style. Warning about a variable that works trains
    // an operator to scroll past the warning that matters.
    for (const AUTH_URL of [
      "https://www.rivyalivingart.com",
      "https://www.rivyalivingart.com/",
      "http://localhost:3000",
      "https://www.rivyalivingart.com/api/auth",
    ]) {
      expect(repairedAuthUrls({ AUTH_URL })).toEqual([]);
    }
  });

  it("says nothing about an absent or blank variable", () => {
    // Absent is a SUPPORTED configuration: Auth.js then derives the origin
    // from x-forwarded-host, which is correct on Vercel.
    expect(repairedAuthUrls({})).toEqual([]);
    expect(repairedAuthUrls({ AUTH_URL: undefined })).toEqual([]);
    expect(repairedAuthUrls({ AUTH_URL: "" })).toEqual([]);
  });

  it("reports a value beyond repair as unset rather than inventing an origin", () => {
    expect(repairedAuthUrls({ AUTH_URL: "/studio" })).toEqual([
      { key: "AUTH_URL", from: "/studio", to: undefined },
    ]);
  });

  it("reports both variables when both are wrong", () => {
    expect(
      repairedAuthUrls({
        AUTH_URL: "rivyalivingart.com",
        NEXTAUTH_URL: "www.rivyalivingart.com",
      }).map((r) => r.key),
    ).toEqual(["AUTH_URL", "NEXTAUTH_URL"]);
  });
});

describe("applyAuthUrlRepairs", () => {
  it("writes the repaired origin back so Auth.js reads a parsable value", () => {
    const env: Record<string, string | undefined> = {
      AUTH_URL: "rivyalivingart.com",
    };
    applyAuthUrlRepairs(env);
    expect(env.AUTH_URL).toBe("https://rivyalivingart.com");
    expect(() => new URL(env.AUTH_URL as string)).not.toThrow();
  });

  it("DELETES an unusable value instead of blanking it", () => {
    // Auth.js reads `AUTH_URL ?? NEXTAUTH_URL`, and `??` admits "" — blanking
    // would hand `new URL("")` the same crash the bare host caused.
    const env: Record<string, string | undefined> = { AUTH_URL: "/studio" };
    applyAuthUrlRepairs(env);
    expect(env).not.toHaveProperty("AUTH_URL");
  });

  it("does not fall through to the legacy variable when only it is set", () => {
    const env: Record<string, string | undefined> = {
      NEXTAUTH_URL: "rivyalivingart.com",
    };
    applyAuthUrlRepairs(env);
    expect(env).toEqual({ NEXTAUTH_URL: "https://rivyalivingart.com" });
  });

  it("touches nothing when every value is already usable", () => {
    const env: Record<string, string | undefined> = {
      AUTH_URL: "https://www.rivyalivingart.com",
      DATABASE_URL: "postgresql://x",
    };
    expect(applyAuthUrlRepairs(env)).toEqual([]);
    expect(env).toEqual({
      AUTH_URL: "https://www.rivyalivingart.com",
      DATABASE_URL: "postgresql://x",
    });
  });
});
