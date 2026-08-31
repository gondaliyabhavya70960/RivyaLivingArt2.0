# The studio workflow

The path an operator actually walks, and what each screen is for.

```
/studio/scraper                  run a scrape, watch it, fan out by tier
  └ /sources                     the registry
      └ /sources/‹key›           one source: policy, health, staged rows
  └ /review                      the staged queue — approve, reject, import
  └ /mapping                     source category → catalog category
  └ /quality                     what could not be extracted
/studio/products                 the catalog — edit, confirm, sync to sheet
/studio/sheet-import             fill the catalogue from the sheet
/studio/content-gaps             what is missing across the whole catalogue
/studio/activity                 who did what
```

---

## A normal week

**1 · Scrape a source.** `/studio/scraper` → pick one → *Scrape ‹name›*. It
resumes if interrupted; pressing again while it runs shows you the run rather
than starting a second.

**2 · Review what came back.** `/studio/scraper/review`. Approve what is worth
keeping, reject the rest. Nothing reaches the catalogue on its own.

**3 · Import the approved rows.** They arrive as **DRAFT** with the rewrite
guard set — scraped titles and photographs are somebody else's copyrighted
material until rewritten.

**4 · Rewrite and edit.** `/studio/products`. Every save marks the row
owner-touched, after which no scrape or sheet import will overwrite your
content or your images.

**5 · Confirm.** Select the products that belong on the final list and press
Confirm. Only those reach `CONFIRMED_PRODUCTS`.

**6 · Push to the sheet** when you want it there — or set the source to *after
every scrape* if you'd rather it happened by itself.

---

## Screens worth knowing

### `/studio/scraper/quality`

The validation backlog, grouped by **field** rather than listed flat. A backlog
of thousands is really a handful of causes repeated — one adapter that stopped
finding prices, one source that never had descriptions. Every action is
per-cause, because resolving them one row at a time is data entry, not triage.

A "worst sources" panel names the adapters worth looking at: a source at the
top of that list usually means one broken adapter, not a hundred broken
products.

Nothing closes itself on a guess. A field that starts extracting again is
resolved automatically — that is a fact, not a judgement — but rows you
**ignored** are never reopened.

### `/studio/scraper/sources`

Add a website, remove one, enable or disable it in bulk, and — per tier —
**Remove all ‹tier›**, which takes the sources, their staged products, their
jobs and their sheet rows together. Live catalog products are kept unless you
tick the opt-in. The confirmation names every number before you press it.

### `/studio/content-gaps`

The owner-content worklist: descriptions, images, occasion tags, case-study
fields, captions, translations, and the transformations missing a before shot.
Every count is live and links into the editor that fixes it.

### `/studio/products`

Bulk actions accept either a selection **or the current filter** ("select all
matching"), and every row is still checked individually — a filter cannot wave
anything through.

*Sync to sheet* pushes the whole catalogue into the **Added product in
website** tab.

---

## Things the studio will refuse

| It says | Because |
| --- | --- |
| "‹Source› is already being scraped" | One run per source. You are shown the run in flight. |
| "Paused after 5 consecutive failed scrapes" | The circuit breaker. Check the site, then Resume. |
| "‹Product› needs at least one image before it can be confirmed" | Confirmation validates first, and names what is missing. |
| "Would create N products, over the limit of M" | The auto-fill blast-radius cap. Nothing was written. |
| "Sheet sync not configured" | No service-account credentials in this environment. Scraping is unaffected. |

Each of these is a refusal with a reason. If you meet one that does not explain
itself, that is a bug worth reporting.
