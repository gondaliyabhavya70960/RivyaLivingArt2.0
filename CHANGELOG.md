# CHANGELOG

All notable changes to the Rivya Living Art transformation.
Newest first. Every entry names the phase it belongs to.

---

## The gated decisions — D23, D18, D22, D24 (2026-09-03)

The owner answered D28, D23, D18, D22 and D24 against the repository's current state — after
Phase 0, 1a and 1b had merged — and all five are YES. D28 sets the rule the others depend on:
the rewind stands, current `main` is authoritative, and a discarded-layer change is recovered
only as an individually reviewed PR, never a bulk cherry-pick. The four code decisions land here
as one commit each.

### Removed
- **The legacy un-gated sheet push (D23).** `continueScrapeJob` called the policy-gated
  `pushJobToSheet` and then, separately, `syncSourceToSheet`, which checked only
  `isSheetSyncConfigured()` and pushed every staged row whenever a job staged anything —
  including a FAILED one. While that stood, the MANUAL default, "a FAILED job never auto-pushes"
  and the one-writer invariant were all false in code. The docs needed no correction: they
  already described the gated behaviour. `sheet-policy.test.ts` now asserts the invariant on the
  source itself — one `pushJobToSheet` call under the policy check, no direct transport use, no
  second writer of `sheetSynced` — because the policy truth table passed the entire time the bug
  was live. Verified by reintroducing a second writer and watching the suite go red.
- **The dormant v2 motion layer (D18)** — nine files, 978 lines: `Preloader`,
  `preloader-signal`, `CursorFollower`, `Magnetic`, `HeroParallax`, `KineticHeading`,
  `SplitTextHeading`, `MobileWhatsappBar`, `WishlistCount`. Zero symbol references outside the
  set; the compiler, the linter and 383 tests are the proof. Three names on the audit's D18 list
  were **not** dormant and stay: `product-card` and `order-summary-preview` are imported by
  `/design-lab`, whose fate is D17 and undecided, and `tabs` has 19 live references.
- **Four obsolete workflows and two tracked artifact sets (D24)** — `mirror-images`,
  `mirror-v3-media`, `mirror-v6-media`, `fetch-assets`, `.playwright-mcp/` and the two
  regenerable `audit/*.json`, now gitignored.

### Changed
- **The portfolio seed is gated twice (D22).** It ran on every deploy, and its update branch
  rebuilt each gallery with `images: { deleteMany: {}, create: [...] }` while writing
  `status: PUBLISHED` — so an owner's replaced photograph came back, and an unpublished case
  republished itself. Idempotent against the seed's own input is not idempotent against the
  owner's edits. It now needs `PORTFOLIO_SEED=1` **and** an archive with no `case-*` row. CI opts
  in explicitly because its database is a throwaway and `/portfolio` is an audited route.
- **Superseded docs are bannered, not moved.** `DESIGN.md` alone has 164 inbound references, many
  in dated records where rewriting the path would falsify what those documents said at the time.
  Five of the nine already carried a banner; `DESIGN.md`, `CONTEXT.md` and `docs/audit-uiux.md`
  now do.
- **Stale text**, each verified against the thing it describes: `media-grid.tsx` claimed the
  `AI Generated` filter had no column, 250 lines above the action that sets it; `docs/studio-cms`
  said 1,115 slots and six manifest pages (1,185 and seven — Large Format was the missing one);
  README's build-phase log is marked as v1 history and its "production deployment is the owner's
  remaining step" corrected, the site having been live for some time.

### Found, and not done as asked
- **The audit said six obsolete workflows. Four are.** `fetch-media-v3`, `fetch-media-v3-video`
  and `fetch-tiers` are named by CLAUDE.md, `data/tiers/README.md`, `docs/google-sheets.md` and
  `scripts/media-v3-video-fetch.mjs` as the documented way to rebuild the Part 15 masters or
  refresh the tier snapshot — operations no sandbox can perform, because the CDN and
  docs.google.com are both blocked. Deleting them would have removed the only remaining route to
  two real jobs.
- **`.env.example` is untouched and unverified.** `.env*` is denied in this environment for
  reading as well as writing, so the audit's specific claims about its contents could not be
  checked. The complete list of variables the code actually reads is in the PR body for the owner
  to diff against.

## Transformation Phase 1b — tokens, budgets and the contract's last corners (2026-09-03)

The ungated half of roadmap Phase 1b, plus the two Phase 1a gate items that needed no decision. No
schema, content or asset changed; no visual value moved except one crossfade (below). The motion
patterns 1b would otherwise adopt stay gated on D10, the OG re-skin on D19, the hero rise/drift on D20.

