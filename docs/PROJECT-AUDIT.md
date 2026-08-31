# PROJECT-AUDIT.md — Phase 0 Forensic Audit

**Audited:** 2026-08-31 · **Source:** `ResinRiva2.0-Main.zip` (19.9 MB, 921 files)
**Method:** ZIP imported unmodified as git baseline (commit `32f21a6`), then 8 parallel subsystem
auditors read the real files, each output adversarially verified by a second agent against the
same files. Every claim below traces to a file that was actually read, or to a command actually run.

---

## 0. Headline finding

**This is not a legacy project awaiting rescue. It is a healthy, current, production-grade
application that is live in production.**

The transformation brief assumed an obsolete stack needing modernization, a database to design,
and a CMS to introduce. None of those assumptions survived contact with the code. What the project
actually needs is a **rename plus a business-domain widening**, executed without breaking a large
amount of working, tested, load-bearing machinery.

### Verified health of the imported baseline

| Check | Command | Result |
|---|---|---|
| Type safety | `npm run typecheck` | **PASS** — clean |
| Lint | `npm run lint` | **PASS** — clean |
| Unit tests | `npm test` | **PASS** — 29 files, **322 tests** |
| Migrations | `prisma migrate deploy` | **PASS** — all 43 applied to a real Postgres 16 |
| Data import | `prisma/bootstrap.ts` | **PASS** — **4,373** tier products + 12 owner-ready drafts = **4,385** rows |
| Seed | `npm run db:seed` | **PASS** — 16 categories, 6 FAQs, 2 legal pages |
| Production build | `next build` | **PASS** — full build, all routes compiled |
| Runtime | `next start` + curl | **PASS** — all 12 public routes return 200 with real content |

Verified locally against PostgreSQL 16.13 with `pg_trgm`. Screenshots of the running site were
captured at 1440px and 390px.

### Version reality

| Package | Installed | Latest upstream | Verdict |
|---|---|---|---|
| next | 16.3.1 | 16.3.3 | current |
| react / react-dom | 19.2.4 | 19.2.8 | current |
| prisma / @prisma/client | 7.9.1 | 7.x stable (8.0 in RC) | current |
| tailwindcss | 4.3.2 | 4.3.3 | current |
| next-auth | 5.0.0-beta.32 | v5 beta line | current |
| next-intl | 4.13.2 | v4 | current |

**There is no modernization work to do.** Phase 4 of the brief (technology modernization) is
already satisfied. The correct action is patch-level bumps, not migration.

---

## 1. What the business actually is

| | |
|---|---|
| Brand | **ResinRiva** |
| Live site | `store.bhavyagondaliya.co.in` |
| Admin | `store.bhavyagondaliya.co.in/studio` |
| Market | India (Surat, Gujarat) — ships pan-India |
| Currency | **INR only**, whole rupees, `en-IN` grouping |
| Locales | **9** — en (default, unprefixed), hi, gu, ar (RTL), es, de, fr, zh, ja |
| Ordering | **WhatsApp only** (`wa.me/917096036250`) |
| Catalog today | Resin art, personalized gifts, 3D printing, varmala preservation, wedding frames, decor |

### The business model is an explicit, documented constraint

`README.md` and `CLAUDE.md:20-31` state these as **"Hard Rules (never violate)"**:

- **NO** payment gateway, online checkout, or cart payment (no Stripe / Razorpay / PayPal)
- **NO** customer login, membership, or customer accounts — the only login is staff-only `/studio`
- **NO AI-invented products, ever** — the catalog is filled only by owner-approved scraper review,
  bulk import, or manual adds
- Every order is finalized on **WhatsApp**

The code enforces this. There is no `Cart`, `Order`, `LineItem`, `Payment`, `Transaction` or
`Customer` model among the 35. There is no payment SDK in `package.json` and no payment key in
`.env.example`. `src/components/product/order-panel.tsx:168` says it in a comment:
*"No cart, no payment: WhatsApp is checkout."*

**This directly conflicts with the transformation brief's Phase 29 (cart / checkout / payments),
its `/cart` `/checkout` `/account` routes, and its acceptance criteria. See §7.**

---

## 2. Database — 35 models, 43 migrations, zero destructive history

