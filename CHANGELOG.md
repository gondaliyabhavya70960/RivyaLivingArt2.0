# CHANGELOG

All notable changes to the Rivya Living Art transformation.
Newest first. Every entry names the phase it belongs to.

---

## [Unreleased] — Security: allow unsafe-eval and vercel.live in Content-Security-Policy

### The finding
Enforcing Content-Security-Policy in production without `'unsafe-eval'` in `script-src` caused Next.js dynamic client evaluations (used by studio admin components including TipTap/ProseMirror and ExcelJS) to fail with `Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script`. This threw an uncaught error in the client runtime during hydration, causing all Studio sections to trip the Studio error boundary ("This page didn't load").

### Changed
- **`next.config.ts`**: Added `'unsafe-eval'` and `https://vercel.live` to `script-src`, added `https://vercel.live` to `connect-src` and `frame-src`.
- **`src/lib/csp.test.ts`**: Added test assertion ensuring `script-src` includes `'unsafe-eval'`.

## Shop: infer ecosystem from category parameter (Pre-2a Bookmarks Fix)

### The finding
Pre-2a bookmarks and external links such as `/shop?category=supplies-molds-tools` or
`/shop?category=print-filaments` returned zero products because `type` defaulted to `"art"`.
The Prisma `buildProductWhere` query constructed an unsatisfiable composite clause AND-ing
all `art` group category slugs with the non-art category slug.

### Changed
- **`src/lib/shop-filters.ts`**: Updated `normalizeEcosystemParam(value, categorySlug)` to infer the ecosystem group from the category slug when `value` is unspecified.
- **`src/app/[locale]/(v2)/shop/page.tsx`**: Passed `requestedCategory` into `normalizeEcosystemParam`, activating the correct ecosystem tab and category shelf without requiring an explicit `?type=`.
- **`src/lib/shop-filters.test.ts`**: Added regression tests proving ecosystem inference across art, supplies, and 3D print categories.

## Navigation: group-aware breadcrumbs on supplies and 3D print pages (Prompt Deck Decision 3)

### The finding
On category collection pages (`/shop/[category]`) and product detail pages (`/product/[slug]`), the
"Shop" breadcrumb pointed to `/shop` (which defaults to the art shelf). For supplies and 3D print
categories/products, walking back up the breadcrumb trail lost the visitor's ecosystem context
and unexpectedly dropped them into art pieces.

### Changed
- **`src/lib/breadcrumbs.ts`**: Authored pure helpers `buildCategoryBreadcrumbs` and `buildProductBreadcrumbs` that insert the ecosystem group crumb (`/shop?type=supplies` or `/shop?type=print`) for non-art categories and products, while leaving the art hierarchy clean.
- **`src/app/[locale]/(v2)/shop/[category]/page.tsx`**: Wired `buildCategoryBreadcrumbs` into the visible `<Breadcrumb />`. Left `breadcrumbJsonLd` on canonical `/shop` to adhere to SEO and non-canonical URL constraints.
- **`src/app/[locale]/(v2)/product/[slug]/page.tsx`**: Wired `buildProductBreadcrumbs` into the visible `<Breadcrumb />`. Left `breadcrumbJsonLd` on canonical `/shop`.
- **`src/lib/breadcrumbs.test.ts`**: Added pure unit test suite covering art, supplies, and print breadcrumb hierarchies for both categories and products.

## Search: non-quantified productsShowMore label across all 9 locales (Prompt Deck Decision 2)

### The finding
`Search.productsShowMore` previously used `{total}` interpolation with art-specific nouns
(`"Show all {total} pieces"`, `कृतियाँ`, `કૃતિઓ`, `作品`). Because the search handoff
carries `&type=all` and counts raw pigment supplies and 3D printing filaments in addition to art,
referencing them as art pieces was inaccurate.

### Changed
- **`messages/*.json`**: Updated `Search.productsShowMore` to non-quantified, inclusive phrasing across all 9 locales (`en`, `hi`, `gu`, `ar`, `de`, `es`, `fr`, `ja`, `zh`).
- **`src/app/[locale]/(v2)/search/page.tsx`**: Updated call site to pass zero parameters to `t("productsShowMore")`.
- **`src/lib/site-copy.generated.ts`**: Regenerated via `npm run copy:registry` (`vars` emptied, `copy:check` passes).
- **`src/lib/search-non-quantified.test.ts`**: Regression test asserting absence of `{total}` and art piece nouns across all 9 locales.

## Shop: search product descriptions in /shop?q= (Prompt Deck Decision 1)

### The finding
`/search` searched `description` in addition to `title` and `shortTagline`, but `/shop?q=` in
`buildProductWhere` only searched `title` and `shortTagline`. Searching for `"resin"` returned
only 23 of 1,668 items on `/shop`, omitting products that only mention resin in their descriptions.

### Changed
- **`src/lib/shop.ts`**: Added `{ description: { contains: q, mode: "insensitive" } }` to the `OR` clause in `buildProductWhere`.
- **`src/lib/shop.test.ts`**: Added regression test proving search clause matches `description`.
- **`tests/db/product-where.test.ts`**: Verified `description` inclusion in database-backed search queries.

## Finishing Rivya Living Art (Prompt Deck Tasks 01–08)

### Task 08 — Enforce Content-Security-Policy with complete directives (PR #20)
- **`next.config.ts`**: Added missing directives before enforcement:
  - `media-src 'self' blob: data: https://*.public.blob.vercel-storage.com https://res.cloudinary.com` (protects hero video and Blob media).
  - `connect-src` expanded with `https://*.public.blob.vercel-storage.com https://blob.vercel-storage.com` (permits direct client Blob uploads).
  - `worker-src 'self' blob:` (allows `browser-image-compression` Web Workers).
  - Renamed header from `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy`.
  - Preserved `img-src https:` (draining catalog hosts) and `'unsafe-inline'` for hydration and JSON-LD.
