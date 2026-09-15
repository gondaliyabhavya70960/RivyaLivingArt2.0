# The Product Scraper

How a competitor's storefront becomes a row you can review.

> Companion docs:
> [`product-lifecycle.md`](./product-lifecycle.md) ·
> [`source-adapters.md`](./source-adapters.md) ·
> [`troubleshooting.md`](./troubleshooting.md)

---

## The shape

```
SOURCE (registry)  →  JOB (durable)  →  ADAPTER pages  →  STAGED rows
                                                             ↓
                                        price history · validation failures
```

Four things are worth understanding before changing any of it.

**A job is a database row, not a process.** `ScrapeJob` carries `status`,
`cursorPage`, the counts and the error. The UI reads that row, never a live
handle, so progress survives a redeploy and a crashed worker resumes at
`cursorPage` rather than starting over.

**Staged rows are immutable source data.** `ScrapedProduct` is what the site
said. Promotion writes a _separate_ catalog `Product`. Corrections never edit
the staged row, so changing a normalisation rule does not need a re-scrape.

**Identity is deterministic.** `@@unique([sourceKey, externalId])` on the
staged table and `@@unique([importSource, importRef])` on the catalog. The same
source product always resolves to the same row — re-scraping updates, it does
not duplicate.

**Scraping targets exactly one source, at one of three scopes.** `SOURCE`
(default) crawls the whole registered site; `CATEGORY` paginates one listing
page; `URL` fetches one product page. `createScrapeJob` takes a single source
(or one pasted URL); `createTierJobs` is a separate, confirmed action for
fanning out across a tier.

---

## The stage rail

`/studio/scraper` opens with nine numbers, sources through confirmed — the
pipeline as one strip rather than five separate screens an operator has to
remember the order of: **sources** (the registry) → **discovery** (registered,
not yet fingerprinted to a platform) → **scraping** (jobs queued or running
right now) → **staged** (rows landed in `ScrapedProduct`) → **quality** (open
extraction failures) → **review** (awaiting a decision) → **approved** →
**imported** (promoted to a draft `Product`) → **confirmed** (blessed for the
CSV). Every cell links to the screen its count describes.

`src/lib/scraper/stages.ts` (the definitions + the pure shaping function,
tested without a database) / `stages-server.ts` (the nine counting queries,
run in parallel) / `src/components/studio/scraper/stage-rail.tsx`.

## Running a scrape

`/studio/scraper` → pick a source → **Scrape ‹source name›**.

The button names its source deliberately: on a page reachable from a list of a
hundred suppliers, "Run scrape" does not say which one, and a screenshot of the
wrong run then explains nothing.

### Scope: whole source, one category, or one product

The source detail page's scope picker decides what one Scrape press covers:

- **Whole source** — the registry's ordinary behaviour, paginating the
  platform's full catalog endpoint (or the JSON-LD sitemap fallback).
- **One category** — paginates a single listing/collection page the operator
  pastes in. Shopify needs no adapter change (the listing URL's own
  `/products.json` already scopes to it); WooCommerce derives a best-effort
  category slug from the listing's last path segment; the JSON-LD fallback
  discovers product links from that one page instead of the sitemap.
- **One product** — a single fetch via the JSON-LD path, regardless of the
  source's detected platform (a store's product API has no "just this one"
  request the way a JSON-LD fetch does).

A category/URL job still needs the registered source (for its tier, breaker
state and politeness delay), and the pasted page is verified same-host as the
source before a job is created. `ScrapeJob.scope` records which; adapters read
it off `AdapterContext.scope`.

### One run per source

Pressing Scrape while that source is already running returns **the job already
in flight** rather than an error, and the UI attaches to it. That makes the
action idempotent — two presses leave one job — and it lands the operator where
they wanted to be anyway.

`QUEUED` counts as in flight. It has not started, so starting another is the
same duplicate a moment earlier.

The rule lives in `src/lib/scraper/run-scope.ts` and applies to the tier
fan-out too, which reports skipped sources **by name** (a cuid is not something
an operator can act on).