`prisma/schema.prisma` — 998 lines, 35 models, 14 enums, 37 `@@index`, 7 composite `@@unique`.

The datasource URL is deliberately absent from the schema; it lives in `prisma.config.ts`, which
prefers `DATABASE_URL_UNPOOLED` because migrations take advisory locks that pgbouncer cannot serve,
while `src/lib/db.ts` uses the pooled `DATABASE_URL`. This split is load-bearing.

**Migration history is purely additive.** `grep -rn "DROP TABLE|DROP COLUMN|ALTER COLUMN"
prisma/migrations` returns **zero hits** across all 43 migrations.

### Model groups

| Group | Models |
|---|---|
| Identity | `User` (+`Role` enum: ADMIN, EDITOR) |
| Catalog | `Category`, `Product`, `ProductImage`, `CustomizationField` |
| Leads | `Inquiry` — the only transaction-ish table |
| CMS | `Portfolio`, `PortfolioImage`, `BlogCategory`, `Tag`, `BlogPost`, `Testimonial`, `Faq`, `Page`, `SiteSettings`, `SiteCopy`, `SiteImage`, `NavMenu`, `NavItem`, `PageSection`, `ContentRevision`, `CustomPage`, `CustomBlock`, `FormOption` |
| Media | `Media` (+`MediaType`, `Provenance`) |
| Scraper | `ScrapeSource`, `ScrapeJob`, `ScrapedProduct`, `ValidationFailure`, `PriceHistory` |
| Import | `ImportRun`, `DeletedImport` |
| System | `ActivityLog`, `RateLimitHit`, `Subscriber` |

### Money storage — already correct

Every currency field is Prisma `Int` → Postgres `INTEGER`. **No `Decimal`, no `Float`, no
floating-point money anywhere** (`grep -c Decimal prisma/schema.prisma` → 0; the only two `Float`
fields are `SiteImage.focalX/focalY`, image focal points).

- `Product.priceMin/priceMax`
- `Inquiry.quotedPrice/finalPrice`
- `ScrapedProduct.priceMin/priceMax`
- `PriceHistory.priceMin/priceMax`

Values are **whole rupees**, not minor units — `src/lib/utils.ts:88-94` formats with
`maximumFractionDigits: 0`. A `currency` column exists only on the two scraper-side models. The
brief's requirement "never use floating-point for money" is already met.

### Present vs missing against the brief's target schema

| Brief expects | Reality |
|---|---|
| `products`, `categories`, `media`, `pages`, `posts`, `faqs`, `testimonials`, `navigation`, `site_settings`, `redirects`, `audit_logs` | **Present** (some under different names) |
| `scraper_*` (sources, runs, items, errors, reviews) | **Present** — `ScrapeSource`, `ScrapeJob`, `ScrapedProduct`, `ValidationFailure` |
| `google_sheet_*` | **Present in substance** — `ImportRun`, `DeletedImport`, plus `Product.tier/sourceHash/ownerTouched` |
| `orders`, `order_items`, `payments`, `shipments`, `refunds`, `customers`, `addresses`, `cart` | **Absent by design** — business rule, not an oversight |
| `collections`, `artists`, `materials`, `product_variants`, `three_d_models`, `competitors` | **Absent** — genuinely new work if the domain widens |

---

## 3. The Studio CMS — mature, bespoke, deeply coupled

**Scale:** 47 route files under `src/app/studio` (6,882 LOC) · 101 components under
`src/components/studio` (23,126 LOC) · 31 server-action modules under `src/actions` (10,053 LOC,
**124 exported `"use server"` functions**).

**Authorization is layered and server-side:**
- Edge middleware `src/proxy.ts` gates `/studio/:path*` on a JWT
- The `(dashboard)` layout calls `requireStaffPage()`
- **112 of 124 actions call `requireStaff()`**; the 12 that don't are deliberately public
  storefront actions
- Every mutation re-validates role **and `tokenVersion`** against the database on each call, so a
  demoted or deleted user is rejected immediately rather than at JWT expiry

**Content architecture is registry-driven, not schema-driven:**
- **1,181 copy slots** (`src/lib/site-copy.generated.ts`), regenerated by
  `scripts/site-copy-registry.mjs`, gated by `npm run copy:check`