- **`src/lib/csp.test.ts`**: Added regression test asserting `Content-Security-Policy` header presence, absence of Report-Only, and presence of all required directives.

### Task 07 — The first database-backed test slice (PR #21)
- **`src/lib/shop.test.ts`**: Pure unit test suite covering `buildProductWhere` filter composition (status constraint, title/shortTagline search, ecosystem groups, catalog categories, occasions jsonb containment, inStock availability, and price band overlapping).
- **`tests/db/product-where.test.ts`**: Database integration test verifying `buildProductWhere` queries against Postgres via Prisma without SQL/syntax errors.
- **`tests/db/media-usages.test.ts`**: Database integration test verifying `findMediaUsages` and `findMediaUsageDetails` across all schema media-bearing tables against Postgres.
- **`vitest.db.config.mts`**: Dedicated test runner configuration for database-backed tests (`tests/db/**/*.test.ts`), isolating them from the fast pure-function suite (`npm test`).
- **`package.json`**: Added `"test:db": "vitest run --config vitest.db.config.mts"`.
- **`.github/workflows/ci.yml`**: Added `npm run test:db` step in the `build` job against the disposable Postgres service container.

### Task 06 — Three security hardening items (PR #19)
- **`src/app/uploads/[...path]/route.ts`**: Hardened against path traversal using `path.resolve` containment assertion (`resolved.startsWith(ROOT + path.sep)`). Tested in `src/app/uploads/uploads-route.test.ts`.
- **`src/app/api/upload/route.ts`**: Replaced client MIME trust with magic byte verification using `sharp(buffer).metadata()`. Validates JPEG, PNG, and WebP formats before persistence. Tested in `src/app/api/upload/upload-validation.test.ts`.
- **`src/lib/rate-limit.ts`**: Documented the Vercel-only edge proxy contract on `clientIp` and added support for configurable `trustedProxyDepth` for multi-hop or self-hosted deployments. Tested in `src/lib/rate-limit.test.ts`.

