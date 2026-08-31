# Product tier data — owner's scraped-products sheet

Source of truth: the owner's Google Sheet `resinriva2.0`
(`1f4_cl3-8JrYIFTPNhSsuMEl8GAET1n61L9ZZKL8npa8`), tabs:

| Tab | Contents | Import volume (owner brief) |
| --- | --- | --- |
| `Tier1_Owner` | Owner catalog (kanha-kreation, resin) | all rows (~374) |
| `Tier2_ResinGoods` | Scraped resin goods (artist-lisa-marie, art-unleashed, …) | top 1,000 |
| `Tier3_Supplies` | Resin supplies (apex-resin, …) | top 2,500 |
| `Tier4_3DPrint` | 3D-printing (3dzone, …) | top 500 |

## Files

- `Tier*_*.sample.csv`, `OwnerImportReady.sample.csv` — partial extracts
  (~94 rows/tab) pulled through the owner's Google Drive connector. The sheet
  is **private** (owner-only), so anonymous CSV export returns 401 and Drive
  API export caps out below the sheet's 17 MB. These samples let the import
  pipeline run end-to-end until the full tabs land.
- `Tier1_Owner.csv.gz` … `Tier4_3DPrint.csv.gz` — the FULL tabs, committed by
  the `fetch-tiers` GitHub Actions workflow. **These appear only after the
  owner switches the sheet to "Anyone with the link → Viewer"** and the
  workflow runs. When present, they take precedence over `*.sample.csv`.

## Scraper row schema (Tier tabs)

`sourceKey, vertical, externalId, title, slug, category, shortTagline,
description, priceMin, priceMax, currency, showPrice, timeline, materials,
dimensions, status, featured, images, imageAlts, fields, seoTitle,
seoDescription, url, firstSeen, lastSeen, contentHash`

- `images`: ` | `-separated URLs (hosts seen: cdn.shopify.com,
  kanhakreation.com, 3dzone.in)
- `fields`: JSON — `tags`, `attributes`, `categories`, `vendor`, `productType`
- `status`: `active` / `out_of_stock`
- prices are INR integers; titles may carry HTML entities; `imageAlts` is
  unreliable (fallback to title)

`prisma/import-tiers.ts` consumes these files at deploy time (idempotent
upserts keyed on `importSource`+`importRef`).