### Added
- **A named stacking ladder.** `--z-grain · bar · rail · header · dialog · progress · consent · scrim
  · drawer · ribbon · overlay · preloader · cursor · skip` in `tokens.css`, with three more for the
  Studio's separate domain. Every `fixed`/`sticky` layer now names its rung: the couplings that lived
  only in prose ("z-[55] keeps it UNDER the mobile menu", "below the drawer scrim (z-59)") are code.
  **The values are unchanged** — verified in the browser after the migration (header 50, grain 25,
  bottom bar 30, as before). Local stacking inside a card (`z-10` on a badge) is deliberately not on
  the ladder.
- **`scripts/motion-budget.mjs`** + a CI step: gzips the chunks that *contain* GSAP and Lenis (never
  the component chunks that merely import them) and holds them to a budget. The Phase 0 audit called
  this budget "unmeasured"; it is now measured, and the measurement is a finding — see below.
- **Three more `redesign-audit.mjs` rules.** A transition or entrance whose duration is not one of
  Part 3.8's four values fails (infinite ambient loops are exempt — the spec times those
  individually); a lift or scale on a control's `hover:` fails; and the champagne count, printed as
  an advisory note since it was written, is now a rule, because every audited route passes it.
- **Four translation keys** in nine locales for the 3D viewer and the rating stars.

### Changed
- **The legacy motion aliases are gone.** `--ease-out`, `--dur-micro` and `--dur-enter` were second
  names for `--ease-luxury`, `--dur-fast` and `--dur-base`; 34 call sites now name the Part 3.8 token
  directly and the aliases are deleted from `tokens.css`. The bespoke values went with them: the page
  transition's `450ms`, the mega menu's and the shadcn primitives' `duration-200`, and the
  announcement bar's `300ms` crossfade — §5.1 names that last figure, and Part 3 is the value
  authority, so it is `--dur-base` now (50ms nobody can see, one fewer duration in the codebase).
- **`rating-stars.tsx`** read "Rated 5 out of 5 stars" to every locale. Its accessible name is a
  translated string now — the class of bug the i18n gate cannot see, because a hardcoded string is
  never a missing key.
- **`model-viewer.tsx`** got three fixes, none of them visible to any gate: `auto-rotate` ignored
  `prefers-reduced-motion` (Part 14 says no exceptions, and the global CSS collapse cannot reach a web
  component spinning its own WebGL camera), its strings were hardcoded English, and a failed import
  left the loading state up forever — it now says so and offers a retry.
- **`product-card.tsx`**'s header no longer describes it as the storefront's card. It is the
  superseded v2 component, rendered only by `/design-lab` (which 404s in production); the live card is
  `catalog-product-card.tsx`, which already has no fill, no shadow and no lift. Its hover shadow is
  left in place deliberately: the design lab's fate is D17 and this file goes with it.

### Found: the motion budget is over
Part 14 budgets motion JS at **≤45 KB gzipped**. Measured on the real build it is **51.1 KB** — GSAP
with ScrollTrigger and SplitText in one chunk (45.8 KB) plus Lenis (5.2 KB). Closing a ~6 KB gap means
giving up a GSAP plugin or Lenis, which is a motion-scope decision (**D10**), not hygiene. So the gate
enforces a **ceiling at the shipped size and warns about the gap**: the number can only go down while
the decision is pending, and the ceiling drops with it. Lower it in the same commit as any reduction.

### Verified
typecheck · lint · test (37 files / 380) · copy:check (1,185 slots — four new keys) · i18n-missing
plain and `--stale` · `npm run build` against a local Postgres 16 · test:db · redesign-audit at 1440
and 390 over the 13 CI routes and the 6 RTL routes, **38 route-widths clean with the three new rules
live** · a11y-audit at both widths plus RTL, 0 critical/serious · test:e2e 10/10 · motion-budget.
The hover rule was proven to fire on a synthetic page: the `hover:scale-105` button fails while
`active:scale-95`, a colour-only link and a non-control card pass. Computed z-index values were read
back from the rendered page to prove the ladder renamed the stack without re-ordering it.

## Transformation Phase 1a — hygiene and gates (2026-09-03)

The ungated half of the roadmap's Phase 1a: every item that needed no owner decision. No schema,
content or asset changed; no Server Action changed behaviour except the scraper reading a column it
already stored. The gated items (D18 dormant files, D22 portfolio seed, D23 legacy sheet push, D24
housekeeping, D28 the rewind of `main`) are untouched and wait on `docs/transformation-roadmap.md` §2.