- **62 named image slots** (`src/lib/site-images.ts`)
- **7 pages × 49 declared sections** (`src/lib/page-sections.ts`)
- **6 custom-page block types** (`src/lib/custom-blocks.ts`)

**A real draft → preview → publish pipeline exists:** `draftValue`/`draft`/`draftOrder`/
`draftVisible` staging columns, an ISR-safe draft-mode cookie minted only by `/api/draft` behind
`requireStaff()`, transactional per-surface publish with a blocking/warning checklist
(`src/lib/publish.ts`), and `ContentRevision` snapshots written before promotion.

**Audit logging is pervasive:** 105 `logActivity()` call sites across 25 action files.

**Gaps (specific and few):** no revision-history UI (`restoreRevision` has zero callers); no
content REST/GraphQL API; no field-level i18n UI beyond per-entity `translations` JSON.

### Studio routes (40 admin pages)

Dashboard · Activity · Analytics · Blog (list/new/edit) · Categories · Content-gaps · Custom-pages
(list/new/edit) · FAQs · Forms · Import · Inquiries (list/detail/card) · Media · Navigation · Pages
(list/new/edit) · Portfolio (list/new/edit) · Products (list/new/edit) · Scraper (dashboard/mapping/
quality/review/sources/source-detail) · Sections · SEO · Settings · Sheet-import · Site-copy ·
Site-images · Subscribers · Testimonials · Users · Login/Signup/Forgot/Reset

---

## 4. Scraper — production-grade market intelligence, already legal-aware

38 files / 4,955 LOC in `src/lib/scraper` (9 are `*.test.ts`) + 5 server-action files (2,558 LOC)
+ 6 studio pages + 11 client components + exactly **one** HTTP route (ADMIN-only CSV export,
capped at 5,000 rows).

**Three adapters:** Shopify `/products.json` (250/page), WooCommerce Store API (100/page), and a
generic JSON-LD sitemap crawler (8 URLs/page, 150 products/run cap). Shopify and Woo fall back to
JSON-LD on 401/403/404/410 or a non-JSON 200.

**Safety and legality are already implemented** — the brief's Phase 25 is largely satisfied:
- **SSRF guard**: every outbound fetch goes through `safeFetch` (`ssrf.ts`) with per-hop DNS +
  literal-IP validation, `redirect: "manual"`, 5-hop cap. Called at 9 sites. The only raw
  `fetch()` calls are two fixed-host Google endpoints.
- **robots.txt** honoured (`robots.ts`)
- **Circuit breaker**: `consecutiveFailures`/`pausedAt` on `ScrapeSource`, trip logic, blocked-run
  refusal, explicit resume
- **One-run-per-source**: in-flight lookup returns the running job id rather than erroring, making
  the Scrape button idempotent
- **Rate limiting**, retry, validation-failure logging, price history

**The staging boundary is the critical invariant:** scraping **never** writes to `Product`.
`ScrapedProduct` is a separate table keyed `@@unique([sourceKey, externalId])` with a 16-hex
`contentHash`. Rows progress `PENDING → APPROVED/REJECTED → IMPORTED`, and import creates products
as `DRAFT` with `needsRewrite: true`. This satisfies the brief's Phase 26 exactly.

**Registry:** 115 curated third-party storefronts seeded from `seed-data.ts` (1,378 lines) across
4 tiers.

**Note:** job progression is driven by a browser polling loop in `job-dashboard.tsx` — there is no
cron, queue or worker route for scraping.

---

## 5. Google Sheets / CSV import — two independent paths

### Path A — deploy-time four-tier owner-sheet fill
`prisma/bootstrap.ts:150` → `prisma/import-tiers.ts` (1,036 lines), runs on **every build**.
Reads gzipped CSVs from `data/tiers/` with fallback `.csv.gz` → `.csv` → `sample/*.sample.csv`.

| Tab | Rows in file | Cap | Imported |
|---|---|---|---|
| Tier1_Owner | 373 | none | 373 |
| Tier2_ResinGoods | 34,930 | 1,000 | 1,000 |
| Tier3_Supplies | 21,508 | 2,500 | 2,500 |
| Tier4_3DPrint | 7,685 | 500 | 500 |
| **Total** | **64,496** | | **4,373** |