### Stale-job reclaim

A serverless invocation that crashes mid-page never gets to write `FAILED` —
without a heartbeat, that would leave its source "spoken for" forever, and no
scrape of it could ever be queued again. `ScrapeJob.updatedAt` is the
heartbeat: each page advance writes it via an **optimistic** update
(`where: { id, cursorPage }`), so two workers can never both fold the same
page's counts in, and a `RUNNING` job whose heartbeat predates
`STALE_RUNNING_MS` (10 minutes) is presumed dead and no longer counts as
in-flight — `run-scope.ts`'s `isStaleRunning`. The old job stays in the
database, still resumable by id if it turns out to be alive after all; a fresh
one just isn't blocked by it.

### The scrape runner survives navigation

The poll-until-finished loop lives in a module store
(`src/hooks/use-scrape-runner.ts`), not a component ref, mounted once by
`scraper/layout.tsx` above every route the section owns. Start a scrape from
the dashboard, walk to a source's own page, and it is still running when you
get there — the loop used to die with whichever component started it. A
`beforeunload` guard warns while a run is active.

### …and it survives the tab closing (B1, 2026-09-15)

It did not used to. That poll loop was the ONLY caller of `continueScrapeJob`,
so a job advanced only while somebody had the scraper page open: close the
laptop mid-source and the crawl stopped there. `cursorPage` made it resumable
and nothing resumed it.

`/api/cron/scrape-drain` (every 10 minutes, `vercel.json`) now drives the same
advance server-side. The logic moved out of the `"use server"` action into
`src/lib/scraper/job-runner.ts` — **an export of a `"use server"` module is a
callable server action**, so a session-free `advanceScrapeJob` could not live
beside `continueScrapeJob` without becoming an unauthenticated "crawl this site
for me" endpoint. The action and the route each authorize for themselves; the
route takes the cron's `Bearer CRON_SECRET` or a staff session.

**It only touches jobs nobody is driving** — heartbeat idle for two minutes —
and never demo rows. The per-page compare-and-swap on `cursorPage` already
makes concurrent advances SAFE; the idle rule is about politeness, since what
a CAS cannot undo is the HTTP request already sent to a supplier.

### The circuit breaker

Five consecutive failed jobs pauses a source. A paused source refuses new jobs
**with the reason**, and `Resume` clears the pause _and_ the counter — resuming
without the reset would leave it one failure from tripping again, which is not
what "resume" means to the person pressing it.

A success resets the counter to zero rather than decrementing. A source that
fails, succeeds, then fails is having a bad day, not blocking us; a decaying
counter would creep up on those and eventually pause a working source.

State is recorded against the `ScrapeSource` found by its stable `key`
(`ScrapeJob.sourceKey`), not by the job's `sourceId` foreign key — that FK is
nullable (`onDelete: SetNull`) and goes null the moment a source row is
deleted, while the key is a plain string that survives it. A source
re-registered under the same key keeps its failure history instead of
restarting silently disconnected from it; no source under the key at all
just skips the bookkeeping and logs why (`describeBreakerSkip`).

`src/lib/scraper/breaker.ts` · threshold `BREAKER_THRESHOLD` (5).

### Politeness

`ScrapeSource.requestDelayMs` overrides the shared delay **only to make a
source slower**. The knob exists for a site that rate-limits us, not to speed
past our own floor, so it clamps to the default at the bottom and one minute at
the top — an absurd value should not strand a job for an hour.

`robots.txt` is honoured (`robots.ts`) and every fetch goes through the SSRF
guard (`ssrf.ts`). **Do not weaken either.**

---

## What each scrape records

### Price history

A point on first sighting, and thereafter only when the price **moves**.

The reference spec says every scrape should write one. At this catalogue's size
— tens of thousands of rows, re-scraped regularly — that is millions of rows a
month, nearly all identical to the row above, carrying the same information: a
gap between two points means the price held across it.

