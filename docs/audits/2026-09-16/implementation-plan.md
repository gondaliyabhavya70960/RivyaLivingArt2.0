# `RivyaLivingArt-Implementation-Plan.md` (15 Sep 2026) vs. HEAD `91c93b5` — read-only audit (2026-09-16)

Every row was checked against a file, a migration name or a CHANGELOG/plan heading — not against prose claims. Paths are relative to the repository root; `schema` = `prisma/schema.prisma`, `06` = `docs/plan/06-source-documents.md`, `03` = `docs/plan/03-sheets-removal.md`, `02` = `docs/plan/02-scraper-rebuild.md`, `07` = `docs/plan/07-three-tier-architecture.md`. Statuses: DONE · PARTIAL · NOT DONE · SUPERSEDED (done differently, by a recorded decision) · N/A.

| Doc § | Requirement (short) | Status | Evidence | Note (tier) |
|---|---|---|---|---|
| 1 ¶1 | Redesigned UI, storefront + Studio | PARTIAL | `docs/plan/README.md` "finding 1"; D25(b) README:115; CHANGELOG "A9 — Studio scraper workspaces" | Storefront measured as already built; A1–A3/A5/A7/A9 shipped as a token extension; T2/T4/T8 open owner questions (all) |
| 1 ¶2 | Modernised scraper (durable, ontology, normalisation, comparison, opportunity, similarity) | PARTIAL | `02` §7 "That closes the table" (B1–B9, PRs #68–#71, #73, #81–#85) | Orchestration, scopes, opportunity, similarity shipped; contract depth (§5.1) mostly not (—) |
| 1 ¶3 | Complete Google Sheets removal | DONE | `03` §4 status; `prisma/migrations/20260915150000_drop_sheets_schema`, `20260917110000_drop_sheets_settings_columns` | CSV snapshots kept on purpose (row §4.3 CI) (—) |
| 1 ¶4 / seq. | Phased roadmap; removal only after replacement live | DONE | `06` §5 (export PR #59 first); `docs/plan/README.md` "Sequence" (#66/#67/#74/#75 after) | Storefront queried none of the affected tables (—) |
| 2.1 | "PostgreSQL on Neon" | SUPERSEDED | CLAUDE.md "A MIGRATION HERE IS A PRODUCTION MIGRATION" (`db.prisma.io`); `scripts/db-preflight.mjs:9,17,139` comments still say Neon | Production is Prisma Postgres; stale comments only (—) |
| 2.1 | 55 migrations · ~30 models · 2 crons · ~108 seeded sources · client-polling loop | SUPERSEDED | 72 migrations; 45 `model`s; `vercel.json` 3 crons; `src/lib/scraper/seed-data.ts` 19 sources; `src/app/api/cron/scrape-drain/route.ts:8-29` | Polling hook `src/hooks/use-scrape-runner.ts` retained as the live-tab driver (—) |
| 2.2.1 | Broken product imagery (404) + fallback-image component | SUPERSEDED | `06` §7 (all 6 hot-linked images returned 200); `src/lib/image-src.ts:22,61` degrades to unoptimised `<img>`; `src/lib/catalog-mirror.ts:246`; no `onError` fallback in `src/components/storefront` (grep) | Not an outage; mirror coverage of third-party URLs never measured (all) |
| 2.2.2 | Catalog/brand mismatch (₹40 supplies on luxury template) | SUPERSEDED | CHANGELOG (owner bulk-deleted 4,012 rows 2026-09-16); `20260917130000_catalog_fill_off_after_purge`; `ProductSizeTier` schema:182 | Supplies gone from storefront; segregation now = three tiers (all) |
| 2.2.3 / 6.6 | Inquiry persisted before WhatsApp handoff; status tracking in Studio | DONE | `src/actions/order.ts:341,500` `db.inquiry.create` → wa.me; `InquiryStatus` schema:240; commission board | (all) |
| 2.2.4 / 6.4 | "24 of 1,000" cap; richer sort; collection landers; PDP social proof | DONE | `06` §2 (cap never reproduced); `src/lib/shop.ts:494-497` (`?page=` + cursor); `src/lib/shop-filters.ts:88-94` 5 sorts; `product/[slug]/page.tsx:30,54` testimonials + Review JSON-LD; `/shop/[category]`, `/p/[slug]`, `/large-resin-art` | Only the FAQ expansion (next row) is open (all) |
| 2.2.4 / 6.4 | FAQ 6 → 25+ with schema markup | PARTIAL | `faq/page.tsx:91-95` FAQPage JSON-LD; `prisma/seed.ts:117` still 6 questions; `prisma/fixtures/demo/faqs.json` 30 but `isDemo` | Data, not code — owner adds via `/studio/faqs` (all) |
| 2.2.5 / 6.5 | Locale switcher with consent instead of forced redirect; hreflang only on localised routes | NOT DONE | `src/i18n/routing.ts:23` `localeDetection: true` (Accept-Language + `NEXT_LOCALE` cookie, not geo); `src/i18n/seo.ts:31-34` emits all 9 locales + x-default for every route; `src/components/layout/locale-switcher.tsx` exists | `06` §2 filed it as W3; nothing built. Products ARE localised (routing.ts comment "I3"), so hreflang is not false, just unconditional (all) |
| 2.2.6 | Empty/dead states on supplies/3D filters | SUPERSEDED | Purge (row 2.2.2); `messages/en.json:1045`; `docs/plan/01` §3.5 | Those filters no longer have empty tiers to show (SMALL) |
| 2.3 | Four Studio Sheets surfaces removed | DONE | `src/components/studio/sidebar.tsx:82-83` (Catalog fill · Exports); `settings-form.tsx`, `source-detail.tsx`, `job-dashboard.tsx`, `source-list.tsx` 0 "sheet" hits | (—) |
| 2.4 | Canonical repo / domain / brand settled | DONE | CLAUDE.md:1-8; `package.json:5-7`; `src/lib/constants.ts:31-42` `www.rivyalivingart.com`; `store.bhavyagondaliya.co.in` is the owner's previous store (registered as a manual-research source on 2026-09-16) | (—) |
| 2.4 | Purge ResinRiva remnants | PARTIAL | `src/ResinRivaFavicon.svg`, `src/ResinRivaLogo.svg` still tracked (`git ls-files`), zero importers; dated docs kept under D24 | Two dead files; deleting them is the whole job (—) |
| 2.4 | Fate of scraped Tier 2–4 catalogue | SUPERSEDED | CHANGELOG (purge); CLAUDE.md; `seed-data.ts` = 8 OWNER + 10 size-tier reference sites + the previous store | Deleted, not demoted; registry narrowed to Tier 1 (SMALL) |
| 3 | Do not replatform; new export API; Sheets actions removed | DONE | Same Next 16/Prisma/Vercel; `src/app/api/studio/export/confirmed/route.ts`; `src/app/api/scraper/export-confirmed/route.ts`; `src/actions/scraper-sheets.ts` absent | (—) |
| 3 / 5.3 | Durable runner: DB-backed `workflow_runs` + checkpoint resume | SUPERSEDED | `ScrapeJob.cursorPage` + `updatedAt` heartbeat schema:861-887; CAS `src/lib/scraper/job-runner.ts:766-774`; `scrape-drain/route.ts:16-29` | No separate table; the existing job row is the checkpoint (—) |
| 3 | Adapter registry `sources/<host>/` per-source quirks | SUPERSEDED | `src/lib/scraper/adapters/{priced-store,quote-studio,markup-shape}.ts`; CHANGELOG "Workstream B step 5" | Keyed on markup shape, not host (—) |
| 3 / 5.6 | Embeddings worker path, image + text | PARTIAL | `src/lib/scraper/embedding.ts:16-21` — text attr-hash v1; image explicitly deferred | (—) |
| 3 / 5.1 | Immutable snapshots + price history | DONE | `ProductSnapshot` schema:1001-1013; `PriceHistory` :1351; `tests/db/research-snapshots.test.ts:107,131` | (—) |
| 3 | Sheets models dropped after archival | DONE | migrations above; `docs/archive/sheets-2026-09-15/` | (—) |
| 3 / ADR4 | Blob content-addressed images with hash dedupe; mirroring universal | PARTIAL | `src/lib/catalog-mirror.ts:170-172` sha1 of the SOURCE URL (URL-addressed, not content-hash); `/api/cron/mirror-images` | Universality never measured (`06` §7) (all) |
| 3 | ADRs in `docs/adr/` | SUPERSEDED | dir absent; decisions D25–D29 `docs/plan/README.md:113-119`, ratified in CLAUDE.md | (—) |
| 3 / ADR1 | Dispatcher every 5 min; deterministic workflow IDs | PARTIAL | `vercel.json` `*/10 * * * *`; idempotency = "one run per source" (`createScrapeJob` returns the in-flight job, CLAUDE.md) | 10 min, not 5; no deterministic IDs (—) |
| 3 / ADR2 / 4.1 | Scheduled / emailed export (Resend) | NOT DONE | `src/lib/email.ts` serves auth + order mail only; `03` §3 "Do not build this until asked" | (—) |
| 3 / ADR3 | pgvector, versioned model, mock mode | DONE | schema:1319-1340 `vector(512)`, `model`, `version`; `embedding.test.ts:99` deterministic offline | "on Neon" superseded (—) |
| 4.1 | Export Center: one-click CSV/XLSX of any filtered set | PARTIAL | `src/app/studio/(dashboard)/exports/page.tsx:53-76` — confirmed CSV/XLSX, subscribers CSV, scraped rows CSV | Three fixed exports, no arbitrary filter (—) |
| 4.1 | Confirmed Products workspace: filters, bulk, audit trail, XLSX | DONE | `/studio/scraper/confirmed/page.tsx:52-57`; bulk + filters in `shortlist-inbox.tsx`; audit `ShortlistEntry.changedBy/changedAt/reason` schema:1150-1161 | Two "confirmed" lists exist: catalog `Product.confirmedAt` (Exports page) and research `ShortlistEntry.CONFIRMED` (—) |
| 4.1 | Native catalog importer: preview, row-level failures, dry run | DONE | `src/components/studio/import/import-wizard.tsx:196-228`; `src/actions/import.ts:132,269`; `ImportRun.dryRun/failed` schema:655-671 | Pre-dated the plan (all) |
| 4.1 | `ExportRun` audit model | NOT DONE | no model; export routes write no `ActivityLog` (grep) | (—) |
| 4.1 | Review queue unchanged | SUPERSEDED | rebuilt on `ShortlistEntry` (B7, `shortlist-inbox.tsx`); promote path unchanged | (—) |
| 4.2 | Export all spreadsheet tabs to XLSX; store outside git; count vs SheetSyncRun | SUPERSEDED | `docs/archive/sheets-2026-09-15/README.md`: DB-side history archived IN git (1 sync run, 0 conflicts); tier tabs already `data/tiers/*.csv.gz`; Sheet1 in `docs/import/tier1-owner-products.csv` (2026-07-16) | `Added product in website` / `CONFIRMED_PRODUCTS` tabs not in the repo (—) |
| 4.2 | Reconcile CONFIRMED_PRODUCTS → `confirmedAt`; deliver archive to owner | N/A | CLAUDE.md "The export RAN" — the only push ever recorded was `status: UNCONFIGURED`, never executed; `BACKUP_GUIDE.md:62` (spreadsheet is the owner's own Drive doc) | Nothing was ever written to the tab (—) |
| 4.2 | Revoke service-account key | DONE | CLAUDE.md (step 6, 2026-09-15) | (—) |
| 4.3 code | Delete `sheets.ts`, `sheet-push.ts`, `sheet-policy.ts`, `sheet-settings.ts`, `sheet-delete-plan.ts`(+test), `product-sheet(-sync).ts`, `website-sheet.ts`(+test) | DONE | all absent; care-note defaults moved to `src/lib/scraper/product-enrich.ts:9` | (—) |
| 4.3 code | `confirm.ts` migrated; `export.ts` split | SUPERSEDED | `confirm.ts` kept as the pure gate (imported by `src/actions/products.ts`); `export.ts:7,132` delegates CSV to `src/lib/export/csv.ts` | `CONFIRMED_SHEET_TAB` at `confirm.ts:17` is dead code with a stale name (—) |
| 4.3 code | Delete `sheet-status.ts`; strip env vars | DONE | absent (`src/lib/import-status.ts` is the CSV fill's); `src/lib/env.ts:53-57` no `GOOGLE_*`/`SHEET_ID` | (—) |
| 4.3 actions | Delete `scraper-sheets.ts`; strip sheet calls from 5 actions | DONE | absent; residual "sheet" hits are `importSource = "sheet:*"` frozen-data comments (`scraper-review.ts:295-297`, `scraper-sources.ts:579`) | (—) |
| 4.3 actions | Delete `sheet-fill.ts` | SUPERSEDED | renamed `src/actions/catalog-fill.ts` (`06` §2: deleting it takes the CSV importer) | (—) |
| 4.3 UI | Delete `/studio/sheet-import`, `/conflicts`, `sheet-import/*`, `sheet-fill-policy.tsx` | SUPERSEDED | renamed `/studio/catalog-fill(/conflicts)`, `components/studio/catalog-fill/`, `catalog-fill-policy.tsx` — CSV fill, never Google | (—) |
| 4.3 UI | Delete `sheet-ids-section.tsx`, `sheet-sync-button.tsx`; strip 6 scraper components; Settings section; nav item | DONE | absent; 0 hits each (`purge-tier.tsx:49` comment only); `sidebar.tsx:82-83` | (—) |
| 4.3 DB | Drop `SheetSyncRun`, sheet fields on ScrapeSource/ScrapeJob/ScrapedProduct, `sheetId/sheetTabIds`, both enums | DONE | absent from schema; two drop migrations above | (—) |
| 4.3 DB | Drop `SheetConflict` | SUPERSEDED | `ImportConflict @@map("SheetConflict")` schema:1623-1640 — a CSV-import conflict | (—) |
| 4.3 DB | Drop `sheetFillEnabled/OnDeploy/MaxCreates` | SUPERSEDED | kept as `catalogFill* @map("sheetFill*")` schema:629-638 — they govern the CSV fill | (—) |
| 4.3 DB | Keep `ImportRun`, `DeletedImport`, `importSource/importRef`; one migration | DONE / SUPERSEDED | schema:655,693,109-110; shipped as three migrations under the two-PR rule (CLAUDE.md "DROPPING A COLUMN TAKES TWO PRs") | (—) |
| 4.3 CI | Delete `fetch-tiers.yml` | DONE | `.github/workflows/` = `ci.yml`, `products-purge.yml` | (—) |
| 4.3 CI | Delete `data/tiers/*.csv.gz` + README | SUPERSEDED | `data/tiers/README.md:26` "now the ONLY copy"; CLAUDE.md | Deliberately kept after revocation (—) |
| 4.3 CI | Remove `GOOGLE_*`/`SHEET_*` from `.env.example` and Vercel | PARTIAL | `.env.example:13-14` comment only, no keys; Vercel env not checkable from the repo | (—) |
| 4.3 CI | Tighten CSP `img-src`; prune `remotePatterns` | NOT DONE | `next.config.ts:52-55` blanket `https:`; `:156-165` four hosts | Gated on mirror universality, which is unmeasured (all) |
| 4.3 docs | Delete `docs/google-sheets.md`, `docs/import/`; add `docs/exports.md` | PARTIAL | google-sheets.md gone; `docs/import/README.md` kept (Bulk-Import snapshot); no exports.md — covered in `docs/scraper.md:287`, `docs/troubleshooting.md:37,119`, `docs/studio-workflow.md:42` | (—) |
| 4.3 docs | Update scraper.md, source-adapters.md, ADMIN_GUIDE, BACKUP_GUIDE, CONTEXT.md, CLAUDE.md, AGENTS.md | DONE | `docs/scraper.md:287`; `ADMIN_GUIDE.md:139`; `BACKUP_GUIDE.md:62`; `AGENTS.md:235`; CONTEXT.md archived under D24 | ADMIN_GUIDE §17 "Google Sheets or CSV" is Bulk Import's public-link fetch (`src/lib/import/parse.ts:94-101`), still real (—) |
| 4.3 docs | `QA/11-GOOGLE-SHEETS-AUDIT.md`, `docs/prompts/scraper-studio-sheets-master-prompt.md` (per `03` §2.4) | PARTIAL | both still present, unmarked | Dated records; a one-line "superseded" header would close it (—) |
| 4.3 gates | Repo-wide grep zero hits; build; e2e; deploy without Google env | DONE | src hits = Bulk Import's `docs.google.com/spreadsheets` CSV fetch + comments; `.github/workflows/ci.yml:18,201` comments; CHANGELOG "CI green again"; `.env.example:13-14` | (—) |
| 5.1 | Price basis (5 values); quote-only never 0 | DONE | `PriceBasis` schema:1022 (per_sqft/per_sqm collapsed to `PER_AREA`); `src/lib/scraper/price-basis.ts`; `research-snapshots.test.ts:239` | (—) |
| 5.1 | MTO / one-of-one / limited / customizable flags, lead time, MOQ, rating, bestseller | NOT DONE | `RichProduct` (`src/lib/scraper/types.ts`) has only `timeline`, `featured`; rest untyped in `fields` Json | (—) |
| 5.1 / 5.4 | Geometry L/W/H/… normalised to mm | PARTIAL | `dimensions String?`; `normalizeUnit` `normalize.ts:221` + `AliasKind.UNIT`; `size-tier-suggest.ts:236-272` parses dimensions heuristically; no mm columns | (LARGE) |
| 5.1 | Structured materials (resin family, wood species, live-edge, base, substrate, inclusions) | PARTIAL | `normalizeMaterial` `normalize.ts:57-177` + `AliasKind.MATERIAL`; `materials String?` | (—) |
| 5.1 | Resin visual-language enum (18 values) | PARTIAL | `AliasKind.RESIN_STYLE` schema:1066; `alias-resolver.ts:80` "no built-in map yet" | Kind exists, vocabulary not seeded (—) |
| 5.1 | Colour & optics (opacity, effects, gradient) | PARTIAL | `normalizeColour` `normalize.ts:98,199` + `AliasKind.COLOUR`; no opacity/effect fields | (—) |
| 5.1 | Finish claims recorded as claims | NOT DONE | no field, no code (grep) | (—) |
| 5.1 | Per-value provenance + run id; corrections in alias tables | PARTIAL | `ProductSnapshot.jobId` + immutable `rawPayload` schema:1001-1010; `alias-resolver.ts` at read time; no per-field raw/parsed/inferred tag | (—) |
| 5.2 | Region, currency, delay on source | PARTIAL | `ScrapeSource.country` schema:810; `requestDelayMs` :819; currency lives on `ScrapedProduct.currency` :897, not the source | (—) |
| 5.2 | Source type (brand/marketplace/…), cadence, concurrency cap | NOT DONE | none in schema:803-853; concurrency = one run per source; a per-source product cap (`maxProducts`) landed 2026-09-16 | (—) |
| 5.2 | Analytics league, collection mode, policy review status | DONE | `AnalyticsLeague` :770; `CollectionMode` :737 (HTTP/MANUAL_RESEARCH only, deliberately); `PolicyReviewStatus` :753; `src/lib/scraper/policy.ts:49-119`; `tests/db/source-policy-gate.test.ts` | Fails closed on PENDING (—) |
| 5.2 | Canonical families A–G | SUPERSEDED | `ScrapeTier` size tiers schema:720 + 3 leagues; `07` | (all) |
| 5.2 | Seed the 15-source starter pack (+ Etsy manual_research) | NOT DONE | only `korepox.com` `seed-data.ts`; 13 others + Etsy absent; `06` §4 records the "don't seed competitor domains" tension | Owner's own 8 + 10 verified reference sites instead (—) |
| 5.2 | Sources CRUD from Studio; seed-only defaults | DONE | `src/actions/scraper-sources.ts:77-704` (add/toggle/delete/policy/mode/league); `applySeedSources` upsert-only (CLAUDE.md) | (—) |
| 5.2 | Per-source category tree enable/disable | NOT DONE | only `ScrapeScope.CATEGORY` per job schema:855-859 | (—) |
| 5.3 | Explicit pipeline stages (discovery → … → export) | PARTIAL | `src/lib/scraper/stages.ts:17-26` nine funnel stages as a count rail; no per-run stage; no images/embedding/export stages | (—) |
| 5.3 | Cron dispatcher, bounded slices, 2 pages/invocation kept | DONE | `scrape-drain/route.ts:8-29`; `vercel.json` | (—) |
| 5.3 | Cancel / retry from safe checkpoints | PARTIAL | `src/lib/scraper/run-control.ts:25,71` — retry queues a FRESH job, cancel writes FAILED with operator; `tests/db/scrape-runs.test.ts:68-133` | Not resumed from checkpoint (—) |
| 5.3 | Per-source no-overlap locks | DONE | `scrape-runs.test.ts:108`; CAS on `cursorPage` | (—) |
| 5.3 | Breaker surfaced on a Workflow Runs screen | PARTIAL | `/studio/scraper/runs/page.tsx:42-62,174-175` (retry/cancel, filters); breaker shown on `source-detail.tsx:73-81`, not on runs | (—) |
| 5.4 | Currency → dated FX snapshot to INR | NOT DONE | no FX code (grep); `currency` stored raw | (—) |
| 5.4 | Alias tables applied at compute time | DONE | `NormalizationAlias` schema:1090; `alias-resolver.ts`; `/studio/scraper/mapping`; `tests/db/normalization-alias.test.ts` | RESIN_STYLE/PRODUCT_TYPE/AVAILABILITY have no built-in map yet (—) |
| 5.4 | `docs/data-normalization-resin.md` | NOT DONE | absent; `docs/scraper.md:231-243` "Normalization" instead | (—) |
| 5.4 | Fair comparison scopes (4); leagues never mixed | DONE | `comparison-scopes.ts`, `leagues.ts`, `league-query.ts`; `tests/db/league-guard.test.ts`; CHANGELOG "B6" | (—) |
| 5.4 | Taxonomy with confidence + rule/model version + review queue | PARTIAL | `category-map.ts:57-71` keyword score, no stored confidence/version; `/studio/scraper/quality` (`ValidationFailure`) triages extraction, not mapping | (—) |
| 5.5 | Precomputed analytics keyed source/league/view/scope, stamped, with coverage | DONE | `AnalyticsSnapshot` schema:1225-1240 (`computedAt`, `scrapeRunId`, `normalizerVersion`, included/considered); `analytics.ts:9`; CHANGELOG "B8" | (—) |
| 5.5 | Modules: assortment, price architecture, dimension, material, design-language, production mix, promotion | PARTIAL | `analytics.ts:37-50` two views: `league-price-benchmark`, `funnel-overview` | Five of seven modules absent (—) |
| 5.5 | Event-driven refresh after each run | SUPERSEDED | `recompute-analytics-button.tsx`; `02` §7 B8 "explicit Studio action, never a cron" | (—) |
| 5.5 | Opportunity Score, 8 transparent components in UI | PARTIAL | `opportunity.ts` 4 components (market-depth .35, price-fit .35, freshness .2, option-richness .1); per-component rows schema:1273-1298; `/studio/scraper/analytics` | Transparent, but half the spec's inputs (no Rivya gap, distinctiveness, feasibility, admin weight) (—) |
| 5.6 | Visual similarity search with attribute explanations | PARTIAL | `/studio/scraper/large-format/page.tsx:140-151` nearest neighbours with %; duplicates ≥85%; `features` Json stored schema:1333 but no attribute explanation rendered | Text-attribute, not visual (LARGE) |
| 5.6 | Design-direction generator; AI listing generator with validators | NOT DONE | no code (grep); D28 granted narrowly, unused | (—) |
| 5.7 | robots honoured; per-source rate limit; no proxies/stealth | DONE | `src/lib/scraper/robots.ts`; `job-runner.ts:730`; `requestDelayMs`; no proxy code; `types.ts:106` | (—) |
| 5.7 | Honest named UA | DONE | `types.ts:98,122` `RivyaLivingArtResearchBot/1.0 (+…/contact)`; `user-agent.test.ts` | (—) |
| 5.7 | Auth / paywall / CAPTCHA detection → immediate stop | PARTIAL | no detector (grep captcha/paywall/403 empty); `breaker.ts` pauses after 5 consecutive failures | (—) |
| 5.7 | `manual_research` mode | DONE | `CollectionMode.MANUAL_RESEARCH` schema:745-749; `policy.ts:74` | (—) |
| 6.1 | New design system (editorial luxury, physics motion, 3D viewer) | DONE | REDESIGN.md v3 in force; A1–A3 (`docs/plan/01` §6 status); `src/components/product/model-viewer.tsx`; D29 no `motion` | (all) |
| 6.2 | Image integrity: mirror + global fallback + Drive art-direction pass | PARTIAL | mirror (row 3/ADR4); no fallback component; Drive pipeline wired 20 editorial slots (CLAUDE.md "BUILT 2026-09-15"), not product photos | (all) |
| 6.3 | Catalog segregation into leagues with utilitarian supply templates | SUPERSEDED | `sizeTier`; `card-meta.ts` `cardVariantFor`/`collectibleCardMeta`; `?sizeTier=` facet (CHANGELOG "Workstream E, steps 4–8"); supplies purged | (all) |
| 6.6 | Order-status lookup by phone | NOT DONE | no route/action (grep) | Customer-facing lookup that §1.1 keeps off-limits; not tabled anywhere (all) |
| 6.7 | LCP < 2.0 s; AVIF; splitting; CSP | PARTIAL | `scripts/lighthouse-audit.mjs:138` perf/a11y ≥ 0.9 gate (LCP reported :124, not asserted); `next.config.ts:152` AVIF; CSP not tightened | (all) |
| 7.1 | Studio in same design language, density kept | DONE | `src/app/globals.css:190` `.studio-v2` + dark block; A7 nav groups (`docs/plan/01` §4.1) | (—) |
| 7.2 | New screens: Export Center, Confirmed, Workflow Runs, Data Quality, Similarity, Opportunities | DONE | `/studio/exports`, `/scraper/confirmed`, `/scraper/runs`, `/scraper/quality` (`quality-triage.tsx`), `/scraper/large-format`, `/scraper/analytics` | No standalone similarity query screen (—) |
| 7.3 | Removed screens | SUPERSEDED | rows 4.3 UI | (—) |
| 7.4 | Role model `admin \| merchandiser \| viewer` | NOT DONE | `enum Role { ADMIN EDITOR }` schema:14-17 | Auth off-limits under §1.1; D26 scoped to scraper only (—) |
| 7.5 | Every list: URL filters, saved views, bulk, audit-visible | PARTIAL | 15 dashboard pages read `searchParams`; `saved-views.tsx` used only by `products/product-list.tsx`; `bulk-bar.tsx`; `ActivityLog` | Saved views on one list (—) |
| 8 P0 | Alignment: repo/domain/brand, ResinRiva purge, ADRs, tokens | PARTIAL | rows 2.4; ADRs → D25–D29; tokens: repo tokens win (`06` §3) | (—) |
| 8 P1 | Exit: owner exports confirmed XLSX without Google | DONE | `/api/studio/export/confirmed?format=xlsx`; `/studio/exports` | Whether the owner has run it is not in the repo (—) |
| 8 P2 | Exit: zero grep, deploy without Google env | DONE | row 4.3 gates | (—) |
| 8 P3 | Exit: 15-source scrape resumes after a forced deploy | PARTIAL | drain resumes idle/QUEUED jobs; 15 sources not seeded; no test forces a deploy mid-run (`scrape-runs.test.ts` covers retry/cancel only) | (—) |
| 8 P4 | Exit: charts with coverage labels; raw immutable | DONE | `analytics.ts:9`; `research-snapshots.test.ts:131` | FX/mm/confidence remain open (—) |
| 8 P5 | Exit: precision@k on labelled eval set | NOT DONE | no eval set (grep precision) | (—) |
| 8 P6 | Exit: Lighthouse ≥ 90; zero broken images | PARTIAL | Lighthouse gate DONE; broken-image gate scoped to bundled roots (`redesign-audit.mjs`, CLAUDE.md) | (all) |
| 8 P7 | Exit: merchandiser workflow end-to-end in new UI | PARTIAL | A9 + B7: register → policy → scrape → shortlist → confirm → export doable; roles not | (—) |
| 8 P8 | Tests (unit, Postgres, fixture adapters, snapshot regression, e2e), docs, runbooks | PARTIAL | vitest; `tests/db/` 18 files; `adapters/__fixtures__/` 8 HTML; `scripts/e2e-smoke.mjs`; `docs/troubleshooting.md`, `docs/adapter-acceptance-checklist.md`; no adapter snapshot-regression suite | (—) |
| 9.1 | Register → policy → enable categories → trigger/schedule → durable progress, zero Google | PARTIAL | CRUD/policy/trigger/runs DONE; category enable and scheduling absent | (—) |
| 9.2 | Full contract; quote-only ≠ 0; immutable snapshots | PARTIAL | contract §5.1 rows; quote-only + immutability DONE | (—) |
| 9.3 | Fair comparison on normalised categories, base-product scope, matched leagues | DONE | row 5.4 scopes; `PRODUCT_TYPE` alias has no built-in map yet | (—) |
| 9.4 | Visual similarity + explainable opportunity | PARTIAL | rows 5.5/5.6 | (—) |
| 9.5 | Shortlist → explicit confirm → export; no auto-confirm | DONE | `shortlist.ts` (CONFIRMED only from SHORTLISTED); `tests/db/shortlist-write.test.ts`; `confirm.ts:6-10` | (—) |
| 9.6 | Grep gate (fonts excluded); no Google creds in prod | DONE | row 4.3 gates | (—) |
| 9.7 | Lighthouse ≥ 90; zero 404 images; locale consent live | PARTIAL | Lighthouse DONE; image gate bundled-only; consent NOT DONE | (all) |
| 9.8 | Historical Sheet data archived, reconciled, handed over | SUPERSEDED | rows 4.2 | (—) |
| 10 | Feature-flag the dispatcher; keep client polling one release | PARTIAL | no flag (`CRON_SECRET` auth only); `use-scrape-runner.ts` retained | (—) |
| 10 | Fixture adapter tests, breakers, validation triage | DONE | `adapters/*.test.ts` + `__fixtures__`; `breaker.ts`; `/studio/scraper/quality` | (—) |
| 10 | Staged demotion + 301s for removed catalogue pages | NOT DONE | no `redirects()` in `next.config.ts`; catalogue purged outright | (SMALL) |
| 10 | Non-goals: no cart/checkout, no spreadsheet sync, no auth scraping | DONE | CLAUDE.md HARD RULES; `product-size-tier.test.ts` refuses cart/checkout wording (T1); `policy.ts` fails closed | (all) |

## Summary (122 rows)

- **DONE 50 · PARTIAL 38 · NOT DONE 17 · SUPERSEDED 25 · N/A 1** (one row carries DONE/SUPERSEDED; counted once as DONE).
- Google Sheets removal (§4) is complete to the provider level; every "not deleted" item there is a recorded keep (CSV fill, `data/tiers`, `ImportConflict`), plus two dead files (`confirm.ts:17` constant, `docs/import/`) and two unmarked QA/prompt docs.
- The scraper's *infrastructure* (durability, snapshots, aliases, scopes, shortlist, analytics stamps, pgvector) is built; the *Resin Product Data Contract* (§5.1) is the largest gap — geometry in mm, structured materials, the 18-value resin-style vocabulary, finish claims, production flags and FX are absent or alias-kinds without maps.
- Storefront items are mostly SUPERSEDED by the three-tier architecture and the owner's purge; the plan's factual premises (404 images, "24 of 1,000", Neon) did not hold.
- **Five most important open items:** (1) `src/i18n/routing.ts:23` — forced locale redirect still on; no consent switcher (§2.2.5/§6.5/DoD 7). (2) §5.1 contract depth — no mm geometry, structured materials, resin-style/finish vocabularies or production flags in `src/lib/scraper/types.ts` / `prisma/schema.prisma`. (3) `next.config.ts:55,156-165` — CSP `img-src https:` and `remotePatterns` never tightened, blocked on measuring mirror coverage (`docs/plan/06-source-documents.md` §7). (4) §5.5 analytics modules and §5.2 registry metadata — two of seven views, four of eight opportunity components, no source type/cadence/concurrency, no 15-source pack. (5) Small hygiene: `src/ResinRivaFavicon.svg`, `src/ResinRivaLogo.svg`, `CONFIRMED_SHEET_TAB` in `src/lib/scraper/confirm.ts:17`, and stale Neon comments in `scripts/db-preflight.mjs:9,17,139`.
- Not verifiable from the repo: Vercel env-var removal, and whether the owner has personally run the XLSX export.
