# Completed work — what is DONE, verified against HEAD (2026-09-16)

> The companion of [`NEEDED-WORK.md`](NEEDED-WORK.md). Both were built from
> the five brief audits in [`docs/audits/2026-09-16/`](audits/2026-09-16/README.md)
> (every row cites a file, a migration or a CHANGELOG heading) and from the
> repository's own records — `CHANGELOG.md` for the dated account,
> `docs/plan/*` for each workstream's status notes, `CLAUDE.md` for the rules
> that came out of the work. **A thing is listed here only when the audit
> found it in the tree.** Where a brief asked for something that was done
> DIFFERENTLY by a recorded decision, it is listed under "Superseded" with the
> rule, so nobody re-opens it as a gap.

Audited HEAD: `91c93b5` (`main` after PR #92) plus the reference-site rollout
PR that carries this file. Counts per document are in the audit index.

## 1. The business model and the contract (all tiers)

- **No cart, no checkout, no customer accounts, no payment gateway** —
  `CLAUDE.md` HARD RULES; `product-size-tier.test.ts` refuses cart/checkout
  wording in every tier's copy (the brief's Tier 03 "Add to Cart / Checkout"
  is REFUSED BY CONTRACT, T1).
- **Every order persists an `Inquiry` and opens wa.me with the full message**
  — `src/actions/order.ts`; the E2E smoke asserts the `[DEMO] ` prefix and the
  saved row on every PR.
- **Public copy in the CMS, never hardcoded** — 1,297 site-copy slots, 78 image
  slots, sections, forms, navigation, settings; registry → overrides → total
  resolver (`CLAUDE.md` "one pattern, ten surfaces").
- **The design contract in force** — REDESIGN.md v3 "Liquid Luxury" tokens
  (`src/styles/tokens.css`), light ground with at most three dark bands,
  hairlines not boxes, one blur (the header), one motion runtime (GSAP +
  Lenis + CSS) under a 49 KB ratchet, reduced-motion collapse, and five CI
  audits (`redesign-audit`, `a11y-audit`, `keyboard-audit`, `studio-audit`,
  Lighthouse) that gate every PR at 1440 · 1280 · 390 · 360.

## 2. Workstream A — storefront and Studio (closed)

