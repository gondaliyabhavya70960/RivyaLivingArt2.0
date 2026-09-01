import { describe, expect, it } from "vitest";
import { clientIp, rateLimit } from "./rate-limit";

describe("clientIp (Prompt 06 #3)", () => {
  it("extracts first hop on Vercel where edge sets x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
    });
    expect(clientIp(headers)).toBe("203.0.113.195");
  });

  it("handles whitespace in x-forwarded-for cleanly", () => {
    const headers = new Headers({
      "x-forwarded-for": "   198.51.100.42   , 10.0.0.1",
    });
    expect(clientIp(headers)).toBe("198.51.100.42");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.99",
    });
    expect(clientIp(headers)).toBe("198.51.100.99");
  });

  it("falls back to 'anon' when no IP headers are set", () => {
    const headers = new Headers();
    expect(clientIp(headers)).toBe("anon");
  });

  it("supports configurable trusted proxy depth for non-Vercel deployments", () => {
    const headers = new Headers({
      "x-forwarded-for": "spoofed.client.ip, 198.51.100.5, 10.0.0.1",
    });
    // Depth 2 from right: 198.51.100.5
    expect(clientIp(headers, 2)).toBe("198.51.100.5");
  });
});

describe("rateLimit in-memory sliding window", () => {
  it("allows requests under the threshold and blocks on excess", () => {
    const key = "test-action:" + Math.random();
    expect(rateLimit(key, { limit: 2, windowMs: 10_000 }).ok).toBe(true);
    expect(rateLimit(key, { limit: 2, windowMs: 10_000 }).ok).toBe(true);

    const blocked = rateLimit(key, { limit: 2, windowMs: 10_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(10);
    }
  });
});
