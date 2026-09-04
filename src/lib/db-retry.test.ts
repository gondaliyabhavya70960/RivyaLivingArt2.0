import { describe, expect, it } from "vitest";
import { isTooManyConnections, poolMax, retryDelayMs } from "./db-retry";

describe("db retry policy", () => {
  it("recognises P2037 by code, adapter name or message", () => {
    expect(isTooManyConnections({ code: "P2037" })).toBe(true);
    expect(isTooManyConnections({ meta: { driverAdapterError: { name: "TooManyConnections" } } })).toBe(true);
    expect(isTooManyConnections(new Error('too many connections for role "prisma_migration"'))).toBe(true);
    expect(isTooManyConnections({ code: "P2002" })).toBe(false);
    expect(isTooManyConnections(null)).toBe(false);
  });

  it("backs off exponentially with jitter and a 2 s cap", () => {
    expect(retryDelayMs(1, () => 0)).toBe(150);
    expect(retryDelayMs(2, () => 0)).toBe(300);
    expect(retryDelayMs(3, () => 0)).toBe(600);
    expect(retryDelayMs(9, () => 0)).toBe(2_000);
    expect(retryDelayMs(1, () => 0.5)).toBe(200);
  });

  it("shrinks the pool during the production build unless told otherwise", () => {
    expect(poolMax({})).toBe(5);
    expect(poolMax({ NEXT_PHASE: "phase-production-build" })).toBe(2);
    expect(poolMax({ NEXT_PHASE: "phase-production-build", DB_POOL_MAX: "3" })).toBe(3);
  });
});
