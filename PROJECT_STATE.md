# PROJECT_STATE.md

> **Read this file first, every session.** Then `CHANGELOG.md`, then `git status`, then
> `git log --oneline -15`. Resume at **NEXT EXACT TASK**. Never repeat a completed phase.

---

## SESSION CHECKPOINT

The master prompt's §81 checkpoint (`docs/transformation-audit.md`, `docs/transformation-roadmap.md`).
Updated at the end of every transformation phase. The narrative sections below it are history.

```text
Current Phase:            Transformation wave 2 — wave 1 complete (A1 B C1 D E F1 + G); A3 and A2
                          merged; A4 and C2 in flight; F2 after wave 2
                          (approved plan of 2026-09-03; base 7cdd09a = origin/main after PR #41)
Phase Status:             B0 · A1 · B · G · C1 · D · F1 · E · A3 · A2 COMPLETE (2026-09-03); PR #42 draft;
                          CI green
                          on every head; Vercel preview green after the P2037 pool/retry fix
Completed:                12 commits: testimonial schema + gated resolver (PR #41, merged) ·
                          ContentStatus REVIEW/ARCHIVED · isDemo marker + demoContentPublic +
                          demo gate on every public reader + DEMO prefix retired · Faq.status ·
                          Category seo/visible · Media metadata · scraper scope/notes/heartbeat ·
                          SheetConflict/SheetSyncRun/sheet ids · BlogPost.categoryId ·
                          ProductImage.role · ResearchRecord · snapshotBefore + PROCESS_STEPS
In Progress:              wave 2 — A4 (process/about/journal + Studio process/materials) in wt-a4,
                          C2 (block catalogue) in wt-c2; then F2 (CI demo seed + detail routes + e2e,
                          audit flips, docs; reconcile the 6 s sf-hero-drift token with Part 3.8)
Next Exact Task:          Wave 1 per docs/plan (A1 design system + chrome · B testimonials · C1
                          Studio content · D media · E scraper + sheets · F1 hygiene), then wave 2
                          (A2 · A3 · A4 · C2 · G), then F2 CI/E2E/docs. Owner decisions taken
                          2026-09-03: D9/D26 commission framing all six kinds; D10/D20 Part 14
                          ceiling; D7/D8/D14 additive schema + isDemo, demo content public only
                          behind SiteSettings.demoContentPublic or off production; D25 ten steps.
Files Created:            11 migration dirs (20260904100000 … 20260904110000) · src/lib/
                          {content-status,demo-clause,demo-content,activity-snapshot,
                          process-steps}.ts (+ tests) · tests/db/{testimonials-gate,demo-gate}.test.ts
                          · tests/stubs/server-only.ts · A3: src/lib/{card-meta,flip,swatch-colors}.ts
                          (+ tests) · shop/{quick-view,quick-view-trigger,card-hover-video,
                          card-ask-whatsapp}.tsx · storefront/lightbox.tsx · E: lib/scraper/{stages,
                          stages-server,normalize}.ts · hooks/use-scrape-runner.ts · scraper/layout.tsx
                          · actions/{research,sheet-fill}.ts · lib/import/tier-fill.ts · studio
                          research + sheet-import/conflicts routes · settings/sheet-ids-section.tsx
                          · A2: src/lib/furniture-kinds.ts
Files Modified/Deleted:   prisma/schema.prisma · src/lib/{testimonials,media-usages,shop,
                          search-query,catalog-nav,catalog-mirror,custom-pages-server,
                          custom-page-data,large-format,site-settings,activity,order-visibility,
                          scraper/product-sheet-sync}.ts · src/actions/{helpers,order,search,shop,
                          blog,portfolio,products,custom-pages}.ts · src/app/sitemap.ts · every
                          (v2) page that reads content · Studio product list/page · four Studio
                          form schemas · vitest.db.config.mts · tests updated. Nothing deleted.
                          A3: shop.ts D21 select · catalog-product-card · product page/gallery/
                          order-panel/model-viewer · portfolio lightbox-gallery · shop + category
                          pages · search page defaults · design-lab mock rows. E: scraper actions,
                          adapters, run-scope, breaker, sheets, sheet-push · import.ts preview +
                          overwriteOwnerEdited · import-wizard · settings form/page · sidebar ·
                          prisma/import-tiers.ts (thin caller) · docs/{scraper,google-sheets}.md.
                          A2: page-sections{,-server,-studio}.ts · sections-board · site-images.ts
                          (+10 slots) · large-format.ts · (v2)/page.tsx · large-resin-art/page.tsx ·
                          nine message files (+75 keys) · site-copy.generated.ts (1,282 slots)
Database Changes:         11 additive migrations (44 → 55). One data statement: existing
                          Testimonial rows back-filled to PUBLISHED (they were live). Product
                          isDemo ADD COLUMN takes a brief ACCESS EXCLUSIVE lock — deploy off-peak.
Content Changes:          none
Demo Data:                prisma/fixtures/demo/* (100 products, 30 posts, 40 testimonials, …)
                          seeded into the LOCAL database only via npm run seed:demo; the loader
                          refuses production hosts; bootstrap.ts never references it
Assets Added:             none
Tests Run:                typecheck · lint · test (40 files / 391) · test:db (4 files / 13) ·
                          copy:check (1,185) · migrate deploy + migrate diff after every migration ·
                          npm run build (local Postgres, bootstrap 4,385 products) · motion-budget ·
                          redesign-audit 13 routes at 1440 + 390 + RTL 390 · a11y-audit 390 ·
                          keyboard-audit · test:e2e (10/10) · studio-audit (30 routes) · behaviour
                          proofs on a production-mode server: hidden demo PDP renders not-found with
                          no Product JSON-LD and no sitemap entry; shown demo PDP renders in full
                          with noindex; the demo title no longer leaks into the 404's <title>
                          · E + A3 merged head (817865e): typecheck · lint · test (63 / 618) ·
                          test:db (6 / 28) · copy:check (1,207) · i18n-missing + --stale · build ·
                          motion 48.4 KB · redesign-audit 18 routes at 1440/390/360 + 8 RTL at 390 ·
                          a11y-audit 1440/390/RTL · keyboard 1440/390 · e2e 10/10 · studio-audit 34
                          routes 1440/390 (one 390 overflow on /studio/sheet-import fixed) ·
                          Lighthouse budgets met · demo proofs incl. the IN_ROOM room-context band
                          · A2 merged head (909e28a): the same set — test (63 / 620) · copy:check
                          (1,282) · studio-audit 34 routes 1440/390 after the sections-board
                          contrast fix · demo detail routes re-audited after re-seeding
Tests Passing:            all of the above (motion 48.2 KB is in the 45–49 KB warn band as before)
Known Issues:             Subagent API returned 529 for the whole batch, so B0 was implemented in
                          the main session rather than by the planned agent workflow; the
                          adversarial verifier pass is replaced by the grep sweep + db tests until
                          capacity returns. Five pre-existing drift statements on main (trigram
                          indexes, two defaults) — a separate chore. OG-image routes for detail
                          pages are not demo-gated (they render a title only when the page is
                          reachable). PRE-EXISTING soft-404: detail routes stream a 200 shell
                          before notFound() resolves (loading boundary), so a missing slug
                          answers 200 + the not-found UI + noindex — an SEO item for batch F2,
                          not introduced here.
                          E leaves syncWebsiteProductsToSheet reading its sheet id from the
                          environment (its writer is outside E's files; documented in
                          docs/google-sheets.md). Bulk Import re-imports now skip untouched
                          matching rows unless "overwrite owner-edited products" is ticked.
Next Session Instruction: `npm run test:db` seeds AND removes the demo set in the database it
                          runs against — run `npm run seed:demo` again before any audit that
                          needs /product/demo-product-001 (learned twice this session).
                          Read this block, then /root/.claude/plans/…elegant-mango.md (the
                          approved plan) and CHANGELOG.md's B0 entry. Branch is
                          claude/rivya-website-redesign-dc3jz0 on PR #42. Wave scripts and
                          worktree prep live in the session scratchpad.
```