### Added
- **Stale-translation gate.** `scripts/i18n-missing.mjs --stale [--base <ref>]` compares every
  catalogue with a git ref and fails when an English value changed and a locale's did not — the hole
  AGENTS.md recorded under "Traps" that the presence check could not see. CI runs it on every pull
  request against the PR's base branch (`.github/workflows/ci.yml`, two new steps).
- **`src/lib/scraper/sheet-delete-plan.ts`** + test: the Sheets row-deletion index arithmetic
  extracted from `deleteRowsFromTab` as a pure planner. Five cases replay the plan against a simulated
  tab and prove the descending-order invariant — including that the same requests run ascending
  delete the wrong rows and report success.
- **Two contract rules in `scripts/redesign-audit.mjs`**, read from computed style: `backdrop-filter`
  anywhere outside the sticky header and its search panel fails; a `box-shadow` with a blur radius
  anywhere outside the mobile bottom bar fails (zero-blur shadows — Tailwind rings, 1px rules — are
  borders by another name and pass). Nothing gated either rule before.

### Changed
- **Scraper politeness.** `ScrapeSource.requestDelayMs` — declared, documented and stored for a
  month while nothing read it — now reaches the Shopify, WooCommerce and JSON-LD adapters through
  `AdapterContext.requestDelayMs`, resolved by the existing `resolveDelayMs` (never faster than the
  shared floor). `continueScrapeJob` selects the column and passes it.
- **Total reads on prerendered routes.** `/privacy`, `/terms` and `sitemap.xml` no longer fail
  `next build` on a transient database error (the Phase 0 PR's Vercel preview died on exactly this,
  P2037, with a docs-only diff). The legal pages render the site's error state — logged, never a
  404, `row: null` still means "no row" — and the sitemap serves its static routes for one
  revalidate window.
- **Blur in one place, shadows in none.** The dialog overlay, the wishlist button and the
  motion-paused chip drop their `backdrop-blur`; the consent banner's `shadow-2xl` becomes the
  hairline every other surface uses; the PDP share buttons use the `Button` primitive instead of
  bespoke classes. The header and the search overlay keep theirs — the contract's one place.
- **One port.** Twelve scripts defaulted to `:3111` or `:3000` by accident of authorship; all now
  honour `BASE_URL` and default to `http://localhost:3000` (their old per-script variables still
  work as a fallback).
- **Docs.** `docs/source-adapters.md` no longer points at an adapter test that does not exist;
  `CLAUDE.md` counts corrected (13 CI routes, 1,181 copy slots, seven manifest pages); the
  `ci.yml` note on `AUDIT_ROUTES` no longer calls the CI database empty — `import-tiers` fills it on
  every build.

