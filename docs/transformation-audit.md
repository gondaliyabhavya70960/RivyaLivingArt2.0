# Transformation audit — Phase 0 of the "Complete Website + Studio Transformation" master prompt

**Verdict: the master prompt describes a site that is roughly three-quarters built. Of its 89 sections, 13 are already satisfied, 62 are partly built, 2 are blocked by data the business does not have, 7 need an owner decision before any code is written, 2 are missing outright (the two testimonial demo-data sections that wait on the testimonial schema), and 3 are process. Seventeen individual asks inside those sections are forbidden by the binding design spec and hard rules the prompt itself says to honour (§4.3), and twenty inspiration-library pattern families were screened out for the same reasons (§14).**

Audited at `HEAD f1cfd95` on branch `claude/session-6h1a70`, 2026-09-02. Companion document: `docs/transformation-roadmap.md`. This audit does not change a line of application code.

The three findings that shape everything else:

1. **The catalogue contains no furniture.** Settled decision D5 (`PROJECT_STATE.md`, DECISIONS) records that "Resin Furniture & Surfaces" holds a ₹40 night light and two ₹350 table-top pieces, and `docs/LARGE-RESIN-ART-IMPLEMENTATION.md:11-27` measured 0 dining tables, 0 coffee tables, 0 consoles, 0 chairs, 0 benches. The master prompt's primary commercial focus (§1), the statement-furniture band (§9), the furniture collection tiles (§11) and six of the eighteen `/large-resin-art` sections (§21.3–21.8) are therefore **DATA_GAP**, not design work. HARD RULE 3 (`AGENTS.md:35-39`) forbids inventing the products; REDESIGN.md §15.2 forbids AI imagery presented as delivered work. Furniture can be shown only as commission capability, framed as work in progress.
2. **The Testimonial entity is eight columns and every row is live.** `prisma/schema.prisma:340-351` carries `name · location · quote · rating · avatarUrl · order · translations` and no status, featured, published, demo, date, product or project link; `src/lib/testimonials.ts:40-43` selects every row with no `where`. The §17 architecture is a schema change, which REDESIGN.md §1.1 and `docs/redesign-contract.md` §1 put outside the visual redesign. It is buildable as an additive migration and is the single most valuable engineering item in the prompt, but it starts with an owner decision, not a component.
3. **There is no safe place for synthetic content.** No `isDemo` marker exists anywhere (`grep -rni isDemo prisma src scripts` returns nothing). The only demo convention is a `title startsWith "DEMO"` exclusion at eight code sites (seven read-site exclusions — `src/lib/shop.ts:104,675`, `src/lib/search-query.ts:47`, `src/app/sitemap.ts:34`, three route files — plus the Studio badge at `product-list.tsx:517`) and two tests, while four other Product readers (`product/[slug]/opengraph-image.tsx:32`, `catalog-nav.ts:65`, `media-usages.ts:72`, `scraper/product-sheet-sync.ts:35`) apply no filter at all; its seed was deliberately deleted (`prisma/seed.ts:16-17`: "the catalog ships 100% empty and owner-fed"). `npm run build` runs `prisma/bootstrap.ts` against the production database on every deploy, and it already republishes 20 Portfolio rows each time (`bootstrap.ts:305`, `seed-portfolio-cases.ts:488`). Any demo seed wired near that path lands in production. The 100 demo products, 30 demo articles and 30–50 demo testimonials of §40–42 and Phase 15 are **FORBIDDEN in the production database** under HARD RULE 3 and are recorded here as an owner decision with a recommended isolation design (§14 below).

Everything else in the prompt is smaller than it looks. The v3 "Liquid Luxury" design system, the global chrome, all 21 public routes, the Part 9 product page, the shop and search, the eight-surface CMS, the scraper pipeline, the Sheets import/export, the media library and the nine-locale i18n layer are built, gated and live at https://www.rivyalivingart.com. What remains is refinement, a handful of buildable new bands, a set of schema decisions, and a body of hygiene that previous audits already logged.

---

## 0. Method and evidence standard

This audit follows the repository's own precedent for reconciling an external plan against `HEAD` (`docs/ui-master-plan-reconciliation.md`: every entry opened in the file it names) and its Phase 0 precedent (`docs/PROJECT-AUDIT.md`: parallel readers plus adversarial verification).

**What was read.** Ten subsystem readers each read their subsystem in full, read the master-prompt sections that touch it, and returned an inventory with a KEEP / REFINE / REBUILD / REMOVE / REPLACE verdict per file, a list of checkable facts with `path:line` evidence, and one gap row per master-prompt ask using the repository's own gate vocabulary (EXISTS / PARTIAL / MISSING / FORBIDDEN / DATA_GAP, from `docs/scraper-audit.md:6-10`). Subsystems: design system and motion · public routes and chrome · storefront component library · Studio · Prisma, migrations and seeds · scraper and Sheets · media and Higgsfield · i18n, SEO, tests and CI · CMS content layer · project history and prior audits. An eleventh reader dedicated to the testimonial system ran afterwards and its findings are folded into §12. Each subsystem report was then handed to an adversarial verifier that re-opened every cited file and tried to refute each claim. **All eleven verifiers have reported** (881 claims checked: 737 confirmed, 128 partially wrong, 14 refuted, 2 unverifiable) and every correction is applied inline — the branch history on PR #29 records each batch, and the refutations that mattered are the ones a reader would otherwise have trusted: 21 public routes rather than 22, 47 Studio pages rather than 46, CI executing rather than "never", the CI database holding the tier catalogue rather than being empty, the product form carrying inline errors after all, 115 scrape sources rather than 117, and the discarded history layer in §1.2. Five section reconcilers then re-derived every row of §19 from the verified digests and the tree; they agreed with 77 of the 89 rows as first written, and their twelve disagreements are adopted (the counts under §19 record which). The load-bearing claims in the headline (no furniture rows, the eight-column Testimonial with no `where`, no `isDemo`, the every-deploy portfolio seed, the un-gated sheet push, the count drift, the seven blur sites) were additionally re-opened by hand in this session. A separate eleven-agent research pass fetched every inspiration library named in §5 (all eleven reached) and produced §14.

**What was run.** `npm install --legacy-peer-deps` (973 packages), then the five gates that need no database:

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS (26 s) |
| `npm run lint` | PASS (36 s) |
| `npm test` | PASS — 36 files, 375 tests (3.2 s) |
| `npm run copy:check` | PASS — 1,181 slots in sync |
| `node scripts/i18n-missing.mjs` | PASS — 0 missing in all 8 locales |

`PROJECT_STATE.md` still records 29 files / 322 tests; the suite has grown by 7 files since it was written.

**What could not be run, and is therefore not claimed.** `npm run build` (needs `DATABASE_URL`; runs `prisma migrate deploy` and `bootstrap.ts`), `npm run test:db`, `npm run test:e2e`, `scripts/redesign-audit.mjs`, `scripts/a11y-audit.mjs`, `scripts/studio-audit.mjs`, Lighthouse, and screenshots. This container has no Postgres and no running server. The last recorded local run of the full set is in `PROJECT_STATE.md` BUILD STATUS and `docs/ui-master-plan-reconciliation.md` §3. **GitHub Actions executes.** `AGENTS.md:188-190` and `PROJECT_STATE.md` KNOWN ISSUES record that Actions never allocated a runner (billing, `runner_id: 0`); that was true on 2026-08-31 and is no longer true. Pushing this branch triggered CI run #71 (`33664201599`) on PR #29 on 2026-09-02: the `checks` job ran on runner `1000000932` through typecheck, lint, `copy:check`, `i18n-missing` and vitest (36 files / 375 tests passed on the runner, verified from the job log), and the `build` job started `npm run build` against the Postgres service container. Run #76 (`33666509956`, head `6c536e7`) then completed **green on both jobs** at 18:30 UTC: the real `npm run build` against the Postgres service, `test:db`, Chromium, the design audit at 1440 and 390, the RTL sweep, the accessibility audit, the authenticated Studio audit and the Lighthouse budget all passed on the runner. Run #1 (2026-08-31) failed without a runner as the documents record; from run #47 (2026-09-01) onward runs execute, and run #70 on `f1cfd95` itself was green on `main`; the two operating documents are stale on this point and decision D4 ("local verification because CI cannot run") needs retiring by the owner, keeping only its evidence habit for what CI does not sweep yet (§11).

**Vocabulary.** For existing code: KEEP (good and reusable) · REFINE (architecture right, quality or contract drift) · REBUILD (fundamentally weak) · REMOVE (obsolete and unused) · REPLACE (a substantially better component is justified). For master-prompt asks: EXISTS · PARTIAL · MISSING · FORBIDDEN (names the rule) · DATA_GAP (buildable but the database holds nothing for it) · DECISION (only the owner can resolve a conflict between the prompt and a repository rule). Effort S < ½ day · M 1–2 days · L 3–5 days · XL a week or more.

---

## 1. What the repository is at HEAD

| Dimension | Measured |
|---|---|
| Stack | Next.js 16.3.1 App Router · React 19.2.4 · TypeScript strict · Tailwind v4 CSS-first (no `tailwind.config`) · Prisma 7.8 + Postgres (Neon) · next-intl 4.13, 9 locales · Auth.js v5 beta, staff only · Vercel + Vercel Blob · GSAP 3.15 + Lenis 1.3 (lazy) · Tiptap 3 · `@google/model-viewer` |
| Source | 91,871 lines of `.ts/.tsx/.mjs`: `src/app` 20,829 · `src/components` 40,353 · `src/lib` 19,974 · `src/actions` 10,053 (30 action modules plus `helpers.ts`, 124 exported Server Actions) · `src/hooks` 319 · `src/i18n` 258 · `prisma/` 2,735 · `scripts/` 4,026 |
| Components | studio 91 files / 22,392 lines · storefront 45 / 10,614 · ui (shadcn, Studio-scoped) 12 · motion 8 · product 6 · sections 4 · shop 3 · analytics 3 · providers 2 · portfolio 2 · layout 2 · blog 2 · seo 1 · icons 1 |
| Routes | 21 public under `src/app/[locale]/(v2)` · 47 Studio pages under `src/app/studio` · `/design-lab` (dev-only, 404 in production) · 9 API routes + `/uploads/[...path]` |
| Database | 35 models, 14 enums (`prisma/schema.prisma`, 998 lines) · **44 migrations**, DDL-additive (0 `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN` / `RENAME`) — `PROJECT_STATE.md` DATABASE MIGRATIONS said 43 until this PR's dated correction |
| i18n | 9 locales × 30 namespaces × 1,181 leaf keys, all equal; `src/lib/site-copy.generated.ts` in sync |
| Assets | `public/` 22 MB, 242 files: images 60 · media 55 (v2 4, v3 27, v6 10, 14 loose) · sequences 121 · mock 5 |
| Git | 41 commits, 17 merge commits, branches `main` and `claude/session-6h1a70`; no `docs/transformation-*` file has ever existed |
| Deploy-time writers | `npm run build` = `prisma migrate deploy && tsx prisma/bootstrap.ts && next build`; bootstrap reconciles scrape sources, category and blog covers, imports the four sheet tiers, seeds the 55-post journal once, and upserts 20 PUBLISHED portfolio cases **on every deploy** |

The architecture decisions recorded in `PROJECT_STATE.md` D1–D6 and `docs/PROJECT-AUDIT.md` §10 ("what must survive") are all still in force and are restated in the roadmap.

### 1.1 The one CMS pattern

Eight Studio surfaces follow `registry in code → overrides in the database → a TOTAL resolver` (`CLAUDE.md` "The studio CMS"). Verified counts differ from the docs:

| Surface | Registry | Table | Resolver | Documented | Actual |
|---|---|---|---|---|---|
| `/studio/site-copy` | `src/lib/site-copy.ts` | `SiteCopy` | `getSiteCopy()` | 1,115 slots (`CLAUDE.md:118`) | **1,181** (`copy:check`) |
| `/studio/site-images` | `src/lib/site-images.ts` | `SiteImage` | `getSiteImages()` | 57 (`docs/studio-cms/*`) / 62 (`CLAUDE.md`) | **62** (`site-images.test.ts`) |
| `/studio/sections` | `src/lib/page-sections.ts` | `PageSection` | `getPageSections()` | six pages (`CLAUDE.md:345`) | **seven** (`large-format` at `page-sections.ts:23,664`) |
| `/studio/custom-pages` | `src/lib/custom-blocks.ts` | `CustomPage`·`CustomBlock` | `getCustomPage()` | 6 block types | 6 (asserted by `custom-blocks.test.ts:25`) |
| `/studio/forms` | `src/lib/form-options.ts` | `FormOption` | `getFormOptions()` | — | as documented |
| `/studio/navigation` | `src/lib/nav-menus.ts` | `NavMenu`·`NavItem` | `getNavMenus()` | — | as documented |
| `/studio/media` | — | `Media` | — | — | as documented |
| `/studio/settings` · `/seo` | `src/lib/constants.ts` | `SiteSettings` | `getSiteSettings()` | — | as documented |

Adding a surface (Materials, Process, Collections, Room context) means following this shape, per D2. Every new table that stores a media URL goes into `src/lib/media-usages.ts` in the same commit (the rule has been broken four times, silently).

### 1.2 A discarded history layer on GitHub