---

## PROJECT
RivyaLivingArt2.0 — *Rivya Living Art*

## ORIGINAL PROJECT
ResinRiva2.0 — *ResinRiva* (live at `store.bhavyagondaliya.co.in`)

## CURRENT PHASE
**Phase 0 — ZIP import & forensic audit: COMPLETE**
**Phase 0.5 — baseline defect fixes: COMPLETE**
**Phase 1 — brand rename: COMPLETE**
**Phase 2a — art-first storefront: COMPLETE**
**Phase 2b — commission-led copy: COMPLETE** (the proposition surface was one key wider than the homepage)
**Phase 2c — imagery: COMPLETE** (the owner supplied `public/`; verified, committed, and guarded)
**Phase 2d — shop coherence + the staged-media delete hole: COMPLETE**
**Phase 2f #2 — walk Tiptap Json in media-usages to protect body images: COMPLETE**
**Production launch fixes: COMPLETE** (blank env vars · trailing-slash URLs · wa.me number)
**Transformation Phase 0 — forensic audit and roadmap: COMPLETE** (2026-09-02; see SESSION CHECKPOINT)

**Phase 2 is closed.** Phase 2e is five OPEN QUESTIONS for the owner, not pending engineering.

## CURRENT MILESTONE

**The site is LIVE at https://www.rivyalivingart.com** and correct: `/shop` serves the art
ecosystem (1,373 pieces, not the 4,373 mixed catalogue), the brand is Rivya Living Art throughout,
and no old-brand or old-domain strings remain in the served HTML.

Ten PRs merged: Phase 0 (audit) · Phase 0.5 (baseline defects) · Phase 1 (rename) ·
Phase 2a (art-first shop) · Phase 2b (commission-led copy) · production launch fixes.

**The storefront has its photography.** Phase 2c closed the largest open defect: `public/` is
committed, all 62 image slots resolve, and three new guards make its recurrence a red test rather
than a silent 400.

---

## NEXT EXACT TASK

**Owner decision gates.** The ungated half of Transformation Phase 1a shipped on 2026-09-03 (see the
SESSION CHECKPOINT block above); what remains of Phase 1a (D18, D22, D23, D24, D28) and every later
phase waits on the decisions in `docs/transformation-roadmap.md` §2–§3. Phase 2f #2 (Tiptap walk in `media-usages.ts`) is DONE — see
Phase 2f below; the earlier text of this section was stale.

Also open: Phase 2e's five owner decisions, and D7–D28 from the transformation audit.

---

## Phase 2d — shop coherence and the staged-media hole: DONE (2026-08-31)

Six changes, all evidenced against the live catalogue and all verified by reproducing the defect
first. **Corrected figure:** an earlier note here said `/search` lost "~98%" of its hits. Measured,
it is 55–89% depending on the term — still a broken promise on every query, but the number was an
estimate and it was wrong.

### 1 · `/search` promised what `/shop` could not deliver

`/search` searches the whole catalogue; `/shop` has opened on the art ecosystem since Phase 2a. So
"Show all 619" for `pigment` landed on a shelf holding **one** product, and `filament` landed on
**none**. The handoff now carries `&type=all`, restoring the destination's superset property.

