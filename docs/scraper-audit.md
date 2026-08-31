# Phase 1 — Scraper · Studio · Sheets audit

**Against `Main` @ `23a220d`, 2026-08-24.** No code was changed to produce this.

This is the gate the master prompt (`docs/prompts/scraper-studio-sheets-master-prompt.md`
§0) requires before any implementation. Every requirement is marked:

- **EXISTS** — working today. Do not rebuild.
- **PARTIAL** — real code exists; what is missing is named precisely.
- **MISSING** — nothing to extend.

## Headline: three things that change the plan

1. **Automatic sheet → catalog fill already exists, and nothing governs it.**
   `npm run build` → `prisma/bootstrap.ts:150` → `execSync("tsx prisma/import-tiers.ts")`.
   It runs **on every deploy**, upserting on `Product.importSource + importRef`.
   Feature F1 is therefore not "build auto-fill" — it is *"take an existing
   uncontrolled automatic writer and put the owner in charge of it."* That is a
   materially different, and smaller, job.
2. **The sheet is ~64,700 rows, not a few hundred.** Tier2 alone is 35,129.
   Any design that reads or diffs whole tabs per run must be batched and capped
   from day one; the blast-radius control is not a nicety here.
3. **`createTierJobs("ALL")` fans out across every enabled source**, and
   **nothing stops two concurrent jobs for the same source.** Those are the two
   concrete defects behind the owner's "scrape only the site I selected".

---

# 1. Source, job and crawl layer

| # | Requirement | Verdict | Evidence / what is missing |
|---|---|---|---|
| 2 | Source registry | **EXISTS** | `model ScrapeSource` — `key`, `name`, `baseUrl`, `tier`, `platform`, `enabled`, `verifiedAt`, `supply`, `notes` |
| 2 | Per-source health counters | **MISSING** | No `lastScrapedAt` / `lastStatus` / `productCount` / `consecutiveFailures` on `ScrapeSource` |
| 3 | Scrape one selected source | **PARTIAL** | `createScrapeJob()` already takes a single `sourceId` (or raw URL). But `createTierJobs("ALL")` exists beside it and fans out over **every enabled source** — `src/actions/scraper-jobs.ts:495` |
| 45 | Skip-overlap | **MISSING** | No guard on create. `continueScrapeJob` checks `status`, but pressing Scrape twice queues two jobs for one source |
| 4 | Category discovery | **MISSING** | No `ScrapeCategory` model, no discovery stage. Sitemap helpers exist (`src/lib/scraper/sitemaps.ts`) but feed URL discovery, not a category tree |
| 4 | Enable/disable a category | **MISSING** | Follows from the above |
| 5 | Scope: entire / categories / products | **PARTIAL** | Whole-source and single-URL paths exist; category scoping cannot exist without a category model |
| 6 | Product URL discovery, pagination | **EXISTS** | Adapter-driven; `cursorPage` paginates |
| 6 | Canonical URL normalization | **PARTIAL** | `src/lib/scraper/fingerprint.ts` + the `@@unique([sourceKey, externalId])` constraint dedupe by identity. No explicit URL canonicalizer for tracking params |
| 7 | Resumable crawling | **EXISTS** | `ScrapeJob.cursorPage` + `continueScrapeJob()` — a restart continues, it does not restart |
| 8 | Durable job rows | **EXISTS** | `model ScrapeJob` — `status`, `currentStage`-equivalent, `totalScraped`, `newCount`, `updatedCount`, `error`, `finishedAt` |
| 8 | Job states | **PARTIAL** | `QUEUED RUNNING DONE FAILED`. No `PAUSED`, `PARTIAL`, `CANCELLED` |
| 9 | Named stages | **MISSING** | Progress is counters, not a stage enum |
| 10 | Live progress from the DB | **EXISTS** | UI reads `ScrapeJob`; `job-dashboard.tsx` |
| 46 | Per-source concurrency / delay | **MISSING** | No `requestDelayMs` / `maxConcurrency` / `timeout` on `ScrapeSource` |
| 47 | Circuit breaker | **MISSING** | `src/lib/scraper/health.ts` is derived *display* state (health computed from the latest job + staged count) — it reports, it does not intervene. No pause-on-N-failures |
| 48 | Retry / backoff | **PARTIAL** | Present in the Sheets client; not a shared fetch policy |
| 49 | Adapter registry | **EXISTS** | `src/lib/scraper/adapters/` — `shopify.ts`, `woocommerce.ts`, `jsonld.ts`, dispatched by `index.ts` |
| — | Robots / SSRF safety | **EXISTS** | `src/lib/scraper/robots.ts`, `ssrf.ts` — **do not weaken these** |
| 44 | Scheduling | **MISSING** | No schedule model. `fetch-tiers.yml` is a GitHub Action, not an owner-facing schedule |