Measured against the running site rather than rebuilt (`docs/plan/01` §3/§4
corrections, D25): the eighteen homepage sections, nine locales, mega menu,
drawer, search overlay (⌘K), announcement bar, mobile bottom bar, WhatsApp
FAB, footer menus, filter drawer with URL facets, quick view, wishlist,
numbered `CureLine` rail, `MeniscusImage` reveals, FLIP lightbox behind the
gallery / portfolio wall / lander gallery, the custom-order wizard with
progress upload and live WhatsApp preview, the large-format landing, the
portfolio masonry and case pages, FAQ with JSON-LD, contact with four
channels. Shipped as A1–A9 (PRs #63, #64, #86 among others): the v4 leading
scale, house eases, hero rise/drift, snap rail, one disabled state, the
Studio's six job-named nav groups, the collections fix, the scraper
workspaces (runs feed, explorer, large-format board).

## 3. Workstream B — the scraper rebuild (B1–B9, PRs #68–#71, #73, #81–#85)

- Cron-drained jobs that finish with the laptop closed; per-page CAS; stale
  reclaim; retry and cancel with operator stamps; five-failure breaker.
- Immutable `ScrapedProduct` + `ResearchProduct` + `ProductSnapshot` history
  written only when `contentHash` moves; `rawPayload` keeps the source's own
  words (B4 fix); append-only price history; `ProductVariant` with
  `PriceBasis` (quote-only is NULL, never 0).
- `NormalizationAlias` resolved at read time; material, colour and unit maps;
  validation failures recorded, not nulled; honest UA, robots honoured, SSRF
  guard, no proxies.
- Two markup-shape adapters with eight fixtures and thirty tests (B5);
  Shopify, WooCommerce and JSON-LD adapters.
- Fair comparison scopes and leagues (B6), seven-state shortlist → explicit
  confirm → CSV/XLSX export (B7), stamped analytics snapshots with coverage
  labels and a transparent four-component opportunity score (B8), pgvector
  attribute embeddings and nearest neighbours (B9).
- **A REGISTERED SOURCE IS NOT AN AUTHORISED ONE**: `policy.ts` fails closed on
  PENDING at create, fan-out and every advance.

## 4. Workstream C — Google Sheets removed (complete)

The push engine, sync policy, service-account client, Sheet1 linking, sync
history screen and the four `GOOGLE_*`/`*SHEET_ID` env vars are gone; the
service account is revoked; the schema was dropped under the two-PR rule
(`20260915150000_drop_sheets_schema`,
`20260917110000_drop_sheets_settings_columns`, PRs #74/#75/#88/#90); the
history is archived in `docs/archive/sheets-2026-09-15/`; the owner exports
from `/studio/exports` instead. What still says "sheet" is the CSV catalogue
fill (`/studio/catalog-fill`, `data/tiers/*.csv.gz`) and two frozen data
strings — recorded in `CLAUDE.md`.

## 5. Workstream D — the Drive asset pipeline

`docs/plan/drive-asset-map.json` and `scripts/lib/media-v3-drive.mjs`: all 71
outstanding renders matched by filename and byte-identical to the CDN copies;
65 masters built into `public/media/v3/`, 20 slots wired; the LQIP manifest
and three on-disk guards that make a missing picture fail a PR.

## 6. Workstream E — the three-tier architecture, per tier

Steps 0–8 of `docs/plan/07` and the backlog worked by rule (PR #92). The
audit's per-tier picture:

| Tier | DONE in the tree |
| --- | --- |
| **All** | `Product.sizeTier` (nullable, one vocabulary in `product-size-tier.ts`, test-pinned against the Prisma enum); publish refusal scoped to the transition; Studio select, bulk **Set product tier**, "No tier yet" filter, content-gaps card, `product_tier` on Bulk Import and the confirmed export; customer-facing names in nine locales (`ProductTier.*`); `?sizeTier=large\|medium\|small` shop facet (drawer, chips, URL, sitemap-safe); PDP order copy per tier (`tier-order-copy.ts`, out-of-stock outranks tier); the scraper's suggestion from title/type/description/dimensions with the operator's override at import; **the backlog filed by rule** — `catalog-size-tier.ts` (category default, decisive words with a decisive margin, supplies never), `prisma/suggest-size-tiers.ts` on production and local builds, the Studio's **Suggest tiers** dialog; demo fixtures tiered (52 · 12 · 34) so every variant reaches an audited route; no "Tier 1/2/3" wording exposed to customers. |
| **LARGE** | The collectible card (`cardVariantFor`/`collectibleCardMeta`), used on `/large-resin-art`; that page's editorial grid (six pieces, three columns), material library, commission CTAs; "Commission a piece" as the primary CTA; price on request; video and 3D fields; dimensions, materials, lead time, care, craft process, project enquiry. |
| **MEDIUM** | "Preserve your memory" as the primary CTA and the WhatsApp intro; occasion browsing on category pages; the before/after slider wired (data-empty); per-product customization fields (text, select, swatch, size, file upload with five references). |
| **SMALL** | "Order on WhatsApp" fast path (byte-identical to the default order intro); occasion, type and price facets; newest sort; quick personalisation via quick view; price visibility; the compact shelf variant. |

## 7. Platform, deploys and safety (2026-09-15/16)

- **The P3009 guard** (`scripts/lib/migrate-resolve-failed.mjs`, PRs #87, #89,
  #91): a failed migration's whole footprint parsed and read back from the
  catalog, three facts that resolve it, one transaction under Prisma's own
  lock, two concurrent builds proven, 70 unit + 8 db tests. It healed the
  2026-09-16 abandoned-branch collision and unblocked production.
- **Connection-retry** for `migrate deploy` (5s · 20s · 45s), never for a
  migration that ran and failed.
- **CI** runs typecheck · lint · copy:check · i18n-missing · unit · a real
  build against `pgvector/pgvector:pg16` · motion budget · db suite · demo
  seed · E2E smoke · the design, a11y, keyboard and Studio audits · Lighthouse.
- **The two-PR drop rule** followed to the letter for every drop; the near-miss
  of the C-tail push recorded in `CLAUDE.md`.

## 8. The evening of 2026-09-16 — the catalogue rebuild begins

- The owner emptied the catalogue from the Studio (4,012 rows, tombstoned);
  `20260917130000_catalog_fill_off_after_purge` switched the deploy-time CSV
  fill OFF in the same push that would otherwise have refilled it (PR #92).
- **The reference-site rollout** (the PR carrying this file): every reference
  site and every source on the owner's own list was verified with the repo's
  own scraper — fingerprint, then a full job — and the ones with an automated
  path are reviewed on the owner's written instruction, enabled, capped at
  500 products and given their first job on the production build after the
  merge; the ones without one are filed as manual research with the reason.
  The owner's previous store is registered. The scraper hub gained the three
  size tiers as batch runs, and every source a product cap. The review inbox
  remains the only path into the catalogue.

## 9. Superseded — done differently by a recorded decision (not gaps)

| Brief asked for | What holds instead | Rule |
| --- | --- | --- |
| Gold `#C9A24B` / teal palette, dark-first, glassmorphism, foil, glow | obsidian · ocean · sapphire · champagne on a light ground | `docs/plan/06` §3, contract §2/§5 |
| threeui 3D hero, magicui/reactbits/21st.dev/daisyui packs, splash cursor, magnetic buttons, split-text, marquee, border-beam, pinned galleries | first-party primitives, one lightbox, one snap rail, 49 KB motion ratchet | D18, D29, contract §8, Part 14 |
| Supabase, Cloudinary, Neon, `app/(studio)`, `research_*`, `--rv-*` tokens, `/collection` slugs | Prisma Postgres, Vercel Blob, `src/app/studio`, separate research tables, unprefixed tokens, the existing routes | `docs/plan/06` §1, §1.1 |
| Roles admin / merchandiser / viewer | `ADMIN` · `EDITOR` | §1.1 (auth off-limits) |
| Seven-stage research machine, `workflow_runs` table, ADRs | `ShortlistState`, the job row as checkpoint, D24–D29 | `docs/plan/02` |
| "Confirmed research never becomes a product" | owner-approved promote is a sanctioned path; still no auto-confirm | HARD RULES |
| Delete `data/tiers`, `ImportConflict`, the fill switches | kept — they are the CSV importer, not Google | `docs/plan/03` |
| Six-week sequence, named branches, `docs/project/*` charters | `docs/plan/README.md` phases 0–9 on `claude/*` PR branches | — |
