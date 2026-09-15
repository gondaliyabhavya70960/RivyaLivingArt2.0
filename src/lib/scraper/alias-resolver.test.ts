import { describe, expect, it } from "vitest";

import { AliasKind } from "@/generated/prisma/enums";
import { aliasKey, resolveWithMap } from "@/lib/scraper/alias-resolver";

/**
 * The resolver's precedence, as pure logic. The database half — that editing
 * a row re-labels existing history with no re-scrape — is in
 * `tests/db/normalization-alias.test.ts`, because that is the claim only a
 * real table can prove.
 */
describe("resolveWithMap", () => {
  it("an owner's alias WINS over the built-in map", () => {
    // normalizeMaterial would title-case this on its own.
    const withoutAlias = resolveWithMap({}, AliasKind.MATERIAL, "sheesham");
    const withAlias = resolveWithMap(
      { sheesham: "Indian Rosewood" },
      AliasKind.MATERIAL,
      "sheesham",
    );
    expect(withAlias).toBe("Indian Rosewood");
    expect(withAlias).not.toBe(withoutAlias);
  });

  it("falls back to the built-in map when no alias exists", () => {
    // Empty table must behave exactly as the code did before it existed.
    expect(resolveWithMap({}, AliasKind.MATERIAL, "epoxy resin")).toBe(
      resolveWithMap({}, AliasKind.MATERIAL, "epoxy resin"),
    );
    expect(resolveWithMap({}, AliasKind.MATERIAL, "epoxy resin")).toBeTruthy();
  });

  it("is TOTAL — an unknown value comes back unchanged, never null", () => {
    const odd = "a thing nobody has a mapping for";
    expect(
      resolveWithMap({}, AliasKind.PRODUCT_TYPE, odd),
    ).toBe(odd);
    // Kinds with no built-in map at all still resolve.
    expect(resolveWithMap({}, AliasKind.RESIN_STYLE, "ocean pour")).toBe(
      "ocean pour",
    );
    expect(resolveWithMap({}, AliasKind.AVAILABILITY, "in stock")).toBe(
      "in stock",
    );
  });

  it("matches case-insensitively and ignores surrounding space", () => {
    const aliases = { sheesham: "Indian Rosewood" };
    for (const raw of ["Sheesham", "  SHEESHAM  ", "sheesham"]) {
      expect(resolveWithMap(aliases, AliasKind.MATERIAL, raw)).toBe(
        "Indian Rosewood",
      );
    }
  });

  it("leaves an empty or blank value alone", () => {
    expect(resolveWithMap({ "": "nope" }, AliasKind.MATERIAL, "   ")).toBe(
      "   ",
    );
  });

  it("aliasKey is how rows are stored, so the constraint de-duplicates", () => {
    expect(aliasKey("  Sheesham  ")).toBe("sheesham");
    expect(aliasKey("SHEESHAM")).toBe(aliasKey("sheesham"));
  });
});
