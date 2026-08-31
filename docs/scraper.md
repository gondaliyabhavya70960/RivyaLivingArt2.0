# The Product Scraper

How a competitor's storefront becomes a row you can review.

> Companion docs: [`google-sheets.md`](./google-sheets.md) ·
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
said. Promotion writes a *separate* catalog `Product`. Corrections never edit
the staged row, so changing a normalisation rule does not need a re-scrape.

**Identity is deterministic.** `@@unique([sourceKey, externalId])` on the
staged table and `@@unique([importSource, importRef])` on the catalog. The same
source product always resolves to the same row — re-scraping updates, it does
not duplicate.

**Scraping targets exactly one source.** `createScrapeJob` takes a single
source (or one pasted URL); `createTierJobs` is a separate, confirmed action
for fanning out across a tier.

---

## Running a scrape

`/studio/scraper` → pick a source → **Scrape ‹source name›**.

The button names its source deliberately: on a page reachable from a list of a
hundred suppliers, "Run scrape" does not say which one, and a screenshot of the
wrong run then explains nothing.

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

### The circuit breaker

Five consecutive failed jobs pauses a source. A paused source refuses new jobs
**with the reason**, and `Resume` clears the pause *and* the counter — resuming
without the reset would leave it one failure from tripping again, which is not
what "resume" means to the person pressing it.

A success resets the counter to zero rather than decrementing. A source that
fails, succeeds, then fails is having a bad day, not blocking us; a decaying
counter would creep up on those and eventually pause a working source.

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
series is that it says what the price *was*.

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

---

## Where things live

| Concern | File |
| --- | --- |
| Run / resume / fan out | `src/actions/scraper-jobs.ts` |
| One-run-per-source | `src/lib/scraper/run-scope.ts` |
| Circuit breaker + delay | `src/lib/scraper/breaker.ts` |
| Adapters | `src/lib/scraper/adapters/` |
| Safety | `src/lib/scraper/robots.ts`, `ssrf.ts` |
| Dedupe / change detection | `src/lib/scraper/hash.ts`, `fingerprint.ts` |
| Price history | `src/lib/scraper/price-history.ts` |
| Validation | `src/lib/scraper/validation.ts` |
| Review + promote | `src/actions/scraper-review.ts` |
| Merge protection | `src/lib/scraper/merge-policy.ts` |

## Environment

| Variable | Purpose |
| --- | --- |
| `SCRAPER_USER_AGENT` | Overrides the fetch identity. Defaults to a mainstream desktop string, because many storefronts 403 an identifying bot UA. robots.txt is honoured either way. |

Sheet credentials are covered in [`google-sheets.md`](./google-sheets.md).
