# ResinRiva 2.0 — Scraper · Studio · Google Sheets
## Master build prompt (v2, grounded against the live repo)

> **How to use this.** Paste §0–§3 into a fresh session and let the agent produce
> its audit before it writes any code. Then run §10's phases one per session,
> reviewing between each. Phases marked ⚑ are where the design decision matters —
> expect to argue with the first answer rather than accept it.

---

# 0. THE ONE INSTRUCTION THAT MATTERS MOST

**This is not a greenfield build. Most of what follows already exists.**

A previous version of this spec read as "build a complete ingestion engine",
which invites an agent to create a second, parallel scraper beside the working
one. That would be the single most expensive mistake available here.

Before writing one line of code, produce `docs/scraper-audit.md` mapping **every
requirement in this document** to one of:

```
EXISTS          — name the file, function, model. Do not touch it.
EXISTS-PARTIAL  — name it, and state precisely what is missing.
MISSING         — state where it will live, consistent with existing structure.
```

**Do not proceed past the audit without showing it.** A requirement marked
MISSING that turns out to be EXISTS is a rebuild, and a rebuild is a regression.

## 0.1 What the audit will find (verified 2026-08-24, `Main`)

This is not a guess. These exist today:

| Concern | Where it lives now |
|---|---|
| Source registry | `model ScrapeSource` — `key`, `name`, `baseUrl`, `tier`, `platform`, `enabled`, `verifiedAt` |
| Durable job rows | `model ScrapeJob` — `status`, `cursorPage`, `totalScraped`, `newCount`, `updatedCount`, `sheetSynced`, `error`, `finishedAt` |
| Staged (raw) products | `model ScrapedProduct` — `@@unique([sourceKey, externalId])`, `contentHash`, `firstSeen`, `lastSeen`, `reviewStatus`, `importedProductId` |
| Job lifecycle | `enum ScrapeJobStatus { QUEUED RUNNING DONE FAILED }` |
| Review lifecycle | `enum ReviewStatus { PENDING APPROVED REJECTED IMPORTED }` |
| Source tiers | `enum ScrapeTier { OWNER RESIN_GOODS SUPPLIES PRINT3D }` |
| Platform adapters | `src/lib/scraper/adapters/` — `shopify.ts`, `woocommerce.ts`, `jsonld.ts`, dispatched via `index.ts` |
| Resumable crawling | `ScrapeJob.cursorPage` + `continueScrapeJob()` in `src/actions/scraper-jobs.ts` |
| Run / continue / fan-out | `createScrapeJob()`, `continueScrapeJob()`, `createTierJobs()`, `getScrapeJobs()`, `deleteScrapeJobs()` |
| Review + promote | `src/actions/scraper-review.ts` — `setScrapedReviewStatus()`, `updateStagedProduct()`, `importApprovedScraped()`, `addScrapedToCatalog()`, `sendScrapedToSheet1()` |
| Google Sheets client | `src/lib/scraper/sheets.ts` — `getAccessToken()`, `upsertRowsToTab()`, `syncRowsToSheet()`, `syncProductsToSheet1()`, `isSheetSyncConfigured()`, `TAB_BY_TIER` |
| Sheet sync actions | `src/actions/scraper-sheets.ts` — `syncJobToSheet()`, `syncTierToSheet()` |
| Sheet → catalog import | `src/actions/import.ts` — `previewImport()`, `runImport()`; UI at `/studio/sheet-import` |
| Import parsing/validation | `src/lib/import/` — `parse.ts`, `templates.ts`, `validate.ts` |
| Safety | `src/lib/scraper/robots.ts`, `src/lib/scraper/ssrf.ts` |
| Dedupe / change detection | `src/lib/scraper/hash.ts`, `fingerprint.ts` |
| Category mapping | `src/lib/scraper/category-map.ts`, UI at `/studio/scraper/mapping` |
| Studio surfaces | `/studio/scraper` (+ `sources`, `review`, `mapping`), `/studio/sheet-import`, `/studio/import`, `/studio/products` |
| Sheet tabs in use | `Tier1_Owner`, `Tier2_ResinGoods`, `Tier3_Supplies`, `Tier4_3DPrint`, `Sheet1` (bulk-upload format) |
| Idempotent sheet writes | `upsertRowsToTab()` merges on a key — tier tabs by `sourceKey\|externalId`, Sheet1 by `slug` |

