import { describe, expect, it } from "vitest";

import {
  DEMO_REMOVAL_PHRASE,
  describeSelectionProblem,
  normalizeSelection,
  requiresTypedConfirmation,
} from "@/lib/demo/selective";

describe("normalizeSelection", () => {
  it("orders whole-table clears children-first, with Media last", () => {
    const { entities } = normalizeSelection({
      entities: ["Media", "BlogCategory", "Inquiry", "Product"],
    });
    // Media has to come after every table that could reference a file, and
    // BlogCategory after the posts that point at it.
    expect(entities).toEqual(["Inquiry", "Product", "BlogCategory", "Media"]);
  });

  it("drops ids for a table that is already being cleared wholesale", () => {
    const result = normalizeSelection({
      entities: ["Faq"],
      ids: { Faq: ["a", "b"], Inquiry: ["c"] },
    });
    expect(result.entities).toEqual(["Faq"]);
    expect(result.ids).toEqual([{ entity: "Inquiry", ids: ["c"] }]);
    // Counting the three Faq ids here would report a `selected` total the
    // database can never match, because the wholesale clear already covers them.
    expect(result.namedRows).toBe(1);
  });

  it("de-duplicates ids and drops blank ones", () => {
    const result = normalizeSelection({
      ids: { Inquiry: ["a", "a", "  ", "b", ""] },
    });
    expect(result.ids).toEqual([{ entity: "Inquiry", ids: ["a", "b"] }]);
    expect(result.namedRows).toBe(2);
  });

  it("ignores a content type this build does not know", () => {
    const result = normalizeSelection({
      entities: ["Faq", "Sprocket" as never],
    });
    expect(result.entities).toEqual(["Faq"]);
  });

  it("returns an empty plan for an empty selection", () => {
    const result = normalizeSelection({});
    expect(result.entities).toEqual([]);
    expect(result.ids).toEqual([]);
    expect(result.namedRows).toBe(0);
  });
});

describe("requiresTypedConfirmation", () => {
  it("is required to clear a whole content type", () => {
    expect(requiresTypedConfirmation({ entities: ["Faq"] })).toBe(true);
  });

  it("is not required for rows the owner ticked individually", () => {
    // An entity clear is unbounded; four ticked rows are four rows the owner
    // can see. Different decisions, different ceremony.
    expect(requiresTypedConfirmation({ ids: { Faq: ["a", "b"] } })).toBe(false);
  });

  it("is not required when the only named type is unknown to this build", () => {
    expect(requiresTypedConfirmation({ entities: ["Sprocket" as never] })).toBe(
      false,
    );
  });
});

describe("describeSelectionProblem", () => {
  it("refuses an empty selection", () => {
    expect(describeSelectionProblem({}, DEMO_REMOVAL_PHRASE)).toBe(
      "Nothing is selected.",
    );
  });

  it("refuses a whole-table clear without the exact phrase", () => {
    const problem = describeSelectionProblem({ entities: ["Faq"] }, "remove demo data");
    expect(problem).toContain(DEMO_REMOVAL_PHRASE);
  });

  it("allows a whole-table clear with the exact phrase", () => {
    expect(
      describeSelectionProblem({ entities: ["Faq"] }, DEMO_REMOVAL_PHRASE),
    ).toBeNull();
  });

  it("allows ticked rows with no phrase at all", () => {
    expect(describeSelectionProblem({ ids: { Faq: ["a"] } }, "")).toBeNull();
  });

  it("names an unknown content type rather than silently removing nothing", () => {
    const problem = describeSelectionProblem(
      { entities: ["Sprocket" as never] },
      DEMO_REMOVAL_PHRASE,
    );
    expect(problem).toContain("Sprocket");
  });
});
