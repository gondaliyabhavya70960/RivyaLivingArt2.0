# BACKUP_GUIDE.md — Backup & Recovery

Three things hold ResinRiva's data: the **Neon database** (all content, orders, settings), the **Vercel Blob store** (all media files), and the **git repository** (code, schema, seed). This guide covers protecting and restoring each.

## 1. Database — Neon Postgres

### Point-in-time recovery (built in)

Neon keeps a rolling **point-in-time recovery (PITR)** history — you can restore the database to any moment inside the retention window without having taken a manual backup first.

1. Vercel Dashboard → project → **Storage** tab → the Neon database → **Open in Neon** (opens the Neon console).
2. In the Neon console: **Restore** (branch restore) → pick the **timestamp** to restore to.
3. Neon restores by creating/branching at that point in time. Restore to a **new branch** first (never straight over production) — verify it (see §4), then promote or copy the data over.

### Manual export — `pg_dump`

For a file you fully control (keep these outside the laptop too — a cloud drive counts):

```bash
# get the production connection string into .env (Prisma-style; see INSTALL.md)
vercel env pull .env --environment=production

# dump (custom format — compressed, restorable table-by-table)
pg_dump "$DATABASE_URL" --format=custom --no-owner \
  --file="resinriva-$(date +%Y%m%d-%H%M).dump"

# restore into an empty database when needed
pg_restore --no-owner --dbname="$TARGET_DATABASE_URL" resinriva-YYYYMMDD-HHMM.dump
```

(If `$DATABASE_URL` isn't exported in your shell, paste the string from `.env` directly in quotes.)

### When to back up (cadence)

- **Always immediately before:** a Bulk Import run, a bulk delete, or approving a batch in the Product Scraper — the three operations that change many rows at once.
- Weekly `pg_dump` once real orders/content are flowing.
- Before any Prisma migration in production.

## 2. Media — Vercel Blob

- Every **upload** (studio media, customer reference images) is tracked in the **`Media` table** (`url` + `pathname`). But the catalog-mirror pipeline (Sheet Import + the nightly cron) writes mirrored product images **only to `ProductImage.url`** — those blobs get no `Media` row. **The blob inventory is therefore `Media` PLUS the `ProductImage` rows whose `url` points at `*.public.blob.vercel-storage.com`.** A database backup includes both lists; the files themselves stay on Blob.
- To snapshot the files too, export the combined inventory and re-download: `psql "$DATABASE_URL" -c "\copy (select url from \"Media\" union select url from \"ProductImage\" where url like '%public.blob.vercel-storage.com%') to 'media-inventory.csv' csv header"` then fetch each `url` (they're public CDN URLs).
- ⚠️ **Blob deletions are permanent.** When you delete media (or products/portfolio items, which clean up their files), the blob is gone — there is no recycle bin, and Neon PITR does **not** bring files back, only the database rows pointing at them. This is exactly why the Studio makes you type `DELETE` for bulk deletions of more than 10 items.

## 3. Code & content structure — git

- The GitHub repo (https://github.com/gondaliyabhavya70960/ResinRiva2.0.git) is the source of truth for code, the Prisma schema, migrations, and the seed structure (categories, FAQs, legal pages). Losing a server loses nothing that's committed.
- **Never commit `.env*` files** (`.gitignore` already excludes them) — secrets live in Vercel's environment variables, which are themselves recoverable from the dashboard.

## 4. Restore drill (verify before you need it)

Practice once so a real recovery is boring:

1. In the Neon console, **restore/branch to a new branch** from a chosen timestamp (or `pg_restore` a dump into a fresh Neon branch/database).
2. In Vercel, create a **preview deployment** and point its `DATABASE_URL` env var (Preview environment) at the new branch's connection string.
3. Open the preview URL: check `/studio` login, products, and a recent WhatsApp order's message text.
4. Happy? Promote: either switch production's `DATABASE_URL` to the restored branch, or copy the verified data across. Then delete the scratch branch.

## 5. What is NOT backed up automatically

- **WhatsApp conversations** — the actual chats with customers live only in WhatsApp. The site keeps every generated order message (Inquiry rows), but negotiation history, payment confirmations, and photos sent in chat exist only on the phone. Use WhatsApp's own chat export/backup if you need them preserved.
- **The scraper Google Sheet** (optional integration) — not covered by any of the above, but Google Drive keeps its own version history (File → Version history in Sheets).
- **Vercel env var values** — visible in the dashboard, but keep a private offline note of `AUTH_SECRET` and the optional API keys so a project re-creation is painless.