**Therefore:** the correct shape of this work is *policy, gating, and control
surfaces layered onto a working pipeline* — not a new pipeline.

---

# 1. WHAT THE OWNER ACTUALLY ASKED FOR

Two capabilities, stated plainly, plus two invariants that must hold around them.

### F1 — Control over automatic product fill *from* the Google Sheet
Today `/studio/sheet-import` is a manual, one-shot import. The owner wants the
fill to be able to run **automatically**, and wants **control over it** — to arm
it, disarm it, scope it, preview it, and trust that it will never surprise them.

### F2 — Push scraped products to the sheet automatically, on the owner's word
Today `syncJobToSheet()` / `sendScrapedToSheet1()` are manual buttons. The owner
wants the push to be **fully automatic in mechanism** — no CSV, no copy-paste —
but **triggered by intent**: *"when I say add, then add."*

### I1 — Scraping targets exactly the source the owner selected
`createTierJobs()` can fan out across a whole tier. That must never be what a
plain **Scrape** press does.

### I2 — Only explicitly selected products reach the confirmed list
`CONFIRMED_PRODUCTS` is the final catalog handoff. Nothing arrives there by
scraping, by importing, or by editing. Only by a human selecting it and
confirming.

## 1.1 A contradiction you must resolve, not inherit

The previous spec said, in §28:

> "When user clicks SCRAPE NOW the system must … automatically sync
> SCRAPED_PRODUCTS. User must NOT have to export manually."

and the owner now says:

> "…when I say to add, at that time we add product on that sheet."

**These are not compatible as written.** Resolve them as *one mechanism with a
policy*, not two code paths:

```
The sync ENGINE is always automatic — batched, idempotent, retrying.
WHEN it fires is a per-source POLICY the owner sets.
```

```
enum SheetSyncPolicy {
  MANUAL      // staged only; fires on an explicit "Add to Sheet"   ← DEFAULT
  ON_COMPLETE // fires automatically when a scrape job reaches DONE
  OFF         // never fires; sheet is not part of this source's flow
}
```

`MANUAL` is the default because it is the owner's stated preference and because
the safe default for a write to a shared external document is "don't".
`ON_COMPLETE` satisfies "no manual export" for sources the owner trusts.

**Never** implement this as two separate write paths. One writer, one policy
check at the trigger point.

---

# 2. NON-NEGOTIABLE CONSTRAINTS

## 2.1 Business rules — from `CLAUDE.md`, these outrank everything below

- **No AI-invented products, ever.** The catalog is filled ONLY by owner action:
  scraper review + approval, Bulk Import, or a manual `/studio` add. Anything in
  this document that appears to auto-create catalog products is misread — every
  path ends at a human pressing a button.
- **No payment gateway, checkout, or cart payment.** Every order finalizes through
  WhatsApp at `wa.me/917096036250`.
- **No customer accounts.** The only login is the staff studio at `/studio`.
- The storefront's product data, filtering, search, customization fields, uploads,
  Server Actions, auth, URLs and routes are off-limits to redesign.

## 2.2 Architectural invariants — stated up front because rediscovering them is expensive

These come from the merchandiser reference architecture, and each one exists
because its absence caused an incident somewhere:

1. **Raw scraped data is immutable.** `ScrapedProduct` is the source record.
   Corrections never edit it. `ScrapedProduct` → catalog `Product` is a promotion,
   not a mutation. If a normalization rule changes, the raw row still says what
   the site said.
2. **Normalize at compute time, not at ingest.** Alias/mapping tables
   (`category-map.ts` and its successors) are applied when producing the promoted
   record — so fixing a mapping does not require a re-scrape.
3. **Durable job rows are the source of truth for progress.** The UI reads
   `ScrapeJob`, never a live process handle. Progress must survive a redeploy.
