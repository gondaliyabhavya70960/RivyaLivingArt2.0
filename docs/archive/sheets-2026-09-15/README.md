# Google Sheets history — archived 2026-09-15

Written by `scripts/export-sheets-history.ts` before plan C phase 4 dropped
the Sheets schema. Do not delete: `sheet-sync-runs.csv` is the only copy.

- **sheet-sync-runs.csv** — 1 row(s). The push-side history of
  every write this project made to the owner's spreadsheet. The
  `SheetSyncRun` table was dropped; this file replaces it.
- **import-conflicts.csv** — 0 row(s). A point-in-time copy of
  the CSV importer's conflict queue. That table was **not** dropped — it
  survives as `ImportConflict` — so this file is a snapshot for reading
  alongside the runs, not a replacement.

Both are RFC-4180 CSV with a formula-injection guard, written through the
same `toCsvDocument` the Studio's own exports use.