| term | promised | before | after |
|---|---|---|---|
| filament | 1,162 | **0** | full page |
| pigment | 619 | **1** | full page |
| keychain | 77 | 7 | full page |
| resin | 1,668 | 23 | 23 |
| table | 996 | 12 | 16 |

`resin` and `table` barely move, because of a **second, independent defect**: `/shop?q=` matches
title and `shortTagline` only — and `shortTagline` is empty on all 4,373 published rows — while
`/search` also reads `description` and expands synonyms. That one changes filtering behaviour, so it
is the owner's call; see OPEN QUESTIONS.

Shipped **with** query-preserving ecosystem tabs, deliberately. `CATEGORY_TABS` hrefs were constant
strings, so pivoting ecosystem dropped `?q=` in both directions — `&type=all` alone would have
landed the visitor somewhere they could not leave without retyping. `q` and `sort` now travel;
`category`/`occasion`/`band`/`stock` do not, because carrying one across composes an unsatisfiable
AND (`?type=supplies&category=gift-collections`).

### 2 · The staged half of every image slot could be deleted

`media-usages.ts` scanned `SiteImage.url` but not `SiteImage.draft`. A save on that surface writes
only the draft, so a staged picture was invisible to the delete guard: deleting it broke the staff
preview at once and the public page at the next Publish, which copies `draft.url` into `url` without
re-checking. **Reproduced before fixing** — `staged -> NOT FOUND (delete would be allowed)` — and
confirmed after: `staged -> [ 'Site image · home.hero (staged)' ]`.

`readStagedImage` moved to a pure `src/lib/site-image-draft.ts`. It had been trapped in a
`server-only` module, which is *why* the guard could not reuse it; it now has six unit tests.

### 3 · Three smaller ones, same bug class

- **Homepage "Featured pieces"** read `buildProductWhere({})` — the identical unconstrained clause
  Phase 2a fixed in `fetchDefaultShopFirstPage`. It rendered art only because all 12 `featured` rows
  happen to be art; featuring one pigment set would have put sanding kits under a commission-led
  hero. No visible change today (verified: top-4 identical).
- **`shopHref` wrote `type` unconditionally**, so every page-1 link was `/shop?type=art` — renders
  identically to `/shop`, disagrees with the canonical, and misses the 300s first-page bundle.
- **`hasActiveFilters` counted the resolved default**, so "Clear all" rendered on an unfiltered
  `/shop` and `emptyCatalogHeading` was unreachable.

### 4 · `media-v3-fetch.mjs` dropped the video poster's LQIP on every re-run

It started from `{}` and looped the 24 image assets, silently dropping the 25th entry written by
`media-v3-video-fetch.mjs`. Now seeds from disk. **Proven:** before → 24 entries, poster absent;
after → 25, byte-identical to the committed file.

---

## Phase 2e — OPEN QUESTIONS for the owner (do not decide these unilaterally)

Each is a real product or SEO judgement call, not an oversight.

1. **Should `/shop?q=` search descriptions?** It matches titles only today, which is why `resin`
   still shows 23 of 1,668. The GIN trigram index already exists
   (`20260820120000_search_trgm_description`), so it is cheap — but it changes what the shop returns,
   which §1.1 puts off-limits without a human.
2. **The "Show all N pieces" label.** Every locale uses an art word — "pieces", "कृतियाँ",
   "કૃતિઓ", "作品" — while N counts the whole catalogue, so it now points at a mixed shelf. Keep the
   number, or move to a non-quantified label? The latter is a nine-language rewrite.
3. **Breadcrumbs on supplies/print pages** put "Shop" at `/shop`, the art shelf, so the trail does
   not walk back up. Recommended: make the visible crumb group-aware but leave the `BreadcrumbList`
   JSON-LD on `/shop`, since the filtered URL declares itself non-canonical.
4. **Canonicals for `?type=supplies|print|all`** — self-canonical, or facets of one page? An
   indexation strategy decision, not 2a cleanup.
5. **Pre-2a `/shop?category=<non-art>` bookmarks** now return zero rows.

### Still open, unchanged
- **`.env.example` is worse than previously recorded.** Besides omitting `DATABASE_URL_UNPOOLED`
  (used by `prisma.config.ts` for migrations), `RESEND_FROM` and `CRON_SECRET`, it still carries the
  RETIRED domain on two lines — `AUTH_URL=` and `NEXT_PUBLIC_SITE_URL=https://store.bhavyagondaliya.co.in`.
  `SITE.url` prefers the env var over its correct fallback, so anyone who copies this file into a
  real deploy inlines the wrong origin into every canonical, sitemap URL, JSON-LD `@id` and OG image
  URL. `src/`, `prisma/`, `scripts/` and `.github/` are otherwise clean of that host — this file is
  the last carrier. `.env*` edits are denied in this environment, so the owner (or a different IDE)
  must do it.
- **Stale counts in `docs/studio-cms/`** still say 57 slots (actual 62). Plan documents, not
  current-state docs.
- **LQIP wiring** (REDESIGN.md §15.5): `media-v3-blur.json` holds 25 real entries and is still
  imported by nothing. The join must key on the **resolved** URL, not the slot fallback — an owner
  override would otherwise paint master A's blur under photograph B. Verified safe against §2.7
  ("no image fades in"): next/image's blur placeholder emits no CSS transition. **Not ~11 call
  sites — there are exactly TWO chokepoints**, `SlotImage` (6 render sites) and `MeniscusImage` (28),
  so one helper covers all 34. Caveat to document in the file header: `prisma/bootstrap.ts` repoints
  every slot at a random-suffixed Blob URL on a fresh production deploy, after which every lookup
  misses and the feature is silently inert in production while local dev still shows blurs.
