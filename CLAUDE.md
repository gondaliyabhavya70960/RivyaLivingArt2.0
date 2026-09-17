# Rivya Living Art 2.0

## The canonical repository

**`https://github.com/gondaliyabhavya70960/RivyaLivingArt2.0`** — this one, the
`origin` remote, default branch `main`. It is the only repository this project
ships from: the Vercel project deploys from it, `package.json` records it, and
`git remote -v` is the ground truth if this file is ever wrong.

**A 404 on it means a permissions problem, never a missing repository.**
GitHub answers 404 rather than 403 to a caller who cannot see a repo, so while
this one was private an unauthenticated request could not tell "hidden from
you" from "does not exist". Two separate reviews took that 404 at face value,
concluded this repo did not exist, and wrote entire implementation plans
against the older `RivyaLivingArt` tree instead.
Every path they produced (`lib/sheets/`, `app/(studio)/`, `supabase/migrations/`)
is absent here. Check `git remote -v` before concluding anything about repo
identity; `docs/plan/06-source-documents.md` has the full account.

**Older documents name `ResinRiva2.0`.** That was this repository before the
rename (`docs/RENAME-MIGRATION.md`), not a different project. Those references
survive in dated records — CHANGELOG entries, PROJECT_STATE history, prior
audits, the archived `DESIGN.md` and `CONTEXT.md` — and are deliberately **not**
rewritten, per owner decision D24: editing what a dated document said at the
time would falsify it. Read them as history; read this line as current.

---

Premium resin-art brand site. **The design spec is REDESIGN.md** (Master UI/UX
Redesign Specification v1.0) — read the relevant Part BEFORE building any UI,
motion or studio feature. `docs/redesign-contract.md` is the short version: the
token vocabulary, the review rules and the hard constraints, in the form a
change actually needs. Never invent colours, spacing or animation values; they
are all defined in REDESIGN.md Part 3.

`DESIGN.md` (v2.0 "Midnight Gild") and `docs/design-v7-sapphire-atelier.md` are
superseded and kept for history only.

**`RIVYA LIVING ART_2.0_UI_MASTER_PLAN.md` is not a plan for this repo.** It was
written against an older tree in the superseded v2/v6/v7 vocabulary, assumes a
`motion` dependency that is not installed, and 90% of it is already built,
factually wrong here, or forbidden by the contract above. Do not act on it —
`docs/ui-master-plan-reconciliation.md` verifies all 213 entries against HEAD,
records what shipped, and lists what genuinely remains.

**`docs/plan/` is IN FORCE for the workstreams noted below.** It plans a
storefront/Studio redesign, a scraper rebuild against the owner's
resin-merchandiser brief, the complete removal of Google Sheets, and a
Drive-sourced media pipeline. `docs/plan/README.md` is the index. **What the five owner briefs asked for, and
what is done or still owed, is kept in `docs/COMPLETED-WORK.md` and
`docs/NEEDED-WORK.md`** (tier by tier; the 617 audited rows behind them are in
`docs/audits/2026-09-16/`). Update those two files when a brief item ships or
a decision lands — they are the owner's view of the work.

**THE THREE-TIER PRODUCT ARCHITECTURE is in force** and is the newest thing
here: `docs/plan/07-three-tier-architecture.md`. Large (collectible furniture
and spatial art) · Medium (memory and celebration art) · Small (personal art
and gifting) are three customer intents with different journeys, customization
depth and interface density — not three category filters. Read it before
touching product cards, the PDP, navigation or the scraper's classification.
**One part of that brief conflicts with Part 0 and Part 0 wins:** its Tier 03
flow says "Add to Cart / Checkout", and this project has no cart, no checkout
and no customer accounts. Tier 03 is fast ORDERING through WhatsApp, not fast
checkout; the conflict is recorded in the doc rather than quietly resolved.
Ten more conflicts with §1.1 (T2–T11 in that document — the header's four nav
items, seven proposed product fields, Tier 02's upload flow, a homepage band
that would breach §3.1's dark-band rhythm, a CTA `Inquiry` cannot record) are
tabled there as open questions, not built around.

**THREE COLUMNS ARE CALLED "tier" AND THEY MEAN DIFFERENT THINGS.** This is the
expensive trap in that workstream:

- `Product.tier` — `Int?`, the IMPORT LIST a row came from (1 the owner's
  previous store · 2 resin goods · 3 supplies · 4 3D-print), written by
  `tier-fill.ts` from `data/tiers/*.csv.gz`. It is indexed and it is read by
  `shop.ts`'s DEFAULT SORT, `search-query.ts`'s group ranking, `groupForTier`,
  the import validator, the confirmed export and the demo fixtures' zod shape.
  **Where a product CAME FROM.** **The Studio stopped calling it a tier on
  2026-09-17.** Every label reads "import list" — "List 1 — Owner's store" —
  from `src/lib/import-list.ts`, ONE copy pinned by test to the CSV stems and
  to `PRODUCT_LIMITS`, because "Tier 1 — Owner" and "Tier 1 — Collectible" had
  sat on adjacent screens meaning different things. The column, its values,
  the `?tier=` URL param, the saved-view column key, the CSV headers `tier` and
  `product_tier`, the file stems and the `sheet-import` / `sheet:*` strings
  are contracts and did not move. Only the words did.
- `Product.sizeTier` — the size taxonomy, a nullable `ProductSizeTier` enum,
  shipped 2026-09-15. **What a piece IS.** Nullable because three writers create
  products without passing the product form (the scraper's promote, Bulk Import,
  and `tier-fill.ts` on every deploy) and a `NOT NULL DEFAULT` would break
  backward compatibility and invent data at once. The vocabulary lives once, in
  `src/lib/product-size-tier.ts`, and a test pins that tuple against the
  generated Prisma enum — the scrape-tier list reached FIVE hand-written copies
  before anyone noticed, and the fifth is why three new tiers once shipped
  invisible.
  **The publish refusal is scoped to the TRANSITION, not the state.**
  `describeSizeTierPublishProblem` allows a save of an already-PUBLISHED row and
  refuses only a move INTO published. That is deliberate and load-bearing: the
  column is new, so all ~4,385 catalogue rows are untiered, and refusing every
  save would have stopped the owner editing any of them before a bulk tool
  existed — a guardrail that turns into a lockout. Both `upsertProduct` and
  `setProductsStatus` apply it; the bulk toast names the reason rather than
  reporting a bare "skipped 12". **The backlog is filed by RULE, not by hand** (2026-09-16):
  `src/lib/catalog-size-tier.ts` decides a row from its category (the brief's
  own column, slug by slug) and its own words (step 6's vocabulary, which
  outranks the category only by a decisive margin), never from a category
  NAME, never Collectible on a weak word, and never for a supply — ~3,500 of
  the rows are molds, pigments, filaments and clock hands, and there is no
  fourth tier for "not a piece". `prisma/suggest-size-tiers.ts` runs it from
  `bootstrap.ts` after the CSV fill on production and local builds and
  **SKIPS PREVIEW builds** (a preview runs against production; the
  classification lands with the merge, not the push); the Studio's **Suggest
  tiers** button on `/studio/products` shows the plan first. Both write only
  `sizeTier IS NULL` rows nobody has edited, and one `ActivityLog` row
  (`size-tier-suggest`) records each run.
- `ScrapeSource.tier` — `ScrapeTier`, which supplier list we went looking in.
  Its three SIZE values map to NULL in `TIER_NUMBER` precisely because the four
  old values map onto `Product.tier`'s integers, and numbering a size tier would
  make a purge delete CSV-imported products. **Its Studio word is "source
  tier"**, and its labels live ONCE in `src/lib/scraper/purge.ts` (`TIER_LABEL`,
  `SCRAPE_TIER_SHORT`, `scrapeTierStudioLabel` — which derives "Tier 1 —
  Collectible …" from `SIZE_TIER_NUMBER`/`SIZE_TIER_NAME` and adds "sources"
  where a product-tier control sits on the same screen); the five hand-typed
  copies it replaced were deleted on 2026-09-17.

Taking `Product.tier` over for the size taxonomy is a retype of an indexed
column that live queries sort on — unsafe by the rule above, and it would reach
production on push.

**"Tier" in the Studio means `sizeTier` (2026-09-17).** Product tier, source
tier and import list are the three words, and every screen in the catalogue
flow uses them: the products list and form, the overview (which now carries a
PRODUCT TIERS strip beside the import-list strip), Catalog fill (its four lists
are import lists, and each one shows how its rows WOULD file into the three
tiers by the same rule the deploy-time pass uses), Exports, the scraper's
registry and inbox (the five hand-typed scrape-tier label copies collapsed
into `purge.ts`). Two things were BUILT under that change, not just relabelled:
**Bulk Import accepts a Product Scraper export** — Products type only:
`src/lib/import/scrape-export.ts` remaps the ScrapeDeck columns onto the
products template, a blank category is auto-mapped by `matchCategoryId` and a
blank product tier suggested by `suggestSizeTier`, and every row lands exactly
as the review inbox's Add to catalog lands it — DRAFT, `needsRewrite`, the
same `importSource`/`importRef`, the staged twin marked IMPORTED — so the two
paths are one row to each other and a second upload updates rather than
duplicates; any other template type still refuses the file, and the refusal
now says to pick Products. **Approve on `/studio/products`** is the batch
"confirm rewrite" (`docs/product-lifecycle.md` § Approving): it clears the
guard on the selection, marks the rows owner-touched and publishes the ones
with a tier, behind a dialog that says what it lifts; Publish keeps refusing
flagged rows, because that refusal is the guardrail and Approve is the
explicit act.
Three smaller facts from the same change: `product-filter-links.ts` builds a
`/studio/products` deep link from a filter (the parser's inverse, pinned by
test to parse back) — the overview's two strips, its Suggest-tiers link and
catalog fill's list rows go through it, while the overview's status and stock
strips, `/studio/content-gaps` and the inbox still build the URL as a string;
move each one through `productListHref` when it is next touched; the `sheet-import` run summary carries `sizeTiers` per list ADDITIVELY
(older runs lack the key; a reader treats it as optional); and Bulk Import now
applies the untiered-publish guard the form and bulk Publish apply, scoped to
the transition the same way — it had been the one writer that could still put
an untiered product on the shop.