### Verified
typecheck · lint · test (37 files / 380) · copy:check · i18n-missing plain and `--stale` · `npm run
build` against a local Postgres 16 · test:db · redesign-audit and a11y-audit at 1440 and 390 over the 13
CI routes and the 6 RTL routes, all clean · test:e2e 10/10. The two new audit rules were also proven
to fire: the shadow rule on `/studio/login` (shadcn's `shadow-xs`), the blur rule on a synthetic page
carrying one blurred element beside a zero-blur ring and a 1px hairline rule, which pass.

## Transformation Phase 0 — forensic audit and roadmap (2026-09-02)

Documentation only. No application code, schema, content or asset changed.

### Added
- **`docs/transformation-audit.md`**: the master prompt's 89 sections reconciled against `HEAD` —
  13 EXISTS · 62 PARTIAL · 2 DATA_GAP · 7 DECISION · 2 MISSING · 3 PROCESS, with 17 forbidden
  asks named against the rule that blocks each and 20 library pattern families screened out. KEEP/REFINE/REBUILD/REMOVE verdicts for every
  storefront, motion and Studio surface; the testimonial gap field by field with a proposed additive
  migration; three demo-data isolation designs with a recommendation; an eleven-library inspiration
  research pass (all reached) with an 18-pattern shortlist and an install-nothing policy; a 40-item
  Higgsfield generation plan (nothing generated); 28 owner decisions D7–D28; a risk register; a stale
  documentation register.
- **`docs/transformation-roadmap.md`**: Phases 1–17 re-sequenced to what exists, decision gates per
  phase, an additive migration plan M1–M10, the per-phase definition of done, and the §81 checkpoint
  protocol.

### Changed
- **`PROJECT_STATE.md`**: a `SESSION CHECKPOINT` block (the master prompt's fifteen §81 keys) now
  opens the file; the stale NEXT EXACT TASK (already DONE in Phase 2f) is replaced; the migration
  count (44), test counts (36 files / 375) and the contradictory "CI is now live" line are corrected
  in place with dated notes.

### Found: a discarded history layer (audit §1.2, decision D28)
Twelve pull requests (#15–#20, #22–#27) were merged into `main` on 2026-09-01 and dropped when `main`
was rewound to `f1cfd95` by 2026-09-02 12:13 UTC; PR #28 was closed unmerged. The layer (38 commits,
50 files, +1,218/−251) is reachable at `refs/pull/<n>/head` and contains LQIP wiring, the `.env.example`
fix, reference-doc corrections, uploads hardening, CSP enforcement, four Phase 2e answers and the
`mirror-images.yml` retirement. Whether the rewind was deliberate is the owner's first decision.

### Found, not fixed (each is its own PR — see the roadmap Phase 1a)
- `src/actions/scraper-jobs.ts:379-404` and `:749`: a legacy `syncSourceToSheet` push runs after the
  policy-gated `pushJobToSheet`, bypassing `SheetSyncPolicy`, so the MANUAL default is not the
  effective default.
- `scripts/i18n-missing.mjs` cannot detect a changed English value with stale translations
  (`AGENTS.md:166-169`); this gate must exist before any copy-bearing phase.
- `ScrapeSource.requestDelayMs` is never read; `studioEditedAt` is written and never read; the Bulk
  Import wizard's product path upserts by slug without `decideMerge`.
- Seven `backdrop-blur` sites on the storefront against the contract's "exactly one"; `consent-gate.tsx:74`
  adds a third storefront shadow and a 16 px radius on a site-wide banner.
- `revalidatePublic("testimonial")` purges only `/` (`src/actions/helpers.ts:137-139`) while product
  pages cache for a day; `getTestimonials()` is not total (no `try/catch`); the testimonial band puts
  ≥ 15 champagne-filled star glyphs in one viewport against the max-two rule, with an untranslated
  `aria-label`.
- The four OG share cards and the manifest still paint the superseded v2 palette.
- Found on this PR's own Vercel preview (`04cbd9a`, `P2037 TooManyConnections` for role
  `prisma_migration` during prerender): `privacy/page.tsx:55`, `terms/page.tsx:55` and
  `sitemap.ts:60-82` read the database with no fallback, so a transient database error at build
  time fails the deploy; the Vercel runtime `DATABASE_URL` carries the migration role instead of
  the pooled endpoint `src/lib/db.ts` expects.

### Verified this session
`npm run typecheck` ✓ · `npm run lint` ✓ · `npm test` ✓ (36 files / 375 tests) · `npm run copy:check` ✓
(1,181 slots) · `node scripts/i18n-missing.mjs` ✓ (0 missing). Not run locally (no database or server
in the session): build, test:db, e2e, the three audits, Lighthouse.

**GitHub Actions executes.** Pushing this branch triggered CI run #71 (`33664201599`) on PR #29, which
ran on a real runner: the checks job passed on the runner (job log read), and the build job ran
`npm run build` against the Postgres service. Run #76 (`33666509956`, head `6c536e7`) then passed
both jobs in full — build, `test:db`, design/RTL/a11y/Studio audits and the Lighthouse budget. `AGENTS.md`'s "CI has never run" trap and
`PROJECT_STATE.md`'s BLOCKER entry described 2026-08-31 and are corrected in this PR; retiring D4's
premise is owner decision D27.

## [Unreleased] — Prompt Deck Task 07: the first database-backed test slice

### Added
- **`src/lib/shop.test.ts`**: Pure unit test suite covering `buildProductWhere` filter composition (status constraint, title/shortTagline search, ecosystem groups, catalog categories, occasions jsonb containment, inStock availability, and price band overlapping).
- **`tests/db/product-where.test.ts`**: Database integration test verifying `buildProductWhere` queries against Postgres via Prisma without SQL/syntax errors.
- **`tests/db/media-usages.test.ts`**: Database integration test verifying `findMediaUsages` and `findMediaUsageDetails` across all schema media-bearing tables against Postgres.
- **`vitest.db.config.mts`**: Dedicated test runner configuration for database-backed tests (`tests/db/**/*.test.ts`), isolating them from the fast pure-function suite (`npm test`).
- **`package.json`**: Added `"test:db": "vitest run --config vitest.db.config.mts"`.
- **`.github/workflows/ci.yml`**: Added `npm run test:db` step in the `build` job against the disposable Postgres service container.

## Phase 2f #1: wire localized footer tagline and eliminate superseded 3D printing proposition

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
