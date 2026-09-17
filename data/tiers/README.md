# Import list data — the four committed catalog CSVs

**The files in this directory are the source of truth for the catalog fill.**
They are the four IMPORT LISTS: where a catalogue row CAME FROM, recorded on
`Product.tier` (an Int, 1–4) and read in the Studio as "List 1 — Owner's
store" … "List 4 — 3D printing" (`src/lib/import-list.ts`, the one copy of
those words). They are not the product tier — that is `Product.sizeTier`, the
three-tier architecture, and "tier" on a Studio screen means only that.

They originated as four tabs of the owner's Google Sheet `resinriva2.0`
(`1f4_cl3-8JrYIFTPNhSsuMEl8GAET1n61L9ZZKL8npa8`) and were refreshed from it by
hand, but nothing reads that spreadsheet at build or request time:

| List | File stem          | Contents                                                  | Import volume (owner brief) |
| ---- | ------------------ | --------------------------------------------------------- | --------------------------- |
| 1    | `Tier1_Owner`      | Owner catalog (kanha-kreation, resin)                     | all rows (~374)             |
| 2    | `Tier2_ResinGoods` | Scraped resin goods (artist-lisa-marie, art-unleashed, …) | top 1,000                   |
| 3    | `Tier3_Supplies`   | Resin supplies (apex-resin, …)                            | top 2,500                   |
| 4    | `Tier4_3DPrint`    | 3D-printing (3dzone, …)                                   | top 500                     |

**The file stems are FROZEN.** They still say `Tier` because they are the
read path in `src/lib/import/tier-fill.ts` and the keys of every
`sheet-import` activity row already written; `src/lib/import-list.test.ts`
pins `IMPORT_LIST_FILE` to the reader so the two cannot drift. Renaming one
would orphan the history from its reader, the same class of break as
renaming a column. Only the words a person reads changed (2026-09-17).

## Files

- `Tier1_Owner.csv.gz` … `Tier4_3DPrint.csv.gz`, `OwnerSheet_gid630660076.csv.gz`
  — the FULL lists, committed and read at deploy time. These are what the
  catalog fill uses.
- `sample/` — partial extracts (~94 rows/list) pulled through the owner's
  Google Drive connector back when the spreadsheet was private and anonymous
  CSV export returned 401. Superseded by the full files above, which take
  precedence; kept because they are what the pipeline was first proven against.

**These files are now the ONLY copy.** The owner un-shared the spreadsheet and
revoked the service account on 2026-09-15 (Sheets removal, step 6), so the
`Fetch product tier sheets` workflow that used to refresh them has no source to
read and was deleted with it — `git log --diff-filter=D` has it if a future
spreadsheet is ever shared again.

That was always the plan and is not a loss: these committed files are the
source of truth, not a cache, and `prisma/import-tiers.ts` reads them off disk
at deploy time. **Refreshing them now means replacing the `.csv.gz` files in a
commit** — from a fresh export of whatever the owner's current source is, via
Bulk Import's own CSV/XLSX path, or by re-sharing a sheet and restoring the
deleted workflow.

## Scraper row schema (the four lists)

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