On 2026-09-15 the owner delegated decisions D25–D29 ("decide by yourself and go
to the next step") rather than answering them individually, so the plan's own
recommendations stand as the ratified positions. **Shipped so far:** workstream
D's asset pipeline end to end (Phase 1); workstream C's Sheets REPLACEMENT (the
confirmed-products export and `/studio/exports`) and then its REMOVAL — the
push engine, the sync policy and the service-account client are deleted;
workstream A's design-system layer (the v4 leading scale, one disabled state,
the Studio's nav groups) and the homepage collections fix. **Workstream C is COMPLETE**: step 4b dropped the schema — the two enums, the
`SheetSyncRun` table and the seven push-state columns are gone, and so are the export script
and its workflow. **The last two columns are gone too**: `SiteSettings.sheetId` and
`sheetTabIds` — the owner's spreadsheet and tab ids, in plan C §2.3's drop list —
survived 4b unread, were un-modelled from `schema.prisma` on 2026-09-16 with
NO migration (step 4a, again), and were dropped by
`20260917110000_drop_sheets_settings_columns` only after #88's client was
DEPLOYED (the #89 production deployment, 16:36 UTC) — the two-PR rule below,
followed to the letter. Nothing Sheets-shaped remains in the schema. **Workstream B is COMPLETE**
(B1–B9: PRs #68–#71, #73, #81–#85, 2026-09-15/16), and workstream A's table is closed — A9's
scraper workspaces (PR #86) were the last row; A2/A4/A5/A6/A8 were measured
against the running site and found already built or corrected in
`docs/plan/01-redesign-main-and-studio.md`. **Workstream E** has shipped steps 0–8 (2026-09-15/16) and the untiered
backlog is filed by rule (below); what remains stops at an owner question —
the navigation (T2), the homepage band (T8), Tier 02's guided path (T4) and
the T2–T11 questions `docs/plan/07-three-tier-architecture.md` tables.

**The export RAN and the table is now DROPPED**
(`docs/archive/sheets-2026-09-15/`, 2026-09-15). The archive holds one row: a
single `PUSH` that never executed because credentials were never configured
(`status: UNCONFIGURED`), plus zero import conflicts. That is the entire push
history this project ever had, and the CSV is now the only copy — the script
and the workflow that produced it were deleted with the table they read.

Where this file and the plan disagree on a fact, this file is the one being
kept current — the plan records what was true when it was written.

## HARD RULES — business model (REDESIGN.md §1.1 · Part 0 wins all conflicts)

- NO payment gateway, online checkout, or cart payment (no Stripe/Razorpay/PayPal).
- NO customer login/membership/accounts. The ONLY login is the staff studio
  (admin/editor roles) at /studio.
- NO AI-invented products, ever. Catalog is filled ONLY by the owner via
  scraper review+approval, Bulk Import (CSV/XLSX), or manual /studio adds.
- Every order finalizes through WhatsApp: Place Order → generate order summary
  → save Inquiry record via Server Action → redirect to wa.me/917096036250
  with the complete pre-filled message.
- The redesign changes the **visual layer only**. Product data, filtering,
  search, customization fields, uploads, Server Actions, auth, Studio/CMS
  behaviour, URLs and routes are off-limits (§1.1).

## Commands

- dev: `npm run dev`
- test: `npm run test` (vitest unit suite over src/lib pure functions)
- e2e smoke: `BASE_URL=… npm run test:e2e` (the ten contract checks plus the
  search overlay, a shop facet, the demo PDP's order flow to wa.me with the
  `[DEMO] ` prefix, the locales, and — with `STUDIO_EMAIL`/`STUDIO_PASSWORD` —
  the Studio login, a media upload, the catalog-fill preview, the testimonial
  permission rule, a product's create → edit → delete, a page-builder block
  save on `/p/demo-lander`, a site-copy draft → Publish → Reset round trip and
  the scraper's refusal of an undetectable platform; database checks need
  `DATABASE_URL`. The wa.me tab is answered inside the browser context — the
  CI runner has real internet and WhatsApp's redirect once failed the check.)
- demo content: `npm run seed:demo` (`--status`, `--remove`) loads the Content
  Lab fixtures into the database `DATABASE_URL` names; the loader refuses any
  non-local host. `npm run test:db` seeds AND removes a demo set of its own —
  re-seed after it before any audit that needs `/product/demo-product-001`.
- CI: `.github/workflows/ci.yml` runs typecheck · lint · copy:check ·
  i18n-missing (+ `--stale` on PRs) · test on every PR to Main, plus the real
  `npm run build` against a throwaway Postgres, `motion-budget`, `test:db`,
  then seeds the demo set, starts the build and runs the E2E smoke,
  `redesign-audit.mjs` (1440 · 1280 · 390 · 360) and `a11y-audit.mjs` over the
  13 public routes plus the five demo detail routes, the RTL set, the keyboard
  paths (chrome overlays and the three lightboxes), the Studio audit at both
  widths and Lighthouse. All of it gates the build.
- typecheck: `npm run typecheck` (tsc --noEmit)

### A MIGRATION HERE IS A PRODUCTION MIGRATION, ON PUSH

`npm run build` is `scripts/migrate-deploy.mjs && tsx prisma/bootstrap.ts &&
next build`, and **Vercel runs it for PREVIEW deployments against the
production database** (`db.prisma.io` — the build's own `db-preflight` prints
the host every time; it is NOT Neon, whatever older comments say). So pushing a
branch applies its migrations to production immediately — not on merge, not on
deploy.

**Every migration must therefore be backward compatible with the code that is
CURRENTLY DEPLOYED, not merely non-destructive.** Between the preview build and
the merge, production runs old code against the new schema.

- Renaming a table or column is **not** safe. Use `@@map`/`@map` to rename in
  Prisma-land only, and leave the database alone.
- Dropping anything is **not** safe, and has no revert. A drop ships in its own
  PR, merged and deployed only AFTER the PR that stops referencing the thing is
  already live.
- Adding a nullable column or a new table is safe.

Learned the expensive way on 2026-09-15: a `SheetConflict → ImportConflict`
rename reached production on push and broke the Studio's sheet-import screens,
settings form and dashboard inbox for four minutes, until a revert migration
landed. The storefront was unaffected — it queries none of those tables.

Worth fixing properly rather than tiptoeing forever: give previews their own
database, or gate `migrate deploy` on `VERCEL_ENV=production`. **Neither is
done, and the retry below does not do it** — it removes one symptom of pushing
often, not the hazard.

**The SYMPTOM that is handled: a build no longer dies because the database was
merely busy.** `scripts/migrate-deploy.mjs` wraps `prisma migrate deploy` and
runs it again (5s · 20s · 45s) when the failure is a connection problem —
`too many connections for role "prisma_migration"`, P1001/P1002/P1017, a
dropped socket, or the advisory lock another build is holding. Two builds per
push against one database is the normal state here, and Prisma Postgres caps
that role low: three migrations inside twenty minutes on 2026-09-15 failed a
build on cadence alone.
**It deliberately does NOT retry a migration that ran and failed** (P3018, "a
migration failed to apply"), nor any error it does not recognise. Prisma
records such a failure and refuses every later deploy until someone runs
`migrate resolve`, so looping would only bury the message that person has to
read. `scripts/lib/migrate-retry.mjs` holds that judgement alone and
`migrate-retry.test.mjs` pins both directions, including the mixed case where
a failed migration also mentions a lost connection — there, "it failed" wins.

**A RECORDED failure (P3009, "migrate found failed migrations") gets one
guarded self-heal per build, and the guard is a fact check, not a judgement.**
`scripts/lib/migrate-resolve-failed.mjs` parses the failed migration's own SQL
into the footprint it declares (tables with their columns, types, nullability
and defaults and their primary key; indexes with uniqueness, method and
columns in order; constraints with their columns, referenced columns and
actions; enum types and values; extensions) and reads the catalog for every
item, comparing each one exactly. It resolves the record only when one of
three facts holds: nothing of it exists and it carries no statement the
parser cannot read (rolled back, the deploy re-applies it); all of it exists
in the declared shape with NOTHING undeclared beside it on the tables it
creates, and it carries no data statement (applied); or some of it exists
in another shape and everything that would have to go holds no data — an
index, a constraint, an enum type, an empty table, or a table the module
declares a DERIVATION (`DERIVED_TABLES`: B8's two, whose writer replaces the
whole set on every recompute) — and nothing that would go is owned by
another migration in the repo (a table, column, index or enum some other
migration declares is live schema, never a stray), in which case the stray
objects are dropped, foreign keys onto them first, and the deploy re-applies
the migration from scratch. Anything else (rows it cannot vouch for, a column
half-added to a live table, a DROP or a RENAME in the migration, a name taken
by an object on another table, a type or an expression it cannot compare)
stops the build with the facts it found and the manual commands. **The whole
heal — the catalog read, the decision, the drop and the record change — is
ONE transaction under Prisma's own migrate lock (`pg_advisory_lock(72707369)`)
with the failed record locked `FOR UPDATE`**, because every push runs two
builds against this database and both see the P3009: the second finds no
failed row and simply runs the deploy again. A migration the guard has
already rolled back twice is refused — a re-apply that keeps failing needs
its error read, not a fourth attempt. **Prisma does NOT run a migration
script atomically** — probed 2026-09-16: the first CREATE TABLE survives the
second's failure — so a partial footprint is a real state, not a theory.
`tests/db/migrate-resolve-failed.test.ts` runs the reader, the transaction
and two concurrent heals against a real Postgres, and reads every additive
migration since the last rename back as exactly applied.

What the guard actually answered, on 2026-09-16: not a cancelled build (the
first account, written from the P3009 line alone) but an ABANDONED BRANCH. A
preview of `feat/b8-analytics-opportunity-score` applied its own
`20260916210000_analytics_opportunity` to production at 08:16 UTC; the B8 that
merged carried a rewritten migration under a new name, and at 09:47 UTC that
one failed on `relation "AnalyticsSnapshot" already exists`. Production sat on
#83 for the rest of the day while B9, A9, #87 and #88 merged. The lesson that
outlives the fix: **a migration pushed on ANY branch is applied to production
under THAT name; renaming or rewriting it afterwards leaves the first one
applied and the second one colliding with it.** A migration's name and body
are final the moment its branch is pushed. `20260917120000_shortlist_stray_link_column`
removes the column that preview left on `ShortlistEntry`.

- lint: `npm run lint -- --fix`
- build: `npm run build` (runs migrate deploy + bootstrap first — needs DATABASE_URL)

### Part 15 imagery (`docs/media-v3-manifest.json`)

- The §15.4 asset set — six collection tiles, the pour/gild/cure/polish story,
  four material macros and ten atmospheric heroes — was generated through the
  Higgsfield MCP and is recorded, prompt by prompt, in the manifest. The masters
  come off the model at 3584px, so §15.5's upscale pass is already satisfied.
- `node scripts/media-v3-fetch.mjs --candidates` downloads all 46 candidates and
  writes a contact sheet; cull to one keeper per id and set `"keeper": "a"|"b"`.
- `node scripts/media-v3-fetch.mjs` then writes one AVIF master per asset into
  `public/media/v3/` plus the 20px LQIP manifest at `src/lib/media-v3-blur.json`.
  next/image generates §15.5's 640–2560 AVIF/WebP ladder from those masters.
- **BUILT (2026-09-15).** The 40 generated stills were culled to one keeper
  each, promoted, encoded and wired: `public/media/v3/` now holds 65 masters
  (4.4 MB) and 20 slots point at the new ones. `--planned` reports
  `55 entries: 12 planned · 3 generated · 0 incomplete · 0 awaiting a cull ·
40 ready to build`, and
  `media-v3-planned.test.ts` asserts exactly that split. What is left is the 3
  SET F loops (a video promote, not this pipeline), the 12 rows nobody has
  generated, and 20 built masters that are deliberately unwired — 5 whose own
  `placement` calls them an "alternative", 6 mobile crops with no `mobileUrl`
  field to land in, and the rest targeting category images that are not slots
  by design. All are selectable from /studio/site-images.
  **The CDN answers 200 again**; the 403 recorded below has lifted, and
  `scripts/media-v3-fetch.mjs` now falls back to the owner's Drive copies
  through `docs/plan/drive-asset-map.json` when it does not. The history below
  is kept because it explains WHY the queue is shaped this way.

- **How it used to read (2026-09-04 · superseded).** Batch D
  recorded the next photography batch — bench concepts, large-format art,
  concept rooms, five process actions, six mobile crops, three loops — as a
  prompt, a placement and a ratio each. On 2026-09-04 every one of them was
  rendered through the Higgsfield MCP (59 renders, two variants each, same
  `model` and `promptSuffix` as the built `assets`; 5 jobs failed and were
  re-run) and the result URLs are recorded in each row's `candidates`. The
  stills come off `nano_banana_pro` at 4k — 3712x4608 and 3072x5504 measured —
  comfortably over §15.5's 2560 floor. **SET F's three loops were generated
  twice**: the first pass took `seedance_2_5`'s defaults, which are 720p and
  audio ON, so the clips were 1280x720 against a 1920 `targetWidth` and carried
  an audio track for a surface `HeroMedia` plays muted and `aria-hidden`. Their
  variant `a` is now a 1080p (1920x1080), audio-free re-run; the 720p clip
  stays as variant `b` marked `offSpec`, the way `videos[0]` already records
  its own too-short first take. 1080p is that model's ceiling, which is exactly
  the entry's target.
  **They stay `status: "planned"` on purpose.** `--promote` flips a row to
  "promoted", and from that moment `bundled-media.test.ts` demands the master
  exist ON DISK and `media-v3-preflight.mjs` demands a culled `keeper` — so
  promoting a row whose file nobody has downloaded turns the build red. The
  file cannot be downloaded here: the CDN holding these URLs answers 403 to the
  agent proxy's egress policy, an organization policy denial to report, not to
  route around. What remains, on any machine with ordinary internet:
  `--promote <id>` (no URLs needed — it falls back to the recorded candidates)
  → `--candidates` and set `"keeper"` → the default run → point a slot at the
  file in /studio/site-images, because a built master is not a wired one.
  `node scripts/media-v3-fetch.mjs --planned` prints the queue, and a
  generated-but-unpromoted row now reads `generated · needs a promote` with its
  exact command: it used to say "needs a generation run" off `status` alone,
  which told an owner holding 56 finished renders to pay for them twice.
  A promoted SET F row is built by `media-v3-video-fetch.mjs`, not the still
  pipeline.
- **Batch E (2026-09-05) added five more sets — 29 entries, 17 of them
  generated.** `varmala-preservation` (7), `gifting` (6), `workshops` (6),
  `atelier` (5) and `studio-chrome` (5), chosen from a slot audit rather than a
  wish list: each entry names the over-worked master it is meant to relieve.
  The queue is therefore MIXED from here on — `--planned` reports
  `55 entries: 12 planned · 43 generated` — and that is the state the tests
  assert, because telling an owner to generate something already rendered is
  the one wrong instruction here that costs money. **Two of the 29 were
  withdrawn the same day**, on review rather than on cost:
  `varmala-before-after` was a 3:2 restatement of the manifest's own
  `excluded[0]` (§15.2 forbids a generated picture standing in for a
  customer's own flowers, and changing the aspect ratio does not change the
  claim the picture makes), and `varmala-floret-macro` had nowhere to land —
  the only 1:1 slots are `about.material1–4.macro`, and §15.3 generated those
  four as one batch on identical ground and light, so swapping one member for
  a different set's frame is the incoherence §15.3 exists to prevent. The remaining 12 stopped at
  a hard wall: **the Higgsfield workspace ran out of credits.** The account's
  "365 Unlimited" model subscriptions are NOT reachable through the MCP API —
  `models_explore` reports `unlim.available: false` and every model, including
  the ones named in the subscription list, rejects `use_unlim` with
  "Unlimited generations aren't supported for <model>". There is one workspace
  (private, max plan), so there is no other balance to switch to. Generating
  the last 12 means either topping up credits or running the recorded prompts
  in the Higgsfield web UI, where the unlimited plan does apply.
  **The maker portrait is deliberately NOT in this queue** — §15.2 forbids a
  generated maker, and a row in a generation queue is an invitation to generate
  it. **These URLs are not permanent** — the previous batch's were
  re-verified alive eight days after generation, so treat that as the working
  window and re-generate from the same prompts if they have expired.
- **DONE — `public/` is committed** (2026-08-31, 242 files, 22 MB). The owner
  supplied the directory that the imported ZIP had been exported without, and
  it is now tracked. Verified rather than assumed before committing: all 25
  files match `src/lib/media-v3-blur.json`'s recorded `width`/`height`
  **exactly**, and regenerating each LQIP from the shipped file reproduces the
  committed `blurDataURL` byte-for-byte for 24 of 25. The 25th is
  `process-pour-poster`, cut from the video by ffmpeg — it is the same frame
  within encoder noise (mean pixel difference 9.1 against its own file, versus
  30.8 for the _nearest different_ master and 55.4 median), not a different
  picture.
- **Before this, everything was green while the site had no photography.** The
  resolver is total by construction, the build never resolves these runtime
  strings, and the design and a11y audits checked alt text rather than whether a
  picture arrived — so all 62 slots 400'd from `/_next/image` and no gate said a
  word. Three guards close that hole and are the reason it cannot recur:
  `site-images.test.ts` now asserts each fallback is **on disk** (it previously
  asserted only that the string began with `/`, under a comment promising the
  file was checked in); `bundled-media.test.ts` covers the tracks deliberately
  outside the slot registry — the 121 scrub frames, `CANONICAL_CATEGORIES[].image`,
  the manifest icon and the LQIP manifest; and `redesign-audit.mjs` fails on any
  **bundled** image that finished loading with `naturalWidth === 0`. That last
  rule is scoped to `public/`-derived roots on purpose: catalog photography sits
  on supplier hosts this repo does not control, and failing a PR for their
  downtime would be a gate nobody could act on.
- **If the masters ever need rebuilding**, everything required is still here and
  regeneration is NOT needed: all 24 assets + the video carry a `keeper`
  (20 `a`, 4 `b`), `docs/media-v3-review/` holds the five contact sheets the
  cull was made from, and every keeper has a candidate URL in the manifest.
  Those CDN URLs were **re-verified alive on 2026-08-31** — a server-side fetch
  retrieved all four sets (17–51 MB each) eight days after generation — so
  `node scripts/media-v3-fetch.mjs` on any machine with ordinary internet still
  works. It ran inside a session on 2026-09-15 — the CDN answered 200
  throughout, so the 403 that policy once produced is not a standing fact to
  plan around. If it returns, `media-v3-fetch.mjs` falls back to the owner's
  Drive copies (`scripts/lib/media-v3-drive.mjs`), verified byte-identical to
  the CDN's. The two Actions workflows that used to run it on
  a runner (`fetch-media-v3.yml`, `fetch-media-v3-video.yml`) were deleted under
  D24 — each said in its own header it was safe to delete once the masters were
  committed, and they are. Rebuilding now means running the script on an
  ordinary machine; `git log --diff-filter=D` has the workflows if a runner is
  ever wanted again.
- **Wired.** 74 of the 78 slots default to these masters. Four keep what they
  had: `home.maker` and `about.maker` (§15.2 — the maker is never AI, and
  `site-images-import.test.ts` records that the file behind them is itself a
  generation, which is the owner's to replace with a real photograph) and the
  process hero video with its poster. A 10-second video **was** generated
  (2026-08-26) and culled to keeper `b`; the poster is cut from frame 0 of that
  same clip by `scripts/media-v3-video-fetch.mjs`, which is what keeps a poster
  matching the video it stands in for. Twelve alt keys described the frame being
  replaced and were rewritten across all nine locales — the rest were left
  alone because the slot→master mapping was chosen to keep them true.
- One master is deliberately unused: `tile-keep` (it belongs to the homepage
  collection band, which reads the owner's `Category.image`). It is selectable
  from /studio/site-images.
  **The 404 carries a picture again (2026-09-17, owner instruction.)** This
  line used to read "the design puts no image on the 404" and name `not-found`
  as unused alongside it. Plan §2.10 asks for `visual-404.jpg` full-bleed;
  REDESIGN.md §11.11 says the page is the heading, a search field, four
  collections and WhatsApp, "No cartoon". Those are not in conflict — "no
  cartoon" rules out an illustration apologising for the error, not
  photography — so §11.11's content is untouched and the vortex sits behind it
  under a veil weighted to the reading order. Every text node was measured
  against the rendered pixels rather than the CSS stack: the lowest is 6.94:1
  against a 4.5 floor. The `/redesign/visual-404.jpg` reference is bundled and
  NOT a slot: a 404 is what renders when things are already going wrong, and
  `getSiteImages()` would put a database read on the one page that has to work
  without one.

### The studio CMS — one pattern, ten surfaces

`docs/studio-cms/` is the plan; it is now built. Every surface follows the same
shape, and the shape is the point:

    registry in code   →   overrides in the database   →   a TOTAL resolver

The registry is the source of truth for what EXISTS. The table stores only what
the owner CHANGED. The resolver is total, so an empty table, a fresh database
and an unreachable one all render the page the repo ships with rather than a
blank one. Adding a surface means following this, not inventing a ninth shape.

| Surface                                 | Registry                                                                               | Table                                     | Resolver                            |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| `/studio/site-copy`                     | `site-copy.generated.ts` (1,297 slots; `npm run copy:registry`)                        | `SiteCopy`                                | `getSiteCopy()`                     |
| `/studio/site-images`                   | `site-images.ts` (78 slots)                                                            | `SiteImage`                               | `getSiteImages()`                   |
| `/studio/forms`                         | `form-options.ts`                                                                      | `FormOption`                              | `getFormOptions()`                  |
| `/studio/navigation`                    | `nav-menus.ts`                                                                         | `NavMenu` · `NavItem`                     | `getNavMenus()`                     |
| `/studio/sections`                      | `page-sections.ts` (7 pages)                                                           | `PageSection`                             | `getPageSections()`                 |
| `/studio/process` · `/studio/materials` | `page-sections.ts` (`process-steps` ×10, `materials` ×4 — the same board pre-filtered) | `PageSection`                             | `getPageSections()`                 |
| `/studio/custom-pages`                  | `custom-blocks.ts` (16 types)                                                          | `CustomPage` · `CustomBlock`              | `getCustomPage()`                   |
| `/studio/media`                         | —                                                                                      | `Media`                                   | —                                   |
| `/studio/settings` · `/studio/seo`      | `constants.ts` (fallbacks)                                                             | `SiteSettings`                            | `getSiteSettings()`                 |
| `/studio/content-lab`                   | `prisma/fixtures/demo/*.json` (`src/lib/demo/`)                                        | every content table, rows marked `isDemo` | `showDemoContent()` · `demoWhere()` |

Four rules that hold across all of them:

- **A save is a DRAFT.** Copy and images stage in `draftValue`/`draft`, preview
  behind the staff cookie (`/api/draft`), and publish per SURFACE — a page
  rewrite reaches visitors as one change, not forty. `ContentRevision` keeps
  history; restore goes back into the draft, never straight to live.
- **Guardrails refuse, they do not warn.** `describeArrangementProblem` and
  `describeBlockArrangementProblem` enforce REDESIGN.md §3.1's band rhythm and
  Part 17's single `h1` at save time, because CI does not run when an owner
  presses Publish. They also run in the board before the call, since
  `runAction` reports every throw as "something went wrong".
- **Landing pages are the ONE place content lives in the row** (§4.8). A
  seasonal lander has no copy slot because nobody wrote one. The guard against
  layout rot is the block catalogue's SIZE — sixteen types since the Phase 11
  growth (readers of existing content, film, and picture blocks; no prices, no
  per-block theme), asserted by a test that records the dated reason for every
  count bump. Scheduling is resolved at read time by `isLive()`, never by a cron.
- **A section can ship OFF.** `SectionDef.defaultVisible: false` (the
  homepage's furniture and rooms bands, the large-format page's pieces band)
  renders nothing until the owner turns it on in the sections board; the
  resolver reads `row?.visible ?? def.defaultVisible ?? true`.
- **Demo content is real rows, always marked, never in the index.** The Content
  Lab seeds fixtures with `isDemo: true`; every public reader spreads
  `demoWhere()` — rows show only when `SiteSettings.demoContentPublic` is on or
  `VERCEL_ENV` is not `production` — with `<DemoMark/>` and `noindex`, and the
  sitemap, Product/Article/Review JSON-LD and the image mirror exclude them by
  clause regardless. A demo order is saved with
  `Inquiry.isDemo` and its WhatsApp message carries `[DEMO] `.
- **A testimonial publishes only with permission.** `describeTestimonialProblem`
  refuses `PUBLISHED` unless `permissionStatus` is `GRANTED` (on a save — rows
  back-filled by the migration stay live until edited); the Review JSON-LD
  includes only PUBLISHED ∧ GRANTED ∧ not demo.
- **Every new table that stores a media URL goes into `media-usages.ts` in the
  same commit.** That header rule was broken three times in one week and each
  break was silent — the worst 404'd only the phone layout.

### The redesign asset set (`public/redesign/`, 2026-09-17)

The SECOND generated asset set, and the second blur manifest. Both exist for
reasons that are expensive to rediscover.

- **`public/redesign/` holds two sets and the difference is binding.** Fifteen
  BRAND files (`hero-pour`, `texture-resin-flow`, the three doorways, the four
  product stills, the two in-situ frames, `testimonial-home`, `visual-404`,
  `og-home`) are publishable and back twelve slot fallbacks. Forty-five
  CATALOG files under `catalog/{heroes,scenes}/` are placeholders for products
  that do not exist and may NEVER be the cover of a purchasable one.
- **`scripts/optimize-redesign-assets.mjs`** is the pipeline (plan §5.4): the
  Drive drop in `assets-inbox/` (gitignored) → WebP q82 → `catalog/`, plus one
  LQIP manifest. `--check` verifies without writing. Sources never enter git —
  the raw PNGs are ~2.2 MB each.
- **`src/lib/redesign-blur.json` is SEPARATE from `media-v3-blur.json` on
  purpose.** `media-v3-fetch.mjs` rewrites that file WHOLESALE on every run, so
  redesign rows added there would survive until the next Part 15 fetch and then
  vanish, taking every placeholder with them and leaving no test to say why.
  `lqip.ts` merges the two at read time and `lqip.test.ts` pins that they stay
  disjoint — a duplicate `src` would mean two generators disagreeing about one
  picture, resolved silently by insertion order.
- **`bundledProvenance` counts `/redesign/` as AI**, like `/media/v3/`. Calling
  it BUNDLED told the §12.5 provenance filter that fourteen generated pictures
  were photographs.
- **`src/lib/site-videos.ts` holds the bundled loop defaults** and is
  deliberately NOT a site-image slot: `importBundledSiteImages` copies slot
  defaults into Blob and repoints them, and `HeroMedia` derives the WebM twin
  from the MP4's PATH — a Blob URL has no twin, so the 2 MB MP4 would become
  the only file every visitor gets. `SiteSettings.heroVideoUrl` is still the
  override; the bundled loop is only the floor. The delivered loops were
  re-encoded to meet §15.4 (they arrived at 4.1/4.3 MB against a ≤2.5 MB
  ceiling, with `moov` AFTER `mdat`, which defeats the `preload="metadata"`
  the same line requires); `site-videos.test.ts` reads the box order rather
  than trusting the encode.

### THE PLACEHOLDER RULE — `/redesign/catalog/` is never a product cover

`src/lib/placeholder-assets.ts` is the ONE copy of this vocabulary (path
prefix, filename pattern, cover resolution, the refusal). Path-based,
presentation-layer, no column and no migration (plan §4.6, §7).

Why the cover specifically: the PDP resolves `product.ogImage ||
product.images[0]?.url`, so with no explicit OG image the cover becomes the
WhatsApp link-preview card — and every order here finalizes in WhatsApp. A
placeholder cover is the picture a customer sees while agreeing to buy
something else.

**It refuses on every SAVE, where `describeSizeTierPublishProblem` refuses only
at the TRANSITION into published — and that difference is deliberate.** The
size-tier guard exempts already-published rows because a ~4,385-row untiered
backlog would have made a state-scoped refusal a lockout. That is a PREMISE,
not a principle, and it is false here: the placeholders arrived with the
ingestion and nothing points at one. Copying the scoping would have imported
its known hole — publish clean, swap the cover, re-save — without the 4,385
rescued rows that pay for it. Applied in `upsertProduct` (reads the INCOMING
images; the save may be what puts the placeholder there), `setProductsStatus`
and `approveProducts`. Bulk Import cannot introduce one (`isUrlish` rejects the
path) and the scraper promote writes DRAFT.

In the bulk path the skip cannot be a `where` clause: the cover is
min(`order`) and Prisma has no predicate for that, so covers are read and
filtered in TS.

### Site Images (`/studio/site-images`)

- The storefront's editorial photography is no longer hardcoded. Every call
  site is a **named slot** in `src/lib/site-images.ts` (78 slots, 25 bundled
  files — the count grew from 62 with the furniture/rooms concept tiles and the
  four new process steps, then to 78 with `home.collections.create` and
  `home.workshops`, and 78-over-25 is why batch E exists: `tile-live.avif`
  alone backs eight slots and `tile-create.avif` seven) carrying its surface,
  the ratio the layout crops to and the `public/media` file used when the owner
  has not replaced it.
- Pages read `getSiteImages()` (`src/lib/site-images-server.ts`) — a total map,
  so an unset slot always resolves to a file that exists in the repo. Cached
  24h behind the `site-images` tag, invalidated by the studio actions.
- `SiteImage` (key → url/mediaId) stores only overrides. Reset is a DELETE.
- The **Import bundled images** button on that screen copies every default into
  storage (Vercel Blob in production, `public/uploads` locally) and repoints its
  slot, one upload per distinct file. Idempotent — slots already changed are
  skipped. `prisma/bootstrap.ts` runs the same routine on deploy so a new
  environment comes up Blob-backed without anyone logging in; it is gated on
  `BLOB_READ_WRITE_TOKEN` (no token ⇒ `putFile` would write into the build
  container's throwaway disk) and on the table being empty (reset-to-default is
  a row DELETE, so re-importing every deploy would undo it).
- Slot values are restricted to site-root paths or hosts in `next.config.ts`'s
  `remotePatterns`; next/image throws at request time on anything else.
- Two things are deliberately NOT slots: `public/sequences/pour-cure/*` (121
  canvas-scrub frames — one animation, not editorial imagery) and
  `CANONICAL_CATEGORIES[].image` (seed defaults for `Category.image`, already
  editable in the category editor).

### The Product Scraper → Studio pipeline

Full docs in `docs/scraper.md`, `product-lifecycle.md`,
`studio-workflow.md`, `source-adapters.md`, `troubleshooting.md`. The rules
below are the ones that are expensive to rediscover.

- **Staged rows are immutable.** `ScrapedProduct` is what the site said;
  promotion writes a separate catalog `Product`. Corrections never edit the
  staged row, so a normalisation change needs no re-scrape.
- **Owner edits outrank every writer.** Both the CSV importer and the
  scraper's promote path refresh availability ONLY when `ownerTouched` — never
  content, never images. The rule lives once, in `merge-policy.ts`, and is
  checked BEFORE `needsRewrite`. It used to be checked after, which silently
  overwrote edited products and deleted their galleries (fixed, Phase 9).
- **One run per source.** A second Scrape returns the job already in flight
  rather than queueing a duplicate — that is what makes the action idempotent.
  `QUEUED` counts as in flight. Applies to the tier fan-out too.
- **A scrape now finishes with the laptop closed** (B1, 2026-09-15). It used
  not to: the `use-scrape-runner.ts` poll loop was the ONLY caller of
  `continueScrapeJob`. `/api/cron/scrape-drain` (every 10 min, `vercel.json`)
  drives the same advance server-side. The logic lives in
  `src/lib/scraper/job-runner.ts`, NOT in the action — **an export of a
  `"use server"` module is a callable server action**, so a session-free
  `advanceScrapeJob` beside `continueScrapeJob` would be an unauthenticated
  "crawl this site for me" endpoint. The drain takes only jobs whose heartbeat
  has been idle two minutes and never `isDemo` rows; the per-page CAS on
  `cursorPage` already makes concurrency safe, so the idle rule is politeness
  — a CAS cannot un-send a request to a supplier.
  **The cron needs `CRON_SECRET` set on the Vercel project, and nothing tells
  you when it is not.** Vercel sends `Authorization: Bearer <CRON_SECRET>`
  only when the variable exists; the route fails closed (401) without it, and
  a 401 on a cron is silent — no dashboard error, no email. Production ran
  that way from B1 (2026-09-15) until 2026-09-17 01:36 UTC: 144 drain calls
  in seven days, every one a 401, found only by reading the runtime logs after
  #93's rollout had queued nine jobs that nothing collected. Adding the
  variable needs a REDEPLOY to take effect. `DEPLOYMENT.md` §12 names the
  three routes it protects.
- **Five consecutive failures pauses a source.** Resume clears the pause AND
  the counter; a success resets it to zero rather than decaying.
- **`CONFIRMED_PRODUCTS ≡ { p : p.confirmedAt IS NOT NULL }`.** Nothing but the
  Confirm action sets it. There is no path from scrape to confirmed.
- **THE GOOGLE SHEETS API INTEGRATION IS GONE** (plan C, 2026-09-15). The push
  engine, the per-source `MANUAL`/`ON_COMPLETE`/`OFF` policy, the Sheet1
  linking, the service-account client, the `SheetSyncRun` history screen and
  the four `GOOGLE_*`/`*SHEET_ID` env vars were deleted. **No credential in
  this repo reaches Google, and nothing WRITES to a spreadsheet.** The owner
  exports the confirmed list from `/studio/exports` as CSV or XLSX instead — on
  demand, rather than on every scrape.
- **Step 6 is DONE: the service account is revoked and the spreadsheet is
  un-shared** (2026-09-15). Consequences, which were predicted and are not
  bugs: `.github/workflows/fetch-tiers.yml` had no source left to read and was
  deleted (`git log --diff-filter=D` recovers it), and `data/tiers/*.csv.gz`
  are now the ONLY copy of the tier data — refreshing them means committing new
  files, not running a workflow.
- **Bulk Import's Google Sheet link still works and was NOT affected.**
  `fetchGoogleSheetCsv` in `src/lib/import/parse.ts` takes ANY
  `docs.google.com/spreadsheets/…` URL the operator pastes and fetches its
  public CSV export; it never referenced the owner's own spreadsheet. Only that
  one document became unreadable. (An earlier note here said step 6 would break
  this feature — it does not.)
- **What is still called "sheet" is NOT Google Sheets.** `/studio/catalog-fill`
  (was `/studio/sheet-import`) and `src/lib/import/tier-fill.ts` read committed
  CSVs from `data/tiers/*.csv.gz` and always did. The conflict queue that fill
  writes was renamed `SheetConflict → ImportConflict` before the deletion,
  precisely so nobody removing "the sheet things" takes the catalog importer
  with it.
- **Two `"sheet"` strings are STORED DATA and are frozen.** `ActivityLog.action
= "sheet-import"` (written by `tier-fill.ts`, read back by the catalog-fill
  screen's "last run") and `Product.importSource = "sheet:*"` (matched by
  `startsWith` in half a dozen queries). Renaming either would orphan every
  existing row from its reader — the same class of break as renaming a column.
  Other action strings moved with the rename, so history holds both spellings.
- **CSV→catalog fill has run on every deploy since long before it was a
  feature** (`bootstrap.ts` → `import-tiers.ts`). Its settings all default to
  that behaviour, so a fresh environment still self-populates on first boot.
  The blast-radius cap guards CREATES specifically — the direction that hurts.
  **The Studio's own Preview / Run now read nothing until 2026-09-17**: the
  fill resolved `data/tiers/` from `__dirname`, which is a `.next/` chunk
  folder under the running server, so both buttons answered zeros on every
  environment. The root is `process.cwd()` now, and `next.config.ts` traces
  `data/tiers/**` and `data/rewrites/**` into the catalog-fill route's
  function — a `readFileSync` of a computed path is invisible to Vercel's
  tracing, so without that include the files are simply not in the function.
  Production's Preview after the merge is the proof; it writes nothing.
- **Deleting a product never touches the staged scrape rows.** Those record
  what a supplier's site said; a deletion here does not un-happen the scrape.
  The `DeletedImport` tombstone written by the delete is what stops the next
  CSV import resurrecting it.
- **Emptying the catalogue takes TWO things, and tombstones are only one.**
  `npm run products:purge` (dry run by default; `--confirm` to write) deletes
  products and writes a `DeletedImport` per row, which stops those exact rows
  returning. That empties Tier 1 — 372 rows, no cap — and does NOT empty Tiers
  2-4, because `planTierRows` applies the cap AFTER the tombstone filter and
  the pools dwarf the caps (35,128 / 21,508 / 7,685 rows against 1,000 / 2,500
  / 500). Measured, not assumed: a purge plus redeploy on a real 4,385-product
  catalogue re-created 4,000 DIFFERENT products. So a `--confirm` run also
  switches `catalogFill*` off, and `tier-fill.test.ts` pins both halves.
  Inquiries and testimonials are `SetNull` and survive every purge.
  **The Studio's bulk delete writes the tombstones but does NOT switch the
  fill off.** On 2026-09-16 the owner emptied the catalogue that way (4,012
  rows, 16:57 UTC); `20260917130000_catalog_fill_off_after_purge` set
  `sheetFillOnDeploy = false` in the same push that would otherwise have
  refilled it with ~4,000 different supplier rows. The deploy-time fill is
  now OFF in production; `/studio/catalog-fill` can still run it by hand or
  turn it back on.
- **`ScrapeTier` now carries the owner's SIZE taxonomy** (2026-09-15):
  `LARGE_FORMAT` · `MEDIUM_FORMAT` · `SMALL_FORMAT`, ahead of the four retired
  provenance values. **`TIER_NUMBER` maps the size tiers to `null` and that is
  load-bearing**: those numbers are not labels, they are `Product.tier` values
  written by the catalog-fill importer from `data/tiers/*.csv.gz`
  (`Tier1_Owner.csv.gz` → 1). A size tier never came from one of those files,
  so numbering `LARGE_FORMAT: 1` "to keep the sequence tidy" would make purging
  large-format sources delete every product imported from Tier 1. `tierNumbersFor`
  drops the nulls, and a test pins the rule with that reason.
- **The registry was emptied back to the owner's own 8 on 2026-09-15**, then the
  owner's ten reference sites were filed under the size tiers — all
  `enabled: false` and PENDING, so nothing collects until reviewed.
  The full history: It was
  115. All three non-owner tiers went, on the owner's instruction, because the
  business is LARGE-FORMAT RESIN ART: 20 SUPPLIES and 29 PRINT3D first (by the
  registry's own tiering, neither raw materials nor 3D printing is resin art),
  then all 58 RESIN_GOODS — a list of mostly small-item resin sellers, which is
  a different market from large pieces. What remains is TIER 1 ONLY
  (`src/lib/scraper/seed-data.ts`, seeded by `prisma/bootstrap.ts`): 3
  WooCommerce, 5 UNKNOWN, including WoodenSure and Saashi, both of which do
  sell large-format work.
  **The tier enum values all STAY.** `ScrapeTier` keeps RESIN_GOODS, SUPPLIES
  and PRINT3D: existing database rows still carry them, operators can still
  file a new source under any of them, and removing an enum value is a
  destructive migration for no gain. `applySeedSources` only ever upserts, so
  the rows it stopped listing SURVIVE in the database — the sources screen's
  "Remove all …" buttons are how those go, which keeps the deletion an
  operator's decision rather than a deploy's side effect.
  **Rebuilding the list means verifying each site, not generating one.** A
  supplier name that was never checked is a fabricated crawl target; one
  candidate found by search on the day (`iqracreationonline.co.in`) did not
  resolve at all. Everything added lands `policyReviewStatus: PENDING`, so the
  gate below blocks collection until a human records a review anyway.
  A source still carries the note **"NO scrapeable catalog (verified:
  enquiry-only). Do NOT scrape"** — which was prose nothing enforced until
  that gate.
- **A REGISTERED SOURCE IS NOT AN AUTHORISED ONE** (plan §5, 2026-09-15).
  `enabled` says whether the operator WANTS a source; `collectionMode` and
  `policyReviewStatus` say whether we are allowed to collect it, which nothing
  asked before. `policy.ts` holds the decision — `describeUnauthorizedRun`
  mirrors `breaker.ts`'s "may I run right now", and the two are deliberately
  separate: a breaker pause is about the SITE being down and clears by waiting;
  a policy block is about US and does not.
  **It fails closed.** `PENDING` is the default every migrated row got and it
  REFUSES — a gate whose unreviewed state is "go ahead" only ever says yes.
  Checked at all three points a job can move: `createScrapeJob`,
  `createTierJobs` (as a `where` clause — `AUTOMATABLE_SOURCE_WHERE` — because
  the fan-out is where a forgotten check queues a hundred jobs), and
  `advanceScrapeJob`, which re-checks on EVERY advance: a job can sit QUEUED
  while the owner blocks its source, and the cron drain would otherwise pick it
  up ten minutes later with nobody watching. `MANUAL_RESEARCH` outranks an
  approval — a source with no automated path does not become crawlable by being
  allowed. The owner clears it per source on `/studio/scraper/sources/<key>` or
  in bulk from the registry's selection bar; the record stamps who and when.
  **The reference rollout (2026-09-16 evening)** is the one deploy-time writer
  of that record, and it is a ONE-SHOT: `src/lib/scraper/backlog-rollout.ts`
  carries the owner's written instruction to rebuild the emptied catalogue
  from the reference sites — reviewer `owner-instruction:2026-09-16`, the
  authority and the site's own evidence in the note — and `prisma/seed-scrape-backlog.ts`
  applies it after the registry reconcile: review, enable, `maxProducts` 500,
  first job. It never touches a source a person has ever reviewed (the
  `policy-review` activity is the tell), never a source that has ever had a
  job, and never runs on a preview build. Nine sources were verified
  automatable with this repo's own scraper before they were listed (the
  CHANGELOG has the table); the seven with no automated path are filed as
  manual research with the reason. **Nothing this queues enters the
  catalogue by itself** — the review inbox stays the only path.
- **The review inbox selects by FILTER; the writes stay the old ones**
  (2026-09-17). `/studio/scraper/review` filters by source, by the SOURCE's
  tier and by the SUGGESTED product tier — two different filters, because a
  large-format studio sells coasters too; the suggestion is `suggestSizeTier`
  over the twin at read time, never a column. "Select all N matching" makes
  the filter the selection on every page (the view caps at 200 rows; the
  selection does not). `resolveInboxSelection` is a staff-only READ that
  answers what the filter covers; the moves and the import go through
  `setShortlistState` and `addScrapedToCatalog` in batches
  (`src/lib/scraper/inbox-batch.ts`), so a 500-row approval is 500 rows of
  the same audited path, and a stopped run resumes because every imported
  twin leaves the importable set. The legacy one-category import dialog and
  its two actions are gone — an exported `"use server"` function with no
  caller is still an endpoint.
- **DROPPING A COLUMN TAKES TWO PRs HERE, and the reason is the generated
  client.** `db.scrapeSource.findMany()` with no `select` makes Prisma emit an
  explicit column list, so the moment a column disappears from the database the
  CURRENTLY DEPLOYED client asks for a column that is not there and every query
  on that table fails. Removing the field from `schema.prisma` is what stops it
  being asked for. So: PR one removes the fields and the code that reads them
  and ships NO migration (the database keeps the columns, filled by their own
  defaults — verified by seeding against exactly that state); PR two drops them,
  once the first is live. Phase 4 did exactly this: step 4a
  (PR #74) removed the fields and shipped no migration, and step 4b dropped
  them only once 4a's production DEPLOYMENT was live — **merged is not
  deployed**, and the window between them is precisely when the old client is
  still asking for the columns. `SheetSyncRun` was the one exception, kept
  through 4a because nothing on a request path read it and the one-off export
  script had to keep working while its table was still the only copy of the
  data; it went with the drop. **And a failed build is not a safety mechanism.** The C-tail drop
  (`20260917110000_drop_sheets_settings_columns`) was pushed once at 13:35 UTC
  on 2026-09-16 with #83's client still deployed and selecting both columns;
  the P3009 that was failing every build that day is the only reason it did
  not run. Read the production deployment's commit before pushing a drop,
  every time — the 16:48 push waited for exactly that.
- **Extraction failures are recorded, not nulled.** The checked fields are the
  same ones that block confirmation, so clearing `/studio/scraper/quality` is
  what unblocks the final list. Fields most storefronts never publish are
  deliberately not checked.
- **A mapping fix needs no re-scrape** (B4, 2026-09-15). `NormalizationAlias`
  (kind → rawValue → canonicalValue, owner-editable) is resolved at READ time
  by `alias-resolver.ts`, in the Studio CMS's own shape: built-in maps in
  `normalize.ts` → overrides in the table → a TOTAL resolver that returns the
  value unchanged when nobody has an opinion. An empty table behaves exactly
  as the code did before it existed; a row WINS over the built-in map. Correct
  an alias and every snapshot ever captured re-labels on the next read — which
  works ONLY because `rawPayload` keeps the source's own words.
- **B2 shipped `rawPayload` storing the NORMALIZED row, not the raw one**, and
  said the opposite in three places. Fixed in B4 and pinned by a db test,
  because it quietly defeated the point of both phases: a snapshot is meant to
  be what the SOURCE said, and compute-time normalization can only re-apply a
  corrected mapping if the raw value survived.
- **`ScrapedProduct` holds the LATEST state; `ProductSnapshot` holds the
  history** (B2, 2026-09-15). The staged row is upserted on
  `(sourceKey, externalId)`, so a re-scrape overwrites its title, price and
  description. `ResearchProduct` is the identity that outlives that, and
  snapshots hang off it — written on first sighting and thereafter **only when
  `contentHash` moves**, the same rule as price history and for the reason its
  comment already gives. `lastSeen` is touched on every sighting, so a gap
  between snapshots means the source said the same thing throughout it. The
  dual write sits in `upsertPage`; the promote path is untouched.
- **Check a generated migration against the statements you meant.** `prisma
migrate diff` proposed dropping `Product_{title,shortTagline,description}_trgm_idx`
  alongside B2's two new tables: those indexes are created as raw SQL by
  `20260814050000_search_trgm` and `20260820120000_search_trgm_description`,
  which `schema.prisma` does not model, so `diff` reads them as drift.
  Shipping it would have deleted the storefront's search indexes in
  production. B2's migration is hand-written for exactly that reason.
- **Quote-only is not free** (B3a, 2026-09-15). Every `ProductVariant` carries
  a `PriceBasis` (`PER_PIECE` · `PER_AREA` · `STARTING_FROM` · `QUOTE_ONLY`),
  and a QUOTE_ONLY row stores a **NULL price, never 0** — `priceForBasis` in
  `price-basis.ts` is the one place that rule lives. Aggregates must exclude it
  **by clause** (`priceBasis: { not: "QUOTE_ONLY" }`), never by filtering
  zeros: a zero meaning "no price" cannot be told from a zero meaning "free",
  and a supplier can publish the second. Before this, a bespoke studio with no
  published price and an adapter that failed to parse one were the same thing
  — `priceMin: undefined` with `showPrice: true` hardcoded in all three
  adapters.
- **The adapters always parsed variants and threw them away.** Shopify's
  `variants[]`, WooCommerce's `price_range`, JSON-LD's `offers[]` all collapsed
  to a min and a max. They now also surface `RichProduct.variants`, written to
  `ProductVariant` alongside each snapshot. An adapter that sees none still
  yields ONE implicit variant, because a product with no price is the case the
  table exists to hold.
- **Price history is append-only**, written on first sighting and thereafter
  only when the price moves. A gap between points means the price held.

### Running the Studio locally — a session CAN do this

The preview proxy below serves the 13 PUBLIC routes. It cannot reach the Studio:
every `/studio` route sits behind `requireStaffPage`, and a share token is not a
staff session. That is why "needs the owner's eye" was written against the Studio
work for so long. It does not: this container has Postgres 16 and a Chromium, so
a session can stand the whole thing up and drive it with a real login.

    # 1. a throwaway database (initdb refuses to run as root, hence `su postgres`)
    rm -rf /var/tmp/pg && mkdir -p /var/tmp/pg && chown postgres /var/tmp/pg
    su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/tmp/pg -U ci --auth=trust"
    su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pg \
      -o '-p 5433 -k /var/tmp/pg' -l /var/tmp/pg.log start"
    su postgres -c "/usr/lib/postgresql/16/bin/createdb -h /var/tmp/pg -p 5433 -U ci rivya_test"
    export DATABASE_URL="postgresql://ci@localhost:5433/rivya_test?host=/var/tmp/pg"

    # 2. AUTH_TRUST_HOST is REQUIRED off Vercel — env.ts throws without it and
    #    the build dies at "Failed to collect page data for /_not-found".
    export AUTH_SECRET=… NEXTAUTH_SECRET=$AUTH_SECRET AUTH_TRUST_HOST=true
    export NEXTAUTH_URL=http://localhost:3000 NEXT_PUBLIC_SITE_URL=http://localhost:3000
    npm run build && npx next start -p 3000        # build runs migrate + bootstrap

    # 3. content and a staff row, then the audits
    npx tsx prisma/seed.ts && npm run seed:demo    # base seed FIRST — demo needs its categories
    #  … upsert a User with `bcrypt.hash(pw, 12)` into `hashedPassword`, role ADMIN
    BASE_URL=http://localhost:3000 STUDIO_EMAIL=… STUDIO_PASSWORD=… \
      node scripts/studio-audit.mjs [--w 390]

`NO_PROXY=localhost,127.0.0.1` on anything that fetches, or the agent proxy
intercepts it. Scratch scripts go in `scripts/` — `tsx` resolves `@/` from the
tsconfig, so a script in `/tmp` cannot import the generated Prisma client — and
are deleted before committing. `tsx` transpiles to CJS, so **no top-level await**
in one.

**What this unlocked, on 2026-09-15:** `studio-audit.mjs` clean over 38 routes at
1440 and 390; the whole of plan §4.2/§4.3 checked by staging a real draft and
reading what the screens rendered (both were already built — see the corrections
in `docs/plan/01-redesign-main-and-studio.md`); and `prisma/import-tiers.ts` run
for real, which is how the purge script's tier-cap behaviour was found. None of
that was reachable by reading source.

### Design QA (needs a running server)

**A session without `DATABASE_URL` can still run all of these.** `npm run build`
needs a database, so for a long time a session without one could not run a
single gate in the definition of done — it could only push and hope. It does not
have to: the PR's own **Vercel preview deployment** is a running server built
from the commit under test, and `scripts/preview-proxy.mjs` turns it into a
plain `http://localhost:3000` origin by holding the `_vercel_share` cookie and
replaying it.

    NODE_USE_ENV_PROXY=1 node scripts/preview-proxy.mjs "<shareable url>" &
    BASE_URL=http://localhost:3000 node scripts/redesign-audit.mjs "$ROUTES"

Use the DEPLOYMENT url (`<project>-<hash>-<team>.vercel.app`), not the branch
alias — a share token minted for the alias bounces to the Vercel login page.
The script's header records what a green run does NOT cover: third-party asset
hosts (the browser fetches those directly, not through the proxy) and the five
demo detail routes (they need the seeded demo set, which the preview's database
may not carry — leave those to CI). Audit the 13 public routes here.

The first two run in CI over the 13 public routes plus the five demo detail
routes (`/product/demo-product-001`, `/shop/gift-collections`,
`/blog/demo-post-001`, `/portfolio/demo-case-001`, `/p/demo-lander` — seeded by
`scripts/seed-demo.ts` after the database tests) at 1440 · 1280 · 390 · 360,
and the RTL set at 1440 · 390. Run them locally for a route or width CI does
not cover, or to see a failure's detail. At widths of 700px and below the
design audit drives a touch-capable context, so `pointer-coarse:` utilities
apply and the 44px tap floor FAILS there (it is reported, not failed, on
fine-pointer widths); it also measures the sticky header's `data-ink` promise
against the rendered pixels behind the logo (≥ 4.5:1). That one rule compares
an ATTRIBUTE against PIXELS, so it settles the header first and re-reads it
afterwards, and downgrades to a NOTE when the state changed mid-measurement:
`data-ink` flips in one commit while the scrim and the bar cross-fade over
`--dur-base`, and the route walk drags the hero through the header's band
twice, so a late IntersectionObserver callback on a loaded runner used to be
reported as a contrast failure no visitor could see.

- `node scripts/redesign-audit.mjs "/en,/en/shop,…" [--w 390]` — REDESIGN.md
  Part 19.1 as an executable check: one `h1`, no duplicated section heading,
  max two `section-major`, max three dark bands and never adjacent, numbers in
  mono, no ellipsis in an accessible name, alt text that describes the picture,
  no horizontal overflow. It also loads every route a **second time in a
  `reducedMotion: "reduce"` context** and samples `getAnimations()` down the
  page: anything still running with a per-iteration duration over one frame,
  any scroll-linked timeline and any `<video>` playing by itself is a Part 14
  failure. That is the only gate on the reduced-motion contract — the CSS side
  rests on one global collapse in `tokens.css`, and everything driven from JS
  is outside its reach — so it samples through the walk rather than at rest,
  because a one-shot entrance is over before a settled page is measured.
  Motion behind a click (the lightbox FLIP, quick view) is not on this path;
  `keyboard-audit.mjs` is where those surfaces get opened.
- `node scripts/a11y-audit.mjs "/en,/en/shop,…" [--w 390]` — axe-core over the
  rendered routes; fails on critical or serious findings (§19.6). Moderate and
  minor are printed, not failed.
- `node scripts/keyboard-audit.mjs [--w 390]` — the chrome overlays (drawer,
  search, mega menu) and the three lightboxes (product gallery, portfolio
  wall, landing-page fullscreen gallery) driven by keyboard: open, focus,
  ArrowRight / End / Home, Escape, focus return.
- `node scripts/shots.mjs <out-dir> "/en,/en/shop" [--w 375] [--full] [--reduced]`
  — screenshots via the pre-installed Chromium; reports overflow and console
  errors.
- `node scripts/i18n-missing.mjs [--list] [--json out.json]` — keys present in
  `messages/en.json` and missing from (or identical to English in) the other
  eight locales. English-first is the workflow: add the key to `en.json`, then
  translate the whole batch.
- `node scripts/i18n-merge.mjs patch.json [--partial]` — deep-merges
  `{locale: {…}}` into every `messages/*.json`. It refuses a patch missing a
  locale unless you pass `--partial`, because a key that lands in English and
  nowhere else renders as its own path in eight languages.

## Stack

Next.js App Router + TS, Tailwind v4 (v3 tokens in src/styles/tokens.css +
the utility bridge in src/app/globals.css), shadcn/ui, Prisma + Postgres,
Auth.js (STAFF ONLY, /studio), @vercel/blob uploads, WhatsApp deep-link
ordering (lib/whatsapp.ts), React Hook Form + Zod forms, Lenis + GSAP/
ScrollTrigger for the two pinned scrubs.

## Design system — v3 "Liquid Luxury"

- **Colour**: obsidian · deep-ocean · sapphire/-hi · mineral · sand ·
  champagne · ink · graphite · mist · hairline/-dk · whatsapp · alert ·
  success. Three AA companions exist because a palette role cannot carry text:
  `sapphire-ink` (sapphire itself on light; lifted to #5fafd6 in the Studio's
  dark scheme, where raw sapphire is 2.2:1 on obsidian — every sapphire TEXT
  or indicator icon in the Studio reads it, never a fill),
  `champagne-ink` (champagne is 2.35:1 on mineral) and `whatsapp-deep` (white
  on the brand green is 4.14:1). Champagne is never a fill, never a button
  background, never text below 16px on light, **max two per viewport**.
  Dark bands never sit adjacent; **max three per page**.
- **Type**: `font-display` Instrument Serif · `font-body` Inter · `font-mono`
  JetBrains Mono. Every price, count, date, dimension, cure time and eyebrow
  is mono and tabular. Scale: `text-hero/h1/h2/h3/body/small/micro`, all
  clamped — one scale, no mobile fork. The `text-12 … text-76` step scale is
  retained for the Studio and the form primitives only.
- **Composite utilities**: `u-micro` (every eyebrow and metadata line),
  `u-num`, `u-shell` (the content rail — it also reserves the 56px cure gutter
  at ≥1024px), `u-prose` (68ch), `u-lede` (52ch), `section-major|standard|
compact`, `rule`/`rule-dk`.
- **Surfaces**: 1px hairlines and a mineral → sand shift, never boxes. No drop
  shadows on the storefront — two exceptions, the mobile bottom bar and the
  Studio's bulk-action bar. Blur in exactly one place: the sticky header.
- **GREEN MEANS AN ORDER IS BEING SENT, AND NOTHING ELSE** (F6, 2026-09-17).
  `button.tsx`'s `whatsapp` variant had always said "the final order action,
  nothing else" while sixteen of its twenty call sites were page heroes, card
  actions and "ask us" links — which is how audit §2.4 came to report that
  "primary button colour shifts by page". It now appears on exactly four
  controls: Place Order on the PDP, its mobile sticky twin, the custom brief's
  submit, and the `/whatsapp-order` fallback. (`design-lab` keeps one: it is
  the staff variant gallery.) Everywhere else the pill takes its ground's
  variant — `premium` on dark, `primary`/`secondary` on light — and the channel
  is carried by the label and the MessageCircle icon. The variant is NOT
  deleted: REDESIGN.md §3.6 specifies it, and the same section gives the rule
  that reconciles it with the audit — "it is the order channel, not the brand".
  `premium` is the one place a champagne fill is sanctioned, at hover, with the
  label going dark with it.
- **`CollectionCard` stacks in ONE GRID CELL, and the z-index is the point**
  (2026-09-17). The caption used to be `absolute … bottom-0` INSIDE the clipped
  photo box, which made it the nearest positioned ancestor of the link's
  `after:inset-0` overlay — so the tile's hit area and its focus ring were the
  caption, not the tile. The photograph was dead to the pointer, against the
  component's own header ("The whole tile is the target; there is no button"),
  and `overflow-hidden` cut the ring's 3px offset off. Both layers now sit in
  `col-start-1 row-start-1`; the caption is ordered by `z-10` **on a grid item,
  which takes z-index without `position`** — making it `relative` instead would
  put the overlay back inside the caption and undo the whole thing. Its `z-10`
  is equally load-bearing in the other direction: the photo layer's children
  are `absolute`, so they paint above in-flow content, and without it the
  eyebrow and the arrow render UNDER the photograph while the promise (a
  `relative` span) renders over it. `overflow-hidden` moved onto an inner
  `relative` wrapper so the hover scale still clips; `SnapRail`'s `-m-1.5 p-1.5`
  is the room a 2px ring at 3px offset needs inside a scroll container, which
  clips on BOTH axes.
- **Signature devices**: `CureLine` (§2.6) and `MeniscusImage` (§2.7). No image
  on this site fades in; the meniscus reveal replaces every fade-up, and it
  masks rather than clips — a clipped element never loads its image.

## Current repo reality (adapt to it — never break it)

- Code lives under `src/`: storefront routes in `src/app/[locale]/(v2)`
  (next-intl, 9 locales incl. RTL — do NOT restructure); staff panel in
  `src/app/studio`; route guard at `src/proxy.ts` (Next 16.3 renamed
  middleware → proxy).
- Uploads use @vercel/blob (Cloudinary is the spec's target, not yet wired).
- The chrome is `SiteHeader` (four nav items, mega menu, drawer) +
  `AnnouncementBar` + `MobileBottomBar` + `WhatsAppFab` + `SearchOverlay` +
  `Footer`, all mounted by `src/app/[locale]/(v2)/layout.tsx`. The drawer and
  the search overlay are opened through module signals
  (`src/lib/search-signal.ts`), because their triggers are not descendants of
  the components that own them.
- **`Magnetic` is back, by owner instruction (2026-09-17)** — and mounted, on
  the 404's escape pill and the homepage's commission ask. D18 deleted it for
  being dormant, not for being wrong, and an unmounted copy is the thing D18
  was actually about. It sits against a written rule and says so in its own
  header: REDESIGN.md §3.6 and the contract both say of buttons "No scale or
  lift on hover — colour and underline only", and a ±6px pull is a lift. §6.2's
  press-scale is deliberately NOT built, to keep the deviation to what the
  instruction needed. Guards are `featured-rail.tsx`'s: reduced-motion and
  coarse-pointer both refuse, and gsap arrives through a dynamic import — the
  motion budget is unchanged at 48.4 KB.
- **The rest of the dormant v2 motion layer is gone** (owner decision D18, 2026-09-03).
  `Preloader`, `preloader-signal`, `CursorFollower`, `Magnetic`,
  `KineticHeading`, `SplitTextHeading`, `MobileWhatsappBar` and `WishlistCount`
  were deleted: eight files, zero imports between them and anything mounted,
  all carrying v2.0/v7 headers from a superseded system. They were kept for a
  while as "remounting is one line", which is exactly the ambiguity D18 removes
  — a reader, human or agent, could not tell dead architecture from live.
  Part 14 forbids the first two on their own terms (nothing may delay the LCP;
  motion that is a technology demo is rejected). `git log --diff-filter=D`
  finds them if one is ever wanted back.
- **Motion primitives (A1–A3).** `src/lib/gsap.ts` registers the house eases
  (`"luxury"`, `"settle"`) through `gsap.registerEase` with a 30-line
  cubic-bezier solver (`bezier-ease.ts`) — never `gsap/CustomEase`, whose
  ~2.5 KB would breach the 49 KB motion ratchet — from
  `src/lib/motion-tokens.ts`, mirrored by test against `tokens.css`; `globals.css` carries `sf-hero-rise` (staggered text
  entrance on the non-LCP layer), `sf-hero-drift` (a 6 s `infinite alternate`
  ambient scale on the poster WRAPPER, never the image, off under reduced
  motion and while the video plays — mounted on the homepage and large-format
  heroes) and `sf-manifesto-brighten`; `storefront/snap-rail.tsx` is the
  snap-scrolling rail every below-`md` row uses; `storefront/lightbox.tsx` is
  the one lightbox (FLIP entrance from `src/lib/flip.ts`, keyboard, RTL, live
  region, focus return) behind the product gallery, the portfolio wall and the
  fullscreen gallery block; `hooks/use-hero-ink.ts` sets the header's
  `data-ink` from an IntersectionObserver over dark bands.
- **The homepage's two new bands and the one that moved** (2026-09-17).
  `storefront/quote-rotator.tsx` (S6) stacks every slide in ONE grid cell
  (`col-start-1 row-start-1`), so the band's height is the tallest quote and
  rotating never shifts the page; inactive slides carry `aria-hidden` AND
  `inert`, and the band is NOT a live region — an 8 s rotation announcing
  itself would interrupt a screen reader mid-sentence for decoration. It pauses
  on hover, on focus and on an explicit control, and under reduced motion it
  renders the first quote and stops. Its `labels.show` is a **string array, not
  a formatter**: a function cannot cross the server/client boundary, and
  `npm run build` is what catches it.
  `storefront/journal-list.tsx` (S8) is the journal as rows with a
  cursor-following preview — written to `style.transform` inside a rAF, never
  to state, and `position: fixed` + `pointer-events: none` so it can never
  intercept the click it is previewing. The row title is `text-h3`, not the
  mockup's 42px: the clamped scale has no step there and Part 3 forbids
  inventing one.
  **S9, the closing CTA, lives in the FOOTER's own band** and not as a section
  of its own. An obsidian band at the end of the homepage would sit adjacent to
  the obsidian footer, which §3.1 refuses and `describeArrangementProblem`
  enforces. Putting the treatment (the resin-flow texture at `opacity-30`
  behind a gradient veil, the heading lifted to `text-h1`) into the band that
  is ALREADY there spends no new dark band. The homepage comment claiming three
  were spent was wrong — `material` is `bg-mineral`.
- **`hero-parallax.tsx` is mounted on the homepage bespoke band** (A2), px-capped
  at `Math.min(40, h * 0.12)`. It was once deleted as dormant and put back: It was deleted
  in the first pass of D18 and put back: the audit files it under §3.2 REFINE,
  not §3.3 REMOVE, and names its destination — px-cap the translation at
  `Math.min(40, h * 0.12)` and mount it on the homepage bespoke band
  (roadmap Phase 1b for the refit, Phase 3 for the mount, motion shortlist
  entry 9). Unimported is not the same as unwanted; deleting it would have
  destroyed approved work. `src/components/motion/` is `Reveal`,
  `PageTransition` and this.
- The Studio is English-only by design and consumes the shadcn semantic layer,
  re-pointed under the `.studio-v2` scope in globals.css (with its own
  `prefers-color-scheme: dark` block). The commission board is built on the
  real `InquiryStatus` enum, not the nine columns §12.4 lists — those do not
  exist in the schema, and §1.1 forbids changing it.
- Vitest covers the pure `src/lib` functions (naming, search vocabulary,
  localize, WhatsApp links, form-token gate, day bucketing) plus
  `scripts/e2e-smoke.mjs`. There is no component-test runner.

## Conventions

- TypeScript strict; no `any`; named exports; server components by default,
  `"use client"` only for interactivity/motion.
- **Never call setState synchronously in an effect body** — the repo lints for
  it (`react-hooks/set-state-in-effect`). Use `useSyncExternalStore` (see
  `src/hooks/use-prefers-reduced-motion.ts` and `use-overlay-signal.ts`), an
  event callback, or a direct DOM write.
- Styling: Tailwind classes referencing the tokens only. **No raw hex in
  components.** Logical properties everywhere (`ps-`/`pe-`/`ms-`/`me-`/
  `start-`/`end-`) — Arabic is a shipped locale and an unmirrored RTL is worse
  than none.
- Motion: every effect must (1) use the Part 3.8 tokens, (2) have a
  reduced-motion fallback — `redesign-audit.mjs` drives a `reduce` context per
  route and fails on anything still moving, so a forgotten fallback no longer
  ships green — (3) never scroll-jack beyond the two sanctioned pins (the
  homepage material story, the process steps).
- All user-facing copy goes through next-intl. Add the key to
  `messages/en.json` first, then translate the batch into ar/de/es/fr/gu/hi/
  ja/zh — `scripts/i18n-missing.mjs` is the gate that catches a key rendering
  as English in eight languages.
- Commits: feat|fix|chore|refactor(scope): message. Small, verified commits.

## Known gaps (data, not design)

These are places where the spec asks for something the database cannot express.
Each renders nothing rather than inventing content, and each becomes real the
moment the owner fills the field.

Three former entries are gone, closed by migration `20260824110000`:
`BlogCategory`/`Tag` now carry `translations` (names in nine languages),
`PortfolioImage` carries a translatable `caption`, and `Media` carries
`provenance` — so §12.5's "AI Generated" filter and indicator are built.

**There are no `/* i18n-debt */` markers left.** The PDP's lexical rows resolve
through `localizeLexical` (per row and per field, so a partial translation
never deletes the rows it did not reach) and the search overlay's journal
category through `localizeName`. The rate-limited login now shows its
countdown: `authorize()` is unchanged — still a bare `null` for a throttled
attempt, which is what stops a lockout becoming an account-existence oracle —
and the login Server Action asks the counters separately, after its own
attempt has already failed and been recorded.

- **No portfolio row carries `beforeImageUrl`**, so the before/after slider —
  built to §4.6 and §20.5, and wired on the varmala collection and the case
  studies — never renders on the current data. The column exists; the data
  does not.
- **`Inquiry` has no priority column and no cure tracking**, so the commission
  board's stage timer measures days in pipeline against the published lead-time
  bands rather than §12.4's invented "Layer 2 · 48 of 72 h".
- **Product commission "from" prices** are not shown on the bespoke tiles: the
  catalogue's floor in those categories is a ₹7 bezel finding and a ₹350
  ornament, so a derived figure would be a real number attached to the wrong
  thing. The tiles carry timelines instead.
- **The section manifest covers seven pages**, not every page. `/shop`, `/blog`,
  `/portfolio` and `/faq` are a hero plus their listing — hiding the listing
  makes the page pointless — and the detail routes are driven by content rather
  than by an arrangement. See `src/lib/page-sections.ts`.
- **Account disabled has no state behind it, and a column would not be
  enough.** `User` has no disabled/suspended flag — access is revoked by
  deleting the row or bumping `tokenVersion`. Even given one, a distinct
  "account disabled" banner would answer the account-enumeration question the
  generic sign-in message exists to withhold. `?error=disabled` renders; nothing
  sets it.

## Definition of done (every task)

typecheck ✓ lint ✓ build ✓ · works at 360px and 1280px · keyboard reachable ·
reduced-motion checked · screenshots verified · HARD RULES respected ·
`scripts/redesign-audit.mjs` and `scripts/a11y-audit.mjs` gate every PR over the
13 public routes and the five demo detail routes (44px tap floor fails at phone
widths; header contrast measured), `keyboard-audit.mjs` covers the overlays and
the lightboxes, and `npm run test:e2e` runs in CI — run them by hand for a route
or width CI does not sweep · order flow intact: Place Order saves an Inquiry
and opens wa.me/917096036250 with the correct pre-filled message (a demo piece
saves `isDemo` and prefixes `[DEMO] `) · a worktree build needs
`NEXT_PRIVATE_OUTPUT_TRACE_ROOT=<parent dir> npx next build` (Turbopack refuses
a symlinked node_modules otherwise).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