# 2. Product data layer

| # | Requirement | Verdict | Evidence / what is missing |
|---|---|---|---|
| 11 | Product detail extraction | **EXISTS** | `ScrapedProduct` carries title, description, prices, materials, dimensions, images, `fields` JSON, SEO |
| 12 | Variants as first-class | **MISSING** | No `ProductVariant` model anywhere. Variant data, if captured, lands in `fields` JSON |
| 13 | Image extraction | **PARTIAL** | `images` / `imageAlts` JSON on `ScrapedProduct`; `mirror-images.yml` mirrors them. No per-image model, no content-hash dedupe of image bytes |
| 14 | Immutable raw data | **EXISTS** | `ScrapedProduct` is the staged record; promotion writes a separate catalog `Product`. Raw is never edited by promotion |
| 14 | Raw snapshot per scrape | **PARTIAL** | `contentHash`, `firstSeen`, `lastSeen` detect change; there is no snapshot history table |
| 15 | Validation failures | **MISSING** | No `ValidationFailure` model. Failures currently vanish |
| 16 | Data-quality dashboard | **MISSING** | Follows from the above |
| 17 | Duplicate detection | **EXISTS** | `@@unique([sourceKey, externalId])` on `ScrapedProduct`; `@@unique([importSource, importRef])` on `Product` |
| 18 | Deterministic identity | **EXISTS** | Same source product resolves to the same row through those keys |
| 19 | Change detection | **PARTIAL** | `contentHash` gives changed/unchanged and `newCount`/`updatedCount`. No per-field diff, no `REMOVED_FROM_SOURCE` |
| 20 | Price history | **MISSING** | No `PriceHistory` model. Price changes overwrite |
| 21 | Field-level ownership | **PARTIAL** | Enforced structurally by the two-table split (staged vs catalog). No `sourceX` / `studioX` / `finalX` columns and **no `studioEditedAt`**, so conflict detection has no timestamp to reason with |
| 22 | Normalization | **PARTIAL** | `src/lib/scraper/category-map.ts` + `/studio/scraper/mapping`. Category only — no material / colour / unit aliases |

# 3. Google Sheets

**The sheet:** `1f4_cl3-8JrYIFTPNhSsuMEl8GAET1n61L9ZZKL8npa8`.
`data/tiers/README.md` records that it is **owner-private** — anonymous CSV
export returns 401 — which is why the full tabs are fetched by an Actions
workflow rather than read live in CI.

**Real tab inventory**, from the gzipped exports committed at `23a220d`:

| Tab | Rows | Schema |
|---|--:|---|
| `Tier1_Owner` | 373 | 26-column ScrapeDeck |
| `Tier2_ResinGoods` | 35,129 | identical |
| `Tier3_Supplies` | 21,509 | identical |
| `Tier4_3DPrint` | 7,686 | identical |
| `OwnerSheet` (gid 630660076) | 373 | identical — appears to duplicate Tier1 |

All five share exactly:

```
sourceKey, vertical, externalId, title, slug, category, shortTagline,
description, priceMin, priceMax, currency, showPrice, timeline, materials,
dimensions, status, featured, images, imageAlts, fields, seoTitle,
seoDescription, url, firstSeen, lastSeen, contentHash
```