Plus 12 `sheet:owner-ready` draft rows, for **4,385** `Product` rows total (verified: `SELECT count(*) FROM "Product"` → 4385).

Every tab carries the identical 26-column scraper schema. All 64,496 rows are preserved in the
repo; the cap selects which become live products. **"Top N" is the first N rows in sheet order**,
not a quality ranking.

**Idempotency is real:** rows upsert on `@@unique([importSource, importRef])` where
`importSource = sheet:<sourceKey>` and `importRef = externalId`. A row whose stored `sourceHash`
equals `contentHash:NORMALIZER_VERSION` (currently `n8`) is skipped entirely.

**Provenance and protection:**
- `ownerTouched` — when a human edited a row in the studio, the deploy import may refresh **only**
  `inStock` and `sourceHash`; never title, copy, price, category or images
- `DeletedImport` tombstones — an owner deletion is permanent across re-imports
- **Demote-never-delete** — rows falling out of the cap window become `DRAFT`, never deleted,
  preserving products, images and inquiries
- Foreign-currency prices are nulled with `showPrice: false` rather than rendered as ₹

### Path B — studio Bulk Import wizard
`/studio/import`, 7-type CSV/XLSX/Google-Sheet-link importer capped at 500 rows, per-row validation,
**genuine dry-run preview** that writes nothing. Explicitly **refuses scraper-schema files**
(forcing scraped content through the review + rewrite gate).

**Gap:** Path A has no dry-run and no manual trigger. `ImportRun.dryRun` and the `MANUAL`/`PREVIEW`
trigger values exist in the schema but no code path produces them.

---

## 6. Storefront and design system

21 `page.tsx` routes under `src/app/[locale]/(v2)/` — 39 files, 11,900 lines.

**Server-first:** only **3 of 36** `(v2)` `.tsx` files carry `"use client"`. The brief's warning
against converting everything to client components is already heeded.

**Design system is Tailwind v4 CSS-first — there is no `tailwind.config.*` file anywhere.**
`src/styles/tokens.css` (222 lines) holds the raw "Liquid Luxury" values; `src/app/globals.css`
(561 lines) bridges them with `@theme inline` plus hand-written `@utility` composites (`u-shell`,
`u-micro`, `u-num`, `u-prose`, `section-major/standard/compact`, `rule`, `font-display/body/mono`).

> **Consequence for the transformation:** any script that looks for a Tailwind config file to
> rewrite theme tokens will find nothing. Token changes go in `tokens.css` / `globals.css`.

**Typography:** Instrument Serif (display), Inter (body), JetBrains Mono (numerics), plus five Noto
Sans script faces sharing `--font-script` for the non-Latin locales.

**Motion:** GSAP + ScrollTrigger + SplitText behind a lazy barrel (`src/lib/gsap.ts`); Lenis
smooth-scroll gated to fine-pointer, non-reduced-motion visitors; `next-view-transitions` with a
`MorphLink` driving `startViewTransition`.

**3D:** `@google/model-viewer` only, lazily imported. **`three` is in `package.json` with zero
imports anywhere in the repo** — a dead dependency.

**i18n:** all nine `messages/*.json` carry exactly **1,181 leaf keys** across 30 namespaces, each
mirrored as an owner-editable copy slot. `getMessageFallback` returns the English string rather
than a dotted key path.

### Current design language

The site already presents as a premium dark editorial experience — near-black ground, warm ivory
serif display type, hairline rules, numbered section markers, restrained gold accents. The live
homepage headline is *"Liquid luxury, cast forever."* The authoritative spec is `REDESIGN.md`
(1,413 lines, 20 parts, "Liquid Luxury" v3) with a 15-token palette, a three-typeface system, and
two signature devices (the "Cure Line" and the "meniscus reveal").

**The brief's target direction — "Liquid Mineral Atelier", warm ivory / deep charcoal / restrained
metallics, luxury-gallery feel — is close to what already exists.** This is an evolution, not a
rebuild.

### Documentation supersession chain (important)

