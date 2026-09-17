# The studio workflow

The path an operator actually walks, and what each screen is for.

```
/studio/scraper                  run a scrape, watch it, fan out by source tier
  └ /sources                     the registry
      └ /sources/‹key›           one source: policy, health, staged rows
  └ /review                      the staged queue — approve, reject, import
  └ /mapping                     source category → catalog category
  └ /quality                     what could not be extracted
/studio/products                 the catalog — edit and confirm
/studio/catalog-fill             fill the catalogue from the four import lists (committed CSVs)
/studio/content-gaps             what is missing across the whole catalogue
/studio/activity                 who did what
```

---

## A normal week

**1 · Scrape a source.** `/studio/scraper` → pick one → _Scrape ‹name›_. It
resumes if interrupted; pressing again while it runs shows you the run rather
than starting a second.

**2 · Review what came back.** `/studio/scraper/review`. Approve what is worth
keeping, reject the rest. Nothing reaches the catalogue on its own. Filter by
source, by the source's tier, by the tier the classifier suggests, by state or
by search; tick **Select all on this page**, then **Select all N matching**, to
act on every page at once. **Move** takes the selection through the funnel;
**Add to catalog…** puts each product in its nearest category with its
suggested tier (or one category and one tier for all) as a DRAFT, in batches
with a progress line — a run that stops resumes by pressing Add again.

**3 · Import the approved rows.** They arrive as **DRAFT** with the rewrite
guard set — scraped titles and photographs are somebody else's copyrighted
material until rewritten. The second door is `/studio/import`: a ScrapeDeck
export (the CSV the scraper screens download) uploaded as **Products** lands
the same way — drafts with the guard, one row per `(source, external id)`,
categories matched and tiers suggested where the listing makes them clear,
the staged twin marked imported — and the preview says exactly what it will
do before you press Import. Any other content type refuses the file.

**4 · Rewrite and edit.** `/studio/products`. Every save marks the row
owner-touched, after which no scrape or CSV import will overwrite your
content or your images.

**4b · Approve.** Filter the Review tab, **Select all N matching**, press
**Approve**: it clears the rewrite guard on the selection, marks the rows as
your decision and publishes the ones that have a product tier — an untiered
row keeps the approval and waits for **Set product tier…**, an archived row
stays archived. It asks first, and says what it lifts: scraped listings carry
another site's words until rewritten, so approve only what you have read.
Publish on its own keeps refusing flagged rows; Approve is the explicit act.

**5 · Confirm.** Select the products that belong on the final list and press
Confirm. Only those reach `CONFIRMED_PRODUCTS`.

**6 · Export the confirmed list** from `/studio/exports` as CSV or XLSX,
whenever you want a file. (Until 2026-09-15 this step pushed the list into a
Google Sheet; that integration is gone — you take a file on demand instead of
it being written for you on every scrape.)

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

Add a website, remove one, enable or disable it in bulk, and — per source
tier — **Remove all ‹tier› sources**, which takes the sources, their staged
products, their jobs together. Live catalog products are kept unless you
tick the opt-in. The confirmation names every number before you press it.

### `/studio/content-gaps`

The owner-content worklist: descriptions, images, occasion tags, case-study
fields, captions, translations, and the transformations missing a before shot.
Every count is live and links into the editor that fixes it.

### `/studio/products`

Bulk actions accept either a selection **or the current filter** ("select all
matching"), and every row is still checked individually — a filter cannot wave
anything through.

---

## Things the studio will refuse

| It says                                                         | Because                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| "‹Source› is already being scraped"                             | One run per source. You are shown the run in flight.     |
| "Paused after 5 consecutive failed scrapes"                     | The circuit breaker. Check the site, then Resume.        |
| "‹Product› needs at least one image before it can be confirmed" | Confirmation validates first, and names what is missing. |
| "Would create N products, over the limit of M"                  | The auto-fill blast-radius cap. Nothing was written.     |

Each of these is a refusal with a reason. If you meet one that does not explain
itself, that is a bug worth reporting.
