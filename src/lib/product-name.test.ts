import { describe, expect, it } from "vitest";

import { editorialName } from "@/lib/product-name";

describe("editorialName", () => {
  it("prefers the owner displayName verbatim", () => {
    expect(editorialName("Khatu Shyam — Ocean Light", "Long SEO title")).toBe(
      "Khatu Shyam — Ocean Light",
    );
  });

  it("ignores a whitespace-only displayName", () => {
    expect(editorialName("   ", "Star Shape small")).toBe("Star Shape small");
  });

  it("cuts the title at the first qualifier separator", () => {
    expect(
      editorialName(
        null,
        "Lord Khatu Shyam Ji Spiritual Puja Vastu Figurine – Resin LED Light Khatu Shyam Arrow & Bow Symbol Frame/ Religious Gift 30*18 inch",
      ),
    ).toBe("Lord Khatu Shyam Ji Spiritual Puja Vastu Figurine");
  });

  it("cuts at an opening parenthesis qualifier", () => {
    expect(
      editorialName(
        null,
        "Big Resin Navkar Mantra Frame (Blue Golden Rectangular)",
      ),
    ).toBe("Big Resin Navkar Mantra Frame");
  });

  it("never cuts a separator inside the first few characters", () => {
    // Index ≤ 8 separators are part of the name, not a qualifier.
    expect(editorialName(null, "A - Team Resin Kit")).toBe(
      "A - Team Resin Kit",
    );
  });

  it("word-caps very long unseparated titles with an ellipsis", () => {
    const name = editorialName(
      null,
      "Wedding Garland Flower Preserved Resin Couple Photo Frame in Three Dimensions Personalized",
    );
    expect(name.length).toBeLessThanOrEqual(61);
    expect(name.endsWith("…")).toBe(true);
    // Cuts on a word boundary — never mid-word.
    expect(name).toBe(
      "Wedding Garland Flower Preserved Resin Couple Photo Frame…",
    );
  });

  it("trims stranded list punctuation after a cut", () => {
    expect(editorialName(null, "Resin Tray, – large")).toBe(
      "Resin Tray,".replace(/[,;:·]+$/, ""),
    );
  });

  it("returns short titles unchanged", () => {
    expect(editorialName(null, "Customised Nutella Jar")).toBe(
      "Customised Nutella Jar",
    );
  });
});