### Task 05 — Make reference documents true (PR #18)
- **`PROJECT_STATE.md`**: Updated frozen Phase 0 metrics to match HEAD: replaced "no source files modified" with 13 merged PRs across Phase 1 & 2; updated migration count to 44; documented 242 tracked files in `public/` (22 MB); updated test count to 358 tests across 34 files; updated HEAD commit to `1e12553` (Merge PR #13); resolved Phase 0 D1 & D2 questions.
- **`CLAUDE.md`**: Corrected public audit routes from 12 to 13 (covering `/` through `/terms`); updated copy slots from 1,115 to 1,181.
- **`docs/studio-cms/README.md`**: Added banner marking plan documents as frozen historical records and designating `CLAUDE.md` and `PROJECT_STATE.md` as current-state authorities.

### Task 04 — Wire LQIP blur placeholders across SlotImage and MeniscusImage (PR #16)
- **`src/lib/lqip.ts`**: Pure LQIP lookup helper `getLqipBlur` keying strictly on the resolved pathname/URL of bundled master images. Custom uploads and unknown images safely evaluate to `undefined`, preventing painting master A's blur under photograph B.
- **`src/components/storefront/slot-image.tsx`**: Wired `getLqipBlur` for both desktop and mobile crops into `<Image>` and `<source>` responsive descriptors.
- **`src/components/storefront/meniscus-image.tsx`**: Wired `getLqipBlur` for both desktop and mobile crops into `<Image>` and `<source>` across all 28 meniscus call sites.
- **`src/lib/lqip.test.ts`**: Added regression unit tests covering resolution, URL normalization, and negative matches for custom/user uploads.

### Task 03 — Walk Tiptap Json in media-usages to protect body images (PR #14)
- **`src/lib/tiptap-media.ts`**: Pure helper function `extractTiptapImageUrls` that recursively traverses arbitrary Tiptap JSON trees (including nested lists, blockquotes, translation overlays, and custom block payloads) and extracts all image URLs.
- **`src/lib/media-usages.ts`**: Added `blogPostsContent`, `pagesContent`, and expanded `customBlocks` to include `richText`. Uses `extractTiptapImageUrls` to label and guard embedded images against deletions and library sweeps.
- **`src/lib/tiptap-media.test.ts`**: Added comprehensive pure unit tests and integration tests demonstrating that blog post body images, translation images, legal page images, and landing page richText images are fully guarded.

### Task 01 — Remove retired domain from .env.example and document missing variables (PR #17)
- **`.env.example`**: Updated `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to `https://www.rivyalivingart.com`. Added `DATABASE_URL_UNPOOLED`, `CRON_SECRET`, and `RESEND_FROM`.
- **`src/lib/env.ts`**: Added `DATABASE_URL_UNPOOLED` and `CRON_SECRET` to the environment validation schema.
- **`src/lib/env.test.ts`**: Added regression tests verifying that `.env.example` is free of the retired domain and contains all required migration and cron variables.

## Phase 2f #1: wire localized footer tagline and eliminate superseded 3D printing proposition (PR #13)

### The finding
The storefront footer rendered `settings.tagline` → `SITE.tagline`, bypassing `next-intl` entirely.
As a result, the superseded proposition *"Luxury custom resin art & 3D printing, made to order in India"*
rendered in English on every page in all nine locales. Meanwhile, the registered and translated
`Footer.tagline` slot in `messages/*.json` ("Handcrafted resin art, made to order.") was completely unread.
Additionally, five code fallbacks and database seed values still carried references to "3D printing".

### Changed
- **`src/app/[locale]/(v2)/layout.tsx` passes `tFooter("tagline")` into `<Footer />`**: Wires the existing translated slot across all nine locales (`ar`, `de`, `es`, `fr`, `gu`, `hi`, `ja`, `zh`, `en`) and makes it editable via `/studio/site-copy`.
- **`src/lib/constants.ts`**: Updated `SITE.tagline` fallback to `"Handcrafted resin art, made to order."`.
- **`src/app/manifest.ts`**: Updated PWA description fallback to `"Handcrafted resin art, made to order in India — every order finalized on WhatsApp."`.
- **`src/app/[locale]/(v2)/product/[slug]/opengraph-image.tsx` & `blog/[slug]/opengraph-image.tsx`**: Dynamic fallback uses `brand.tagline` instead of hardcoded string.
- **`src/app/shared-metadata.ts`**: Updated default title and description to remove superseded 3D printing claim.
- **`prisma/seed.ts`**: Updated `SiteSettings.tagline` and `defaultSeo` to match the new proposition.
- **`src/components/studio/settings/seo-form.tsx` & `settings-form.tsx`**: Updated placeholders.
- **`src/lib/site-copy.generated.ts`**: Regenerated via `npm run copy:registry` (`copy:check` passes).
- **`src/lib/footer-tagline.test.ts`**: Automated regression test proving the failure before the fix and verifying all six sites.

### Verified by reproducing the defect first
`npx vitest run src/lib/footer-tagline.test.ts` produced 5 failing tests against the unpatched codebase (confirming hardcoded 3D printing claims and bypassing of `next-intl`), and all 6 tests passed once patched.

## Phase 2d: the shop kept promises it could not deliver

### The finding
`/search` searches the whole 4,373-product catalogue and then handed the visitor to `/shop`, which
has opened on the art ecosystem since Phase 2a. **"Show all 619" for `pigment` delivered one
product. `filament` promised 1,162 and delivered none.**

A second, unrelated defect let the *staged* half of every image slot be deleted: the studio writes a
save into `SiteImage.draft` and leaves `url` alone, but the delete guard only ever read `url`.

### Changed
- **`/search` → `/shop` now carries `&type=all`.** Rejected the alternative of scoping `/search` to
  art: `searchProducts` is shared with the header overlay, so it would make ~2,900 published,
  sellable products unfindable and contradict decision D6.
- **Ecosystem tabs preserve `q` and `sort`.** They were constant strings, so pivoting dropped the
  search term in both directions — `&type=all` alone would have been a one-way door.
  `category`/`occasion`/`band`/`stock` deliberately do NOT travel: carrying one composes an
  unsatisfiable AND (`?type=supplies&category=gift-collections`).
- **`media-usages.ts` scans `SiteImage.draft`.** `readStagedImage` extracted to a pure
  `src/lib/site-image-draft.ts` — it had been trapped in a `server-only` module, which is exactly
  why the guard could not reuse it.
- **Homepage "Featured pieces"** constrained to the art ecosystem — the same one-word fix Phase 2a
  applied to `fetchDefaultShopFirstPage`.
- **`shopHref` omits `type` when it is the default**, so page-1 links stop being `/shop?type=art`,
  agree with the canonical again, and hit the 300s first-page bundle.
- **`hasActiveFilters` ignores the resolved default**, so "Clear all" no longer renders over nothing.
- **`scripts/media-v3-fetch.mjs` merges rather than overwrites** the LQIP manifest.

### Verified by reproducing the defect first
Every fix was demonstrated broken before it was fixed. The delete guard: `staged -> NOT FOUND
(delete would be allowed)` before, `staged -> [ 'Site image · home.hero (staged)' ]` after. The LQIP
manifest: 24 entries with the poster missing before, 25 and byte-identical after. The handoff,
measured live — `filament` 0 → a full page, `pigment` 1 → a full page.

**`resin` (23 of 1,668) and `table` (12 of 996) barely moved**, and the PR says so: `/shop?q=`
matches titles only, while `/search` also reads descriptions and expands synonyms. That is a
filtering change and belongs to the owner.

### Gates
typecheck · lint · **352 tests** (33 files, +6) · `copy:check` 1,181 slots · 0 missing translations ·
`next build` · `redesign-audit` × 3 and `a11y-audit` × 2 over CI's 13 routes at both widths, 0
failures · the same audits over 5 routes CI cannot reach (`/search`, `?type=all`, supplies and print
categories) · `test:e2e` 10/10 including the WhatsApp hard rule.

### Corrected
An earlier note claimed `/search` lost "~98%" of its hits. Measured, it is 55–89% by term. Still a
broken promise on every query, but the figure was an estimate and it was wrong.

---

## [Unreleased] — Phase 2c: the storefront has its photography

### The finding
`public/` was never in this repository. The ZIP it was imported from had been exported without it,
so all **62 image slots** resolved to files that did not exist, `/_next/image` answered **400** for
every one, and the storefront rendered with no photography at all.

**Every gate was green the whole time.** The slot resolver is total by construction, `next build`
never resolves these runtime strings, and the design and a11y audits check *alt text* rather than
whether a picture arrived. `site-images.test.ts` had a test named "lives in the repo" that asserted
only `fallback.startsWith("/")` — directly beneath a comment promising the file was checked in.

### Added
- `public/` — **242 files, 22 MB**, supplied by the owner and committed atomically. Atomicity is
  required: `prisma/reconcile-blog-covers.ts` runs every deploy and flips 55 `BlogPost.coverImage`
  rows to local paths **one way**, so a partial commit would 404 them permanently.
- `src/lib/bundled-media.test.ts` — guards the asset tracks deliberately outside the slot registry
  and therefore never tested: the 121 pour-cure scrub frames, `CANONICAL_CATEGORIES[].image`, the
  PWA icon, and the LQIP manifest's `src` paths.
- A broken-image rule in `scripts/redesign-audit.mjs`: any **bundled** image that finished loading
  with `naturalWidth === 0` fails the build. Scoped to roots derived from `public/` itself —
  catalog photography lives on supplier hosts this repo does not control, and failing a PR for
  their downtime would be a gate nobody could act on.

### Changed
- `src/lib/site-images.test.ts` now asserts each slot default is **on disk**. That single missing
  assertion is the entire incident.

### Verified, not assumed
All 25 slot defaults match `media-v3-blur.json`'s recorded dimensions **exactly** (25/25), and
regenerating each LQIP from the shipped file reproduces the committed `blurDataURL` byte-for-byte
for **24 of 25**. The 25th, `process-pour-poster`, is ffmpeg-cut so its bytes differ; it is the same
frame within encoder noise — pixel difference **9.1** against its own file versus **30.8** for the
nearest *different* master and **55.4** median. The archive carried no traversal paths, no symlinks
and no executables, and its 5 category + 55 blog covers match `mirror-images.yml`'s hard assertion
exactly. Afterwards: `/media/v3/hero-pour.avif` **404 → 200**, its optimized variant **400 → 200**,
and the homepage **LCP moved from the `<h1>` back to the hero photograph**. All three new guards
were proved to fail on a deliberately removed file and pass once restored.

### Corrected
Two entries in `PROJECT_STATE.md` were wrong and are now recorded as WON'T-FIX, because acting on
either breaks production. **`happy-dom` is not a test tool** — `@tiptap/html/dist/server` imports it
at the top level and it is traced into three public route bundles; moving it to `devDependencies`
was attempted here and reverted once verified. **`three` is not unused** — it is a required peer of
`@google/model-viewer`, which the PDP gallery renders. Import count is the wrong test for a peer
dependency.

The imagery runbook also said `git add public/media/v3 …`, which stages **27 of 242 files** and
leaves the maker photo, all 121 scrub frames, the icon and 60 covers still 404ing.

---

## [Unreleased] — Phase 2b complete: one more key, and the surface was smaller than the plan said

### The finding
`PROJECT_STATE.md` framed the rest of Phase 2b as ~500 slots across Shop, Site chrome and
Commission. A sweep of every namespace for the superseded proposition returned **~21 hits, almost
all of them accurate rather than stale** — the studio really does sell 3D printing (400 filaments,
96 printer parts, 4 printed decor) and `gift-collections` is a real category with real products. So
`Nav.groupPrint`, the homepage print tile and `Process`'s digital-preview line were left alone.

Exactly **one** key still carried the old proposition: `Shop.meta.description`.

### Changed
`Shop.meta.description`, nine locales. It read *"luxury resin art, personalized gifts and 3D-printed
pieces"* — off-brand after the repositioning, and doubly wrong after Phase 2a, because it promised
3D-printed pieces on a page that now **opens on the art ecosystem**. It now describes what `/shop`
actually shows, naming supplies and printing as the further shelves they are rather than as the
default view.

### Checked and deliberately not changed
`CustomOrder` was **already** fully commission-led — "Commission something bespoke", "what people
commission", small (7–10 days) vs statement (3–6 weeks) lead times. The homepage's new promise lands
on a page that already delivers it. `Footer`, `Nav.megaPortfolioLine`, `Common.announcementDefault`
and the Site Settings announcement bar were all checked for contradiction and found consistent.

The remaining Shop and chrome keys are filters, sorts and labels — already translated, already
accurate. They are not a backlog, and `PROJECT_STATE.md` now says so.

### Two grammar defects caught in review
Both Hindi and Gujarati placed a trailing feminine participle after a mixed-gender list ending in a
masculine loanword (होम डेकोर / ડેકોર). Both languages resolve conjoined-list agreement by the
nearest conjunct, so each read as machine translation. Both reviewers fixed it the same way —
reordering the list to end on the feminine plural — preserving all three nouns and the length.
Spanish and French were also corrected: `pedidos por WhatsApp` garden-paths as the noun "orders", and
a trailing `également` on a verbless fragment is an English calque.

Six of eight locales were corrected by review; three came back clean.

### Verified
All nine locales confirmed serving the corrected description by fetching each rendered `/shop` and
matching the exact string. Conventions asserted mechanically: brand and WhatsApp still Latin, 3D
printing retained everywhere. `i18n-missing` 0 missing, `copy:check` 1,181 slots, typecheck, lint,
342 tests, production build, 3 design audits, 2 a11y audits, Lighthouse 97/97/96/100.

---

## [Unreleased] — Phase 2b: the homepage leads with commissions, in nine languages

Implements decision **D5**. The storefront said it sold "custom resin art and 3D printing"; it now
says it makes large resin work to commission, with a smaller catalogue behind it.

### Changed — four keys × nine locales
`Home.hero.eyebrow`, `Home.hero.lead`, `Home.meta.title`, `Home.meta.description`.
`Home.hero.headline` ("Liquid luxury, cast forever.") was kept: brand-defining, and it makes no
product claim.

### The voice was not invented
The `LargeFormat` namespace already described commissioning large work honestly, in every
language — *"Commission large-format resin work in India — tables, surfaces, wall panels and
sculptural pieces, designed around your room and poured to order."* The homepage simply did not
lead with it. Each translator was pointed at that namespace and told to reuse its established
terminology rather than coin new terms, so the two pages now read as one writer.

This also keeps the claim honest: the studio genuinely commissions tables and wall panels, and
holds none in stock. The catalogue is the smaller ready pieces. No product was invented.

### Fixed — a pre-existing bug the Gujarati translator caught
`gu.json`'s `Home.hero.eyebrow` was still the **English** string
(`"custom resin art · 3d printing · made to order"`) — the only one of nine locales with an
untranslated eyebrow. `scripts/i18n-missing.mjs` confirms the fix: gu drops from 7
English-identical strings to 6.

### How it was produced
Eight parallel translators, one per locale, each reading its own `messages/<loc>.json` first to
match that file's register — then eight adversarial reviewers checking for meaning drift (does it
imply stock?), convention breaks (is the brand or WhatsApp transliterated? is the eyebrow still a
lowercase middot triplet?), register clash and SERP truncation. Six locales were corrected by
review; two came back clean.

