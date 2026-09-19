# Content inventory — what exists, and where

_2026-09-19. Counts are measured, not inferred: repo fixtures by parsing the
JSON, production by rendering the live site, Drive by listing the folders.
Anything this file could not measure is marked **not measured** rather than
guessed._

## The one-table view

| Entity | Repo demo fixtures | Repo starter fixtures | Live on production | Production DB splits |
| --- | ---: | ---: | ---: | --- |
| Products | 100 | — | **1,063 pieces** (`/shop`, "Showing 24 of 1,063") | not measured |
| Product images | 305 | — | with products | not measured |
| Customization fields | 22 | — | with products | not measured |
| Blog categories | 10 | — | 6 filter chips (`/blog`) | not measured |
| Blog posts | 30 | — | **55 articles** (all five listing pages + direct-slug 200s) | not measured |
| Portfolio cases | 12 | — | **23 cases** (`/portfolio`, two pages) | not measured |
| Portfolio images | 36 | — | with cases | not measured |
| Testimonials | 40 | — | **0 rendered** (permission gate — correct) | not measured |
| FAQs | 30 | **0** | **6 questions** (`/faq`) | not measured |
| Custom pages | 5 (+14 blocks) | — | 0 (none published) | not measured |
| Inquiries | 30 (all nine statuses) | — | n/a — studio-only | not measured |
| Research records | 30 | **0** | n/a — internal-only | not measured |
| Scrape jobs | 3 (+40 staged products) | — | n/a — internal-only | not measured |
| Import runs | 5 | — | n/a — internal-only | not measured |
| Media rows | 40 | — | n/a — library | not measured |
| **Demo total** | **754 rows** | **0 rows** | **0 demo rows in the production DB** | — |

"Production DB splits" means the DRAFT / REVIEW / ARCHIVED / missing-media /
missing-SEO breakdown per entity. That requires reading the production
database, which this audit deliberately did not do from outside. The Studio
already computes the genuine-only version of it: **`/studio/content-health`**
counts `isDemo: false` for every figure it reports. Anything beyond that
screen shows should be measured there, not estimated here.

## Where each copy lives

| Copy | Location | What it is |
| --- | --- | --- |
| Demo fixtures | `prisma/fixtures/demo/*.json` (18 files, 754 rows) | Content Lab source of truth. Seeds preview/dev/CI databases; the host guard refuses production. |
| Starter fixtures | `prisma/fixtures/starter/{faqs,concepts,research}.json` | **Three empty arrays.** The additive production seeder (`npm run seed:starter`) is built, dry-run by default, and has no update branch — but no starter content has been authored into it yet. |
| Genuine journal | `prisma/blog-content/*.md` (55 files) → `seed-blogs.ts` | Upserted by slug, `isDemo: false`. This is why the live journal is healthy. |
| Genuine portfolio | `prisma/seed-portfolio-cases.ts` (23 cases) | All small-format pieces — see CONTENT-AUDIT.md gap 2. |
| Genuine FAQs | `FAQS` in `prisma/seed.ts` (6) | Only ever ran on the first deploy; bootstrap skips it once categories exist. |
| Real catalogue | `data/tiers/*.csv.gz` → deploy-time fill | The 1,063 published pieces. (The demo guard's comment cites "4,385 real products" — that figure is stale or counts every row regardless of status; the public, published, non-demo count measured today is 1,063.) |
| Bundled media | `public/` (326 files) | `redesign/catalog/` 45 concept images (35 heroes + 10 scenes, `.webp`), `media/v3` 67 AVIF masters, `media/v6` 3, `images/blog` 55 covers, categories, sequences, mock. |
| Drive library | Google Drive root folder | See `GOOGLE-DRIVE-ASSET-MAP.md` — 37 curated assets, 45+2 generated images, 100+ historical `hf_` images, 26 historical videos, 2 logos, 2 prompt files. |

## What this means for the craft prompt's phases

1. **The demo architecture is intact and should not change** (Phase 05 holds
   as-is): `isDemo` on twelve tables, the host guard, the owner switch, the
   sitemap/JSON-LD/search exclusions, the Demo Data Manager with server-side
   re-checks and shared-media protection. All present on `main`.
2. **The production gap is not demo content — it is unwritten starter
   content** (Phase 06): the pipeline exists, the fixtures are empty. Writing
   35–50 FAQs, the labelled portfolio concept studies and the internal
   research records into `prisma/fixtures/starter/` is the next content task.
3. **Testimonials stay at zero** until real customer words exist with
   `permissionStatus: GRANTED`. Nothing in any phase should invent them.
4. The live FAQ page renders six genuine answers; the craft target of 35–50
   lands through the starter seeder, never through `seed.ts` (which would
   overwrite owner edits — see CONTENT-AUDIT.md).

## Related

- `docs/content/CONTENT-AUDIT.md` — why the demo content is not on the site (Phase 04 findings)
- `docs/content/DEMO-DATA-MANAGEMENT.md` — the demo architecture and the manager
- `docs/content/GOOGLE-DRIVE-ASSET-MAP.md` — the Drive library, asset by asset
- `docs/content/OWNER-REVIEW.md` — decisions only the owner can make
