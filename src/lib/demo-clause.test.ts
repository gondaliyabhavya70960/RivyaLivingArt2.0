import { describe, expect, it } from "vitest";
import { demoClause, NO_DEMO } from "./demo-clause";

describe("demoClause", () => {
  it("hides every fixture unless the gate says show", () => {
    expect(demoClause(false)).toEqual({ isDemo: false });
    expect(demoClause(true)).toEqual({});
  });

  it("spreads cleanly into a where clause either way", () => {
    expect({ status: "PUBLISHED", ...demoClause(false) }).toEqual({
      status: "PUBLISHED",
      isDemo: false,
    });
    expect({ status: "PUBLISHED", ...demoClause(true) }).toEqual({
      status: "PUBLISHED",
    });
  });

  it("NO_DEMO is the hiding clause", () => {
    expect(NO_DEMO).toEqual({ isDemo: false });
  });
});
