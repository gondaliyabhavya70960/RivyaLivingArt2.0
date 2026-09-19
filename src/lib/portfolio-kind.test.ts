import { describe, expect, it } from "vitest";

import { CONCEPT_STUDY_KIND, isConceptStudy } from "@/lib/portfolio-kind";

describe("isConceptStudy", () => {
  it("marks a row whose resultsMeta says so", () => {
    expect(isConceptStudy({ kind: CONCEPT_STUDY_KIND, material: "Oak" })).toBe(
      true,
    );
  });

  it("treats every unmarked row as a genuine commission", () => {
    // The whole existing portfolio has resultsMeta without a `kind`, and the
    // failure direction matters: an unlabelled concept study is a false claim
    // about client work, an unlabelled commission is just a commission.
    expect(isConceptStudy({ material: "Walnut", size: "180cm" })).toBe(false);
    expect(isConceptStudy({})).toBe(false);
  });

  it("never throws on a shape the column can legally hold", () => {
    expect(isConceptStudy(null)).toBe(false);
    expect(isConceptStudy(undefined)).toBe(false);
    expect(isConceptStudy("concept-study")).toBe(false);
    expect(isConceptStudy(42)).toBe(false);
    expect(isConceptStudy([{ kind: CONCEPT_STUDY_KIND }])).toBe(false);
  });

  it("requires the marker exactly — no near-misses", () => {
    expect(isConceptStudy({ kind: "concept" })).toBe(false);
    expect(isConceptStudy({ kind: "Concept-Study" })).toBe(false);
    expect(isConceptStudy({ type: CONCEPT_STUDY_KIND })).toBe(false);
  });
});
