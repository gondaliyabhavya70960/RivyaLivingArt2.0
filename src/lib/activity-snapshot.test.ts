import { describe, expect, it } from "vitest";
import { snapshotBefore } from "./activity-snapshot";

describe("snapshotBefore", () => {
  it("copies only the named scalar fields", () => {
    const row = { id: "x", title: "T", body: { a: 1 }, price: 5, when: new Date("2026-01-02T00:00:00Z") };
    expect(snapshotBefore(row, ["title", "price", "when"])).toEqual({
      title: "T",
      price: 5,
      when: "2026-01-02T00:00:00.000Z",
    });
  });

  it("drops object values and says so", () => {
    const row = { title: "T", body: { a: 1 } };
    expect(snapshotBefore(row, ["title", "body"])).toEqual({ title: "T", truncated: true });
  });

  it("truncates long strings to stay under the byte cap", () => {
    const row = { quote: "x".repeat(20_000), name: "n" };
    const snap = snapshotBefore(row, ["quote", "name"], 1_024);
    expect(snap.truncated).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(snap))).toBeLessThanOrEqual(1_024 + 32);
    expect(snap.name).toBe("n");
  });
});
