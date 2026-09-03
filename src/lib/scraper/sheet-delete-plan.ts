/**
 * Pure planner for Google Sheets row deletion — the index arithmetic that
 * `deleteRowsFromTab` (sheets.ts) sends to `spreadsheets.batchUpdate`,
 * extracted so the one invariant that matters can be unit-tested without a
 * service account.
 *
 * The invariant: rows are deleted in DESCENDING sheet order. Each
 * `deleteDimension` request shifts every row below the deleted one up by
 * one, so an ascending pass deletes the wrong rows from the second request
 * onward — and reports success while doing it (docs/google-sheets.md,
 * AGENTS.md "Traps"). `sheet-delete-plan.test.ts` replays the plan against a
 * simulated tab to prove exactly the wanted rows disappear.
 */
export type DeleteDimensionRequest = {
  deleteDimension: {
    range: {
      sheetId: number;
      dimension: "ROWS";
      /** 0-based, inclusive — sheet row N is index N − 1. */
      startIndex: number;
      /** 0-based, exclusive. */
      endIndex: number;
    };
  };
};

export type DeletePlan = {
  /** 1-based sheet row numbers, descending. */
  rowNumbers: number[];
  /** The batchUpdate requests, in the order they must be applied. */
  requests: DeleteDimensionRequest[];
};

export function planRowDeletions(opts: {
  /** Data rows as read from the tab, first data row first (no header). */
  rows: readonly string[][];
  /** Merge key of a row; an empty string means "unkeyed, never delete". */
  keyOf: (row: string[]) => string;
  /** Merge keys to delete. */
  keys: Iterable<string>;
  sheetId: number;
  /** Sheet row number of the first data row. A2 is row 2 (the header is row 1). */
  firstDataRow?: number;
}): DeletePlan {
  const first = opts.firstDataRow ?? 2;
  const wanted = new Set(opts.keys);
  const rowNumbers: number[] = [];
  opts.rows.forEach((cells, i) => {
    const key = opts.keyOf(cells);
    if (key && wanted.has(key)) rowNumbers.push(i + first);
  });
  rowNumbers.sort((a, b) => b - a);
  return {
    rowNumbers,
    requests: rowNumbers.map((row) => ({
      deleteDimension: {
        range: {
          sheetId: opts.sheetId,
          dimension: "ROWS",
          startIndex: row - 1,
          endIndex: row,
        },
      },
    })),
  };
}