4. **Never silently null a failed extraction.** A field that fails to parse writes
   a validation-failure row. Silence is how a catalog rots quietly.
5. **Scheduled and manual runs are the same workflow with the same job identity.**
   A schedule is an automated button press, not a parallel code path.
6. **Skip-overlap.** A source already RUNNING does not start a second job.
7. **Field-level ownership.** `sourceTitle` / `studioTitle` / `finalTitle` are
   distinct. A re-scrape may never clobber a Studio edit.
8. **Idempotency everywhere.** Re-running a scrape, re-syncing a row, re-confirming
   a product must all be no-ops, not duplicates.

## 2.3 Repo conventions that will fail CI if ignored

- Next.js 16.3 App Router, React 19, TypeScript **strict**, no `any`, named exports.
  Server Components by default; `"use client"` only for interactivity.
- **Read `node_modules/next/dist/docs/` before writing App Router code** — this
  Next version differs from training data; middleware is `src/proxy.ts`.
- Server Actions go through `runAction()` + `requireStaff()` from
  `src/actions/helpers.ts`, and write `logActivity()`. `runAction` reports every
  throw as "Something went wrong" — so **validate in the UI before the call** when
  the operator needs to know *what* was wrong.
- **Never call setState synchronously in an effect body** — `react-hooks/set-state-in-effect`
  is a hard gate. Use `useSyncExternalStore` or an event callback.
- Cache reads behind named tags with a 24h TTL and `revalidateTag(TAG, "max")`.
  **Never `revalidatePath('/', 'layout')`.**
- Studio is English-only by design; the storefront is nine locales including RTL.
  If any of this work touches storefront copy, the key goes in `messages/en.json`
  first, then all eight others — `scripts/i18n-missing.mjs` is a CI gate now.
- Tailwind tokens only, no raw hex, logical properties (`ps-`/`pe-`/`ms-`/`me-`).
- Vitest covers pure `src/lib` functions. There is no component-test runner.
- **CI gates every PR:** typecheck · lint · `copy:check` · translation coverage ·
  unit tests · a real production build against throwaway Postgres · the design and
  a11y audits over 12 routes at 1440px and 390px · a Lighthouse budget
  (perf ≥ 85, a11y ≥ 95). All must stay green.

---

# 3. FEATURE F1 — CONTROLLED AUTO-FILL FROM THE GOOGLE SHEET ⚑

**Sheet:** `https://docs.google.com/spreadsheets/d/1f4_cl3-8JrYIFTPNhSsuMEl8GAET1n61L9ZZKL8npa8/edit?gid=0#gid=0`

**Inspect the live sheet's headers before designing anything.** Do not assume the
column set. Map by header name, never by index. Never write to a hidden row number.

## 3.1 The problem with "automatic"

An unattended writer into the owner's catalog is the highest-risk thing in this
entire document. A bad row in a spreadsheet becomes a bad product on a live
storefront. So automatic here means **armed, scoped, previewed, reversible** —
not unattended.

## 3.2 The control surface

Extend `/studio/sheet-import` (do not create a new page):

```
GOOGLE SHEET → CATALOG

Sheet          ScrapeDeck · Sheet1                    [ Change ]
Last filled    24 Aug 2026, 14:02 · 12 created, 3 updated

Automatic fill                                      [ ON  ● ]

  Runs            ( ) When the sheet changes
                  (●) On a schedule   [ Daily ▾ ] [ 02:00 ▾ ]
                  ( ) Never — I will press Fill myself

  Scope           Only rows where  Status = READY
                  Only these tabs  [ Sheet1 ▾ ]

  On conflict     (●) Keep the Studio value, flag it
                  ( ) Take the sheet value
                  ( ) Skip the row entirely

  Safety          ☑ Never publish — new products arrive as DRAFT
                  ☑ Stop the run if more than [ 25 ] rows would change
                  ☑ Email me a summary after every automatic run

[ Preview Fill ]                              [ Fill Now ]
```

Every one of those controls exists for a reason:

- **Runs** — the owner's "control" is primarily *when*. All three options drive
  the same `runImport()` path (invariant 2.2.5).
