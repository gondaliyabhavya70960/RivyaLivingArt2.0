> **ARCHIVED 2026-09-15 — Google Sheets is removed from this project.**
>
> Everything below describes a subsystem that no longer exists: the
> service-account client, the push engine, the per-source
> `MANUAL`/`ON_COMPLETE`/`OFF` policy, the Sheet1 linking and the four
> `GOOGLE_*` / `*SHEET_ID` environment variables were all deleted under
> plan C (`docs/plan/03-sheets-removal.md`).
>
> **What replaced it:** the owner exports the confirmed list from
> `/studio/exports` as CSV or XLSX, on demand.
>
> **What was never Google Sheets** and still works exactly as before:
> `/studio/sheet-import` and `src/lib/import/tier-fill.ts`, which read committed
> CSVs from `data/tiers/*.csv.gz`. The conflict queue that fill writes is now
> `ImportConflict`; it was called `SheetConflict`, which is the naming trap this
> archive exists to stop anyone falling into.
>
> Kept unedited below as a record of what the integration did.

---

# The Google Sheet

The owner's spreadsheet is a working surface, not an export target. People sort
it, filter it and type in it. Everything here follows from that.

**Sheet:** `1f4_cl3-8JrYIFTPNhSsuMEl8GAET1n61L9ZZKL8npa8`

---

## Tabs

| Tab                             | Holds                        | Merge key               | Written by                       |
| ------------------------------- | ---------------------------- | ----------------------- | -------------------------------- |
| `Tier1_Owner` … `Tier4_3DPrint` | Raw scrape decks, 26 columns | `sourceKey\|externalId` | `syncJobToSheet`, `Add to Sheet` |
| `Sheet1`                        | Bulk-upload format           | `slug`                  | `sendScrapedToSheet1`            |
| `Added product in website`      | Every product on the site    | `Product ID`            | `syncWebsiteProductsToSheet`     |
| `CONFIRMED_PRODUCTS`            | **The final list**           | `Product ID`            | the Confirm action only          |

The tier tabs are large — Tier 2 alone runs to ~35,000 rows, and the four
together to roughly 64,700. Anything that reads or diffs a whole tab must be
batched, and adding a column to one is itself a batched write.

### Rules that keep it usable by a person

- Map by **header name**, never by column index, never by row number.
- `Product ID` is the stable reference across tabs.
- **Never destroy a column you did not create.** The owner works in here.

---

## Pushing scraped rows out

One engine, one policy deciding when it fires — never two write paths, because
the merge key only prevents duplicate rows if every writer goes through it.

```
MANUAL       stage, and push when the operator says add    ← default
ON_COMPLETE  push automatically when a job reaches DONE
OFF          this source's flow does not involve the sheet
```

Set per source on `/studio/scraper/sources/‹key›`. `MANUAL` is the default
because it is what the owner asked for, and because the safe default for
writing into a document somebody else works in is "don't".

**A FAILED job never auto-pushes, even under `ON_COMPLETE`.** Its rows are
partial by definition — the counts up to the failure point are kept — and
publishing a partial catalogue into a shared sheet unasked is the wrong
default. It can still be pushed by hand.

### When Sheets is down

The push marks its rows `SYNC_PENDING` and returns. **The scrape still
succeeded** — the rows are safe in the database, and reporting otherwise would
be false. `retryPendingSheetSync` drains the queue when the API returns.

The retry re-pushes whole **jobs**, not individual rows: the writer merges by
key, so re-pushing updates what already landed instead of duplicating it. The
retry is free and cannot double-write.

Per-row `sheetSyncStatus` exists because the job-level flag can only say a push
_ran_, not which rows made it — which is exactly what a retry needs to know. It
also makes "nobody pushed this yet" look different from "this failed", and only
one of those needs anyone to do something.

### Push history

Every push — a job, a tier, the confirmed list, the website mirror — writes
one `SheetSyncRun` row (direction, tab, row count, status, error,
started/finished). `/studio/sheet-import`'s "Sheet push history" table is the
last 20 of them: before this, the only record of what a push did was whatever
toast happened to be on screen when it finished.

---

## Filling the catalogue from the sheet

**This already ran before it was a feature.** `npm run build` →
`prisma/bootstrap.ts` → `prisma/import-tiers.ts`, on every deploy. Phase 7 did
not build auto-fill; it put the owner in charge of one that was already
running.

| Setting               | Default | Meaning                                                                                          |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `sheetFillEnabled`    | `true`  | Master switch                                                                                    |
| `sheetFillOnDeploy`   | `true`  | A deploy triggers a fill — this is what lets a **fresh environment self-populate on first boot** |
| `sheetFillMaxCreates` | `null`  | Abort the run if it would create more than this many products                                    |

Every default reproduces the old behaviour, so an environment that never opens
the settings screen behaves exactly as it did.

**The cap guards creates, not all changes.** Creates are the direction that
hurts: a mis-sorted or re-keyed sheet inserts thousands, while updates are
already held back by `ownerTouched`. A full change-count pre-pass would mean
restructuring the importer that runs on every production deploy, which is not a
trade worth making for a guard that would mostly duplicate `ownerTouched`.

A **preview is always allowed**, even with the switch off. It writes nothing,
and refusing to show what _would_ happen is how a switch becomes something
nobody dares touch.

Every run — deploy, manual or preview — records an `ImportRun`. Before this,
the only account of what a deploy did to the catalogue was a build log nobody
keeps.

### Running it from the studio

