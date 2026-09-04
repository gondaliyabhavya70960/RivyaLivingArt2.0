import { describe, expect, it } from "vitest";
import { PROCESS_STEP_COUNT, PROCESS_STEPS } from "./process-steps";

describe("PROCESS_STEPS", () => {
  it("is the owner-confirmed ten, with unique keys and matching slots", () => {
    expect(PROCESS_STEP_COUNT).toBe(10);
    const keys = PROCESS_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(10);
    for (const step of PROCESS_STEPS) {
      expect(step.image).toBe(`process.${step.key}`);
    }
  });
});