Null is a real value. A product that stopped advertising a price has changed in
a way worth recording, and so has one that started.

Append-only. Nothing updates or deletes a point, because the value of the
series is that it says what the price _was_.

`src/lib/scraper/price-history.ts` · surfaced inline on the source detail page.

### Validation failures

A field that fails to extract is **recorded, not silently nulled** — "the price
is missing" and "the price is null because nobody looked" are indistinguishable
in a nullable column, and only one is a problem.

The checked fields are deliberately the same ones that block confirmation, so
clearing the backlog at `/studio/scraper/quality` is what unblocks the final
list. Fields most storefronts never publish (tagline, timeline, dimensions) are
**not** checked: flagging them would bury the failures that matter.

One row per (staged product, field), so a source broken for a month shows one
row per broken field rather than one per scrape.

`src/lib/scraper/validation.ts`

### Normalization

Materials, colour and dimension units are cleaned up once, at staging, before
`contentHash` runs — "Epoxy resin" and "epoxy Resin" become one spelling,
"10 x 12 inches" becomes "10 x 12 in" — so a source's own inconsistency never
manufactures a false content change and the review grid shows one vocabulary
instead of a hundred sources' worth of spelling. Scraped URLs are also
canonicalised (lowercase host, tracking params stripped, query sorted, no
trailing slash), so two links that differ only in campaign noise resolve
identically. `contentHash` reads only title/price/status/images — none of
which normalization touches — so this needed no version bump.

`src/lib/scraper/normalize.ts` (pure, fully unit-tested).

### Reviewer notes

`ScrapedProduct.notes` is the one field an otherwise-immutable staged row may
still change after it lands — a reviewer's own comment on the listing, not
the source's data, and editable even on an already-`IMPORTED` row. Set from
the review grid's detail sheet via `setScrapedNotes` (`src/actions/scraper-review.ts`).

### Research library

`/studio/research` is a hand-kept reference note — "here's a piece worth
adapting" — backed by its own `ResearchRecord` table, never a product and
never on the path from scrape to catalogue. `src/actions/research.ts`,
`src/components/studio/research/`.

---

## Where things live

| Concern                            | File                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Stage rail                         | `src/lib/scraper/stages.ts` / `stages-server.ts`                                                              |
| Run / resume / fan out             | `src/actions/scraper-jobs.ts`                                                                                 |
| The runner (survives navigation)   | `src/hooks/use-scrape-runner.ts`                                                                              |
| One-run-per-source + stale reclaim | `src/lib/scraper/run-scope.ts`                                                                                |
| Circuit breaker + delay            | `src/lib/scraper/breaker.ts`                                                                                  |
| Adapters (scope-aware)             | `src/lib/scraper/adapters/`                                                                                   |
| Safety                             | `src/lib/scraper/robots.ts`, `ssrf.ts`                                                                        |
| Dedupe / change detection          | `src/lib/scraper/hash.ts`, `fingerprint.ts`                                                                   |
| Normalization                      | `src/lib/scraper/normalize.ts`                                                                                |
| Price history                      | `src/lib/scraper/price-history.ts`                                                                            |
| Validation                         | `src/lib/scraper/validation.ts`                                                                               |
| Category mapping                   | `src/lib/scraper/category-map.ts` (+ `.test.ts` against the real catalog)                                     |
| Review + promote + notes           | `src/actions/scraper-review.ts`                                                                               |
| Research library                   | `src/actions/research.ts`                                                                                     |
| Merge protection                   | `src/lib/scraper/merge-policy.ts` (also honoured by Bulk Import's products template, `src/actions/import.ts`) |

## Environment

| Variable             | Purpose                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SCRAPER_USER_AGENT` | Overrides the fetch identity. Defaults to a mainstream desktop string, because many storefronts 403 an identifying bot UA. robots.txt is honoured either way. |

Google Sheets is removed (2026-09-15); no credentials are needed. The confirmed
list exports from `/studio/exports`. History: `docs/archive/google-sheets.md`.