Found by the history verifier and confirmed from the GitHub API and the PR refs (`git fetch origin refs/pull/N/head`): between 2026-09-01 05:11 and 07:11 UTC, twelve pull requests were merged into `main` on top of `f1cfd95`, and by 2026-09-02 12:13 UTC `main` had been rewound to `f1cfd95` (CI run #68 ran on `main = 950d9ac`; run #70 on `main = f1cfd95`). Their branches are deleted and their commits are absent from a fresh clone, but every one is still reachable at `refs/pull/<n>/head`. The whole layer is 38 commits, 50 files, +1,218 / −251 lines, and `refs/pull/27/head` (`669325a`) contains all of it.

| PR | What it did | Where the audit lists the same work |
|---|---|---|
| #15 | `docs/antigravity-prompts.md` — the prompt deck as one file | — |
| #16 | `src/lib/lqip.ts` + test: LQIP blur placeholders wired into `SlotImage` and `MeniscusImage` | §10.4 REFINE, roadmap Phase 12 |
| #17 | `.env.example`: retired domain removed, `DATABASE_URL_UNPOOLED` / `RESEND_FROM` / `CRON_SECRET` documented | D24 |
| #18 | Reference docs made true (13 routes, 1,181 slots, 44 migrations, 358 tests, 242 public files) in `CLAUDE.md`, `AGENTS.md`, `PROJECT_STATE.md` | §18 |
| #19 | Security hardening: uploads traversal, magic-byte sniff, `clientIp` proxy contract (+ `uploads-route.test.ts`) | QA/03 RR-002/003/004, §19 row 72 |
| #20 | CSP enforced (media-src, blob connect-src, worker-src) in `next.config.ts` | §11, row 56, roadmap Phase 16 |
| #22 | `/shop?q=` searches descriptions (Phase 2e question 1) | Phase 2e-1 |
| #23 | Non-quantified "show more" label in nine locales (2e question 2) | Phase 2e-2 |
| #24 | Group-aware breadcrumbs on supplies and print pages (2e question 3) | Phase 2e-3 |
| #25 | Ecosystem inferred from `?category=` to restore pre-2a bookmarks (2e question 5) | Phase 2e-5 |
| #26 | `docs/studio-cms` slot counts synced to 62; `mirror-images.yml` retired | §18, D24 |
| #27 | CSP: `unsafe-eval` and `vercel.live` allowed | follows #20 |

PR #28 ("feat: transform to Rivya Living Art 2.0 luxury architecture", 45 files, +483 / −89 against the then-`main`) was closed unmerged on 2026-09-02 11:33 UTC. It renamed routes to `/journal`, `/projects`, `/wedding`, added schema fields (`resinType`, `woodType`, `leadTime`) and bespoke CRM statuses, and led the homepage with furniture — the precedent for what this audit records under D5, D9 and HARD RULE 5, attempted and rejected.

Two consequences. First, four of the five Phase 2e owner questions were answered and shipped once (#22–#25), and several Phase 1a hygiene items exist as reviewed code (#16, #17, #19, #20, #26); redoing them from scratch would be waste, and re-applying them blind would repeat whatever the rewind was meant to undo. Second, the rewind itself is unexplained in the repository. **Whether it was deliberate is owner decision D28**, and it gates Phase 1a: if the rewind stands, the discarded PRs are re-opened one at a time from their refs with fresh review; if it was accidental, `main` is restored to `950d9ac` and this branch is rebased onto it.

---

## 2. Public routes

All 21 routes under `src/app/[locale]/(v2)` are server components on the v3 system (`u-shell`, section tiers, band rhythm, `MeniscusImage`, one `h1`, `EmptyState`/`ErrorState`, skeleton loading), ship `generateMetadata` with per-locale canonical and hreflang, and 13 of them plus 6 Arabic routes are in the CI audit list (`ci.yml:95-105`). Seven pages render through the total `getPageSections()` manifest so the owner can reorder and hide sections. Verdicts below are against the master prompt, not against REDESIGN.md, which every route already meets.

| Route | File | What it renders | Master-prompt asks | Verdict |
|---|---|---|---|---|
| `/` | `page.tsx` | REDESIGN Part 6, 14 manifest sections: hero (`HeroMedia`, `min-h-svh`) · manifesto · featured pieces · pinned material story (the one sanctioned pin) · six collection tiles · maker · recent commissions · bespoke dark band · 3D print band · how it works · why · journal · closing | §8 hero copy is an owner slot (`Home.hero.headline`); §9 furniture band DATA_GAP; §10 large-format band MISSING (buildable); §11 bento re-layout buildable; §14 room context DATA_GAP | REFINE |
| `/large-resin-art` | `large-resin-art/page.tsx` (495 lines) | Six sections: scale hero · scope (4 tiles) · how (dark) · brief · gallery (hideable, not conditional: it renders an invitation when `LARGE_FORMAT_CATEGORY_SLUGS` yields no pieces, `page.tsx:336-444`) · commission CTA; Service JSON-LD; `LargeFormat` namespace ×9 | §21: 6 of 18 sections exist, 4 more partially; 21.3–21.8 and 21.11 DATA_GAP; 21.15–21.17 MISSING (S each, patterns exist on `/custom-order`) | REFINE |
| `/shop`, `/shop/[category]` | Part 7 / Part 8 | `ShopExplorer` (sticky toolbar, sort menu, filter drawer, chips, load-more + pagination, nine-skeleton pending state), five ecosystem tabs, collection strip; category page is an editorial mini-landing | §22 all present except quick view; §23 card metadata needs a data projection | KEEP (quick view MISSING) |
| `/product/[slug]` | Part 9 | 60/40 gallery (pan-zoom, rail, video and 3D chips, lightbox) · identity column · spec sheet (`lexical` rows) · `ProductOrderPanel` with customization controls · care accordion · provenance (`madeWith`/`usedIn`) · related rail · testimonials · Product+AggregateOffer JSON-LD · sticky mobile CTA | §20 hero/identity/customisation/care/related/CTA EXIST; visual dimensions, scale visualizer, room context DATA_GAP (free-text `dimensions`, no `ProductImage.role`); 3D viewer REFINE | KEEP |
| `/search` | | Whole-catalogue product search with synonyms; hands off to `/shop?type=all` (Phase 2d). The header overlay (`search-overlay.tsx`) searches products, collections, portfolio and journal | §68: the page is products only; pages, FAQ and materials are not searched anywhere | KEEP (stale v2 comments) |
| `/shop/wishlist` | | Account-free localStorage list with WhatsApp share | §22 "wishlist-like affordance" — conflicts with REDESIGN §0 decision 4 ("Wishlist… Rejected") | DECISION |
| `/custom-order` | Part 10 | Split hero, four commission kinds, how, brief form → Server Action → `Inquiry` → `wa.me`, FAQ, past work, testimonials. The form carries name, phone, email, notes, material and occasion selects, budget, timeline, reference images and a honeypot (`custom-order-form.tsx:63-72, :386-409, :560, :633-667`) | §15 PARTIAL: none of the prompt's brief attributes (dimensions, resin colour, wood, finish, shape, edge treatment, artwork direction, installation) exists as a field; adding them is a form-field change under HARD RULE 5, so an owner decision; wording is an owner slot | KEEP |
| `/about` | §11.3 | Hero, three story chapters, four values, maker band, `CraftChapters`, four materials with macro hover, studio gallery, closing | §26 EXISTS; maker photograph is itself a generation (§15.2) — owner action | KEEP |
| `/process` | §11.4 | Video hero, six stages with sticky photograph, materials, timelines, `CureLine` | §13 ten steps = 4 copy keys ×9 locales + 4 slots + owner confirmation the steps are real | REFINE |
| `/portfolio`, `/portfolio/[slug]` | §11.1–11.2 | Masonry wall, category chips, mono numbers, pagination; case page with spec rail, stats, brief, captioned gallery, `BeforeAfter` (never renders: no row has `beforeImageUrl`), VisualArtwork JSON-LD | §16 EXISTS; "installation context" is a data gap on existing columns (`Portfolio.location`, `process`, `resultsMeta`), not a schema gap | KEEP |
| `/blog`, `/blog/[slug]` | §11.8–11.9 | Featured lead, 3-up archive, real category chips, pagination; article with `ReadingProgress`, `ArticleToc`, pull quotes, author-linked product aside, related posts, Article JSON-LD | §24 related collections/materials MISSING/DATA_GAP; 6 categories vs the prompt's 10 (content task) | KEEP |
| `/faq`, `/contact`, `/workshops`, `/privacy`, `/terms`, `/whatsapp-order`, `/p/[slug]` | §11.5–11.10, Part 10 | FAQ explorer; contact with consent-gated map; workshops; Tiptap legal pages; claim-token order page; landing pages from the six-block builder | §27 all on v3 | KEEP |

**Global chrome** (`site-header.tsx`, `footer.tsx`, `announcement-bar.tsx`, `mobile-bottom-bar.tsx`, `whatsapp-fab.tsx`, `search-overlay.tsx`, all mounted by `(v2)/layout.tsx`) against §7:

| §7 requirement | Status | Evidence |
|---|---|---|
| Transparent over hero | EXISTS | `site-header.tsx:171-175`; seven-route `transparentRoutes` allowlist in `layout.tsx:118-126`, each with a `-mt-20` dark hero and scrim |
| Adaptive contrast, never unreadable over images | PARTIAL | Contrast is declared per route and flips at 80 px (`SOLID_AT`) or when the mega menu opens; it does not observe the section under the bar. An owner replacing a hero slot with a light photograph would make mineral links unreadable. Fix: a contrast rule in `redesign-audit.mjs`, or an IntersectionObserver-driven ink (M) |
| Light/dark logo state | EXISTS | `logo.tsx:22-44` (currentColor), `site-header.tsx:398` |
| Sticky transformation, smooth transition | EXISTS | 80→64 px, `--dur-base`/`--ease-luxury`, hide on scroll-down past 400 px (`site-header.tsx:45-50, 205-240, 371-390`); blur only while solid |
| Desktop navigation | EXISTS | Four items from `NavItem` rows; §5.3 mega menu with three photographs and ≤8 category links |
| Premium mobile menu | EXISTS | Obsidian drawer, 320 ms enter, 40 ms stagger, focus trap, `inert`, Esc, scroll lock (`site-header.tsx:604-712`) |
| Language selector | EXISTS, placed differently | `LocaleSwitcher` lives in the drawer and the footer legal rail. REDESIGN §5.1 (`REDESIGN.md:345`) moved it out of the bar on purpose: "Language moves to the footer — it is not a primary navigation act". DECISION if the prompt's placement is wanted |
| Studio link only where appropriate | EXISTS | No public link to `/studio` anywhere (HARD RULE 2); "Studio" as the third nav item is the brand story → `/about` |
| WhatsApp enquiry CTA | EXISTS | Header button (premium over hero, primary when solid), drawer button, bottom-bar item, desktop FAB after 25 % scroll; all from `SiteSettings.whatsappNumber` via `buildWaLink` |

Route safety (§59): every route the prompt asks for already exists, including `/large-resin-art`. No route needs creating, renaming or redirecting. A furniture "microsite" as a `/p/[slug]` lander would dodge the section registry and lose the URL; extend the `large-format` manifest instead.

---

## 3. Storefront components

Verdicts for the 45 files in `src/components/storefront/`, the 8 in `motion/`, and the product/shop/sections/blog/portfolio/seo/analytics/providers folders. The flat folder stays flat: §60 says adapt to the actual architecture, §83 says never rebuild to rename, and the reconciliation (`docs/ui-master-plan-reconciliation.md:290-293`) already rejected an `adapters/` tree.

### 3.1 KEEP — the v3 core (do not rebuild)

Signature devices `meniscus-image.tsx` (236 lines: never masks the LCP, skips visible frames, reduced-motion bypass) and `cure-line.tsx` (249: DOM-written transform per frame, 2 px bar below 1024 px, static ruler under reduced motion). Primitives built to §4.6: `button.tsx` (five variants, three sizes, loading width-lock, disabled reason line), `badge.tsx`, `accordion.tsx` (`0fr → 1fr`), `form-field.tsx`, `filter-chip.tsx`, `section-heading.tsx`, `skeletons.tsx` (flat sand, no shimmer), `empty-state.tsx`, `error-state.tsx` (retry + WhatsApp escape), `toast.tsx` (hairline countdown), `breadcrumb.tsx`, `pagination.tsx`, `carousel-nav.tsx` (built to REDESIGN §20.4 but with zero importers today; the snap rails in §14 are its first real consumer). Library: `catalog-product-card.tsx` (meniscus second-image wipe, wishlist heart, mono metadata, ghost "View piece" line, `MorphLink` to the PDP), `collection-card.tsx` (ratio prop 3/4·4/5·1/1, 1.03 hover scale), `shop-explorer.tsx`, `hero-media.tsx` (poster is the priority LCP, video only on non-touch motion-safe devices, WebM+MP4, pause toggle), `pour-cure-showcase.tsx` (121-frame canvas scrub with static twin), `craft-chapters.tsx`, `faq-explorer.tsx`, `customization-controls.tsx` (the §9.3 half), `whatsapp-summary-card.tsx`, `reference-image-uploader.tsx` (per-file progress and retry), `newsletter-signup.tsx`, `slot-image.tsx` (`<picture>` mobile crop + focal point), `studio-gallery.tsx`, `product/gallery.tsx` (60 % stage, pan-zoom, lightbox, video/3D chips), `product/order-panel.tsx`, `product/spec-sheet.tsx`, `product/sticky-mobile-cta.tsx`, `portfolio/before-after.tsx` (role=slider, keyboard, RTL; dormant on data), `portfolio/lightbox-gallery.tsx`, `blog/reading-progress.tsx`, `blog/article-toc.tsx`, `motion/reveal.tsx`, `motion/page-transition.tsx`, `motion/morph-link` via `next-view-transitions`, `providers/smooth-scroll-provider.tsx` (Lenis, bails on reduced motion and coarse pointer).

### 3.2 REFINE — right architecture, contract drift

| File | Drift | Fix |
|---|---|---|
| `storefront/dialog.tsx` | Scrim `backdrop-blur-sm` (:45) — blur outside the header; fade+zoom on legacy `--dur-micro`/`--ease-out`; docs cite v2 "Fraunces" | Drop the blur; Part 14 lightbox FLIP (260 ms) or accept fade; retoken |
| `storefront/rating-stars.tsx` | Live on the homepage, `/custom-order` and every PDP through `TestimonialCard`: three cards × five `fill-champagne` glyphs put ≥ 15 champagne elements in one viewport against §3.1's "never a fill, max two" (the audit script prints champagne counts as a note only, `redesign-audit.mjs:17-19`, and counts only the first viewport at `:262`, so a below-the-fold band never reaches even the note); hardcoded English `aria-label` (`:27`) ships in eight locales while a translated key sits unused at `en.json:236` | Mono `5 / 5` numeral or outline stars with one filled accent; label from the caller; decide whether ratings show at all |
| `storefront/testimonial-card.tsx` | Sound and honest, but one presentation mode of §18's six; cannot link to a product; sand card on a sand band on the PDP and `/custom-order` so the boundary vanishes | Wait for the §17 schema; add an `editorial` variant now (the `clientNote` blockquote on case pages, `portfolio/[slug]/page.tsx:759-767`, is the typographic model) |
| `product/model-viewer.tsx` | Untranslated "Loading 3D view…" (:61), gradient fill and shadcn `text-sm` (:59-60), auto-rotate not gated on reduced motion (:72), no error/retry state | i18n key, `usePrefersReducedMotion` gate, `ErrorState` on catch, poster from `images[0]` |
| `product/order-panel.tsx:90-135` | A 44-entry literal-hex `SWATCH_COLORS` table (43 hex plus `BRAND.gold`) inside a component, against "no raw hex in components"; documented as product data | Move to `src/lib/swatch-colors.ts` or record the exception in the contract |
| `motion/page-transition.tsx` + `next-view-transitions` | React's built-in `<ViewTransition>` works in the Next 16.3 App Router with no configuration (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`), so the comment in `next.config.ts` that justifies the dependency is stale | REFINE candidate: replace the dependency when `MorphLink` is next touched (S); not settled architecture |
| `product/share-buttons.tsx` | Imports the Studio-scoped shadcn `ui/button` (shadow-e1, rounded-sm) on the storefront (:8); calls `@vercel/analytics` directly | Use `storefront/button`; route tracking through `lib/analytics` |
| `shop/wishlist-button.tsx` | Second `backdrop-blur-sm` (:41); legacy motion aliases | Solid `bg-obsidian/85`, tokens |
| `shop/wishlist-panel.tsx` | Hand-rolled empty state instead of `EmptyState` (:137-155) | Use the primitive |
| `analytics/consent-gate.tsx` | `shadow-e3` + `backdrop-blur-md` + `rounded-2xl` (:74) and shadcn `text-sm` (:77) on a fixed banner mounted site-wide (`[locale]/layout.tsx:17`) — a third storefront shadow, a second blur and a 16 px radius (§3.5 allows 0–4 px; `globals.css:133-136` re-points `--radius-sm/md/lg/xl` but not `--radius-2xl`, which is why it renders at Tailwind's default) | Hairline card, no blur, `rounded-card` |
| `sections/contact-form.tsx:21`, `sections/custom-order-form.tsx:26`, `product/order-panel.tsx` | Import `CharCounter` / `Select` from the Studio-scoped `@/components/ui/` (no shadow, so lower priority than `share-buttons`) | Storefront-native counterparts when next touched |
| Lucide `strokeWidth` | 1.5 is consistent inside `storefront/` (94 occurrences); `share-buttons.tsx` (4 icons), the pause chip, `shop-explorer.tsx:901` and `customization-controls.tsx:183` render at 2 | Normalise to 1.5 except the two deliberate check marks |
| `motion/page-transition.tsx` | Sanctioned by Part 14, but raw `duration-[450ms]` and the `--ease-out` alias (:28) | `--dur-base`/`--ease-luxury` |
| `motion/hero-parallax.tsx` | Zero importers; translates 12 % of layer height (~100 px on a 900 px hero) against Part 14's 20–40 px cap | Px-capped `y: () => Math.min(40, h * 0.12)` then mount on the bespoke band (REDESIGN.md:505 allows 20–30 px) |
| `motion/kinetic-heading.tsx` | Zero consumers; 1.1 s default exceeds the 350 ms text reveal; waits on the unmounted Preloader's signal | Keep only if a hero lines-mask rise is approved; otherwise remove with `split-text-heading.tsx` |
| `hooks/use-motion-paused.tsx` | Pause chip carries `backdrop-blur-sm`, raw `duration-200`, `rounded-sm`, `ring-ring` (:122) | Retoken |
| `customization-controls.tsx` v2 tail (:450-700) | Four unmounted v2 exports; two of them (`OccasionSelect` :581-593, `QuantityStepper` :670-688) carry hardcoded English ("Quantity", "Decrease quantity"); and no disabled control in the shipped §9.3 half states a reason, which contract §9 requires alongside the 40 % opacity | Delete the tail with the design lab, or i18n it; add the mono reason line to disabled controls |
| `src/lib/brand-colors.ts` (+ `src/app/og-brand.ts`) | The last live "Midnight Gild" palette, self-described as v2.0 at `:4`: `royal #1e4fd8`, `gold #d4af37` (the exact "saturated costume gold" that REDESIGN §0 decision 1 at `:24` rejects; canonical champagne is `#b89b63`), `navyMidnight`, `voidBlue`, `porcelain` with no v3 equivalent; consumed by all four `opengraph-image.tsx` routes, `manifest.ts`, `global-error.tsx`, `email.ts`, `order-panel.tsx` swatches | DECISION (reconciliation §6 parked it): mirror v3 hexes for Satori, which cannot read `tokens.css` |

### 3.3 REMOVE — dead outside `/design-lab`

`storefront/product-card.tsx` (v2 card: `hover:-translate-y-1.5 hover:shadow-lg`, physical `left-3`, English labels; superseded by `catalog-product-card.tsx`), `storefront/order-summary-preview.tsx` (superseded by `whatsapp-summary-card.tsx`), `storefront/tabs.tsx` (zero consumers; REDESIGN §9.4 specifies alternating image/text blocks on the PDP and names no tab component anywhere in the storefront inventory §4.1–4.6), `storefront/mobile-whatsapp-bar.tsx` (superseded by `mobile-bottom-bar.tsx`; carries a blur), `shop/wishlist-count.tsx` (never consumed in this repository: it arrived unreferenced in the baseline import `32f21a6`), `motion/magnetic-button.tsx` (contradicts contract §6: no lift on buttons), `motion/split-text-heading.tsx`, `motion/cursor-follower.tsx` and `motion/preloader.tsx` + `lib/preloader-signal.ts` + the `gild-fill` keyframes (both deliberately unmounted at `(v2)/layout.tsx:71-80`: "decoration with no informational job", "a deliberate delay in front of the hero"). `storefront/marquee.tsx` is a different case: REDESIGN §4.1 (`:239`) lists one Marquee in the global inventory and Part 6 (`:531`) deleted only the *second* homepage marquee, so it is spec-listed but has no assigned position — keep it until a surface is decided. All are one import away from re-entering the storefront; removal is an owner decision recorded in the roadmap.

### 3.4 What §23 and §20 need that no component can supply

- **Dimensions and material on the card.** `Product.dimensions` and `Product.materials` exist but `CARD_SELECT` / `toShopProductItem` in `src/lib/shop.ts:228-253` do not project them. That is a data-projection change under HARD RULE 5; only 2 products carry dimensions today (`docs/LARGE-RESIN-ART-IMPLEMENTATION.md`).
- **Hover video on the card.** `Product.videoUrl` exists, `ShopProductItem` has no `videoUrl`; a 24-card grid of `<video>` also collides with Part 14's budget. Fine-pointer only, `preload="none"`, never the first row, if approved.
- **Quick view.** No component; four orphaned `Shop.quickView*` copy keys remain in nine locales and the registry (`site-copy.generated.ts:687-690`), and `wishlist-button.tsx:12` still references a QuickView register — evidence one once existed (and three more `Shop.card.*` keys — `customize`, `shipsIn`, `badgeStudioOriginal` — are registered Studio slots with zero consumers, the same defect). Buildable as a storefront `Dialog` reusing `ShopProductItem` with a WhatsApp CTA, but REDESIGN §4.6 says "the whole card is the target — no large button inside the card", so the trigger must be a ghost line outside the stretched `MorphLink`.
- **Enquiry affordance on the card.** Same constraint; a second ghost line ("Ask on WhatsApp" with `data-wa-source`) is feasible.
- **Visual dimensions / scale visualizer / room context on the PDP.** Need numeric W×D×H and a `ProductImage.role` (hero / detail / in-room / process); `ProductImage` carries `url · alt · order` only (`schema.prisma:141-150`).
- **Six testimonial modes.** See §13.

Legitimate anti-duplication extractions, to be done only when a file next changes (§83): a `PortfolioTile` (inlined in `portfolio/page.tsx` and the homepage), and a shared `Lightbox` + `useScrollSpy` that `gallery.tsx`, `lightbox-gallery.tsx`, `article-toc.tsx` and `faq-explorer.tsx` each re-implement (RTL keydown, live-region copy and focus return are already hand-copied between the two lightboxes).

---

## 4. Design system and motion

### 4.1 Tokens (§61) — what exists

`src/styles/tokens.css` (222 lines) carries the whole of REDESIGN.md Part 3: 13 palette roles + `champagne-ink` and `whatsapp-deep` AA companions + the `[data-theme="navy"]` dark-band scope (`:18-53, :181-190`); the clamped seven-step editorial scale plus the retained 12–76 step scale for the Studio (`:76-97`); section tiers (`:124-126`); radius 2/4/8 px (`:132-134`); shadows `e1|e2|e3` (Studio and the two storefront exceptions); two easings and four durations (`:148-158`); `--shell-max`, `--shell-pad`, `--gutter-cure`; the RTL tracking override; and the global reduced-motion collapse (`:213-222`). `src/app/globals.css` (561 lines) bridges them through `@theme inline` and defines the composite utilities `u-micro · u-num · u-shell · u-prose · u-lede · section-major|standard|compact · rule`. `src/lib/utils.ts` teaches `twMerge` the custom groups (dropping them once broke every Button's ink).

Missing as tokens: **z-index** (twelve distinct hand-picked values in mounted storefront code — `z-[200]` skip link, `z-[70]` search, `z-[59]/[60]` drawer, `sf-grain` at 25 in `globals.css:477` — fourteen counting the two unmounted motion files, fifteen with the Studio palette's `z-[65]`) and **breakpoints** (Tailwind defaults plus two raw `@media (min-width: 1024px)`); the 8 px spacing steps are Tailwind's default scale rather than named tokens. Two motion vocabularies coexist: the Part 3.8 tokens and legacy aliases (`--ease-out` ×15, `--dur-micro` ×10, `--dur-enter` ×4, raw `duration-200` ×3 on the storefront (`site-header.tsx:517-518`, the pause chip) plus `duration-[450ms]`; the remaining raw durations live in the shadcn/Studio layer). `--dur-reveal` is consumed only inside `MeniscusImage`'s inline transition strings, never as a utility. Retokenising is mechanical (S). One inert attribute: `data-theme="light"` is set in seven files (the storefront root at `layout.tsx:69`, `dialog.tsx:74`) but no CSS rule targets it; only `.dark, [data-theme="navy"]` and `.studio-v2` re-point variables.

`src/lib/tokens.ts` is not design tokens — it is the SHA-256 reset/claim token helper. Do not touch it in a design pass.

### 4.2 Section themes (§50)

Only the light default and the navy dark scope exist. "Image" is what a dark hero with a scrim already is. "Accent" as a champagne-filled band is FORBIDDEN (§3.1: champagne is never a fill). "Editorial" is the `mineral → sand` surface shift. Dark bands are capped at three per page, never adjacent, enforced at save time by `describeArrangementProblem` and in CI by `redesign-audit.mjs`.

### 4.3 The forbidden list

Every effect below is named in §6, §12, §46 or §29 of the master prompt and is blocked by a rule the prompt itself says to honour. The inspiration-library research (§15) confirms none can be dropped in anyway: the libraries require the uninstalled `motion` package.

| Master-prompt ask | Rule | Where |
|---|---|---|
| Magnetic cursor / magnetic buttons | "No scale or lift on hover — colour and underline only" | contract §6, Part 14 buttons row; `magnetic-button.tsx` unmounted |
| Cursor follower / cursor spotlight / image trail | "Motion should communicate craftsmanship, not a technology demo"; CursorFollower deliberately unmounted as "decoration with no informational job" | Part 14 opening; `(v2)/layout.tsx:71-77` |
| Card tilt / perspective effects / 3D cards | Product hover is "image scale 1.02–1.04 or second-image wipe" (`REDESIGN.md:882`); §0 decision 2 (`:24`) rejects glassmorphism | Part 14 |
| Glassmorphism / progressive blur / blurred text entrances | "Blur in exactly one place: the sticky header on scroll" | contract §5, §3.5 |
| Glow, shimmer, gradient borders, shimmer buttons | No glow; no shimmer on skeletons; no cheap gradients | contract §6, §9 |
| Preloader / route curtains | "No animation may move or delay the LCP element" | Part 14 budgets; Preloader unmounted |
| Pinned or sticky scroll stages beyond two | "No scroll-jacking beyond the single material-story pin and the process steps" | Part 14 |
| Parallax beyond 40 px, mouse parallax on the hero | "Parallax capped at 20–40 px, hero and editorial images only" | contract §8 |
| Image fades, pixel/dissolve/shader reveals | "No image fades in. Every image reveal goes through `MeniscusImage`" | contract §8, §2.7 |
| Autoplay carousels, coverflow, card decks, a second marquee band | Reduced motion disables autoplay; Part 6 deleted the second homepage marquee (`REDESIGN.md:531`; one Marquee stays in the §4.1 inventory, unplaced); "Do NOT use a generic review carousel" (§18 itself) | Part 14; Part 6 |
| Liquid transitions (as an effect library) | The meniscus reveal *is* the liquid language; the pour-cure scrub is the one liquid sequence | §2.7 |
| Icon-led empty states, docks, icon-per-benefit proof rows | "Empty — no illustration, no icon"; "Never an icon per benefit" | contract §9, §7 |
| Rating inputs, avatar circles, fabricated logo clouds | No fabricated social proof | HARD RULE 3, §86 |
| Framer-motion / Magic UI / React Bits / SmoothUI installs, `npx shadcn add`, DaisyUI | `motion` absence is a recorded decision; ≤45 KB motion JS already spent on GSAP + Lenis; the shadcn CLI writes into the Studio-only `ui/` scope and the `@theme` layer where marquee keyframes already live; DaisyUI's base reset collides with `.studio-v2` | `docs/ui-master-plan-reconciliation.md` §1.3, §4; contract §8 |
| Per-block theme switch in the page builder (§32) | Grounds are derived by `resolveBlockGrounds` so the §3.1 violation is inexpressible; spacing / alignment / responsive switches are MISSING rather than forbidden, gated by "tokens are not the editor's to change" | `custom-blocks.ts:307-321`, `docs/studio-cms/06-governance.md` |
| Stats block (§32), for invented figures | The v3 redesign deleted "the undefendable stat row"; never fabricate (HARD RULE 3, `AGENTS.md:33-37`); "Do not re-seed" (`docs/studio-cms/09-spec-reconciliation.md:29`); a real number set in mono is allowed | `page.tsx` header |
| Theme settings in Site Settings (§31) | "Never invent colours, spacing or animation values"; NOT EDITABLE by design | `CLAUDE.md:7-8`, `docs/studio-cms/README.md:174-180` |

Not forbidden but not applicable: a light/dark theme preview (§65) — the storefront is a single light page with `data-theme="navy"` band scoping, so there is nothing to preview.

What Part 14 *does* allow and is not yet built: the hero headline rise (20–40 px) and the 1→1.04 poster drift over 4–8 s (both collide with "nothing moves the LCP" unless applied to the non-LCP layer — a spec ruling), broader use of `Reveal` on below-the-fold text, the lightbox FLIP (260 ms), a px-capped parallax on the bespoke band, and the ~18 patterns in §15.

### 4.4 Drift the gates do not catch

Seven `backdrop-blur` sites exist in storefront code against "exactly one": six mounted — `site-header.tsx:383` (the sanctioned one), `search-overlay.tsx:441` (arguably the header's), `dialog.tsx:45` (every lightbox scrim), `wishlist-button.tsx:41` (every catalogue card), `consent-gate.tsx:74` (every page when analytics is configured), `use-motion-paused.tsx:122` (the pause chip) — and `mobile-whatsapp-bar.tsx:43` unmounted. `share-buttons.tsx` pulls a Studio shadow onto the storefront. `scripts/redesign-audit.mjs` has no rule for `backdrop-filter` outside the header, `box-shadow` outside the two exceptions, hover transforms on buttons, or non-token durations; the champagne count is report-only. Adding computed-style rules is S and would make §3.5 literally true.

---

## 5. Studio

47 pages under `src/app/studio` (42 in the `(dashboard)` group, four auth pages, and the printable inquiry card), one shell (obsidian sidebar with champagne active rule, breadcrumb top bar, cmdk ⌘K palette, Radix Sheet mobile nav), 91 component files reusing a small primitive set (`PageHeader`/`EmptyState`, `StudioTableHead`/`StudioRow`, `BulkBar`, `usePagination`, `useSelection`, `ConfirmDeleteDialog`, `RichTextEditor`, `TranslationsSection`). Every mutation goes through the 31 action modules; 25 of them write `ActivityLog`. The Studio is English-only by design and consumes the shadcn semantic layer under the `.studio-v2` scope with its own `prefers-color-scheme: dark` block. `scripts/studio-audit.mjs` sweeps 30 authenticated routes at 1440 and 390 in CI.

### 5.1 §29 design-system checklist

| Item | Status | Evidence / gap |
|---|---|---|
| Sidebar | EXISTS | `sidebar.tsx` + `sidebar-collapse.tsx`; hidden below `lg`, so 640–1024 px tablets get the phone chrome instead of REDESIGN §12.6's collapsible rail (REFINE) |
| Command / search | PARTIAL | `command-palette.tsx`: "Go to" every sidebar destination + product jump; no create/run verbs, no testimonial/media search (§69) |
| Top bar · breadcrumbs · page title | EXISTS | `topbar.tsx`, `breadcrumbs.tsx`, `page-header.tsx` on 41 pages |
| Tabs | PARTIAL | No `ui/tabs.tsx`; ad-hoc link groups (`blog/page.tsx:37-48`, inquiries Table/Board), `aria-pressed` button groups (`product-list.tsx:284-290`) and one `role=tablist` (`translations-section.tsx:78`); no tabbed product editor, which REDESIGN §12.5 (`:830-831`) itself requires |
| Cards | PARTIAL | `StatCard`, `EmptyState`, media cards on `rounded-card` + `shadow-e1`; `form-section.tsx:14` on `rounded-2xl` + `shadow-sm` — two idioms |
| Tables / data tables | PARTIAL | `StudioTableHead`/`StudioRow`/`SortHead`/`Pagination`/`BulkBar`; sorting only on the four scraper tables; no column controls; mobile cards only on inquiries |
| Filters | EXISTS | Per-list `Select` + search (21 files); no shared `FilterBar` |
| Drawers | PARTIAL | Sheet for mobile nav and the scraper review detail only |
| Modals · forms · editors | EXISTS / PARTIAL | `ui/dialog`, `ConfirmDeleteDialog`, inline CRUD dialogs; RHF + zod on 7 forms; Tiptap editor uses `window.prompt` for links and images (`rich-text-editor.tsx:166,178`) and has no media-picker path although `media-picker.tsx` exists |
| Media browser · analytics cards · status badges · activity timeline | EXISTS / PARTIAL | `media-grid.tsx` + `media-picker.tsx`; `stat-card.tsx`, `scraper-kpis.tsx`; `ui/badge.tsx` has default/secondary/gold/outline only, semantic tones are inline overrides; `activity-panel.tsx` + `/studio/activity` |
| Notifications | PARTIAL | sonner toaster (unstyled by tokens: `grep sonner globals.css` = 0) + a bell that links to `/studio/activity` with a pending count; no centre, no persistence (§70) |

### 5.2 Dashboard (§30)

Every number on `/studio` is a live Prisma count (`page.tsx:129-178`); conversion shows `—` (`:335`). Shown: published/draft products, journal posts, pending reviews, subscribers, tiers, out-of-stock, inquiries. Not shown: collections, testimonials, portfolio, media assets, scraper records, import jobs — each is one `count()` (S). "Demo Products" has no schema concept; the only demo notion is the `title.startsWith("DEMO")` badge at `product-list.tsx:517`.

### 5.3 §31 content management per entity

| Entity | Status | Detail |
|---|---|---|
| Homepage | EXISTS | Hero copy `Home.hero.*` (13 keys) and every band's words via `/studio/site-copy`; pictures via `/studio/site-images` (mobile crop, focal point); 14 sections reorder/hide via `/studio/sections?page=home` (hero and closing pinned, material story pinned as the sanctioned scrub); featured products via `Product.featured`; collections from `Category.image`; testimonials/portfolio/journal from their own CRUD (first 3 by order / latest 3 PUBLISHED). CTA destinations and the six collection slugs (`COLLECTION_TILES`, `page.tsx:65-80`) are code constants by documented design (fixed arity, `docs/studio-cms/04 §4.7`) |
| Pages | PARTIAL | System pages: sections + copy + images; landing pages: title/SEO/ogImage/noindex/status/publishAt + six blocks; legal pages: Tiptap + SEO. No video on any block; `/studio/pages` offers "New page" but only `/privacy` and `/terms` have routes (REFINE) |
| Products | EXISTS | 17-file product form, 10 actions; untouched by this audit |
| Collections | DATA_GAP | `Category` has name/slug/description/image/order/translations; no SEO or visibility column (`schema.prisma:38-49`); products assigned from the product side |
| Testimonials · Journal · Portfolio · FAQ | EXISTS | Full CRUD (`actions/testimonials.ts`: upsert/delete/reorder; `blog.ts` 8 actions; `portfolio.ts` 3 + 921-line form; `faqs.ts`); Testimonial and Faq have no status, so every saved row is live |
| Process · Materials | MISSING (entities) / DECISION | No `Process` or `Material` model (`grep '^model'`). Both are fixed-arity copy + image slots (`Process.timeline` 6, `Home.how` 4, `CustomOrder.page.step1-3`, `LargeFormat.how` 4; the four material words live once in `Process.materials.*` and `/about` reuses them, with `about.material1-4` and `process.material1-4` image slots) editable in site-copy/site-images. Fixed arity is documented design: "repeaters are the fastest route to a broken luxury layout" (`docs/studio-cms/04 §4.7`). Row CRUD is a new registry-pattern surface under D2 (L) |
| Site settings | PARTIAL | Logo, favicon/app icon, tagline, announcement, contact, hours, WhatsApp, socials (no LinkedIn/X), care notes, SEO defaults with SERP preview, navigation (header, drawer, four footer columns). Theme settings FORBIDDEN by the governance doc |

### 5.4 §63 tables · §64 forms · §43–45 states

- **Tables.** Search on 12 lists (missing on testimonials, faqs, categories, users, pages, activity); filters everywhere; sort only on scraper tables; server pagination on products (50), inquiries (25), activity (50), client-side on 13; bulk selection + `BulkBar` on 15 lists with typed confirmation over 10; status badges; no column controls; 19 tables scroll horizontally on phones (products adds a sticky actions column below `xl`).
- **Forms.** Labels everywhere; zod on all 7 RHF forms and re-validated in every action (`helpers.ts runAction`); `FieldError` + `aria-describedby` in blog/portfolio/page/custom-page/settings and across the product form's section files (eight sites in `essentials`, `pricing-specs`, `seo-section`, `customization-fields`, `spec-fields`); `seo-form` shows one field error through `UploadUrlField` without the `FieldError` primitive; helper text exists on the product sections (`care-notes-section.tsx:25`, `print-production-section.tsx:57`, `pricing-specs-section.tsx:130,149`) and on one SEO field; success = toast only; loading via `saving` flags and `SubmitButton`; **autosave: none, and unsafe** — products, blog and portfolio save straight to the live row (no per-row draft column), so autosave would publish half-typed edits into 4,385 live products; `useUnsavedChangesGuard` is `beforeunload`-only on 7 forms (sidebar navigation loses edits silently) and absent from dialog-based CRUD.
- **Empty states.** 24 `EmptyState` call sites in 21 files across products, categories, media, inquiries, blog, portfolio, testimonials, faqs, pages, users, subscribers, activity and the scraper screens; only 5 pass an action CTA; landing pages (`custom-pages/page.tsx:54`) and sheet-import use inline text.
- **Loading.** One generic `animate-pulse` `loading.tsx` for all 44 screens, not at final dimensions (layout jump; contract §9 wants flat sand at exact size); `Suspense` = 0 in studio; no `useOptimistic`.
- **Errors.** `(dashboard)/error.tsx` has message + Try again + Back, `console.error` only, no reference code, pre-v3 classes; the auth tree has no boundary and falls to `global-error.tsx`.

### 5.5 Design lab (§33) — REBUILD or retire

`src/app/design-lab/page.tsx` (405 lines) is titled "Liquid Light × Midnight Gild", cites the superseded `DESIGN.md E6`, previews storefront buttons/badges/cards/forms/tabs/accordion/marquee/toast with mock data (including mock testimonials), 404s in production but **renders on Vercel preview deployments** (`page.tsx:79-84` gates on `NODE_ENV === "production"` and `VERCEL_ENV !== "preview"`), sits outside every gate, and is the sole consumer keeping `product-card.tsx`, `tabs.tsx`, `order-summary-preview.tsx` and `marquee.tsx` alive. None of §33's seven playgrounds exists (no prop controls, no sections, no motion catalogue, no themes, no device frames, no a11y view, no CMS content). Rebuilding it as seven playgrounds risks a second design system (§33 forbids one); the safe version renders only live v3 components with tokens, quarantines mock data, and joins the local audit run.

### 5.6 Studio verdict table (non-KEEP)

| Path | Verdict | Why |
|---|---|---|
| `(dashboard)/layout.tsx`, `topbar.tsx` | REFINE | `hidden lg:flex` — no tablet sidebar |
| `command-palette.tsx` | REFINE | Two groups only |
| `saved-views.tsx` | REFINE | `window.prompt` for names; only on products |
| `form-section.tsx` | REFINE | `rounded-2xl … shadow-sm` |
| `rich-text-editor.tsx` | REFINE | `window.prompt`; no media picker; no preview |
| `loading.tsx`, `error.tsx`, `not-found.tsx` | REFINE | Generic, pre-v3 vocabulary |
| `products/product-list.tsx` (699), `product-form.tsx` | REFINE | No sortable columns; one column, no tabs, one Save — REDESIGN §12.5 (`:830-831`) itself requires sortable product columns and a tabbed two-column editor with live preview, so these are binding-spec gaps, not only master-prompt asks |
| `blog/blog-post-form.tsx` (543) | REFINE | One column; preview is an external draft link |
| `portfolio/portfolio-list.tsx` | REFINE | Table where §12.5 asks a thumbnail grid |
| `scraper/*` (four files > 650 lines) | REFINE | Richest area and the only one with sort; completion toasts only while mounted; the runner loop is load-bearing (see §10) |
| `use-unsaved-changes-guard.ts` | REFINE | No in-app navigation interception |
| sonner Toaster | REFINE | No token styling |
| `design-lab/*`, `scripts/screenshot-lab.mjs` | REBUILD / retire | See §5.5 |
| 47 `shadow-sm`, 38 files with `rounded-xl/2xl` | REFINE | Mechanical sweep to `shadow-e1` / `rounded-card` |

---

## 6. Database

### 6.1 Models and statuses

35 models, 14 enums. Content entities and their status fields:

| Entity | Status field | Featured | Demo marker | Product link |
|---|---|---|---|---|
| `Product` | `ContentStatus` DRAFT · PUBLISHED | `featured` | none (title prefix convention) | self (`madeWith`/`usedIn`), `Inquiry[]` |
| `Portfolio` | `ContentStatus` | none | none | none (seed header says cases were drawn from Tier-1 rows; the link is not stored) |
| `BlogPost` | `ContentStatus` + `publishedAt` (display only; a future date is live immediately, unlike `CustomPage.isLive()`) | none | none | none (derived at render from `/product/` links in the body) |
| `CustomPage` | `ContentStatus` + `publishAt` resolved by `isLive()` | — | none | via `productGrid` block |
| `Testimonial` | **none** — every row is live | none | none | none |
| `Faq` | **none** | — | none | none |
| `Category` | none | — | none | `Product.categoryId`, `Portfolio.categoryId` |
| `Page` (legal) | none | — | none | — |

`ContentStatus` is `DRAFT | PUBLISHED` only; §66's REVIEW and ARCHIVED do not exist. Surface-level drafts (`SiteCopy.draftValue`, `SiteImage.draft`, `PageSection.draftOrder/draftVisible`) plus `ContentRevision` give copy, images and sections a draft → preview → publish → restore-to-draft cycle; `restoreRevision` exists and is ADMIN-only, but **no Studio screen lists or restores revisions**, so history accumulates unread.

`Testimonial` (`schema.prisma:340-351`): `id · name · location? · quote · rating(5) · avatarUrl? · order · translations?`. Six of §17's seventeen fields; none of the five statuses. Studio CRUD (`actions/testimonials.ts:34,96,126`) and the Bulk Import template (`src/lib/import/templates.ts:179-193`) mirror that shape. `getTestimonials()` has no `where`; the storefront band renders nothing when the table is empty (the honest behaviour). No seed writes a testimonial. Whether the production table holds any rows is UNVERIFIED (`audit/BASELINE.md` recorded 0 on 2026-08-20).

### 6.2 §67 relations

EXISTS: Product↔Category · Product↔Product (provenance) · Product↔Inquiry · Portfolio↔Category · Portfolio→PortfolioImage · BlogPost↔BlogCategory/Tag. MISSING: `Collection`, `Material`, `ProcessStep`, `RoomContext` models; `Testimonial.productId/portfolioId`; `Portfolio.productId` (or m:n); `BlogPost↔Product`; `BlogCategory↔Category` (separate taxonomies; the footer maps two by slug at `constants.ts:121,123`). Every one is a schema change and, under D2, a new surface follows the registry pattern; a `Collection` table would start empty (D5).

### 6.3 Migrations and seeds

44 migration directories, `20260705183035` → `20260831080000_brand_rivya_living_art`; grep for `DROP TABLE|DROP COLUMN|ALTER COLUMN|RENAME|DROP INDEX|TRUNCATE` returns nothing; five guarded `ALTER TYPE … ADD VALUE` enum extensions and three guarded data `UPDATE`s. Precedents to copy: `20260822162000_product_owner_touched` (constant-default column on the 4,385-row table, metadata-only on Postgres ≥ 11) and `inquiry_pipeline_statuses` (enum extension shape).

Deploy-time writers (`prisma/bootstrap.ts`, run by `npm run build`): scrape-source reconcile (:43-51), category-image reconcile (:56), blog-cover reconcile (:71, one-way), `seed-blogs.ts` once on an empty journal (:139), `import-tiers.ts` on every deploy (:150; publishes Tier 2–4 sheet rows as PUBLISHED at `import-tiers.ts:697` on the owner's recorded instruction), the bundled-image import gated on `BLOB_READ_WRITE_TOKEN` and an empty table, and `seed-portfolio-cases.ts` on every deploy (:305; 20 `case-*` rows, `status: "PUBLISHED"` at :488). The portfolio seed's header states "owner brief 2026-08-13, twenty real projects drawn from the owner's Tier-1 catalog rows"; that provenance is stated, not independently verifiable here, and the roadmap asks the owner to confirm it and to gate the seed on an empty table like the others.

`prisma/seed.ts` writes admin user, the 16-category tree (empty of products), FAQ topics, settings and legal stubs, once. It records (:16-17) that the temporary DEMO products were removed in "Phase 10". The `title.startsWith("DEMO")` exclusion survives at eight code sites (seven read-site exclusions and the Studio badge) and two tests (`src/lib/shop.test.ts:9`, `tests/db/product-where.test.ts:35`) and is applied inconsistently: `sitemap.ts` applies it to blog and portfolio, the blog and portfolio list pages do not, and four Product readers (`product/[slug]/opengraph-image.tsx:32`, `catalog-nav.ts:65`, `media-usages.ts:72`, `scraper/product-sheet-sync.ts:35`) apply nothing. `src/lib/scraper/purge.ts` (source-scoped cascade removal of sources, jobs, staged rows, sheet rows and catalog products by tier) is the closest precedent for §74's "remove demo data safely". That inconsistency is the exact failure mode an `isDemo` column would have if it were the sole safety filter.

### 6.4 Provenance columns already present (§39, §73)

`Product.importSource/importRef` (`@@unique`), `tier`, `sourceHash` (salted with `NORMALIZER_VERSION`), `ownerTouched`, `studioEditedAt` (written, never read), `confirmedAt/confirmedById`, `needsRewrite`; `ImportRun`, `DeletedImport` tombstones, `ActivityLog`; `ScrapedProduct.contentHash/sheetSyncStatus/sheetSyncedAt`; `ScrapeSource.lastSheetSyncAt`. Missing: spreadsheet id, tab id and row id as columns (see §10), a conflict record, and any demo marker.

---

## 7. CMS content layer

Verified against `docs/studio-cms/*` and the code: the eight surfaces, per-surface publish with `ContentRevision`, `/api/draft` preview behind the staff cookie with `DraftRibbon`, save-time guardrails (`describeArrangementProblem`, `describeBlockArrangementProblem`) that refuse §3.1 band-rhythm and single-`h1` violations because CI does not run when the owner presses Publish, and `isLive()` scheduling for landing pages resolved at read time (the cron only warms cache).

### 7.1 Page builder (§32): six blocks against twenty-two

EXISTS: `hero` · `imageCta` (Editorial split / Image + Text) · `productGrid` (manual | category | featured; renders nothing when empty) · `richText` (a blockquote renders as a display pull-quote, so Featured Quote is PARTIAL) · `faqPicker` · `finalCta`. MISSING and buildable like `productGrid` (S each): Collection Grid, Portfolio Grid, Journal Grid; Testimonial / Testimonial Grid (S, owner rows only). MISSING (M): Video Hero, Video Story (no video field on any block; needs a video picker, poster, and Part 14's LCP rule), Masonry / Bento / Fullscreen Gallery (multi-picker, `MeniscusImage`, `media-usages.ts` entry). MISSING (schema): Material Story (no entity; and a block cannot pin — the two sanctioned pins are the homepage material story and the process steps, `REDESIGN.md:895`), Process Timeline (no entity). DATA_GAP: Room Context (no imagery), Comparison (`BeforeAfter` exists; no row has `beforeImageUrl`). FORBIDDEN: Stats; a per-block theme switch (grounds are derived by `resolveBlockGrounds`, `custom-blocks.ts:167-171, :307-321`: "the owner does not choose these", so the §3.1 band-rhythm violation is inexpressible). MISSING but constrained: per-block spacing, alignment and responsive switches (the section tiers are tokens, `docs/studio-cms/06-governance.md`; exposing them is an owner decision) and video on any block. The catalogue size is a documented design decision (`docs/studio-cms/04 §4.8` "six types, not twenty-four"; `custom-blocks.test.ts:25` fails on a seventh so the decision is made out loud). Each added block is an owner decision, one at a time.

### 7.2 Journal (§24)

Featured lead, editorial grid, real category filters, tag filter, reading progress, TOC, pull quotes, share, tags, related posts, author-linked product aside, Article + BreadcrumbList JSON-LD all EXIST. Related collections: MISSING (no `BlogPost↔Category`). Related materials: DATA_GAP (no entity). Categories: six real ones (Gift Guides · Weddings & Preservation · 3D Printing · Trends & Inspiration · Care & Maintenance · Behind the Studio) versus the prompt's ten; the Studio can create and translate categories today, but `constants.ts:121,123` seeds footer links to two slugs. The 55 posts in `prisma/blog-content` are the real journal.

### 7.3 Preview (§65) and revisions (§71)

Preview EXISTS (draft mode on every resolver, Preview buttons on the sections board, publish bar, post/case/product forms, landing-page editor). Device-size frame MISSING (S: an `<iframe>` on `/api/draft?redirect`, same-origin cookie). Theme preview: nothing to preview. Activity log records who/what/when/action for 25 action modules; previous state exists only in `ContentRevision.payload` for surfaces and is shown nowhere (M for a per-surface revision list with restore-to-draft).

### 7.4 CMS verdicts

KEEP the whole layer. REFINE: `src/lib/testimonials.ts` (filter point for status/featured/product), `src/lib/activity.ts` (no previous state), `actions/pages.ts` + `page-form.tsx` (New page without a route), `docs/studio-cms/README.md` and `CLAUDE.md:118,122,345` (stale counts). Risks: any new section needs a `cureLabelKey` + `Home.cure.*` key or the cure line silently loses its tick; any new route must join `KNOWN_ROUTES` in `nav-menus.ts` or every nav item and block CTA pointing at it is refused; `SectionDef.dark` and `BlockDef.ground` are part of any design change because the guardrails read them.

---

## 8. Scraper and research pipeline (§36–37)

A mature pipeline: 115-entry source registry (`ScrapeSource`, seeded on deploy from `src/lib/scraper/seed-data.ts`), durable resumable `ScrapeJob` rows advanced two pages per invocation by a browser-side runner loop, three adapters (Shopify `products.json`, WooCommerce Store API, JSON-LD via sitemap discovery) behind `safeFetch` SSRF validation and a robots.txt gate, immutable `ScrapedProduct` staging keyed `(sourceKey, externalId)` with `contentHash` change detection, append-only `PriceHistory`, recorded `ValidationFailure` rows with a per-cause triage screen, a review queue, and promotion into `DRAFT + needsRewrite` catalog rows governed by `merge-policy.ts` (`ownerTouched` checked before `needsRewrite`). Ten vitest files (101 cases) cover the pure decision modules; the Sheets client, adapters, SSRF, robots and import parsing have none.

| §36 stage | Status | Implementation |
|---|---|---|
| SOURCE | EXISTS | `ScrapeSource`, add/bulk-add/verify/toggle/purge (`actions/scraper-sources.ts`), `/studio/scraper/sources` |
| DISCOVERY | PARTIAL | Platform fingerprinting (`fingerprint.ts`) and product-URL discovery from sitemaps; no category discovery, no scope selection (`docs/scraper-audit.md` §1 #4-5 still open) |
| EXTRACTION | EXISTS | Three adapters via `safeFetch` after robots (`scraper-jobs.ts:619`); the runner is the Studio tab — no server scheduler |
| NORMALIZATION | PARTIAL | HTML stripping, field mapping (`mapProductFields`), keyword category matcher (`category-map.ts`, 16 hardcoded slugs whose survival after the D5/D6 taxonomy is UNVERIFIED), sheet-side `cleanText`; no material/colour/unit aliases, no URL canonicaliser |
| DEDUPLICATION | EXISTS | In-page dedupe, `@@unique([sourceKey, externalId])`, `contentHash`, sheet twin check, `DeletedImport` tombstones; no cross-source near-duplicate detection |
| QUALITY CHECK | EXISTS | `validation.ts` + `ValidationFailure` + `/studio/scraper/quality` |
| REVIEW | EXISTS | `/studio/scraper/review`, `review-grid.tsx` (card grid, detail sheet, inline edit locked once IMPORTED) |
| APPROVAL | EXISTS | `ReviewStatus.APPROVED` (bulk) + catalog-level Confirm (`products.ts:717-773`) with named refusals |
| IMPORT | EXISTS | `importApprovedScraped` / `addScrapedToCatalog` → DRAFT + `needsRewrite`, ≤6 images mirrored, `decideMerge` |

"The scraper must never automatically publish": TRUE for the Studio scraper (`scraper-review.ts:370-372`, `products.ts:251-255` refuses publish while `needsRewrite`, `validate.ts` `SCRAPER_COLUMNS` guard). **NOT true for the deploy-time fill**: `prisma/import-tiers.ts:697` publishes Tier 2–4 sheet rows — other stores' scraped decks, ~4,000 products — as PUBLISHED on every deploy, on the owner's recorded instruction (`import-tiers.ts:38-41`) and as decision D6 assumes. Turning that into DRAFT to satisfy §36/§37 would unpublish most of the live catalogue. **DECISION.**

**Defects found (not in the prompt; fix in their own PRs):**

1. **A second, un-gated sheet push.** `continueScrapeJob` calls the gated `pushJobToSheet` behind `shouldPushOnComplete` (`scraper-jobs.ts:717-718`) and then, separately, the legacy `syncSourceToSheet` (`:379-404`, called at `:749`) which checks only `isSheetSyncConfigured()` and pushes every staged row of the source whenever a job staged or updated anything. The documented MANUAL default, "a FAILED job never auto-pushes" and the one-writer invariant in `sheet-push.ts` are all false in code while this remains. Fix: delete it and add a test asserting MANUAL + DONE → zero sheet writes (S). Verified by the scraper verifier: `finished` includes FAILED (`scraper-jobs.ts:662`) and the counts survive the failure (`:656-657`), so the un-gated push fires whenever a failed job staged anything. Note also that `syncTierToSheet` (`scraper-sheets.ts:287-330`) writes no sync state at all. *(Corrected 2026-09-03 while implementing D23: the claim that only the legacy call set `ScrapeJob.sheetSynced` was wrong — `sheet-push.ts:59-62` sets it inside the same transaction as the per-row status, so removing the legacy path costs the Studio's "synced" indicator nothing.)*
2. **`ScrapeSource.requestDelayMs` is never read** although `docs/scraper.md:79` says it works.
3. **`studioEditedAt` is written and never read** — no conflict detection exists (see §9).
4. **The Bulk Import wizard's product path upserts by slug without `decideMerge`** (`actions/import.ts:546-554`) — a third catalogue writer outside the owner-edit rule; only `needsRewrite` is preserved.
5. **No stale-RUNNING timeout** on the in-flight query (`:502`); the five-failure breaker only updates when `job.sourceId` is set (`:684`).
6. **Docs claim adapter tests exist** (`docs/source-adapters.md:61`); none do.

Research database (§37): `ScrapedProduct` already carries source, URL, title, category, materials, dimensions, price (min/max/currency), images, description, tags (`fields.tags`), first/last seen and `reviewStatus`; missing only a per-record `notes` column and any record type for non-product research. RESEARCH vs PRODUCTION is structural (`ScrapedProduct` vs `Product`) plus `Product.importSource` prefixes; no explicit marker on `Product`. `/studio/scraper/mapping` is a read-only report over catalog products, not the editable source→category mapping its title and `docs/studio-workflow.md` imply; the real mapping is the keyword table in code. A visible nine-stage rail over the existing data would satisfy "a professional workflow" without a new model (M).

Redesign hazards: the runner loop lives in `job-dashboard.tsx` and is duplicated in `source-detail.tsx`; any Studio redesign that unmounts them mid-run (tabs, route groups, Suspense) stops the scrape. `review-grid.tsx` uses a raw `<img>` for scraped hosts on purpose — `next/image` throws for hosts outside `remotePatterns`. `purge-tier.tsx` defaults `alsoCatalog` ON. Deleting `ScrapeJob` cascades `ScrapedProduct`.

---

## 9. Google Sheets (§38–39)

Two import paths: the deploy-time four-tier fill from committed `data/tiers/*.csv.gz` (never the live API; refreshed only by the manual, currently un-runnable `fetch-tiers.yml`), and the Studio Bulk Import wizard (`actions/import.ts`: sheet CSV link, CSV or XLSX upload, per-row validation, 500-row preview, create/update/error counts). Export: `syncWebsiteProductsToSheet`, `syncConfirmedToSheet`, Sheet1 bulk-upload rows, tier tabs via `pushJobToSheet`/`syncTierToSheet`, admin CSV at `/api/scraper/export`. Sheet writes go through one engine gated by the per-source `SheetSyncPolicy` (MANUAL default), rows mark `SYNC_PENDING` when Sheets is down, and deletion uses `deleteDimension` with the tab's numeric id in descending index order (`sheets.ts:313`, untested).

| §38 stage | Wizard | Tier fill |
|---|---|---|
| Import | EXISTS | EXISTS |
| Validation | EXISTS (per-row messages) | PARTIAL (rows lacking title/externalId/sourceKey dropped silently in `parseRow`, `import-tiers.ts:283-289`) |
| Normalization | EXISTS | EXISTS (`cleanText`, price swap, foreign-currency hiding, `needsRewrite` screen, `NORMALIZER_VERSION`) |
| Preview | EXISTS (500-row cap) | MISSING (`decideFillRun('PREVIEW')` exists in `fill-policy.ts:45`; nothing calls it; `/studio/sheet-import` has no Preview button) |
| Duplicate detection | EXISTS | EXISTS |
| Conflict resolution | **MISSING** — overwrites by slug | **MISSING** — `ownerTouched` rows are silently limited to availability + hash with no report of what the sheet wanted |
| Approval | EXISTS (operator presses Import) | MISSING (runs on deploy; gated only by `sheetFillEnabled/OnDeploy` and the create cap) |
| DB source of truth · export | EXISTS | EXISTS |

| §39 store | Status |
|---|---|
| Spreadsheet id | MISSING as a column — env only (`SCRAPE_SHEET_ID`/`SHEET_ID`), hardcoded in `sheet-import/page.tsx:28` and three times in `fetch-tiers.yml` |
| Sheet (tab) id | MISSING — titles are constants; the numeric gid is fetched per delete |
| Row id | MISSING, **and recommended to stay so** — rows are addressed by header key because the owner sorts the sheet; a stored index goes stale |
| Import timestamp · source · hash · last sync | EXISTS |
| Mapping | PARTIAL — header-name based, in code; no owner-editable mapping UI |
| Status | EXISTS (`sheetSyncStatus`, `sheetSyncError`, `sheetSynced`, `abortedReason`), with the caveat that `syncTierToSheet` writes no sync state at all and only `pushJobToSheet` sets per-row status |
| Conflicts | MISSING (same work item as conflict resolution) |
| Import history | PARTIAL — `ImportRun` for the fill (last 8 shown); push side is `ActivityLog` only |

---

## 10. Media and the Higgsfield pipeline (§34–35, §57–58)

### 10.1 Library (§34 DAM checklist)

EXISTS: images, alt text (inline edit, missing-alt filter, content-gaps count, publish gate), dimensions, file size, usage tracking (`findMediaUsageDetails` over 14 tables including staged slot halves and Tiptap bodies, DB-tested), unused sweep (batched, delete refuses in-use files), where-used line per card. PARTIAL: videos (accepted to 16 MB; no duration, no poster, not pickable — `listMediaForPicker` forces IMAGE), thumbnails (raw `<video preload=metadata>`), metadata (checksum/dimensions/LQIP/dominant colour captured; `blurDataUrl` and `dominantHex` read by nothing), categories (six fixed folders; no move), search (pathname/originalName/alt only), filters (folder/type/missing-alt/unused/AI; no date, size, orientation), recently uploaded (newest first, no date on the card, no sort), demo media (Provenance AI/BUNDLED + folder `site` is the only marker), where-used (labels, not links). MISSING: captions, tags, favourites — each a schema change. The listing pages client-side in fifties (`pagination.tsx:10`) over a 200-row cap with no server-side paging, while the importer and scraper create a `products` Media row per mirrored image.

### 10.2 Asset coverage against §35

`docs/media-v3-manifest.json`: 24 stills (collection tiles 6, material story 4, material macros 4, atmosphere 10) and 1 video, every one with a keeper, masters committed under `public/media/v3` (2.5 MB). `src/lib/media-v3-blur.json` holds 25 LQIPs imported only by a test — the §15.5 blur-up is generated and never rendered. Coverage:

| §35 category | Status |
|---|---|
| Furniture (dining, coffee, side, console, chair, bench) | MISSING — no manifest asset depicts furniture; the closest are `macro-teak` and `tile-live`. Allowed only as bench / formwork / in-progress concept shots (`site-images.ts:316`: "the WORK — the bench, the formwork, a pour — never a finished piece presented as a commission we delivered"); chairs and benches are claimed nowhere on the site |
| Large art (wall, abstract, ocean, landscape) | PARTIAL — abstract EXISTS (`hero-pour`, `login-backdrop`, `texture-band`); wall-in-situ, ocean, landscape MISSING (`largeFormat.k2` falls back to a slab-edge macro) |
| Interior (dining room, living room, gallery, hotel, office, residence) | MISSING — `studio-interior` is the studio; no slot or section renders a room; any AI interior must be captioned as a concept |
| Process (pouring, pigment mixing, wood prep, sanding, polishing, finishing, workshop) | PARTIAL — pouring EXISTS (`story-pour`, `hero-pour`, the video); pigment mixing and polishing PARTIAL (results, not actions); wood prep, sanding, finishing MISSING; two process slots are backed by mismatched masters (`process.step2` ← `print-head`, `process.step6` ← `tile-gift`) |
| Detail (texture, pigment, wood grain, edge, reflection, macro) | EXISTS — `texture-band`, `macro-epoxy`, `macro-teak`, `macro-pigment`, `macro-flower`, `story-polish`, `story-gild` |
| Video (rotation, camera move, workshop, pour, macro, room reveal) | PARTIAL — pour EXISTS (`process-pour`, 10 s, MP4+WebM+poster); all others MISSING; no bundled hero loop although `HeroMedia` supports `SiteSettings.heroVideoUrl` |

No 9:16 mobile crop exists for any of the twelve wide image slots (`SITE_IMAGE_DEFAULT_REFS` sets `mobileUrl: null`), so every hero is centre-cropped on phones from a fresh database — and half of them could not use one anyway: the `<picture>` mobile source and the focal point render only through `SlotImage` on six slots (`about.hero`, `largeFormat.hero`, `home.bespoke`, `portfolio.hero`, `workshops.hero`, `workshops.private`), while `home.hero`, `process.heroPoster`, the three `shop.group.*` banners and `studio.login` reach `HeroMedia` or `getSiteImage()` as bare strings, and `MeniscusImage`'s `focal` prop has no call site. A `HeroMedia` change precedes any SET E crop. `home.maker` and `about.maker` are backed by `hands-polish.webp`, which `site-images-import.test.ts:45-53` records is itself a generation — REDESIGN §15.2 says the maker is never AI; only the owner can close this.

### 10.3 Generation plan (nothing generated)

Forty items in six sets, every prompt taking the manifest's `promptSuffix` (palette `#08283A/#080A0E/#164E6B/#B89B63`, single soft key, matte, no text/logos) plus REDESIGN's "no faces" clause, which the manifest suffix omits; videos take the `REDESIGN.md:939` video suffix (the manifest has no video-suffix key); one shared prefix per set so each reads as one session, each job recorded as a manifest entry, masters landing in `public/media/v3` as AVIF with LQIP, provenance AI, **never attached to a Product, Portfolio or Testimonial row**. Order of value: D → A1/A2/B7 → E22 → F34 → B8/B9 → C and F35–38 only after owner decisions.

- **SET A · bench-concepts** (§15.2-safe furniture as work in progress): A1 `bench-dining-slab` 16:9 → `largeFormat.hero` (un-shares it from `contact.hero`); A2 `bench-coffee-top` 4:5 → `largeFormat.k1`; A3 `bench-side-top` 4:5 → commission tile; A4 `bench-console-plank` 16:9 → `home.bespoke` alternative; A5 `bench-chair-seat`, A6 `bench-seat-plank` 4:5 — **only if the owner confirms seating is commissionable**.
- **SET B · large-art**: B7 `art-wall-panel` 4:5 → `largeFormat.k2`; B8 `art-ocean-layers` 3:2 → `shop.editorialBreak` / §10 band; B9 `art-landscape-horizon` 21:9 → `portfolio.hero` (un-shares from `about.hero`); B10 `art-abstract-square` 1:1 → material tile.
- **SET C · concept-rooms** (only after a §14 section and its slot keys exist; captions must say "concept"): C11 dining, C12 living, C13 gallery 21:9, C14 hotel lobby, C15 office, C16 residence hall, each 16:9, one resin surface as the single point of colour.
- **SET D · process-actions** (prefix identical to the material-story series): D17 `process-wood-prep` → `process.step2`; D18 `process-pigment-mix` → `about.material3.image`; D19 `process-sanding` → `process.step5`; D20 `process-polishing` → `process.step6`; D21 `process-finishing` → `about.chapter4`.
- **SET E · mobile-crops** (reframe, no new generation): E22 `hero-pour` → 9:16 for `home.hero.mobileUrl`; E23–33 the other nine 16:9 heroes and two 21:9 bands → 9:16 or 4:5 (needs a `mobileFallback` registry field).
- **SET F · video** (`generate_video` from the approved still, upscale, 6–16 s loops, MP4 H.264 + WebM VP9 ≤ 2.5 MB, poster from frame 0 via `scripts/media-v3-video-fetch.mjs`): F34 `video-hero-pour` → `SiteSettings.heroVideoUrl`; F35 `video-slab-turn` (concept caveat); F36 `video-workshop-dolly` → `workshops.hero`; F37 `video-macro-gild`; F38 `video-room-reveal` (only with SET C); F39 `video-login-loop`; F40 `video-print-head`.

Constraints: the Higgsfield CDN (`d8j0ntlcm91z4.cloudfront.net`) answers 403 to the session proxy (`CLAUDE.md:86`), so job ids are recorded from a session and `scripts/media-v3-fetch.mjs` runs on an ordinary machine; results are never hot-linked (host not in `remotePatterns`); Higgsfield credit balance is UNVERIFIED.

### 10.4 Media verdicts

KEEP the architecture (`actions/media.ts`, `media-usages.ts`, `storage.ts`, `media-ingest.ts`, `site-images*.ts`). REFINE `media/page.tsx` and `media-grid.tsx` (pagination, sort, date/size filters, detail drawer, drag-drop, move folder, video poster), `media-picker.tsx` (image-only), `media-v3-blur.json` (wire into `SlotImage` and `MeniscusImage` keyed on the **resolved** URL — `bootstrap.ts` repoints slots to random-suffixed Blob URLs on a fresh deploy, so a slot-keyed join silently misses in production), the 55 blog and 5 category covers (pre-v3 palette). REMOVE (owner approval): `src/lib/media.ts` (Cloudinary constants, zero importers, D3 retired them), 13 loose zero-reference files under `public/media/` (4.0 MB), `public/media/v2/`, six unreferenced `v6` files, `scripts/mirror-v3-media.mjs` + `v3-media.json`, `mirror-v6-media.mjs` + `v6-media.json`, `mirror-generated-images.mjs`, and the workflows `mirror-images.yml` (its own header says safe once `public/` is committed; hard-asserts 5/55 files), `mirror-v3-media.yml`, `mirror-v6-media.yml`, `fetch-media-v3.yml`, `fetch-media-v3-video.yml`, `fetch-assets.yml`. Keep `public/images/*` (the one-way blog-cover reconcile writes those paths) and the four v6 category seeds (asserted on disk by `bundled-media.test.ts`). Delete `mirror-images.yml` by exact path only: `src/app/api/cron/mirror-images/route.ts` is a live production cron with a near-identical name. REPLACE `hands-polish.webp` behind the maker slots — owner photograph only.

---

## 11. i18n, SEO, accessibility, performance, tests, CI

**i18n (§54).** `src/i18n/config.ts` lists exactly the nine languages (en unprefixed); Arabic RTL via `html dir`, a `tokens.css` override, 29 `rtl:` variants across 19 files and four JS direction inversions (lightbox, gallery, cure line, drawer); `getMessageFallback` returns English. Remaining hardcoded English, which makes §54 PARTIAL rather than EXISTS: JSON-LD breadcrumb names in `blog/[slug]:402-407`, `portfolio/[slug]:501-506`, `shop/[category]:303-305`, `large-resin-art:125`; mounted `aria-label`s in `cure-line.tsx:160` ("Page sections"), `customization-controls.tsx:670,688` ("Decrease/Increase quantity"), `rating-stars.tsx:27`; `model-viewer.tsx:61`; and two Organization/LocalBusiness literals no Setting controls (`[locale]/layout.tsx:45` `availableLanguage ['en','hi']`, `:59` `priceRange`). Physical-direction residue beyond the `rtl:` variants: `site-header.tsx:610` (drawer `slide-in-from-right` with no `rtl:` twin), `shop-explorer.tsx:561` (filter drawer, zero `rtl:` variants in the file), `origin-left` at `site-header.tsx:352` and `cure-line.tsx:237` (the repo idiom is `origin-left rtl:origin-right`, `reading-progress.tsx:61`), and physical padding in `ui/select.tsx:111,116` consumed by the storefront order panel. **The gate that does not exist:** `scripts/i18n-missing.mjs` compares presence and equality only (`:44-52`); a changed English value with eight stale translations passes every gate (`AGENTS.md:166-169`). The master prompt's copy rewrite would ship stale translations silently unless a stale-translation mode is added first (S) — this is the single most important gate to add before Phase 3.

**SEO (§55).** All 21 storefront routes export `generateMetadata` with title, description, per-locale canonical and reciprocal hreflang (noindex routes canonical-only); Organization/LocalBusiness/WebSite JSON-LD from Site Settings in the locale layout; Product+AggregateOffer, Article, VisualArtwork, CollectionPage, FAQPage, Service and BreadcrumbList per route. Gaps: the Twitter block sets only the card type; `og:url` unlocalised on detail pages; the four `opengraph-image.tsx` routes and `manifest.ts` paint the v2 palette via `brand-colors.ts` with Georgia standing in for a retired face — every WhatsApp share preview is off-brand; no Review/AggregateRating emitter (DATA_GAP until owner-approved testimonial rows carry the fields); `SEO_GUIDE.md` quotes the retired default title.

**Accessibility (§53).** Automated: axe (wcag2a/2aa/21a/21aa) at 1440 and 390 plus six RTL routes, one-`h1`/heading-order/alt/ellipsis rules, Studio unnamed-control and headless-table checks, skip link, reduced-motion collapse, `MotionPauseToggle`. Not automated: keyboard path and focus return for drawer/search/mega-menu/lightbox (`Esc` handling exists); 44×44 touch targets (contract §10) — `studio-audit.mjs:213-238` measures targets under 24×24 and prints them, nothing measures the storefront and nothing fails.

**Build-time database totality (found on this PR's own Vercel preview).** The preview build for `04cbd9a` failed with Prisma `P2037 TooManyConnections` ("too many connections for role `prisma_migration`") while prerendering `/de/privacy` and `/sitemap.xml`; the two previous heads with identical code had deployed, and the next head (`61a67f0`, again docs-only) deployed successfully at 18:12 UTC, so the failure is intermittent and load-dependent rather than a property of the code. Three reads are not total, unlike the CMS resolvers: `privacy/page.tsx:55` and `terms/page.tsx:55` (`db.page.findUnique` with no fallback) and `sitemap.ts:60-82` (five `findMany` with no `catch`), so a transient database error at build time fails the whole deploy. Contributing: `next build` prerenders in parallel workers, each with its own pg pool (`db.ts` caps 5 sockets per client), and the Vercel environment's runtime `DATABASE_URL` carries the `prisma_migration` role rather than the pooled endpoint `db.ts` is written for. Fix (Phase 1a): wrap the three reads like `readCopyRows` in `site-copy-server.ts:57`, and confine the direct URL to `DATABASE_URL_UNPOOLED` (owner action in the Vercel project).

**Performance (§56).** `next/font` swap with selective preload and per-script Noto in a separate chunk; AVIF/WebP ladder with a three-host `remotePatterns` allowlist and an `isOptimizableImageSrc` quota guard; priority poster; `sizes` on 17 of 19 storefront `Image` sites; GSAP behind `await import()` in six components; client-gated hero video. Open: CSP is report-only with `script-src 'unsafe-inline'` and `img-src https:` (`next.config.ts`); the ≤45 KB motion budget has no automated check; `audit/lh-summary.json` is a stale sandbox baseline against pre-rename routes (`audit-lighthouse.mjs` targets a PLA-filament PDP and a 3D-printing post that no longer lead).

**Tests (§78–79).** 36 pure-function vitest files (375 tests) + 2 database-backed files (`tests/db/`, run by `npm run test:db` in CI's build job). Zero component tests, zero Server Action tests, no `@playwright/test` suite: confirmed (no `.test.tsx`, no testing-library, no test imports `@/actions`). **CI's database is not empty**, contrary to the comments in `ci.yml:88-91` ("there is no catalogue") and `CLAUDE.md:217`: `bootstrap.ts:150` runs `import-tiers.ts` with no CI or environment guard, `readTab` (`import-tiers.ts:129-133`) reads the git-tracked `data/tiers/*.csv.gz`, and the default fill policy imports the tier snapshot (~4,385 rows) plus the 20 portfolio cases into `rivya_ci` on every CI build. The detail routes and the E2E smoke are therefore runnable in CI today; keeping them out is a choice the roadmap revisits in Phases 16–17. `scripts/e2e-smoke.mjs` runs 10 checks against a running populated server (not yet in CI): it covers navigation count, product detail `h1` + `wa.me` presence, the WhatsApp link and the Studio login gate — 4 of §78's 16 asks. It depends on DOM contracts (`data-slot="sf-announcement-bar"`, `sf-bottom-bar` with 5 `li`, `sf-wa-fab`, header nav count === 4, `main h3` as card names) that a redesign must preserve or update in the same PR, never delete (§79). The unwired `verify-phase2/3.mjs` are the only automated coverage of the order submit path and should be salvaged into the smoke.

**CI (§79, §88).** `ci.yml`: `checks` (npm ci → typecheck → lint → copy:check → i18n-missing → test) and `build` (Postgres 16 service → real `npm run build` → `test:db` → Chromium → `next start` → redesign-audit + a11y-audit over 13 routes at 1440/390 + 6 Arabic routes → studio-audit over 30 routes → Lighthouse perf ≥ 85, a11y ≥ 95). It executes (see §0: run #71 on PR #29, checks job green on the runner). D4's evidence habit still applies to what CI does not sweep yet: the detail routes (`/product`, `/blog`, `/portfolio`, `/p`), the E2E smoke, and any width other than 1440/390 — all of which CI could sweep, because its database holds the tier catalogue (above). Port drift confirmed: 12 scripts default to `:3111`, 5 to `:3000`, three `verify-*` scripts hard-code `:3111`; CI forces `:3000`. `CLAUDE.md:40,215` say "12 public routes"; `ci.yml:95` lists 13.

Other workflows: `fetch-tiers.yml` hard-codes the Sheet id three times and the gid four times; the six mirror/fetch workflows carry `contents:write` and are candidates for deletion (§10.4).

---

## 12. The testimonial gap (§17–19, §42, §76, Phase 9)

### 12.1 Field by field

| §17 field | Status | Note |
|---|---|---|
| customer name | EXISTS | `name` (never translated) |
| designation | MISSING | |
| location | EXISTS | `location?` (translatable) |
| testimonial text | EXISTS | `quote` (translatable) |
| rating | EXISTS | `rating` 1–5, default 5 |
| customer image | EXISTS | `avatarUrl?` — now rendered by `testimonial-card.tsx:13-20` (MKT-006 closed) |
| product reference | MISSING | no `productId` |
| project reference | MISSING | no `portfolioId` |
| category | MISSING | |
| date | MISSING | no `createdAt`/`givenAt` |
| featured flag | MISSING | curation is `order` only |
| published flag / status | MISSING | every row is live |
| demo flag | MISSING | |
| sort order | EXISTS | `order` |
| language | PARTIAL | per-locale `translations` overrides, no source-language field |
| media (installation image, video) | MISSING | |
| internal notes | MISSING | |
| purchase type, product title, permission status, verification status | MISSING | |
| statuses DRAFT · PENDING_REVIEW · VERIFIED · PUBLISHED · ARCHIVED | MISSING | no enum |

### 12.2 UI modes (§18)

| Mode | Status | Detail |
|---|---|---|
| A. Editorial quote | PARTIAL | `TestimonialCard` is a sand card with a `text-20` blockquote; an `editorial` variant on the same component (display type, existing columns) is S |
| B. Product-linked | MISSING (schema) | no `productId`; the PDP shows the global first N (`product/[slug]/page.tsx:992-1016`) |
| C. Video | MISSING (schema) | no media column; component would follow `HeroMedia` (poster, touch and reduced-motion gates) |
| D. Masonry wall | MISSING (M) | all three consumers render a uniform `md:grid-cols-3`; a CSS-columns wall like `lightbox-gallery.tsx` is buildable; "varying sizes" needs `featured` to be non-arbitrary |
| E. Featured cinematic | MISSING (schema, S) | no `featured`; buildable as "first row in studio order" if the owner accepts that rule |
| F. PDP testimonials connected to the product | MISSING (schema) | as B |
| "Do NOT use a generic review carousel" | EXISTS | the v7 carousel was retired in Phase 7; none remains |

Render sites today: homepage `words` band (`page.tsx:614`), `/custom-order` proof band (`:474`), PDP (`product/[slug]/page.tsx:992`); each returns `null` when the table is empty — the right behaviour for social proof under HARD RULE 3's "render nothing and say so" (`AGENTS.md:38-39`), though contract §9 (`docs/redesign-contract.md:136-142`) would otherwise ask every list for a conditionally rendered empty state — and the same first three rows appear on all three. All five testimonial files are unchanged since the baseline import (`32f21a6`). The Studio offers list, create, edit, bulk delete, up/down reorder and per-locale translation in a modal; no search, filter, sort or status. Two live defects found by the dedicated reader: `revalidatePublic("testimonial")` purges only `/` (`src/actions/helpers.ts:137-139`) while PDPs cache for 86,400 s, so a withdrawn testimonial keeps appearing on product pages for a day; and `getTestimonials()` has no `try/catch`, so unlike the total CMS resolvers a database error takes the homepage down rather than dropping the band. The champagne breach through `RatingStars` is recorded in §3.2. Mode D is also gated by the spec itself: `REDESIGN.md:32` deferred a "verified review wall / UGC masonry" until real content exists. Mode E cannot be a dark band on the homepage, which already sits at the three-dark-band ceiling (`page-sections.ts:160-162`).

### 12.3 The additive migration this needs (proposal, not applied)

One migration, no rewrite of existing rows, every column nullable or defaulted:

```
enum TestimonialStatus { DRAFT PENDING_REVIEW VERIFIED PUBLISHED ARCHIVED }
model Testimonial {
  … existing eight columns unchanged …
  status        TestimonialStatus @default(DRAFT)   // existing rows are back-filled to PUBLISHED in the same migration, because they are live today
  featured      Boolean  @default(false)
  isDemo        Boolean  @default(false)
  designation   String?
  category      String?                              // free text or a small enum; the owner's vocabulary
  givenAt       DateTime?
  language      String?                              // source language of `quote`
  productId     String?  → Product   (onDelete: SetNull)
  portfolioId   String?  → Portfolio (onDelete: SetNull)
  productTitle  String?                              // for pieces not in the catalogue (commission-led, D5); translatable
  purchaseType  String?                              // free text; no invented taxonomy
  mediaId       String?                              // library pointer for avatarUrl (pattern: SiteImage.mediaId) so alt/provenance/blur come from Media
  installationImageUrl String? / installationMediaId String?   // owner photograph only (§15.2) — media-usages.ts in the same commit
  videoUrl      String? / videoPosterUrl String?     // precedent Portfolio.videoUrl; media-usages.ts in the same commit
  internalNotes String?  @db.Text                    // never selected by getTestimonials
  permissionStatus PermissionStatus @default(UNKNOWN) // enum UNKNOWN REQUESTED GRANTED DECLINED; publish refuses unless GRANTED (guardrails refuse)
  verifiedAt DateTime? / verifiedById String?        // owner-attested only; never an automated badge
  createdAt DateTime @default(now()) / updatedAt DateTime @default(now()) @updatedAt   // defaults required or the ALTER fails on existing rows
  @@index([status, featured, order]) @@index([isDemo])
}
```

Paired changes in the same PR, in the order that keeps the site safe: (1) migration with the PUBLISHED back-fill, the gated resolver `where: { status: "PUBLISHED", isDemo: false }` with optional `productId`/`featured` filters, a `try/catch` so the resolver is total like the others, and a `tests/db` case for the gate; (2) Studio fields, status filter, product/portfolio pickers (the provenance product search already exists), a form that is a page rather than the current modal (twenty fields and two pickers do not fit it); (3) `revalidatePublic("testimonial")` widened to the PDP and `/custom-order` tags; (4) the CSV/Sheets importer (`actions/import.ts:664-703`) defaulting new rows to DRAFT, or a bulk import publishes fifty unreviewed quotes at once; (5) `src/lib/media-usages.ts` walks every new URL column and `tests/db/media-usages.test.ts` extends; (6) a `Testimonials` i18n namespace in nine locales; `TRANSLATABLE_FIELDS.testimonial` gains `designation` and `productTitle`; (7) the UI modes. Category is a decision: a `Category` foreign key reuses the real 16-category tree, but the prompt's list (dining table, wedding preservation…) does not map onto it one to one. The PDP needs a fallback policy when a product has no linked testimonial (category-level rows, today's global rows, or hide). The back-fill decision (existing rows → PUBLISHED) is the one the owner must confirm, because it is what keeps the live site unchanged on deploy.

### 12.4 Demo testimonials (§19, §42, §76)

Forty "Demo Customer NNN" rows with deterministic ids (`demo-testimonial-001…040`, so the loader is idempotent) — ten categories × four; eight one-liners, eight long quotes (one at the 2,000-character action limit); ratings spread across 1–5 rather than all fives; a quarter with images, a few with video; featured, draft, pending, verified, published and archived states; product-linked and project-linked cases only against demo Product and Portfolio rows (they cannot point at real ones) — are straightforward fixture data **once the columns exist**. They are fabricated social proof, which HARD RULE 3 forbids in the production database even as DRAFT. See §13 for the isolation design. Two gates, not one, must stand between a demo row and a visitor: `status = PUBLISHED` AND `isDemo = false` in every public read, and the seed refusing any production host.

---

## 13. The demo-data / Content Lab gap (§3, §40–42, §74–75, Phase 15)

Nothing today satisfies either branch of §3. The prompt's own fallback ("if the current database does not support this safely, create a development-only seed/fixture/Content Lab mechanism") is the branch this repository must take, because:

- `npm run build` runs `bootstrap.ts` against the production `DATABASE_URL` (`package.json:7`, `src/lib/db.ts:25`); anything wired near it is production.
- Roughly 55 public read sites would each need a filter; the DEMO-prefix precedent already shows the leak (`sitemap.ts` filters blog and portfolio, their list pages do not).
- `import-tiers.ts` demotes rows that fall out of the cap window; a demo Product must carry `importSource != 'sheet:*'` to survive it (`:793-802`).
- The order flow (`actions/order.ts:223`), search, catalog-nav counts, the mirror cron and the sitemap all read `Product`.
- Testimonial and Faq have no natural key, so removal needs a marker column or a deterministic id prefix.

Three designs were evaluated:

| Design | What it is | Verdict |
|---|---|---|
| 1. `isDemo` column on every content table + a filter in every public read + a Content Lab toggle | Rows live in production, flagged | **Rejected as the sole mechanism**: one missed `where` publishes fabricated content on a live store; it also seeds HARD RULE 3 content into the production database |
| 2. Separate `DEMO_DATABASE_URL` / runtime switch | Second `PrismaClient` + request-scoped switch in `db.ts` | **Rejected as a runtime switch** (design 1 in disguise, on the production deployment); **accepted as an environment**: a Vercel preview + Neon branch whose `DATABASE_URL` is the branch |
| 3. Guarded `seed:demo` fixture loader | `npm run seed:demo` / `seed:demo -- --remove`, idempotent on `importSource='demo'` + `importRef`, `slug` and an id prefix; refuses to run when `NODE_ENV=production`, `VERCEL_ENV=production`, or the `DATABASE_URL` host is not localhost / a CI service / an explicitly allow-listed branch (precedent `scripts/ci-staff-user.ts:30-36`); never referenced by `bootstrap.ts` | **Recommended**, together with an additive `isDemo` marker used for badging, removal and defence in depth — never as the only gate |

What it yields: the Content Lab is a *database*, not a Studio route — local dev, CI's `rivya_ci`, and a Neon branch behind a Vercel preview. The Studio gains demo badges and filters on every list, a "Content Lab" page that shows the loader's state and the counts, and the dashboard's "Demo products" tile reads the marker. The 100 products / 30 articles / 30–50 testimonials / 30–50 records per entity are fixture files under `prisma/fixtures/demo/` with edge cases by construction (short and long names, missing and multiple images, every status, every rating, multilingual overrides). The furniture-topic demo articles and furniture demo products must be labelled concept content: D5 says the studio sells no furniture, and a preview database that reads like a furniture store is how a false positioning leaks into copy.

Open with the owner: whether the `isDemo` column may be added at all (schema change under §1.1), whether a Neon branch is acceptable as the lab environment, whether any DEMO-titled products still exist in production (if not, the prefix convention retires in the same change that adds the column, and `shop.test.ts:9` / `product-where.test.ts:35` move with it), and whether `ContentStatus` gains REVIEW and ARCHIVED for all four entities or only the new Testimonial enum.

---

## 14. Inspiration libraries (§5, §84)

All eleven libraries were fetched (site, GitHub or registry JSON). Summary:

| Library | Runtime | Licence | Reached via | Patterns judged |
|---|---|---|---|---|
| Magic UI | 31 of 75 registry items need `motion`; 36 CSS/React-only; cobe/canvas-confetti/react-tweet for the rest | MIT | GitHub + registry.json (site egress-blocked) | 12: 1 allowed · 7 adapt · 4 forbidden |
| SmoothUI | `motion` ^12 for 144 of 167 packages | MIT | GitHub | 12: 9 adapt · 3 forbidden |
| React Bits | Mixed per component: `motion`, GSAP, OGL (WebGL), matter-js | MIT + Commons Clause (embed, never redistribute as a kit) | GitHub + registry (site blocked) | 12: 7 adapt · 5 forbidden |
| Skiper UI | framer-motion in ~85 % | Free tier **requires attribution**; Pro items unread | site | 12: 1 allowed · 6 adapt · 5 forbidden |
| Vengeance UI | framer-motion 29/270, GSAP 10, three.js | MIT, but ships placeholder copy, Unsplash photos and third-party logos | shallow clone (site does not resolve) | 12: 1 allowed · 7 adapt · 4 forbidden |
| Unlumen UI | `motion` on 22 of 30 | MIT | GitHub | 12: 5 adapt · 7 forbidden |
| 21st.dev | per component, predominantly `motion` | MIT platform; per-component licence varies | site | 12: 8 adapt · 4 forbidden |
| AnimMasterLib | GSAP 3.12–3.15 + Lenis + vanilla | **Unstated / paid pack, no readable licence** | GitHub precursors (site blocked) | 12: 1 allowed · 8 adapt · 3 forbidden |
| DaisyUI 5.7 | Tailwind plugin, CSS at runtime | MIT | npm + site | 12: 1 allowed · 8 adapt · 3 forbidden |
| OriginKit | framer-motion 16/50; source behind an API key | MIT catalogue; source licence unverified | GitHub catalogue | 12: 7 adapt · 5 forbidden |
| ThreeUI | three.js / WebGL / canvas | MIT | site | 12: 4 adapt · 8 forbidden |

**Dependency policy (adopted by the roadmap): install none of them.** `motion`/framer-motion absence is a recorded decision (reconciliation §1.3) and the ≤45 KB motion budget is spent; `@gsap/react` would defeat the post-guard dynamic import in all eight motion files; `npx shadcn add` / `smoothui-cli` / jsrepo write into the Studio-only `ui/` scope and the `@theme` layer where `globals.css:144-151` already defines the marquee keyframes; DaisyUI's base reset collides with `.studio-v2`. Patterns are ported by hand: JS-driven ones into `src/components/motion/` behind `usePrefersReducedMotion` / `useIsTouch` then `await import('@/lib/gsap')`, CSS-first ones into `storefront/` or `globals.css`, tokens only, logical properties, next-intl for any string. Skiper-derived code needs an attribution line in the file header; AnimMaster paid-pack code must not enter the repo until its terms are read.

**Shortlist (18, ranked by value under the contract; full implementation notes in the research record):**

| # | Pattern | Source idea | Section | Target | Route | Effort |
|---|---|---|---|---|---|---|
| 1 | Text/card reveal on every below-the-fold band (16–24 px, 350 ms, once) | AnimMaster watcher, Magic UI BlurFade (without the blur), SmoothUI mask-reveal | §46, §11, §14, §24 | `motion/reveal.tsx` (currently mounted only on `/search` and `/whatsapp-order`) → homepage bands | existing component; register GSAP CustomEase (~2 KB) so tweens share the house curve | S |
| 2 | Hero eyebrow → h1 → lede → CTA stagger, 20–40 px rise | SmoothUI, React Bits SplitText, Unlumen Text Reveal | §6/8 | `h1#hero-heading` on home, process, custom-order, large-format | CSS keyframe `sf-hero-rise` with 80 ms delays; `motion-reduce:animate-none`; never the LCP image | S |
| 3 | Poster drift 1 → 1.04 over 6 s | AnimMaster hero, 21st hero | §6/8 | `hero-media.tsx` wrapper, never the `<img>` | CSS keyframe on the wrapper; suppressed while the ambient video plays | S |
| 4 | Lightbox FLIP from thumbnail rect, 260 ms; remove the dialog's blur | Vengeance expandable bento (layoutId idea), Magic UI hero-video-dialog | §10, §20 | `product/gallery.tsx`, `portfolio/lightbox-gallery.tsx`, `storefront/dialog.tsx` | measure rects, write `--flip-*` custom properties, one transform transition | M |
| 5 | Native scroll-snap rails with prev/next and mono counter | DaisyUI carousel, React Bits Carousel (layout only) | §10, §11 mobile, §23 related rail | collections band < 768 px, large-format gallery, PDP related | `snap-x snap-mandatory`, `CarouselNav` calling `scrollBy`; no autoplay | M |
| 6 | Asymmetric bento for the six collection tiles | Magic UI BentoGrid, 21st Bento (layout only) | §11 | homepage `collections` band, `collection-card.tsx` ratio prop | 12-col grid, lead tile `lg:col-span-8 lg:row-span-2`; hairlines, no shadows | M |
| 7 | Expanding-strip accordion gallery for the four material macros | React Bits AccordionGallery, Skiper HoverExpand | §12 | `/process` materials band → new `storefront/accordion-gallery.tsx` | `flex-grow` transition on `[data-active]`, `:hover`/`:focus-within`, `aria-expanded` buttons | M |
| 8 | Product image scale 1.03 on hover where no second image exists; retire the lift+shadow card | 21st hover card, Unlumen tilt stripped to scale | §23 | `catalog-product-card.tsx`; delete `product-card.tsx` | the classes `collection-card.tsx:76` already uses | S |
| 9 | Editorial parallax capped in px on the bespoke band | 21st parallax, AnimMaster data-anim-parallax | §15, §9 | `motion/hero-parallax.tsx` (zero importers) → homepage `bespoke`, custom-order hero | `y: () => Math.min(40, h * 0.12)`, `scrub: 0.5`; bails on touch and reduced motion | S |
| 10 | Manifesto scroll-brightening, un-pinned, opacity only | Magic UI text-reveal (200 vh pin rejected), SmoothUI scroll-reveal-paragraph | §9 manifesto, §14 | homepage `manifesto` band | CSS `animation-timeline: view()` inside `@supports` + motion media query | S |
| 11 | Count-up numerals with the final value server-rendered | Magic UI number-ticker, Unlumen count-up | §13 cure hours, §9 proof numerals | `/process` timelines band (bare integers only) → `motion/count-up.tsx` | `Intl.NumberFormat` SSR, GSAP `snap` in a guarded effect | S |
| 12 | Testimonial rail below `md`, manual controls, no autoplay | SmoothUI testimonials (structure only) | §18 | homepage `words`, custom-order proof, PDP | entry 5's snap rail; no avatars or handles invented | S |
| 13 | Sliding active-tab indicator | Unlumen tabs, SmoothUI animated-tabs | §29, §63 | `storefront/tabs.tsx` (if kept), `studio/translations-section.tsx` | one `span`, `--x/--w` written in a layout effect (RTL-aware) | S |
| 14 | Drawer / mega-menu RTL-correct slide, settle curve, staggered links | DaisyUI drawer, React Bits StaggeredMenu | §7 | `site-header.tsx` (panel enters from the wrong edge in Arabic: `slide-in-from-right` at `end-0`) | `rtl:slide-in-from-left`, `ease-(--ease-settle)`, 40 ms stagger on the eight category links | S |
| 15 | Studio list enter for appended rows | Magic UI animated-list, SmoothUI rows | §29, §63 | `/studio/activity`, `studio-row.tsx` | `@starting-style` + `transition-delay: calc(var(--i) * 40ms)` capped at eight | S |
| 16 | Studio sticky header row + pinned first column on wide tables | DaisyUI `table-pin-rows` / `table-pin-cols` | §63 | `studio-table-head.tsx`, `studio-row.tsx` | a `sticky` prop; logical `start-0` | S |
| 17 | Command palette flat loading row + `⌘K` hint | SmoothUI combobox, Unlumen command menu + kbd | §69 | `command-palette.tsx`, `topbar.tsx` | two hairline skeleton lines, `aria-busy`; no spinner | S |
| 18 | Process step pin inside the second sanctioned pin (optional) | Skiper StickyCard (GSAP form) | §13 | `/process` stages band → `motion/process-pin.tsx` | `pin: true, scrub: 0.5` after the guard; reduced motion keeps today's sticky list | L |

Twenty families the prompt names are recorded as forbidden with the rule that blocks each (§4.3 above): cursors and image trails, magnetic buttons, spotlight/glow cards, 3D tilt, glow/shimmer/gradient borders, glassmorphism and progressive blur, scramble/typewriter/flip text, pixel/shader reveals, extra pinned stages, parallax beyond 40 px, preloaders, autoplay carousels and card decks, shimmer skeletons and decorative spinners, illustrated empty states, fabricated social proof and rating inputs, second tickers, docks, WebGL galleries, confetti/ripple buttons, and scroll-progress widgets that duplicate the cure line.

---

## 15. Conflicts that need an owner decision

Each of these is a place where the master prompt and a binding repository rule disagree. None may be resolved by a session. They are numbered to continue `PROJECT_STATE.md`'s D1–D6 and are restated as gates in the roadmap.

| # | Conflict | The prompt says | The repository says | Recommendation |
|---|---|---|---|---|
| D7 | Schema changes inside the transformation | §17, §31, §37, §39, §66, §67, §73 ask for new columns, enums, tables and relations | REDESIGN §1.1 / contract §1 / HARD RULE 5: the redesign changes the visual layer only; a data change is its own justified change | Accept schema work as its own PRs with their own justification, additive only, one entity per PR; the prompt is the justification, this audit is the record |
| D8 | Demo data (§3, §19, §25, §40–42, §74–75, Phase 15) | isolated demo records in the database | HARD RULE 3; `bootstrap.ts` is production | Design 3 above: guarded `seed:demo` fixtures into non-production databases only, plus an additive `isDemo` marker; never in the production Neon database |
| D9 | Furniture as the primary commercial focus (§1, §9, §11, §21.3–8, §35) | show tables, consoles, chairs, benches | D5: the catalogue holds none; §15.2 forbids AI as delivered work | Commission-capability framing only, bench/formwork imagery captioned as concept, until the owner adds real furniture products and photography; chairs and benches only if the owner confirms the studio makes them |
| D10 | Motion vocabulary (§6, §12, §46, §5) | cursor, magnetic, tilt, spotlight, trail, liquid, perspective, marquee | Part 14, §2.7, §3.5, contract §6/§8; unmounted files record the decision | Keep Part 14 as the ceiling; any exception is a new Part 0 decision row the owner signs; adopt the 18-pattern shortlist |
| D11 | Wishlist | §22 "wishlist-like affordance if compatible" (it is built) | REDESIGN §0 decision 4 rejects "Wishlist" | Amend REDESIGN §0 row 4 to permit the account-free localStorage list, or remove `shop/wishlist-*` |
| D12 | Language selector placement | §7 in the header | REDESIGN §5.1 moved it to the footer/drawer | Keep §5.1 unless the owner wants the bar item back |
| D13 | Deploy-time tier fill publishes scraped decks | §36/§37: scraped content never auto-publishes | `import-tiers.ts:38-41`, D6: the owner instructed it | Keep D6 (changing it unpublishes ~4,000 rows); document the exception in the roadmap; the Studio scraper path already complies |
| D14 | `ContentStatus` REVIEW / ARCHIVED (§66) | four states for all content | `DRAFT | PUBLISHED` on four entities; `order-visibility.ts` fails closed on the two-state enum | Add the two values by `ALTER TYPE … ADD VALUE` once the consumers are audited; give Testimonial its own enum; give Faq a `published` boolean |
| D15 | Block catalogue size (§32) | 22 block types | six, asserted by a test, by documented design | Grow one block at a time by decision: Collection Grid, Portfolio Grid, Journal Grid, Testimonial are S and safe; galleries and video blocks are M and need the media picker first |
| D16 | Process and Materials as row CRUD (§31) | full CRUD | fixed-arity copy + image slots by design (§4.7) | Keep fixed arity unless the owner needs more than the current counts; if promoted, follow D2's registry pattern |
| D17 | Design lab (§33) | seven playgrounds | a v2 kitchen sink, 404 in production | Rebuild small (live v3 components, tokens, mock data quarantined, in the local audit run) or retire it and delete its four dead dependants |
| D18 ✅ **DONE (2026-09-03)** | Dormant v2 files | — | Eight deleted: Preloader, preloader-signal, CursorFollower, Magnetic, KineticHeading, SplitTextHeading, mobile-whatsapp-bar, wishlist-count | FOUR of the listed files were not dormant and stay. `product-card` and `order-summary-preview` are imported by `/design-lab` (D17); `tabs` has 19 live references; and **`hero-parallax` is filed under §3.2 REFINE, not §3.3 REMOVE** — row 161 names its destination (px-cap at `Math.min(40, h * 0.12)`, then mount on the bespoke band; roadmap Phase 1b and Phase 3, motion shortlist 9). It was deleted in the first pass and restored: unimported is not unwanted. `src/lib/flourish.ts` is a genuine dead-code find (never had a call site in this repo's history) but is NOT on the approved exact-path list — see the addendum below. |
| D19 | `brand-colors.ts` on OG cards, manifest, email, error page | — | the last live Midnight Gild palette; reconciliation §6 parked it | Mirror v3 hexes into `brand-colors.ts` for Satori and re-skin the four share cards |
| D20 | Hero motion vs the LCP rule | headline rise, image drift | Part 14 asks for both and forbids moving the LCP | Animate the non-LCP video layer and the text only; the poster stays still |
| D21 | Product data projection for cards (§23) | dimensions, material, hover video on the card | `CARD_SELECT` is product data under HARD RULE 5 | One dedicated commit if approved; line-clamp; extend `localize()`; no ellipsis in the accessible name |
| D22 ✅ **DONE (2026-09-03)** | Portfolio seed provenance | — | `seed-portfolio-cases.ts` republished 20 PUBLISHED rows on every deploy, and its update branch rebuilt each gallery with `deleteMany` — so an owner's replaced photograph or unpublished case came back on the next deploy | Two barriers: `PORTFOLIO_SEED=1` opt-in (unset = no-op, which is production) AND no existing `case-*` row. CI opts in explicitly because its database is a throwaway and `/portfolio` is an audited route. |
| D23 ✅ **DONE (2026-09-03)** | Legacy un-gated sheet push | — | `syncSourceToSheet` bypassed `SheetSyncPolicy`, fired on FAILED jobs, and fired for source-less pasted-URL jobs | Removed. `sheet-policy.test.ts` asserts the one-writer invariant on the source itself. **Behaviour narrowing the audit did not record:** the manual affordance that replaces it is labelled "Sync to Sheet" and is **job-scoped**, not source-scoped — the legacy call pushed every staged row of the whole source, so a source with historical jobs can no longer be re-pushed in one action. That is the correct trade (one writer, one policy), but it is a real change to what a single click does. |
| D24 ✅ **DONE (2026-09-03)** | Housekeeping requiring owner approval | — | SIX workflows deleted, as the audit said: `mirror-images`, `mirror-v3-media`, `mirror-v6-media`, `fetch-assets`, `fetch-media-v3`, `fetch-media-v3-video`. Every one states its own deletion condition in its header — "safe to delete once the assets are committed" — and every condition is met (`public/` committed 2026-08-31; `public/media/v3` holds 27 tracked files; the video masters are tracked). An earlier pass kept the two media ones on the theory that they were the only rebuild path; they are not — the scripts survive and run on any machine with ordinary internet, which is what CLAUDE.md actually claims. `fetch-tiers` STAYS: it refreshes live owner-controlled Sheet data and was never on the list. Also deleted: `.playwright-mcp/` (6 files), the two regenerable `audit/*.json` (now gitignored), and `scripts/fetch-assets-manifest.json`, whose only consumer was `fetch-assets.yml` — deleted with it so the pairing stays atomic. | Superseded docs are **bannered in place, not moved**: `DESIGN.md` alone has 164 inbound references, many in dated records where rewriting the path would falsify them. `.env.example` remains the owner's. |
| D25 | Ten-step process (§13) | Concept → … → Delivery / Installation | the site states no installation service; six stages are published | Owner confirms which steps the studio actually performs before copy is written in nine locales |
| D26 | Room context (§14) | products inside premium interiors | no interior imagery or data; AI rooms would be concepts | Build only if the owner supplies delivered-piece photography, or accepts explicitly captioned concept rooms and new slot keys |
| D28 | The rewind of `main` (§1.2) | — | Twelve merged PRs (#15–#20, #22–#27) were dropped when `main` returned to `f1cfd95`; PR #28 was closed unmerged | Owner says whether the rewind stands. If yes: re-open the twelve from `refs/pull/<n>/head` one at a time (Phase 1a); if no: restore `main` to `950d9ac` and rebase this branch |
| D27 | CI | §79/§88 assume gates run | `AGENTS.md:188-190` and `PROJECT_STATE.md` KNOWN ISSUES say Actions never allocated a runner; run #71 on PR #29 proves it does (§0) | Owner retires D4's "cannot run" premise and makes CI the gate of record; local runs remain mandatory for detail routes, E2E and extra widths until CI sweeps them (its database already holds the tier catalogue, §11); correct `AGENTS.md` and `PROJECT_STATE.md` |

### D18 addendum — one dead file the audit never found

`src/lib/flourish.ts` (18 lines, one export, `splitFlourish`) is dead code, and this audit missed it.
It splits a headline so its final word can carry "the one gold flourish a navy band allows" — the v2
"Midnight Gild" rule that REDESIGN.md Part 0 decision 1 rejects outright, `#D4AF37` being the
"saturated costume gold" replaced by champagne `#B89B63`.

The evidence is stronger than for anything on the D18 list: `git log --all -S "splitFlourish"` returns
exactly one commit — the baseline import `32f21a6` — and at that commit the only hit is the declaration
itself. **The function has never had a call site in this repository's history.** There is no barrel, no
dynamic import that can resolve into `src/lib/`, no test, no script, no workflow, and `/design-lab` does
not touch it, so D17 does not gate it either.

**It was NOT deleted.** The owner's D18 answer is bounded — "by exact path, only the proven-unreferenced
ones" — and the exact-path list is the D18 row above, which never named this file. An approval of a list
is not a criterion an implementer may re-apply to paths the owner never saw. Deleting it needs one word
from the owner; leaving it costs 18 lines.

Plus the five Phase 2e questions that remain open in the tree (`PROJECT_STATE.md`, "Phase 2e — OPEN QUESTIONS"), four of which were answered and implemented once in the discarded PRs #22–#25 (§1.2): `/shop?q=` searching descriptions, the "Show all N pieces" label, group-aware breadcrumbs, canonicals for `?type=`, pre-2a bookmarks; and the Phase 2b question of swapping the hero's primary and secondary CTAs under commission-led positioning.

---

## 16. Risks

Ranked by blast radius, consolidated from every subsystem.

| Severity | Risk | Mitigation carried into the roadmap |
|---|---|---|
| critical | A session seeds demo products, testimonials or portfolio rows into the production database (4,385 real products, real orders) | D8; `seed:demo` refuses production; never touch `bootstrap.ts`; fixtures only |
| high | The discarded history layer (§1.2) is redone from scratch or re-applied blind, repeating whatever the rewind of `main` was meant to undo | D28 first; then re-open PRs from their refs with review, never cherry-pick the whole layer |
| critical | Furniture or interior generations presented as delivered work | D9; concept captions; never attach a v3 master to a Product/Portfolio/Testimonial row |
| critical | A copy rewrite in `en.json` ships eight stale translations and no gate notices | Add a stale-translation mode to `i18n-missing.mjs` before any copy phase; every copy change is a nine-file edit + `copy:registry` |
| critical | The legacy sheet push keeps writing to the owner's shared sheet after every scrape | D23 in its own PR with a test |
| medium | Treating a green CI as sufficient: CI does not yet sweep the detail routes, the E2E smoke or any width but 1440/390, although its database holds the catalogue to do so | Keep D4's evidence habit for those until Phases 16–17 add them to `ci.yml` |
| high | Installing `motion`, a component library or running a shadcn/DaisyUI CLI | Dependency policy §14; the reconciliation's "Would break the build" list |
| high | Autosave writes half-typed edits to live products/posts (no per-row draft) | Autosave is local-draft only until a per-row draft column is decided |
| high | Adding a media-URL column or table without a `media-usages.ts` entry | Same-commit rule; extend `tests/db/media-usages.test.ts` |
| high | A Studio redesign unmounts the scraper runner mid-run | Keep the runner in a hook at a stable layout level; add a stale-RUNNING window |
| high | Descending-index sheet deletion refactored without a test | Extract the index planner; vitest it before touching `sheets.ts` |
| high | New sections breach the band-rhythm / `section-major` / `h1` guardrails or lose their cure tick | Declare `SectionDef.dark`, `cureLabelKey`, copy prefix, `KNOWN_ROUTES`; run `redesign-audit.mjs` at 1440/390 locally |
| high | E2E smoke DOM contracts silently broken by chrome changes | Treat `data-slot` names and counts as a contract; update the smoke in the same PR, never delete a check |
| medium | Dormant v2 files remounted by accident | D18 |
| medium | Blur/shadow/hover-transform drift is ungated | Add computed-style rules to `redesign-audit.mjs` |
| medium | OG share cards off-brand on the WhatsApp channel | D19 |
| medium | LQIP join keyed on the slot fallback paints the wrong blur after an owner override or a fresh deploy | Key on the resolved URL; test a repointed slot |
| medium | Stale operating docs steer the next session wrong (the "Done." incident hid a missing `public/` for a phase) | Doc updates are part of every phase's definition of done; the checkpoint block in `PROJECT_STATE.md` is the resume point |
| medium | Grep-deleting `mirror-images` removes the live cron route | Delete by exact path only |
| medium | `ALTER TYPE … ADD VALUE` inside a transaction on older Postgres | Reuse the `inquiry_pipeline_statuses` migration shape |
| medium | A production deploy fails on a transient database error because the legal pages and the sitemap read without a fallback during prerender (seen on this PR's preview: `P2037` for role `prisma_migration`) | Make the three reads total; pooled `DATABASE_URL` at runtime, direct URL only for migrations |
| low | Port drift `:3111` vs `:3000` audits nothing | One `BASE_URL` default across scripts |

---

## 17. Dependencies

- **Owner decisions** D7–D28 (above) and Phase 2e's five questions; the roadmap marks which phases each gates. D28 comes first: it decides whether twelve reviewed PRs are re-opened or `main` is restored.
- **Owner content**: real furniture products and commission photography (D5); a real maker photograph for `home.maker`/`about.maker`; Portfolio rows with `beforeImageUrl`/`afterImageUrl`; interior photography of delivered pieces; any real testimonials; confirmation of the portfolio seed provenance.
- **Owner actions outside the repo**: retire D4's premise now that Actions executes (D27); `.env.example`; Higgsfield credits and an ordinary-internet machine to run `scripts/media-v3-fetch.mjs` (the CDN answers 403 in-session; the §10.3 planned sets need a generation run and `--promote` before the fetch can see them — `--planned` prints the sequence); `GOOGLE_SERVICE_ACCOUNT_JSON` + `SCRAPE_SHEET_ID` in the environment for any Sheets work; `BLOB_READ_WRITE_TOKEN` for bundled imports; a Neon branch for the Content Lab.
- **Infrastructure for verification**: a reachable Postgres for `build`, `test:db`, the audits and E2E — none exists in a fresh session; the roadmap's per-phase definition of done requires one.
- **Cross-subsystem ordering**: the testimonial schema (Phase 9) before any testimonial UI mode B/C/E/F, the PDP band, or the `/large-resin-art` words band; the media picker's video support before Video Hero / Video Story blocks; the stale-translation gate before any copy-heavy phase; the section registry entries (`site-images.ts`, `page-sections.ts`) before any room-context imagery; `CARD_SELECT` projection (D21) before card metadata.

---

## 18. Stale documentation register

These will be wrong the moment the corresponding change lands and must be touched in the same PR:

| File | What is stale now |
|---|---|
| `PROJECT_STATE.md` | Before this PR: no §81 checkpoint block; NEXT EXACT TASK named a Phase 2f item already marked DONE; "Ten PRs merged" vs 17 merge commits; "43 migrations" vs 44 and "No new migration written yet"; BUILD STATUS "CI is now live" beside a KNOWN ISSUES blocker saying it never executed; test counts 29/322 vs 36/375. All corrected in place with dated notes in this PR; "Ten PRs merged" is left as the Phase 2b-era statement it is |
| `CLAUDE.md` | 1,115 slots (:118) → 1,181; six pages (:122, :345) → seven; "12 public routes" (:40, :215) → 13 in `ci.yml` |
| `AGENTS.md` | PROJECT_STATE "~490 lines" → 537; add the stale-translation and un-gated-push traps once fixed |
| `docs/studio-cms/*` | 57 slots, 1,115 slots, six pages |
| `docs/scraper.md:79`, `docs/source-adapters.md:61`, `docs/google-sheets.md` | `requestDelayMs` works (it is never read); adapter tests exist (none); MANUAL is the effective default (not while the legacy push remains) |
| `README.md` | Title "Luxury Resin Art & 3D Printing Platform" (:1, :5); "kinetic oversized typography… magnetic CTAs" (:68); build phases narrate the predecessor repo; ":97 update CONTEXT.md" |
| `SEO_GUIDE.md` | Retired default title (:7); Midnight Gild OG template and `#1E4FD8` theme colour |
| `COMPETITOR.md`, `docs/luxury-ecom-strategy.md`, `docs/product-ux-benchmark.md` | Pre-D5 positioning and pre-v3 vocabulary; still useful as research |
| `docs/audit-uiux.md` | No ARCHIVED banner although every path and token it cites is pre-v2 |
| `src/components/studio/media/media-grid.tsx:94-100` | Header says the AI filter is not built; the code implements it |
| `prisma/generated-cover.ts:14-15` | States the Higgsfield CDN is allow-listed in `next.config.ts` `remotePatterns`; it is not (`:88-98` list only Blob, Cloudinary and the supplier host), so the CDN fallback branch would throw in `next/image` |
| `ADMIN_GUIDE.md:66` | "Published testimonials rotate in the carousel on the home page" — the carousel was retired in Phase 7 |
| Stale code comments citing `DESIGN.md B2/B4`, "Midnight Gild", "Fraunces", "porcelain", "header-ink" | 19 files under the storefront routes and components, plus `[locale]/layout.tsx:150` ("Midnight Gild group"), `logo.tsx:49`, `whatsapp-order/copy-button.tsx:11`, `search/page.tsx`, two `loading.tsx`, `hero-media.tsx`, `template.tsx`, `dialog.tsx:36,110`, `rating-stars.tsx`, `fonts-scripts.ts:12-19` |
| `src/styles/tokens.css:208-211` | Comment says the cure line re-checks `prefers-reduced-motion` in JS; `cure-line.tsx` relies on the global collapse and `motion-reduce:` utilities only |
| `src/app/[locale]/(v2)/page.tsx:89` and REDESIGN §0 decision 9 | Say "Thirteen sections"; the HOME manifest has 14 keys since the `words` band was added (`page-sections.ts:155-172`) |
| `next.config.ts` comment on `next-view-transitions` | Says React 19 ships no `<ViewTransition>`; Next 16.3's own docs say it works in the App Router |
| `src/app/studio/layout.tsx:15-16` | Says the `.studio-v2` scope ships light-only and dark mode is a tracked Phase 7 item; `globals.css:197-229` already ships the OS dark block |
| `.github/workflows/ci.yml:88-91`, `CLAUDE.md:217` | Say CI has "no catalogue"; `bootstrap.ts:150` imports the tracked tier snapshot and the 20 portfolio cases into the CI database on every build |

Superseded documents the §2 reading list correctly omits and which should move under `docs/archive/` (D24): `DESIGN.md`, `CONTEXT.md`, `docs/design-v7-sapphire-atelier.md`, `docs/audit-2026-07-*.md`, `docs/audit-v7.md`, `docs/design-audit-redesign.md`, `docs/image-inventory.md`, `docs/audit-uiux.md`. The `RIVYA LIVING ART_2.0_UI_MASTER_PLAN.md` that `CLAUDE.md:13` and `AGENTS.md:72` warn about is absent from the tree and from history; only its reconciliation remains.

---

## 19. Section-by-section reconciliation of the master prompt

One row per section. Status is the primary verdict for the section; sub-asks that differ are named in the row. "Phase" is the roadmap phase (`docs/transformation-roadmap.md`) that owns the work; "D" numbers are the decisions in §15.

| § | Title | Status | What HEAD has | Gap / action | Phase | Effort |
|---|---|---|---|---|---|---|
| 1 | Primary business positioning | DECISION | Commission-led luxury positioning in nine locales (Phase 2b); `/large-resin-art`, `/custom-order` | "Large resin furniture" as what the studio *sells* is DATA_GAP (D5, 0 furniture rows); truthful only as what it *commissions* | 3, 4 | n/a |
| 2 | Critical repository rules | EXISTS | All six named documents exist; HARD RULES 1–5 honoured throughout; the UI_MASTER_PLAN file is absent, only its reconciliation remains | — | 0 | n/a |
| 3 | Important data rule | DECISION | No `isDemo` anywhere; DEMO title-prefix exclusion at 9 sites; `bootstrap.ts` is production | D8: guarded non-production fixtures + additive marker | 15 | L |
| 4 | Design direction | PARTIAL | REDESIGN Part 2 / 3.5 encode the direction and the avoid-list; tokens implement it | Shipped departures: the consent banner's shadow + blur + 16 px radius, six mounted blur sites, the v2 OG palette; dormant v2 files (D18) | 1 | S |
| 5 | Component inspiration system | PARTIAL | Research done (§14); adapter principle is how the repo is built | Port by hand; install nothing (D10) | 1–3 | n/a |
| 6 | Component mapping (hero) | PARTIAL | `min-h-svh` hero, poster-first video, droplet scroll indicator, adaptive header | Headline rise + poster drift allowed (D20, S); cursor / magnetic / trail / perspective FORBIDDEN | 3 | S |
| 7 | Global header | PARTIAL | 8 of 9 requirements met (§2 table) | Adaptive contrast is route-declared, not measured (M); language selector placement (D12); RTL drawer edge (S) | 2 | M |
| 8 | Homepage transformation | PARTIAL | Part 6 homepage, 14 manifest sections, owner-editable copy/images/order | Headline/CTA copy are owner slots; §10 band MISSING; §11 bento; §9/§14 DATA_GAP | 3 | M |
| 9 | Statement furniture introduction | DATA_GAP | Nothing to show (0 tables/consoles/chairs/benches) | D9: commission-capability band with bench-concept imagery only if approved | 3 | M |
| 10 | Large resin art feature | PARTIAL | Route exists; homepage has no band; lightbox exists | New `SectionDef` + copy ×9 + reuse `largeFormat.k1–k4` slots (M); cursor-following preview FORBIDDEN; SET B imagery | 3 | M |
| 11 | Collection experience | PARTIAL | Six `CollectionCard` tiles, uniform grid, hover scale, mono metadata | Bento re-layout (shortlist 6, M); furniture categories DATA_GAP; six slugs are a code constant | 3 | M |
| 12 | Material laboratory | PARTIAL | `/about` materials with macro hover; `/process` materials; the pinned pour scrub | Accordion gallery (shortlist 7, M); no Material entity (D16); magnetic/liquid FORBIDDEN | 8 | M |
| 13 | Process experience | PARTIAL | Six stages, sticky photographs, `CureLine`, video hero | Ten steps = D25 + 4 copy keys ×9 + 4 slots + SET D imagery; optional pinned stack (shortlist 18, L) | 8 | M |
| 14 | Room context experience | DATA_GAP | No interior imagery, no room data, no section | D26; SET C only as captioned concepts with new slot keys | 3 (gated) | M |
| 15 | Bespoke commission | PARTIAL | `/custom-order` (Part 10), homepage bespoke band, footer CTA, large-format brief; no payment | The brief carries none of the prompt's attribute fields (dimensions, colour, wood, finish, shape, edge, artwork direction, installation) — a form-field change under HARD RULE 5, owner decision; wording is an owner slot; capped parallax on the band (shortlist 9) | 3 | S |
| 16 | Portfolio | EXISTS | Masonry archive, filters, spec rail, captioned gallery, `BeforeAfter` (dormant on data), JSON-LD | Installation context = owner fills `location` / `process` / `resultsMeta` (data, not schema); `beforeImageUrl` data is the owner's | 8 | S |
| 17 | Testimonial system | PARTIAL | 8-column model, CRUD, three render sites | Additive migration §12.3 (D7, D14) | 9 | L |
| 18 | Testimonial UI | PARTIAL | One mode (card); no carousel (good) | A editorial variant (S); D masonry (M); B/C/E/F after the schema | 9 | M |
| 19 | Testimonial demo data | DECISION | Nothing | D8: fixtures, non-production only | 15 | S |
| 20 | Product detail page | PARTIAL | Part 9 PDP: gallery, identity, spec sheet, customisation, care, related, CTA, 3D chip | Visual dimensions / scale / room context are schema gaps (numeric dimensions and `ProductImage.role`, D7) plus owner imagery; `model-viewer` REFINE; lightbox FLIP | 6 | M |
| 21 | Large resin furniture page | PARTIAL | `/large-resin-art`: 6 of 18 sections, 4 more partly | Portfolio / testimonials / FAQ bands (S each); philosophy band (S); materials reuse (S); 21.3–8 and 21.11 DATA_GAP (D9); widen `LARGE_FORMAT_CATEGORY_SLUGS` (decision) | 4 | M |
| 22 | Shop experience | PARTIAL | Everything except quick view; wishlist built | Quick view (M, §4.6 constraint); wishlist D11; snap rails on mobile | 5 | M |
| 23 | Product card | PARTIAL | Image, second-image wipe, name, category, availability, price band, wishlist, ghost CTA | Dimensions/material need `CARD_SELECT` projection (D21, S); hover video (D21, M); enquiry ghost line (S); scale 1.03 where no second image (S) | 5 | M |
| 24 | Journal / blog | PARTIAL | Featured story, grid, filters, reading progress, TOC, related posts, author-linked products | Related collections needs `BlogPost↔Category` (D7); related materials needs a Material entity (D16); six categories vs ten is a content task (footer links at `constants.ts:121,123` must survive) | 8 | M |
| 25 | Blog demo content | DECISION | 55 real posts | D8 fixtures, DRAFT, concept-labelled; never in `bootstrap.ts` | 15 | M |
| 26 | About / studio page | EXISTS | Story, values, maker, craft chapters, materials, studio gallery; no invented claims | Maker photograph is a generation — owner replaces it (§15.2) | 8 | S |
| 27 | All website pages | EXISTS | 21 routes on v3, audited at 1440/390 + RTL | Residual REFINE: OG cards, stale comments in 19 files, `/search` file docs | 2, 16 | S |
| 28 | Studio transformation | EXISTS | v3 Studio under `.studio-v2`, obsidian chrome, mono metadata | Drift sweep: 47 `shadow-sm`, 38 `rounded-xl/2xl`, three boundary files | 10 | S |
| 29 | Studio design system | PARTIAL | 13 of 19 items exist (§5.1) | Tabs primitive, notification centre (decision), column controls, badge tones, sonner tokens, drawers | 10 | M |
| 30 | Studio dashboard | PARTIAL | Every tile a live count; `—` for conversion | Add testimonials / portfolio / media / scraper / import tiles (S); "Demo products" reads the D8 marker | 10 | S |
| 31 | Studio content management | PARTIAL | Homepage, pages, products, testimonials, journal, portfolio, FAQ, settings all editable | Collections SEO/visibility columns (D7); Process/Materials entities (D16); theme settings FORBIDDEN | 11 | L |
| 32 | Page builder | PARTIAL | Six blocks, guardrails, scheduling, translations | Grow by decision (D15): four S blocks first; video/gallery blocks after the picker; per-block theme FORBIDDEN (§3.1, derived grounds); spacing/alignment/responsive MISSING and gated by the token governance; Stats FORBIDDEN | 11 | M |
| 33 | Design lab | PARTIAL | A v2 kitchen sink exists; 404 in production but rendered on Vercel previews; 0 of 7 playgrounds | D17: rebuild small or retire | 10 | M |
| 34 | Media library | PARTIAL | 12 of 18 DAM items | Pagination, sort, filters, drawer, drag-drop, video poster (M); tags/captions/favourites are schema (D7) | 12 | L |
| 35 | Higgsfield asset pipeline | PARTIAL | 24 stills + 1 video with keepers; detail and pour covered | Forty-item plan §10.3; furniture/interiors gated by D9/D26; fetch runs outside a session | 4, 12 | L |
| 36 | Scraper / research studio | PARTIAL | 8 of 9 stages built; never auto-publishes on the Studio path | Legacy push (D23); discovery scope, normalisation aliases, stage rail UI; deploy fill exception (D13) | 13 | L |
| 37 | Research database | PARTIAL | `ScrapedProduct` covers every field but notes; RESEARCH vs PRODUCTION structural | `notes` column (D7); non-product research is a new record type (decision) | 13 | S |
| 38 | Google Sheets integration | PARTIAL | Import, normalisation, dedupe, export, DB source of truth | Conflict resolution MISSING (L); tier-fill preview + approval (M); wizard merge policy (S) | 14 | L |
| 39 | Sheets data management | PARTIAL | 6 of 11 stored | Spreadsheet/tab id in settings (S); row id: keep key-based; conflicts table; push-side history | 14 | M |
| 40 | Demo content lab | DECISION | Nothing | D8 | 15 | XL |
| 41 | Demo studio data | DECISION | Nothing | D8; entities without a model (materials, process, collections, banners, templates) cannot have records | 15 | L |
| 42 | Testimonial demo structure | MISSING | Every listed variation needs Testimonial columns that do not exist (a schema gap, not a data gap) | After Phase 9, under D8 | 15 | S |
| 43 | Empty states | PARTIAL | `EmptyState` at 24 Studio call sites (21 files) and every storefront list | CTA on all Studio empties (S); landing pages and sheet-import use inline text | 10 | S |
| 44 | Loading states | PARTIAL | Storefront: flat skeletons, load-more, button loading; Studio: one generic `loading.tsx` | Per-route Studio skeletons at final dimensions (M) | 10 | M |
| 45 | Error states | PARTIAL | Storefront `ErrorState` with WhatsApp escape; Studio boundary basic | Reference code, auth-tree boundary, `ModelViewer` error (S) | 10 | S |
| 46 | Micro-interactions | PARTIAL | Meniscus reveal, hover wipe, scroll progress, section reveal, subtle scale, horizontal rails, liquid = the pour scrub | Broaden `Reveal`; forbidden: magnetic, cursor spotlight, tilt, image trail, perspective, homepage marquee (D10) | 1, 3 | S |
| 47 | Motion performance | PARTIAL | Global reduced-motion collapse, SSR-true hook, lazy GSAP, canvas confined | "Avoid excessive blur" is not met (six mounted blur sites); the ≤45 KB budget is unmeasured — automated check (S) | 1, 16 | S |
| 48 | Typography | EXISTS | Display / heading / body / metadata scale, all clamped, mono numerics | — | — | n/a |
| 49 | Spacing | PARTIAL | Section tiers + retained step scale for the Studio | The 8 px base scale is Tailwind's default; REDESIGN §18.5 names `space/1 … space/12` that do not exist as custom properties (S, optional); Studio density is convention, not tokens | 1 | S |
| 50 | Color system | PARTIAL | Palette + navy scope; header adapts by route | Image = dark hero; Accent fill FORBIDDEN; Editorial = surface shift; no new scopes needed | 1 | n/a |
| 51 | Responsive design | PARTIAL | CI at 1440/390; DoD adds 360/1280 by hand | Add 360/768/1024/1280 passes (S, CI minutes) | 16 | S |
| 52 | Mobile experience | PARTIAL | Bottom bar, drawer, snap-ready cards, filters as bottom sheet; Studio tables scroll | Touch-target measuring rule (S); Studio mobile cards beyond inquiries (L) | 10, 16 | M |
| 53 | Accessibility | PARTIAL | axe at two widths + RTL, structural rules, skip link, reduced motion | Keyboard-path checks for drawer/search/lightbox (M); 44 px rule | 16 | M |
| 54 | Internationalization | PARTIAL | 9 × 1,181, RTL, registry, fallback | Hardcoded English in JSON-LD breadcrumbs, three mounted `aria-label`s and one loading string; physical-direction residue in the drawer, filter drawer, two `origin-left`s and `ui/select` (S); **stale-translation gate (S, prerequisite)** | 1, 2, 16 | S |
| 55 | SEO | PARTIAL | Metadata + hreflang on 21 routes; seven JSON-LD types | Twitter block, `og:url`, breadcrumb i18n (S); OG cards v3 (D19); Review schema after Phase 9 | 16 | M |
| 56 | Performance | PARTIAL | Font strategy, image ladder, lazy GSAP, gated video | CSP enforcement (decision, own PR); bundle check; Lighthouse baseline refresh | 16 | M |
| 57 | Image strategy | PARTIAL | Slots declare ratio, focal point, mobile crop; product images never distorted | Focal point and mobile crop render only through `SlotImage` on six slots; `HeroMedia` and `getSiteImage()` take bare strings, so six wide slots have no mobile path (code, S); no bundled 9:16 crops (SET E + registry field); product/portfolio images have no focal point (D7) | 12 | M |
| 58 | Video strategy | PARTIAL | Hero + process video with poster, fallback, reduced-motion, touch gate | Hero loop, macro, workshop, rotation, room reveal = SET F; gallery `<video>` lacks `poster` (S) | 12 | M |
| 59 | URL / route safety | EXISTS | Every asked route exists; `/large-resin-art` in place | No new routes; extend manifests | — | n/a |
| 60 | Component architecture | EXISTS | Flat `storefront/`, `studio/`, `motion/` | Keep flat (§60's own escape clause, §83); two extractions when files next change | — | n/a |
| 61 | Design tokens | PARTIAL | Colour, type, tiers, radius, shadow, borders, motion, widths | `--z-*` and breakpoint tokens (S); retire legacy aliases (S) | 1 | S |
| 62 | Component quality standard | PARTIAL | Six states on v3 primitives; empty/error/loading on lists | `ModelViewer` error/reduced-motion; `WishlistPanel` empty; disabled customisation controls state no reason (contract §9); no component-test runner | 1, 6 | S |
| 63 | Studio data table standard | PARTIAL | Search 12, filters, pagination, bulk 15, status | Sort beyond scraper (M); column controls (M); mobile cards (L); sticky header/first column (S) | 10 | L |
| 64 | Form UX | PARTIAL | Labels, zod, inline errors and helper text on the major forms, loading, toasts, `beforeunload` guard on 7 | `FieldError` primitive on `seo-form` (S); in-app nav guard (S); inline `role=status` success; autosave only as local draft (decision) | 11 | M |
| 65 | CMS preview | PARTIAL | Draft mode on every resolver, preview buttons, ribbon | Device-frame iframe (S); theme preview n/a | 11 | S |
| 66 | Draft / publish system | PARTIAL | DRAFT/PUBLISHED on four entities; surface drafts; scheduling on landing pages | REVIEW/ARCHIVED (D14); status on Testimonial/Faq; `BlogPost.publishedAt` as a gate (decision) | 9, 11 | M |
| 67 | Content relationships | PARTIAL | 6 relations exist | 8 missing, all schema (D7); Collection table would start empty (D5) | 9, 11 | L |
| 68 | Search | PARTIAL | The header overlay already searches four groups — products, collections (categories), portfolio and journal (`search-overlay.tsx:31,349-362`, `actions/search.ts:76-79`); `/search` is products only; `⌘K` in the Studio | Materials have no entity; pages/FAQ and the collections group on `/search` are search-behaviour changes under HARD RULE 5 → decision (M) | 5 | M |
| 69 | Global command search | PARTIAL | Navigation + product jump | Create/run verbs as navigation shortcuts, testimonial/media items (S) | 10 | S |
| 70 | Notifications | PARTIAL | Toasts + bell count link | Derive scraper/import completions from existing rows (S); persistent inbox is a new table (decision) | 10 | M |
| 71 | Activity log | PARTIAL | who/what/when/action for 25 modules | Previous state via `ContentRevision` list (M) or `before` snapshot in `meta` (decision) | 11 | M |
| 72 | Security | EXISTS | `requireStaff` re-validation, SSRF guard, form tokens, rate limits, last-admin protection | CSP report-only (own PR, Phase 16); upload validation trusts the declared MIME (`actions/media.ts:64`) and RR-002/003 from QA/03 are still open at HEAD — the discarded PR #19 fixed them once (§1.2) | 16 | M |
| 73 | Database safety | PARTIAL | 44 additive migrations, unpooled URL for migrate, preflight | The "safe seed strategy for demo data" half does not exist in code (no `seed:demo`, no marker); it is the D8 design in the roadmap §7 | 15 | M |
| 74 | Demo data seeding | DECISION | No `seed:demo` | D8 design 3; idempotency keys exist | 15 | M |
| 75 | Demo data quality | PARTIAL | Product, BlogPost and Portfolio can express featured, status, multiple images and translations today | "Archived" needs §66; Testimonial and Faq status/featured are schema gaps; the fixture matrix itself is under D8 | 15 | S |
| 76 | Testimonial edge cases | MISSING | No video, productId, portfolioId, featured, status or isDemo column exists (schema gap) | After Phase 9 | 15 | S |
| 77 | Visual QA | PARTIAL | `shots.mjs` manual; overflow and broken bundled images gated | Screenshot sweep at 1440/1280/1024/390/360 per phase (manual, needs a server) | every phase | S |
| 78 | E2E QA | PARTIAL | 10-check smoke covers 4 of 16 asks | Salvage `verify-phase2/3.mjs` order path; add search/filter/customisation/Studio CRUD checks (XL over time); needs a seeded CI catalogue | 17 | XL |
| 79 | Testing commands | EXISTS | All named commands exist | Port unification (S) | 1 | S |
| 80 | Phase-wise implementation | PROCESS | Phase 0 = this document | Phases re-sequenced in the roadmap | — | n/a |
| 81 | Session checkpoint system | PROCESS | The fifteen-key SESSION CHECKPOINT block now opens `PROJECT_STATE.md` (this PR) | Update it in every phase PR; the historical LAST COMMIT and SAFE CONTINUATION POINT sections are marked as history | every phase | S |
| 82 | Git strategy | EXISTS | Feature branch per phase off `origin/main`, draft PR, owner merges; this session on `claude/session-6h1a70` | §82's own clause yields to repository workflow, so `redesign/*` names are not adopted and no decision is needed; the rewind of `main` is D28 | — | n/a |
| 83 | Implementation principle | EXISTS | KEEP / REFINE / REBUILD / REMOVE / REPLACE applied to every surface in §3, §5, §6, §8–§10 | The REMOVE set waits on D18/D17 before the chore PR | 1 | n/a |
| 84 | Component inspiration rule | PARTIAL | Adapt-only policy and the 18-pattern shortlist (§14); the adapter principle is how the repo is built | 0 of the 18 adaptations are built; each lands in the phase its target belongs to | 1–3, 10 | n/a |
| 85 | Most important UX principle | EXISTS | Part 14 "craftsmanship, not a technology demo"; two ornaments unmounted | — | — | n/a |
| 86 | Final public website experience | PARTIAL | What / why / customise / real work / enquire / trust all answered honestly | "What do they sell: large resin furniture" is DATA_GAP (D5); no fabricated proof | 3, 4 | n/a |
| 87 | Final studio experience | PARTIAL | Products, collections, homepage, pages, blocks, images, testimonials, journal, portfolio, FAQ, SEO, navigation, footer, settings, research, scraper, Sheets, media | Materials / process / collections as entities (D16, D7); videos in blocks; demo data (D8) | 11–15 | L |
| 88 | Final definition of done | PARTIAL | Every quality gate exists and is wired in `ci.yml`, which executes (run #76 green on PR #29) | The content and data-safety lines are not yet true at HEAD: testimonial architecture (Phase 9), a Content Lab (D8, never in production), "scraper does not auto-publish" (true for the Studio path, not for the deploy-time tier fill, D13), "Sheets does not blindly overwrite" (the wizard's slug upsert, `import.ts:546-554`) | every phase | n/a |
| 89 | First action | PROCESS | This document and the roadmap | STOP after Phase 0 | 0 | n/a |

**Counts:** EXISTS 13 · PARTIAL 62 · DATA_GAP 2 · DECISION 7 · MISSING 2 · PROCESS 3. Forbidden asks: 17 (§4.3); forbidden library pattern families: 20 (§14). The five section reconcilers agreed with 77 of 89 rows as first written; their twelve disagreements (§4, §7, §33, §47, §49, §73, §84, §88 to PARTIAL; §82, §83 to EXISTS; §81 to PROCESS; §2 to PROCESS) are adopted here except §2, which stays EXISTS because the named documents exist.