- **Scope** — a status column gate means the sheet stays a human workspace; rows
  in progress are not half-imported.
- **On conflict** — never silently overwrite (see §3.4).
- **Never publish** — an automatic path that can publish to the storefront is a
  fully automatic content pipeline, which the HARD RULES forbid. Arriving as
  `DRAFT` keeps the human in the loop while removing the typing.
- **Blast radius cap** — the single most valuable safety control here. If someone
  sorts the sheet wrongly, 400 rows "change". The run must refuse and ask.

## 3.3 The fill pipeline

```
READ (batched, header-mapped)
  ↓
VALIDATE          → row failures become validation-failure rows, never nulls
  ↓
RESOLVE IDENTITY  → by Product ID, else slug, else (source, externalId)
  ↓
DIFF              → created / updated / unchanged / conflicted / invalid
  ↓
GATE              → blast-radius cap, dry-run gate, policy check
  ↓
APPLY             → inside a transaction, respecting field ownership
  ↓
REPORT            → durable ImportRun row + activity log
```

**Preview and Fill must run the identical code path**, with `dryRun: true`
stopping before APPLY. A preview that diverges from the real run is worse than no
preview, because it is trusted.

## 3.4 Conflict handling

A conflict is: the sheet value differs from the Studio value **and** the Studio
value was edited by a human after the last fill. Timestamps decide this —
`studioEditedAt` vs `lastFilledAt`. Present it, never resolve it silently:

```
Conflict · RR-A8F93C12 · Title
  Studio  Premium Handmade Resin Ganesha   (edited 22 Aug by Bhavya)
  Sheet   Resin Ganesha Idol               (changed 24 Aug)
  [ Keep Studio ]  [ Take Sheet ]  [ Skip ]
```

## 3.5 Acceptance for F1

- Arming automatic fill and changing nothing in the sheet produces **zero** writes
  and one "no changes" run record.
- A row that fails validation blocks **that row**, not the run.
- Exceeding the blast-radius cap aborts **before** any write and explains why.
- A Studio-edited field is never overwritten under the default policy.
- Preview counts equal the subsequent real-run counts exactly, on unchanged input.
- Turning automatic fill OFF means no scheduled run fires. Prove it with a test,
  not by looking at the toggle.

---

# 4. FEATURE F2 — GATED AUTOMATIC PUSH TO THE SHEET ⚑

## 4.1 Policy, not a second code path

Add to `ScrapeSource`:

```prisma
sheetSyncPolicy   SheetSyncPolicy @default(MANUAL)
sheetTab          String?         // override; defaults to TAB_BY_TIER[tier]
lastSheetSyncAt   DateTime?
lastSheetSyncError String?
```

At the single point where a job reaches `DONE`, consult the policy. That is the
whole of the "automatic" mechanism. `syncJobToSheet()` already does the work —
this decides whether to call it.

## 4.2 "When I say add"

In `/studio/scraper/review`, selection already exists conceptually via
`addScrapedToCatalog()` / `sendScrapedToSheet1()`. Make the intent explicit:

```
STAGED PRODUCTS · Supplier A · SCRAPE-2026-08-24-0001

☑ 37 selected                                    [ Clear ]

  [ Add to Sheet ]   [ Approve ]   [ Reject ]   [ Re-scrape ]

☑  Premium Resin Ganesha      ₹849  NEW      not in sheet
☑  Resin Car Charm            ₹499  UPDATED  in sheet · 22 Aug
☐  Agate Coaster Set          ₹1,299 UNCHANGED in sheet · 24 Aug
```

`Add to Sheet` on a selection writes exactly that selection to
`SCRAPED_PRODUCTS`, upserting by `sourceKey|externalId`, and reports
`updated / appended / skipped` — the counts `syncJobToSheet()` already returns.

**Rows the owner did not select are not written.** Not as drafts, not as
placeholders, not "for completeness".

## 4.3 Sync state, visible per product

```
NOT_SYNCED → SYNC_PENDING → SYNCING → SYNCED
                    ↓
               SYNC_FAILED  → (retry) → SYNC_PENDING
```

