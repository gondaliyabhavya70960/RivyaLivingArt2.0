import { describe, expect, it } from "vitest";

import { issueFormToken, verifyFormToken } from "@/lib/form-token";

describe("form token (S-06 spam gate)", () => {
  it("verifies a freshly issued token once past the fill-time floor", () => {
    const token = issueFormToken();
    expect(verifyFormToken(token, 0)).toBe(true);
  });

  it("rejects a token younger than the minimum fill time", () => {
    const token = issueFormToken();
    expect(verifyFormToken(token, 10_000)).toBe(false);
  });

  it("rejects a tampered timestamp", () => {
    const token = issueFormToken();
    const [ts, mac] = token.split(".");
    const older = String(Number(ts) - 60_000);
    expect(verifyFormToken(`${older}.${mac}`, 0)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const token = issueFormToken();
    const flipped = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(verifyFormToken(flipped, 0)).toBe(false);
  });

  it("rejects malformed input outright", () => {
    expect(verifyFormToken(null, 0)).toBe(false);
    expect(verifyFormToken("", 0)).toBe(false);
    expect(verifyFormToken("not-a-token", 0)).toBe(false);
    expect(verifyFormToken("123.deadbeef", 0)).toBe(false);
  });
});
