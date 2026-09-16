import { describe, expect, it } from "vitest";

import {
  CONFIRMED_COLUMNS,
  confirmedRowToCells,
  confirmedRowsToCsv,
  formatPriceMajor,
  type ConfirmedExportRow,
} from "@/lib/scraper/confirmed-export";
import type { ScopedPick } from "@/lib/scraper/comparison-scopes";

const pick: ScopedPick = {
  row: {
    snapshotId: "snap-1",
    researchProductId: "rp-1",
    capturedAt: new Date("2026-09-16T10:00:00Z"),
    label: "Small / Indigo",
    priceMinor: 4500000,
    priceBasis: "PER_PIECE",
    isReference: false,
  },
  rationale: "lowest-priced of 3 variants",
};

function row(overrides: Partial<ConfirmedExportRow> = {}): ConfirmedExportRow {
  return {
    sourceKey: "acme-resin",
    sourceName: "Acme Resin",
    externalId: "ext-9",
    title: "River Console Table",
    url: "https://example.test/p/river-console",
    pick,
    currency: "INR",
    note: "benchmark for the foyer line",
    tags: ["large-format", "river-table"],
    confirmedBy: "owner@rivya.example",
    confirmedAt: new Date("2026-09-16T11:00:00Z"),
    firstSeen: new Date("2026-08-01T08:00:00Z"),
    lastSeen: new Date("2026-09-15T08:00:00Z"),
    ...overrides,
  };
}

describe("formatPriceMajor", () => {
  it("converts paise to a plain major-unit string for Excel", () => {
    expect(formatPriceMajor(4500000)).toBe("45000.00");
    expect(formatPriceMajor(99)).toBe("0.99");
  });

  it("exports quote-only as an empty cell — quote-only is not free", () => {
    expect(formatPriceMajor(null)).toBe("");
  });
});

describe("confirmedRowToCells", () => {
  it("emits cells in CONFIRMED_COLUMNS order", () => {
    const cells = confirmedRowToCells(row());
    expect(cells).toHaveLength(CONFIRMED_COLUMNS.length);
    expect(cells[0]).toBe("acme-resin");
    expect(cells[3]).toBe("River Console Table");
    expect(cells[5]).toBe("45000.00");
    expect(cells[7]).toBe("per piece");
    expect(cells[8]).toBe("Small / Indigo");
    expect(cells[9]).toBe("lowest-priced of 3 variants");
    expect(cells[11]).toBe("large-format | river-table");
    expect(cells[13]).toBe("2026-09-16T11:00:00.000Z");
  });

  it("a product with no comparable pick exports empty price cells, not zero", () => {
    const cells = confirmedRowToCells(row({ pick: null }));
    expect(cells[5]).toBe("");
    expect(cells[7]).toBe("");
    expect(cells[9]).toBe("");
  });

  it("a quote-only pick keeps its basis and an empty price", () => {
    const quotePick: ScopedPick = {
      row: { ...pick.row, priceMinor: null, priceBasis: "QUOTE_ONLY" },
      rationale: "only comparable variant",
    };
    const cells = confirmedRowToCells(row({ pick: quotePick }));
    expect(cells[5]).toBe("");
    expect(cells[7]).toBe("quote only");
  });
});

describe("confirmedRowsToCsv", () => {
  it("writes the header and guards spreadsheet formula injection", () => {
    const csv = confirmedRowsToCsv([row({ title: "=HYPERLINK(\"http://x\")" })]);
    const [header, first] = csv.split("\r\n");
    expect(header).toBe(CONFIRMED_COLUMNS.join(","));
    expect(first).toContain("'=HYPERLINK");
  });

  it("exports zero rows as a header-only document", () => {
    const csv = confirmedRowsToCsv([]);
    expect(csv).toBe(CONFIRMED_COLUMNS.join(",") + "\r\n");
  });
});