Show it in the review table. A product whose sheet write failed must look
different from one nobody has pushed yet — that distinction is the entire value
of the column.

## 4.4 Sheets is allowed to be down

If Sheets is unreachable, **the scrape still succeeds.** Products persist
internally, rows mark `SYNC_PENDING`, and a `Retry Sync` action drains the queue
when the API returns. Losing scraped work because a third party had an outage is
not acceptable, and `isSheetSyncConfigured()` already models "sync is optional".

Batch every write (`upsertRowsToTab` already does), retry with exponential
backoff, and respect the Sheets API quota — a 4,000-row job must not become
4,000 API calls.

## 4.5 Acceptance for F2

- Policy `MANUAL`: a completed job writes **nothing** until `Add to Sheet`.
- Policy `ON_COMPLETE`: the same job writes automatically, once.
- Selecting 37 of 500 staged products writes 37 rows.
- Running the same scrape twice yields the same row count, not double.
- With Sheets unreachable: scrape SUCCESS, internal store SUCCESS, rows
  `SYNC_PENDING`; after restore, `Retry Sync` → `SYNCED`, no data lost.

---

# 5. INVARIANT I1 — SCRAPE ONLY THE SELECTED SOURCE

`createTierJobs()` exists and is legitimate — but it must be a **separate,
clearly-labelled action**, never what `Scrape` does.

```
PRODUCT SCRAPER

Source     [ Supplier A ▾ ]        ← required; no "all sources" option here

Scope      (●) Enabled categories
           ( ) Selected categories   ☑ Rings  ☑ Pendants  ☐ Watches
           ( ) Specific product URLs

Limits     Max pages [ 20 ]   Request delay [ 1200 ms ]

[ SCRAPE SUPPLIER A ]
```

The button **names the source**. That single wording choice prevents most
mis-fires, and it makes a screenshot of a mistake self-explaining.

Enforce server-side, not just in the UI: the run action takes exactly one
`sourceId`. Tier fan-out lives behind its own action with its own confirmation
naming the count ("This will queue 14 jobs across Tier 2").

**Skip-overlap:** if that source has a `RUNNING` job, refuse and link to it.

---

# 6. INVARIANT I2 — CONFIRMED MEANS A HUMAN SAID SO

```
CONFIRMED_PRODUCTS  ≡  { p : p.approvalStatus == CONFIRMED }
```

Not all scraped products. Not all Studio products. Not everything in the sheet.

- No path from SCRAPE to CONFIRMED exists. The only transition is an operator
  selecting rows and pressing **Confirm**.
- Confirmation validates first — title, primary image, category, product ID,
  source URL, required price/content. Refuse with the missing fields **named**.
- Confirmation is audited: `confirmedBy`, `confirmedAt`, `previousStatus`.
- Unconfirming returns the product to `READY` and removes it from the active
  confirmed set. **History is never deleted** — archive, don't delete.

**The mandatory acceptance test:** scrape 500, confirm 7 →
`SCRAPED_PRODUCTS = 500`, `STUDIO_PRODUCTS = 500`, `CONFIRMED_PRODUCTS = 7`.
If this test does not exist, the feature is not done.

---

# 7. DATA MODEL DELTA

Additive and nullable wherever possible — this repo's migration convention is
that a rollback is a column DROP. Follow `prisma/migrations/20260824110000_content_gaps/`
as the style reference.

