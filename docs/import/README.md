# Bulk-import snapshots

## Importing a Product Scraper export as Products

The CSV that **Studio → Scraper** downloads (the ScrapeDeck export —
`sourceKey, vertical, externalId, title, slug, category, … , contentHash`)
can be uploaded at **Studio → Import** with **Products** picked in step 1.
Any other type refuses it with a toast that says so: a blog post or a
testimonial has no rewrite guard to land behind.

It imports with exactly the guarantees the scraper's own review inbox gives
a promoted row (`importOneScrapedRow` in `src/actions/scraper-review.ts`),
so a row that comes in through either door is the same row to the other.

### What is remapped

The parser lower-cases every header, and `src/lib/import/scrape-export.ts`
maps the export's columns onto the products template:

| Export column                  | Products column                     |
| ------------------------------ | ----------------------------------- |
| `title`, `slug`, `description` | the same (the slug is made URL-safe) |
| `shortTagline`                 | `short_tagline`                     |
| `priceMin`, `priceMax`         | `price_min`, `price_max`            |
| `showPrice`                    | `show_price`                        |
| `timeline`, `materials`, `dimensions`, `featured` | the same         |
| `images`, `imageAlts`          | `images`, `image_alts`              |
| `seoTitle`, `seoDescription`   | `seo_title`, `seo_description`      |
| `status` (`active` / `out_of_stock`) | `in_stock` (`TRUE` / `FALSE`) |
| `sourceKey`, `externalId`      | `source_key`, `external_id` — the identity |
| `category`                     | `source_category` — the source's own words |
| `url`, `fields`                | `source_url`, `fields`              |

`vertical`, `currency`, `firstSeen`, `lastSeen` and `contentHash` are not
product fields and are dropped.

### What is forced, whatever the file says

- **Every NEW row lands as a DRAFT, and the rewrite guard (`needsRewrite`)
  is set on create AND on update.** Scraped copy is reference material until
  a human rewrites it; publish refuses until then. An update keeps the row's
  own status — a re-upload re-flags a live product for rewrite, it never
  takes it off the shop. The export's `status` column is
  the listing's availability and becomes `in_stock`; a hand-added
  `PUBLISHED` cell is ignored.
- **`tier` (the import list, 1–4) is always blank.** A scraped row came from
  a supplier's site, not from one of the four committed CSV lists.
- **Identity is `(source_key, external_id)`**, written to
  `Product.importSource` / `importRef` in the promote path's own format — the
  bare source key and the supplier's id. A second upload of the same file
  UPDATES those rows — their copy flagged for rewrite again, their status
  and product tier kept, so a re-upload never takes a live product off the
  shop — and never duplicates them. A row already in the catalogue under the
  CSV fill's `sheet:<key>` spelling is the catalog fill's own (the owner's
  list): it is LEFT AS IT IS and its staged row is marked imported, the
  review inbox's rule; the overwrite box does not reach it. A row with
  either cell blank is refused (it could only be duplicated).
- **The slug is uniquified on create.** A slug already taken by an unrelated
  product is not an update target — the draft gets the next free slug
  (`…-2`), the same rule as the inbox.
- **The staged twin is marked IMPORTED** and its shortlist entry confirmed by
  whoever ran the import, when a twin exists in this environment. A file
  from another environment has none, and that is fine.
- The owner-edit rule the importer already applies still holds: a row you
  have edited in the studio only refreshes its stock status unless you tick
  the overwrite box in the preview.
- The fields a supplier's page never publishes get the promote path's
  defaults — the standard care notes, an SEO title and description derived
  from the title and tagline — unless the file carries a cell for them.

### What is filled in for you

- **`category_slug`**, when the file leaves it blank, from the source's own
  category text and the title (`matchCategoryId`, the inbox's auto-map). A
  `category_slug` column you add by hand always wins.
- **`product_tier`**, when blank, from the listing's words and size
  (`suggestSizeTier`, the inbox's suggestion). An explicit cell always wins,
  and a suggestion only ever FILLS: a tier you have filed in the studio is
  never overwritten by a re-upload.

The preview says how many of each it filled, and the `bulk-import`
activity row records the same counts with `origin: "scraper"`.

### What still needs a hand

- **Rows nothing matched** keep the `category_slug is required` error and are
  listed in the preview with the source category that failed. Add a
  `category_slug` column to the file, fill it for those rows with one of your
  category slugs, and upload again.
- **Rows with no clear tier** import untiered; the studio refuses to publish
  them until you pick one in the product editor.
- **The copy.** Every row is a draft carrying the supplier's words. Rewrite,
  re-price (the export's prices are the supplier's, in the supplier's
  currency) and publish from the product editor.

## `tier1-owner-products.csv` — List 1 (the owner's store) products

Snapshot of the **Sheet1** tab (gid=0) of the owner's `resinriva2.0` Google
Sheet, exported 2026-07-16 — 12 products staged from the Tier-1 "Owner's
list" scraper sources, in the Bulk Import `products` template format.

One correction vs. the sheet: the Christmas Bells row's slug
`untitled-sep30_22-17` (a source-store auto-slug, rejected by the importer's
URL-safety rule) was renamed to
`personalized-lithophane-christmas-bells-ornaments`. If you re-import from
the sheet instead of this file, fix that cell the same way first.

### How to import on the live site

1. Sign in to the studio → **Import** (`/studio/import`).
2. Pick **Products** → Continue.
3. Either upload this CSV, or paste the Google Sheet link — the sheet-link
   route only works if the sheet's link-sharing is set to
   *Anyone with the link → Viewer* (it is currently private, which returns
   a 403 to the importer).
4. **Preview** — expect 12 rows, all `Create` on a fresh catalog (rows whose
   slug already exists show as `Update` and will overwrite those fields).
5. **Import**. Gallery images are mirrored from the source CDN into our own
   storage at import time; any image that fails to mirror keeps its source
   URL (pages render it unoptimized, straight from that host).

### Before publishing

Every row imports as **DRAFT** (per the sheet's `status` column) — review in
the studio before publishing:

- Descriptions still carry the source store's copy (third-party business
  names, US-centric wording, contact emails). Rewrite as Rivya Living Art copy.
- `price_min`/`price_max` values look like US-dollar amounts; the site
  renders prices in ₹. Re-price before showing prices publicly.