`CLAUDE.md:3-11` declares `REDESIGN.md` authoritative and explicitly retires `DESIGN.md` (v2
"Midnight Gild") and `docs/design-v7-sapphire-atelier.md`. `CONTEXT.md` self-marks as superseded v1
"Midnight Sapphire". **`README.md:34` still advertises the retired Midnight Gild palette as
current** — a stale doc to fix.

---

## 7. Conflicts between the brief and the codebase

These are the decisions that need an explicit answer before Phase 2+ proceeds.

### 7.1 Commerce — brief asks for cart/checkout/payments; business forbids them
The brief's Phase 29, its `/cart` `/checkout` `/account` routes, and its acceptance checkboxes
assume ecommerce. The business has a documented hard rule against all three, and the entire
conversion mechanism (27 `data-wa-source` tracking attributes, `#RR-<n>` inquiry references already
in the owner's WhatsApp history, a 9-status inquiry pipeline, claim-token privacy controls) is
built around WhatsApp.
Building a cart would not extend this system; it would replace its reason for existing.
**Recommendation: keep WhatsApp/inquiry as the conversion path.** The brief's own Phase 29 hedges
with *"Implement if existing functionality supports it"* — it does not.

### 7.2 CMS — brief prefers Payload; a mature bespoke CMS already exists
Payload would mean re-implementing 40 admin pages, 124 server actions, the 1,181-slot copy
registry, the 62-slot image registry, the section-arrangement system, the scraper review queue, the
sheet-import wizard, and the inquiry pipeline — then re-coupling all of it to 43 migrations of
existing schema and 4,373 live product rows.
That is precisely the failure mode the brief was written to prevent.
**Recommendation: keep the Studio CMS.** The brief's Phase 20 is conditional —
*"If there is no suitable CMS, integrate a modern Next.js-compatible CMS."* There is a suitable CMS.

### 7.3 Modernization — nothing to modernize
Phase 4 is already satisfied (see §0). **Recommendation: patch bumps only.**

### 7.4 Domain widening is the real work
Going from *resin art + personalized gifts + 3D printing* to *luxury resin **furniture** + resin art
+ 3D art + bespoke commissions* is a genuine, substantial change: new categories, new schema
(`Collection`, `Artist`, `Material`, `ThreeDModel`), new routes, new copy across 9 locales, and new
imagery. **This is where the effort belongs.**

---

## 8. Brand-reference census (Phase 1 input)

**799 occurrences across 133 files** (excluding `node_modules`, `.next`, `package-lock.json`).

| Variant | Count |
|---|---|
| `ResinRiva` | 717 |
| `resinriva` | 69 |
| `RESINRIVA` | 10 |
| `resin-riva` | 1 |
| `Resin Riva` (spaced) | 0 |

### By rename risk

**`safe` — display copy, rename freely (majority)**
- `messages/*.json` — **373 occurrences** across 9 locales (titles, meta, hero copy, aria-labels,
  footer, WhatsApp greeting templates). Must be changed as one batch; `scripts/i18n-missing.mjs`
  and `i18n-merge.mjs` gate locale parity.
- `src/lib/constants.ts` `SITE.name`, `src/lib/email.ts` (10), `src/components/storefront/footer.tsx`
  (6), `src/components/layout/logo.tsx` (4), documentation files
- `package.json` `"name": "resinriva"`

**`needs-migration` — database values, require a data migration alongside the code change**
- `SiteSettings.brandName String @default("ResinRiva")` (`schema.prisma:442`) — owner-editable, read
  by every OG card and the header. Existing production row holds the old value.
- `BlogPost.authorName String @default("ResinRiva Studio")` (`schema.prisma:321`) — baked into a
  column default; every existing row carries it.
- Seeded legal-page bodies in `prisma/seed.ts` (privacy/terms prose naming the brand)

**`do-not-rename` — external identifiers; changing the string breaks live assets**
- **20 hard-coded Cloudinary URLs** under cloud `dhaqpl1kz` whose path segment is literally
  `resinriva/` — 9 in `src/lib/media.ts:27-56`, 11 in `prisma/seed-category-images.ts:27-37`.
  These are remote asset addresses in a third-party account. Renaming the string 404s every
  category and hero image unless the assets are re-uploaded under a new folder first.
- `store.bhavyagondaliya.co.in` — the live domain (unchanged unless the owner moves it)
- `wa.me/917096036250` — the live WhatsApp number
- `#RR-<n>` inquiry reference prefix — customers hold these in sent WhatsApp threads; the sequence
  and format must survive
- `FormOption.value` strings — recorded on historical `Inquiry` rows and in sent messages; only
  `label` may be edited
- `sourceKey` values and `SCRAPEDECK_COLUMNS` order — the `${sourceKey}|${externalId}` merge key
  orphans every existing sheet row if changed
- `importSource = sheet:<sourceKey>` — the import identity contract

**Already rebrand-aware:** `src/app/og-brand.ts` reads `brandName` from `SiteSettings`, derives the
domain from `SITE.url`, and steps the wordmark 148→112→84→64px by name length — written so a longer
replacement name does not overrun the share card. "Rivya Living Art" (16 chars vs 9) will render at
a smaller step; this is handled.

---

## 9. Real defects found in the baseline

These are pre-existing problems, not transformation risks. Ranked by severity.

> **Status:** items 1, 3, 4, 5, 6, 12, 13 and the stale `README.md` palette were fixed in
> **Phase 0.5** (see `CHANGELOG.md`). Item 9 (`.env.example`) is blocked — this session's tooling
> denies edits to `.env*` files. Items 2, 7, 8, 10, 11, 14 and 15 remain open and are tracked in
> `PROJECT_STATE.md`.

1. **CI is completely inert.** `.github/workflows/ci.yml:15-19` triggers on branch **`Main`**
   (capital M). The repository's default branch is `main`. Git refs are case-sensitive, so neither
   the `push` nor the `pull_request` filter can ever match. **Every gate the project believes it
   has — typecheck, lint, `copy:check`, `i18n-missing`, unit tests, production build,
   redesign-audit, a11y-audit, studio-audit, lighthouse-audit — has never run.** Verified:
   `git for-each-ref | grep -x 'refs/heads/Main'` returns nothing.
2. **CSP is report-only and permissive.** `next.config.ts:57` sets
   `Content-Security-Policy-Report-Only`, so nothing is blocked. It also carries
   `script-src 'unsafe-inline'` and `img-src https:` (any host), so even if flipped to enforcing it
   would not stop inline-script injection. Enforced header count is 5 security headers + 1
   reporting endpoint + 1 report-only CSP.
3. **14 scripts are unwired** from `package.json` and every workflow: `audit-crawl`, `audit-data`,
   `audit-lighthouse`, `i18n-merge`, `screenshot-lab`, `shots`, `studio-shots`, `verify-chrome`,
   `verify-phase2/3/4/5/6/7`.
4. **Seven scripts hardcode a dead Chromium path** — `/opt/pw-browsers/chromium-1194` — which
   existed in one dev sandbox at one revision. `scripts/lib/browser.mjs` was written to fix exactly
   this; these files were never migrated. They cannot run in CI or on a laptop.
5. **Port drift** across audit scripts: `verify-phase*` hardcode `:3111`, `lighthouse-audit`
   defaults to `:3111` but CI overrides to `:3000`, `a11y-audit` defaults to `:3000`. A gate wired
   at the wrong default silently audits nothing.
6. **Four asset workflows are push-pinned to deleted feature branches**
   (`claude/resinriva-audit-tasks-tfz6cs`, `claude/revert-vercel-deployment-rxpd4p`,
   `claude/resinriva-2-design-s8y1ry`). `mirror-images.yml` additionally hardcodes that branch in
   `checkout ref`, `git pull --rebase` and `git push`.
7. **`mirror-images.yml:47` asserts exactly 5 category and 55 blog webp files.** Any catalog or
   journal change to those counts fails the workflow with no explanation.
8. **Zero tests for API routes, server actions, React components, or database queries.** The suite
   is `src/**/*.test.ts` in a `node` environment only. The upload route, both cron routes, the
   csp-report sink and `src/proxy.ts` have no coverage.
9. **`.env.example` and `src/lib/env.ts` disagree in both directions.** `RESEND_FROM` is in the Zod
   schema and read at runtime but absent from the example; `AUTH_URL`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD` are in the example but absent from the schema (read via bare `process.env`), so
   the advertised fail-fast-at-boot guarantee does not cover them. `DATABASE_URL_UNPOOLED` is
   load-bearing for migrations but missing from the example.
10. **`happy-dom` sits in `dependencies`, not `devDependencies`**, and is imported by nothing.
11. **`three` is a dependency with zero imports.**
12. **`verify-phase4.mjs:28-29` contains hardcoded dev credentials** (`admin@local.test` /
    `local-dev-password-1`) in tracked source.
13. **`audit-lighthouse.mjs:18` targets a stale slug** (`/product/hot-pink-pla-filament`) from a
    previous catalog.
14. **The csp-report throttle uses module-level state**, so on Vercel the effective limit is
    60/min × concurrent instances, not 60.
15. **`fetch-tiers.yml` embeds a specific Google Sheet id and gid in three places.** Losing access
    to that sheet, or renaming the four tab names, breaks the catalog import path.

---

## 10. What must survive the transformation

Ranked by blast radius if broken.

1. **The `#RR-<n>` inquiry reference format and its SERIAL sequence.** Customers already hold these
   references in sent WhatsApp threads.
2. **The three Inquiry writers** (`order.ts:292`, `order.ts:447`, `public.ts:88`) and the
   post-insert message re-stamp that injects the reference number after the row exists.
3. **The `(importSource, importRef)` identity contract** and `sourceHash` skip semantics — the
   basis of idempotent re-import across 64,496 sheet rows.
4. **`ownerTouched` merge protection** — the reason owner edits survive every deploy-time import.
5. **`DeletedImport` tombstones** — the reason owner deletions are permanent.
6. **Demote-never-delete reconcile** — the reason falling out of the cap window doesn't destroy
   products, images and attached inquiries.
7. **The scraper staging boundary** — `ScrapedProduct` is never `Product`; import creates `DRAFT` +
   `needsRewrite`.
8. **`safeFetch` SSRF validation** on all 9 outbound scrape call sites.
9. **The `${sourceKey}|${externalId}` merge key** and `SCRAPEDECK_COLUMNS` order.
10. **`requireStaff()` DB re-validation of role + `tokenVersion`** on every mutation.
11. **Last-admin protection** and the SERIALIZABLE first-admin bootstrap.
12. **Login brute-force throttle** with constant-time `DUMMY_HASH` compare (prevents account-existence
    timing oracle).
13. **The copy registry contract** — 1,181 keys × 9 locales, `getMessageFallback` returning English,
    and `copy:check`.
14. **`getPageSections` / `getSiteImages` totality** — a missing row must never render a hole, and a
    DB outage must degrade to shipped defaults rather than a blank page.
15. **`FormOption.value` immutability** — those values landed on historical inquiries.
16. **The claim-token privacy control** on `/whatsapp-order`.
17. **Spam protection** on all four public forms (honeypot + HMAC form token + per-IP windows).
18. **Foreign-currency price suppression** — "honest over wrong".

---

## 11. Recommended plan (revised from the brief)

| Phase | Brief's plan | Revised plan | Why |
|---|---|---|---|
| 0 | ZIP audit | **Done** | This document |
| 1 | Rename | Rename, risk-tiered; migrate Cloudinary assets **before** touching those URLs; data-migrate `brandName` + `authorName` | 799 refs, 3 risk classes |
| 2 | Domain transformation | **The main effort** — furniture/art/3D/bespoke taxonomy, new schema, new routes, 9-locale copy | The genuine gap |
| 3 | Premium positioning | Evolve "Liquid Luxury" → "Liquid Mineral Atelier" in `tokens.css` | Already 80% there |
| 4 | Modernization | **Skip** — patch bumps only | Stack is current |
| 5–7 | Database | Additive migrations for `Collection`, `Artist`, `Material`, `ThreeDModel` | 43 additive migrations to extend |
| 20 | Payload CMS | **Keep Studio CMS** | See §7.2 |
| 29 | Commerce | **Keep WhatsApp/inquiry** | See §7.1 |
| — | *(not in brief)* | **Fix the 15 defects in §9 — starting with inert CI** | Everything else rests on this |

**The single highest-value first fix is CI.** Until `ci.yml` triggers on `main`, no gate in this
project actually runs, and every "verified" claim during the transformation rests on manual checks.
