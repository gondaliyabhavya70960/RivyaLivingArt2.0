import { describe, expect, it } from "vitest";

import {
  decideMerge,
  describeProtected,
} from "@/lib/scraper/merge-policy";

describe("decideMerge", () => {
  it("creates when there is no catalog row", () => {
    expect(decideMerge(null)).toBe("create");
  });

  it("overwrites an untouched, un-rewritten scrape", () => {
    expect(decideMerge({ ownerTouched: false, needsRewrite: true })).toBe(
      "overwrite",
    );
  });

  it("skips a row already rewritten and left alone", () => {
    expect(decideMerge({ ownerTouched: false, needsRewrite: false })).toBe(
      "skip",
    );
  });

  it("protects an owner-edited row", () => {
    expect(decideMerge({ ownerTouched: true, needsRewrite: false })).toBe(
      "refresh-availability",
    );
  });

  it("protects an owner-edited row that is STILL flagged for rewrite", () => {
    // The regression this module exists for. A studio save sets ownerTouched
    // but only clears needsRewrite when the operator ticks "confirm rewrite" —
    // and most edits are not rewrites. The scraper used to read needsRewrite
    // alone and overwrite the row, deleting the gallery on the way through.
    expect(decideMerge({ ownerTouched: true, needsRewrite: true })).toBe(
      "refresh-availability",
    );
  });

  it("puts owner edits ahead of every other condition", () => {
    for (const needsRewrite of [true, false]) {
      expect(decideMerge({ ownerTouched: true, needsRewrite })).toBe(
        "refresh-availability",
      );
    }
  });
});

describe("describeProtected", () => {
  it("says nothing when nothing was protected", () => {
    expect(describeProtected(0)).toBeNull();
  });

  it("reads naturally for one", () => {
    expect(describeProtected(1)).toContain("1 product left as you edited it");
  });

  it("reads naturally for several", () => {
    expect(describeProtected(4)).toContain("4 products left as you edited them");
  });
});
