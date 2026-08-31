# External image migration audit

**Finding 2 from the brief. Status: tooling complete; completion unmeasured.**

No database was queried, so **the current remaining count is unknown**. What
follows is what the code says, plus how to take the measurement.

## The tooling already exists

`src/lib/catalog-mirror.ts` (audit C3 / M-A5) copies externally-hosted images
into owned storage in resumable batches and rewrites each row's URL. It is
wired to a daily Vercel cron (02:30 UTC) via `/api/cron/mirror-images`, and
staff can trigger a batch on demand.

The design is sound on every point that usually goes wrong:

| Property | How |
|---|---|
| **Never loses an image** | *Any* failure leaves the original URL untouched; the next batch retries |
| **Resumable** | The WHERE clause matches only still-external rows, so mirrored rows fall out of selection |
| **Idempotent** | Deterministic `catalog/<sha1(originalUrl)>.<ext>` — re-mirroring overwrites rather than accreting |
| **SSRF-safe** | Fetches through `safeFetch` |
| **Bounded** | 15s timeout, 8MB cap, concurrency 6 |
| **Quota-safe** | The `catalog/` prefix is excluded from next/image optimization, so ~10k files cannot burn the Vercel optimizer quota |
| **Honest** | Identifies itself with a real User-Agent and contact URL |

Three row types are covered: `ProductImage`, `PortfolioImage` (64 rows at audit
time), `Category.image` (11 at audit time).

**Owned hosts, never mirrored** (`OWNED_HOST_MARKERS`):
`.public.blob.vercel-storage.com`, `res.cloudinary.com`, `kanhakreation.com` —
the three in `next.config.ts` `remotePatterns`.

## Repository-side inventory

External image hosts appear in seed and sample data — `data/tiers/sample/*.csv`
(~94 occurrences each), `docs/import/tier1-owner-products.csv`,
`prisma/seed-portfolio-cases.ts` (~64), `prisma/seed-category-images.ts`,
`src/lib/scraper/seed-data.ts`. Sample and seed fixtures are **not** production
rows; they matter only as the source of what gets imported.

## Take the measurement

Run the three counting queries in `07-DATA-QUALITY-AUDIT.md`. They mirror
`externalCatalogImageWhere` exactly, so the number they return is the number the
mirror job still has to work through.

Then drive it to zero:

```
GET /api/cron/mirror-images?limit=500     (staff session or CRON_SECRET bearer)
```

Resumable, so repeat until the response reports zero remaining. The daily cron
will also grind it down unattended.

## The regression test the brief asks for

Once the count reaches zero, add a CI-failing data-quality assertion:

> a published product image must not use an unapproved external hostname

Derive it from `OWNED_HOST_MARKERS` rather than a second hard-coded list — one
list, one place. Note this needs a database, so it belongs in the CI **build**
job (which has Postgres) rather than the unit job.

## Why this ordering matters

This is the blocker for enforcing CSP (`RR-005`). `img-src 'self' data: blob:
https:` exists *because* catalog imagery lives on hosts that cannot be
enumerated. Drive external images to zero, and `img-src` can be narrowed to the
three owned hosts — at which point enforcement becomes safe. Enforcing first
would break the storefront.