Representative catches: the Chinese lead opened `以定制打造`, which garden-paths as verb-verb —
corrected to the idiomatic `定制打造`. The Hindi lead coordinated a perfective past passive with a
habitual present; corrected to match the habitual voice every comparable statement in `hi.json`
already uses.

### Verified
- **All nine locales confirmed serving the new copy** by fetching each rendered page and matching
  the exact strings — not by trusting the build.
- Conventions asserted mechanically across all eight translations: brand and WhatsApp still Latin,
  eyebrow still a three-part middot triplet.
- `node scripts/i18n-missing.mjs` → **0 missing** in every locale.
- `copy:check` (1,181 slots), typecheck, lint, 342 tests, production build.
- 4 design audits (1440/390, LTR + RTL), 3 a11y audits, 2 studio audits over 30 routes,
  Lighthouse 97/97/96/100. The longer strings — German and Hindi especially — introduce no
  horizontal overflow at 390px.

### Raised, not actioned
The hero's primary CTA is still "Explore the collection"; "Commission a piece" is secondary. Under
commission-led positioning those arguably swap — but that is a REDESIGN.md decision about button
treatment, interacting with §3.1's champagne-per-viewport rule, so it is the owner's call and not a
copy change.

---

## [Unreleased] — Phase 2c investigation: the imagery is one workflow run away, not a regeneration