| # | Requirement | Verdict | Evidence / what is missing |
|---|---|---|---|
| 23 | Sheets connection | **EXISTS** | `src/lib/scraper/sheets.ts` — service-account JWT via `getAccessToken()` |
| 23 | Header-based mapping | **EXISTS** | `upsertRowsToTab({ header, keyOf })` |
| 24 | Tabs | **PARTIAL** | Tier tabs + `Sheet1` in use. **No `CONFIRMED_PRODUCTS`, no `VALIDATION_ERRORS`, no `SYNC_LOG`** |
| 25 | Scraped-products tab | **EXISTS** | The tier tabs *are* this, with the 26-column schema above |
| 26 | Studio-products tab | **MISSING** | `Sheet1` is bulk-upload format, not a Studio mirror |
| 27 | Confirmed-products tab | **MISSING** | Nothing writes a confirmed-only list |
| 28 | Auto-sync on scrape | **MISSING** | `sheetSynced` is written only by `scraper-sheets.ts`. No completion hook — so today's behaviour is already "MANUAL" |
| 29 | No duplicate rows | **EXISTS** | Tier tabs merge on `sourceKey\|externalId`; `Sheet1` merges on `slug` |
| 36 | Sheet → Studio sync | **PARTIAL** | `previewImport()` / `runImport()` at `/studio/sheet-import` |
| 37 | Conflict detection | **MISSING** | No conflict surface; no `studioEditedAt` to detect with |
| 38 | Sheets-down resilience | **PARTIAL** | `isSheetSyncConfigured()` treats sync as optional so scraping survives. No `SYNC_PENDING` queue, no retry drain |
| 39 | Batch operations | **EXISTS** | `upsertRowsToTab` batches |
| 40 | Credential security | **EXISTS** | `GOOGLE_SERVICE_ACCOUNT_JSON` / `_KEY_B64` + `SCRAPE_SHEET_ID`, server-only |
| 71 | Per-product sync status | **MISSING** | Job-level `sheetSynced` boolean only |
| 72 | Sync log | **MISSING** | No `SheetSyncRun` model |

# 4. Studio, approval, operations

| # | Requirement | Verdict | Evidence / what is missing |
|---|---|---|---|
| 31 | Select products | **EXISTS** | `review-grid.tsx` — selection + bulk status |
| 33 | Bulk actions | **EXISTS** | `setScrapedReviewStatus()`, `approve-import-dialog.tsx`, `add-to-catalog-dialog.tsx` |
| 52 | Workflow states | **PARTIAL** | `ReviewStatus { PENDING APPROVED REJECTED IMPORTED }`. No `DRAFT` / `IN_REVIEW` / `READY` / `CONFIRMED` / `ARCHIVED` |
| 32 | Never auto-confirm | **EXISTS (by absence)** | No path promotes without an operator action |
| 34 | Confirmation validation | **PARTIAL** | `addScrapedToCatalog` requires a resolvable category; `sendScrapedToSheet1` skips rows without one |
| 35 | Confirmation audit | **PARTIAL** | `logActivity()` records the action; no `confirmedBy` / `confirmedAt` on the row |
| 43 | Re-scrape one product | **PARTIAL** | Single-URL job path exists; not surfaced as a per-product button |
| 57 | Data-quality triage | **MISSING** | Depends on `ValidationFailure` |
| 58 | Activity log | **EXISTS** | `src/lib/activity.ts` + `/studio/activity` |
| 59 | Workflow monitoring | **PARTIAL** | Job list exists; no trigger-source column |
| 60 | Notifications | **MISSING** | `src/lib/email.ts` exists to build on |
| 65 | Unconfirm | **MISSING** | — |
| 66 | Archiving | **PARTIAL** | `DeletedImport` tombstones exist for sheet-imported deletions |
| 67 | Indexing | **EXISTS** | `@@index([status, createdAt])`, `@@index([reviewStatus])`, `@@index([jobId])`, `@@index([tier, enabled])` |
| 68 | Performance | **PARTIAL** | Server pagination in the studio; no virtualization for 35k-row tabs |

---

# 5. The two requested features, restated against reality

## F1 — controlled automatic fill *from* the sheet

**Not missing. Existing and ungoverned.**

What exists: a deploy-triggered importer (`prisma/import-tiers.ts`), idempotent
on `importSource + importRef`, with hardcoded per-tier caps (Tier1 all,
Tier2 1,000, Tier3 2,500, Tier4 500 — `prisma/bootstrap.ts:142-147`),
`DeletedImport` tombstones so an owner deletion is never resurrected, and a
`try/catch` that lets a failed import not break the deploy.

What is missing is the *control*:

| Control | State |
|---|---|
| Owner-visible on/off | MISSING — it is tied to deploys, not to intent |
| Trigger choice (on-change / schedule / manual) | MISSING |
| Scope filter (e.g. only `status = READY` rows) | MISSING — and note the tier schema's `status` column holds `active` / `out_of_stock`, **not** a workflow status, so a new column is needed for this |
| Preview / dry-run | MISSING |
| Conflict policy | MISSING — no `studioEditedAt` |
| Blast-radius cap | MISSING — the caps that exist are per-tier volume limits, not change-size guards |
| Run history + report | MISSING — no `ImportRun` |

