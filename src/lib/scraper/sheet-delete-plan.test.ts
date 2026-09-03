import { describe, expect, it } from "vitest";

import {
  planRowDeletions,
  type DeleteDimensionRequest,
} from "@/lib/scraper/sheet-delete-plan";

const keyOf = (row: string[]) =>
  row[0] && row[2] ? `${row[0]}|${row[2]}` : "";

/** A tab as the Sheets API sees it: header at index 0, data from index 1. */
const tab = (): string[][] => [
  ["sourceKey", "title", "externalId"],
  ["shop-a", "Bowl", "1"],
  ["shop-a", "Tray", "2"],
  ["shop-b", "Lamp", "9"],
  ["shop-a", "Coaster", "3"],
  ["", "unkeyed row", ""],
  ["shop-b", "Vase", "10"],
];

/**
 * What `spreadsheets.batchUpdate` does with a deleteDimension request: the
 * rows in [startIndex, endIndex) vanish and everything below shifts up.
 * Requests are applied one after another, each against the shifted sheet.
 */
function applyRequests(
  sheet: string[][],
  requests: DeleteDimensionRequest[],
): string[][] {
  const out = sheet.map((r) => [...r]);
  for (const { deleteDimension } of requests) {
    const { startIndex, endIndex } = deleteDimension.range;
    out.splice(startIndex, endIndex - startIndex);
  }
  return out;
}

describe("planRowDeletions", () => {
  it("returns descending sheet row numbers and 0-based, exclusive ranges", () => {
    const plan = planRowDeletions({
      rows: tab().slice(1),
      keyOf,
      keys: ["shop-a|1", "shop-b|9", "shop-a|3"],
      sheetId: 42,
    });
    // Bowl is data row 0 → sheet row 2; Lamp row 2 → 4; Coaster row 3 → 5.
    expect(plan.rowNumbers).toEqual([5, 4, 2]);
    expect(plan.requests.map((r) => r.deleteDimension.range)).toEqual([
      { sheetId: 42, dimension: "ROWS", startIndex: 4, endIndex: 5 },
      { sheetId: 42, dimension: "ROWS", startIndex: 3, endIndex: 4 },
      { sheetId: 42, dimension: "ROWS", startIndex: 1, endIndex: 2 },
    ]);
  });

  it("deletes exactly the wanted rows when the plan is replayed in order", () => {
    const plan = planRowDeletions({
      rows: tab().slice(1),
      keyOf,
      keys: ["shop-a|1", "shop-b|9", "shop-a|3"],
      sheetId: 1,
    });
    const after = applyRequests(tab(), plan.requests);
    expect(after).toEqual([
      ["sourceKey", "title", "externalId"],
      ["shop-a", "Tray", "2"],
      ["", "unkeyed row", ""],
      ["shop-b", "Vase", "10"],
    ]);
  });

  it("would delete the WRONG rows if the same requests ran ascending — the trap", () => {
    const plan = planRowDeletions({
      rows: tab().slice(1),
      keyOf,
      keys: ["shop-a|1", "shop-b|9", "shop-a|3"],
      sheetId: 1,
    });
    const ascending = [...plan.requests].reverse();
    const after = applyRequests(tab(), ascending);
    // Bowl goes first and everything shifts up: the request aimed at Lamp
    // (row 4) now lands on Coaster, and the one aimed at Coaster (row 5)
    // lands on Vase — a row nobody asked to delete.
    expect(after).not.toEqual(applyRequests(tab(), plan.requests));
    expect(after.some((r) => r[1] === "Lamp")).toBe(true); // survived
    expect(after.some((r) => r[1] === "Vase")).toBe(false); // collateral
  });

  it("ignores unkeyed rows and keys that are not in the tab", () => {
    const plan = planRowDeletions({
      rows: tab().slice(1),
      keyOf,
      keys: ["shop-z|404", "|"],
      sheetId: 1,
    });
    expect(plan.rowNumbers).toEqual([]);
    expect(plan.requests).toEqual([]);
  });

  it("honours a different first data row", () => {
    const plan = planRowDeletions({
      rows: [["shop-a", "Bowl", "1"]],
      keyOf,
      keys: ["shop-a|1"],
      sheetId: 1,
      firstDataRow: 1,
    });
    expect(plan.rowNumbers).toEqual([1]);
    expect(plan.requests[0].deleteDimension.range).toMatchObject({
      startIndex: 0,
      endIndex: 1,
    });
  });
});