Investigated why the site has no photography. **Nothing needs regenerating** — and the
documentation that said the work was finished is what stopped anyone noticing it wasn't.

### Found
`public/` is empty: `git ls-files public` returns **0**, so all 62 slots resolve to files that do
not exist and every deploy logs `imported 0 site image(s)` with 25 `ENOENT`s.

But every input already exists in the repo:

| Piece | State |
|---|---|
| 24 image prompts + 1 video prompt | in `docs/media-v3-manifest.json` |
| Human cull | **done** — every asset carries a `keeper` (20 `a`, 4 `b`) |
| Contact sheets it was made from | committed (`docs/media-v3-review/`, 5 files) |
| LQIP blur manifest | committed, **25 real entries** |
| The AVIF masters | **missing — never added in this git history** |

A 25-entry LQIP manifest could only come from a completed `masters` run, so the masters were built
in the original repo; the ZIP this one was imported from was exported without `public/`.

### Fixed — documentation that asserted the opposite
`CLAUDE.md` claimed **"Done."**, that `public/media/v3/` *holds* 24 AVIF masters totalling 1.0 MB,
and that **"no video was generated"**. All three were false: the masters are absent, and a
10-second video *was* generated on 2026-08-26 and culled to keeper `b`, with the poster cut from
frame 0 of that same clip. It is the file every session reads first, so it was actively steering
work away from the largest open defect.

Also corrected there and in two code comments: the slot count is **62**, not 57, and there are
**25** bundled files, not 21 (`src/actions/site-images.ts`, `src/lib/site-images-import.ts`).

### Added
A runbook in `PROJECT_STATE.md`: two `workflow_dispatch` runs — `fetch-media-v3.yml` mode
`masters` (skip `candidates`, the cull is done) and `fetch-media-v3-video.yml` mode `masters` —
plus what to do if the recorded candidate URLs have expired by then.

### Verified, and why it needs Actions
Generating works: one image was produced from the manifest's stored hero prompt (2 credits,
`nano_banana_2`). **Downloading it does not** — the Higgsfield CDN answers
`CONNECT tunnel failed, response 403` to this session's egress policy. The agent-proxy README says
to report such a denial rather than route around it, so no workaround was attempted.
`fetch-media-v3.yml` exists precisely because a previous session hit the same wall; its own header
documents it. Actions currently has no runner minutes, which is the single thing blocking both
this and the design/a11y/studio/Lighthouse gates.

---

## [Unreleased] — Fix: a trailing slash in the site URL shipped 14 malformed URLs

Production went live on `www.rivyalivingart.com`, and the homepage carried **14 double-slash URLs**.

`NEXT_PUBLIC_SITE_URL` was set as `https://www.rivyalivingart.com/` — with the trailing slash a
browser shows and a paste preserves. Roughly 30 call sites build on it as `${SITE.url}/path`, so
every one doubled up.

### Fixed
- **`SITE.url` is normalised to an origin with no trailing slash.** Done once at the source rather
  than at the call sites, because the next call site added would not know to do it.

What was live and is now correct:

| Live | Correct |
|---|---|
| `…com//#organization` | `…com/#organization` |
| `…com//#website` | `…com/#website` |
| `…com//#localbusiness` | `…com/#localbusiness` |
| `…com//icon.svg` | `…com/icon.svg` |
| `…com//search?q={search_term_string}` | `…com/search?q={search_term_string}` |
| `wa.me/+917096036250` | `wa.me/917096036250` |

The JSON-LD `@id`s matter most: their whole purpose is to be a stable identifier other nodes in the
graph reference, and a malformed one does not resolve. The same concatenation builds product, blog
and portfolio canonicals, OG image URLs, sitemap entries, wishlist share links and password-reset
links.

