import { describe, expect, it } from "vitest";

import { ALT_MAX, checkAlt, matchMediaRow } from "./alt-backfill.mjs";

const row = (id, pathname, url, type = "IMAGE", alt = null) => ({
  id,
  pathname,
  url: url ?? `https://blob.example/${pathname}`,
  type,
  alt,
});

describe("checkAlt — the codebase's own alt rules", () => {
  it("accepts a subject-first sentence", () => {
    expect(checkAlt("A deep-blue resin river table on dark seasoned teak")).toBeNull();
  });
  it("refuses empty and blank alts", () => {
    expect(checkAlt("")).toBe("FAIL: empty alt");
    expect(checkAlt("   ")).toBe("FAIL: empty alt");
  });
  it("refuses copy that announces the medium", () => {
    expect(checkAlt("Image of a river table")).toContain("announces the medium");
    expect(checkAlt("A photo of a pour")).toContain("announces the medium");
    expect(checkAlt("Picture of the studio")).toContain("announces the medium");
  });
  it("refuses filenames inside the copy", () => {
    expect(checkAlt("frame_042.webp of the pour")).toContain("filename");
  });
  it("refuses past the dialog's own ceiling and only notes a long caption", () => {
    expect(checkAlt("x".repeat(ALT_MAX + 1))).toContain("FAIL");
    expect(checkAlt("x".repeat(141))).toContain("NOTE");
  });
});

describe("matchMediaRow — exact, then URL suffix, then basename", () => {
  const rows = [
    row("a", "media/v3/tile-preserve.avif"),
    row("b", "images/blog/why-blue-resin-endures.webp"),
    row("c", "uploads/2026/09/photo-1.webp"),
    row("d", "uploads/2026/08/photo-1.webp"),
  ];

  it("matches an exact pathname first", () => {
    expect(matchMediaRow(rows, "media/v3/tile-preserve.avif").row.id).toBe("a");
  });
  it("falls back to a unique URL suffix", () => {
    expect(
      matchMediaRow(rows, "blog/why-blue-resin-endures.webp").row.id,
    ).toBe("b");
  });
  it("matches a unique basename", () => {
    expect(matchMediaRow(rows, "tile-preserve.avif").row.id).toBe("a");
  });
  it("reports an ambiguous basename instead of guessing", () => {
    const result = matchMediaRow(rows, "photo-1.webp");
    expect(result.ambiguous).toHaveLength(2);
  });
  it("returns null when nothing matches", () => {
    expect(matchMediaRow(rows, "no-such-file.webp")).toBeNull();
  });
});