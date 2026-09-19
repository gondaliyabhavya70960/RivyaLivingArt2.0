import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * D32, AS A TEST — the storefront label is large, it is always there, and it
 * does not float.
 *
 * `form-field.tsx`'s header carries the decision and the two documents it
 * reconciles (§6.8 wants a floating label; REDESIGN.md §10.3's "large labels"
 * forbids one, and §10.3 is law). A decision that lives only in a comment is a
 * decision the next person re-opens by accident, because a floating label is
 * the single most-copied form pattern there is and nothing here would have
 * failed if one appeared.
 *
 * These read the SOURCE rather than a render: this repo has no component-test
 * runner (CLAUDE.md), and the same shape is already used by
 * `icons/registry.test.ts` and `product-filter-links.test.ts`. Comments are
 * stripped first for the reason `registry.test.ts` learned the hard way — the
 * header explains the very pattern it forbids, and a grep over raw text counts
 * the explanation as the thing.
 */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SOURCE = strip(readFileSync(join(__dirname, "form-field.tsx"), "utf8"));

/** The label's class chain, as the file actually declares it. */
const LABEL_CLASSES =
  /const fieldLabelClasses\s*=\s*([\s\S]*?);/.exec(SOURCE)?.[1] ?? "";

describe("storefront field label · D32", () => {
  it("declares the label register once", () => {
    expect(LABEL_CLASSES).not.toBe("");
  });

  it("keeps §10.3's large label at the body size, not a floated 12px one", () => {
    // 16px is also Part 13's iOS-zoom floor for the CONTROL; on the label it
    // is §10.3's register. Any float implementation has to shrink this.
    expect(LABEL_CLASSES).toContain("text-16");
    for (const small of ["text-12", "text-14", "u-micro"]) {
      expect(
        LABEL_CLASSES,
        `the label dropped to ${small} — see D32 in form-field.tsx before changing it`,
      ).not.toContain(small);
    }
  });

  it("never positions or transforms the label", () => {
    // A floating label is `absolute` inside the control and moves on focus or
    // on `:placeholder-shown`. None of that vocabulary belongs on this label.
    for (const floaty of [
      "absolute",
      "translate-y",
      "scale-",
      "placeholder-shown",
      "origin-",
    ]) {
      expect(
        LABEL_CLASSES,
        `"${floaty}" on the label is the floating pattern D32 declines — reverse the note in form-field.tsx, do not work around it`,
      ).not.toContain(floaty);
    }
  });

  it("renders the label unconditionally — `hideLabel` only hides it visually", () => {
    // Part 17 forbids placeholder-only labelling, so the element is always in
    // the tree; `hideLabel` adds `sr-only` and never a conditional.
    expect(SOURCE).toContain("htmlFor={fieldId}");
    expect(SOURCE).toContain('hideLabel && "sr-only"');
    // The shape that would break it: `{!hideLabel && <label`.
    expect(SOURCE).not.toMatch(/hideLabel\s*(\?|&&)\s*\n?\s*(null|<)/);
  });
});
