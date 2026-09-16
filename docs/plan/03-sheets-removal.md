# C — Complete removal of Google Sheets

> **Blocked on D27.** The attached rebuild document makes Google Sheets first-class (Prompt 29, the
> canonical column list, Definition-of-Done item 13). The user's instruction removes it. The
> instruction wins; DoD item 13 is restated as *"export the confirmed list as CSV/XLSX."*

---

## 1. The finding that makes this safe

`CLAUDE.md` says: *"Sheet→catalog fill has run on every deploy since long before it was a feature
(`bootstrap.ts` → `import-tiers.ts`)."* Read quickly, that says removing Sheets severs catalog
ingestion on every fresh environment.

It does not. **`src/lib/import/tier-fill.ts` never calls the Google Sheets API.** It reads committed
CSV files:

```
src/lib/import/tier-fill.ts:145   function readTab(tab)
    data/tiers/<Tab>.csv.gz   →   data/tiers/<Tab>.csv   →   data/tiers/sample/<Tab>.sample.csv
```

`data/tiers/` is 15 MB of gzipped CSV, in the repository:
`Tier1_Owner` · `Tier2_ResinGoods` (7.6 MB) · `Tier3_Supplies` (4.5 MB) · `Tier4_3DPrint` (3.0 MB) ·
`OwnerSheet_gid630660076`. There is no `googleapis` npm dependency anywhere in `package.json` —
`sheets.ts` is a hand-rolled service-account JWT client against the REST API.

**Catalog fill, the deploy-time bootstrap, the blast-radius cap, the H5 merge protection and the
conflict queue all survive removal untouched.** The live Sheets surface is the *write* direction
only: pushing scraped and website rows out to the owner's spreadsheet.

---

## 2. What is Sheets, and what only sounds like it

This distinction is the whole plan. Getting it wrong deletes the catalog importer.

### 2.1 REMOVE — genuinely Google Sheets

| Path | Lines | What it is |
|---|---|---|
| `src/lib/scraper/sheets.ts` | 400 | The service-account JWT + Sheets v4 REST client |
| `src/lib/scraper/sheet-push.ts` | 161 | The one write engine; writes `SheetSyncRun` |
| `src/lib/scraper/sheet-settings.ts` | 28 | Resolves spreadsheet/tab ids |
| `src/lib/scraper/sheet-policy.ts` (+ test, 90) | 28 | `MANUAL`/`ON_COMPLETE`/`OFF` |
| `src/lib/scraper/sheet-delete-plan.ts` (+ test, 114) | 66 | Descending-order `deleteDimension` planner |
| `src/lib/scraper/product-sheet-sync.ts` | 111 | Website-mirror push |
| `src/lib/scraper/website-sheet.ts` (+ test) | 80 | Website tab contract |
| `src/actions/scraper-sheets.ts` | 405 | All the push/sync Server Actions |
| `src/components/studio/scraper/sheet-sync-button.tsx` | — | |
| `src/components/studio/settings/sheet-ids-section.tsx` | — | |
| `src/components/studio/products/website-sheet-button.tsx` | — | |

Plus the call sites: `scraper-jobs.ts` (the `ON_COMPLETE` hook, ~lines 33–35, 869), `products.ts`
(`removeProductsFromSheet`), `scraper-sources.ts`, `scraper-review.ts`, and the sheet-policy block
in `source-detail.tsx` and `settings-form.tsx`.

### 2.2 KEEP — named "sheet", not Google Sheets

| Thing | Why it stays | Action |
|---|---|---|
| `src/lib/import/tier-fill.ts` (48 KB) | Reads `data/tiers/*.csv.gz`. **The catalog importer.** | Keep |
| `src/lib/import/{parse,validate,templates,fill-policy}.ts` | CSV/XLSX parsing via `papaparse`/`exceljs` | Keep |
| `data/tiers/*` | The source data itself | Keep |
| `prisma/import-tiers.ts`, `prisma/bootstrap.ts` | Deploy-time fill | Keep |
| **`SheetConflict`** | Written by **`tier-fill.ts:1308`**, read by `actions/sheet-fill.ts` and `studio-inbox.ts`. A *CSV import* conflict. | **Keep, rename `ImportConflict`** |
| `src/actions/sheet-fill.ts` | The CSV fill actions | **Keep, rename `catalog-fill.ts`** |
| `/studio/sheet-import` + `/conflicts` | The CSV fill UI. Never touches the Sheets API. | **Keep, rename `/studio/catalog-fill`** |
| `SiteSettings.sheetFillEnabled` · `sheetFillOnDeploy` · `sheetFillMaxCreates` | Govern the **CSV** fill | **Keep, rename `catalogFill*`** |
| `Product.contentHash` · `ownerTouched` | H5 merge protection for the CSV fill | Keep, unchanged |
| `src/lib/scraper/export.ts` | Serves `/api/scraper/export` (CSV) *and* the sheet sync | **Keep** — drop only the sheet consumer |
| `src/lib/scraper/product-sheet.ts` | Exports `DEFAULT_CARE_NOTES`, imported by `tier-fill.ts:9` | **Split** — keep the care notes and column contract, drop the sheet-row builder |

### 2.3 Schema

**Drop** — `enum SheetSyncPolicy` · `enum SheetSyncStatus` · `model SheetSyncRun` ·
`ScrapeSource.{sheetSyncPolicy, lastSheetSyncAt, lastSheetSyncError}` ·
`ScrapeJob.sheetSynced` · `ScrapedProduct.{sheetSyncStatus, sheetSyncedAt, sheetSyncError}`
and its `@@index([sheetSyncStatus])` · `SiteSettings.{sheetId, sheetTabIds}`.