### Fixed — a second live defect, on the conversion path
- **`buildWaLink` now enforces the number format its own docstring promises.** The docstring says
  *"international format with no '+', spaces, or dashes"*, but the function passed the caller's
  value straight through — and that value is normally the **studio-configured** number an owner
  types into Site Settings, which holds `+917096036250`. The live site was serving
  `wa.me/+917096036250` on all commission CTAs.

  A `+` is merely non-canonical, but the same field would accept `+91 70960 36250`, and a space
  breaks the URL outright. This is the Place Order path (`order.ts:342`, `:493`), so a broken link
  loses the order with nothing to show for it. `email.ts:93` already sanitised the *customer's*
  number this way; the house number did not get the same treatment.

  Fixed in the builder rather than in Site Settings, so the owner does not have to retype anything
  and no future stored value can reintroduce it. 4 new tests.

### Verified
- **Found by reading the live production HTML**, not by trusting the deployment's `READY` state:
  14 occurrences of `rivyalivingart.com//` on the served homepage.
- Rendered output after the fix: **0** double slashes; `@id`s well-formed.
- `next build` run with the exact production value (`https://www.rivyalivingart.com/`) — passes.
- 6 new tests (suite now **342**): trailing slashes (one, two, three) plus a correctly-formed
  origin left alone, and the wa.me sanitisation across `+`, spaces, dashes, brackets and
  digitless junk.
- typecheck, lint, `copy:check`, i18n (0 missing across 8 locales) all clean.

### Confirmed working in production
Deployment `dpl_AYQ25ZfgHYkMJEwauDBYnks4NvzP` reached `READY` on `www.rivyalivingart.com` with
`aliasError: null`. The live `/shop` serves **1,373 pieces** — the art ecosystem from Phase 2a, not
the 4,373 mixed catalogue — with no supplies or 3D-printing categories leaking in, no `ResinRiva`
strings, and no old-domain references.

---

## [Unreleased] — Fix: a blank environment variable could not break the build

Production failed on `NEXT_PUBLIC_SITE_URL: Invalid URL`. The variable was **declared with no
value** — adding a key in a hosting dashboard without filling it in, which is what pasting the names
from `.env.example` produces.

### Fixed
- **`src/lib/env.ts` now treats a blank variable as absent.** `NEXT_PUBLIC_SITE_URL` is declared
  `z.string().url().optional()`, and `.optional()` admits only `undefined`. A blank arrives as `""`
  — a *string* — so the refinement ran against it and rejected it as a malformed URL. Blanks are now
  stripped before parsing, so an optional variable left empty is simply off. Sibling blanks passed
  only because they carry no `.url()`; the same trap was waiting for any future one that did.
- **Required variables now report their intended message when absent.** Stripping blanks turned a
  blank `DATABASE_URL` into a missing one, which Zod reported as
  `expected string, received undefined`. `DATABASE_URL` and `AUTH_SECRET` now carry an `error` so
  both the blank and absent cases say `…is required`.
- **`src/lib/constants.ts` had the same bug, where a green build hid it.** It used
  `process.env.X ?? fallback`, and `??` keeps `""`. A blank `NEXT_PUBLIC_SITE_URL` therefore made
  `SITE.url === ""` — breaking every canonical link, OG card, sitemap entry and `metadataBase` —
  and a blank `NEXT_PUBLIC_WHATSAPP_NUMBER` made every `wa.me` link empty, which on a WhatsApp-only
  business is the entire conversion path. Both now fall back on blank as well as absent.
  It cannot import the server-only env module, so it repeats the rule locally.

### Changed
- **Live domain is now `https://www.rivyalivingart.com`**, replacing `store.bhavyagondaliya.co.in`
  in `SITE.url`, the OG card, the inquiry card, the catalog-mirror user agent, the seeded legal
  pages, and the documentation. The transformation records (`PROJECT_STATE.md`, `CHANGELOG.md`,
  `docs/PROJECT-AUDIT.md`, `docs/RENAME-MIGRATION.md`) keep the old host, because they quote it as
  it was at audit time.

### Verified
- **Reproduced the production failure first**, then showed the same input passing: on the previous
  code a blank `NEXT_PUBLIC_SITE_URL` threw `Invalid URL`; on this code `next build` completes.
- 9 new tests in `src/lib/env.test.ts` (suite now **336**) covering blank, whitespace-only, absent
  and real values for both the env loader and the two public `SITE` values.
- Full gate set green locally: typecheck, lint, `copy:check`, i18n (0 missing across 8 locales),
  336 tests, production build **with a blank `NEXT_PUBLIC_SITE_URL`**, 3 design audits, 2 a11y
  audits, 2 studio audits over 30 routes, Lighthouse 99/97/96/100.

### Still the owner's to set
Setting `NEXT_PUBLIC_SITE_URL=https://www.rivyalivingart.com` in Vercel remains worthwhile — the
fallback keeps the build alive and resolves to the right domain, but an explicit value is what makes
preview deployments self-describe correctly.

---

## [Unreleased] — Phase 2a: art-first storefront

Implements decision **D6**: the supplies and 3D-printing catalogues stay published and sellable,
but stop leading the browse of an art house.

### Why
`/shop` opened on all 4,373 published products, of which **2,900 are supplies and printing
hardware** — 1,841 molds and tools, 648 pigments, 400 filaments, 96 printer parts. The first page of
a luxury art catalogue was sanding kits and PLA. The ecosystem mechanism to fix it
(`CATALOG_GROUPS`, `?type=art|supplies|print`, the browse tabs) already existed; only the **default**
was wrong.

### Changed
- **`/shop` now opens on the art ecosystem** — 1,373 pieces instead of 4,373. Supplies and print keep
  their tabs, their category pages and their URLs; nothing is unpublished and no URL 404s.