**Recommendation:** keep `import-tiers.ts` as the engine, move the *trigger* out
of `bootstrap.ts` and behind the policy, and make the deploy-time run one of the
policy's options rather than the only behaviour. Removing it from the deploy
path outright would change how new environments come up — decide deliberately.

## F2 — gated automatic push *to* the sheet

**MANUAL already exists; the policy and the gate do not.**

`syncJobToSheet()` / `syncTierToSheet()` / `sendScrapedToSheet1()` are manual and
idempotent. Nothing fires on job completion, so today's behaviour is exactly the
`MANUAL` default the prompt proposes. What is missing: `SheetSyncPolicy` on
`ScrapeSource`, the completion hook for `ON_COMPLETE`, per-product sync status,
and the `SYNC_PENDING` retry queue.

## I1 — scrape only the selected source

`createScrapeJob()` is already single-source. The defects are `createTierJobs("ALL")`
sitting beside it and the absent overlap guard.

## I2 — confirmed means a human said so

Structurally safe today (nothing auto-promotes), but there is no `CONFIRMED`
state, no confirmed-only tab, and no confirm/unconfirm audit columns.

---

# 6. The six open questions, answered

1. **Confirmed tab already present?** No. Five tabs exported, all the same
   scrape-deck schema. `CONFIRMED_PRODUCTS` must be created.
2. **`Sheet1`'s real headers?** Not in the export set — only the tier tabs were
   fetched. `Sheet1` is written by `syncProductsToSheet1()` in bulk-upload column
   format, merged on `slug` (column B). **Read `PRODUCT_SHEET_COLUMNS` in
   `src/lib/scraper/product-sheet.ts` before touching it** rather than reading the
   live tab.
3. **An existing status column to scope auto-fill on?** No usable one. The tier
   schema's `status` is the source's stock state (`active` / `out_of_stock`). A
   workflow-status column must be added, and adding a column to a 35k-row tab
   needs the batched writer.
4. **Should `CONFIRMED_PRODUCTS` mirror catalog `Product` or staged
   `ScrapedProduct`?** **Catalog `Product`.** `Product` is what the storefront
   serves and what Studio edits; `ScrapedProduct` is immutable raw. A confirmed
   list built from raw would show pre-edit titles — the opposite of its purpose.
5. **Who is "the owner" for notifications?** Unresolved in code. `src/lib/email.ts`
   exists; there is no owner-notification address setting. **Ask before building.**
6. **Provenance link already present?** **Yes.** `Product.importSource` +
   `Product.importRef` with `@@unique([importSource, importRef])`
   (`prisma/schema.prisma:96-119`). Phase 9 does not need to establish it.

---

# 7. What this changes about the plan

| Phase | Revision |
|---|---|
| 2 — schema | Larger than assumed. Six models are genuinely absent: `ValidationFailure`, `PriceHistory`, `ProductVariant`, `SheetSyncRun`, `ImportRun`, plus a category model. Split into two migrations |
| 4 — I1 | Smaller than assumed. Add an overlap guard, gate `createTierJobs`, name the button. Roughly a day |
| 5 — F2 | As scoped. `MANUAL` is already the de-facto behaviour, so this is additive and low-risk |
| 7 — F1 | **Re-scope.** Governing an existing deploy-time writer, not building a new one. The risky part is changing *when* it runs without breaking environment bootstrap |
| — | **New, unscheduled:** category discovery is a genuine greenfield block (no model, no stage). If category-scoped scraping matters, it is its own phase |
| — | **New, unscheduled:** variants are entirely absent. The prompt inherits "variants are first-class" from the merchandiser reference, but this catalog may not need them. **Confirm with the owner before building a `ProductVariant` model** |

## Recommended next step

Phase 4 (I1) before Phase 2. It is small, it is one of the owner's two stated
asks, it needs no schema change beyond two nullable columns, and it removes a
live foot-gun: `createTierJobs("ALL")` queues a job for every enabled source
in one press, against sites whose tabs already run to tens of thousands of rows.

## One thing to decide before any of it

`import-tiers.ts` runs on every deploy today. Any F1 work changes that. Confirm
with the owner whether a fresh environment should still self-populate from the
sheet on first boot, because that is what the current behaviour buys and it is
easy to remove by accident.
