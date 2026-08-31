# Google Sheets audit — NOT AUDITED

Only the CSV fetch path was read. The sync engine, write policy and export were
not. Nothing was executed.

## Verified

`fetchGoogleSheetCsv` (`src/lib/import/parse.ts`) is **not** an SSRF vector: it
extracts the document id with a regex and **rebuilds** the URL against
`docs.google.com/spreadsheets/d/<id>/export`. The caller's URL is never fetched
as supplied. Private sheets return an HTML login page, detected by both
content-type and a leading-`<` sniff, and translated into a sharing hint. 20s
timeout.

`src/lib/scraper/sheets.ts` reads the service account from
`GOOGLE_SERVICE_ACCOUNT_JSON` and validates `client_email` + `private_key` —
**credentials come from env, not source.**

## NOT verified

Everything else. Re-verify these invariants:

| Invariant | Test |
|---|---|
| **Idempotency** | Run the same sync twice; product count must not change. Duplicate rows are the classic failure |
| **One write engine, per-source policy** | `MANUAL` default / `ON_COMPLETE` / `OFF`. Two write paths into one document is how rows get duplicated |
| **A FAILED job never auto-pushes** | |
| **Sheets down never fails a scrape** | Rows mark `SYNC_PENDING`; retry re-pushes whole jobs, made free by the merge key |
| **Blast-radius cap guards CREATES** | The direction that hurts |
| **Row deletion is DESCENDING** | Needs `deleteDimension` and the tab's **numeric** id. An ascending pass deletes the wrong rows from the second one onward — **and succeeds while doing it.** Verify the sort direction in code; this failure is silent |

`sheet-policy.test.ts`, `website-sheet.test.ts` and `fill-policy.test.ts` exist.
**Not run.**

## Parsing cases to exercise

Valid sheet · empty sheet · malformed headers · missing columns · duplicate rows
· duplicate SKU · invalid price · negative price · invalid URL · invalid image ·
invalid category · invalid locale · blank cells · extra columns.

The `.xlsx` reader pre-fills every labelled header with `""`, so a row with
trailing empty cells still carries every column key, and unlabelled columns keep
the `__EMPTY` convention. That is the right shape — confirm the CSV path matches.

## Not checked — CSV formula injection

**Worth doing.** A cell beginning `=`, `+`, `-` or `@` executes when the sheet
is opened. If any export writes owner- or scraper-sourced text into a cell
without escaping, a scraped product title like `=HYPERLINK(...)` becomes a live
formula in the owner's spreadsheet.

Check `/api/scraper/export`, `/api/subscribers/export`, and the sheet write
engine. Fix by prefixing a single quote or coercing to a text-formatted cell.
