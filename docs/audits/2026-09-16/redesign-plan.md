# `RIVYA-REDESIGN-IMPLEMENTATION-PLAN.md` (2026-09-14) vs. HEAD `91c93b5` — read-only audit (2026-09-16)

**Framing (from `docs/plan/06-source-documents.md` §1 and `CLAUDE.md`):** this document is "document 4" in that reconciliation — written against the OLDER `RivyaLivingArt` repository (Supabase, `app/(studio)/`, `research_*` schema, `lib/sheets/`) after a GitHub 404 that was a visibility artefact. None of its paths exist here (verified: `lib/sheets`, `app/(studio)`, `supabase/migrations`, `app/api/cron/sheets-sync`, `components/studio/sheets`, `scripts/sheets`, `data/higgsfield`, `docs/design/COMPONENT_REGISTRY.md`, `docs/requirements/03-UI-REDESIGN-BRIEF.md`, `CANONICAL-DECISIONS.md`, `RIVYA-WORLD-CLASS-UI-PROMPT.md` — all ABSENT). Its *intent* was re-planned as `docs/plan/01–07` and shipped as workstreams A–E (PRs #59–#92). The table verifies each concrete requirement against what this repo actually has. `.env.example` could not be read in the auditing session — noted where it matters.

| Doc § | Requirement (short) | Status | Evidence | Note (tier) |
|---|---|---|---|---|
| 0 | Next.js App Router, React 19, Tailwind 4, TS | DONE | `CLAUDE.md` Stack; `package.json` | all |
| 0 | Supabase Postgres + Auth, Cloudinary | NOT APPLICABLE | `docs/plan/06-source-documents.md:45-49` | This repo: Prisma + Prisma Postgres, Auth.js, `@vercel/blob` (`package.json:50`) |
| 0 | No checkout, no accounts, no payment gateway | DONE | `CLAUDE.md` HARD RULES; no Stripe/Razorpay dep in `package.json` | all |
| 0 | Conversion = persist inquiry → WhatsApp handoff | DONE | `src/actions/order.ts:216-368` (`submitProductOrder` → `db.inquiry.create` → wa.me) | all |
| 0 | Masthead Shop · Bespoke · Studio · Journal + search + WhatsApp | DONE | `src/lib/constants.ts:80-85`; `src/components/storefront/site-header.tsx:492-506` | all; T2 (07:177) proposes a tier-named swap — open |
| 0 | Routes `/collection`, `/journal`, `/custom-commissions`, `/large-format` | SUPERSEDED (this repo's slugs) | `src/app/[locale]/(v2)/{shop,blog,custom-order,large-resin-art}` | 20 public routes here |
| 0 | Studio at `app/(studio)`, 106 pages | NOT APPLICABLE | `src/app/studio/` — 61 `page.tsx` | — |
| 0 | `research_*` schema + isolation guard scripts | NOT APPLICABLE | No such schema; equivalent is separate `ScrapedProduct`/`ResearchProduct` tables + "no path from scrape to confirmed" (`src/lib/scraper/confirm.ts:1-11`) | — |
| 0 | Seven-stage RAW→…→CONFIRMED machine | SUPERSEDED (by `ShortlistState`) | `prisma/schema.prisma:1117-1131`; `src/lib/scraper/stages.ts` | — |
| 0 | Jobs drained by Vercel cron | DONE | `vercel.json:11-14` (`/api/cron/scrape-drain` every 10 min); `src/lib/scraper/job-runner.ts:10-17` | — |
| 0 | Robots, rate limits, circuit breaker | DONE | `src/lib/scraper/robots.ts:109`; `breaker.ts:23` (threshold 5); `types.ts:128` | — |
| 0 | Invariant: competitor imagery never downloaded/re-hosted | NOT DONE (design conflict) | Promote mirrors ≤6 images to Blob: `src/actions/scraper-review.ts:27-31`; `src/lib/catalog-mirror.ts:13-26`; conflict recorded `06:172-191` | Staged rows store URLs only; the catalogue copy is this repo's earlier decision |
| 0 | Invariant: confirmed research never becomes a catalogue product | SUPERSEDED (business model) | `CLAUDE.md` HARD RULES: scraper review+approval is a sanctioned catalogue path; still no auto-confirm (`src/lib/scraper/shortlist.ts`) | — |
| 0 | Invariant: zero competitor domains seeded in repo | NOT DONE (owner decision) | `src/lib/scraper/seed-data.ts` — 19 named sources (8 OWNER + 10 size-tier + the previous store), all reviewed by the 2026-09-16 rollout or PENDING | LARGE/MEDIUM/SMALL sources filed 2026-09-15 |
| 0 | Invariant: quote-only never price 0 | DONE | `prisma/schema.prisma:1016-1027`; `src/lib/scraper/price-basis.ts`; `src/lib/export/confirmed.ts:34` | all |
| 0 | Sheets live at `lib/sheets/**` etc. | NOT APPLICABLE (paths); equivalent DELETED | `docs/plan/03-sheets-removal.md:141-151`; CHANGELOG "C-tail" | — |
| 0 | 250 Higgsfield assets in `data/higgsfield/asset-manifest.json` | NOT APPLICABLE | This repo: `docs/media-v3-manifest.json` (55 planned, 65 masters) + `docs/plan/drive-asset-map.json` | — |
| 0 | Concept media flagged `is_concept` | SUPERSEDED | `Media.provenance` enum `UPLOAD/BUNDLED/AI` (`prisma/schema.prisma:506-514`); §15.2 rule | — |
| 0 | Design debt in `docs/SESSION-STATE.md`, `03-UI-REDESIGN-BRIEF.md` | NOT APPLICABLE | Files absent; this repo's equivalents `docs/plan/01` §3/§4 corrections | — |
| 1 D1 | Work in `RivyaLivingArt`, not 2.0 | SUPERSEDED | `CLAUDE.md` "The canonical repository"; `06:29-33` (404 = visibility) | — |
| 1 D2 | Delete Sheets; Studio-native export | DONE | CHANGELOG C-tail; `src/app/studio/(dashboard)/exports/page.tsx:48-76` | — |
| 1 D3 | No competitor bytes; similarity from attributes | PARTIAL | Similarity is attribute-only (`src/lib/scraper/embedding.ts:20-24`) ✓; promote path mirrors images ✗ (see §0 row) | — |
| 1 D4 | No competitor domains in git | NOT DONE (owner decision) | `seed-data.ts` (19 sources); `06:103-105` flags it | — |
| 1 D5 | Research → catalogue bridge manual, field-by-field | DONE | `src/actions/scraper-review.ts:503` (`scraper-import` action); `shortlist.ts` "no automatic transitions" | — |
| 1 D6 | Concept Higgsfield media labelled, never delivered photography | DONE | `Media.provenance=AI`; §15.2; `messages/en.json:334,372` `conceptLabel: "Concept"` on furniture/rooms tiles | LARGE tiles |
| 1 D7 | Adapt 6–10 primitives, install no kits | DONE | `package.json` has no magicui/daisyui/motion/framer; README D29 forbids `motion`; `scripts/motion-budget.mjs:12-13` | — |
| 1 D8 | Keep slugs, restyle only | DONE | REDESIGN.md §1.1 in force; routes unchanged | — |
| 2 | Public app reads CMS/catalog only | DONE | `CLAUDE.md` "one pattern, ten surfaces" (registry → overrides → total resolver) | — |
| 2 | Studio confirmed-product workspace | DONE | `src/app/studio/(dashboard)/scraper/confirmed/`; `/studio/exports` | — |
| 2 | CSV/PDF export, one-way, audited | PARTIAL | CSV/XLSX: `src/app/api/studio/export/confirmed/route.ts`, `api/scraper/export-confirmed`; NO PDF anywhere (grep); routes gate on `requireStaff` (`:33`) but write no `ActivityLog` | — |
| 2 | Supabase + Cloudinary/Higgsfield store | NOT APPLICABLE | Prisma Postgres + Vercel Blob | — |
| 2 | Research workers: drain, adapters, normalize, analytics/score | DONE | `vercel.json`; `src/lib/scraper/{adapters/,normalize,analytics,opportunity}.ts` | — |
| 2 | No Google API client, no Sheet cron, no `integrations.sheets.*` permission | DONE | `src/` grep: only comments + Bulk Import "paste a Google Sheets link" copy; `vercel.json` has 3 crons, none Sheets; no permission-key system exists (roles only) | — |
| 3 W0.1 | Branches `redesign/public`, `chore/remove-sheets`… | SUPERSEDED | Work landed on `claude/*` PR branches (#59–#92) | — |
| 3 W0.2 | Snapshot HEAD SHA / project refs | DONE | `docs/plan/README.md:3` (base `b593f72`) | — |
| 3 W0.3 | `docs/project/REDESIGN-2026-09.md` charter marking Sheets condemned | SUPERSEDED | `docs/plan/README.md` + `03-sheets-removal.md` | — |
| 3 W0.4 | Update `03-UI-REDESIGN-BRIEF.md` Sheets line | NOT APPLICABLE | File absent | — |
| 3 W0.5 | `rg` inventory + CI grep that fails if Sheets returns | PARTIAL | Inventory done (`03` §2); NO CI grep step in `.github/workflows/ci.yml` (only two comments mention "Sheet", lines 18, 201) | — |
| 3 W1.A | Delete `sheets-sync` cron | DONE | `vercel.json:2-15` | — |
| 3 W1.A | Remove Studio nav item + sheets route | DONE | `src/components/studio/sidebar.tsx` (no "sheet"); route list has none | — |
| 3 W1.A | Revoke Google service-account env vars | DONE (per record) | `CLAUDE.md` scraper section: four `GOOGLE_*`/`*SHEET_ID` vars deleted, service account revoked (step 6, 2026-09-15); Vercel dashboard not verifiable here | — |
| 3 W1.A | Studio notice on old bookmark ("Sheets export retired…") | NOT DONE | No redirect/notice in `next.config.ts` or `src/proxy.ts`; old path 404s. Documented instead in `docs/troubleshooting.md:35-41` | Low value |
| 3 W1.B | Delete Sheets lib/UI/cron/scripts/tests | DONE | `03:141-151`; CHANGELOG C entries; `src/lib/scraper/product-enrich.ts:6-11` records what survived | — |
| 3 W1.B | Drop `googleapis`/`google-auth-library` | NOT APPLICABLE | Never a dependency (hand-rolled JWT) — `docs/plan/README.md:85-87` | — |
| 3 W1.B | Remove `integrations.sheets.*` permission keys | NOT APPLICABLE | No permission-key system; `Role` enum only | — |
| 3 W1.B | Docs sweep (guide/PRD/roadmap) | DONE | `docs/troubleshooting.md:35-41` rewritten "Gone"; `docs/archive/google-sheets.md`; `docs/studio-workflow.md:40`. Residual: dead `CONFIRMED_SHEET_TAB` const + "Google Sheet" wording in `src/lib/scraper/confirm.ts:8,16` | Cosmetic |
| 3 W1.C | Forward migration dropping tables/enums | DONE | `prisma/migrations/20260915150000_drop_sheets_schema`, `20260917110000_drop_sheets_settings_columns` | Two-PR rule followed (`CLAUDE.md`) |
| 3 W1.C | Do not edit old migrations in place | DONE | `20260824170000_sheet_sync_policy`, `20260904107000_sheet_conflicts_sync_runs` still present | — |
| 3 W1.C | One-time dump archived before drop | DONE | `docs/archive/sheets-2026-09-15/{sheet-sync-runs,import-conflicts}.csv` + README | — |
| 3 W1.D1 | Confirmed Products workspace = canonical list | DONE | `/studio/scraper/confirmed` (B7); `/studio/exports` | — |
| 3 W1.D2 | Audited CSV, column allowlist, no PII | PARTIAL | Allowlist `src/lib/export/confirmed.ts:49-70` ✓; staff-gated ✓; download not logged to `ActivityLog` ✗; no inquiry export exists at all | — |
| 3 W1.D3 | Comparison/opportunity PDF from data | NOT DONE | No PDF library or route (grep `pdf` → only `media-ingest.test.ts`); analytics render HTML at `/studio/scraper/analytics` | — |
| 3 W1.D4 | First-party catalog CSV import in-Studio | DONE | `/studio/import`; `src/lib/import/templates.ts` | — |
| 3 W1 gate | `rg` for Sheets fails in runtime | PARTIAL | Manual grep passes (comments only); not a CI gate | — |
| 3 W1 gate | check + unit/e2e green | DONE | CHANGELOG "CI green again"; `ci.yml` runs typecheck·lint·test·build·e2e | — |
| 3 W1 gate | Isolation guards still pass | SUPERSEDED | `src/lib/scraper/confirm.test.ts`, `tests/db/shortlist-write.test.ts` (no auto-confirm) | — |
| 3 W1 gate | No Google private key in Vercel / `.env.example` | PARTIAL (unverified) | `.env.example` unreadable in the auditing session; `CLAUDE.md` records vars removed | Owner to eyeball Vercel env |
| 3 W2.1 | Canonical families A–G as research taxonomy | NOT DONE (deferred by design) | `prisma/schema.prisma:938-945` — `canonicalFamily/Type/scaleClass/confidence` "deliberately NOT in this migration"; `category-map.ts` maps to catalogue categories only | all |
| 3 W2.1 | Raw source category unchanged | DONE | `ScrapedProduct.category`; `ProductSnapshot.rawPayload` holds source's words (B4 fix, `CLAUDE.md`) | — |
| 3 W2.1 | Canonical family / type / scale class | PARTIAL | Scale class only: `ScrapeSource.tier` size values + `Product.sizeTier` (`schema.prisma:182-186`, E step 2); no family/type | LARGE/MEDIUM/SMALL |
| 3 W2.1 | Resin style enum (river, geode, … 18 values) | NOT DONE | `AliasKind.RESIN_STYLE` exists (`schema.prisma:1069`) but `normalize.ts` has only `MATERIAL_ALIASES` (:57) and `COLOUR_ALIASES` (:98) | — |
| 3 W2.1 | Structured materials (wood species, live-edge, base, substrate, inclusions) | PARTIAL | Flat `materials` string normalized via `MATERIAL_ALIASES`; no role-typed `ProductMaterial` table (plan `02:131-133`) | — |
| 3 W2.1 | Price basis enum | DONE | `PriceBasis` + `ProductVariant.priceBasis` (`schema.prisma:1022-1053`) | — |
| 3 W2.1 | MTO / one-of-one / limited / customizable / lead-time text | PARTIAL | `ScrapedProduct.timeline` (lead-time text) only; no `ProductionModel` (plan `02:136-137`) | — |
| 3 W2.1 | Geometry normalized to mm, raw retained | NOT DONE | `dimensions String?` free text; unit aliases only (`normalize.ts:149-152`); `embedding.ts:23` "wait for the geometry parser" | LARGE most affected |
| 3 W2.1 | Provenance on every important field | PARTIAL | Snapshot-level (`rawPayload`, `capturedAt`, `jobId`), alias `createdBy`, score `detail`; no per-field provenance column | — |
| 3 W2.1 | Corrections in alias tables at compute time; raw immutable | PARTIAL | `NormalizationAlias` + `alias-resolver.ts` read-time ✓ (B4); snapshots immutable ✓; **no Studio writer** — no action/UI creates alias rows (`/studio/scraper/mapping/page.tsx:9-12` is a report) | Owner cannot add an alias without SQL |
| 3 W2.2 | Widen extraction contract (identity, prices, variants, dims, materials, resin language, colour/opacity, finish claims, craft model, media, badges) | PARTIAL | `RichProduct` (`src/lib/scraper/types.ts:24-56`): identity, price min/max, `variants`, dims/materials text, images, `fields`; no resin language / opacity / finish claims / craft model | — |
| 3 W2.2 | `Contact for price` ≠ 0 | DONE | `price-basis.ts`; `adapters/quote-studio.ts` (NULL price); B3a | — |
| 3 W2.2 | No wood/resin inferred from pixels as fact | DONE (trivially) | No vision path exists (`embedding.ts:20-22`) | — |
| 3 W2.2 | AI inferences in separate columns with confidence | NOT DONE | No AI inference exists; `confidence` deliberately deferred (`schema.prisma:938-945`) | — |
| 3 W2.2 | Missing expected fields → validation-failure rows | DONE | `ValidationFailure` (`schema.prisma:1180`); `validation.ts:33` `CHECKED_FIELDS`; `/studio/scraper/quality` | — |
| 3 W2.2 | Images: store URLs only | PARTIAL | Staged: URLs only (`ScrapedProduct.images` Json); promote mirrors bytes (`scraper-review.ts:27-31`) | — |
| 3 W2.3 | Four comparison scopes, identical payload | DONE | `src/lib/scraper/comparison-scopes.ts:30-35`; B6 | — |
| 3 W2.3 | Document reference-variant selection | DONE | `ScopedPick.rationale` per row (`comparison-scopes.ts:62-66`); shown in explorer/confirmed export | — |
| 3 W2.4 | Family/type mix; dimension bands; material stack; design-language share; MTO vs ready | NOT DONE | `ANALYTICS_VIEWS` = `league-price-benchmark`, `funnel-overview` only (`analytics.ts:37-40`) — depends on the missing ontology | — |
| 3 W2.4 | Price architecture per family, no global tiers | PARTIAL | Per LEAGUE × scope × source (B6/B8), not per family | — |
| 3 W2.4 | Coverage label `computed from X of N` on every chart | DONE | `analytics.ts:75-111` `computedFrom`; `AnalyticsSnapshot.includedCount/consideredCount` (`schema.prisma:1239-1240`) | — |
| 3 W2.4 | Opportunity score = weighted transparent components | DONE | `opportunity.ts:39-49`; `OpportunityScore` per component, no stored total (`schema.prisma:1257-1283`) | — |
| 3 W2.4 | Cache keyed by source/league/view/scope + versions | DONE | `AnalyticsSnapshot @@unique([view,league,scope,sourceKey])` + `normalizerVersion`/`analyticsVersion` (`schema.prisma:1225-1255`) | — |
| 3 W2.4 | Never mix DIY / B2B MOQ / luxury goods | DONE | `AnalyticsLeague` (`schema.prisma:770-780`); `isReference` stamped and excluded BY CLAUSE (`leagues.ts`, `league-query.ts`) | — |
| 3 W2.5 | Owner adds sources in Studio; starter pack outside git | PARTIAL | Studio create/bulk-create ✓ (`src/actions/scraper-sources.ts:119,280`); 19 sources are in git ✗ | — |
| 3 W2.5 | Per-source mode `http\|browser\|api\|feed\|manual_research` | PARTIAL (deliberate) | `CollectionMode` = `HTTP \| MANUAL_RESEARCH` only — "only values with a real fetcher behind them" (`schema.prisma:730-744`) | — |
| 3 W2.5 | Per-source delay, concurrency, max pages | PARTIAL | `requestDelayMs` per source ✓; `maxProducts` per source ✓ (2026-09-16); concurrency/max pages global (`types.ts:128-136`) | — |
| 3 W2.5 | Robots review, league, circuit breaker per source | DONE | `schema.prisma:817-848` (`policyReview*`, `analyticsLeague`, `consecutiveFailures/pausedAt`) | — |
| 3 W2.5 | Browser fallback only if permitted; no proxy/CAPTCHA bypass | DONE (stricter) | No browser mode at all; honest UA `RivyaLivingArtResearchBot` (`types.ts:100-126`) | — |
| 3 W2.5 | Two fixture adapters (priced furniture brand, quote-only studio), no network in CI | DONE | `adapters/priced-store.ts`, `adapters/quote-studio.ts`, 8 fixtures in `adapters/__fixtures__/`, 30 tests (B5) | — |
| 3 W2.5 | Adapter acceptance checklist → required test per adapter | DONE (agent-written) | `docs/adapter-acceptance-checklist.md:1-12` — original brief's checklist never supplied; repo carries its own | Reconcile if owner supplies original |
| 3 W2.6 | Text + attribute embeddings | DONE | `embedding.ts` `attr-hash` v1, pgvector `vector(512)` (B9) | — |
| 3 W2.6 | First-party/concept image embeddings | NOT DONE (scoped out) | `embedding.ts:20-24` "identity text, not images" | — |
| 3 W2.6 | Competitor image embeddings only if D3 reversed; "similar" explained from attributes | DONE | Not built (consistent); `ProductEmbedding.features` stores the working; neighbour cards on `/studio/scraper/analytics` | — |
| 3 W2.6 | Design-direction generator surface, facts cited | NOT APPLICABLE | Never existed here; D28 granted narrowly, nothing built (no AI key — `embedding.ts:14-15`) | — |
| 3 W2.7 | CSV/template import: preview, row errors, status `concept\|prototype\|active\|archived`, internal cost never leaves staff APIs | PARTIAL | `/studio/import`, templates + preview cap 500 (`templates.ts:37`); statuses are `ContentStatus` DRAFT/REVIEW/PUBLISHED/ARCHIVED (`schema.prisma:57-64`); `Product` has no cost column (nothing to leak) | — |
| 3 W2.8 | Select approved sources → scrape now / schedule | PARTIAL | Scrape now + tier fan-out gated by `AUTOMATABLE_SOURCE_WHERE` (`policy.ts:49`); no per-source schedule (cron only drains) | — |
| 3 W2.8 | New/changed inbox | PARTIAL | Seven-state review inbox (`shortlist-inbox.tsx`, B7) + runs feed (A9); no "changed since" filter though `contentHash`-driven snapshots exist | — |
| 3 W2.8 | Shortlist states `new\|review\|shortlisted\|rejected\|confirmed\|inspiration_only\|duplicate` | DONE | `ShortlistState` exactly those seven (`schema.prisma:1117-1131`) | — |
| 3 W2.8 | Only confirmed rows enter confirmed workspace | DONE | Export reads CONFIRMED only (B7); `confirm.ts` invariant | — |
| 3 W2.8 | CSV/PDF out; never auto-confirm | PARTIAL | CSV/XLSX ✓, PDF ✗; never auto-confirm ✓ (`shortlist.ts`, `tests/db/shortlist-write.test.ts`) | — |
| 3 W2 exit | Isolation gates red-fail on auto-import | SUPERSEDED | db tests above; `merge-policy.test.ts` | — |
| 3 W3 keep | Inquiry-first, CMS copy, concept labelling, current slugs | DONE | Rows above | — |
| 3 W3 keep | Token architecture `--rv-*` | NOT APPLICABLE | Tokens are unprefixed (`src/styles/tokens.css:35-49`) | — |
| 3 W3 | Masthead: four items + search trigger + one commission CTA | DONE | `constants.ts:80-85`; `site-header.tsx:492-506` (search · WhatsApp · menu) | CTA is WhatsApp, not "commission"; T2 open |
| 3 W3 | Hero: viewport material film, serif headline, two CTAs | DONE | `src/app/[locale]/(v2)/page.tsx:357-412` (`HeroMedia videoUrl={settings.heroVideoUrl}`, `font-display text-hero`, two Links) | — |
| 3 W3 | Collection: image-first, honest empty states, filters in URL | DONE | `shop-explorer.tsx:52,217` (`router.replace`), `EmptyState` (:28); `shop/(index)/page.tsx:81-88` (`q`, `sizeTier`, `sort`) | all |
| 3 W3 | Product: gallery first, dimensions, material stack, customization, enquiry that cannot freeze | DONE | `product/[slug]/page.tsx:252-259`; `src/components/product/order-panel.tsx:356-359` (`setServerError` + catch) | all |
| 3 W3 | Large-format page: lead-time ranges only if CMS-verified | DONE | `large-resin-art/page.tsx:88-93` — states no size/lead time because none is recorded | LARGE |
| 3 W3 | Process/about/journal/contact gated until verified; WhatsApp not hardcoded past CMS | DONE | Draft/publish + `defaultVisible:false` (`CLAUDE.md` CMS rules); `src/lib/whatsapp.ts:18` reads `SiteSettings.whatsappNumber` with constant fallback | — |
| 3 W3 | Motion: one runtime, no five libraries | DONE | GSAP + Lenis + CSS only (`package.json:59,61`); `scripts/motion-budget.mjs` ceiling 49 KB | — |
| 3 W3 | Perf: LCP hero, no font layout shift | DONE | `src/app/fonts.ts:32-47` (`display: "swap"`, preload); Lighthouse in CI (`ci.yml:300-301`) | — |
| 3 W3 | A11y: contrast, focus, reduced-motion | DONE | `scripts/a11y-audit.mjs`, `redesign-audit.mjs` (reduce context + header contrast), `keyboard-audit.mjs` — all CI gates | — |
| 3 W3 media | Import new Drive files through existing manifest pipeline | DONE (this repo's pipeline) | `scripts/media-v3-fetch.mjs` + `scripts/lib/media-v3-drive.mjs` + `docs/plan/drive-asset-map.json` (D, #61/#62) | — |
| 3 W3 media | Bind section slots explicitly | DONE | `src/lib/site-images.ts` (78 slots) | — |
| 3 W3 media | Product galleries empty until real photography | DONE | `ProductImage` only via owner/import; no slot defaults into galleries | — |
| 3 W3 media | `media:rewrite-alt-text` owner action | NOT APPLICABLE | Alt text is `SiteCopy` slots / `Media.alt`; `src/components/studio/media/bulk-alt-dialog.tsx` | — |
| 3 W3 | Public route checklist (home … search, privacy, terms, 404) | DONE | All under `src/app/[locale]/(v2)/` incl. `/privacy`, `/terms`; `src/app/[locale]/not-found.tsx` | — |
| 3 W4 | Overview = Today / Catalog / Inquiries / Research | PARTIAL | "today" group = Overview·Commissions·Analytics·Activity (`sidebar.tsx:64-69`); dashboard `page.tsx` has no research tile | — |
| 3 W4 | Catalog / Content / Editorial groups | DONE | `sidebar.tsx:76-131` (six job-named groups, A7) | — |
| 3 W4 | Media buckets (all, images, videos, Higgsfield, models, brand, docs) | PARTIAL | One library; per-row `MediaType` (IMAGE/VIDEO/DOCUMENT/MODEL3D) + `Provenance` AI; no Higgsfield/brand buckets | — |
| 3 W4 | Inquiries (all + kinds) | DONE | `inquiries/page.tsx:32-36` status + `InquirySource` filters | — |
| 3 W4 | Research: dashboard, sources, scrape control, explorer, large-format board, compare, opportunities, similarity, shortlist, confirmed, data quality, workflow runs | DONE | `/studio/scraper/{,sources,runs,explorer,large-format,analytics,review,confirmed,quality,mapping}` (A9, B7–B9); compare/opportunities/similarity share `analytics` | LARGE board is tier-scoped |
| 3 W4 | Operations (audit, users, jobs) | DONE | `/studio/activity`, `/studio/users`, `/studio/scraper/runs` | — |
| 3 W4 | Settings blocked until contact-of-record decision | SUPERSEDED (decided) | `SiteSettings.whatsappNumber` in DB (`schema.prisma` SiteSettings :11), `settings-form.tsx:529`, constant fallback | — |
| 3 W4 | Density for tables, cinema for research boards | DONE | A9: explorer table vs large-format image-first cards | — |
| 3 W4 | Raw \| normalized \| provenance on one product | PARTIAL | Explorer shows raw beside normalized with source/url/capturedAt (`explorer-query.ts:102-121`); no per-field provenance | — |
| 3 W4 | Coverage never rendered as zero | DONE | "computed from X of N", "showing X of N", "embedded X of N" | — |
| 3 W4 | Role-aware nav, checks server-side | DONE | `sidebar.tsx` `adminOnly`; `requireStaff([Role.ADMIN])` on routes | — |
| 3 W4 | FAQ editor | DONE | `/studio/faqs`; `src/actions/faqs.ts:32,126` | — |
| 3 W5 | Review eleven kits, adopt few | DONE | README D29; `docs/plan/05-ui-generation-prompt.md` | — |
| 3 W5 | `docs/design/COMPONENT_REGISTRY.md` with license/bundle/a11y per component | NOT DONE | File absent; proposed only in `06:100-102` | Nothing external was adopted, so it would be empty |
| 3 W5 | Shortlist (Magic UI, Smooth UI, daisyUI, Skiper, ThreeUI, Unlumen) | SUPERSEDED | Own primitives: `MeniscusImage`, `snap-rail.tsx`, `lightbox.tsx`; `three` only for the pre-existing lazy viewer | — |
| 3 W5 | Forbidden: all kits, two icon systems, second colour package | DONE | Single `lucide-react` (`package.json:62`); one token file | — |
| 3 W5 | Tokens obsidian #080A0E · ocean #08283A · sapphire #164E6B · champagne #B89B63 | DONE | `tokens.css:35-41` exact values | — |
| 3 W5 | Display serif (Instrument Serif) + Inter | DONE | `src/app/fonts.ts:1` (+ JetBrains Mono) | — |
| 3 W6 | Owner verifies gated sections | PARTIAL | Mechanism DONE (draft/publish, `defaultVisible`); which sections the owner has verified is content, not source | Owner action |
| 3 W6 | Policy-review every source before enable | DONE | Fails closed: `policy.ts:20`; checked at create, fan-out, advance (`CLAUDE.md`) | — |
| 3 W6 | Public pages only, honour robots, no auth bypass | DONE | `robots.ts:109`, honest UA, `ssrf.ts` | — |
| 3 W6 | Source-onboarding runbook; Tier list as operator memory, not seed | PARTIAL | Runbooks `docs/scraper.md`, `docs/source-adapters.md` ✓; list IS a seed (`seed-data.ts`) ✗ | — |
| 3 W6 | Runbooks: scrape failure, stale source, validation spike | DONE | `docs/troubleshooting.md:46-81,115-127` | — |
| 3 W6 | Runbooks: failed CSV export, concept-media misuse | NOT DONE | No such sections (grep) | — |
| 4 | Six-week delivery sequence | SUPERSEDED | `docs/plan/README.md:127-151` phases 0–9, all shipped except E's open questions T2–T11 | — |
| 5.1 | Luxury public site, honest concept vs delivered | DONE | CI audits; §15.2; `Provenance` | — |
| 5.2 | Enquire; row persists; WhatsApp opens with reference | DONE | `order.ts:341-368`; e2e smoke asserts `[DEMO]` prefix | all |
| 5.3 | Studio without Sheets | DONE | Rows above | — |
| 5.4 | Register policy-reviewed source, scrape safely, watch progress | DONE | `/studio/scraper/sources/[key]`, policy gate, `/studio/scraper/runs` | — |
| 5.5 | Inspect raw + normalized resin attributes | DONE (within current ontology) | Explorer (A9) | — |
| 5.6 | Compare fairly across scopes and leagues | DONE | B6/B8 | — |
| 5.7 | Shortlist and explicitly confirm | DONE | B7 | — |
| 5.8 | Export confirmed / research / inquiry as CSV or PDF | PARTIAL | Confirmed CSV/XLSX, research CSV (admin), subscribers CSV (`exports/page.tsx:48-76`); NO inquiry export (only printable card `src/app/studio/inquiries/[id]/card/page.tsx`); NO PDF | — |
| 5.9 | Import first-party products without touching snapshots | DONE | `/studio/import`; Bulk Import never writes `ScrapedProduct` (`merge-policy.ts`) | — |
| 5.10 | Audit scrapes, confirms, exports | PARTIAL | `ActivityLog`: scrape `create/batch-create` (`scraper-jobs.ts:279,405`), `confirm/unconfirm` (`products.ts`), shortlist transitions ✓; export downloads not logged ✗ | — |
| 5.11 | `rg` Google Sheets in runtime returns nothing | PARTIAL | Only comments + Bulk Import link copy (`src/lib/import/parse.ts:97`, `import-wizard.tsx:200`) + dead `CONFIRMED_SHEET_TAB` (`confirm.ts:16`) | Cosmetic |
| 5.12 | Isolation + no-auto-import gates green | SUPERSEDED | Equivalent unit/db tests green | — |
| 6 | Re-introducing Sheets — CI grep + retired permission | PARTIAL | No CI grep; permission N/A | — |
| 6 | Downloading competitor images "for similarity" | NOT DONE (conflict recorded) | Mirror path exists for the CATALOGUE (not similarity); decision open in `06:187-191` | — |
| 6 | Nav wrapping — cap top-level at four | DONE | 4 items; e2e asserts labels (`07:177`) | — |
| 6 | Drive folder inaccessible → owner pipeline | DONE | `drive-asset-map.json`; Drive fallback in `media-v3-fetch.mjs` | — |
| 7.1 | Land W1 A+B on `chore/remove-sheets` | DONE | PRs #66–#75, #88–#89 (different branch names) | — |
| 7.2 | Amend `CANONICAL-DECISIONS.md` + UI brief | NOT APPLICABLE | Files absent; equivalent record in `CLAUDE.md` D24–D29 and `03` | — |
| 7.3 | Ontology migration without enabling named sources | PARTIAL | B1–B4 migrations (`20260915113000…120000`) ✓; ontology depth as W2.1 rows; sources reviewed by the 2026-09-16 rollout on the owner's instruction | — |
| 7.4 | Public restyle home + collection, tokens first | DONE | A1–A5 (#63, #64) | — |
| 7.5 | Use `RIVYA-WORLD-CLASS-UI-PROMPT.md` for W3–W5 | SUPERSEDED | `docs/plan/05-ui-generation-prompt.md` (written to D29) | — |

## Summary

1. **150 rows.** DONE **90** · PARTIAL **31** · NOT DONE **14** · SUPERSEDED **14** · NOT APPLICABLE **11**.
2. Everything the document asks for that is *checkable and repo-agnostic* — Sheets removal (A–D), cron-drained scraping, policy-gated sources, immutable snapshots, price basis, fair comparison scopes/leagues, coverage labels, transparent opportunity components, attribute similarity, seven-state shortlist, confirmed workspace with CSV/XLSX, fixture adapters, four-item masthead, URL facets, one motion runtime, token values, FAQ editor — is shipped and cited above (B1–B9, A1–A9, C, D, E in `CHANGELOG.md`).
3. **Top NOT DONE / PARTIAL #1 — the resin ontology (W2.1/2.2/2.4):** no canonical family/type, no resin-style vocabulary, no geometry-in-mm parser, no structured materials/production model, no per-field provenance; consequently no family-mix / dimension-band / design-language analytics. Deferred on purpose (`prisma/schema.prisma:938-945`) but it is the largest gap versus the document. Affects all tiers; LARGE most (dimensions).
4. **#2 — `NormalizationAlias` has no writer:** the read-time resolver (B4) works, but no Studio action or screen creates alias rows (`/studio/scraper/mapping` is a report). "A mapping fix needs no re-scrape" is true only for someone with SQL access.
5. **#3 — Export/audit gaps (W1.D2/D3, DoD 8/10):** no PDF output, no inquiry export, and export downloads write no `ActivityLog` row (`src/app/api/studio/export/confirmed/route.ts`).
6. **#4 — Competitor-image posture is unresolved:** staged rows store URLs only, but the promote path mirrors up to six supplier images into Blob (`src/actions/scraper-review.ts:27-31`, `src/lib/catalog-mirror.ts`). `docs/plan/06-source-documents.md` §7 records the conflict as an owner decision still open.
7. **#5 — Guardrails the doc wants in CI are manual:** no CI grep against Sheets returning (W0.5), no `docs/design/COMPONENT_REGISTRY.md` (W5), 19 named sources seeded in git against D4 (owner's choice), no runbooks for failed export / concept-media misuse (W6).
8. Small residuals worth a one-line PR: dead `CONFIRMED_SHEET_TAB` const and "Google Sheet" wording in `src/lib/scraper/confirm.ts:8,16`; no redirect/notice on the old `/studio/scraper/sheets` bookmark; `.env.example` could not be read in the audit (verify no Google key remains).
9. Items marked SUPERSEDED are the document's older-repo mechanisms re-expressed here (`ShortlistState` for the seven-stage machine, `Media.provenance` for `is_concept`, `docs/plan/README.md` for the six-week sequence, `05-ui-generation-prompt.md` for the world-class UI prompt); NOT APPLICABLE rows are Supabase/Cloudinary/`app/(studio)`/`research_*`/permission-key stacks this repo never had.