```prisma
enum SheetSyncPolicy { MANUAL ON_COMPLETE OFF }
enum SheetSyncStatus { NOT_SYNCED SYNC_PENDING SYNCING SYNCED SYNC_FAILED }
enum ApprovalStatus  { PENDING READY CONFIRMED REJECTED ARCHIVED }

model ScrapeSource {
  // + sheetSyncPolicy, sheetTab, lastSheetSyncAt, lastSheetSyncError
  // + requestDelayMs, maxConcurrency, maxPages, consecutiveFailures, pausedAt
}

model ScrapedProduct {
  // + sheetSyncStatus, sheetSyncedAt, sheetSyncError
  // + approvalStatus, confirmedBy, confirmedAt, previousStatus
  // + studioEditedAt        ← the timestamp conflict detection depends on
}

model ValidationFailure {
  id, jobId?, scrapedProductId?, sourceId?, field, reason, rawValue,
  severity, status /* OPEN REVIEWING RESOLVED IGNORED */,
  createdAt, resolvedAt, resolvedBy
  @@index([status, field])
}

model SheetSyncRun {
  id, direction /* PUSH | FILL */, trigger /* MANUAL SCHEDULED ON_COMPLETE RETRY */,
  tab, requested, created, updated, unchanged, skipped, failed,
  startedAt, finishedAt, status, error
}

model ImportRun {          // extend if an equivalent already exists
  id, source /* SHEET | CSV */, dryRun, rowsRead, created, updated,
  unchanged, conflicted, invalid, abortedReason?, startedAt, finishedAt, actorId
}

model PriceHistory {
  id, productId?, scrapedProductId?, variantId?, price, salePrice,
  currency, capturedAt, sourceKey
  @@index([scrapedProductId, capturedAt])
}
```

**Index for the queries you will actually run**, and justify each one in the
migration comment: `sourceKey|externalId`, `approvalStatus`, `sheetSyncStatus`,
`reviewStatus`, `updatedAt`.

**Rule inherited from this repo's history:** every new table that stores a media
URL goes into `src/lib/media-usages.ts` **in the same commit**. That rule was
broken three times in one week and each break was silent.

---

# 8. THE SHEET CONTRACT

Reuse the tabs that exist (`Tier1_Owner`…`Tier4_3DPrint`, `Sheet1`). Add only
what is missing:

| Tab | Purpose | Merge key | Written by |
|---|---|---|---|
| `Tier*_…` | Raw scrape decks per tier | `sourceKey\|externalId` | `syncJobToSheet` / `Add to Sheet` |
| `Sheet1` | Bulk-upload format | `slug` | `sendScrapedToSheet1` |
| `CONFIRMED_PRODUCTS` | **The final list** | `Product ID` | Confirm action only |
| `VALIDATION_ERRORS` | Open failures for triage | `failureId` | Validation writer |
| `SYNC_LOG` | Append-only run history | append | Both directions |

Rules that keep the sheet usable by a human:
- Map by **header name**. Never by column index. Never by row number.
- `Product ID` is the stable reference, in every tab.
- Freeze the header row. Keep status values human-readable.
- **Never destroy a column you did not create.** The owner works in this document.

---

# 9. OPERATIONS SURFACES

Build these only where they do not already exist:

- **Scrape history** — date, source, scope, counts, duration, status; click through
  to the job's staged rows.
- **Data quality** — validation failures grouped by field and by job, with
  resolve / ignore / resolve-batch. **Auto-triage may propose, never close.**
- **Activity log** — who did what, to which product, with the job id. Extend the
  existing `logActivity()`; do not invent a second log.
- **Source health** — last success, last failure, consecutive failures, and a
  circuit breaker that pauses a source after 5 consecutive failures with a
  `Resume` button rather than hammering a site that is blocking you.

---

# 10. DELIVERY PLAN — one PR per phase

Each phase must end green on the full CI gate and be demonstrable. A phase you
cannot demonstrate is unfinished.

| # | Phase | Ships |
|---|---|---|
| 1 | **Audit** ⚑ | `docs/scraper-audit.md`. No code. |
| 2 | Schema delta | One additive migration + regenerated client. Nothing reads it yet. |
| 3 | Validation failures | Writer + `/studio/scraper/quality`. Stop nulling failures. |
| 4 | **I1 — source-scoped scraping** | Required source select, named button, skip-overlap, tier fan-out split out. |
| 5 | **F2 — gated sheet push** ⚑ | `SheetSyncPolicy`, `Add to Sheet` on a selection, sync status column, retry queue. |
| 6 | **I2 — confirmation** ⚑ | `approvalStatus`, bulk confirm/reject, `CONFIRMED_PRODUCTS` tab, audit, unconfirm. |
| 7 | **F1 — controlled auto-fill** ⚑ | Policy UI, preview≡run, conflict resolution, blast-radius cap, scheduled trigger. |
| 8 | Resilience | Circuit breaker, backoff, per-source limits, Sheets-down path. |
| 9 | Field ownership | source/studio/final separation + the re-scrape protection test. |
| 10 | Price history | Capture on every successful scrape; never overwrite. |
| 11 | Ops surfaces | History, quality triage, activity, source health. |
| 12 | Docs | `docs/scraper.md`, `google-sheets.md`, `studio-workflow.md`, `product-lifecycle.md`, `source-adapters.md`, `troubleshooting.md`; update `README.md`, `.env.example`. |