- **`.github/workflows/mirror-images.yml`** says in its own header it is safe to delete now the
  images are committed. **Naming hazard:** `src/app/api/cron/mirror-images/route.ts` and
  `vercel.json` are a LIVE production cron with almost the same name — do not grep-delete.

---

## Phase 2f — found 2026-09-01 during the Antigravity handover audit

### 1 · The superseded proposition is still live on every page: DONE (2026-09-01)

The footer now renders `tFooter("tagline")` via `src/app/[locale]/(v2)/layout.tsx`, activating the
registered and translated `Footer.tagline` slot ("Handcrafted resin art, made to order.") across all nine
locales (`ar`, `de`, `es`, `fr`, `gu`, `hi`, `ja`, `zh`, `en`). The dead slot in `messages/*.json` is
wired and owner-editable via `/studio/site-copy`.

The superseded "3D printing" proposition has been purged from code fallbacks and metadata:
- `src/lib/constants.ts:24` (`SITE.tagline`) updated to `"Handcrafted resin art, made to order."`
- `prisma/seed.ts:327` & `337` (`SiteSettings.tagline` and `defaultSeo`) updated
- `src/app/manifest.ts:30` fallback PWA description updated
- `blog/[slug]/opengraph-image.tsx:45` & `product/[slug]/opengraph-image.tsx:49` use `brand.tagline`
- `src/app/shared-metadata.ts:13` default title & description updated
- `src/components/studio/settings/seo-form.tsx:100` and `settings-form.tsx:189` placeholders updated
- Automated regression test added in `src/lib/footer-tagline.test.ts` (6 assertions, proven red before fix, now green)

### 2 · `/studio/media`'s bulk "unused" sweep can delete blog-body images irrecoverably: DONE (2026-09-01)

`media-usages.ts` now walks Tiptap Json trees across `BlogPost.content` (and translations),
`Page.content` (and translations), and `CustomBlock`'s `richText` body (and translations).
Extracted pure recursion helper `src/lib/tiptap-media.ts` with comprehensive unit tests
(`src/lib/tiptap-media.test.ts`). Proved failure before fix (all 4 integration tests red), now all green.


---

## Phase 2c — imagery: DONE (2026-08-31)

`public/` is committed: **242 files, 22 MB**, tracked. The owner supplied the directory the
imported ZIP had been exported without. All 62 slots now resolve to a real file, `/_next/image`
returns 200 where it returned 400, and the homepage LCP is the hero photograph again rather than
the `<h1>`.

### It was verified, not assumed

| Check | Result |
|---|---|
| Slot defaults present | **25 / 25** |
| Dimensions vs `media-v3-blur.json` | **25 / 25 exact** |
| LQIP regenerated byte-for-byte | **24 / 25** |
| `process-pour-poster` (ffmpeg-cut, so bytes differ) | same frame — pixel diff **9.1** vs **30.8** for the nearest *different* master, **55.4** median |
| pour-cure scrub frames | **121 / 121** |
| Blog + category covers | **55 / 5** — exactly what `mirror-images.yml` hard-asserts |
| Archive safety | no traversal, no symlinks, no absolute paths, 242/242 media files |

### Why nothing caught it, and what now does

Every gate was green while the site rendered no photography at all. The resolver is total by
construction, the build never resolves these runtime strings, and the design and a11y audits check
alt text rather than whether a picture arrived. Three guards close it:

- **`src/lib/site-images.test.ts`** now asserts each fallback is **on disk**. It previously
  asserted only that the string began with `/`, directly beneath a comment promising the file was
  checked in. That one missing assertion is the whole incident.
- **`src/lib/bundled-media.test.ts`** (new) covers the tracks deliberately outside the slot
  registry and therefore untested: the 121 scrub frames, `CANONICAL_CATEGORIES[].image`, the PWA
  icon, and the LQIP manifest's `src` paths.
- **`scripts/redesign-audit.mjs`** fails any **bundled** image that finished loading with
  `naturalWidth === 0`. Scoped to roots derived from `public/` itself: catalog photography sits on
  supplier hosts this repo does not control, and failing a PR for their downtime would be a gate
  nobody could act on.

All three were proved to FAIL on a deliberately removed file and pass once restored — a guard that
cannot fail is not a guard.

### If the masters ever need rebuilding

Do not regenerate. Every keeper carries a candidate URL, and those URLs were **re-verified alive on
2026-08-31**: a server-side fetch retrieved all four sets (17–51 MB each) eight days after
generation. `node scripts/media-v3-fetch.mjs` on any machine with ordinary internet rebuilds them.
It cannot run in a session — the Higgsfield CDN answers 403 to the agent proxy's egress policy,
which is an organization policy denial to report, not to route around.

**Staging correction:** an earlier version of this runbook said
`git add public/media/v3 src/lib/media-v3-blur.json`. That stages **27 of 242 files** and leaves
`/media/hands-polish.webp` (which backs `home.maker` *and* `about.maker`), all 121 scrub frames,
`icon-512.png`, the 60 blog/category covers and `/media/v6/` still 404ing. The command is
`git add public/`, and it must be atomic: `prisma/reconcile-blog-covers.ts` runs on every deploy and
flips 55 `BlogPost.coverImage` rows to local paths **one way** — once flipped, a later deploy
missing those files 404s permanently with no automated recovery.

---

## Phase 2b — DONE for the homepage; the rest of the surface remains