- **`?type=all` is a new explicit sentinel** restoring the mixed view. It is deliberately NOT a
  member of `ECOSYSTEMS`, so `isEcosystem()` rejects it and `buildProductWhere` adds no category
  clause — "no constraint" by being unrecognised, rather than by a second code path.
- **Unrecognised `?type=` falls back to art** rather than silently reopening the mixed catalogue, so
  a stale v6 link or a crafted param is not a back door.
- **The collection strip follows the active ecosystem.** It sliced the whole catalogue in curated
  `order`, so it always showed the first twelve *art* categories — including while the grid below
  was showing molds and filament.

### Fixed
- **`fetchDefaultShopFirstPage` ignored the filters entirely.** It built `buildProductWhere({})`, so
  the cached bare-`/shop` bundle kept serving the mixed catalogue after `?type=` gained a default.
  Caught by checking the rendered count against the database (1,373 expected, 4,373 served) rather
  than trusting the unit level. Its cache key is bumped to `-v3`, because a `-v2` entry holds the
  mixed catalogue and would serve it for up to 300s after deploy.

### Notes
- `hasFilters` still reads the **raw** `?type=` value, so a bare `/shop` remains
  "per-visitor-identical" and keeps its shared 300s cache. Resolving the default into it would have
  made every default request look filtered and silently dropped that cache.
- New `src/lib/shop-filters.test.ts` (5 tests) locks the resolution, including that the `all`
  sentinel stays outside `ECOSYSTEMS` — if it were ever added there, the mixed view would filter by
  a group whose slug list does not exist and return nothing.

### Verified
Locally, against a real database and the built server (Actions still cannot allocate a runner):
typecheck, lint, `copy:check` (1,181 slots), i18n (0 missing across 8 locales), **327 tests**,
production build, 4 design audits, 3 a11y audits, 2 studio audits over 30 routes, Lighthouse
98/97/96/100. Behaviour confirmed in the browser: `/shop` 1,373 · `?type=all` 4,373 ·
`?type=supplies` 2,500 · `?type=print` 500 · `?type=v6` → 1,373.

---

## [Unreleased] — Phase 1: brand rename (ResinRiva → Rivya Living Art)

**640 substitutions across 112 files**, risk-tiered from the Phase 0 census. Full detail, including
every identifier deliberately left alone, is in `docs/RENAME-MIGRATION.md`.

### Added
- `docs/RENAME-MIGRATION.md` — what was renamed, what was migrated, what was left and why.
- Migration `20260831080000_brand_rivya_living_art` — moves the two rows whose values were shipped
  as column defaults. Guarded on the old value, so a custom brand name set by the owner survives.
  Adds/drops/retypes nothing; the history stays purely additive (44 migrations, still zero
  destructive statements).

### Changed
- Brand name across storefront copy (373 strings × 9 locales — the brand is untransliterated Latin
  in every one), the 1,181-slot copy registry, email, WhatsApp templates, legal-page prose, the
  Studio, `package.json`, and all active documentation.
- `SiteSettings.brandName` default → `Rivya Living Art`; `BlogPost.authorName` default →
  `Rivya Living Art Studio`.
- **Logo replaced, not renamed.** The wordmark was hand-drawn vector artwork spelling *Resin Riva*
  in path data; rewriting only its `aria-label` would have left the accessible name describing a
  different picture. It is now typeset in the brand display face (Instrument Serif), with a
  `viewBox` measured against the rendered glyphs (ink is 626.5 units wide) rather than guessed, so
  it neither clips nor leaves dead space at any of the six call-site heights. The `RR` monogram
  became `R`.
- `README.md` design section rewritten to the authoritative "Liquid Luxury" v3 spec.

### Fixed — defects the mechanical pass introduced, caught before commit
- `robots.ts` bot token had hyphens spliced into a robots.txt product token
  (`rivya-living-artresearchbot` → `rivyalivingartresearchbot`).
- **CI database name desynced**: `.yml` was outside the pass's file types, so `ci.yml` kept
  `resinriva_ci` while the `ci-staff-user.ts` safety guard was rewritten — the guard would have
  refused the CI database. Both are now `rivya_ci`.
- `global-error.tsx` rendered the literal `rivya-living-art` in a `text-transform: lowercase`
  element; it now carries the proper noun.
- German About eyebrow became `der kopf hinter rivya-living-art`; fixed to match fr/es.
- **`redesign-audit.mjs`'s lazy-alt rule had silently stopped firing** — it tested `/resinriva/i`,
  which matches nothing now. Pattern updated, and its word threshold made brand-length-relative
  (the brand went from one word to three, so a hard-coded 4 would flag every honest alt mentioning
  it). Verified against six cases.

### Deliberately unchanged
The 20 Cloudinary URLs under `resinriva/` (retired in Phase 2, not migrated — decision D3), the
`#RR-<n>` inquiry reference customers already hold, scraper `sourceKey` values and the
`importSource` identity contract, `FormOption.value`, the owner's real Google Sheet name, historical
git branch names, and the immutable `init` migration.

### Verified
Full gate set run locally (Actions cannot allocate a runner — decision D4): typecheck, lint,
`copy:check` (1,181 slots), i18n (0 missing across 8 locales), 322 tests, 44 migrations, production
build, 4 design audits, 3 a11y audits, 2 studio audits over 30 routes, Lighthouse 98/97/96/100.

---

## [Unreleased] — Phase 0.5: baseline defect fixes

Safe, decision-independent repairs to defects catalogued in `docs/PROJECT-AUDIT.md` §9.
No application code touched — workflows, unwired scripts and stale docs only.