Phases 4, 5 and 6 are the owner's actual request. If time runs out, those three
plus phase 1 are the deliverable.

---

# 11. TESTS THAT MUST EXIST

Pure-function tests go in `src/lib/**/*.test.ts` (vitest). The important ones:

```
selection      500 scraped, 7 confirmed  → CONFIRMED_PRODUCTS == 7
idempotency    same scrape twice          → 100 rows, not 200
identity       same source product        → same internal ID, always
policy         MANUAL + job DONE          → zero sheet writes
policy         ON_COMPLETE + job DONE     → exactly one sheet write
scope          source A selected          → source B untouched
scope          category disabled          → not crawled
resume         crash at 427/1200          → resumes at 428, not 0
ownership      studio title + re-scrape   → studio title survives
conflict       both edited                → conflict raised, nothing overwritten
blast radius   cap 25, diff 400           → aborts before any write
sheets down    scrape + sync              → scrape OK, rows SYNC_PENDING
dry run        preview counts             → equal the real run's counts
price history  ₹799 → ₹849                → two points, current 849, one product
```

---

# 12. ANTI-PATTERNS — do not do these

- Build a second scraper beside the working one.
- Auto-confirm anything, ever.
- Let a re-scrape clobber a Studio edit.
- Delete a product because the source dropped it (archive it).
- Address sheet rows by index or row number.
- Expose service-account credentials to the client; they are server-only env.
- Silently swallow an extraction error or a Sheets error.
- Run unbounded concurrency against a source.
- Put scraper logic in components — UI never calls the Sheets API directly.
- Ship a gate that cannot fail. *(This repo has now shipped that exact bug twice
  in one week: a budget script that printed `BUDGET MISS` and exited 0, and a
  Lighthouse config that measured its own misconfiguration rather than the site.
  Before claiming any check works, **make it fail on purpose once**.)*

---

# 13. DEFINITION OF DONE

Per this repo's standard, plus this work's specifics:

```
typecheck ✓   lint ✓   unit tests ✓   copy:check ✓   i18n coverage ✓
production build ✓   design + a11y audits ✓   Lighthouse budget ✓
360px and 1280px ✓   keyboard reachable ✓   reduced-motion ✓
HARD RULES respected ✓
order flow intact: Place Order → Inquiry saved → wa.me/917096036250 ✓
```

and the end-to-end walk, demonstrated rather than asserted:

```
SELECT SOURCE → SCRAPE → DISCOVER → EXTRACT → VALIDATE → DEDUPE
→ DETECT CHANGES → SAVE → (owner says add) → SHEET
→ STUDIO → EDIT → SELECT → CONFIRM → CONFIRMED_PRODUCTS
```

The invariant the whole system exists to protect:

```
SCRAPED  ≠  CONFIRMED
```

---

# 14. QUESTIONS TO SETTLE BEFORE PHASE 2

Answer these in the audit rather than guessing:

1. Does the live sheet already have a confirmed-products tab, under any name?
2. What are `Sheet1`'s real headers today, and which are load-bearing for the
   existing bulk uploader?
3. Is there an existing status column the auto-fill scope filter should read?
4. Should `CONFIRMED_PRODUCTS` mirror catalog `Product` rows, or staged
   `ScrapedProduct` rows that have been promoted? (These differ once the owner
   edits in Studio — decide deliberately.)
5. Who is "the owner" for notification purposes — one address, or the staff list?
6. Does any existing `Product` row already carry a `sourceKey|externalId`
   provenance link, or does phase 9 need to establish it?
