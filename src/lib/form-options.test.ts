import { describe, expect, it } from "vitest";

import {
  FORM_OPTION_DEFAULTS,
  FORM_OPTION_FALLBACK,
  FORM_OPTION_LISTS,
  isFormOptionList,
  resolveOptionLabel,
} from "./form-options";

describe("the bundled option lists", () => {
  it("carries the exact strings the form used to submit", () => {
    // These values land on Inquiry rows and go out in the WhatsApp message.
    // Changing a character orphans history and duplicates rows on re-seed, so
    // they are pinned here rather than left to a future tidy-up.
    expect(FORM_OPTION_DEFAULTS.MATERIAL).toEqual([
      "Epoxy resin",
      "Resin + wood",
      "Jesmonite",
      "3D printed",
      "Not sure — advise me",
    ]);
    expect(FORM_OPTION_DEFAULTS.BUDGET).toEqual([
      "Under ₹2,000",
      "₹2,000–₹5,000",
      "₹5,000–₹15,000",
      "₹15,000–₹50,000",
      "Above ₹50,000",
      "Flexible",
    ]);
    expect(FORM_OPTION_DEFAULTS.TIMELINE).toEqual([
      "No rush",
      "Within 2 weeks",
      "Within a month",
      "A specific date (mention in notes)",
    ]);
  });

  it("ends the occasion list with the catch-all", () => {
    const occasions = FORM_OPTION_DEFAULTS.OCCASION;
    expect(occasions.at(-1)).toBe("Other");
    expect(occasions).toContain("Wedding");
  });

  it("has no duplicate value within a list", () => {
    for (const list of FORM_OPTION_LISTS) {
      const values = FORM_OPTION_DEFAULTS[list];
      expect(new Set(values).size, list).toBe(values.length);
    }
  });

  it("offers a fallback for every list, labelled in English", () => {
    for (const list of FORM_OPTION_LISTS) {
      const choices = FORM_OPTION_FALLBACK[list];
      expect(choices.length, list).toBe(FORM_OPTION_DEFAULTS[list].length);
      // Label equals value: the bundled English text is the canonical string.
      for (const choice of choices) expect(choice.label).toBe(choice.value);
    }
  });
});

describe("resolveOptionLabel", () => {
  const label = { en: "Under ₹2,000", hi: "₹2,000 से कम" };

  it("uses the locale's own wording when it exists", () => {
    expect(resolveOptionLabel(label, "hi", "Under ₹2,000")).toBe(
      "₹2,000 से कम",
    );
  });

  it("falls back to English for an untranslated locale", () => {
    expect(resolveOptionLabel(label, "ja", "Under ₹2,000")).toBe(
      "Under ₹2,000",
    );
  });

  it("falls back to the canonical value when the blob is empty", () => {
    // A brand-new option is usable the moment it is added, before anyone has
    // written a single translation for it.
    expect(resolveOptionLabel({}, "hi", "Flexible")).toBe("Flexible");
  });

  it("ignores a blank or non-string entry rather than rendering it", () => {
    expect(resolveOptionLabel({ hi: "   " }, "hi", "Flexible")).toBe(
      "Flexible",
    );
    expect(resolveOptionLabel({ hi: 42 }, "hi", "Flexible")).toBe("Flexible");
  });

  it("survives a malformed blob", () => {
    // The column is written only by a validated action, so this guards a
    // hand-edited row rather than a code path.
    expect(resolveOptionLabel(null, "en", "Flexible")).toBe("Flexible");
    expect(resolveOptionLabel(["nope"], "en", "Flexible")).toBe("Flexible");
    expect(resolveOptionLabel("nope", "en", "Flexible")).toBe("Flexible");
  });
});

describe("isFormOptionList", () => {
  it("accepts the four lists and nothing else", () => {
    expect(isFormOptionList("MATERIAL")).toBe(true);
    expect(isFormOptionList("TIMELINE")).toBe(true);
    expect(isFormOptionList("material")).toBe(false);
    expect(isFormOptionList("")).toBe(false);
  });
});