The homepage proposition and its metadata now lead with commissions, in all nine locales:

| Key | Was | Now |
|---|---|---|
| `Home.hero.eyebrow` | custom resin art · 3d printing · made to order | large-format commissions · resin art · made to order |
| `Home.hero.lead` | "crafts bespoke resin art, personalized gifts and 3D-printed pieces" | "makes large resin work to commission — tables, wall panels and preservation pieces… alongside a collection of smaller pieces ready to order" |
| `Home.meta.title` | Luxury Custom Resin Art & 3D Printing | Commissioned Resin Art & Large-Format Work |
| `Home.meta.description` | rewritten to the same framing | |

`Home.hero.headline` ("Liquid luxury, cast forever.") was kept — it is brand-defining and carries
no product claim.

**The voice was not invented.** The `LargeFormat` namespace already described commissioning large
work honestly in every locale ("Commission large-format resin work in India — tables, surfaces,
wall panels and sculptural pieces, designed around your room and poured to order"). The homepage
was brought into line with the page the site already had, and each translator was told to reuse
that namespace's established terminology rather than coin new terms.

**Phase 2b is DONE, and the remaining surface was far smaller than the plan assumed.** A sweep of
every namespace for the old proposition markers ("3D printing", "personalized gifts", "gifting")
returned ~21 hits, of which almost all are **accurate, not stale** — the studio genuinely sells 3D
printing (400 filaments, 96 printer parts, 4 printed decor) and `gift-collections` is a real
category. `Nav.groupPrint`, the homepage print tile and `Process`'s mention of digital previews all
describe real things and were left alone.

Only **one** key still carried the superseded proposition: `Shop.meta.description`
("luxury resin art, personalized gifts and 3D-printed pieces"). It was doubly wrong after Phase 2a,
because it promised 3D-printed pieces on a page that now opens on the art ecosystem. Rewritten in
all nine locales to describe what `/shop` actually shows, with supplies and printing named as the
further shelves they are.

**CORRECTION (2026-09-01) — the Footer check in this section was WRONG.** It read
`messages/*.json` → `Footer.tagline` ("Handcrafted resin art, made to order.") and called the footer
consistent. That i18n slot is **read by nothing**. What the footer actually renders is
`settings.tagline`, which falls back to `SITE.tagline` — and that still says *"Luxury custom resin
art & 3D printing, made to order in India"*, the superseded proposition, on **every page, in all nine
locales** (it bypasses next-intl entirely). The same string is in five places plus the database:
`src/lib/constants.ts:24`, `prisma/seed.ts:327`, `src/app/manifest.ts:30`,
`blog/[slug]/opengraph-image.tsx:45`, `product/[slug]/opengraph-image.tsx:49`, and the live
`SiteSettings.tagline` row. See Phase 2f below — this is the top open engineering item.

The rest of that check stands: `Nav.megaPortfolioLine`, `Common.announcementDefault` (lead times
matching `CustomOrder`'s anchors exactly) and the Site Settings announcement bar were verified
consistent. `CustomOrder` itself was **already** fully commission-led ("Commission something
bespoke", "what people commission", small vs statement lead times) — so the homepage's new promise
lands on a page that already delivers it.

**The rest of the namespaces are UI chrome, not proposition.** `Shop`'s other 109 keys are filters,
sorts and labels; `Site chrome` is nav and footer mechanics. Translating them is not pending work —
they are already translated and already accurate. Do not treat the slot counts as a backlog.

**A design question this raised, deliberately NOT actioned:** the hero's primary CTA is still
"Explore the collection" → `/shop`, with "Commission a piece" → `/custom-order` as the secondary.
Under commission-led positioning those arguably swap. That is a REDESIGN.md decision about button
treatment (and interacts with §3.1's max-two-champagne-per-viewport rule), not a copy fix, so it is
the owner's call rather than something to change in a copy pass.

Still open from earlier phases:
- **`.env.example`** omits `DATABASE_URL_UNPOOLED` and `RESEND_FROM`; `.env*` edits are denied in
  this environment, so the owner must add them.
- **Stale counts in `docs/studio-cms/`** still say 57 slots (actual 62). Those are plan documents,
  not current-state docs; CLAUDE.md is the authority and has been corrected.

**Two former entries are WON'T-FIX, and both were wrong as written.** They are recorded here so no
future session "fixes" them again — acting on either breaks production.
- **`happy-dom` must stay in `dependencies`.** It is not a test tool here: vitest runs
  `environment: "node"` and never loads it, but `@tiptap/html/dist/server/index.js:7` does a
  top-level `import { Window } from "happy-dom"`, reached from `src/lib/tiptap-render.ts`, and it is
  traced into the serverless bundles for `/blog/[slug]`, `/p/[slug]` and `/terms`. Moving it to
  `devDependencies` breaks any production install that omits dev deps. *This was attempted on
  2026-08-31 and reverted once verified.*
- **`three` must stay too.** It has zero direct imports, but it is a required peer dependency of
  `@google/model-viewer@^4.3.1` (`peerDependencies: {"three": "^0.183.0"}`, matched exactly by the
  pinned `^0.183.0`) and of `@monogrid/gainmap-js`. `@google/model-viewer` is genuinely used — the
  PDP gallery renders it via `src/components/product/model-viewer.tsx`. "Unused" was inferred from
  import count alone, which is the wrong test for a peer dependency.

---

## DECISIONS (answered 2026-08-31 — these are settled; do not re-litigate)

### D1 — Commerce model: **WhatsApp only**
Cart, checkout, payments, `/cart`, `/checkout`, `/account` and customer accounts are **out of scope**.
The conversion path stays: form → `Inquiry` row → `wa.me/917096036250` deep link. The 9-status
inquiry pipeline, the `#RR-<n>` reference format, the claim-token control and the 27 `data-wa-source`
tracking attributes all stay exactly as they are.

### D2 — CMS: **keep and extend the bespoke Studio**
No Payload migration. New domain surfaces (collections, artists, materials, 3D assets) follow the
existing pattern: **registry in code → overrides in the database → a TOTAL resolver**. The 1,181-slot
copy registry, 62 image slots, section arrangement system, scraper review queue, sheet-import wizard
and inquiry board are all preserved.

### D3 — Brand imagery: **generate new imagery for the new domain**
The 20 Cloudinary URLs under `resinriva/` are **not renamed and not migrated**. They are retired in
Phase 2 and replaced with new imagery representing luxury resin furniture, resin art, 3D art and
bespoke work. The existing shots (resin jewellery, keychains, wedding frames) do not represent the
new brand regardless, so migrating them would preserve pictures that get replaced anyway.
**Consequence for Phase 1: leave every `resinriva/` path segment untouched.**

### D5 — Positioning: **commission-led luxury**
Lead with bespoke furniture and large art as **commissions**, not stock. This is the only honest
premium framing available: the catalogue contains **no furniture** — "Resin Furniture & Surfaces"
holds a ₹40 night light and two ₹350 table-top pieces — and the HARD RULE forbids inventing
products. Commission framing needs no inventory, and `/large-resin-art` and `/custom-order` already
do it ("Tables, large wall art and layered preservation work take 3–6 weeks… nothing is
overproduced — no inventory"). The catalogue becomes the smaller ready-made pieces.

### D6 — Supplies: **separated from the art storefront**
The 2,900 supplies and 3D-printing products (1,841 molds/tools, 648 pigments, 400 filaments,
96 printer parts) stay **published and sellable**, but no longer lead the browse. `/shop` opens on
the art ecosystem; supplies and print keep their own tabs, category pages and URLs.
**Implemented in Phase 2a.**

### D4 — CI: **proceed with local verification**
GitHub Actions cannot allocate a runner for this private repository (billing/minutes). The full gate
set is run locally before every push and the results reported explicitly. The owner fixes billing
when convenient; no work is blocked on it.
*(2026-09-02: the premise is gone — Actions executes, run #71 on PR #29. The evidence habit stays for
what `ci.yml` deliberately cannot reach: detail routes, the E2E smoke, widths other than 1440/390.
Formal retirement is owner decision D27 in `docs/transformation-audit.md`.)*

---

## DECISIONS (answered 2026-09-03 — the transformation gates; also settled, do not re-litigate)

The owner answered these against the repository's **current** state, after Phase 0 (PR #29), Phase 1a
(PR #30) and Phase 1b (PR #31) had merged — not against the older checkpoint. All five are YES.

### D28 — The rewind of `main`: **YES, it stands**
Current `main` is the authoritative baseline. The discarded layer is **not** restored wholesale: it was
never one coherent feature — LQIP wiring, CSP, uploads hardening, search and breadcrumb behaviour, docs —
and current `main` has already moved past it (20 commits beyond `f1cfd95`; `950d9ac` is 39 behind and
diverged). Several of those changes have since been re-derived by the Phase 1a and 1b work.

**The rule this sets: recover a discarded change only as an individually reviewed, individually justified
PR, never as a bulk cherry-pick.** `refs/pull/<n>/head` stays readable for reference. A discarded PR is
evidence that a problem was once solved, not evidence that its patch still applies.

### D23 — The legacy un-gated sheet push: **YES, remove it**
`SheetSyncPolicy` becomes the sole authority for sheet writes. `syncSourceToSheet` and its call site come
out of `src/actions/scraper-jobs.ts`, with a regression test proving MANUAL + DONE performs zero sheet
writes. Two write paths into one shared document is how rows get duplicated, and the legacy path ran even
on FAILED jobs. **First code change of the batch, in its own commit.**

### D18 — Dormant v2 files: **YES, delete — but only the audited, proven-unreferenced ones**
By exact path, after proving no import, no dynamic reference, no barrel re-export, no build or CI entry
point. Explicitly NOT a broad "delete anything that looks old" sweep. Dead v2 files are dangerous in this
repository specifically because it already carries several historical transformation layers: a future
reader — or agent — mistakes one for live architecture.

### D22 — The portfolio seed: **YES, keep it, but gate it twice**
The seed stays; it is useful for fresh databases and development. What goes is its ability to behave like
production content initialisation. **Two independent barriers**: an explicit opt-in flag, AND a refusal to
seed when portfolio case data already exists. Production defaults to off. HARD RULE 3 must be structurally
difficult to violate, not a convention someone has to remember.

### D24 — Housekeeping: **YES, with `.env.example` carved out**
Obsolete workflows, tracked artifacts and reports, superseded documentation and stale counts all go, after
reference verification. **`.env.example` is a separate owner change**: the historical PR that fixed it was
dropped in the rewind (D28), so its current state must be verified rather than assumed — and `.env*` edits
are denied in-session regardless.

---

## FILES CHANGED

Baseline commit `32f21a6` — 920 files imported unmodified, 1 file modified (`README.md` replaced by
the ZIP's own).
This commit — added `docs/PROJECT-AUDIT.md`, `PROJECT_STATE.md`, `CHANGELOG.md`. **No source file
has been modified yet.**

## DATABASE MIGRATIONS

43 existing migrations at import, **all applied successfully** to local Postgres 16.13.
History is **purely additive** — zero `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN` across all 43.
*(Correction 2026-09-02: the 44th, `20260831080000_brand_rivya_living_art`, landed in Phase 1; the
history is still purely additive across all 44.)*

## DATA IMPORTS

| Source | Rows in repo | Imported |
|---|---|---|
| `data/tiers/Tier1_Owner.csv.gz` | 373 | 373 |
| `data/tiers/Tier2_ResinGoods.csv.gz` | 34,930 | 1,000 (cap) |
| `data/tiers/Tier3_Supplies.csv.gz` | 21,508 | 2,500 (cap) |
| `data/tiers/Tier4_3DPrint.csv.gz` | 7,685 | 500 (cap) |
| **Total** | **64,496** | **4,373** |

Plus 12 `sheet:owner-ready` drafts → **4,385** `Product` rows total (verified in the local database).

All 64,496 rows are preserved in the repo. Nothing has been discarded.

## ASSETS

- `public/` is **empty** in the ZIP — storefront media lives remotely.
- **20 hard-coded Cloudinary URLs** under cloud `dhaqpl1kz`, folder segment `resinriva/`
  (`src/lib/media.ts:27-56` ×9, `prisma/seed-category-images.ts:27-37` ×11). These are live
  third-party asset addresses — **do not rename the string before migrating the assets.**
- Vercel Blob is the upload target for owner-added media (`@vercel/blob`).
- `docs/media-v3-manifest.json` (43 KB) is an existing Higgsfield prompt ledger — reuse it as the
  basis for `docs/ASSET-MANIFEST.md` rather than starting fresh.
- Local screenshots (not committed):
  `/tmp/claude-0/-home-user-RivyaLivingArt2-0/83dd309e-b407-58b8-bc5b-3f4d88fcfb54/scratchpad/shots/`

## ENVIRONMENT VARIABLES

Required: `DATABASE_URL`, `AUTH_SECRET`.
Load-bearing but **missing from `.env.example`**: `DATABASE_URL_UNPOOLED` (migrations),
`RESEND_FROM`.
Optional: `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`, `EMAIL_FROM`,
`GOOGLE_SERVICE_ACCOUNT_JSON` / `_KEY_B64`, `SCRAPE_SHEET_ID`, `SHEET_ID`, `SCRAPER_USER_AGENT`,
`NEXT_PUBLIC_*` (site URL, WhatsApp number, Meta Pixel, GA4).
**No real credential is committed.** Local `.env` is gitignored.

## TESTS

- Unit: **29 files / 322 tests — all passing** (~2.5s), `src/**/*.test.ts`, node environment.
  *(2026-09-02: now 36 files / 375 tests, plus 2 database-backed files under `tests/db/`.)*
- **Zero** coverage of API routes, server actions, React components. Database queries: two files
  under `tests/db/` since 2026-09-01.
- E2E: `scripts/e2e-smoke.mjs` exists (not run this session — needs a running server + browser).
- **CI has never executed any of it** — see the `ci.yml` `Main` defect. *(Superseded 2026-09-02: run #71
  on PR #29 executed both jobs on a real runner; see BUILD STATUS and D27.)*

## BUILD STATUS

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** (clean) |
| `npm run lint` | **PASS** (clean) |
| `npm test` | **PASS** (322 tests) |
| `prisma migrate deploy` | **PASS** (43 migrations) |
| `prisma/bootstrap.ts` | **PASS** (4,385 product rows) |
| `npm run db:seed` | **PASS** |
| `next build` | **PASS** |
| `next start` + route smoke | **PASS** (12/12 routes 200) |
| `npm run copy:check` | **PASS** (1,181 slots) |
| `node scripts/i18n-missing.mjs` | **PASS** (0 missing in all 8 locales) |
| `redesign-audit` ×4 (1440/390, LTR/RTL) | **PASS** (0 failing rules) |
| `a11y-audit` ×3 (1440/390, RTL 390) | **PASS** (0 critical/serious) |
| `studio-audit` ×2 (1440/390) | **PASS** (30 studio routes) |
| `lighthouse-audit` | **PASS** (home 99/97/96/100 · plp 97/100/96/100) |

**The baseline is green across every CI gate.** Any future red is something the transformation
introduced.

## KNOWN ISSUES

### ~~BLOCKER — GitHub Actions cannot run on this repository~~ — SUPERSEDED 2026-09-02

*Actions executes now: run #71 (`33664201599`) on PR #29 ran both jobs on a real runner. The text below
records the 2026-08-31 state and is kept as history. D4's premise no longer holds; see the SESSION
CHECKPOINT and decision D27 in `docs/transformation-audit.md`.*
`ci.yml` now triggers correctly (fixed in Phase 0.5) and fired [run #1](https://github.com/gondaliyabhavya70960/RivyaLivingArt2.0/actions/runs/33363959495),
the first in the project's history. **Both attempts failed in ~2–6s with `runner_id: 0`, no runner
name, and HTTP 404 on log download** — no step ever executed. The repository is **private** with
Actions enabled, so this is an Actions minutes / spending-limit condition, not a code failure.

Two independent attempts on commit `f3d1ab9` produced the identical signature, ruling out a
transient glitch. The single sanctioned re-run has been spent.

**Owner action required:** Settings → Billing and licensing → Plans and usage → Actions — raise the
spending limit, wait for the monthly reset, or make the repository public (Actions minutes are free
for public repos). Until then CI cannot verify anything, and the local gate run recorded under
BUILD STATUS is the only evidence available.

### Pre-existing defects
15 catalogued in `docs/PROJECT-AUDIT.md` §9; 8 fixed in Phase 0.5. Most severe remaining:
1. **CSP is report-only** with `script-src 'unsafe-inline'` and `img-src https:` (open).
2. `.env.example` ↔ `env.ts` disagree in both directions (open — `.env*` edits denied here).
3. ~~`happy-dom` in `dependencies`; `three` present with zero imports~~ — **NOT defects.** Both are
   genuine runtime requirements; see the WON'T-FIX note above. Closed 2026-08-31.
4. Audit-script port drift `:3111` vs `:3000` (open).
5. Zero tests for API routes, server actions, components or queries (open).
6. `mirror-images.yml` asserts exactly 5 category + 55 blog webp files (open).
7. `fetch-tiers.yml` embeds a Sheet id and gid in three places (open).

Fixed in Phase 0.5: the inert CI trigger, 11 scripts' dead Chromium path, hardcoded dev
credentials, the 4 dead-branch workflow pins, and the stale `README.md` design section.

## DESIGN DECISIONS

- Authoritative design spec is **`REDESIGN.md`** ("Liquid Luxury" v3, 1,413 lines).
  `DESIGN.md` and `CONTEXT.md` are **historical** — `CLAUDE.md:3-11` says so explicitly.
- Tailwind v4 is **CSS-first**: there is **no `tailwind.config.*`**. Tokens live in
  `src/styles/tokens.css` (222 lines) and `src/app/globals.css` (561 lines, `@theme inline`).
  Any token change goes there.
- Existing aesthetic (near-black ground, ivory Instrument Serif display, hairline rules, numbered
  sections, restrained gold) is **already close to the brief's "Liquid Mineral Atelier"**.
  Phase 3 is an evolution, not a rebuild.
- Typography: Instrument Serif / Inter / JetBrains Mono + 5 Noto Sans script faces.
- Motion: GSAP + ScrollTrigger + SplitText (lazy barrel), Lenis (fine-pointer + no-reduced-motion
  only), `next-view-transitions` MorphLink.
- 3D: `@google/model-viewer` only. ~~`three` is unused.~~ *(Wrong — see the WON'T-FIX note above: `three` is
  `@google/model-viewer`'s required peer and must stay. Corrected 2026-09-02.)*

## ARCHITECTURE DECISIONS

- **Stack is current** — Next 16.3.1, React 19.2.4, Prisma 7.9.1, Tailwind 4.3.2. The brief's
  Phase 4 modernization is already satisfied; patch bumps only.
- **Target architecture already implemented**: Vercel + Neon Postgres + Prisma + Vercel Blob. The
  only divergence from the brief is the CMS (bespoke Studio vs Payload) — see D2.
- **Money is `Int` whole rupees, INR only.** No `Decimal`, no `Float`. Correct as-is; any change to
  minor units requires migrating existing rows.
- Server-first: only 3 of 36 storefront `.tsx` files are `"use client"`.
- Middleware is `src/proxy.ts` (Next 16 rename), composing the NextAuth studio guard with next-intl
  routing.
- 9 locales, 1,181 keys each, `localePrefix: "as-needed"`.
- Scraper writes only to `ScrapedProduct`, never `Product`. Import creates `DRAFT` + `needsRewrite`.

## LAST COMMIT

*(Historical — the ZIP-import Phase 0. The current position is the SESSION CHECKPOINT at the top of this
file; `origin/main` is `f1cfd95` and the transformation branch is `claude/session-6h1a70`, PR #29.)*

`32f21a6` — *Import ResinRiva2.0 source as transformation baseline* (920 files, unmodified)
`54974ff` — *Phase 0: forensic audit of the imported baseline* (documentation only)
(this Phase 0.5 defect-fix commit follows)

## SAFE CONTINUATION POINT

*(Historical. Resume from the SESSION CHECKPOINT block at the top of this file, not from here.)*

**Phases 0 and 0.5 are complete and committed.** No application code has been modified — the
changes so far are workflows, previously-broken unwired scripts, and stale documentation.
The baseline is verified green and fully reproducible from `32f21a6`.

**CI is now live on `main`.** Every gate was run locally on the same commit before enabling it.
*(Verified 2026-09-02: GitHub Actions does execute. Run #71, `33664201599`, on PR #29 ran on runner
`1000000932`; the checks job passed typecheck · lint · copy:check · i18n-missing · vitest 36/375 on the
runner, and the build job ran `npm run build` against the Postgres service. The KNOWN ISSUES "BLOCKER"
entry above and `AGENTS.md:188-190` describe 2026-08-31 and are superseded.)*

Resume by answering **D1** and **D2** above, then starting Phase 1 (risk-tiered rename).

### Reproducing the verified environment
```bash
apt-get install -y postgresql-16
PGDATA=/var/lib/postgresql/rivyadata
mkdir -p $PGDATA && chown postgres:postgres $PGDATA && chmod 700 $PGDATA
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $PGDATA -U postgres --auth=trust"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $PGDATA -l $PGDATA/server.log -o '-p 5432 -k /tmp -h 127.0.0.1' start"
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE rivya;"
psql -h 127.0.0.1 -U postgres -d rivya -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# .env (gitignored)
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/rivya"
DATABASE_URL_UNPOOLED="postgresql://postgres@127.0.0.1:5432/rivya"
AUTH_SECRET="local-dev-only-placeholder-value-not-production"
AUTH_TRUST_HOST=true

npm install --legacy-peer-deps
npx prisma migrate deploy && npx tsx prisma/bootstrap.ts && npm run db:seed
npm run typecheck && npm run lint && npm test && npx next build
```
