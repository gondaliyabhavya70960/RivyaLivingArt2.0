# Bulk-import snapshots

## `tier1-owner-products.csv` — Tier-1 (Owner's list) products

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
  names, US-centric wording, contact emails). Rewrite as ResinRiva copy.
- `price_min`/`price_max` values look like US-dollar amounts; the site
  renders prices in ₹. Re-price before showing prices publicly.
