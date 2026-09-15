# Product tier data — the committed catalog CSVs

**The files in this directory are the source of truth for the catalog fill.**
They originated as four tabs of the owner's Google Sheet `resinriva2.0`
(`1f4_cl3-8JrYIFTPNhSsuMEl8GAET1n61L9ZZKL8npa8`) and are refreshed from it by
hand, but nothing reads that spreadsheet at build or request time:

| Tab                | Contents                                                  | Import volume (owner brief) |
| ------------------ | --------------------------------------------------------- | --------------------------- |
| `Tier1_Owner`      | Owner catalog (kanha-kreation, resin)                     | all rows (~374)             |
| `Tier2_ResinGoods` | Scraped resin goods (artist-lisa-marie, art-unleashed, …) | top 1,000                   |
| `Tier3_Supplies`   | Resin supplies (apex-resin, …)                            | top 2,500                   |
| `Tier4_3DPrint`    | 3D-printing (3dzone, …)                                   | top 500                     |

## Files

- `Tier1_Owner.csv.gz` … `Tier4_3DPrint.csv.gz`, `OwnerSheet_gid630660076.csv.gz`
  — the FULL tabs, committed and read at deploy time. These are what the
  importer uses.
- `sample/` — partial extracts (~94 rows/tab) pulled through the owner's Google
  Drive connector back when the spreadsheet was private and anonymous CSV
  export returned 401. Superseded by the full files above, which take
  precedence; kept because they are what the pipeline was first proven against.

**Refreshing them** is a manual run of the `Fetch product tier sheets` Actions
workflow, which curls the spreadsheet's public CSV export. It is **not on a
schedule** — it used to be, and every run rewrote 15 MB of gzip with a new
timestamp header, so it committed and redeployed every two hours with a zero-line
diff. It also needs the spreadsheet to still be shared as "Anyone with the link →
Viewer"; once the owner un-shares it (Sheets removal, step 6) the workflow stops
working and these committed files are all there is. That is fine — they are the
source of truth, not a cache.

## Scraper row schema (Tier tabs)

`sourceKey, vertical, externalId, title, slug, category, shortTagline,
description, priceMin, priceMax, currency, showPrice, timeline, materials,
dimensions, status, featured, images, imageAlts, fields, seoTitle,
seoDescription, url, firstSeen, lastSeen, contentHash`

- `images`: `|`-separated URLs (hosts seen: cdn.shopify.com,
  kanhakreation.com, 3dzone.in)
- `fields`: JSON — `tags`, `attributes`, `categories`, `vendor`, `productType`
- `status`: `active` / `out_of_stock`
- prices are INR integers; titles may carry HTML entities; `imageAlts` is
  unreliable (fallback to title)

`prisma/import-tiers.ts` consumes these files at deploy time (idempotent
upserts keyed on `importSource`+`importRef`).
