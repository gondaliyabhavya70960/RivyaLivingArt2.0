import { describe, expect, it } from "vitest";
import {
  defaultColumnVisibility,
  parseColumnVisibility,
  toggleColumnVisibility,
} from "./column-visibility";

const COLUMNS = [
  { key: "category", label: "Category" },
  { key: "tier", label: "Tier" },
  { key: "stock", label: "Stock" },
];

describe("defaultColumnVisibility", () => {
  it("shows every declared column", () => {
    expect(defaultColumnVisibility(COLUMNS)).toEqual({
      category: true,
      tier: true,
      stock: true,
    });
  });
});

describe("toggleColumnVisibility", () => {
  it("flips one column", () => {
    const state = defaultColumnVisibility(COLUMNS);
    expect(toggleColumnVisibility(state, "tier")).toEqual({
      category: true,
      tier: false,
      stock: true,
    });
  });

  it("refuses to hide the last visible column", () => {
    const state = { category: false, tier: false, stock: true };
    expect(toggleColumnVisibility(state, "stock")).toBe(state);
  });

  it("re-shows a hidden column", () => {
    const state = { category: true, tier: false, stock: true };
    expect(toggleColumnVisibility(state, "tier")).toEqual({
      category: true,
      tier: true,
      stock: true,
    });
  });
});

describe("parseColumnVisibility", () => {
  it("falls back to the default for null", () => {
    expect(parseColumnVisibility(null, COLUMNS)).toEqual(
      defaultColumnVisibility(COLUMNS),
    );
  });

  it("falls back to the default for corrupt JSON", () => {
    expect(parseColumnVisibility("{not json", COLUMNS)).toEqual(
      defaultColumnVisibility(COLUMNS),
    );
  });

  it("falls back to the default for a non-object value", () => {
    expect(parseColumnVisibility('["tier"]', COLUMNS)).toEqual(
      defaultColumnVisibility(COLUMNS),
    );
  });

  it("keeps only known columns, defaulting missing ones to visible", () => {
    const raw = JSON.stringify({ tier: false, ghostColumn: false });
    expect(parseColumnVisibility(raw, COLUMNS)).toEqual({
      category: true,
      tier: false,
      stock: true,
    });
  });

  it("falls back to the default when every column would be hidden", () => {
    const raw = JSON.stringify({ category: false, tier: false, stock: false });
    expect(parseColumnVisibility(raw, COLUMNS)).toEqual(
      defaultColumnVisibility(COLUMNS),
    );
  });
});
