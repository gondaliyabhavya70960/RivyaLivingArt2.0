# CHANGELOG

All notable changes to the Rivya Living Art transformation.
Newest first. Every entry names the phase it belongs to.

---

## Workstream E step 3, worked — the live catalogue tiered by rule (2026-09-16)

Branch `claude/inspiring-cerf-2ymgwf`, restarted from main after #91. The owner's word:
"tier the live catalogue from /studio/products". Step 3 had built the tools for a person —
the "No tier yet" filter, bulk **Set product tier**, the content-gaps card — and left every
one of the ~4,385 rows untiered. A row at a time is not a plan for a catalogue that size,
and the CSV fill creates PUBLISHED rows on every deploy that the publish refusal never sees.

- **The rule** — `src/lib/catalog-size-tier.ts`, pure, 12 unit tests on the catalogue's own
  titles. The owner's category is the default (`CATEGORY_SIZE_TIER`, the brief's "typical
  work" column slug by slug; Resin Home Decor, Resin Vases and Kids Room Decor deliberately
  have none). Step 6's vocabulary over the title, description and dimensions outranks it
  only when decisive (6: a form-factor word in the title, or a ≥ 60 cm side) AND ahead of
  the category's own tier by that margin — "Handmade Floral Candle Bouquet" under candle
  holders carries a Memory word and a Personal word and the filing settles it; "Engagement
  Ring Tray" under keychains carries nothing for Personal and moves. Supplies never: six
  category slugs and a title list (molds, cavities, pigments, hardeners, clock hands, bezels,
  beads, pollens, "chain for", "40gms", "1.5 Kg", "100 Pcs", silicone, tuition) — ~3,500 of
  the rows are not pieces, and there is no fourth tier for "not a piece" (a T-question, not
  this rule's). The category NAME is never scored; Collectible is never decided on a weak
  word; a tie or a silent title stays for a person.
- **The write side** — `catalog-size-tier-backfill.ts`, 3 db tests: plan (pages of 1,000
  by id cursor, counts and six sample titles per tier, what is skipped and why) → apply
  (chunks of 500, each re-checking `sizeTier IS NULL` so a tier the owner set in between
  wins), only rows that are not `ownerTouched` and not demo, one `ActivityLog` row
  (`size-tier-suggest`) per run that wrote anything.
- **Two callers.** `prisma/suggest-size-tiers.ts`, run by `bootstrap.ts` right after the
  CSV fill, on production and local builds — and **skipped on preview builds**: a preview
  runs against production, and a classification a person may want to see first lands with
  the merge, not the push. And the Studio's **Suggest tiers** button on `/studio/products`:
  a dialog with the plan (per-tier counts and sample titles, how many stay untiered as
  supplies or unsure) and a **File N products** button that writes exactly it, then
  invalidates the PDP, `/large-resin-art`, the shop's first page and the Studio lists.
  `setProductsSizeTier` now invalidates the same readers — its comment had said "once
  readers exist", and steps 7–8 built them.
- **What the dry runs over the local mirror corrected before the rule was final.** Material
  words that name a technique ("epoxy resin", "alcohol ink", "glitter") left the supply
  guard — they nulled finished clocks; the category name stopped being scored — "Festive
  & Pooja" was filing its own rows Memory through "pooja"; trays follow step 6's
  vocabulary (Memory) rather than a category default that fought it; "puja" joined "pooja";
  weak words need title strength (4) and never decide Collectible — "Round placemats" had
  gone LARGE on "table" in its prose; and the decisive margin above, which turned a
  36-inch mantra frame back into a frame.
- **Measured**: 4,385 untiered → 567 filed (13 Collectible · 125 Memory · 429 Personal);
  3,484 supplies untiered on purpose (2,996 by category, 488 by title); 334 for a person.
  Production's numbers will differ slightly and are read off the production build log
  after the merge.
- **The push that carries this ALSO switches the deploy-time CSV fill OFF**
  (`20260917130000_catalog_fill_off_after_purge`: `SiteSettings.sheetFillOnDeploy = false`).
  At 16:57 UTC the owner emptied the catalogue from the Studio (bulk-delete of 4,012 rows,
  each tombstoned in `DeletedImport`) and asked for it to be rebuilt from the reference
  sites through the scraper's review queue. The CSV fill would have re-created ~4,000
  DIFFERENT supplier rows on this very push — the tier caps apply after the tombstone
  filter and the pools dwarf them (CLAUDE.md, "Emptying the catalogue takes TWO things").
  The master switch and the manual run on `/studio/catalog-fill` are untouched.
- **Main's unit job was red**: `migrate-resolve-failed.test.mjs` counted the repo's
  migrations and #90's drop migration had moved the count. The expectation now names all
  five renames-and-drops.
- `large-format.ts` re-exports `LARGE_FORMAT_CATEGORY_SLUGS` from the rule module — one
  set, two readers, pinned by a test. The shop drawer's Scale section stays last and
  closed; promoting it is the owner's call once the "No tier yet" list is worked.

---

## C-tail — the last two Sheets columns dropped (2026-09-16)

Branch `c-tail-drop-sheets-columns` (the owner's, commit `a14dddc`), main merged in and pushed
on the owner's word once #89's production deployment was READY. Plan C step 4b's last item:
`20260917110000_drop_sheets_settings_columns` drops `SiteSettings.sheetId` and
`sheetTabIds`, the owner's spreadsheet and tab ids that survived the 2026-09-15 drop unread.
The two-PR rule, to the letter: #88 un-modelled them with no migration (step 4a), #89's
deployment put that client live at 16:36 UTC, and only then did this migration run — from
the preview build, as every migration here does. The branch sat unpushed for three hours
for exactly that reason: its first push at 13:35 UTC had failed on the P3009 that blocked
everything, and pushing it again before #88 was live would have dropped columns the
deployed #83 client still selected — the 2026-09-15 rename incident again.

Verified before the push: main merged cleanly (the branch adds one file); the schema no
longer models the fields; typecheck; a real `npm run build` against a local database that
still had both columns — the migration applied, bootstrap ran, `next build` completed,
zero Sheets columns left. `docs/plan/03-sheets-removal.md` §4 and CLAUDE.md record the
debt as paid. Nothing Sheets-shaped remains in the schema.

---

## Fix — production deploys unblocked: the P3009 guard reads the whole footprint (2026-09-16)

Branch `claude/inspiring-cerf-2ymgwf`, second PR. Every production deploy since 09:47 UTC —
#84's merge, then B9, A9, #87 and #88 — failed with P3009 on `20260917090000_analytics_opportunity`,
and the guard #87 added refused to act because the two tables it creates already existed.
Production stayed on #83 (B7) all day.

### What actually happened — not what the #87 entry says

The entry below this one records "a superseded preview build was cancelled mid-migration". It
was read off the P3009 line; the Vercel build logs say otherwise, and the entry is kept as
written (D24) with the correction here. At **08:16 UTC** a preview build of the abandoned branch
`feat/b8-analytics-opportunity-score` (commit `556168f`) applied ITS migration,
`20260916210000_analytics_opportunity`, to production: `AnalyticsSnapshot` and `OpportunityScore`
in that branch's shape (`league` typed by the enum, `analyticsVersion` TEXT, `computedCount` /
`totalCount`, `score` / `evidence`), plus a `ShortlistEntry.linkedOpportunityId` column with an
index and a foreign key onto `OpportunityScore`. The B8 that merged (#84, branch
`b8-analytics-opportunity`) carried a rewritten migration under a NEW name, and at **09:47 UTC**
its preview build ran that one: `42P07 relation "AnalyticsSnapshot" already exists`. Prisma
recorded it as failed, and P3009 followed on every deploy after.

The lesson that outlives the fix, now in CLAUDE.md: **a migration pushed on any branch is
applied to production under that name. Renaming or rewriting it afterwards leaves the first
applied and the second colliding with it.**

### The guard now proves one of three facts, or stops

`scripts/lib/migrate-resolve-failed.mjs` parses the failed migration's SQL into the footprint it
declares — tables with columns, types and nullability; indexes with uniqueness and columns;
constraints; enum types and values; extensions; data statements; and everything else as
`unknown` — and reads the Postgres catalog for each item. `decideResolution` is pure and is
pinned by 47 tests, including the 2026-09-16 case replayed from the two real migrations:

- **Nothing of it exists** → `migrate resolve --rolled-back`, the deploy re-applies it (#87's
  rule, now over enums and columns too — see the probe below).
- **All of it exists in the declared shape**, and it carries no data statement → `--applied`.
  #87 said "never `--applied`, that is a human's call"; a footprint verified item by item is not
  a call, it is a check, and the refusal now sits on what cannot be checked (a data statement,
  an unreadable statement, a type outside the known spellings).
- **Some of it exists in another shape**, and everything that would go holds no data — an
  index, a constraint, an enum type, an empty table, or a table `DERIVED_TABLES` declares a
  derivation (B8's two: `analytics-query.ts` runs `deleteMany({})` + `createMany` on every
  recompute) — and nothing it would add to a pre-existing table is already there → the stray
  objects are dropped in one transaction, foreign keys onto them first, then `--rolled-back`
  and the re-apply. That is the production case: the plan is exactly
  `ALTER TABLE "ShortlistEntry" DROP CONSTRAINT "ShortlistEntry_linkedOpportunityId_fkey"`,
  `DROP TABLE "OpportunityScore"`, `DROP TABLE "AnalyticsSnapshot"`.
- Anything else prints the differences it found, why the drop was refused, and the manual
  commands, and fails the build as before.

**Prisma does not apply a migration script atomically.** Probed here: a two-statement migration
whose second statement fails leaves the first's table behind. A partial footprint is a real
state, which is why the "nothing exists" test now covers every declared object and why the
drop path exists at all.

### Reviewed adversarially before it merged, and hardened on what the review found

An eleven-agent review pass over the diff (three lenses — parser, resolution safety, tests
and conventions — each finding then handed to a skeptic told to refute it) confirmed seven
findings; every one is fixed here and pinned by a test:

- **Two builds at once.** Every push runs a preview and a production build against the one
  database, and both see the P3009. A guard that read the catalog, then dropped, could drop
  the tables the other build had just re-applied and leave the record saying "applied" over
  an empty schema. The heal is now ONE transaction under Prisma's own migrate lock
  (`pg_advisory_lock(72707369)`, from the schema engine's strings) with the failed record
  locked `FOR UPDATE`, and the record change — the same writes `prisma migrate resolve`
  makes, watched against the CLI — happens inside it, so a drop and its record commit
  together or not at all. The second build finds no failed row and runs the deploy again.
  Replayed with two wrappers started in the same second: one heals, Prisma's lock holds the
  other's deploy until the drop has committed, both exit 0, the end state is exact.
- **The "applied" proof was a name check.** Index columns were matched as a substring,
  order-blind; foreign-key and primary-key columns, referential actions and column defaults
  were never compared; an expression index passed on existence. A stray predecessor that
  differed only in composition would have been marked applied for good. Every comparison is
  now exact — `pg_get_constraintdef` and `pg_indexes.indexdef` are parsed by the same parser
  as the migration's own statements — and an expression, a partial index or a CHECK is
  "cannot compare", never "present".
- **A superset passed as complete.** A created table carrying an undeclared NOT NULL column
  or a stray unique index read as "all present"; the client would then have failed on every
  insert, forever. Undeclared columns, indexes and constraints on a created table are gaps.
- **Live schema could have been dropped.** A future migration that re-creates a table an
  earlier applied migration owns, on a database where that table is empty, would have had
  it dropped as a stray. The guard now indexes what every OTHER migration in the repo
  declares; a table, column, index or enum some other migration owns is never a stray.
- **A name taken by an object on another table was invisible**, so the guard would have
  rolled back, re-applied into the same 42P07, and repeated that on every build with a log
  line claiming proof. Declared names are now looked up schema-wide; a collision is a
  blocker, and a migration the guard has already rolled back twice is refused with a pointer
  to the previous build's error.
- **"Nothing exists" ignored unreadable statements.** A DROP or an UPDATE on a live table
  that ran before the first checkable object failed would have been "provably nothing" and
  run again on the re-apply. That branch now refuses on any unreadable statement and on any
  data statement against a table the migration does not create.
- **No test touched a real catalog.** `tests/db/migrate-resolve-failed.test.ts` now runs the
  reader against the migrated test database — every additive migration since the last
  rename reads back as exactly applied, defaults and enum labels and foreign keys included
  (which is how a `name[]` array the driver hands back as a string was caught) — and applies,
  mutates, records as failed and heals a probe migration for real, with two clients healing
  the same record at once.

### The stray column

`20260917120000_shortlist_stray_link_column` drops the `linkedOpportunityId` constraint, index and
column from `ShortlistEntry` with `IF EXISTS` — a no-op everywhere but production. The two-PR
drop rule does not apply: no client ever deployed to production knew the column (it existed only
in that abandoned branch's preview builds, never in `schema.prisma` on main).

### Verified

The production state was reproduced on the local Postgres 16 from the two real migrations —
the abandoned branch's applied first, then #84's failing with the same 42P07 — and
`node scripts/migrate-deploy.mjs` healed it: ten differences listed, the three-statement drop,
`--rolled-back`, then B8, B9 and the tidy-up applied, final shapes byte-equal to the schema, zero
stray leftovers. The other three outcomes were exercised on the same database against B9:
rows in a non-derived table with a missing FK → refused, exit 1; complete → `--applied`;
table gone → `--rolled-back` and re-applied. Pushing this branch runs the same guard against
production from the preview build, which is how the record is healed in practice.

---

## Workstream E steps 4–8, CI green again, and the owed entries (2026-09-16)

Draft PR #88, branch `claude/inspiring-cerf-2ymgwf`. The session was commissioned from a
summary that named workstream C as next; C was already merged, and what the tree needed was
this.

### CI's build job had been red since B6, and nobody could see why

Not since pgvector — since #82. The db suites B6, B8 and A9 added were each described as
"skip gracefully without DATABASE_URL and bite in CI", and in CI they bit: five failures,
unread because the job was already red. `.github/workflows/ci.yml` now runs
`pgvector/pgvector:pg16` (the one-line edit #85, #86 and #87 could not push), and the five
were root-caused rather than skipped:

- **One code defect.** `analytics-query.ts` fetched a league's rows through
  `variantWhereForLeague`, whose `isReference: false` clause is the benchmark shape — so
  the rows B8's accounting exists to NAME as excluded were never handed to it.
  `exclusions.reference` could not be non-zero, and the supplies league's own benchmark
  read "considered 0" for a source it had read. The fetch now goes through a new
  `variantWhereForLeagueContext`; `scopeRows`/`isComparable` keep reference rows out of
  every pick, so nothing averages one — the guard moved from the WHERE to the accounting.
- **Four test defects.** A league-guard expectation contradicted a row the same suite had
  written two tests earlier (the proof is now the average equalling that row EXACTLY); an
  illegal `REJECTED → SHORTLISTED` move that the machine refused, then an assertion on a
  product that was never re-scored; two global counts that only held on a fresh database;
  an absolute count right after the test that legitimately queues a job.
- **The shared database.** The older suites leave it as they found it in an `afterAll`;
  the scraper suites only cleaned BEFORE, and every run left priced FINISHED_ART rows under
  nine test sources that moved the analytics suite's league-wide median on the next run.
  `test:db` now passes 87/87 twice in a row and leaves no test rows.

The six CHANGELOG entries #81–#86 merged without (the API channel could not write this
file) are landed verbatim below, and #87 gets the entry it never wrote.

### Workstream C's last two columns

`SiteSettings.sheetId` and `sheetTabIds` were in plan C's drop list, read by nothing since
#67, and missed by the drop. Un-modelled from `schema.prisma` with NO migration — step 4a
again — and verified in the state that creates: a build against a database that still
carries both, bootstrap's settings upsert, 87 db tests. The `DROP COLUMN` ships in its own
PR once this client is DEPLOYED (`docs/plan/03` §4).

### Workstream E, steps 4–8 (`docs/plan/07`)

- **Step 4 — demo fixtures.** `sizeTier` on the zod shape (from `PRODUCT_SIZE_TIERS`), the
  loader and all 100 rows: 52 LARGE · 12 MEDIUM · 34 SMALL, filed by what the piece IS off
  its editorial name — the generator paired names and categories loosely. The two workshop
  sessions are null on purpose. Every tier lands on a PUBLISHED row, the E2E PDP is LARGE,
  and `/p/demo-lander`'s grid carries one PUBLISHED piece of each (001 · 006 · 086 · 078),
  because `/shop/gift-collections` cannot carry a demo row. `fixtures.test.ts` pins it.
- **Step 5 — copy.** `ProductTier.<enum>.{name, shortName, promise, primaryCta,
  secondaryCta}` in nine locales, keyed by the enum value so a consumer writes
  t(`${tier}.primaryCta`) with no mapping table. `product-size-tier.test.ts` reads
  `en.json` and fails if `name`/`shortName` drift from the studio's labels, and refuses
  cart/checkout wording in any tier (T1). Registry 1320 → 1329 by the end.
- **Step 6 — the scraper suggests a tier.** `size-tier-suggest.ts`: one home per keyword
  (the test refuses a keyword in two tiers), longest phrase first and consumed on match,
  curated fields double, prose once, one dimension heuristic (≥ 60 cm LARGE, ≤ 10 cm SMALL,
  the band between leans MEDIUM under a decisive word; the description is never parsed).
  Nothing scoring → null; a tie → null, the operator decides. The source's tier is not an
  input. Computed per row on the source page beside the category auto-map, a "Product
  tier" select with a "suggested" hint, carried by the dialog, written on create. Never
  stored on the staged row. 38 tests, the brief's sixteen examples among them.
- **Step 7 — the collectible card.** `cardVariantFor` / `collectibleCardMeta` in
  `card-meta.ts` (tested: a figure, a band, or price on request; "starting from" is not
  derived — T3; `formatPriceBand`'s "Enquire" can never reach a card — T6), a
  `collectible` variant on `CatalogProductCard`, and `large-format.ts` a `CARD_SELECT`
  consumer with a byte-identical where. The hand-rolled tile is gone; the variant is
  passed by CONTEXT on the tier-homogeneous page.
- **Step 8a — PDP presets.** `tier-order-copy.ts`: the three fields off
  `ProductTier.<tier>` (the CTA is the tier's `primaryCta`), `selectOrderCopy` the one
  precedence rule the panel and the Server Action share (out of stock wins), Tier 03's
  intro byte-equal to the default order intro, the byte-identical payload a `toBe` on the
  built message. The smoke clicks the form's submit control (the label now reads
  "Commission a piece" on the LARGE demo PDP); the persisted `Inquiry` mirrors the wa.me
  message. T6's leak closed at the hero and the summary.
- **Step 8b — the facet.** `?sizeTier=large|medium|small`, slugs derived from the enum,
  registered in all five places (filters type · where clause with a test that no clause
  touches `tier` · both pages' parsing, hrefs, `hasFilters` and the collection page's
  hand-listed object · the explorer's apply, Load more payload and deps, chip and drawer
  rows · the load-more zod schema). The drawer section sits last and closed until the
  catalogue is tiered. `search-query.ts`'s tier-sort comment now says which tier it is.
- **Still at a question:** navigation (T2), the homepage band (T8), Tier 02's guided path
  (T4). Not built around.

### Verified

typecheck · lint · **1,056 unit tests** (98 files) · **test:db 87/87, twice** · copy:check ·
i18n-missing 0 missing and `--stale` clean · a real build against Postgres 16 + pgvector
0.6.0 · motion-budget 48.4 KB (unchanged, under the 49 KB ceiling) · **e2e smoke 36/36** ·
the redesign, a11y, keyboard and Studio audits — see the PR body.

---

## Fix — a failed-migration record heals itself when it provably left nothing behind (2026-09-16)

PR #87. Production deploy `573f43b` failed with **P3009**: `20260917090000_analytics_opportunity`
(the B8 migration) was recorded in `_prisma_migrations` as *failed*, so Prisma refused to apply
anything newer. The migration itself was fine — pure additive `CREATE TABLE`s, byte-verified. The
record was the problem: Vercel runs `migrate deploy` for **preview** deployments against the
production database too, and a superseded preview build was cancelled mid-migration.

- `scripts/migrate-deploy.mjs` now gives P3009 **one guarded chance to heal itself per build**:
  parse the failed migration name(s), read each one's own `migration.sql` from the repo and
  extract the tables it creates, query the database (the same unpooled URL chain
  `prisma.config.ts` uses), and — **only when NONE of those tables exist**, which for this
  repo's additive-only migrations proves the migration left nothing behind — run
  `prisma migrate resolve --rolled-back <name>` and let the deploy re-apply from scratch.
- Everything else stops the build exactly as before, with the exact manual commands printed:
  a table it would create already exists (partial application — a human decides between
  drop-and-rolled-back and `--applied`), the migration is ALTER-only (a half-applied column
  cannot be ruled out this way), or the footprint cannot be checked at all. **It never runs
  `--applied`.** That is a human's call, every time.
- New module `scripts/lib/migrate-resolve-failed.mjs` holds the parsers and the guard's
  reasoning; 10 new unit tests run them against the real production P3009 output.

> The six entries below — **B5 (PR #81) · B6 (#82) · B7 (#83) · B8 (#84) · B9 (#85) · A9 (#86)** —
> were merged on 2026-09-16 without being pasted: the API channel those sessions pushed through
> could not write a 242 KB file, so each PR body carried its entry and asked for it to be landed
> on merge. They are landed here verbatim, newest first. Three carry the 2026-09-17 date their
> authors wrote (the migration directories are dated the same way); the merges happened on
> 2026-09-16 UTC.

## A9 — Studio scraper workspaces (2026-09-17)

- **Workflow runs** (`/studio/scraper/runs`, plan §6): every scrape job as a
  filterable feed — status chips with true per-status counts, source filter,
  pagination, demo rows excluded by clause. Retry queues a FRESH job for the
  failed run's exact target (the failed row is a dated record, never
  reopened — D24) under the one-run-per-source guard; cancel terminal-writes
  an in-flight job as FAILED with the operator's name on the error line so a
  hand stop never reads as a source fault. Semantics live in
  `run-control.ts`, db-tested without an auth session.
- **Product explorer** (`/studio/scraper/explorer`): the researched corpus
  as one table with raw and normalized values SIDE BY SIDE — the staged
  row's own fields next to B6's reference-variant pick and B4's
  alias-resolved materials, computed at read time so a mapping fix relabels
  history without a re-scrape. League/source/state filter in the query;
  basis/title filter the shaped rows; "showing X of N" on every read. A
  quote-only listing shows quote only, never a zero.
- **Large-format workspace** (`/studio/scraper/large-format`): image-first
  cards for shortlisted/confirmed pieces from LARGE_FORMAT-tier sources —
  dimensions, material stack, reference price, top-3 B9 neighbours via
  pgvector — plus the INSPIRATION_ONLY reference board as the image wall it
  exists to be. Human-gated (rule 8): nothing arrives here on its own.
- **Tidyings**: `PRICE_BASIS_LABELS` is canonical in `price-basis.ts` (was a
  page-local const); the B9 embedder and the explorer share
  `splitMaterialList`; the stage rail's Scraping cell lands on the runs
  feed; the hub links all three screens.

## B9 — Embeddings + similarity (2026-09-17)

- **ProductEmbedding** (new table, plan §4 phase 8's `hash · model · version
  · vector`): one derived vector per researched product per embedder model.
  `features` JSON stores the weighted feature list the vector was built from
  — rule 7 applies to embeddings: the working is on the row. `hash` (sha1 of
  the canonical feature list) is the change key; `model` + `version` name
  the generation so a future semantic or vision model is a new value, never
  a silent change to what a vector means. `vector` is a pgvector
  `vector(512)` column Prisma never models — written and read through raw
  SQL, with pgvector's own `<=>` cosine operator (the plan's "no hand-rolled
  index" rule; migration starts with `CREATE EXTENSION IF NOT EXISTS
  vector`).
- **The `attr-hash` v1 embedder** (pure module): namespaced weighted
  features — title tokens ×1, alias-resolved materials ×2.5, category ×2,
  league ×1.5, coarse INR price band ×1, option-label tokens ×0.75 —
  feature-hashed into 512 signed dimensions, L2-normalized. Deterministic
  and offline: no AI key exists in this deployment, and an unauditable
  external similarity number fails rule 7. Quote-only pieces contribute NO
  price band; products with no usable identity text get NO embedding.
  Scope stated in the module header: identity text, not images — visual
  similarity is a new `model` generation on the same table.
- **Recompute is explicit and incremental**: a Studio action behind
  `requireStaff` (no scrape, no cron) rewrites only rows whose feature hash
  moved, keeps the rest with their original `computedAt`, and prunes other
  model generations wholesale — embeddings are derivations, not dated
  records (D24). Materials resolve through the owner's NormalizationAlias
  rows read fresh, so a mapping fix moves embeddings without a re-scrape
  (B4's rule, extended).
- **Similarity reads**: cross-source duplicate candidates at ≥ 85% cosine
  (the signal the DUPLICATE shortlist state exists for) and top-5 nearest
  neighbours for every shortlisted/confirmed product — the whole corpus is
  indexed, but which pieces the owner compares is a human-gated list
  (rule 8). Price bands come from B6's reference-variant pick, so "similar"
  and "comparable" never drift apart.
- **Surface**: `/studio/scraper/analytics` gains a Similarity section —
  "embedded X of N researched products" stamps with the no-signal exclusion
  named, the duplicate-candidate pairs table, and neighbour cards, behind
  its own Recompute embeddings button and empty state.
- **Infra**: CI's throwaway Postgres moves to `pgvector/pgvector:pg16`
  (drop-in `postgres:16` with the extension). Production must be
  pgvector-capable; if it cannot be, the plan's honest fallback is a managed
  vector service.

## B8 — Analytics + opportunity score (2026-09-17)

- **AnalyticsSnapshot** (new table): precomputed analytics payloads keyed
  `(view, league, scope, sourceKey)` with `""` as the not-applicable sentinel
  — never NULL (the compound unique stays upsertable) and never meaning "all"
  (the key vocabulary has no spelling for "every league", so a league-wide
  number cannot silently become an all-leagues one). Every payload carries
  `computedFrom { included, considered, exclusions }` with the invariant
  *included + Σ exclusions = considered*; `includedCount`/`consideredCount`
  are duplicated as columns so the table is auditable as SQL. Stamped
  `computedAt` · `scrapeRunId` · `normalizerVersion` · `analyticsVersion`
  (n1 / v1) so a formula change makes stale rows recognizable.
- **Views**: `league-price-benchmark` (every league × every comparison scope,
  league-wide and per-source; type-7 min/p25/median/p75/max/mean over the
  scope's picks; the QUOTE_ONLY_SEPARATE arena is a COUNT, never a price —
  quote-only rows carry NULL prices by design) and `funnel-overview` (the
  corpus counted through the shortlist states, entry-less products folded
  into NEW). Benchmark rows are fetched through B6's `variantWhereForLeague`
  guard — a materials price cannot reach a finished-art median BY CLAUSE.
- **OpportunityScore** (new table): one row per **component** per product —
  market-depth 0.35, price-fit 0.35, freshness 0.2, option-richness 0.1 —
  each with `value` (nullable: null means unmeasurable, contribution 0, and
  the `detail` says why — never guessed), `weight`, `contribution`, and
  `detail` showing the working in words. No total is stored: Σ contribution
  is computable from the rows, and a stored total would be a score with the
  working thrown away (rule 7). Scores exist only for products a human
  shortlisted or confirmed — derived data is human-gated too (rule 8).
- **Recompute is explicit**: a Studio action behind `requireStaff`, never a
  cron and never a scrape. It replaces both tables wholesale in one
  transaction each — derivations, not dated records (D24 protects what a
  source said, not what we computed from it) — which is also what keeps a
  re-leagued source from leaving a stale per-source row behind.
- **Surface**: `/studio/scraper/analytics` — benchmark tables with a
  "computed from X of N rows — excluded: …" line under every number, funnel
  chips, and opportunity cards with per-component bars, value × weight, and
  the detail string, ranked by Σ contribution. Linked from the scraper hub
  and the confirmed page.
- **Decision**: `ShortlistEntry.linkedOpportunityId` (plan sketch) is
  deliberately not added — `OpportunityScore.researchProductId` IS the link;
  a second pointer would be two spellings of one fact. `ProductEmbedding`
  remains B9.

## B7 — Shortlist → confirmed → export (2026-09-16)

- Added `ShortlistState` (NEW · REVIEW · SHORTLISTED · REJECTED · CONFIRMED ·
  INSPIRATION_ONLY · DUPLICATE) and `ShortlistEntry`, keyed one-per-
  ResearchProduct (hand-written additive migration
  20260916190000_shortlist_entries). An entry records a decision — state, who,
  when, why, note, tags; a product with no entry is implicitly NEW.
- Backfill maps the legacy review queue forward (APPROVED→SHORTLISTED,
  REJECTED→REJECTED, IMPORTED→CONFIRMED, plus PENDING rows carrying notes)
  with changedBy NULL — no invented authors; the reason records the
  provenance.
- New `src/lib/scraper/shortlist.ts`: the seven-state transition machine.
  CONFIRMED is reachable only from SHORTLISTED and leaves only back to
  SHORTLISTED; no automatic transitions anywhere (rule 8).
- Review inbox rebuilt on entries (`shortlist-query.ts` + `shortlist-inbox.tsx`,
  replacing review-grid.tsx): seven clickable state filters, bulk moves that
  report moved / already / refused instead of failing a mixed selection, notes
  and tags on the entry, import dialog wired to the shortlisted selection.
- Legacy coexistence: `reviewStatus` stays the promote path's input, mirrored
  both ways (SHORTLISTED→APPROVED down; APPROVED→SHORTLISTED up, never
  un-confirming a CONFIRMED entry); importing now confirms the entry — the
  backfill's mapping applied going forward.
- New `/studio/scraper/confirmed` page — the gated final list — with CSV/XLSX
  export at `/api/scraper/export-confirmed` (ADMIN-only; formula-injection-safe
  CSV via the shared writer, XLSX via exceljs). Every row carries the B6
  reference-variant pick and its rationale; quote-only exports an empty price,
  never zero (rule 3).
- Tests: 17 new unit tests (transitions, legacy mapping both ways, export
  serializer) + tests/db/shortlist-write.test.ts (9 db tests: the gate rules,
  both mirrors, the import-confirm door, first-move provenance).

## B6 — Fair comparison scopes + leagues (2026-09-16)

- Added `AnalyticsLeague` (FINISHED_ART · MATERIALS_DIY · MARKETPLACE_B2B) and
  `ScrapeSource.analyticsLeague`, backfilled from the owner-set `supply` flag
  (hand-written additive migration 20260916120000_analytics_league).
- New `src/lib/scraper/leagues.ts` + `league-query.ts`: league vocabulary and
  the server-side query guards (`snapshotWhereForLeague`,
  `variantWhereForLeague`) — enforced in the query, not a UI filter.
- New `src/lib/scraper/comparison-scopes.ts`: the four comparison scopes
  (all-variants · base-product · unique-design · quote-only-separate) with a
  deterministic reference-variant pick whose rationale is recorded per row.
- Write path stamps non-benchmark leagues' variants `isReference` with a
  `league:<LEAGUE>` reason; re-leaguing a source bites at query time without
  rewriting dated snapshots (D24).
- Studio: "Which market it sells into" select on the source page, with the
  league's own description; `setSourceAnalyticsLeague` server action.
- Tests: 17 new pure tests + tests/db/league-guard.test.ts (test:db) proving
  the stamp and the guard meet — a league's average excludes reference rows
  BY CLAUSE.

## Workstream B step 5 — two adapters keyed on markup shape (2026-09-16)

B5 of `docs/plan/02-scraper-rebuild.md`: prove the phase-6b schema survives both catalog
styles — a priced/variant store and a bespoke/quote studio — before it hardens.

### What shipped

- **`adapters/markup-shape.ts`** — `detectMarkupShape()` keys a page on what its markup
  looks like: commerce markup with a declared price → PRICED_STORE; no price + a
  quote/enquiry CTA + piece-page structure → QUOTE_STUDIO; anything else → NONE.
  Strictness is the design: price text alone never promotes a page (a category grid is
  full of it), and a page carrying several product identities is a listing, whatever its
  cards claim.
- **`adapters/priced-store.ts`** — single product pages with commerce markup but no
  usable JSON-LD Product node (microdata, OG product tags, `data-product_variants`
  blobs). One variant row per published option; a bare range becomes floor+ceiling rows,
  never an invented midpoint; the price block's own words ("per sq ft", "Price on
  request") travel in `shortTagline` so basis derivation sees them at persistence.
- **`adapters/quote-studio.ts`** — bespoke atelier piece pages: no price, a quote CTA,
  spec lists. Emits exactly one variant with `priceMajor: null` → QUOTE_ONLY → NULL
  stored, never zero. `showPrice: false`, because there is no price to show.
- **Wiring:** the JSON-LD adapter's fetch path now falls back to `mapPageByShape()` when
  a page has no schema.org Product node — sitemap-discovered pages without JSON-LD
  extract instead of silently skipping. Pages with Product nodes are untouched;
  non-product pages still yield nothing.
- **`docs/adapter-acceptance-checklist.md`** — the plan names an Adapter Acceptance
  Checklist as B5's definition of done, but the source brief's checklist was never
  committed (verified by repo-wide grep). This repo now carries its own, labelled as
  agent-written; reconcile with the original if it is ever supplied.
- **One shared vocabulary:** `price-basis.ts`'s phrase patterns are now exported, so
  shape detection and basis derivation can never drift apart.

### Verified

- 30 new fixture tests (zero network calls) covering the checklist gates: identity,
  quote-only integrity end to end through `derivePriceBasis`/`priceForBasis`, range →
  floor/ceiling, spec extraction, and the negative gates (blog post, listing page,
  malformed HTML all yield null without throwing).
- Full unit suite **891 passed** (87 files), typecheck clean, lint clean on the changed
  area.
- Not run locally: `test:db` (needs Postgres), the build, `studio-audit` and e2e — CI
  covers them on the PR.

---

## Workstream E step 3 — the untiered backlog, made visible and fixable (2026-09-15)

`Product.sizeTier` shipped nullable against a catalogue of ~4,485 rows, so on the day it
landed the backlog was the entire catalogue. This is the pass that makes it something an
owner can clear, and it lands **before** anything renders a tier on purpose.

### Four surfaces, one filter value doing the work

- **"No tier yet" is the FIRST option** in the product list's new Product tier filter, not
  an afterthought at the bottom. A filter that could only select the three tiers would
  show the owner everything they have already done and nothing they still have to do.
- **Bulk "Set product tier"**, in the shape of `setProductsCategory` — and deliberately
  with **no "— none"**. Un-tiering a filtered selection of thousands on one misclick is
  not a correction anyone asked for; the product form already clears the one row where it
  is a real one.
- **A `/studio/content-gaps` card**, counting the whole backlog rather than only published
  rows, linking straight to `?sizeTier=NONE&status=ALL`.
- **A Product tier column** beside the renamed Import tier one, showing `No tier yet` as a
  badge rather than a dash — a row that reads "—" looks finished.

### `sizeTier: null` could not ride the truthiness pattern

Every other clause in `buildProductWhere` is `...(filter.x ? { x } : {})`. `null` is a
real clause and a falsy value, so a "NONE" that fell through to that branch would apply
**no filter at all** — showing the whole catalogue and calling it the backlog. It is
matched first, and `product-filter.test.ts` pins it. **Verified by mutation**: replacing
the branch with the naive one-liner fails two of its eight tests.

### Both writers the Studio guard cannot reach

A `product_tier` column on the Bulk Import template **and** the matching column on the
confirmed export — both or neither, so a file can be exported, edited in a spreadsheet and
re-imported without losing the tier. `parseSizeTierCell` accepts the short word (`LARGE`)
as well as the enum name, because the person filling this column in is in a spreadsheet
and `MEDIUM_FORMAT` is a database identifier leaking into an owner's tool. An **empty cell
means "no opinion"** and is omitted from the write, exactly as `in_stock` already behaves,
so re-importing an older export never un-tiers a product the owner filed in the studio.

### The table ran out of room, and the gate caught it

A twelfth column pushed `/studio/products` to **1450px in a 1440px viewport** and
`studio-audit.mjs` failed the route — measured, not predicted. Two fixes, both kept: the
column renders a one-word label (`Collectible` · `Memory` · `Personal`, full name in the
`title`) rather than the four-word customer name, and the two tier columns take `pe-2`
where every other column takes `pe-4`. That is 16px against a 10px deficit. A thirteenth
column needs a real answer — a default-hidden column, or moving the scroll region past
`xl` — and the comment at the call site says so, because this margin is now spent.

### Verified

typecheck · lint · **863 unit tests** (14 new across two files) · 51 db tests ·
copy:check · a real build · `studio-audit.mjs` clean at 1440 **and** 390 across 39 routes ·
`test:e2e` **36/36**. Then driven by hand against the built server: the content-gaps card
and its deep link, the filter reading "No tier yet" over 50 backlog rows, the bulk control
offering exactly three tiers, the toast reading "Filed 2 products under Memory &
Celebration Art", and those two rows appearing under the MEDIUM filter afterwards.

---

## Workstream E step 2 — `Product.sizeTier`, and the studio control that writes it (2026-09-15)

The owner's three-tier product architecture gets its column. Additive migration, a
control in the product form's Essentials, a publish refusal on both write paths, and
nothing on the storefront yet — a tier that renders before the catalogue can be tiered
renders an empty world.

### A new column, because `Product.tier` is taken

`schema.prisma` already declares `tier Int?` — the owner-sheet import tier — indexed and
read by `shop.ts`'s default sort and nine other places. Retyping it would be a rename of
an indexed column live queries sort on, and it would reach production **on push**. So:

    ProductSizeTier { LARGE_FORMAT · MEDIUM_FORMAT · SMALL_FORMAT }
    Product.sizeTier  ProductSizeTier?   @@index([sizeTier, status])

Three columns now carry the word "tier" and `CLAUDE.md` names all three: `Product.tier` is
where a row CAME FROM, `Product.sizeTier` is what a piece IS, `ScrapeSource.tier` is which
supplier list we went looking in.

**The migration is hand-written and carries no backfill.** Not one `UPDATE`. There is no
rule that could assign a tier without inventing it, and this file runs against production
before any screen exists to check what it did. `prisma migrate diff` was not used to
generate it and must not be — it re-proposes dropping `Product_{title,shortTagline,
description}_trgm_idx`, which `schema.prisma` does not model.

### The refusal is scoped to the transition, and that is the whole design

"Every product carries a mandatory tier" cannot be a `NOT NULL DEFAULT`: three writers
create products without passing the studio form — the scraper's promote, Bulk Import, and
`tier-fill.ts` on **every deploy** over thousands of rows — so the constraint would break
backward compatibility and invent the answer in the same statement.

So the column is nullable and `describeSizeTierPublishProblem` refuses a move **into**
PUBLISHED. It deliberately ALLOWS saving a row that is already published:

> The column is new, so all ~4,385 rows in the catalogue are untiered. Refusing every save
> of an already-published product would have stopped the owner editing any of them until
> all of them were tiered — with no bulk tool built yet to do it. A guardrail that turns
> into a lockout is a bug. Nothing NEW goes live untiered; what is already live keeps
> saving, and step 3 is the filter and the bulk action that clear the backlog.

Both write paths apply it: `upsertProduct`, and `setProductsStatus`, where the bulk skip
is filtered as `sizeTier: null AND status != PUBLISHED` for the same reason. The toast now
names **both** skip reasons — "Skipped 3 that still need a rewrite of scraped content, and
9 with no product tier set". "Skipped 12" with no reason is the message that sends an
owner looking for a bug that is a guardrail.

### One tuple, and a test that fails when someone forgets it

`src/lib/product-size-tier.ts` is the only place the list lives; the zod enums, the select
options, the labels and the form mappers all derive from it. `product-size-tier.test.ts`
pins the tuple against the generated Prisma enum — **verified by mutation**: dropping
`SMALL_FORMAT` from the tuple fails two tests and the typecheck. That guard exists because
the scrape-tier list reached five hand-written copies, and the fifth (a `TIER_ORDER` array)
is why three new tiers shipped invisible last week.

### Also: "Tier" is now "Import tier"

With a **Product tier** select in Essentials, leaving the provenance select in Pricing &
specs labelled "Tier" put two questions with the same name on one page. It is relabelled
in the form and in the product list's column menu and filter. **Keys are untouched** — the
column key stays `tier` because saved views persist it.

### Verified

typecheck · lint · 849 unit tests (14 new, one existing fixture updated) · 51 db tests ·
a real `npm run build` against local Postgres · `studio-audit.mjs` clean at 1440 **and**
390 across 39 routes · `npm run test:e2e` **36/36**, product create → edit → delete
included. Then driven by hand in a real browser against the built server: the select
renders all four options with the right labels, the hint changes with the choice, and
saving a PUBLISHED product with no tier returns exactly the refusal — screenshotted, not
assumed.

Applied to a local database and checked in `psql`: the type has its three labels, the
column and `Product_sizeTier_status_idx` exist, and `migrate diff` against the datasource
reports no `sizeTier` drift — only the three known unmodelled trgm indexes.

---

## Workstream E step 0 — the three-tier product architecture, made findable (2026-09-15)

The owner's product architecture — **Collectible Furniture & Spatial Art** · **Memory &
Celebration Art** · **Personal Art & Gifting**, three customer intents rather than three
filters — was written to `docs/plan/07-three-tier-architecture.md` and referenced from
`CLAUDE.md`, and from nowhere else. This entry is the docs half of the owner's
instruction to put it "in md and all also and in all main and primary place".

### It was unreachable from every entry point but one

Measured, not assumed. `docs/plan/README.md` — the index of the workstreams — contained
zero occurrences of `07` or `three-tier`. `AGENTS.md`, `README.md` and `PROJECT_STATE.md`
contained zero occurrences of `docs/plan` at all. An agent or a person following the
repo's own "read these, in this order" table would never arrive at the document that
governs what a product card is.

So the architecture now appears in four places that a session actually opens:

- **`docs/plan/README.md`** — workstream **E**, with the "not three filters" warning in
  the index itself, and phase 9 in the sequence table.
- **`AGENTS.md`** — a section immediately under the HARD RULES, with the tier table, the
  three-columns-named-tier trap and the eleven recorded conflicts; plus two new rows in
  the reading table.
- **`README.md`** — the documentation table, and the "Website Structure" section, which
  described the site's shape without it.
- **`PROJECT_STATE.md`** — a current SESSION CHECKPOINT. The one that was there said
  **"Next Exact Task: none from the plan"** and was dated 2026-09-04. It is kept, marked
  superseded, and not rewritten: a dated record that gets edited stops being evidence
  (D24).

### The correction that made this step necessary

An earlier draft of 07's own sequence said step 2 was *"`Product.tier` as the three-value
taxonomy"*. **That column is taken and it means something else**: `schema.prisma:113`
declares `tier Int?` — the owner-sheet import tier (1 owner · 2 resin goods · 3 supplies ·
4 3D-print) — indexed as `@@index([tier, status])`, written by `tier-fill.ts` from
`data/tiers/*.csv.gz`, and read by `shop.ts:189`'s DEFAULT SORT, `search-query.ts`'s group
ranking, `groupForTier`, the Bulk Import validator, the confirmed-products export and the
demo fixtures' zod shape.

Retyping it is a rename of an indexed integer column that live queries sort on — which
`CLAUDE.md` classes as unsafe, and which would reach production **on push**, not on merge.
The size taxonomy therefore lands on a new nullable enum column, **`Product.sizeTier`**.
`tier` is where a product came from; `sizeTier` is what it is; `ScrapeSource.tier` is which
supplier list we went looking in. All three are now named and distinguished in `CLAUDE.md`,
because three columns called "tier" is the trap that costs the next reader a day.

### Eleven conflicts recorded rather than resolved quietly

T1 — Tier 03's "Add to Cart / Checkout" — is **resolved**: Part 0 wins, and Tier 03 is
fast WhatsApp ordering, not fast checkout. T2–T11 are open questions in 07's own table:
the header nav's four items (REDESIGN.md §5.2 names them and the e2e smoke asserts them by
label), seven proposed new product fields (§1.1 lists product data first under
do-not-change), Tier 02's upload flow, a "made-to-order" field that `inStock` already
means, "price on request" against the PDP's `AggregateOffer` and a hardcoded English
`"Enquire"` outside next-intl, per-tier photography the asset queue cannot supply, a
homepage band that would breach §3.1's dark-band rhythm, a "Consultation" CTA the `Inquiry`
schema cannot record, and a `/collectible-design` route that `/large-resin-art` already is.

Each stops at a question. None is built around.

### Also corrected

`AGENTS.md` said the database was **Neon**. It is Prisma Postgres at `db.prisma.io` — the
build's own `db-preflight` prints the host on every deploy, and `CLAUDE.md` has said so
since the migration hazard was written up.

Docs only: no code, no schema, no migration.

---

## Fix — the site URL an operator pastes is repaired, not refused (2026-09-07)

Production failed on `NEXT_PUBLIC_SITE_URL: Invalid URL`, thrown from `src/lib/env.ts:87` during
`Collecting page data` and reported against two share-card routes:

    Error: Failed to collect page data for /[locale]/blog/[slug]/opengraph-image-t4foih

This is the **second** deploy this one variable has taken down, and the first fix predicted the
shape of the second: the 2026-08 entry recorded a value added in a hosting dashboard with nothing
in the box (`""` → `.url()` → `Invalid URL`) and closed it with `withoutBlanks`. This time the box
was not empty — it held the domain the way a dashboard *displays* it, with no scheme:
`www.rivyalivingart.com`. Same variable, same message, same dead build.

### Reproduced before anything was changed
`NEXT_PUBLIC_SITE_URL=www.rivyalivingart.com npm run build` against a throwaway Postgres reproduces
the deploy log line for line — `✓ Compiled successfully`, then the same two
`Failed to collect configuration` errors and the same `Invalid URL`. On the fixed tree the same
command exits 0 and generates all 415 static pages.

### Two independent throws, one value
Relaxing the validator alone would have moved the failure, not removed it.

1. **`env.ts`** declared `NEXT_PUBLIC_SITE_URL: z.string().url().optional()` and threw at module
   load. `db.ts` imports `env`, so that throw is not scoped to one route — it is every route that
   touches the database, which during `next build` is the whole app.
2. **`shared-metadata.ts`** calls `new URL(SITE.url)` for `metadataBase`, and `SITE.url` took the
   raw value through `envOr`. A scheme-less host throws there too, one build stage later.

And had both been merely tolerated, `${SITE.url}/path` — ~30 call sites — would have emitted a
*relative* string as every canonical, sitemap entry, JSON-LD `@id` and OG image URL.

### The validator could only ever have taken the site down
`env` exposes exactly two values to callers: `DATABASE_URL` (`db.ts`) and `AUTH_SECRET`
(`form-token.ts`). Nothing reads `env.NEXT_PUBLIC_SITE_URL`; `constants.ts` reads
`process.env` directly, because it is bundled into client components and cannot import a
server-only module. So the `.url()` refinement on an **optional** variable that no caller consumes
and that already has a working fallback had one reachable effect: failing builds. It was the only
optional key in the schema carrying a refinement, and therefore the only one that could.

### `normalizeSiteUrl` — one rule, both sides of the client boundary
`src/lib/site-url.ts` is pure and dependency-free so `env.ts` and `constants.ts` can share it
rather than disagree about what a value means (the old comment in `constants.ts` says outright that
it "repeats the rule locally"). It repairs rather than validates: trim, add the missing scheme
(`http` for `localhost`/`127.0.0.1`, which is what INSTALL.md documents; `https` otherwise), drop a
query or hash, strip trailing slashes — keeping the rule that shipped 14 double slashes onto the
live homepage. What it cannot repair it reports as `undefined`, i.e. the same as unset, so the
caller's fallback applies and the build lives.

Two cases were found by the tests rather than by reasoning, and both would have served the site
from the wrong origin silently:

- `mailto:hi@example.com` carries no `://`, so prefixing a scheme yields
  `https://mailto:hi@example.com` — which parses cleanly as `example.com` with a username. Rejected
  on `parsed.username || parsed.password`: an origin never has credentials.
- `/relative/path` became `https://relative/path`, a hostname invented from a path's first segment.
  A lone leading slash is now refused; `//host`, the protocol-relative form, is still repaired.

### Loud, since it is no longer fatal
An unusable value is now a `console.warn` from `loadEnv` naming the variable, the value and the
fallback. The build log is where an operator is already looking, and this is the only place that
knows both the value given and the origin actually used. A repairable value warns about nothing —
verified: the build above logged no warning, and the rendered `en.html` carries
`rel="canonical" href="https://www.rivyalivingart.com"` and the `#organization` `@id` to match.

Required variables are unchanged: a blank `DATABASE_URL` still refuses to boot, pinned by a test.

### Verified
`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` — 757 tests, 72 files, all passing (25 of
them new or extended, across `site-url.test.ts` and `env.test.ts`) · `npm run build` with
`NEXT_PUBLIC_SITE_URL=www.rivyalivingart.com` ✓ where it failed before the change.

### Not addressed here, and why
The same deploy log carries four deprecation notices. Three are informational (transitive
`rimraf`/`glob`/`inflight`/`fstream`, npm's `allow-scripts` prompt, Prisma advertising an 8.0.0
**release candidate**). The fourth is not: `pg-connection-string` warns that `sslmode=require` is
currently an alias for `verify-full` and will adopt weaker libpq semantics in `pg` v9 — a silent
loss of certificate verification on a future dependency bump. The fix is one character class in
`DATABASE_URL` (`sslmode=verify-full`), which is a hosting-dashboard change and not this repo's to
make; rewriting the connection string in code would cover the app but not the `prisma migrate
deploy` step that reads the variable directly, and partial coverage of a TLS setting is worse than
none.

---

## Transformation Phase 11 — the editors refuse in the field, not in a toast (2026-09-07, eighth batch)

The roadmap's first still-open Phase 11 line: "the react-hook-form editors mirror none of their
actions' length caps … so an over-long value is refused server-side as a raw zod message in a toast
with no field named — the same class the 2026-09-05 batch closed on the `useState` forms". Eight
editors, sixty-odd rules, and between them the client schemas carried **two** `.max()` calls.

### What an owner actually saw, measured before anything changed
Two symptoms, depending on how the action parses. Seven of the eight —
`settings`, `pages`, `blog`, `custom-pages`, `portfolio` and `products` — use `safeParse` and
return `issues[0].message`, so zod's own English reached the toast:
typing 400 characters into the default SEO title and pressing Save fired the request and came back
with **"Too big: expected string to have <=300 characters"** — no field named, and a number that
appears nowhere on that screen (the counters there are the 60/160 search-result budgets). Nothing
was marked, focus did not move. `testimonials` alone uses `.parse()` inside `runAction`, which
turns every throw into **"Something went wrong. Please try again."** — its nine caps and its four
media-URL rules were all reachable by typing and none could be told apart. (An earlier draft of this
entry said `products` did the same; it does not, and the adversarial pass caught the claim.)

### One module, because a copy cannot be tested
Every cap now lives in `src/lib/studio-limits.ts` and BOTH sides import it — the eight actions and
the eight client schemas. That is not tidiness. A file carrying `"use server"` may export only
async functions, so an action cannot hand its schema or even its numbers to a test; a cap copied
into a form could rot for a release with nothing to catch it. The repo already learned this the
hard way — `src/lib/research.ts` exists because a constant exported from an action arrived in a
client component as a server-reference proxy and took `/studio/research` down while every gate
stayed green — and `server-action-exports.test.ts` has guarded the rule since. A new test walks the
thirteen schema declarations across the eight action files and fails on a literal cap, so the next
one has to go through the module too.

### The trim asymmetry, which a uniform mirror would have got wrong
`settings`, `pages`, `blog`, `custom-pages` and `testimonials` declare `z.string().trim().max(n)`;
`products` and `portfolio` declare `z.string().max(n)`. Measured, not assumed: 300 characters plus
one trailing space passes the first group and is refused by the second. A blanket `.trim().max()`
on the client would have accepted what the product action refuses, and a blanket `.max()` would
have refused what settings accepts — the same defect, reintroduced from the other side. Each field
is mirrored the way its own action counts, and the module says which mode each entity uses.
`lexical` is the one field inside `products` that does trim, and it is mirrored trimmed.

### The refusal that named a field on another page
The two settings editors submit each other's fields: `/studio/seo` sends the whole `SiteSettings`
row back with only `defaultSeo` replaced, and `/studio/settings` sends `defaultSeo` back untouched.
The action reports only its FIRST issue in schema key order, and `defaultSeo` is the twentieth of
twenty-one keys — so on a row whose WhatsApp number has never been filled, **every** SEO save is
refused with "WhatsApp number must be 8–15 digits…", about a field on a different screen, with
nothing on the SEO page to fix. Both forms now check the half they do not render before calling the
action and say which screen to go to instead of passing on a message the owner cannot act on.

### Also closed
The testimonial's four media fields mirror the host rule (`isOptimizableImageSrc`), so a URL from
another site is refused where it was typed rather than as "Something went wrong". The product
editor's SEO pair carries a hint reconciling the cap with the preview's 60/160 budget, since a bare
"300" beside a "60" reads as a contradiction. Nine fields that had nowhere to put a message got a
`FieldError`, and the announcement, phone, response-note and care-notes hints gained ids so a
screen reader hears them. React Hook Form's own focus-on-error does the rest: every capped field is
`register()`ed, so the first refusal takes focus without a line of new code.

### Verified
Typecheck, lint over the whole repo and the unit suite (734 tests — twenty-two new ones cover the
message builder, the WhatsApp pattern, both cross-form guards and the drift walk) clean; production
build against a local Postgres. **23 cases in the browser at 1440×900, one per capped field across
all eight editors**, each filled to the cap plus one character and submitted: every one shows the
message under the field, sets `aria-invalid`, fires **no request at all** (the refusal is now
client-side — counted, not inferred), and raises no toast. Two rounds were needed. The first found
seven fields whose schema refused but whose render had no `FieldError` — a silent refusal, worse
than the toast it replaced — on the testimonial's location and internal notes, both landing-page
SEO fields, the journal's excerpt and SEO title, and the portfolio's result type. All seven, plus
the product's image alt text, help text and lexical rows, were wired before the second round, which
passed 23 of 23.

A third round came from auditing the schemas mechanically rather than by eye: a script that walks
every capped field in the eight client schemas and asks whether a `FieldError` is bound to it found
eight more with none — the settings opening-hours cells, the landing page's address and sharing
picture, the testimonial's photograph and installation URLs, the portfolio's image alt and caption,
and the two ARRAY-level caps (the product's lexical rows and its linked products), which no single
control owns and which are now reported under their sections. Two fields it flagged are genuinely
unreachable and were left alone: a boolean caught by the schema-level refine, and a rating that
comes from a widget offering only one to five.

### What the adversarial pass found
Four independent lenses over the batch. Three findings held, and one of them was a regression this
batch introduced. **The product's lexical cap counted the wrong rows:** the client counted the rows
on screen while the action counts the rows the payload SENDS, and `buildUpsertPayload` drops any
row missing a label or a value — which is exactly what "Add row" and the suggestion chips append.
Eight filled rows plus one blank was refused by the form and accepted by the action, and before this
batch that save had worked. It now counts what it sends, the way the portfolio's tags already did,
with five unit tests over the boundary. **The linked-products picker** kept offering rows past its
own limit, so it stops at the cap rather than letting a Save be refused for a link already on
screen. **The landing page's go-live date** was the one capped action field left unmirrored;
unreachable through a `datetime-local` control, but the whole argument for the shared module is that
an unmirrored cap rots, so it is mirrored.

The pass also corrected a claim in this entry: `products` does not parse inside `runAction`, only
`testimonials` does. The sentence above says so now.

Its other two lenses went after the gates rather than the code, and were right to. **A refusal that
renders off screen is still a refusal nobody sees:** an array-level error has no input for React
Hook Form to focus, and the two cross-form guards render an alert above a form whose only Save
button is a sticky bar — measured at 1,500px below the fold. A small helper now brings the first
message into view, two frames late, and only once React Hook Form's own focus pass has failed to
reach an errored control. **The drift walk was reading thirteen named schema declarations**, which
let seven literal caps sit just outside the slices it read — one of them backing the journal's
inline taxonomy create form, a live instance of the same defect in a ninth form nobody had counted.
That form now mirrors its cap; the walk reads whole files and every remaining literal is named with
its reason. **Three module entries were dead**, so their rule was duplicated in exactly the way the
module exists to prevent: the product's minimum title length and the portfolio's year pattern are
read from it now. The opening-hours guard named the days limit whichever column overflowed, which
is wrong the moment the two diverge. And the pin test covered sixteen of sixty-five numbers; it
covers all of them.

The gap those lenses really found was that **nothing gated the defect class this batch introduced.**
`studio-field-messages.test.ts` walks every rule in the eight client schemas and fails when one has
no message bound to it, with an escape list that must name a reason and is itself checked. It found
a real gap on its first run — the landing page's go-live date, capped two commits earlier and never
wired.

## Transformation Phase 11 — every Studio form gets its local draft (2026-09-07, seventh batch)

The roadmap's autosave line was done on the three long editors and open on eight other forms:
five react-hook-form editors that needed the same five lines, and three dialogs — FAQ, category,
research — whose fields are a dozen `useState` setters and no form library, so the hook typed on
`watch`/`reset` could not be attached. This batch is that line, closed.

### Five editors, the same five lines
The testimonial, landing-page, legal-page, settings and SEO forms mount `useLocalDraft` exactly as
the product, journal and portfolio forms do: the hook after the guard, the bar as the form's first
child, `draft.discard()` in the successful-save branch after the baseline reset, autosave off
while a save is in flight. Two of them needed one thing more. The testimonial's two link pickers
keep their display — the linked product's or case study's title — beside the form rather than in
it, so a bare restore would have shown the row's link while the draft's id was what got saved; the
form's Restore brings the pickers along, and where the restored id is neither the row's link nor
the one on screen the picker shows a plain placeholder the owner can re-pick over. The legal pages'
rich-text body and their translations strip read their value once on mount, so both are keyed on
the restore count, as the journal's are. Settings and SEO are one row each, so their slot is an
explicit `singleton` rather than the create form's `new`. The landing page's draft covers its
metadata; its blocks are saved one at a time on the board and are outside the form.

### Three dialogs, and the hook they needed
`useLocalDraftValue` is the value-shaped sibling: the dialog hands over its current `values`
object each render, the `initial` values it opened with, and an `apply()` that fans a restored
record back into its setters. Same storage key, same serialisation, same bar. Two rules the
react-hook-form hook never needed: a draft equal to what the dialog opened with is never written,
and one this mount wrote is removed again if the edit is undone — without that, every dialog
opened and closed would leave a "you have unsaved edits" bar for the next open, and the bar would
be noise within a day; and `initial` is read once, on mount, because the bodies remount on every
open and that moment is the baseline. A pre-existing draft is offered, never applied; Cancel keeps
it (the dismiss guard already stops an accidental close, so a deliberate Cancel is the person
saying put it aside, and the copy costs nothing to discard next time); a successful save clears it
and switches the hook off for the render between the save and the close. The store — the listener
set, the snapshot cache, the read through `useSyncExternalStore` — moved out of `useLocalDraft`
into shared internals both hooks use. The three editors keep their five-line call sites; what
changed for them is all in Restore and Discard and is listed below (Restore keeps the mount
baseline, Discard cancels a pending write, Restore folds the record onto the values on screen, a
foreign draft is never written over, a pending write is flushed on leave, and the bar is off
during a save). `sameDraftValues`, the order-insensitive deep equality behind the first rule,
lives in `lib/local-draft.ts` with five tests.

### What the reading and the browser fixed on the way
Restore replaced the form's defaults with the restored values, so a restored draft read as SAVED —
`isDirty` false, no "Unsaved changes", the navigation guard disarmed — until the next keystroke,
though the database held none of it; it keeps the mount baseline now (`keepDefaultValues`), and a
restored edit is unsaved until saved. Discard could be undone by its own Restore: `reset()`
notifies `watch`, the debounce scheduled a write, and a Discard inside that 800 ms window was
followed by the draft coming straight back — measured in the first browser pass; Discard cancels a
pending write in both hooks. The three dialog bodies were keyed by row on the belief that Radix
unmounts them on close; it unmounts the CONTENT, not the body, so the create dialogs' typed fields
survived a Cancel and greeted the next open — they are keyed by open state too, the shape the
scraper's Add sources dialog already used, and the local draft is what keeps the copy. The
category dialog ran to 1348px in a 900px viewport with no ceiling and no scroll, so Cancel and
Create sat below a laptop's fold with no way to reach them; it has the 85vh ceiling the FAQ and
research dialogs had. A deleted row's draft is discarded rather than left as an orphan under an id
never reused — from the editors' own Delete and from the three lists' bulk delete alike (the
lists reached the store directly; the first cut only covered the editors). A Restore in the three
dialogs clears the field errors it may have fixed, since the next submit re-judges them anyway.
Restore trusted the stored record's shape: `parseDraft` checks the envelope, not the values, so a
draft written before a field was added or renamed restored `undefined` into that field — a
controlled input turned uncontrolled, and the next submit threw at its `.trim()` (the react-hook-form
hook had the same hole through `reset`). Both hooks now fold the record onto the form's current
shape first (`coerceDraftValues`: a key the form no longer has is dropped; a key it has gained, or
whose stored value is missing or of another kind, keeps the form's own value — the editors fold
onto the values on screen, the dialogs onto what they opened with), and a draft with nothing
usable in it is discarded by Restore itself instead of lingering (the first cut left that to the
write effect, which an all-string dialog like research never re-runs when its setters are handed
values equal to state). **Three more from the adversarial pass over the design, all measured in
the browser:** the write path had no gate, so on a row holding a crash's draft the first stray
keystroke into the autofocused field replaced that draft 800 ms later, with no Discard pressed —
a draft the mount did not write is now never written over (it is the person's to Restore or
Discard; until then their typing is not autosaved, the bar says so, and after either it is, with
the next change, so Discard does not see the bar come straight back); the bar's Restore and
Discard stayed live while a save was in flight, when a Restore would repaint the form with values
the request did not carry and the ok branch would then discard them — both buttons are off with
the form's own for that window; and Cancel or the ✕ inside the debounce dropped the last 800 ms
of typing, the end of a transcription, because the unmount cleanup only cancelled the pending
write — both hooks flush it on leave now (a successful save discards first, so nothing is flushed
behind it; a hard reload runs no cleanup and still loses that window). And
the bar's header claimed it showed a draft "newer than what the form mounted
with" — the hook makes no such comparison, so the header says what is true and the comparison is
recorded as open on the roadmap.

### Verified
Typecheck, lint and the unit suite (712 tests — the twelve new ones cover `sameDraftValues` and
`coerceDraftValues`) clean; production build against a local Postgres. Seven Playwright passes at
1440×900, drafts cleared from storage before each. **The five editors:** on a new testimonial, the demo lander's
metadata, settings, SEO and a legal page, one edit is in `localStorage` under the right key
(`studio:draft:testimonial:new`, `…:custom-page:demo-lander`, `…:settings:singleton`,
`…:seo:singleton`, `…:page:<id>`) within 1.5 s; after a reload the field is back to the saved value
and the bar reads "You have unsaved edits"; Restore repopulates the field — on the legal page the
text typed into the rich-text body too; Discard removes the key and the bar. On the legal page a
save with a draft pending shows "Page saved.", removes the key and the bar, and the edit was
reverted after. **The three dialogs**, each on its create form: opened and closed untouched, no
key; typed, then Cancel, the key stays; reopened, the bar shows and the field is empty; Restore
fills it, Discard clears key and bar; typed again and undone to the opening value, the key this
mount wrote is removed. **An existing FAQ:** the draft is keyed by its row id; a different row
opens with no bar and its own text; back on the first row the bar shows, Restore fills, Discard
clears. **A save:** creating an FAQ with a draft pending removes the key, closes the dialog, and
the next New FAQ opens with no bar and empty fields. **The bulk delete:** an FAQ created, drafted
on and bulk-deleted from the list leaves no key behind; in the research dialog an empty submit
puts "Source is required." and "Title is required." on screen and Restore takes both off with
`aria-invalid`. **Shape drift:** a hand-planted SEO draft with a retired key, no description and a
number for the image restores the title, keeps the row's description and image, and is rewritten
well-shaped; the same on the FAQ dialog; one with nothing usable is gone after Restore, on the
all-string research dialog too. **The gate:** on an FAQ row and on the SEO form, a stray
keystroke over a foreign draft leaves the stored draft untouched after 1.5 s, Restore brings the
draft back over the stray character, Discard empties the slot and it stays empty, and the next
keystroke writes again; the bar's paused line shows over the foreign draft and not over a draft
this mount wrote. **The save window:** with the server action delayed 2.5 s, Restore, Discard and
the submit are all disabled mid-save and the draft is gone after. **The flush:** typing then
Cancel, or the ✕, within the debounce leaves the typing in the draft; typing then a sidebar
click, "Discard and leave", from the SEO form likewise; an untouched open and Cancel writes
nothing. No page errors in any pass. The first pass is what caught two of the fixes above — the
draft resurrected by its own Restore, and the category dialog's buttons below the fold — and the
later passes confirmed each fix closed.

## Transformation Phase 11 — the film fields the video picker missed, and the roadmap read against HEAD (2026-09-07, sixth batch)

### Three inputs that could only be pasted into
The media picker has listed videos since batch D (`MediaPicker accept="VIDEO"`, 2026-09-04), and
that batch wired it into "the three film fields written before it landed" — the testimonial's
video, and the video hero and video-and-words blocks. Three more film fields were left as bare
address boxes: the product's **Video URL** (the Images tab, and the tier-4 print section that
shares the field), the portfolio case's **Video URL**, and the site-images board's **Hero video**
slot, whose *From library* button listed pictures for a slot that can only hold a film. All
three now carry the same pair the testimonial form has — the input and a *Choose video* button
that lists the library's films and writes the URL through `setValue` so the form goes dirty and
the unsaved-changes guard knows. The board's button reads the slot's current file to decide what
to list, the same test it already used to hide the focal and crop controls on a film.

### Four more, found by reading the picker's reach against every media field
The same reading was then run over every field in the Studio that stores a picture or a film,
and found four more gaps, each closed the same way. **The testimonial's video** had the picker but
dropped the poster the library keeps beside a film: a pick now offers that poster into an EMPTY
poster field — never over one the owner chose, which the pass below checks by choosing one and
picking again. **The two film blocks** (video hero, video and words) had the same shape:
`VideoField` gains an `onPoster` callback and both editors prefill an empty poster from the picked
film. **Site settings and SEO** hold five media fields — logo, favicon, app icon, hero video and the
sharing image — through `UploadUrlField`, which offered Upload and nothing else; it takes a
`library` kind now, and the five list pictures or films accordingly. And **the site-images board's**
new *Choose video* keyed on the slot's CURRENT file: an owner who once mis-applied a picture to the
film slot would have been offered pictures from then on and could never choose the film back. It
keys on the registry's fallback instead, which is what says what the slot IS; the current file
still decides the focal and crop controls, which are about what is showing.

### Verified
Typecheck, lint and the 700-test unit suite clean; production build against a local Postgres. A
Playwright pass at 1440×900, with three video rows seeded into the local library and removed
after: beside the product's Video URL, *Choose video* opens the dialog reading "Pick a video
already in the library" with the one film in it, a pick writes `/media/v3/process-pour.mp4` into
the input, closes the dialog and sets the footer to "Unsaved changes"; the portfolio's field does
the same and its local draft bar reports the unsaved edit. On the board, the **Hero video** card's
*From library* lists the film, and the **Hero poster** card beside it still reads "Pick an image"
and lists pictures. No page errors.

A second pass for the four reach fixes, with a film row carrying a poster seeded into the "site"
folder: on a new testimonial, *Choose video* writes the film's URL and its poster into the two
fields; with the poster then changed by hand, a second pick leaves it alone. On the demo lander's
video-and-words block, a pick with the poster filled keeps it, and a pick after clearing the poster
fills it from the film — the editor was opened and closed, the row not saved, and the database row
read back unchanged. On settings, *Choose video* beside the hero video lists the one film and the
three *From library* buttons beside the logo, favicon and app icon read "Pick an image"; the SEO
sharing image's does the same; on the board, Hero video lists the film and Hero poster pictures.

A third pass for the defects the reconciliation below found, against the rebuilt server: on the
demo product, one edit shows "Unsaved changes", Save clears it, and a click on the sidebar's
Products link then navigates without the unsaved-changes dialog; the status Select lists Draft,
Review, Published, Archived; switching the category to a print category with the tier left at 1
mounts one `#product-video` and one `#product-model3d`, not two. On the demo post, text typed into
the rich-text body is in the local draft within two seconds, is gone after a reload, and is back in
the editor after Restore; Discard clears the draft. On a new portfolio case, an edit shows
"Unsaved changes" and reverting it clears the indicator. No page errors in any pass.

### The rest of Phase 11, read against HEAD
Two lines the roadmap still carried as open were shipped by the content series on 2026-09-04 and
are struck with evidence: the picker's video mode (above), and the whole D15 block line — all ten
named blocks are in `CUSTOM_BLOCK_TYPES` (`custom-blocks.ts:295-304`) with an editor branch, a
renderer and `media-usages.ts:296-325` walking the film, the poster and every gallery frame, the
catalogue closed at sixteen by `custom-blocks.test.ts:53`. Five comments still described the
catalogue as six types and the walker's docstring still said "block pictures"; they now say
sixteen, and films, posters and gallery frames.

The remaining two lines were then read the same way — five readers over the local-draft hook,
the footers, the D7/D14/D16 gates and every react-hook-form editor's error wiring, each finding
carrying file:line evidence and re-checked here before anything changed. **What the reading found
done:** the autosave line, on exactly the three forms it was scoped to (`useLocalDraft` on the
product, journal and portfolio forms, never the database); D7's Category `seoTitle`,
`seoDescription` and `visible` (migration `20260904104000`, the editor controls, every public reader
and the category page's `noindex`/404 on a hidden shelf); D16's `/studio/process` and
`/studio/materials` as the sections board pre-filtered; and D14 everywhere but one place. The
roadmap's lines 204 and 207 are struck with that evidence, and its gates line says the four gates
were answered on 2026-09-04.

**What the reading found broken, and this batch fixes.** The one D14 hole: the product editor's
status Select offered Draft and Published only, so a product moved to Review or Archived from the
list's bulk bar opened with a Select whose value matched no option — it lists the four now, in the
order the journal's does. Two defects in the batch before this one and the local-draft work it sits
on: the unsaved-changes indicator, and the navigation guard behind it, stayed armed after a
successful save in edit mode, because `isDirty` compares against the values the form MOUNTED with
and nothing reset that baseline (the create path escaped only because `router.push` remounts the
form); the three forms now `reset(values)` after a successful save, before autosave is re-enabled,
so the reset cannot be mistaken for an edit and written back as a draft. And Restore on the
journal form repopulated every input except the one that matters most — the rich-text body, whose
editor reads its value once on mount and says so in its own header; the hook now counts restores
and the form keys the body editor and the translations section on that count, so Restore remounts
them with the restored text. The portfolio footer, the third form on the same footer pattern, had
no indicator at all and has the same always-mounted live region now. Four smaller findings from the
error-wiring reader: a print-group product filed without tier 4 mounted the video and 3D-model
fields twice — once in the Images tab, once in the print section, two inputs with one id and a
label pointing at the wrong one — because the Images tab gated on the tier alone; it now uses the
same `useIsPrintProduct` predicate the print section does. The journal's author name and the
product's 3D-model URL were claimed by no tab, so a refusal on either switched to no tab and dotted
none; the portfolio's location and year set `aria-invalid` but never pointed at their message; the
landing page's title did neither. All four are wired.

A sixth reader walked the audit's Phase 11 rows and §12.5 itself, and its cheapest ungated finds
are in this batch too. The roadmap strikes "guard on dialog CRUD" as done, and the hook's own header
named the journal taxonomy among the dialogs it covered — but three typed-into dialogs still closed
on a stray Escape: the per-language names on a journal category or tag, the scraper's Add sources
(which kept the exact "only while busy" pair the hook was written to replace) and the media
library's bulk description. All three carry `useDismissGuard` now, and the header lists them. The
landing-page editor offered two of D14's four states, the same hole as the product editor; it
offers the four, and the list names a page in review or archived instead of calling both "Draft"
(`scheduleState` gains the two states, with a test). REDESIGN.md §12.5 asks for "a typed
confirmation for anything bulk" and the confirm dialog armed the DELETE box only above ten rows,
so a nine-row delete was one click; it arms at two, and a single row stays one click because that
is not bulk. The activity log stores each writer's previous state (up to 8 KB, audit row 71) and
showed it as an 80-character truncation with no way to read the rest; a cut record now opens into
the full, pretty-printed JSON in place. And the standalone Site Images board had no way to its
publish history — only the composer's header button reached it — so each group's header carries
the same History button for the same surface key, beside rather than inside the publish bar, which
renders nothing when nothing is staged. The process board's docstring claimed "revision history
comes free from the board it shares"; the sections action writes no revision, so it says so now.
The browser pass over the guarded bulk-description dialog then caught one more: the bulk bar
clears the selection on Escape (Part 17 — a persistent toolbar over a table is a layer), and its
window-level listener fired for an Escape pressed INSIDE a dialog the bar had opened, so closing the
Move or Description dialog with the keyboard — or having the guard refuse it — also dropped the
rows behind it. The bar now ignores an Escape another layer has already answered (Radix marks
the keydown it dismisses with; the guard marks the one it refuses) or that came from inside a
dialog. One hygiene find on the way: the dismiss guard's source held a raw NUL byte — the
separator it joins field values on — so git treated the file as binary and had hidden every diff
of it from review since it landed; the separator is the same character written as an escape.

### The reading, read adversarially
Every finding above was then handed to refuters told to break it against HEAD. Fifty verdicts: every
struck roadmap line survived, and the refutations that landed were of the readers' pre-fix claims,
each correcting to done. Four verdicts found what the readers had missed, and those are fixed here
too, each reproduced before and after. The product form's tab map, which this batch had just made
consistent, was consistent for the wrong product: a print product carries its video and 3D-model
URLs in the General tab's 3D-printing section, and the map filed them under Images, so a bad URL
switched to a tab without the field and focused an input inside a hidden panel — the stranding the
map exists to prevent. `tabForField` takes the print predicate now. The testimonial form's headline
rule — no publish without permission GRANTED — ran only inside the action, which throws, and
`runAction` turns every throw but "Unauthorized" into "Something went wrong"; two docstrings said
the message came straight back, and neither was true. The form runs the same rule before the action
and lands the reason on the Permission control, the way the sections and block boards run theirs.
The legal-page form had the same stale-baseline defect as the three editors fixed above, with no
create path to hide it. And three public readers nobody had grepped — the social-image routes for a
product, a post and a case — selected by slug alone, so a draft's title would render at a guessable
URL; they select PUBLISHED and spread the demo clause like every other public reader. Verifying
that in the browser found the larger fact: those three routes are unreachable at any URL today —
they live under `[locale]`, the proxy exempts `opengraph-image` from its locale rewrite and
redirects the prefixed form back to the bare one, so both paths 404 — and every page's `og:image`
points at its cover or slot picture instead. They are dead routes; whether to wire or delete them is
recorded as a decision. Two more from the
same pass: the product page reached its category through the relation without `visible` and linked
a hidden shelf from the breadcrumb, the BreadcrumbList and the related band's button, three links
to a 404 — a hidden category is treated as unset now, the rule the journal already applied; and the
Studio audit swept the composer with no `?tab=`, so its Pictures and Order panels rendered hidden
and axe never saw them — the route list carries both tabs. What the pass found and left open is on
the roadmap: the react-hook-form editors mirror none of their actions' length caps, so an over-long
value comes back as a raw zod message in a toast with no field named; the category's SEO pair is not
per-locale; the composer's surface↔page join has no test; and two decisions: the list's bulk
status writer does not stamp `ownerTouched`, so the deploy-time sheet fill can re-publish an
archived row; and the product's and portfolio's video URL validators — form and action alike —
accept only absolute URLs, while the library the new picker reads can hold site-root paths (local
storage, the demo set), so such a pick is refused at Save with "Enter a valid URL." where the
testimonial's validator already accepts a leading slash. Production Blob URLs pass; widening the
pair is additive on both sides but the action half is a Server Action input change. The same pass
then measured two holes in the navigation guard the roadmap struck as done: the command palette
navigates with `router.push`, past the guard's click listener, and left a dirty form with no
question — it hands the destination to the guard's dialog now — and Browser Back was never covered
despite the hook's `popstate` handler, because Next's own listener unmounts the form first; the
dead handler is removed, the hook's header says so, and Back is open on the roadmap.

**What stays open, recorded on the roadmap with its size:** the local-draft hook on the five
remaining react-hook-form forms (testimonial, landing page, legal page, settings, SEO — S each) and
a value-shaped variant of it for the three `useState` dialogs; REDESIGN.md §12.5's footer verbs,
Discard · Save draft · Publish, on the product and journal editors (client-only, designed against
four states); the demo lander fixture, which carries none of six of the ten new blocks, so CI's
sweeps never render them; a by-id reader for the testimonial block, which scans a 500-row pool; §12.5's sortable
product columns, which re-order the 50 rows on screen rather than the catalogue (M); and §12.5's
portfolio thumbnail grid, which exists only as the phone fallback under a table (M). **What
stays a decision:** revisioning section arrangements (`publishSections` writes no
`ContentRevision`, and giving it one is a Server Action change), the per-row draft column (no `draft` column exists on Product, BlogPost or
Portfolio, and a database-backed Save draft needs one, additively, per entity), `BlogPost.publishedAt`
as a visibility gate (a future-dated post is live today, and hiding it changes what visitors see),
and a picker beside the 3D-model field, which needs `listMediaForPicker`'s IMAGE/VIDEO enum widened
— an additive Server Action input change, so a decision rather than a batch.

## Transformation Phase 11 — the editor gets its second column (2026-09-06, fifth batch)

REDESIGN.md §12.5 describes the product editor as "two columns — information left, live preview
right" and the journal editor as "editor left, preview right". Both had the tabs, the sticky
footer and — since 2026-09-03 — the device-frame draft preview, but the preview lived behind a
**Preview** button in the footer: a dialog, opened on purpose, closed to keep editing. The
roadmap's remaining product-form line was "two columns with the draft preview", and this batch
is that line: the preview becomes a docked column beside the form on both editors.

### The split is a container query, not a breakpoint
`EditorSplit` lays the form and an `aside` out as two columns when its own CONTAINER is 64rem
(`@5xl`) or wider. The Studio's content area is the viewport minus a sidebar that is 256px, or
80px once the owner collapses it to the rail, so a 1280px laptop has 960px of room with the panel
open and 1136px with the rail. A viewport breakpoint would have had to pick one of those and be
wrong for the other; measuring the container is right for both, and the same editor docks the
preview at 1440 with the panel, undocks it at 1280 with the panel, and docks it again at 1280 with
the rail. This is the repo's first container query — Tailwind v4 carries them in core, named here
(`@container/editor`) so a section that later declares a container of its own cannot capture the
variant. Below the threshold the aside is `display: none`, the footer's Preview button stays, and
the dialog carries on exactly as before; above it the button hides, so there is one preview
affordance at a time.

### What the column shows, and what it says about itself
`DraftPreviewPanel` is the phone width (390), 1:1 — the 2026-09-03 rule that a scaled preview
hides the crowding it exists to reveal still holds, which is also why the column cannot hold the
tablet and desktop widths: those two buttons open the existing dialog at 768 and 1280 instead.
The frame is keyed on the editor's count of successful saves, so **every save reloads the
draft**, plus a reload button for the case where the page changed under it. The note under the
heading is the honest sentence a draft preview can say: it shows the last save, and unsaved
edits are not in it yet. The spec's word "live" is read as "the current draft, without a round
trip" — a frame that rendered the storefront from the form's unsaved values would be a second
renderer of the product page to keep true, and is not this item.

### Hidden is not gone — and lazy did not help
The aside is rendered at every width so the layout is right at first paint — no measuring step,
no one-column flash — which means a phone editing a product would also fetch the whole product
page into a frame it cannot see. The first cut put `loading="lazy"` on the frame and assumed a
frame that never intersects never fetches. **Measured, it does**: at 1280 with the sidebar open
and at 390, Playwright found the product page loaded inside the hidden aside. Chromium treats a
hidden frame as a communication channel — the tracking-pixel shape — and loads it eagerly on
purpose. So the frame now mounts only while its column actually has layout: `useIsDisplayed`
reads `offsetParent` through `useSyncExternalStore` with a `ResizeObserver` (the shape the repo
prefers to a state-setting effect), and the re-run shows zero product frames at 1280 and 390 and
the draft fetched fresh the moment the column appears.

### The footer's unsaved-changes indicator
§12.5 names one. Both editors' sticky footers now carry it, as an always-mounted `role="status"`
region that reads "Unsaved changes" while the form is dirty and empties on save — mounted always
rather than appearing, because a live region that arrives with its text is the one screen readers
do not read.

### Verified
Typecheck, lint, the 700-test unit suite and `copy:check` clean; production build against a local
Postgres; the Studio audit clean over both edit routes at 1440 and 390. A Playwright probe drove
the product and journal editors in both colour schemes and read the layout back:

- **1440, sidebar open** (content 1174 wide): the aside is `block` and `sticky`, 416 wide, the
  frame 390 wide with the product page's own `h1` inside it, the footer's Preview button hidden.
  Typing sets the footer's status to "Unsaved changes" and the column's note to "Unsaved edits
  are not here yet"; reverting clears both. Save remounts the frame (a marker set on the old
  element is gone) and the reloaded page carries the title. Tablet opens the dialog at 768;
  Escape closes it. Scrolled 900px, the aside sits at `top: 80` with its bottom at 876 in a
  900px viewport — it was 908 before the height correction.
- **1280, sidebar open** (content 1014): the aside is `display: none`, the Preview button shows,
  and there are zero product frames in the page and zero `iframe` elements in the aside.
  Collapsing the sidebar in place docks the column at 822 and the frame mounts and loads the
  page; expanding it again removes the frame.
- **1280, rail** (content 1190) and **390**: docked with the page loaded, and single-column with
  no frame, respectively. No horizontal overflow at any width; no page errors in either scheme.
- **Journal, 1440**: the same column, framing `/blog/demo-post-030` with the post's `h1`.

## Transformation Phase 11 — the hand-rolled forms learn to point at the field (2026-09-05, fourth batch)

Phase 11's last ungated bullet: "`FieldError` everywhere, helper text." The Studio forms built on
react-hook-form already named the field a refused save was about. Five built on `useState` did
not — the scraper's add-sources dialog, the navigation board, the scraper review editor, the
site-copy board and the research form. On those, every refusal travelled to the Server Action
and came back through `runAction` as one toast: **"Something went wrong. Please try again."**
That wrapper hides raw errors on purpose, and it hides zod's wording with them, so a blank title,
a 61-character menu label, a deleted `{count}` and a 5,000-character description all failed
with the same sentence and no field named. The `ActionResult` shape has no per-field
channel, and adding one is not this batch's business; the fix is the one the react-hook-form
screens already use — judge the field in the browser, with the same rule the action holds.

### Two primitives
`FieldHint` is the muted counterpart to `FieldError` (`role="alert"`, destructive): the sentence
that explains a field BEFORE anything goes wrong, with an id so the control can point at it.
`describedBy()` composes `aria-describedby` from whichever of hint and error currently exist,
yielding `undefined` rather than an empty attribute when neither does. Every converted control
now carries `aria-invalid` while refused and `aria-describedby` naming its hint and its error, so
a screen reader hears the hint on focus and the error once there is one.

### One rule, held once
Two boards already shared a pure validator with their action — `describeHrefProblem` for the
navigation board, and `describeCopyProblem`, which the site-copy action ran but the board never
did. The label rule (1–60 characters) lived only in the action's zod schema, so it now lives in
`lib/nav-menus.ts` as `describeLabelProblem` beside the href rule, the action's `labelSchema`
reads it through `superRefine` exactly as `hrefSchema` reads the href one, and a unit test pins
the two messages and the 60-character cap. Where no shared validator exists (research, sources,
review), the client mirrors the action's limits and says so in a comment naming the schema.

### Per form
- **Site copy** — `describeCopyProblem` runs on every keystroke under the field: delete the
  `{count}` a string needs and the sentence the server composes ("This text uses {count} to fill
  in a live value…") appears where the deletion happened, Save disables, the "Keep {count} in
  your wording" hint is now linked to the field rather than orphaned above it.
- **Navigation** — both rows: the destination error moves from a hand-rolled alert paragraph to
  `FieldError`; the label gains the 60-character check (and "Give the link some words" on a new
  link); the per-row editor still allows a blank label, because blank is the act that restores
  the catalogue wording. The two hint paragraphs are linked.
- **Research** — thirteen fields, one former toast ("Source and title are required."). Now each
  limit in `upsertSchema` is named under its field, the link must be an `https://` address, up
  to 20 image links and 20 tags of 60 characters, and a refused submit focuses the first errored
  field. The form is `noValidate`, so the browser's own tooltip no longer pre-empts the message.
- **Add sources** — the two toasts (no URLs / more than 25) become the textarea's error, the live
  URL count becomes its linked hint, vertical and country gain their 60/20 caps.
- **Review editor** — title 1–300, tagline ≤ 500, category ≤ 200, prices whole non-negative
  rupees with the min/max fields told apart (the old toast said "Prices must be numbers" for
  either), plus one rule the action does not hold and a listing cannot sensibly break: the
  maximum may not sit below the minimum. Reviewer notes get an id and a linked hint. The Save
  button no longer goes dead on an empty title; it says why.
- Two normalisations the map turned up: the invite dialog's email hint is linked, and the
  testimonial form's link-picker error was a bare `text-alert` paragraph with no alert role.

### The research page did not load, and nothing said so
Driving the research form in a browser found the page behind it rendering the dashboard's
"This page didn't load" boundary — and the sweep record from before this batch shows it already
did. `RESEARCH_STATUSES`, a constant, was exported from `src/actions/research.ts`, a
`"use server"` module, and the client form imported it; Next hands a client a server-reference
PROXY for anything it imports from such a module, so `RESEARCH_STATUSES.map` threw "map is not
a function" during render. Typecheck, lint, the build and the 36-route Studio audit all passed
it, because the audit reads the accessibility tree rather than whether the screen is the one
intended — the same blind spot the per-page composer hit two days ago. The vocabulary now lives
in `src/lib/research.ts`, the action imports it like everyone else, and
`server-action-exports.test.ts` fails the suite on the next value export from any action file
(it was the only one).

### Phase 12, reconciled
The roadmap still listed the media system as open. The content series shipped it on 2026-09-04:
cursor pagination, sort, date/size/orientation filters, the detail drawer with usages and
replace-file, drag-and-drop upload, move-to-folder, bulk alt edit, the grid/list toggle, the
`tags`/`caption`/`favourite`/`duration` columns (`20260904105000`), blur wiring through
`SiteImageRef`, and `Media` rows for the catalogue mirror. The roadmap now says so, with the
evidence, so the next reader does not build it twice. What remains there is the owner's machine
(the generation plan) and D24.

---

## Transformation Phase 10 — every Studio dropdown was invisible in dark mode (2026-09-05, seventh batch)

The owner opened the category filter on `/studio/products` with the OS in dark mode and got a
cream panel with nothing in it — one highlighted row in a grey that could barely be read, and
twenty-four rows of nothing. Reproduced locally to the pixel, and it was not that screen: it was
**every** Select, every menu and the command palette, on every Studio route.

### Root cause — a background routed through the dark scheme's text colour
The shadcn semantic layer in `globals.css` maps card to the scope's own names — `--surface`/
`--text`. Popover went to the PALETTE names instead: `--color-popover: var(--mineral)`,
`--color-popover-foreground: var(--ink)`. Other pairs also read palette names (secondary, muted
and accent sit on `--sand`; the primary and destructive foregrounds on `--mineral`), and those
survive the dark block because sand and ink flip there, or because mineral sits on a sapphire
fill — popover was the one BACKGROUND routed through `--mineral`, the token that cannot flip.
Under the Studio's dark block that is fatal twice over: `--ink` flips to `#f4f1e9` (it is now light text), and
`--mineral` **cannot** flip, because it is that scheme's `--text` — a dark mineral would be dark
body text on obsidian. So both sides of the pair resolved to `#f4f1e9`. Cream on cream, measured
at **1.00:1**. The highlighted row was `--color-accent-foreground: var(--sapphire)` — a text role
on the raw fill token, `#164e6b` on the flipped sand `#0f3247`: **1.49:1**. The tick and the
radio dot were `text-sapphire`: the same 1.49.

`.studio-v2` sits on `<html>`, so the Radix portals were never the problem; the tokens were.

### The fix — the same pattern as card, nothing new
- `--color-popover` → `var(--surface)`, `--color-popover-foreground` → `var(--text)`.
- `--color-accent-foreground` → `var(--sapphire-ink)`: the AA companion that exists precisely
  because a fill role cannot carry text. Identical to sapphire on the light ground; lifts to
  `#5fafd6` in the dark scheme. The ghost button's hover state rides on the same token and was
  equally unreadable in dark.
- The Check and Circle indicators in `ui/select.tsx` and `ui/dropdown-menu.tsx`, and the command
  palette's selected item (`text-primary` — the fill token again), → `text-sapphire-ink`.

A side effect worth naming: in the **light** scheme the Studio's popovers move from mineral to
the Studio's white `--surface`, which is what its cards and dialogs already are. They used to be
a mineral panel on a mineral page, told apart by shadow alone.

### Measured, not assumed
Chromium with `prefers-color-scheme` emulated, computed styles read off the open panel:

| | dark before | dark after | light before | light after |
|---|---|---|---|---|
| panel text on panel | 1.00 | 13.53 | 16.31 | 18.41 |
| highlighted row text | 1.49 | 5.48 | 6.86 | 6.86 |
| tick / radio indicator | 1.49 | 5.48 | 6.86 | 6.86 |
| command palette, selected item, on its 10 % sapphire tint | 1.62 | 5.95 | 7.62 | 7.62 |

Then a sweep, because "every dropdown" is a claim about the whole Studio — run against the
branch rebased onto `main` as of #49, so it counts the seven routes and the block types that series
added: 46 routes (every dashboard page plus one record each of product, journal post, page,
portfolio piece and scrape source), each form tab clicked in turn, every trigger opened, in both
schemes. **167 surfaces per scheme** — 95 menus (the notifications menu now sits on every route),
41 Selects, 30 native `<select>`s, the palette — plus 47 more behind interactions the sweep cannot
reach from a page load: the invite-user dialog, the testimonial form's three pickers, the
commission board's per-card status select and the inquiry detail's status picker (on a fixture
inquiry), and the block editor's five select-bearing block types (on a fixture page). **Nothing
below 4.5:1 for text or 3:1 for an icon in either scheme**; the lowest readings are the
highlighted row at 5.48 in dark and a muted menu icon at 4.83 in light. Native selects score
13.53/18.41 on the control itself; their popup is drawn by the browser under
`color-scheme: light dark`, so it follows the OS.

### The storefront is byte-identical
Its only Select — the product order panel — overrides the panel with `bg-mineral text-ink` and
its items with `focus:bg-sand focus:text-sapphire`, so the popover pair never reached it; and
`--sapphire-ink` is `var(--sapphire)` at `:root`, so accent-foreground, the ghost hover and the
indicators resolve to the same bytes outside the Studio. Read off the CSS chain rather than
measured: no seeded product renders that Select (it needs a `SELECT`-type customization field),
and a fixture field did not surface on the page either — that gate was not worth chasing for a
proof the cascade already gives.

### Same class, not a dropdown — swept up in the follow-up commit
The adversarial review of this change found the accounting above incomplete: `ui/button.tsx`'s
`link` variant was raw `text-sapphire`, and three Studio list screens (journal, portfolio, pages)
render their Edit links with it inside a deep-ocean row — 1.70:1 in dark. That, and the three
`text-primary` links on `/studio/inquiries/[id]`, take the identical one-token swap to
`sapphire-ink` (byte-identical on the storefront, whose buttons come from `storefront/button`):
measured on the rebuilt Studio, both sites read 6.25:1 on deep-ocean in dark and an unchanged
8.99:1 on white in light.
The `sapphire-ink` token now also appears in `docs/redesign-contract.md` and CLAUDE.md, which
had listed two AA companions while the repo relied on three.

Recorded and NOT fixed, because each is a design decision rather than a token swap:
`variant="destructive"` paints `text-white` on the lifted `--alert` fill, which is 2.39:1 in
the dark scheme across its 19 Studio consumers (a fill needs its own dark value, not the text
ink); `--field-border` (`#8a8f96`) reaches only 2.88:1 as a Select trigger's boundary on the
mineral page ground in light, against the 3:1 non-text floor its own comment claims (3.26:1 on
a white card); and `ui/dropdown-menu.tsx` still uses physical `left-`/`pl-`/`pr-`/`ml-` classes
where the sibling `ui/select.tsx` moved to logical ones. Two corrections to the fix commit's own
message, which cannot be rewritten once pushed: its fourth bullet describes a root-layout note
that #49 had already rewritten, so the rebase carried nothing of it (the wording is adjusted in
the follow-up instead); and its "6.25" for the palette's selected item was measured against the
untinted card — on the item's actual 10 % sapphire tint the figures are 1.62 → 5.95 in dark and
7.62 in light, still clear of 4.5:1 and still above the sweep's true minima.
## Content · the homepage, About, the Studio auth screens, and six registry lies (2026-09-05)

Owner ask: *"change full home page and about page content, section selection and images and
videos, and also add relevant images and content to every needed page, also change and improve
the studio login page design."* What follows is what could be done from here; the imagery half
of the ask is reported honestly at the end.

### The homepage

- **A workshops band, between the commission band and the print studio.** `/workshops` is a
  live page with a hero, a session grid and a private-booking band, and NOTHING on the homepage
  pointed at it — the only routes in were the drawer's second group and the footer. The new
  band is the third way to engage: commission one, pour one, print one. Its fact row reads
  `Workshops.facts.*` rather than restating the duration, the seat count and the city in a
  second place. Sand ground, so the page keeps alternating (§09 above is dark, §10 below is
  mineral); light, so the three-dark ceiling is untouched.
- **The hero headline is now "Cast for the room it will live in."** in all nine locales.
  REDESIGN.md §01 prescribed `Liquid luxury, cast forever.` verbatim, so the change is recorded
  as a divergence in Part 6 rather than left to be discovered — along with two others nobody had
  written down: the page is seventeen sections against Part 6's thirteen, and §01 is spec'd
  `major` while carrying no `section-major` class, which is why the audit's major count reads
  one and why that count is a measurement artifact rather than headroom for a third climax band.
- **The cure rail no longer lies on a fresh database.** Four homepage sections are
  `conditional` — pieces, work, words, journal — and their nodes evaluate to `null` with no
  products, no portfolio, no testimonials and no posts. The rail was built from `visible`
  alone, so it rendered four labelled ticks pointing at DOM ids that do not exist; `CureLine`
  falls back to even division when `getElementById` misses, so it did not break, it described
  a different page. It is now built from the section list AND the built nodes.
  `/large-resin-art` got the same treatment, replacing a hand-written list of four clauses that
  had already drifted (it suppressed the `gallery` tick, and `gallery` renders an invitation
  band rather than nothing). `/custom-order`'s rail was a literal six-entry array that ignored
  visibility and order entirely and had no tick for the testimonial band at all; it is now
  generated the same way, which is what the seven new `cureLabelKey` values and
  `CustomOrder.page.cure.words` are for.
- **The "Commission a piece" collection tile has a picture.** Five of the six tiles paint the
  owner's `Category.image`; the sixth points at /custom-order, which is not a category, so it
  fell to CollectionCard's flat deep-ocean monogram — in the lead position of the page's most
  prominent band. It now has its own slot, so the one tile the category editor cannot reach is
  still the owner's to change.
- **The gift and print collection seeds point at v3 masters.** `tile-gift.avif` and
  `tile-print.avif` were generated by §15.4 *for* the homepage collection band and never
  reached it, because that band paints `Category.image` and those two seed defaults still held
  superseded v6 artwork. Fresh environments now seed the right picture. Existing rows are
  untouched by design — `seed-category-images.ts` only fills an empty image, and an owner's
  choice outranks a seed — so on the live database this is a change the owner makes in the
  category editor.

### About

- **Surat, varmala and pooja are named.** The page described "a made-to-order resin art studio
  in India" and "one room in India" while three other surfaces name the city, and it never
  mentioned the wedding-garland preservation or festive work that are live catalogue categories
  and the studio's actual proposition. All nine locales.
- **`About.cta.body` said "forever" twice in twenty-one words.** Rewritten, nine locales.
- **Opening hours reach the visitor.** `SiteSettings.businessHours` is owner-editable, has a
  parser, and was feeding the LocalBusiness JSON-LD — so it reached Google and not the person
  standing outside the door. The studio band prints it verbatim beside the address, and prints
  nothing when it is unset. The code comment claiming "opening hours have no field in the data
  model" was false and is gone.
- **Alt text that described a different photograph.** `/media/v3/story-pour.avif` is a deep
  sapphire pour; `Process.materials.alt1` called it "clear epoxy resin". Fixed in nine locales,
  along with the two American "mold"s in `About.chapters.alt1`/`alt3` and the vaguer
  `Home.custom.imageAlt`, each rewritten against the master's own generation prompt.
- **The studio photo slots declared 4:3 and are rendered at 4:5.** `StudioGallery` has always
  cropped them to `aspect-[4/5]`, and the Site Images board prints the declared ratio straight
  to the owner as "the ratio the layout crops to" — so an owner who supplied a correct 4:3
  photograph lost a third of it and had been told the file was right.

### Six registry rows that named things that do not exist

Two new tests in `page-sections.test.ts` — every `copyPrefixes` entry must own at least one
real copy slot, every `imageKeys` entry must be a real slot — and they went red immediately:

| Row | Named | Should have named |
|---|---|---|
| workshops · why | `Workshops.why` | `Workshops.intro` |
| workshops · session | `Workshops.session` | `Workshops.experience` |
| custom-order · brief | `CustomOrder.page.brief` | `CustomOrder.page.form` |
| custom-order · questions | `CustomOrder.page.faq` | `Faq.hero` |
| custom-order · work | `CustomOrder.page.work` | `CustomOrder.page.seeCommissions` |
| custom-order · words | `CustomOrder.page.testimonials` | `CustomOrder.page.proof` |
| process · pour | image `process.hero` | `process.heroVideo` + `process.heroPoster` |
| contact · ×4 | `Contact.hero` and friends | `Contact.page.hero` and friends |

Plus the About `story` and `craft` rows, which had each other's copy prefixes and image keys:
`story` claimed four photographs it does not render, `craft` claimed none of the four it does.
None of this threw, because both fields have one consumer each — the "N copy groups · N
pictures" counts on the sections board. That board is where an owner decides which row to open,
so a wrong count is not cosmetic. Both guards were failure-tested in both directions.

### The Studio auth screens

- **A `<main>` landmark.** All four screens were `<div>`s the whole way down, so a screen-reader
  user had no landmark to jump to and axe's `landmark-one-main` would have fired on every one —
  had anything audited them. Nothing does: `studio-audit.mjs` signs in THROUGH /studio/login
  without auditing it, and the a11y sweep covers the storefront only.
- **The backdrop goes through `SlotImage`.** It used to resolve a bare URL, discarding the focal
  point, the phone crop and the LQIP the Site Images board actively offers for that slot. On the
  28svh mobile band the missing phone crop is the visible one.
- Three hairline-separated zones, a champagne seam at the split, a monotonic scrim (it used to
  ramp 85 → 25 → 40 and press a grey band across the middle of the photograph), and the subtitle
  measure moved off an invented `max-w-[34ch]` onto `u-lede`.
- The Studio root layout's comment claimed the `.studio-v2` scope "ships light-only"; the scope
  has carried a live `prefers-color-scheme: dark` block for some time, and every colour
  judgement made off that comment was made in the wrong palette.

### Two queued images withdrawn

`varmala-before-after` restated the manifest's own `excluded[0]` — §15.2 forbids a generated
picture standing in for a customer's own flowers, and a different aspect ratio does not change
the claim the picture makes. `varmala-floret-macro` had nowhere to land: the only 1:1 slots are
the four §15.3 material macros, generated as one batch on identical ground and light. Three more
placements in that set claimed to free or replace a file they do not touch, and now say what
they actually do. 57 → 55.

### What could NOT be done here, and why

- **No new photograph or loop can reach the site from this environment.** The Higgsfield CDN
  answers 403 to the agent proxy's egress policy — an organization policy denial, not something
  to route around — so all 55 queued renders stay `status: "planned"` and the site's imagery is
  still the 25 masters already committed. Every image change above is a re-point or a slot, not
  a new file.
- **The remaining 12 renders are blocked on credits**, and the account's "365 Unlimited" model
  subscriptions are not reachable through the MCP API (see CLAUDE.md).
- **Nobody has looked at the 43 generated stills or the 3 loops.** They are recorded URLs, not
  reviewed pictures.
- **The FAQ corpus is still six questions**, feeding three pages unfiltered. The seed file is
  not a deploy path — `bootstrap.ts` runs it only on an empty database — so the vehicle is
  /studio/faqs, which is the owner's screen and already carries a per-locale translation field
  per row.
- **No per-beat copy was written for the /workshops session strip.** Describing how an
  afternoon at the bench actually runs means stating operational detail about a real service —
  Part 0 says the studio's words are the owner's, and five invented sentences in nine languages
  is not a gap this session should fill.
- **`SiteSettings.address` is still empty**, so /contact states no city and the LocalBusiness
  node carries only `addressCountry`. Owner data entry, no code change.

---

## Follow-up · SET F's loops re-generated at the width the manifest asks for (2026-09-04)

An audit of what the imagery pipeline actually holds, after the 28 plannedSets rows were
generated earlier today. Two things it confirmed and one it caught:

- **Nothing is missing.** All 76 site-image slots resolve to a file that exists on disk (25
  distinct files, 0 missing); the 24 built assets and the one built video are intact; all 28
  planned rows carry candidates.
- **The stills are comfortably over spec** — `nano_banana_pro` at 4k returns 3712x4608 and
  3072x5504, against §15.5's 2560 floor and a largest `targetWidth` of 2400.
- **The three SET F loops were NOT.** They took `seedance_2_5`'s defaults — 720p and audio ON —
  so they came back 1280x720 against a 1920 `targetWidth`, carrying an audio track for a
  surface `HeroMedia` plays muted and `aria-hidden`, against §15.3's 2.5 MB ceiling. Variant
  `a` of each is now a 1080p (1920x1080, the model's ceiling and exactly the entry's target),
  audio-free re-run; the 720p clip stays as variant `b` marked `offSpec`, which is the shape
  `videos[0].candidates[a]` already uses to keep its own too-short first take as a cull
  reference.

Also inspected and deliberately NOT adopted: six older loops sit in the Higgsfield account from
2026-08-28 (`cinematic_studio_3_0`, 1344x768) — a pigment-dispersion macro, a light bar over
polished resin, a live-edge tracking shot, a hands-only sanding clip and two 9:16 mobile
backgrounds. They are written in the superseded v2/v7 vocabulary ("quiet luxury", "mineral
neutrals") rather than §15.3's palette suffix, and 1344px is under every SET F target, so
adopting them would put a different design system's imagery behind v3 pages.

---

## Follow-up · the Lighthouse PDP gate, and 28 planned images generated (2026-09-04)

**The PDP joins the Lighthouse gate.** The budget was waiting on one measurement that had
never actually been taken: every local run reported `0` on every page, and that was recorded
as a sandbox limitation. It was not. `scripts/lighthouse-audit.mjs` reads `BASE_URL` in
preference to `LH_BASE`, a local env file exported `BASE_URL=…:3000`, and nothing was
listening there — so Lighthouse was measuring a dead port and returning null category scores,
which `?? 0` rendered as a catastrophic-looking zero. Aimed at the running server the same
build scores **home 98/97, PLP 98/100, PDP 99/100** (LCP 1.0–1.2s, CLS 0, TBT ≤10ms). The
PDP clears 85/95 comfortably, so `demo-product-001` is now passed to the CI step, which could
only ever measure it because the demo set is seeded earlier in that job.

Two things were fixed so the same hour is never spent twice:

- A category with a **null score is now a thrown error naming the URL** and Lighthouse's own
  `runtimeError`, not a zero. A gate must say "I could not measure this" rather than invent a
  number for it. Failure-tested against a dead port: it exits 1 with
  `CHROME_INTERSTITIAL_ERROR` instead of reporting a budget miss.
- The CI step's comment claimed performance, a11y, SEO **and** best-practices were all
  enforced. Only perf and a11y are (`budgetFail` filters on those two). That distinction is
  load-bearing now the PDP is measured: the demo product is deliberately `noindex`, so
  `is-crawlable` puts its SEO at 69 while perf/a11y are 99/100 — gating SEO would fail the
  build for the demo gate working correctly.

**All 28 `plannedSets` entries are generated.** 56 renders through the Higgsfield MCP (two
variants each, same `model` and `promptSuffix` as the built `assets`; five jobs failed and were
re-run), and every result URL is recorded in the row's `candidates`. They stay
`status: "planned"` deliberately: `--promote` makes `bundled-media.test.ts` demand the master
ON DISK and `media-v3-preflight.mjs` demand a culled `keeper`, and the master cannot be built
here — the CDN answers 403 to the agent proxy, an organization policy denial to report rather
than route around. Downloading and building is what remains, on a machine with ordinary
internet.

That data change broke the queue's own reporting, which is fixed in the same commit:
`describePlanned` read `status` alone, so all 28 rows still said *"needs a generation run"* —
the one wrong instruction here that costs money to follow. There is now a fifth state,
`generated`, printing `needs a promote — 2 candidate URL(s) already recorded` with the exact
command. The manifest test that asserted "nothing has been generated in-session" said in its
own comment that a failure would be good news; it now asserts the true state instead.

---

## Follow-up · the header-contrast gate stops reporting its own cross-fade (2026-09-04)

CI run 149 failed `/contact` on the sticky-header contrast rule — `data-ink="ink"` measured at
1.08:1 over rgb(8,10,14) — and run 150 passed the SAME TREE minutes later (`git diff 8581218
124b2d8` is empty). The rule, not the header, was wrong.

`data-ink` is an attribute: it flips in the same commit as the state. The two layers it describes
do not — the obsidian scrim and the mineral bar cross-fade over `--dur-base`, and the logo's colour
transitions over `--dur-fast`. So immediately after the hero leaves the header's 80px band the
attribute and the pixels legitimately disagree. The audit's own route walk is what drags the hero
through that band, twice, and `use-hero-ink.ts` delivers its IntersectionObserver callback on a
later frame — so on a loaded runner the cross-fade can begin AFTER the walk's animation-settle loop
has already returned. The rule then read the attribute, waited up to eight seconds for images, and
screenshotted, reporting the two as one simultaneous measurement.

The rule now settles the header first (two identical readings with nothing animating inside it,
capped at 3s), takes the attribute, the promised colour and the sample geometry in ONE evaluate, and
re-reads afterwards; a reading that spans a state change is reported as a NOTE naming the flip
rather than failing the build. The image-decode caveat is unchanged. A genuinely mis-inked header is
a state, not a transition, so requiring stability cannot hide one — proved by raising the threshold
to 100 so every route violates it and confirming `/` and `/contact` still report FAIL, then forcing
a flip mid-measurement and confirming both downgrade to NOTE with 0 failing rules.

---

## Follow-up · the plan-completion audit and what it found (2026-09-04)

Sixteen read-only verifiers checked the merged `main` against every bullet of the approved plan
(508 items; 34 not marked done), then adversarial refuters voted on each. What the audit found,
and what this branch does about it:

**Behaviour that was wrong, now fixed**

- **A scoped scrape never reached its page.** `continueScrapeJob` ran the pasted CATEGORY/URL
  through `normalizeBaseUrl`, which reduces any URL to its origin — so a category job crawled the
  whole store. New `normalizePageUrl` keeps the path and query; the origin still gates robots.
  The Shopify adapter builds its CATEGORY endpoint from origin + collection path.
- **Two sheet writers ignored the owner's Sheet ID.** The ON_COMPLETE auto-push and the website
  mirror called the helpers with no settings, so only `SCRAPE_SHEET_ID` applied there.
  `readSheetSettings()` is now threaded into both.
- **A site-copy slot's FIRST edit went live immediately**, bypassing Publish: the create branch
  wrote the owner's words to `value` and `draftValue` alike. It now stages the draft against the
  shipped wording (`shippedCopy`), so a save is a draft for the first edit as much as the fortieth;
  Discard removes a row that was never published rather than leaving a "Changed" one equal to the
  default. Found by the new smoke check, not by review.
- **Demo landers were indexable and unmarked** when demo content shows. `/p/[slug]` now returns
  `noindex` for a fixture whatever the row's own flag says, and renders `<DemoMark/>`.
- **The design-lab isolation guard could not see a multi-line import** — the shape the lab's own
  sections file has. It reads whole files now, allows `src/components/design-lab/`, and asserts
  that folder is imported only from inside the lab.

**Promised work that was missing**

- **Four smoke checks the plan named**: a product's create → edit → delete through its form, a
  page-builder block save that the lander then renders, a site-copy draft → Publish → Reset round
  trip, and the scraper's refusal of an undetectable platform (an RFC 2606 `.invalid` host, so the
  one probe never leaves the machine). 36 checks, each Studio path guarded so one surprise fails
  its own check rather than the run. Rows they create are removed again.
- **The VIDEO media picker** in the three film fields written before batch D landed it (the
  testimonial form, the videoHero and videoStory block editors).
- **The hero poster's LQIP**: `HeroMedia` received a ref carrying `blurDataUrl` and ignored it.
- **Demo badge and `?demo=1`** on the testimonial and landing-page lists.
- **`ProductImage.role` on the card row**: fetched, then dropped before it reached the card type.
- **`kids-room-decor` and `workshops` had no demo products**: four fixture rows move there
  (a name plaque, wall hooks, a beginner session, a private day). Still 100 rows.
- **One lead-time key**: the furniture tiles quoted six per-locale copies of
  `Process.timelines.e2Value`; they read that key now and the 54 duplicates are gone.
- **The sheet status vocabulary** promised as "a code-side enum" is written once in
  `src/lib/sheet-status.ts` and used at every site.

**Documentation corrected**: the CSP header comment (it says UNCHANGED; `frame-src` was added at
the flip), the hero-parallax JSDoc (mounted since A2, not "zero importers"), AGENTS.md's smoke
count, CLAUDE.md's slot count and `registerEase` rationale, and three PROJECT_STATE checkpoint keys
that still described pre-wave-1 state.

**Left for the owner's machine**: the planned Higgsfield sets (the CDN refuses this sandbox; the
generate → `--promote` → cull → fetch sequence is now in the script itself, `--planned`), the real maker
photograph, `.env.example` (`.env*` edits are denied here), and a by-eye reduced-motion pass over
the A2/A3/C2 mounts.

---

## Follow-up · the E2E smoke meets a runner with real internet (2026-09-04)

- **CI runs #136 (the PR #42 head) and #137 (`main`) were red at the new "E2E smoke" step**, 25/27:
  on the runner the wa.me tab followed WhatsApp's 301 to `api.whatsapp.com/send/?phone=…&text=…`
  (spaces re-encoded as `+`), so "opens wa.me with the house number" and "carries the [DEMO] prefix
  and the chosen size" misread a URL this sandbox never sees — the proxy here answers wa.me with a
  403 and the tab stays where the panel sent it. No product code was wrong: the same run's Inquiry
  row, `/whatsapp-order` fallback, Studio, upload, sheet preview and testimonial checks all passed.
- **Fix (`scripts/e2e-smoke.mjs`)**: the order-flow context now routes `wa.me` and
  `api.whatsapp.com`, records the URL the panel requested and serves a stub, and asserts on the
  recorded link through two small parsers (`waHouseNumber`, `waMessage` — `URLSearchParams` turns
  `+` back into a space), so the check reads the same on a laptop, in the sandbox and on the runner,
  and CI never contacts WhatsApp. 27/27 against the `main` build here; the trap is recorded in
  `AGENTS.md`.

---

## Wave 3 · batch F2 — CI sweeps everything, the smoke grows, the audits bite, and four real defects fall out (2026-09-04)

The F2 agent was stopped after the container restarted under it (its shell never returned from a
`grep`); its in-progress audit flip and drift loop were committed from the worktree and the rest of
the batch was built by hand on the same branch, on top of the merged A4 and C2.

- **CI (`ci.yml`)**: after the build and the database tests (which seed and remove a demo set of
  their own), the job seeds the Content Lab fixtures through the guarded `scripts/seed-demo.ts`,
  starts the server with them in place, runs `npm run test:e2e` against it with the Studio audit's
  credentials, and sweeps `/product/demo-product-001`, `/shop/gift-collections`,
  `/blog/demo-post-001`, `/portfolio/demo-case-001` and `/p/demo-lander` (plus their `/ar` twins
  and `/ar/process`) through the design and a11y audits. The workflow header and the route
  comments describe the job as it is.
- **`scripts/e2e-smoke.mjs`: 10 → 27 checks**, the original ten untouched. New: the search overlay
  opens and `/search` finds the demo piece; a shop facet narrows the list and lands in the URL; the
  customization form on the demo PDP (size, swatch, engraving, finish, contact) submits through the
  spam gate to a `wa.me/917096036250` link carrying `[DEMO] ` and the chosen size, reaches the
  `/whatsapp-order` fallback, and — with `DATABASE_URL` — leaves an Inquiry row marked `isDemo`
  created by that click; `/ar` is right-to-left and `/hi` renders a Devanagari h1; with the Studio
  credentials: the login lands, the demo product opens in the editor, a `sharp`-rendered 64×64 PNG
  (fresh checksum every run — the library dedupes uploads) lands in the media library and is
  removed again, the sheet-fill Preview answers, and a testimonial is refused `PUBLISHED` until its
  permission is `GRANTED`, then publishes (the row is deleted afterwards). Studio and database
  checks skip, as skips, without their inputs. The eight `verify-*.mjs` / `screenshot-lab.mjs`
  scripts are deleted; the order path they carried lives here now.
- **`scripts/redesign-audit.mjs`**: at widths of 700px and below the browser context is
  touch-capable, so `pointer-coarse:` utilities apply and the **44px tap floor FAILS** there (it is
  reported, not failed, on fine-pointer widths; `isMobile` is deliberately not set — mobile
  emulation widens `innerWidth` by a phantom scrollbar and fakes a 2px overflow on every route; a
  half-pixel tolerance keeps a `min-h-11` that measures 43.99 from failing). A new rule reads the
  sticky header's `data-ink` promise against the rendered pixels beside its text (a 10px patch
  outside the logo and the nav on both sides, after the first-viewport images have loaded,
  decoded with `sharp`) and fails under 4.5:1.
- **`scripts/keyboard-audit.mjs`**: the shared Lightbox joins the overlays — the product gallery's
  full-screen control, the portfolio wall's first tile and the demo lander's fullscreen gallery:
  Enter opens, ArrowRight advances the `role="status"` counter, End/Home jump, Escape closes,
  focus returns.
- **Drift, reconciled** (A2's open item): `.sf-hero-drift` is an `infinite alternate` 6 s ambient
  loop the audit's duration rule exempts like every other loop; mounted on the homepage and
  large-format heroes on the poster wrapper, never the image.
- **Real 404s**: the list pages' `loading.tsx` boundaries wrapped their child detail routes too
  (`/portfolio/loading.tsx` covers `/portfolio/[slug]`), so a missing slug streamed a 200 shell. The
  three list pages now sit in `(index)` route groups with their own boundaries, and the PDP and
  category pages drop theirs: a missing product, portfolio case, journal post, category or lander
  answers a real 404 (measured); the demo routes answer 200.
- **Four defects the new gates found**, fixed in this batch: the search PAGE never applied the
  demo gate (`searchProducts` was called at its `NO_DEMO` default, so `/search` hid rows the
  overlay offered; `isDemo` is now selected and marked); the order action refused every Content Lab
  piece (`productId: z.cuid()` — fixture ids are deterministic strings — so a demo order answered
  "Something went wrong" while G's smoke had passed on an unrelated demo Inquiry); under a touch
  context the header logo (32px) and four footer links sat under the tap floor, and the fix
  itself surfaced a second one — the wordmark SVG was `h-full`, so a 44px link made it 37% wider and
  every page overflowed by 9px, now pinned to its visual height; and the transparent header measured
  2.7:1 beside its logo over a bright hero frame, so a top scrim (obsidian 85 → 55 → transparent
  over 112px) sits under the chrome only while the bar is transparent.
- **Docs**: `CLAUDE.md` (commands, the ten-surface CMS table with the Content Lab, the demo,
  testimonial and off-by-default rules, motion primitives, Design QA and the definition of done),
  `AGENTS.md` (what a green PR is evidence for, the container-restart and `test:db` traps),
  `ADMIN_GUIDE.md` (media library, testimonials, Settings' Sheets and Demo content, Bulk Import's
  overwrite checkbox, Sheet Import's Preview / conflicts / history, Content Lab, process steps and
  the bands that ship off), the owner handbook (8.3), the roadmap status,
  `docs/studio-cms/04-structure-layer.md` (with C2).

Verified on the F2 tree (`wave3/f2`, merged fast-forward into the branch), every run isolated on the
built server with the demo set seeded: typecheck · lint · vitest · test:db · copy:check · `next build` ·
`npm run test:e2e` **27/27** · redesign-audit **0 failing rules** with the new rules on the 13 CI routes plus
the five demo detail routes at 1440 / 390 (touch) / 360 (touch), and ten `/ar` routes at 1440 and 390 ·
a11y-audit 0 critical/serious at 1440 / 390 / `/ar` 390 · keyboard-audit at 1440 and 390 with the three
lightbox paths (the mega menu and the lander gallery correctly skipped at 390) · studio-audit clean across
36 routes at 1440 and 390 · Lighthouse with drift mounted: home perf 98 / a11y 97 / LCP 1.0 s, plp 97 / 100
/ 1.2 s · motion-budget 48.4 KB · a missing product, portfolio case, journal post, category or lander
answers 404, the demo routes 200. CI runs the same sweep on the pushed head.

---

## Wave 2 · batch C2 — the block catalogue grows from six to sixteen (2026-09-04)

Merged `84b63d8` (nine blocks from the worktree, one commit each) plus `c37afd1` (the tenth,
built on the main branch because it needs A3's shared Lightbox, which the worktree predates),
`93d839d` (the demo lander exercises the new blocks; fixture enum; docs) and `cfa918e` (the
database suites run one file at a time). The C2 agent was stopped after the container restarted
under it (its shell never returned from a `grep`); its in-progress videoStory diff was completed
by hand — the walker branch and the tests/db case it had not yet written — and committed as
`8dcd758`, then masonryGallery and bentoGallery followed in the worktree.

- **Readers of existing content** (nothing invented — HARD RULES §1.1): `collectionGrid`
  (visible categories by slug), `portfolioGrid` (`recent` | `manual`, PUBLISHED behind the demo
  gate), `journalGrid` (optional category, PUBLISHED behind the demo gate), `testimonial` (one
  row, `editorial` | `featured`, rendered only if PUBLISHED and past the demo gate at render time)
  and `testimonialGrid` (`featured` | `manual` → `TestimonialWall`).
- **Film**: `videoHero` (dark ground; `BlockDef.once` generalised to `slot: "hero"`, so
  `describeBlockArrangementProblem` refuses a hero beside a videoHero and the "only the hero may be
  dark" test now names both) and `videoStory` (the same `HeroMedia` idiom boxed 4:3 on a light
  ground). Both take the film as a library link and the poster through the media picker.
- **Pictures**: `masonryGallery` (up to twelve, CSS columns cycling four tile ratios),
  `bentoGallery` (up to six on the homepage collections' 12-column bento, lead tile two rows
  tall) and `fullscreenGallery` (up to twelve square thumbnails opening the shared storefront
  Lightbox — keyboard stepping, RTL arrows, live region, focus return and the FLIP entrance are
  one implementation). Every tile is a `MeniscusImage`; captions render as written. The editor
  gains `GalleryImagesField` — an ordered, capped list of library picks with description, caption,
  move and remove — shared by all three.
- Every URL-bearing block joins `media-usages.ts` in its own commit with a tests/db case
  (`videoHero`, `videoStory`, and the three galleries walked per picture with its position).
  `spacing` maps to `section-compact` | `section-standard` only; no per-block theme; no stats
  block. `custom-blocks.test.ts` records each count bump with its dated reason (6 → 16) and the
  catalogue is closed again at sixteen; `docs/studio-cms/04-structure-layer.md`'s table and
  "six types" sentences describe it as it is.
- `/p/demo-lander` gains a masonry, a bento, a videoStory (the studio's own process clip) and a
  fullscreen gallery between the FAQ picker and the closing CTA, so CI and the local sweep render
  every gallery block on a real route; the fixture loader's block enum catches up.

Verified on the merged head (`cfa918e`): typecheck · lint · vitest 63 files / 628 · test:db 6 / 33
(five new media-usages cases) · copy:check 1,303 · i18n-missing clean · vitest `src/lib/demo`
(every fixture picture on disk) · `next build` · motion-budget 48.4 KB · redesign-audit 0 failing
rules on the 13 CI routes plus the five demo detail routes (the lander now carrying the four new
blocks) at 1440 / 390 / 360 and nine `/ar` routes at 390 · a11y-audit 0 critical/serious at 1440 /
390 / `/ar` 390 · keyboard-audit at 1440 and 390 · E2E 10/10 · studio-audit clean across 36 routes at
1440 and 390 · Lighthouse budgets met · demo proofs unchanged · `/p/demo-lander` on the running
server renders the masonry (CSS columns), the bento (two-row lead tile), the video story (the
process clip) and the fullscreen gallery (twelve square thumbnails), and its `/ar` twin is RTL.

---

## Wave 2 · batch A4 — ten process steps, accordion gallery, journal collections, Studio process/materials surfaces (2026-09-04)

Merged `352ef9e`. A4's agent was stopped after the container restarted under it (its shell never
returned from a `git diff --stat`), so its last verified change — the accordion-gallery fix it had
gated at 20:48 — was committed by the coordinator as `b5f0847` and the batch merged from there; the
merged head was built and audited here before the push. Merge collisions: the nine message files
(three-way merged through the repo's own `i18n-merge.mjs`, no key collisions), the sidebar and
studio-audit route appends (both kept), `site-images.test.ts`'s alt-key count (A2's ten plus A4's
four → 56), and `site-copy.generated.ts` (regenerated: 1,303 slots).

- **Ten steps, not six.** `/process`'s timeline is driven by `PROCESS_STEPS` (B0) instead of a
  local six-entry list, relabelled to the owner-confirmed fabrication sequence — Concept ·
  Material selection · Wood preparation · Resin composition · Casting · Curing · Surface refinement
  · Hand finishing · Quality inspection · Delivery (delivery only; the studio states no
  installation service). Four new `site-images.ts` slots (`process.step7–10`, 4:5, fallbacks read
  as polish / finish / inspection / delivery atmosphere) and every `Process.timeline.step<n>`
  key in all nine locales; Meta values reuse only figures already published on the site (24–72 h
  per layer, 400 → 3000 grit, tracked anywhere in India) or a short mono word. "Six steps, no
  shortcuts" → "Ten steps, no shortcuts" ×9 (19 English values changed, all nine locales updated —
  the `--stale` gate is clean).
- **Two registry surfaces (plan decision 1).** `page-sections.ts` gains `"process-steps"` (ten
  defs, explicit copy keys on step1/step10 to dodge the `step1*`/`step10*` prefix collision) and
  `"materials"` (four defs owning the copy pair plus every picture of that material on BOTH pages,
  so reordering one moves it on both). `describeArrangementProblem` refuses to empty a whole list
  (hide all ten steps, or all four materials). `SUBLIST_PAGES` marks the two as not routable (no
  h1 owner) and the shared h1-invariant tests are updated rather than weakened. `/studio/process`
  and `/studio/materials` render the existing `SectionsBoard` pre-filtered to one page key — draft,
  publish and revision history come free; sidebar and audit routes appended.
- **`storefront/accordion-gallery.tsx`**: flex strips, the active one at `flex-grow: 3`, driven by
  hover, focus-within or a roving-tabindex click; reduced motion collapses to equal strips with
  every copy panel visible; below `md` the same markup reads as stacked cards; every panel's copy
  stays in the DOM and the accessibility tree. Mounted on `/process` and `/about` materials in
  place of the static grid and hover-macro cards, keeping every copy key and alt. The follow-up
  fix (`b5f0847`): no default active strip (a hover used to open a second strip beside the one
  marked active from load), the macro photograph opens under the same three triggers un-prefixed
  so a tap on a phone card reveals it, and the trigger and its copy share one bottom-anchored
  column so a two-line title no longer overlaps the panel.
- **Journal**: `blog/[slug]` shows the article's own shop collection (B0's
  `BlogPost.category`, distinct from the editorial blog category) plus up to two visible siblings
  through `CollectionCard`, only when the author pointed the post at one; the three optional bands
  under the reading sheet alternate sand/mineral so any subset stays light → light. Demo posts and
  demo related cards carry `<DemoMark/>`; the Article JSON-LD is withheld for a demo post
  (BreadcrumbList stays); `blog/page.tsx`'s demo-category exclusion was already correct from B0.
- i18n ×9: `Process.timeline.step7–10{Title,Copy,Meta,Alt}`, `Blog.relatedCollections.*`,
  `AccordionGallery.*`. Not done by the agent before it was stopped: hero rise/drift on `/process`
  (the page keeps its current hero; the drift token itself is F2's) — recorded as an open item.
- Measured in the worktree: 478 unit tests, 18 db tests, typecheck, lint, copy:check, i18n
  `--stale` clean; audits, E2E, keyboard, motion 48.4 KB, studio audit and Lighthouse on
  `/process` per the agent's own log; a hover/focus/click/reduced-motion script against the built
  `/process` and `/about`.

Verified on the merged head (`352ef9e`): typecheck · lint · vitest 63 files / 623 · test:db 6 / 28 ·
copy:check 1,303 · i18n-missing clean, `--stale` reports the 19 relabelled English values with every
locale updated · `next build` · motion-budget 48.4 KB · redesign-audit 0 failing rules on the 13 CI
routes plus the five demo detail routes at 1440 / 390 / 360 and nine `/ar` routes (now including
`/ar/process`) at 390 · a11y-audit 0 critical/serious at 1440 / 390 / `/ar` 390 · keyboard-audit at
1440 and 390 · E2E 10/10 · studio-audit clean across 36 routes (the two new surfaces included) at
1440 and 390 · Lighthouse budgets met · demo proofs on the running server: no sitemap entry,
`noindex, nofollow`, no Product JSON-LD and the DemoMark on the demo PDP; the DemoMark on the demo
journal post with no Article JSON-LD. Environment note: the session container restarted twice under
the running agents (their shells never returned) and Postgres has to be restarted by hand after
each restart (`pg_ctl … start` per PROJECT_STATE's environment recipe).

---

## Wave 2 · batch A2 — homepage bands and the large-format page (2026-09-03)

Merged `40e0211`, built and gated in its own worktree; the merged head was built and audited here
before the push. The only merge collision was `site-copy.generated.ts`, regenerated from the
merged messages (1,282 slots). One merge follow-up: the sections board dimmed a hidden row with
`opacity-60`, which put its graphite meta text under AA — nothing had shipped a hidden section
until A2's off-by-default bands, so the studio audit met the treatment for the first time and
failed `/studio/sections` with eight serious contrast findings; the row now carries a muted tint
beside its existing "Hidden" badge and keeps full-contrast text. A2's one deferred item — the homepage "pieces" band could not mark
demo fixtures because `CARD_SELECT` had no `isDemo` until A3 — closes by construction on this
head: the band renders A3's `CatalogProductCard`, which carries the `DemoMark`.

- **`page-sections.ts`**: `SectionDef.defaultVisible?` (default `true`) lets a section ship OFF
  without a new mechanism; `page-sections-server.ts` resolves `row?.visible ?? def.defaultVisible
  ?? true` on both the public and the Studio path, and the sections board shows an "Off by
  default" hint. HOME gains **large-format** (after `pieces`), **furniture** (after `collections`,
  off) and **rooms** (after `maker`, off) — still three dark bands, none adjacent. LARGE_FORMAT
  gains **philosophy**, **materials**, **pieces** (off), **work**, **words** and **faq** between
  `scope`/`how` and `brief`/`gallery` — still two dark. `page-sections.test.ts` now checks every
  page's default arrangement against its own band-rhythm guardrail and resolves every
  `cureLabelKey` against `messages/en.json`.
- **`furniture-kinds.ts`** is the shared six-kind list (dining, coffee, side, console, chair,
  bench) both furniture bands read — D9/D26 commission framing: concept tiles captioned as such,
  a lead-time line that reuses `Process.timelines`' published figure, a WhatsApp CTA, **no prices
  and no product rows**. Ten new `site-images.ts` slots (six 4:5 furniture tiles, four 4:3 room
  tiles) fall back to existing §15.4 masters read as bench, formwork, surface and interior
  atmosphere; `large-format.ts` adds `"art-craft-pieces"` to `LARGE_FORMAT_CATEGORY_SLUGS`, so
  that page's gallery shows real published pieces instead of the empty-state invitation.
- **`(v2)/page.tsx`**: the hero switches to the `poster` ref (mobile crop + focal point) with the
  `sf-hero-rise` stagger on eyebrow / h1 / lede / CTA row — the poster stays the LCP and is never
  animated; the primary CTA is `/custom-order`, the secondary `/shop`. New large-format teaser,
  furniture and rooms bands; the collections band is a 12-column bento with a two-row lead tile;
  the words band renders through `SnapRail` below `md`; the bespoke band's background is the first
  `HeroParallax` mount since D18; manifesto, maker, print, process, why, journal and closing wrap
  their text in `Reveal`.
- **`large-resin-art/page.tsx`**: the same hero treatment and six new sections — `philosophy`,
  `materials` (reusing `Process.materials.*`), `pieces` (off by default, the furniture tiles),
  `work` / `words` / `faq` (conditional, rendering nothing when empty).
- **`drift` is not mounted.** A1's `.sf-hero-drift` is a one-shot 6,000 ms animation and
  `redesign-audit.mjs`'s duration rule exempts only infinite loops, so the prop fails Part 3.8's
  four-value gate the moment it is used. Both heroes keep the rise stagger; reconciling the drift
  token is an F2 item.
- i18n ×9 (real translations): `Home.largeFormat.*`, `Home.furniture.*`, `Home.rooms.*`,
  `Home.cure.{largeFormat,furniture,rooms}`, `LargeFormat.{philosophy,pieces,work,words,faq}.*`,
  `LargeFormat.cure.*`, `Common.of`.
- Measured in the worktree: 477 unit tests, 18 db tests, redesign/a11y audits clean on `/` and
  `/large-resin-art` at 1440/390/360 (+ `/ar`), keyboard, E2E 10/10, motion 48.4 KB, Lighthouse
  home perf 97–98 with LCP 1.1–1.3 s, screenshots with the off-by-default bands forced visible
  through temporary `PageSection` rows (reverted).

Verified on the merged head (`40e0211` plus the sections-board fix `909e28a`): typecheck · lint ·
vitest 63 files / 620 · test:db 6 / 28 · copy:check 1,282 · i18n-missing and `--stale` clean ·
`next build` · motion-budget 48.4 KB (unchanged) · redesign-audit 0 failing rules on the 13 CI
routes plus the five demo detail routes at 1440 / 390 / 360 and eight `/ar` routes at 390 ·
a11y-audit 0 critical/serious at 1440 / 390 / `/ar` 390 · keyboard-audit at 1440 and 390 · E2E
10/10 · Lighthouse budgets met (perf ≥ 85, a11y ≥ 95) · studio-audit clean across 34 routes at
1440 and 390 after the sections-board fix (the first pass failed `/studio/sections` with eight
serious contrast findings, all on the dimmed hidden rows) · the demo detail routes re-audited
clean at both widths after re-seeding the demo set that `test:db` had removed, with the proofs
restored (no sitemap entry, `noindex, nofollow`, no Product JSON-LD, the DemoMark rendered) · on
the running server the homepage carries the rise stagger and no drift, seven `/custom-order`
links, the large-format teaser, a four-tile bento lead and no furniture or rooms band (both off by
default — their headings occur only inside the serialised message payload), and `/large-resin-art`
renders philosophy, materials, pieces, work, words and faq.

---

## Wave 1 · batch E and wave 2 · batch A3 — scraper + Sheets, and the shop / PDP / category pass (2026-09-03)

Merged `5d6a74c` (A3) and `817865e` (E), each built and gated in its own worktree against its own
database copy; the merged head was built and audited here before the push. Merge follow-ups:
`f827adf` (C1's design-lab mock rows gain A3's four card fields — C1 landed after A3 branched, and
the out-of-stock mock row is marked demo so the lab shows the DemoMark state) and, inside the E
merge commit, the `FlaskConical` icon both G and E imported into the sidebar (kept once), the
Settings screen stacking G's Demo content section above E's Sheets section, `studio-audit.mjs`
keeping both batches' routes, and `import.ts` taking E's merge-aware preview.

### A3 — shop card, quick view, shared lightbox, PDP, category
- **D21 on the card row.** `src/lib/shop.ts`'s `CARD_SELECT`/`ShopProductItem` grow `materials`,
  `dimensions`, `videoUrl`, `isDemo` and `images.role`; `materials`/`dimensions` stay outside
  `TRANSLATABLE_FIELDS.product` (mirroring `large-format.ts`) — owner free text, shown as typed in
  all nine locales. New `src/lib/card-meta.ts`: `cardMetaLine()` (one mono "materials · dimensions"
  line, `null` when both are empty) and `accessibleCardName()` (the card link's full, never-truncated
  accessible name — Part 17's no-ellipsis rule).
- **`catalog-product-card.tsx`**: the mono meta line; `<DemoMark/>` on a fixture row; the
  single-image hover zoom only when there is no second image to wipe in; below the stretched card
  link and outside it, two real ghost controls — `QuickViewTrigger` and an "Ask on WhatsApp" ghost
  link (`data-wa-source="card"`), both flush-padded after a real 360px overflow was caught by the
  audit in the worktree and fixed. New `shop/card-hover-video.tsx` (an ambient hover clip, mounted
  only for a fine hover-capable pointer under no reduced motion, `preload="none"`, never on the
  priority row) and `shop/card-ask-whatsapp.tsx` (its own client island so the card stays a Server
  Component).
- **`shop/quick-view.tsx` + `quick-view-trigger.tsx`**: a storefront Dialog reviving the four
  `Shop.quickView*` keys that already shipped in nine locales, plus one new `Shop.quickViewLabel`.
- **PDP**: the related rail is a grid from `md` and a `SnapRail` below it; the manual testimonial
  grid is replaced by `<ProductTestimonials/>` (product → category → hidden); `reviewJsonLd` is
  appended to the Product JSON-LD, and the whole Product/Offer/Review graph is omitted for a demo
  fixture, which also gets `noindex`; `<DemoMark/>` under the eyebrow; a room-context band after the
  commerce split, only when the product carries an `IN_ROOM` image. `order-panel.tsx` gains a mono
  demo-order note; `SWATCH_COLORS`/`swatchColor` move to `src/lib/swatch-colors.ts` (a byte-identical
  pure move, now unit-tested). `customization-controls.tsx`'s empty engraving preview moves off
  `text-graphite/60` (the AA failure batch G's audit found) to full-opacity `text-graphite`.
- **Shared lightbox**: new `storefront/lightbox.tsx` — one Dialog + keyboard + RTL + live-region +
  focus-return implementation with a CSS FLIP entrance (`src/lib/flip.ts`, pure and unit-tested)
  measured against the opening tile. `gallery.tsx` and `portfolio/lightbox-gallery.tsx` become
  consumers, keeping their own stage content; `gallery.tsx`'s video and `model-viewer.tsx` gain a
  `poster`.
- **`/shop`**: the ecosystem tabs clear the 44px touch floor via `pointer-coarse:` (A1 had flagged
  the miss). **`/shop/[category]`**: `<Reveal>` on text bands, the related-collections strip gains a
  `SnapRail` below `sm`, and the breadcrumb JSON-LD's hardcoded English "Home"/"Shop" is localised.
- `/search` constructs `ShopProductItem` by hand from `search-query.ts` and defaults the four new
  fields — no behaviour change there. `REDESIGN.md` §0 row 4: the wishlist stays (D11) — an
  account-less local list, not a bag.
- i18n ×9: `Shop.card.*`, `Shop.quickViewLabel`, `Product.roomContext.*`, `Product.demoOrderNote`,
  `Product.dimensionsLabel`, `Lightbox.*`; `site-copy.generated.ts` → 1,207 slots.
- Measured in the worktree: 490 unit tests, 18 db tests, build, redesign/a11y audits clean at
  1440/390/360 (+ `/ar` at 390) on `/shop`, `/shop/gift-collections` and a PDP, a manual lightbox
  keyboard pass on both origins, motion-budget 48.4 KB, E2E 10/10.

### E — scraper pipeline and the sheet fill
- **A nine-stage rail on `/studio/scraper`** (`src/lib/scraper/stages.ts` + `stages-server.ts`,
  `scraper/stage-rail.tsx`): sources through confirmed, each cell a live count linking to its
  screen.
- **A scrape has a scope**: whole source, one category/listing page, or one product page
  (`ScrapeJob.scope`, migrated in B0), verified against the source's own host before a job is
  created; the three adapters honour it.
- **The runner survives navigation**: `src/hooks/use-scrape-runner.ts` is a module store mounted
  once by `scraper/layout.tsx`, so a run no longer dies with whichever page component started it;
  `beforeunload` warns while a run is active.
- **Stale-job reclaim**: a `RUNNING` job whose `updatedAt` heartbeat is older than ten minutes is
  presumed dead and no longer locks its source; each page advance is an optimistic
  `where: { id, cursorPage }` update so two workers never drive one job.
  `partitionByInFlight` now takes the in-flight jobs (with status and heartbeat) rather than ids,
  and the breaker is keyed by `sourceKey`.
- **Normalisation at staging** (`src/lib/scraper/normalize.ts`): material, colour and unit aliases
  plus `canonicalizeUrl`, applied before `contentHash`, so a source's own inconsistency never
  manufactures a false change. Reviewer notes on a staged listing (`ScrapedProduct.notes`).
- **`/studio/research`** — a hand-kept research library (`ResearchRecord`, `actions/research.ts`),
  never a product on its own.
- **Bulk Import runs the owner-edit guard**: `previewImport` applies `decideMerge` per row and
  reports `ownerEditedCount`; the wizard shows "Will overwrite N owner-edited products" behind an
  explicit `overwriteOwnerEdited` checkbox, and `importProductRow` honours
  `refresh-availability`. **Behaviour change:** a plain re-import of an already-imported,
  untouched row is now skipped rather than unconditionally overwritten unless the box is ticked.
- **The deploy-time sheet fill is one implementation**: `src/lib/import/tier-fill.ts`
  `runTierFill({ trigger, dryRun })`, with `prisma/import-tiers.ts` a thin caller — proven
  byte-identical on `SELECT tier, status, count(*)` before and after the extraction (373 draft +
  4,000 published), idempotent on re-run. `actions/sheet-fill.ts` gives `/studio/sheet-import`
  Preview and Run now via `decideFillRun("PREVIEW" | "MANUAL")`, and every dropped row says why.
- **Conflicts and history**: when the sheet and a studio edit change the same field between fills
  (owner-touched ∧ `studioEditedAt` after the last run ∧ hash differs), one `SheetConflict` per
  field lands on `/studio/sheet-import/conflicts` — Keep mine · Take sheet · Skip. Every push (job,
  tier, confirmed list, website mirror) is wrapped in a `SheetSyncRun` with a visible history.
- **The sheet id lives in Settings** (`readSheetId(settings)`, env fallback) with a "Sheets" section
  for the spreadsheet id and the five tab ids; `syncWebsiteProductsToSheet`'s underlying writer
  (`product-sheet-sync.ts`) still resolves env-only — recorded in `docs/google-sheets.md`.
- `category-map.test.ts` asserts every keyword slug is a seeded category; `/scraper/mapping` is
  titled "Source → category report". Docs: `docs/scraper.md`, `docs/google-sheets.md`.
- No storefront copy touched (the Studio is English-only). Measured in the worktree: 450 unit
  tests, 13 db tests, typecheck, lint.

Verified on the merged head (`817865e` plus the sheet-import wrap fix): typecheck · lint · vitest
63 files / 618 · test:db 6 / 28 · copy:check 1,207 · i18n-missing and `--stale` clean · `next build`
· motion-budget 48.4 KB (unchanged) · redesign-audit 0 failing rules on the 13 CI routes plus
`/product/demo-product-001`, `/shop/gift-collections`, `/blog/demo-post-001`,
`/portfolio/demo-case-001` and `/p/demo-lander` at 1440 / 390 / 360, and eight `/ar` routes at 390 ·
a11y-audit 0 critical/serious at 1440 / 390 / `/ar` 390 · keyboard-audit at 1440 and 390 · E2E
10/10 · studio-audit clean across 34 routes at 1440 — at 390 it caught `/studio/sheet-import`
overflowing by 69px: the "Recent fills" summary (`+15 new · 30 updated · 240 unchanged · 1 failed`)
was `shrink-0` beside the date, which only became too long once the demo ImportRun fixtures were
seeded; the row now wraps, rebuilt and re-audited clean · Lighthouse budgets met (perf ≥ 85, a11y
≥ 95) · demo proofs on the running server: no sitemap entry for the fixture, `noindex`, no Product
JSON-LD, the DemoMark rendered, the demo order note present, and the room-context band rendering
from the fixture's `IN_ROOM` image (A3 could not exercise that path in its worktree).

---

## Wave 1 · batch F1 — CSP enforced, JSON-LD literals, magic-byte upload sniff (2026-09-03)

Merged `86f6bba`, built and gated in its own worktree; the merged head was built here and the
enforced policy checked against the running site before the push.

## F1 — CSP enforcement, JSON-LD accuracy, upload magic-byte validation

Three hygiene fixes, each small enough to verify in isolation.

**CSP now blocks instead of only reporting.** The report-only period ran clean, so `next.config.ts` renames the header key from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. The directive string carries forward unchanged except for one real gap the enforced header would have hit immediately: `frame-src` now allows `https://www.google.com`, because the click-to-activate Google Maps embed on `/contact` (`StudioMap`) had nowhere else to load from. Every other third-party host already loading client-side — Vercel Analytics/Speed Insights, Meta Pixel, GA4 — was already allow-listed; verified against `src/components/analytics/*` and the locale layout rather than assumed. Nonces were considered and rejected: minting one per request would force pages off the prerendered path, and this storefront depends on 13 routes × 9 locales staying statically generated to keep database fan-out off the request path. Rollback is a one-line key rename back to `-Report-Only`; the header comment records this so a revert never has to re-derive the policy.

**The Organization/LocalBusiness JSON-LD stopped lying about language support.** `availableLanguage` was a literal `["en", "hi"]`, unchanged since the site had two locales — it now spreads `locales` from `src/i18n/config.ts`, all nine. The literal `priceRange: "₹₹–₹₹₹"` is gone too: there is no settings column behind it, and inventing one just to keep a schema field filled would be exactly the kind of number the redesign contract forbids. Rendering nothing beats a stale or fabricated figure.

**Uploads are now checked against their own bytes, not just their claimed type.** `src/lib/media-ingest.ts` gains `sniffContentType(buffer)` — magic-byte detection for the seven signature-bearing formats the studio accepts (JPEG, PNG, WebP, AVIF, MP4, WebM, GLB) — and `validateDeclaredType(buffer, declared)`, which throws a typed `MediaTypeMismatchError` when the sniffed family (image/video/model) disagrees with what the upload declared. `finalizeAsset` now runs this check first, before touching sharp or computing a checksum, closing a gap where the studio's upload action trusted `file.type` — a value the browser sends and the client fully controls — with nothing behind it. USDZ stays declared-type-only and says why: it's a zip container, and a zip's magic bytes can't distinguish a real USDZ from any other zip-based file. Verified with 25 new tests over hand-built byte fixtures (no files on disk), covering every signature, every mismatch direction, and the case where nothing was recognized at all.

Merge follow-up: the upload action now names a declared-type mismatch in its per-file failure
list instead of folding it into "(storage error)".

---

## Wave 1 · batches C1 and D — Studio content management and the media library (2026-09-03)

Merged `a9447c4` (C1) and `cc8983d` (D), each built and gated in its own worktree; the merged head
was then built and audited here before the push. Two merge follow-ups landed as `89af275`.

### C1 — Studio content management, part 1
- The five main content lists (products, blog, portfolio, inquiries, FAQs) share one shape: sort
  on every sortable column, a "Demo only" filter for Content Lab fixtures, and — on products,
  blog, portfolio and FAQs — a phone card layout below `md` instead of a sideways table. Products
  and inquiries gain a per-browser "Columns" menu.
- `ContentStatus`'s REVIEW and ARCHIVED values (migrated in B0) are reachable: four status tabs
  with live counts on products, blog and portfolio, with bulk Send to review / Archive / Restore
  to draft beside Publish / Draft; the dashboard counts split the same way; FAQs get a status
  column with a click-to-toggle badge. **Visible change:** blog and portfolio lists now open on
  the Published tab, the convention products already used.
- Blog and portfolio forms are tabbed (Content · Media · Taxonomy · SEO; Story · Media · Results ·
  Taxonomy) on the product form's pattern with per-tab error dots; blog posts gain a Related
  collection; portfolio gets the real device-frame preview; the category editor gains SEO
  title/description and a visibility toggle; categories, FAQ and staff dialogs get inline,
  screen-reader-wired errors; every product image can carry a role (hero · detail · in-room ·
  process).
- The four update actions record a bounded before-picture in `ActivityLog.meta.before`
  (`snapshotBefore`). Product, blog and portfolio forms autosave to the browser every 800 ms with
  a Restore / Discard banner; the draft clears on a real save and never touches the database.
- The topbar bell opens an inbox derived from existing rows (review queues, last scrape jobs,
  last sheet-import runs, last publish events) — no new table.
- `/design-lab` is rebuilt on the live v3 components behind the staff login and the production
  404; `storefront/{product-card,tabs,order-summary-preview,marquee}.tsx` are deleted with it.
- Measured in the worktree: 415 unit tests (33 new), 13 db tests, typecheck, lint, copy:check,
  i18n.

### D — the media library becomes a DAM
- `/studio/media` is URL-driven: keyset pagination (60 a page), sort, and server-side type /
  orientation / favourite / demo / size / date filters stacking with folder, search, missing-alt,
  unused and AI-generated; grid/list toggle; phone cards. Orientation is answered by three small
  static `$queryRaw` calls (Prisma cannot compare two columns in a plain filter).
- A detail drawer per file: dimensions, bytes, checksum, provenance, a labelled "used in" list
  linking to the owning Studio section, inline caption/tags/favourite/alt, replace-file at the
  same URL, and for video a poster capture (frame at one second → its own library row). Bulk bar
  gains Move, batch description and favourite. Upload is a drag-and-drop zone with a folder picker.
  The media picker lists video as well as images.
- The Part 15 blur-up placeholders are finally rendered: every site-image slot resolves its LQIP
  on the URL it actually resolved to (bundled master or owner override), so a repointed slot never
  paints the picture it used to show. Mirrored catalogue images get a library row of their own.
  The generation queue for the next photography batch (bench concepts, large-format art, concept
  rooms, four process steps, mobile crops, three video loops) is recorded in
  `docs/media-v3-manifest.json` as `plannedSets`, for the owner's machine to run.
- `src/lib/media.ts` (dead Cloudinary constants, zero importers) now carries the library's shared
  formatting helpers instead.
- Measured in the worktree: 411 unit tests, 23 db tests (10 new), typecheck, lint, copy:check.

### Merge follow-ups (`89af275`)
- The inquiries page had G's and C1's `isDemo` additions auto-merged into the same select and row
  mapping; one copy remains.
- The marquee keyframes left `globals.css` with their only consumer.
- The Tiptap editor's contenteditable now carries a role, `aria-multiline` and an accessible name,
  closing the `aria-input-field-name` finding the Content Lab audit reproduced on every editor.

---

## Transformation batch G — Content Lab (2026-09-03)

Merged `b642f17`, built in its own worktree against its own database copy; it depends only on B0,
so it ran ahead of wave 1's queue.

### Added: demo fixtures the owner can seed into any database, on demand
The plan's Content Lab (§15): a full, deterministic content set — 100 products across the 16
seeded categories (edge-matrix by construction: title lengths 8–220 chars, 0/1/8 images, every
`ContentStatus`, `needsRewrite`, `ownerTouched`, every tier, `ar`/`hi` translations on ten rows,
every `FieldType` on `demo-product-001` for the E2E order path), 10 journal categories + 30 posts,
12 portfolio cases (one carrying `beforeImageUrl`/`afterImageUrl`, so `BeforeAfter` finally has
data), 40 testimonials across 10 categories (every `TestimonialStatus`; a PUBLISHED + GRANTED row so
the wall renders), 30 FAQs, 5 landing pages exercising every block type, 40 media rows, 30
inquiries, 30 research notes, 3 scrape jobs (DONE / FAILED / a deliberately stale RUNNING row) with
40 staged products, and 5 import runs. `isDemo: true` throughout; image paths restricted to files
this repo already ships (a test asserts each is on disk).

`src/lib/demo/{fixtures,apply,guard}.ts`: zod-validated loaders, a dependency-ordered
`seedDemo` / `removeDemo` / `demoStatus` engine (upsert by id — safe to run twice), and
`describeDemoHost()`, the host allow-list every write path checks. `npm run seed:demo` is the CLI
(`--status`, `--remove`, `--allow-production` plus a typed "DEMO INTO PRODUCTION" confirmation a
non-interactive shell can never satisfy). `prisma/bootstrap.ts` never references it; a test greps
to make sure.

`/studio/content-lab` (ADMIN): host card, mono counts, last seed/remove, the public-visibility
switch, Seed (disabled with a reason when the host is not allow-listed) and Remove (typed confirm).
The switch is also on Site Settings; the dashboard gained a "Demo records" tile. A demo product's
Place Order still works — its Inquiry saves `isDemo: true` and its WhatsApp message is prefixed
`[DEMO] ` (`withDemoPrefix` in `whatsapp.ts`); the commissions board shows a badge and a `?demo=1`
filter.

### Verified
typecheck · lint · vitest 418 · test:db 18 (seed twice → same counts, gate both ways, sitemap
excludes, remove → zero rows, real rows untouched) · copy:check · a production build ·
`redesign-audit` / `a11y-audit` on the six demo routes at 1440/390/360 + `/ar` · motion 48.2 KB ·
keyboard · E2E 10/10 · `studio-audit` on Content Lab and four demo screens · sitemap excludes
every `demo-` id · `noindex` on demo detail routes · production-mode hiding proven against
`showDemoContent()`. The local main database now carries the demo set (`seed:demo --status`),
which is what the later audits and the F2 CI step build on.

### Two things found, not fixed here
- `order-panel.tsx`'s empty-engraving preview (`text-graphite/60` at `text-h3`) fails AA contrast
  — pre-existing, surfaced because `demo-product-001` is the first audited route with a TEXT
  customisation field. Routed to A3.
- The blog post form's Tiptap editor has no accessible name (`aria-input-field-name`) — reproduced
  on a real post, unrelated to fixtures. Routed to C1's merge.

---

## Wave 1 · batches A1 and B — design-system hygiene, chrome, and the testimonial system (2026-09-03)

Two of wave 1's six batches merged (`39c10dd`, `df8fc64`) after each was built and verified in
its own worktree against its own copy of the catalogue database. C1 (Studio content), D (media),
E (scraper + sheets) and F1 (hygiene) follow the same way.

### A1 — the house curve is one curve, and the header watches the page
- `src/lib/bezier-ease.ts` (a ~30-line Newton–Raphson cubic-bezier solver) lets `gsap.ts` register
  `"luxury"` and `"settle"` eases from the exact control points `tokens.css` defines, mirrored in
  `motion-tokens.ts` and pinned by a test that reads the CSS back. `gsap/CustomEase` would have
  cost ~2.5 KB gzipped against a 49 KB ceiling for two fixed curves. `Reveal` eases on `"luxury"`.
- `tokens.css` names Tailwind's five breakpoints in `@theme`; its cure-gutter query and the one
  that lived inside a JS string in `toast.tsx` now read `@variant lg` off `--breakpoint-lg`.
  Verified in the built CSS: both compile to `@media (min-width:64rem)`.
- `hero-parallax.tsx` moves `Math.min(40, height * 0.12)` (Part 14's 20–40 px cap) instead of 12 %
  of the hero. Three primitives in `globals.css`, each with a reduced-motion resting state:
  `.sf-hero-rise`, `.sf-hero-drift` (on the poster's wrapper, never the LCP image),
  `.sf-manifesto-brighten` (scroll-linked, no JS). `hero-media.tsx` accepts a `SiteImageRef`
  (mobile crop + focal point) as well as a bare URL, and can opt into the drift.
- `use-hero-ink.ts`: an IntersectionObserver over the header's own top-80 px band replaces the
  seven-route transparency allowlist (the list stays as the SSR seed); the header exposes
  `data-ink` so the audit can check it.
- `brand-colors.ts` carries the thirteen v3 roles (a test reads `tokens.css` and asserts each hex)
  and re-skins the four OG cards, the manifest, the root error page and email. `BRAND.gold` is a
  deprecated alias of champagne until the order panel's swatch table moves (batch A3).
- RTL residue closed: drawer entrance, nav underline origin, filter drawer, cure-line origin; the
  cure line's `aria-label` is now `CureLine.pageSections` in nine locales; `ui/select.tsx` uses
  logical padding. New `SnapRail` (first importer of `carousel-nav.tsx`) and `DemoMark`.
  `button.tsx` `sm` and the announcement link clear 44 px on a coarse pointer.
- Measured: 417 unit tests, build, design/a11y audits at 1440 and 390 (+ Arabic), keyboard paths,
  E2E 10/10. Motion 48.4 KB gzipped (the two registered eases), under the 49 KB ceiling.
- Open, routed to A3: the shop ecosystem tabs still miss the 44 px floor at 390.

### B — testimonials: a review pipeline, a publish guard, three storefront modes
- `describeTestimonialProblem` (`src/lib/testimonials-rules.ts`, 24-assertion matrix) refuses
  PUBLISHED unless the customer's permission is recorded as GRANTED; it runs before every write,
  single or bulk, and returns its reason. Rows already live before this shipped are untouched
  (the guard fires on a save, never retroactively).
- `/studio/testimonials/new` and `/[id]` replace the dialog: a five-tab form (Quote · Attribution ·
  Links · Media · Review) on the product-form pattern, product/portfolio pickers reusing the
  provenance search, translations, draft preview. The list gained sort, status filter, search,
  a bulk bar (Publish reports what it skipped and why) and phone-width cards.
- `TestimonialCard` grew `editorial`, `linked` (beside the piece's own photograph) and `video`
  (poster + play chip, never autoplay) variants; `TestimonialWall` (CSS columns, never a
  carousel), `FeaturedTestimonial`, and `ProductTestimonials` (product → category → nothing) are
  built and wait for their mounts in A2/A3. `review-jsonld.ts` emits Review/AggregateRating only
  from PUBLISHED, non-demo, permission-GRANTED rows. `/custom-order` reads six through the wall.
- Bulk-imported testimonials arrive as drafts and may link a product by slug.
- Measured: 419 unit tests, 13 db tests, build, Studio audit clean on the two new routes at both
  widths, design/a11y clean on `/custom-order` with all three variants live, E2E 10/10.
- Merge notes: B's `demo-mark.tsx` stand-in was dropped for A1's; `Common.demoMark` keeps A1's
  wording; the resolver now serves the localised `designation`/`productTitle` (`aca1c0c`).

### Worktree lesson
`npm run build` panics under Turbopack in a worktree whose `node_modules` is a symlink to the
sibling checkout. The working invocation is the same three steps with
`NEXT_PRIVATE_OUTPUT_TRACE_ROOT=/home/user npx next build`; `next.config.ts` is not touched.

---

## Transformation batch B0 — schema, demo gates, shared helpers (2026-09-03)

The owner answered the roadmap's remaining gates (D7–D27) in one sitting and asked for the
whole plan; B0 is the foundation every later batch builds on. Twelve commits, eleven
additive migrations (44 → 55), zero data changes to any existing row.

### Added
- **Testimonial system schema** (`20260904100000`): `TestimonialStatus` (DRAFT · PENDING_REVIEW ·
  VERIFIED · PUBLISHED · ARCHIVED) and `PermissionStatus`; status, featured, isDemo, designation,
  category, givenAt, language, product/portfolio links (set-null), productTitle, purchaseType,
  media pointers, installation image, film + poster, internal notes, permission, verification,
  timestamps, indexes. **Every existing row is back-filled to PUBLISHED in the same migration**,
  so the live site did not change on deploy. `getTestimonials()` is now gated (`status =
  PUBLISHED` plus the demo gate), total (try/catch → `[]`), and takes either the old positional
  form or `{ take, locale, productId, portfolioId, category, featured, includeDemo }`.
  `revalidatePublic("testimonial")` finally purges the PDP, `/custom-order` and
  `/large-resin-art`, not just `/` — a withdrawn testimonial used to linger on product pages for
  a day. Shipped in PR #41 (merged); the rest of the batch is PR #42.
- **`ContentStatus` REVIEW and ARCHIVED** (`20260904101000`, enum values only). Every public
  reader already selects PUBLISHED; the eleven inline `z.enum(["DRAFT","PUBLISHED"])` schemas
  now read `CONTENT_STATUSES` from `src/lib/content-status.ts`.
- **The demo-content marker** (`20260904102000`): `isDemo` on Product, BlogPost, BlogCategory,
  Portfolio, Faq, CustomPage, Media, Inquiry, ScrapeJob, ImportRun (Testimonial had it), and
  `SiteSettings.demoContentPublic` (default off). One gate, `showDemoContent()` in
  `src/lib/demo-content.ts`: fixtures show off production, or in production only while the
  owner's switch is on. `demoWhere()` is spread into every public reader; the cached readers
  (`fetchDefaultShopFirstPage`, `fetchDuplicateTitleCounts`, `readCatalogNav`) carry the
  boolean in their cache key. The sitemap, `generateStaticParams`, the website→Sheet mirror and
  the image mirror hard-code `isDemo: false` whatever the switch says. Detail routes 404 a
  hidden fixture and mark a shown one `noindex`. **The "DEMO" title-prefix convention is
  retired** — zero occurrences remain.
- **`Faq.status`** (`20260904103000`, default PUBLISHED); every public FAQ reader selects it.
- **`Category.seoTitle` / `seoDescription` / `visible`** (`20260904104000`); the mega-menu, shop
  chips, search, sitemap, tiles, portfolio chips and sibling shelves honour `visible`; the
  category page 404s a hidden shelf and prefers the owner's SEO fields.
- **`Media.tags` / `caption` / `favourite` / `duration` / `posterUrl`** (`20260904105000`);
  `posterUrl` joins the delete guard as "Video poster · <file>".
- **Scraper** (`20260904106000`): `ScrapedProduct.notes`, `ScrapeScope` + `ScrapeJob.scope`,
  `ScrapeJob.updatedAt` heartbeat.
- **Sheets** (`20260904107000`): `SheetConflict`, `SheetSyncRun`, `SiteSettings.sheetId` /
  `sheetTabIds`.
- **`BlogPost.categoryId`** → Category (`20260904108000`), **`ProductImage.role`**
  (`20260904109000`), **`ResearchRecord`** (`20260904110000`; its `images` array joins the
  delete guard).
- Helpers: `snapshotBefore()` for bounded before-pictures in the activity log;
  `PROCESS_STEPS` (the owner-confirmed ten, written once).

### Verified
typecheck · lint · vitest 40 files / 391 tests (8 new) · test:db 4 files / 13 tests (5 new:
testimonial gate, demo gate hidden/shown/never-in-sitemap, video poster guard, research
picture guard) · `prisma migrate deploy` from scratch and `migrate diff` after every migration
(only the five statements that pre-exist on `main` remain: three raw-SQL trigram indexes and
two column defaults from the brand rename) · the production build and the browser audits are
recorded in the PR body.

### Two things learned the hard way
- Prisma 7.9 removed `migrate diff --from-url`; the drift proof is
  `--from-config-datasource --to-schema prisma/schema.prisma --script`.
- `src/lib/tiptap-media.test.ts` mocks the database table by table, so every new reader in
  `media-usages.ts` is also a new mock line — by design, not an oversight.

---

## Deploys — cap the prerender's database fan-out (2026-09-03)

Every Vercel deployment since 09:03 failed. The database was never the problem, and neither was any
of the Studio work in flight.

### The arithmetic
The storefront prerenders 13 routes × 9 locales, and each page reads the CMS resolvers — site copy,
site images, nav menus. Next runs static generation across **one worker process per core**, and each
process builds its own Prisma client with `max: 5` sockets (`src/lib/db.ts`). Vercel's build machine
reports:

```
Build machine configuration: 30 cores, 60 GB
```

30 × 5 = **150 simultaneous connections** against a hosted Postgres whose cap is far below that.
`experimental.cpus: 4` puts the ceiling at 20. It is the PRODUCT of the worker count and `max` that
has to stay under the provider's limit, so neither number moves without the other.

### Why it looked like something else
- The failure names the database, so it reads as an outage. It is not: preflight reported
  `psql ✓ connected and queried`, all 44 migrations applied, and `bootstrap` finished. **Only the
  prerender fell over.**
- **CI never sees it.** GitHub Actions builds against a throwaway Postgres container with no
  meaningful connection cap, which is exactly why the same commit is green there and red on Vercel.
- My own first diagnosis blamed six overlapping builds. A build that ran completely alone failed
  identically, which falsified it — one 30-core build is enough on its own.

### A stale comment that misdirected the diagnosis
`src/lib/db.ts` described the deployed database as **Neon**. It is **Prisma Postgres**
(`db.prisma.io`) — the build preflight prints the host on every deploy. Pooler limits differ between
providers, so the name is not cosmetic: it sent the first investigation at the wrong service. Header
corrected.

### Verified, and what is NOT verified
`npm run build` passes with the option accepted (Next lists `· cpus: 4` among the active experimental
flags); design audit, a11y audit, Studio audit and the unit suite are all clean afterwards.

**This does not prove the deploy is fixed.** The local machine has 4 cores, so the cap is a no-op
here — nothing local can reproduce a 30-worker fan-out or a hosted connection limit. Vercel is the
only place the change can be confirmed.

---

## Transformation Phase 11 — the per-page composer (2026-09-03, third batch)

### Added: one page's words, pictures and order on one screen
The roadmap's headline Phase 11 item — "a unified per-page editor composing words, pictures and
order from the registries; UI composition, no data change". Until now they were three screens, each
scoped by its own surface picker that could be set to a different page than the other two. Editing
one page's hero meant the headline in one place, the photograph in a second, its position in a
third.

**Not at the route the roadmap named.** It specified `/studio/pages/<key>`, but that route is
already the `Page` model editor (About, the policies), keyed by cuid under `[id]` — a `<key>` route
beside it is a collision. `/studio/site-copy` was already scoped to one surface, already carried the
surface's publish bar and revision history, and the copy and image registries already share its
surface names. So the three boards compose THERE, under one surface picker, as **Words · Pictures ·
Order**. The two standalone screens remain in the sidebar and render the same rows from the same
builders — `buildSiteImageGroupRows` and `buildSectionRows` were lifted out of their pages so there
is one implementation, not two that drift.

**The surface↔page join is derived, not hand-written.** Copy and images say "Large format";
sections say `large-format`. Neither vocabulary knows the other. Both carry the page's public path,
so `pageKeyForPath` joins them by that — a table that cannot go stale when either side gains an
entry. Five surfaces have no manifest by design and simply get no Order tab.

The active tab lives in the URL (`?tab=`), like the surface and locale already do; a surface switch
preserves it; every panel is `forceMount`ed so a half-typed copy edit survives a tab change.

### Two bugs in the first draft, one of which the audit could not see
1. **The whole screen fell to the error boundary — and passed the Studio audit.** `isSurfaceTab`
   was exported from the `"use client"` tabs module; a function exported from a client module is a
   client *reference* on the server, and the page's call threw "Attempted to call isSurfaceTab()
   from the server". An error page is a perfectly accessible page, so `studio-audit.mjs` reported
   clean across all 30 routes. The browser probe is what caught it: "tabs: (none), surface pickers: 0".
   The vocabulary now lives in a plain module both sides import.
2. **"Site chrome" and "System" would have offered the Homepage's sections to reorder.** They are
   copy groups with no page of their own, and the preview-path fallback of `"/"` joined them to
   `home`. Predicted from the code while reading the screenshot, then measured: with `?tab=order`
   forced, they render Words · Pictures only and land on Words. Only an explicit path may join.

### Measured on a production build
Homepage: three tabs, exactly **one** surface picker on the page; 3 panels mounted, 0 inactive
visible. Clicking Pictures writes `?tab=pictures`; the panel carries **0** group headings, no
per-group publish control and no import block, 8 slot cards. Switching to About **keeps**
`tab=pictures`. Order on About: no page switcher inside the panel, 7 sections. Portfolio with
`?tab=order`: Words · Pictures only, lands on Words. Both standalone screens still 200. Studio audit
clean at 1440 and 390; 0 server errors.

---

## Transformation Phase 11 — the dialog dismissal guard (2026-09-03, second batch)

### Fixed: a stray Escape threw away what you had just typed
The Studio's CRUD dialogs — testimonials, categories, FAQs, users — already blocked Escape and
outside-clicks, but **only `while busy`**, i.e. during the save round trip. That is the safest
moment. The dangerous one is the minute before: a half-transcribed customer quote, and a stray
Escape or a click beside the dialog discarded it with no warning and no undo. Radix closes on both
by default, and each dialog unmounts its body on close, so the text was simply gone.

`useDismissGuard` blocks the two accidental gestures while the dialog holds unsaved input, and still
blocks unconditionally during a save. It **blocks rather than asks**: a confirmation inside a dialog
means a dialog on top of a dialog. Cancel and the ✕ are one click away and still discard
immediately — those are the person saying "throw this away".

Dirtiness is read off the DOM rather than tracked in state. These dialogs hold a dozen `useState`
fields each with no form library, so per-field predicates would be four bespoke comparisons to write
and to keep in step with every field added later — the kind that quietly stops covering the new one.
Snapshotting the dialog's own inputs and diffing at the moment of dismissal covers fields nobody has
added yet, costs nothing per keystroke, and forces no re-render.

### Two bugs in the first draft, both found by measuring
1. **The guard did nothing at all.** It read the dialog element from `event.currentTarget`, but Radix
   hands `onEscapeKeyDown` the native `KeyboardEvent`, whose `currentTarget` is not the dialog. The
   lookup returned `null`, so the dirty check never ran — the guard was present, wired, and inert.
2. **Then it became a trap.** With the element found, the baseline was captured synchronously in the
   ref callback, *before* the dialog's fields existed. The snapshot was "no fields", every later read
   differed, and a CLEAN dialog refused to close. Deferring the snapshot one frame fixes it.

The test that caught both is the one that discriminates: a clean dialog must still close on Escape,
and a dirty one must not. Either bug alone passes half of it.

Measured on a production build: clean + Escape closes; dirty + Escape refused with the text intact;
dirty + outside-click refused; dirty + explicit Cancel still closes.

The three scraper dialogs keep their `busy`-only guard — they confirm an action rather than hold
typed prose.

---

## Transformation Phase 11 — the guard that was not guarding, and the browser prompts (2026-09-03)

### Added: the draft in a device frame, without leaving the editor
Every editing screen already linked to `/api/draft?redirect=…` in a new tab. That answers "how does
this read" but not "how does this read ON A PHONE" — the question that actually bites, since the
repo's own definition of done names 360px and 1280px and checking the small end meant a new tab plus
devtools plus a device-toolbar toggle. Most people do not, so long headlines and wrapped buttons
ship.

`DraftPreview` frames the public page at 390 / 768 / 1280 inside the editor, and keeps the new-tab
link inside the dialog so nothing is lost. Wired into the product and journal forms.

**Not scaled, on purpose.** A shrunk desktop preview reads as "roughly right" and hides exactly the
crowding it exists to reveal, so each width renders 1:1 and the desktop frame scrolls if the dialog
is narrower.

Framing is safe here and deliberately narrow: the storefront carries `X-Frame-Options: SAMEORIGIN`
and `frame-ancestors 'self'`, while **`/studio/*` is `DENY`** and stays that way — this frames public
pages only, never an admin screen.

Verified against a production build on a real product: the frame renders 390×700 by default, the
framed document's `h1` is the product's own title (so the draft cookie is minted and the storefront
really renders inside it), and switching to Tablet resizes it to 768.

### Fixed: the undo that existed and could not be reached
`restoreRevision` shipped with publishing and works — ADMIN-only, restoring **into the draft** rather
than straight to live, so a mis-clicked restore is itself recoverable. It was **unreachable**. Every
publish wrote a `ContentRevision`, and nothing anywhere listed them, so no owner could ever hold a
revision id. The history was being recorded faithfully and could only be read with a database
client.

`listSurfaceRevisions` is the missing half, and `RevisionHistory` is the dialog that renders it:
summary, timestamp, author, and how many copy slots and images each snapshot holds. Reading history
needs only staff; putting a version back still needs ADMIN, which is `restoreRevision`'s own check
and stays there. Capped at 50 — this is "undo what I just broke", not an audit ledger, and
`/studio/activity` already keeps the long record.

**Deliberately not inside `PublishBar`.** That bar renders nothing when there is nothing staged,
which is exactly the moment history is wanted: you published something wrong, so there is no draft
and no bar. Putting it there would have hidden the feature behind the one state where it is useless.
It lives in the page header instead.

### Added: the product form is five tabs
Twelve stacked sections were the longest scroll in the Studio. They are now **General · Images ·
Customization · Details · SEO**.

Two things had to be right for tabs to be an improvement rather than a hiding place:

- **Nothing unmounts.** Radix drops inactive content by default, and these panels hold registered
  form fields, an upload in flight and a rich-text editor instance — losing those on a tab change
  would be worse than the scroll. Every panel is `forceMount`ed.
- **An error cannot hide behind a tab.** Submitting with a bad SEO title while General is showing
  would otherwise refuse to submit with nothing on screen to explain why — the classic way tabbed
  forms strand people. Each tab declares the fields it owns; a refused submit switches to the first
  tab holding an error, and every errored tab is marked in the strip.

### The bug in the first version, caught by measuring
`forceMount` alone produced tabs that **did not hide anything**. Radix computes presence as
`forceMount || isSelected` and then sets `hidden: !present` — so forcing the mount also forces
`hidden` to false, and all five panels rendered at once. The strip would have shipped as decoration
over a form that still scrolled as one column, which is worse than no tabs because it claims to have
hidden something. `TabsContent` now carries `data-[state=inactive]:hidden`, which is inert without
`forceMount` and load-bearing with it. Counting visible panels in the browser is what found it —
the screenshot alone looked plausible.

Measured after the fix: 13 panels mounted (5 product + 8 translation locales), **0 inactive panels
visible**, and **15 inputs still mounted inside inactive panels** — so the hiding is visual only and
no field was thrown away. An empty submit activates General and marks it.

### Added: the media library reaches the rich-text editor
The image button asked for a URL — including for images already in the owner's own library. The
round trip was: leave the post, open Media Library, copy a URL, come back, paste. Doing that for a
file that is already there is also how duplicate uploads get made.

`MediaPicker` gained an optional `trigger`, so a caller that already has a button can supply it
(the picker keeps its own dialog state; the trigger goes in rather than the state coming out). The
five existing consumers are untouched.

The toolbar now carries **both**, because they are different jobs: pick from the library, or paste an
address for an image that genuinely lives elsewhere.

### Fixed: seven forms silently discarded the owner's edits
`useUnsavedChangesGuard` warned on `beforeunload` ONLY, and said so in its own header: "no in-app
navigation interception". That is the half that almost never fires. An owner editing a product does
not close the tab — they click **Products** in the sidebar, or a breadcrumb, or the logo. Every one
of those is an in-app navigation, and every one of them threw the edit away with no warning of any
kind. Seven forms carried this: blog, custom pages, portfolio, settings, SEO, products, pages.

The guard now also intercepts in-app navigation. Next's App Router has no `router.events` to
subscribe to and `next/link` navigates on click, so the interception is a capture-phase listener on
the document — catching the click before it reaches the link. Browser Back is covered via `popstate`.
(Corrected 2026-09-07: it was not — Next's own `popstate` listener unmounts the form first; the dead
handler is removed and Back is recorded as open. See the Phase 11 sixth-batch entry.)

What it deliberately does NOT intercept, because each is the owner asking for something else:
modified clicks (⌘/ctrl/shift/alt, middle button — those open a new tab and leave the form alone),
`target="_blank"`, `download`, non-http protocols, other origins, same-page fragments, and anything
inside `[data-unsaved-allow]` (the opt-out for a form's own Cancel link, which means to discard).

The confirmation is a real dialog mounted once in the dashboard layout, talking to the hook through
a module store — the same shape the drawer and the ⌘K palette already use, and necessary for the
same reason: the dialog has to OUTLIVE the form it is asking about.

### Changed: the three `window.prompt` calls are dialogs
The rich-text editor's link and image buttons, and "name this view". The browser prompt is
suppressible (a browser that decides a tab shows too many dialogs discards the call and returns
`null`, indistinguishable from Cancel — the action then silently does nothing), cannot validate, and
steals focus out of the editor in a way that loses the selection the link was meant to wrap.

### A false claim caught before it shipped
The first draft of this work asserted, in a code comment and nearly in the PR body, that the link
button "handed `javascript:` straight to `setLink`" — i.e. that this change closed an injection hole.
**It did not.** `@tiptap/extension-link` 3.27.1 carries `isAllowedUri` and refuses disallowed
protocols on its own. The URL check here is defence in depth and, mainly, FEEDBACK: the old prompt
accepted anything and said nothing, so a mistyped URL was silently dropped by tiptap and the owner
was left wondering why the button had not worked. Checking the dependency before describing the
change is what caught it.

### Verified rather than assumed
Driven against a production build:
- **Clean form** → clicking a sidebar link navigates normally (no false positive).
- **Dirty form** → click intercepted, URL unchanged at `/studio/settings`, dialog shown.
- **"Stay and keep editing"** → stays. **"Discard and leave"** → lands on `/studio/categories`.
- Both prompt dialogs open with **no native `window.prompt` firing at any point**; an empty view name
  is blocked ("Give the view a name."), and `javascript:alert(1)` is rejected with "Only http and
  https links are allowed." while the dialog stays open.

---

## Transformation Phase 10 — the pinned first columns (2026-09-03, sixth batch)

The last open item of the phase, and the one that needed a prerequisite before it could work at all.

### The prerequisite
`StudioRow`'s hover and selected tints were `bg-foreground/3` and `/5` — TRANSLUCENT washes. On a
card that reads identically to an opaque colour, so it cost nothing until a column needed pinning: a
sticky cell inherits its row's background, and a translucent one lets the columns scrolling
underneath show straight through it. Both tints are now the same 3% and 5% mixed against the card up
front — the same colour, and a cell that actually covers what passes beneath it.

### What is pinned
The first three columns of the two genuinely wide tables — products (checkbox · thumbnail · title)
and commissions (checkbox · reference · customer) — below `xl` only, which is exactly where those
tables scroll horizontally. At `xl` they drop their `min-w` and there is nothing to pin against.

### Two offsets that had to be measured, not calculated
Sticky columns need each one's inline-start offset, and both tables lied about their widths:

- **Products' thumbnail cell declared `w-14` (56px) and rendered 60px** — a 48px image plus `pe-3`.
  The title pinned 4px adrift until the declared width was corrected to match.
- **Commissions' reference column had no width at all.** It is content-sized, so the customer
  column's offset would have shifted the first time a reference number gained a digit. It is now
  `w-20`, which makes the offset arithmetic instead of a guess.

### Verified
Measured on a production build at 1024px, scrolling each table's wrapper horizontally:

| table | pinned offsets | held on scroll | first unpinned column | cells opaque |
|---|---|---|---|---|
| products | 0 · 40 · 100 px | 289 / 329 / 389 unchanged | 543 → 243 | yes |
| commissions | 0 · 40 · 120 px | 289 / 329 / 409 unchanged | 582 → 442 | yes |

`studio-audit.mjs` clean across 30 routes at 1440, 1024, 768 and 390.

### One item closed by looking rather than building
**Row-enter for appended activity rows (shortlist 15) is not applicable as written.** `ActivityPanel`
is a pure server component — no state, no effect, no polling, no stream — and the only client
component near `/studio/activity` is its filter. No row is ever *appended*: the panel re-renders
whole on navigation or revalidation. An entrance animation would have no trigger to attach to and
would instead replay across the entire list on every visit to the dashboard, which is exactly the
decorative motion Part 14 rejects. It becomes real if the panel ever gains live updates.

**A near-miss worth recording.** The commissions table does not render locally or in CI — neither
database has an inquiry seed — so the first attempt to verify it silently re-measured PRODUCTS: the
`sed` meant to repoint the probe did not match its own template literal, and the numbers came back
byte-identical to the previous run. That identity is what gave it away. Three local fixture rows were
inserted to measure against and deleted afterwards; nothing was seeded into the repo.

---

## Transformation Phase 10 — the Tabs primitive and the auth-tree boundary (2026-09-03, fifth batch)

### Added
- **`ui/tabs.tsx`** — the Studio's tab primitive on Radix, separate from `storefront/tabs.tsx` because
  that one is the storefront vocabulary and this one reads the `.studio-v2` scope; sharing would mean
  one of them rendering in the other's palette. Two variants: `pill` (the language strip) and
  `underline` (the default bar the Phase 11 editor tabs will use).
- **An error boundary for the /studio AUTH tree.** `login`, `signup`, `forgot-password` and
  `reset-password` sit directly under `src/app/studio/`, **not** inside `(dashboard)` — so the
  boundary fixed earlier today never covered them. A failure while signing in bubbled to the global
  boundary and answered in the storefront's dark public voice: staff trying to get in were told
  "this piece isn't here", with a WhatsApp button. Same contract as the dashboard's, digest included.

### Fixed — the language strip was announcing a pattern it did not implement
`translations-section.tsx` hand-rolled `role="tablist"` and `role="tab"` and then broke the contract
in two ways that a screen-reader user meets immediately:

- **No `aria-controls`, and the panel had no `role="tabpanel"`.** The relationship was announced and
  then not wired to anything.
- **No roving `tabindex`.** All **eight** locale buttons were separate tab stops, so getting past the
  strip to the fields took eight presses of Tab, and the Left/Right arrows the pattern promises did
  nothing at all.

### Verified rather than assumed
The conversion moves nine locales' worth of translation data, so it was driven rather than trusted:

- **Tab stops inside the strip: 8 → 1.** One press enters it, the next lands in the panel.
- **Arrow keys move focus and selection** together; `aria-controls`, `role="tabpanel"` and
  `aria-labelledby` are all wired by Radix.
- **The data binding survived**, which was the actual risk: typing into one language leaves the other
  language's field empty, and the value is still there on return. Writes now take the panel's own
  locale as an argument rather than closing over `active`.

### A measurement trap worth naming twice
The first pass at verifying this read `tabindex` off the DOM straight after `networkidle` and
concluded the roving focus was broken — every trigger read `-1`. It was measuring before Radix had
hydrated. This is the **same trap that broke `main` in #37**, where the keyboard gate drove keys
before the page was interactive. Pressing an actual Tab, rather than reading an attribute, is what
settled it.

---

## Transformation Phase 10 — tiles, skeletons and palette verbs (2026-09-03, fourth batch)

### Added
- **Five dashboard tiles: testimonials, portfolio pieces, media files, scraped records, import runs.**
  Each has a screen in the sidebar and reported nothing on the Overview, so "is there anything in the
  portfolio yet?" could only be answered by navigating there. Counts, not judgements — an empty
  surface reads 0 rather than being hidden, because 0 is the answer.
- **Twelve per-route `loading.tsx` skeletons** at final dimensions, composed from a new
  `studio/skeleton.tsx`: the header footprint, a filter bar, a table at real row height, a media
  grid. Flat, never a shimmer — a pulse says "still waiting", which the shape already says. The
  point of a skeleton is that nothing MOVES when the data lands; a generic stack of grey bars that
  then reflows into a table is worse than a blank frame, because it promises a layout and breaks it.
- **A `Do` group in the ⌘K palette** — create a product, write a journal post, add a portfolio piece,
  run the scraper, import from the sheet, bulk import, upload media. They carry `keywords`, so typing
  "add" finds "Create a product", which the label alone does not contain.
  The verbs **navigate, they do not execute**: "Run the scraper" opens the sources screen where the
  run button and its confirmation live. Firing a scrape from a fuzzy-matched keystroke would be a
  side effect nobody asked for twice.

### Fixed
- **The palette claimed "Nothing matches." while it was still looking.** Two characters start a
  debounced product search; until it returned, the empty state asserted an answer the palette did not
  have, so a wrong result flashed before the right one. It now says "Searching products…" while the
  results in hand belong to an older query. Flat, no spinner — the wait is ~180 ms plus a query.

### What measuring changed about the sticky-header item
The roadmap asks for a sticky header row on wide tables. Driving it in a browser found the work
mostly done and the remaining half blocked on something else:

- Only **2 of 21** studio tables carry a `min-w` — products and inquiries. Those are the wide ones,
  and both already go `xl:sticky`. Confirmed working: at 1440 the products `<thead>` pins at 64 px
  under the topbar while the page scrolls past it.
- The other 19 sit in `overflow-x-auto` wrappers, which compute `overflow-y: auto` and become their
  own scroll container. Sticky inside one of those has nothing to stick against, so adding it would
  be a **silent no-op**. Products only works because `xl:overflow-x-visible` hands the sticky back to
  the page.
- **The pinned first column is genuinely not done, and it needs one thing first.** `StudioRow`'s
  hover and selected tints are semi-transparent, so a pinned cell would let the scrolled-under
  content show through it. Doing it properly means giving the row an opaque composite
  (`color-mix` against the card) so a pinned cell can inherit it. Left for its own change rather
  than half-built.

---

## Transformation Phase 10 — the Studio drift sweep (2026-09-03, third batch)

108 substitutions across 42 files: `shadow-sm` → `shadow-e1`, and the card radii onto the
architectural scale. Held back from the previous two batches on purpose — it is a visible restyle,
not a rename, and it wanted measuring before and after rather than a source-grep count.

### What the grep said vs what the browser said
The source grep counted 63 `rounded-xl`/`rounded-2xl` occurrences and implied a sweeping change.
Measuring the RENDERED Studio across all 30 routes found the real scope, and it was different in kind:

- **51 elements at 16px.** `rounded-2xl` is not in this repo's `@theme` at all, so it fell through to
  Tailwind's stock `1rem` — genuinely off-system, on a scale whose largest step is 8px.
- **24 elements at 8px.** `rounded-xl` maps to `--r-lg`, which is exactly `rounded-modal`'s value. On
  a card that is the wrong *name* for the right number.
- **Everything else was already on 2px/4px.** The panel had drifted in specific places, not all over.

### The split this produced
A floating surface is modal-class in this system, so `dropdown-menu.tsx`, `select.tsx` and
`dialog.tsx` went to `rounded-modal` — the same 8px they already rendered, so **zero pixels move**
while the intent stops being an accident. That also leaves `select.tsx` alone visually, which
matters: it is the one `ui/` file the storefront renders too, through `order-panel.tsx`. Everything
else — cards, panels, wells — went to `rounded-card`.

### Verified
- Off-token radii across 30 routes: **51 + 24 → 0**.
- Non-`e1` shadows: **69 → 4**, and all four are `shadow-e2` on the sticky save/bulk-action bar —
  the Studio's sanctioned shadow exception, correctly untouched.
- `studio-audit.mjs` clean at 1440, 768 and 390 px; before/after screenshots on five routes.
- Nothing outside `src/components/studio`, `src/app/studio` and `src/components/ui` was touched.

---

## Transformation Phase 10 — the tablet rail, badge tones and the toaster (2026-09-03, second batch)

### Added
- **The Studio has a sidebar between 640 and 1024 px.** It was `lg:flex` alone, so a tablet — the
  device an owner actually reviews commissions on — got the PHONE chrome: no persistent nav, every
  navigation a drawer open. From 640 px the sidebar is now an 80 px icon rail carrying the same nav
  with its labels dropped (each link already had a `title`), and the topbar comes with it, so search,
  notifications and profile arrive at the same breakpoint. The full 256 px panel still starts at
  1024 px. The owner's collapse toggle is scoped to `lg` and up — below that there is no room for
  the panel, so there is nothing to collapse.
- **`success`, `warning` and `alert` Badge variants.** Eight call sites hand-rolled these as
  `variant="outline"` plus `border-<tone>/40 text-<tone>` — and had drifted: the same "this is fine"
  green was `/40` in the scraper and `/50` on the commission board, so two screens an owner moves
  between all day drew the same state at two different weights.

### Fixed
- **Every toast in the Studio came out in a colour the design system does not contain.** Sonner's
  `richColors` paints its own palette — success is a hardcoded `hsl(143, 85%, 96%)`, nowhere near
  this repo's `--success` (`#2c6b5b`). The flag stays on, because it is what gives success, error and
  warning distinct treatments at all; its CSS variables are repointed at the tokens instead.

### The bug this caught in its own first draft
The first version repointed them at `var(--card)` and `var(--foreground)` — the shadcn aliases. Those
do not exist in this repo: the `.studio-v2` scope's names are `--surface`, `--text` and `--border`.
An undefined custom property makes the whole `color-mix()` **invalid at computed-value time and the
declaration is dropped silently**, so the toasts came out with the right text colour and a fully
transparent background, which looks close enough to correct to ship. It was caught only by measuring
`getComputedStyle` on a real rendered toast — `background: rgba(0, 0, 0, 0)`. Sonner portals its list
to `document.body` and `.studio-v2` sits on `<html>`, so the scope does reach it; the names were
simply wrong.

### Verified rather than assumed
- The rail measured at five widths on a production build: 390 (mobile bar, sidebar hidden), 640 and
  768 (rail 80 px, `margin-inline-start: 80px`, labels hidden), 1024 and 1440 (panel 256 px, labels
  shown). No horizontal page overflow at any of them.
- Toast colours measured on real toasts fired from a scratch-build probe route: success text
  `rgb(44, 107, 91)` = `--success`, error `rgb(155, 58, 46)` = `--alert`, warning `rgb(138, 106, 30)`
  = `--warning`, each on its own 8% tint with a 40% border. The probe route was deleted before the
  commit and is absent from the final build.
- `studio-audit.mjs` clean across 30 routes at 1440, 768, 640 and 390 px.

---

## Transformation Phase 10 — the Studio's three route boundaries (2026-09-03)

The first slice of Phase 10. All three boundaries already existed; each was wrong in a way no gate
could see, because `studio-audit.mjs` sweeps 30 routes and none of them is an error.

### Added
- **The Studio error boundary now SHOWS its reference code.** Next puts a `digest` on every
  production error, and this boundary logged it to the console — where the owner, who is not holding
  devtools open, never saw it. "The products page broke" was the whole bug report, and nothing tied
  it to a server log. The digest is now on screen, in mono under a hairline, selectable. The
  `console.error` stays for whoever does have devtools open.

### Changed
- **The loading skeleton is flat.** It carried `animate-pulse`; the roadmap asks for flat, no
  shimmer, and Part 14 rejects motion that is decoration. A pulse says "still waiting", which the
  placeholder shape already says.
- All three files onto the tokens: `rounded-2xl`/`rounded-xl` → `rounded-card`, `shadow-sm` →
  `shadow-e1`.

### Verified rather than assumed
The audit cannot reach these routes, so they were driven directly against a production build:
- `not-found` — reached via `/studio/products/<bad-id>` and `/studio/blog/<bad-id>`. Computed style
  `border-radius: 4px`, `box-shadow: rgba(8, 10, 14, 0.06) 0px 1px 2px` — the tokens, resolved.
- `error` — reached by building a throwing route into a scratch build, since a digest only exists
  for a real server error. Rendered `Reference 650846091` in JetBrains Mono, inside the admin chrome
  rather than the public dark error page. The probe route was deleted before the commit and is
  absent from the final build.

### Deliberately NOT done
- **The rest of the Phase 10 drift sweep.** `shadow-sm` is on 47 more sites and `rounded-xl`/
  `rounded-2xl` on 63; the radius half takes the Studio from 12–16 px to 4 px, which is a visible
  restyle of every card in the panel, not a token rename. It wants its own PR with screenshots, not
  a footnote to a three-file change.
- Tablet sidebar, command-palette verbs, Sonner/badge/Tabs, sticky table headers and the dashboard
  tiles remain open; the design lab is still gated on D17 and the demo-products tile on D8.

---

## Transformation Phase 16 — the overlays' keyboard contract (2026-09-03, second batch)

### Added
- **`scripts/keyboard-audit.mjs`**, mounted in CI at both widths. Axe cannot press a key, so the one
  thing an overlay must get right — open by keyboard, take focus if it is modal, close on Escape, hand
  focus back to its trigger — was checked by nobody. A drawer that opens but strands focus behind it
  passed every gate this repo had.
- Two `data-slot` hooks (`sf-search-trigger`, `sf-mega-trigger`) in the same contract idiom
  `e2e-smoke.mjs` already relies on, because those two triggers had no stable selector.

### The result: the overlays were already correct
Nothing needed fixing. What the exercise produced instead was three corrections to the CHECK, each
found by investigating a failure rather than reporting it:

- **The mega menu is `role="region"`, not a dialog.** The first version asserted the modal rule against
  it and flagged a defect that was not there. A disclosure that opens on focus must NOT pull focus in —
  doing so would trap anyone merely tabbing past the Shop link.
- **Its contents are the seventh tab stop, not the first**, because the panel renders after the header
  row. That is DOM order matching visual order. Requiring one press reported a second phantom defect;
  the check now asserts reachability within a bound.
- **Driving all three overlays on one page load was flaky** — one run in four — because the previous
  overlay's Escape leaves focus restoration in flight. Each overlay now gets a fresh load. The drawer,
  suspected on that evidence, settles focus on "Close menu" 8 times out of 8 when measured properly.

Proven to bite: replacing Escape with a key that does not dismiss turns the run red with three
failures; restoring it goes green.

### Not covered, and stated rather than left to be inferred
The portfolio/product lightbox. It lives on detail routes CI does not sweep, because their slugs are
content rather than code. Roadmap Phase 17 gives CI deterministic detail slugs; the lightbox joins this
file then.

## Transformation Phase 16 — SEO and the widths the repo holds itself to (2026-09-03, first batch)

Four items were scoped. Two needed no code, which was established by reading the emitted HTML rather
than by trusting the plan.

### Fixed
- **The breadcrumb JSON-LD was hardcoded English on a nine-locale site.** `blog/[slug]`,
  `portfolio/[slug]` and `large-resin-art` emitted `name: "Home"` / `"Blog"` / `"Portfolio"` while the
  visible breadcrumb three lines away rendered `tCommon("home")` and `tNav("blog")`. Structured data is
  meant to describe what the page shows, so every non-English page was telling search engines something
  its own markup contradicted. Verified on the built server: `/de` now emits `"Startseite"`, `/ar`
  emits `"الرئيسية"`. `shop/[category]` and `product/[slug]` already used `crumb.label`.

### Changed
- **CI sweeps the widths the repo holds itself to.** `CLAUDE.md`'s definition of done says "works at
  360px and 1280px"; CI swept 1440 and 390 — neither of them. All four now run, each measured clean
  over the 13 routes before being added.
- **Tap targets are measured and reported, not failed** — see below for why.

### Found: the storefront is under its own 44px tap floor
The roadmap asks for a touch-target rule. It cannot fail the build, because the shared chrome does not
pass it at 390px — consistently 8–10 elements per route:

| Element | Rendered | Floor |
|---|---|---|
| `sf-button` (default) | 40px tall | 44 |
| Footer links | 39px tall | 44 |
| Announcement-bar link | 32px tall | 44 |
| Locale switcher | 34–39px wide | 44 |
| Shop tabs | 22–38px wide | 44 |

Raising them is a design-system change across shared components and belongs to the owner, so the rule
reports at NOTE. Its exemptions are the reviewable part: inline links in running text (WCAG 2.2 exempts
them), hit areas expanded by an `after:-inset-*` pseudo-element (14 in this repo, invisible to
`getBoundingClientRect`), the `aria-hidden` / `tabIndex={-1}` spam honeypots, the `sr-only` skip link
(1×1 until focused), and the Studio.

### Not done, because it is already right
- **"Twitter block per detail page"** — Next already derives `twitter:title`, `twitter:description` and
  `twitter:image` from each page's own metadata. Confirmed in the emitted head.
- **"Localised `og:url`"** — its absence is deliberate and documented (`shared-metadata.ts`, A3-002): a
  config-level `og:url` would default to the homepage and misattribute every non-root share, and
  scrapers fall back to the fetched URL when it is absent. `rel=canonical` already carries the correct
  localised URL. Adding it would mean spreading the shared `openGraph` across 19 pages to dodge the
  wholesale-replace trap that same file documents — real risk, no gain.

### Still open in Phase 16
Keyboard-path checks for the drawer, search, mega menu and lightbox; a refreshed Lighthouse baseline.
Review schema waits on Phase 9. CSP remains its own owner decision.

## Corrections from the verification sweep (2026-09-03)

The adversarial sweep behind the gated decisions was killed mid-run by a container restart, so that
work shipped on mechanical analysis alone. The sweep was resumed and finished — 38 agents, no errors —
and it disagreed with that analysis four times. It was right every time, and its completeness critic
then found a fifth thing both of us had missed.

### Fixed
- **`hero-parallax.tsx` restored.** It has no importers, but the audit files it under §3.2 REFINE with
  a named destination (px-cap the translation, mount it on the bespoke band; roadmap Phase 1b and
  Phase 3, motion shortlist 9). Unimported is not unwanted. Its deletion had already reached `main`.
- **`fetch-media-v3.yml` and `fetch-media-v3-video.yml` deleted after all.** Each says in its own
  header it is safe to delete once the masters are committed, and both conditions hold. The audit's
  "six workflows" was right; the correction to four was wrong. `fetch-tiers.yml` still stays.
- **D22 barrier 2 is an empty-table test**, not a `case-` slug prefix: owner slugs come from
  `slugify(title)`, so an entry titled "Case study — …" would have been read as the seed's own. Also
  on `main` before this.
- **The seed is create-only.** Barrier 2 made the upsert's update half unreachable, and that half was
  the dangerous one — `images: { deleteMany: {} }` plus a forced `PUBLISHED`. Dead code that destroys
  data is deleted, not left behind the guard.
- **A dead `tier: true` select** left by D23, and two docs calling the manual affordance "Add to
  Sheet" when it is labelled "Sync to Sheet".

### Performance — the measurable payoff of D18
D18 deleted `kinetic-heading.tsx`, the only consumer of GSAP's `SplitText`, but `lib/gsap.ts` kept
importing and registering the plugin — 3.6 KB gzipped of dead weight inside the shared chunk every
motion route loads, and inside the chunk the CI gate weighs.

**Motion JS: 51.1 KB → 48.2 KB gzipped.** The gate's ceiling ratchets 52 KB → 49 KB in the same
commit, per its own rule. Its header no longer claims the whole remaining gap is "not a hygiene call"
— part of it was. The rest still needs D10: 3.2 KB more means giving up ScrollTrigger or Lenis.

Four further orphans went with it: the `--z-preloader` / `--z-cursor` ladder rungs, the
`--animate-gild-fill` keyframes and `@utility gild-fill-text` (the preloader's wordmark sweep), and
the `gild-fill` entry in the tailwind-merge group. `(v2)/layout.tsx` also still promised "the
components still exist — remounting either is one line", which is the exact ambiguity D18 was
approved to remove; CLAUDE.md was updated in that commit, the layout was not.

### Raised, not acted on
- **`src/lib/flourish.ts`** is dead — `git log --all -S splitFlourish` finds only the baseline import,
  so it has never had a call site here. It is not on D18's approved exact-path list, and an approval
  of a list is not a criterion to re-apply. Recorded as a D18 addendum in the audit.
- **Three live `.claude/` skills still point agents at `DESIGN.md`**, now bannered ARCHIVED.
  Pre-existing; re-pointing them is a content rewrite, since DESIGN.md's Part 0 / A2 / A5 / B2 / B4
  have no counterpart in REDESIGN.md's numbering.

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