`/studio/sheet-import`'s **Preview** button runs the whole pipeline —
reading, normalizing, the merge decision, the blast-radius pre-pass — and
writes nothing (`runTierFill({ dryRun: true })`); **Run now** does the same
run for real, without waiting for the next deploy, gated by the master switch
the same way a deploy is. Both call `src/lib/import/tier-fill.ts`'s
`runTierFill` — the same function `prisma/import-tiers.ts` calls at deploy
time, not a second implementation of the fill.

### Sheet/studio conflicts

A fill only ever refreshes availability on an owner-edited product (H5) —
never content. But silently dropping the sheet's OTHER changes to that row
forever was its own kind of loss, so when a product's `studioEditedAt` is
**after** the previous fill's start — a fresh studio edit, not one the
pipeline already knew about — and the sheet's content has also moved on that
row, the fill writes one `SheetConflict` per differing field instead
(title, price, materials, dimensions, description, in-stock). Availability
still refreshes the same as always; this is purely additional information.

`/studio/sheet-import/conflicts` resolves them, one field at a time: **keep
mine** (nothing written), **take sheet** (that field takes the sheet's value
and `studioEditedAt` bumps, so the row reads as a fresh studio decision
rather than a stale one), **skip** (nothing written, logged as a deliberate
pass). Every choice logs activity with a before-snapshot of the field.

---

## Deleting

Deleting a product in the studio removes its row from **`Added product in
website`** and **`CONFIRMED_PRODUCTS`** — a product that no longer exists
cannot be on the confirmed list.

**The tier tabs are deliberately untouched.** Those are the raw scrape decks: a
record of what a supplier's site said. Deleting a product from _this_ website
does not un-happen the scrape, and erasing it there would break the
immutable-raw rule the pipeline rests on. The `DeletedImport` tombstone written
on delete is what stops the next import resurrecting the product.

### Removing a whole source is the exception

Purging a source — `/studio/scraper/sources` → _Remove all ‹tier›_ — **does**
clear its rows from the tier tab, which is the deliberate opposite of the rule
above. There, one product left your catalogue and the scrape still happened.
Here the supplier itself is going, and its deck should go with it.

A purge takes the source, its jobs, its staged products, its price history and
its validation failures. **Live catalog products are kept** unless the dialog's
opt-in is ticked: "stop scraping this supplier" and "take these products off my
website" are different requests, and only one of them is what pressing that
button usually means. When they _are_ deleted, a `DeletedImport` tombstone goes
with each so the next deploy-time import does not resurrect them.

The confirmation names every number, because "this will remove 38 sources"
hides that it also takes twelve thousand staged products with it.

### Why deleting needed new code

`upsertRowsToTab` addresses rows by A1 range and can leave a blank. Closing the
gap needs `deleteDimension`, which takes the tab's **numeric id** rather than
its title.

Rows are deleted in **descending index order**. Delete row 5 first and
everything after shifts up one, so an ascending pass removes the wrong rows
from the second deletion onward — and that failure is silent: the call succeeds
and the sheet is quietly wrong.

`removeProductsFromSheet` never throws. The product is already gone by the time
it runs; reporting a successful delete as an error would only invite a retry
that deletes nothing.

---

## Credentials

Server-side only. Never in the client, never committed.

| Variable                         | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON`    | Service-account key, raw JSON                         |
| `GOOGLE_SERVICE_ACCOUNT_KEY_B64` | The same, base64 — for platforms that mangle newlines |
| `SCRAPE_SHEET_ID` / `SHEET_ID`   | The spreadsheet id — fallback only, see below         |

**`SiteSettings.sheetId`** (Settings → Sheets) takes priority over both
environment variables when set — `readSheetId(settings)` checks it first, so
the owner can point the whole pipeline at a different spreadsheet without a
redeploy. Blank falls straight back to the environment. `sheetTabIds` (same
screen) records each tab's numeric id, which `deleteRowsFromTab` reads before
falling back to its own metadata lookup — a small saved round trip once it's
filled in, not a requirement.

`isSheetSyncConfigured()` treats sync as **optional**: with no credentials
every path short-circuits, the studio says so plainly, and scraping continues
unaffected. That is why an environment without them is not broken — it simply
does not sync.

Not every push has been threaded the owner's `sheetId` yet — the website
mirror (`pushWebsiteProducts`, `product-sheet-sync.ts`) still resolves from
the environment only. Every push still records its `SheetSyncRun`
regardless.

> The sheet is owner-private. Anonymous CSV export returns 401, which is why
> `data/tiers/*.csv.gz` are fetched by the `fetch-tiers` Actions workflow
> rather than read live.

## Files

| Concern                                              | File                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| Sheets client (auth, upsert, delete)                 | `src/lib/scraper/sheets.ts`                                   |
| The one push writer                                  | `src/lib/scraper/sheet-push.ts`                               |
| Push policy decision                                 | `src/lib/scraper/sheet-policy.ts`                             |
| Website mirror + delete                              | `src/lib/scraper/product-sheet-sync.ts`, `website-sheet.ts`   |
| Confirmed tab                                        | `src/lib/scraper/confirm.ts`                                  |
| Fill policy                                          | `src/lib/import/fill-policy.ts`                               |
| The fill itself (preview + real, one implementation) | `src/lib/import/tier-fill.ts`                                 |
| Studio Preview / Run now / conflict resolution       | `src/actions/sheet-fill.ts`                                   |
| Actions                                              | `src/actions/scraper-sheets.ts`                               |
| Owner sheet id + tab ids                             | Settings → Sheets (`src/actions/settings.ts`'s `setSheetIds`) |