**Rename** — `SheetConflict → ImportConflict` (and `sheetValue → importedValue`) ·
`SiteSettings.sheetFill* → catalogFill*`.

### 2.4 Environment and docs

Remove from `src/lib/env.ts` (lines 57–60) and every deployment target:
`GOOGLE_SERVICE_ACCOUNT_JSON` · `GOOGLE_SERVICE_ACCOUNT_KEY_B64` · `SCRAPE_SHEET_ID` · `SHEET_ID`.
Revoke the service account in Google Cloud and un-share the spreadsheet — code removal is not
access removal.

Rewrite or archive: `docs/google-sheets.md`, `QA/11-GOOGLE-SHEETS-AUDIT.md`,
`docs/prompts/scraper-studio-sheets-master-prompt.md`, and the Sheets sections of `CLAUDE.md`,
`README.md`, `ADMIN_GUIDE.md`, `DEPLOYMENT.md`, `INSTALL.md`, `CONTENT_GUIDE.md`, `BACKUP_GUIDE.md`,
`CONTEXT.md`, `PROJECT_STATE.md`, `AGENTS.md`, `docs/scraper.md`, `docs/transformation-*.md`,
`data/tiers/README.md`. `CLAUDE.md`'s scraper section has five Sheets bullets that become wrong the
moment this ships — an agent reading a stale rule is worse than no rule.

---

## 3. What replaces it

The owner loses one capability: *"push the confirmed list somewhere I can open in a spreadsheet."*
Three things replace it, in order of how much they matter:

1. **Confirmed-products export (CSV + XLSX).** `exceljs` and `papaparse` are already dependencies
   and `export.ts` already defines a stable column order. A download button on the new Confirmed
   Products screen ([`02`](02-scraper-rebuild.md) §6), emitting the attached document's canonical
   field keys — `internal_product_id`, `source_name`, `canonical_product_type`, `price_basis`,
   `length_mm`, `resin_style`, `shortlist_state`, `confirmed_at` and the rest. Machine-friendly
   keys, not presentation labels, exactly as the document specifies.
2. **The Confirmed Products screen itself.** A spreadsheet was the owner's *view* of the confirmed
   list as much as its transport. A real screen with filters and bulk actions is better than the
   spreadsheet it replaces.
3. **Scheduled export** (optional, later). If the owner wants a file without opening the Studio,
   a cron writes the CSV to Blob storage and emails a link. Do not build this until asked.

**Ingest direction:** already covered by `/studio/import` and the `data/tiers` CSV fill. Nothing new.

---

## 4. Migration

Destructive. Sequence matters.

```
1. Export first.   SheetSyncRun and SheetConflict → CSV → docs/archive/sheets-YYYY-MM-DD/
                   Committed. This is the only copy of the sync history.
2. Migration 1 — additive
     rename  SheetConflict → ImportConflict          (@@map keeps the table)
     rename  SiteSettings.sheetFill* → catalogFill*
     No drops. Ship. Verify the CSV fill still runs on deploy.
3. Code removal
     Delete §2.1. Fix call sites. Remove env vars.
     npm run typecheck && npm run lint && npm run test && npm run test:db
4. Migration 2 — drops
     enums, SheetSyncRun, and the six columns in §2.3.
5. Docs sweep — §2.4. Same PR as step 3, so the tree is never self-contradictory.
6. Revoke the service account. Un-share the spreadsheet.
```

> **Status (2026-09-16).** Steps 1–6 ran on 2026-09-15 (`docs/archive/sheets-2026-09-15/`,
> migration `20260915150000_drop_sheets_schema`, PRs #73–#75). One item in §2.3's drop list
> was missed by step 4: **`SiteSettings.{sheetId, sheetTabIds}`** were never read after step 3
> but were neither un-modelled nor dropped. They came out of `schema.prisma` on 2026-09-16
> with **no migration** — the same step-4a shape the seven push-state columns went through,
> because `findMany()` without a `select` names every column and a drop under the old client
> fails every `SiteSettings` query. **Still owed, in its own PR after that client is
> deployed:** `ALTER TABLE "SiteSettings" DROP COLUMN "sheetId", DROP COLUMN "sheetTabIds";`
> — hand-written, like every migration here, because `prisma migrate diff` re-proposes
> dropping the three trgm search indexes the schema does not model.

Splitting rename-then-drop across two migrations means step 2 is reversible and step 4 runs against
a tree already proven to work without the Sheets code paths.

---

## 5. Ordering against the scraper rebuild

Do **not** remove the push before the replacement export exists. The sequence in
[`README.md`](README.md) puts Sheets-removal phase 1 (the export) at phase 2 and the deletion at
phase 4, with the scraper rebuild's confirmed-product flow (B7) in between.

If the scraper rebuild slips, the removal can still proceed — but then step 3 must also ship a
minimal CSV download over the *existing* `ScrapedProduct` confirmed set, using `export.ts`'s
existing columns. The owner must never be left without an export path.

---

## 6. Tests to update

| Test | Change |
|---|---|
| `src/lib/scraper/sheet-policy.test.ts` | Delete. It asserts `sheet-push.ts` is the only writer. |
| `src/lib/scraper/sheet-delete-plan.test.ts` | Delete with its module. |
| `src/lib/scraper/website-sheet.test.ts` | Delete with its module. |
| `src/lib/studio-limits.test.ts` | Drop the sheet assertions. |
| `tests/db/media-query.test.ts` | Check for sheet references. |
| `src/lib/import/tier-fill.test.ts` | Update for the renamed settings fields. **Must stay green throughout** — it is the proof the catalog importer survived. |
| `scripts/e2e-smoke.mjs` | The sheet-fill preview check stays (it is the CSV fill); update the route name. |
| **New** | A `test:db` case asserting the confirmed-products export emits the canonical column keys. |