### Fixed
- **CI has been inert since it was written.** `.github/workflows/ci.yml` triggered on branch `Main`
  while the repository default is `main`; git refs are case-sensitive, so no gate had ever run.
  Changed to `main`. **Every gate was proven to pass locally on this exact commit before enabling
  it** — see Verified below.
- **11 scripts could not launch a browser.** `audit-crawl`, `audit-lighthouse`, `screenshot-lab`,
  `studio-shots`, `verify-chrome` and `verify-phase2`–`7` hardcoded
  `find /opt/pw-browsers/chromium-1194 …`, a path that existed in one dev sandbox at one revision.
  All now use `resolveChromiumPath()` from `scripts/lib/browser.mjs`, which was written to fix
  exactly this and which these files had never been migrated to.
- **Hardcoded dev credentials removed** from `scripts/verify-phase4.mjs` (`admin@local.test` /
  `local-dev-password-1`), now read from `STUDIO_EMAIL` / `STUDIO_PASSWORD` matching the CI
  studio-audit convention.
- **Four asset workflows referenced three deleted feature branches.** `mirror-images.yml` also
  hardcoded one in `checkout ref`, `git pull --rebase` and `git push`, so a manual run on any other
  branch pushed to a branch that may not exist. Checkout and push now follow `github.ref_name`.
  Their dead `push:` triggers were **removed rather than re-pointed at `main`**: these jobs mirror
  remote assets and push commits back, and this PR edits the very files their `paths:` filters
  watch, so re-pointing them would have fired all four on merge. Enabling them is an owner
  decision, not a side effect of fixing a stale ref. `workflow_dispatch` is unchanged.
- **`README.md` advertised a design system that `CLAUDE.md` had retired.** The "Midnight Gild v2.0"
  palette section now describes the authoritative "Liquid Luxury" v3 spec from `REDESIGN.md`, notes
  that Tailwind v4 is CSS-first with no config file, and marks `DESIGN.md` / `CONTEXT.md` as
  superseded in the docs table. Also corrected "Next.js 15+" to Next.js 16.

### Verified
Every CI gate run locally against a real PostgreSQL 16.13 and the built server, on this commit:

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run copy:check` | 1,181 slots up to date |
| `node scripts/i18n-missing.mjs` | 0 missing keys in all 8 non-English locales |
| `npm test` | 322 tests passing |
| `next build` | passed |
| `redesign-audit` × 4 (1440/390, LTR/RTL) | 0 failing rules |
| `a11y-audit` × 3 (1440/390, RTL 390) | 0 critical/serious violations |
| `studio-audit` × 2 (1440/390) | clean across 30 studio routes |
| `lighthouse-audit` | home 99/97/96/100 · plp 97/100/96/100 — all budgets met |

### Not fixed (blocked)
- **`.env.example` is missing `DATABASE_URL_UNPOOLED` and `RESEND_FROM`.** Both are load-bearing —
  `prisma.config.ts:15` prefers the unpooled URL for `migrate deploy`, and `src/lib/email.ts:142`
  reads `RESEND_FROM`, which `src/lib/env.ts:35` validates. This session's tooling denies edits to
  `.env*` files, so the fix is left for the owner.

### Deferred (deliberately)
- `happy-dom` sits in `dependencies` rather than `devDependencies`, and `three` is a dependency with
  zero imports. Both are `package.json` + lockfile changes; `three` also interacts with the pending
  domain-widening decision (the brief's Phase 15 wants Three.js for 3D art). Left for a commit that
  is not otherwise touching dependencies.

---

## [Unreleased] — Phase 0: ZIP import & forensic audit

### Added
- `docs/PROJECT-AUDIT.md` — 485-line forensic audit of the imported ResinRiva2.0 codebase, produced
  by 8 parallel subsystem auditors with adversarial verification of every area against the files.
- `PROJECT_STATE.md` — session-resumable state file; the entry point for every future session.
- `CHANGELOG.md` — this file.

### Imported
- Full ResinRiva2.0 source (920 files) committed **unmodified** as baseline `32f21a6`, so the
  original implementation is recoverable at any point.

### Verified (not changed)
The imported baseline was proven working end to end before any transformation work:
- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm test` — **322 tests across 29 files, all passing**
- `prisma migrate deploy` — all **43 migrations** applied to a real PostgreSQL 16.13
- `prisma/bootstrap.ts` — **4,373** products from the four tier sheets (64,496 rows on disk) plus 12 owner-ready drafts = **4,385** rows
- `npm run db:seed` — 16 categories, 6 FAQs, 2 legal pages
- `next build` — full production build passed
- `next start` — all 12 public routes return 200 with real content; `/studio/login` renders

### Findings
- **The stack is current, not obsolete** — Next 16.3.1, React 19.2.4, Prisma 7.9.1, Tailwind 4.3.2.
  The brief's Phase 4 (modernization) is already satisfied.
- **The brief's target architecture is already implemented** — Vercel + Neon Postgres + Prisma +
  Vercel Blob. The only divergence is the CMS.
- **Two conflicts between the brief and the business were raised for decision** (`PROJECT_STATE.md`
  → BLOCKING DECISIONS): commerce model (cart/checkout vs WhatsApp) and CMS (Payload vs the existing
  Studio).
- **15 pre-existing defects catalogued**, the most severe being that `ci.yml` triggers on branch
  `Main` while the repo default is `main` — **no CI gate in this project has ever run.**
- Brand-reference census: **799 occurrences across 133 files**, classified `safe` /
  `needs-migration` / `do-not-rename`. 20 Cloudinary URLs embed the literal folder segment
  `resinriva/` and must not be renamed before the assets are migrated.

### Changed
Nothing. **No source file has been modified in Phase 0.**
