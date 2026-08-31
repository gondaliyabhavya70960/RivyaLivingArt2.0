# PROJECT_STATE.md

> **Read this file first, every session.** Then `CHANGELOG.md`, then `git status`, then
> `git log --oneline -15`. Resume at **NEXT EXACT TASK**. Never repeat a completed phase.

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

## CURRENT MILESTONE
Phase 0 and Phase 0.5 delivered and committed. CI now actually runs, and every gate was proven
green locally before it was enabled. **Phase 1 (rename) is blocked pending two owner decisions —
see BLOCKING DECISIONS below.**

---

## COMPLETED

- [x] ZIP located (`/root/.claude/uploads/.../8d2fb0f0-ResinRiva2.0.zip`; the brief's
      `/mnt/data/ResinRiva2.0-Main.zip` does not exist in this environment)
- [x] Extracted and imported **unmodified** into the repo as baseline commit `32f21a6`
- [x] Dependencies installed (`npm install --legacy-peer-deps`, exit 0)
- [x] **Original project verified working end to end** (see BUILD STATUS)
- [x] Local Postgres 16.13 + `pg_trgm` stood up; all **43 migrations** applied
- [x] `prisma/bootstrap.ts` run — **4,373** tier products + 12 owner-ready drafts = **4,385** rows
- [x] `npm run db:seed` run — 16 categories, 6 FAQs, 2 legal pages
- [x] Production build passed; server started; all 12 public routes return 200
- [x] Screenshots captured at 1440px and 390px
- [x] 8-subsystem forensic audit, each area adversarially verified against the files
- [x] Brand-reference census: **799 occurrences / 133 files**, classified by rename risk
- [x] `docs/PROJECT-AUDIT.md` written (485 lines)
- [x] `PROJECT_STATE.md` + `CHANGELOG.md` created

## IN PROGRESS

Nothing. Phase 0 is closed.

## NEXT EXACT TASK

**Phase 2b — commission-led copy (decision D5).** Phase 2a separated the catalogue; 2b makes the
language match.

The storefront still describes the old proposition — the hero eyebrow reads *"custom resin art ·
3D printing · made to order"* and the lede *"crafts bespoke resin art, personalized gifts and
3D-printed pieces"*. Under D5 the front door should lead with **bespoke commissions** for furniture
and large art, with the ready-made catalogue behind it.

Scope it by namespace rather than all at once — `messages/en.json` has 1,181 leaf keys across 30
namespaces (Shop 311, Homepage 151, Site chrome 120, Commission 114, Portfolio 74, Contact 67,
Workshops 65). Start with **Homepage + site metadata/SEO**, which is where the proposition is
stated.

Workflow, in this order — the registry step is a CI gate, not optional:
1. Edit `messages/en.json` (English first).
2. `node scripts/site-copy-registry.mjs` — regenerates `src/lib/site-copy.generated.ts`.
   `npm run copy:check` fails the build when it is stale.
3. Translate the batch into ar/de/es/fr/gu/hi/ja/zh; `node scripts/i18n-missing.mjs` is the gate
   (currently 0 missing — keep it there).

### Known traps for Phase 2b+ (found by the Phase 2 research, verified against the files)

- **`prisma/seed.ts` never reaches an existing database.** `bootstrap.ts:30` computes
  `alreadySeeded = category.count() > 0` and skips the seed when true. Categories that must reach
  a live database go in **`CANONICAL_CATEGORIES`** (`src/lib/catalog-taxonomy.ts`), which
  `import-tiers.ts:427-451` creates-if-absent on **every** deploy.
- **Adding a site-image slot breaks two tests and a CI gate** unless done fully: the alt key must
  go through `scripts/site-copy-registry.mjs`, and `src/lib/site-images.test.ts` hard-codes slot
  counts (`withAlt` 42, `wide` 13).
- **`public/` is empty — CONFIRMED IN PRODUCTION, not just inferred.** `git ls-files public` returns
  0, and the Vercel production build for `4083d4b` logs
  `bootstrap: imported 0 site image(s) into Blob; failed: <25 files>` with
  `ENOENT ... /vercel/path0/public/media/v3/*.avif` for every one. 60 slot references point into
  `/media/v3/`. **Every editorial image on the storefront resolves to a file that does not exist**,
  which is why local screenshots render blank image areas. The import is non-fatal (it logs and
  continues), so the build still succeeds — the site just has no photography.
  Pre-existing: the uploaded ZIP shipped with an empty `public/`. This is Phase 2c's work, and
  under decision D3 the fix is to generate NEW imagery for the new domain rather than to recover
  the old files. `docs/media-v3-manifest.json` holds the 24 prompts that produced the originals.

- **Vercel builds now COMPLETE — this is the project's working verification.** GitHub Actions still
  cannot allocate a runner (billing), so the design, a11y, studio and Lighthouse audits still run
  only in local runs. But Vercel runs the real production path on every push —
  `prisma migrate deploy` → `prisma/bootstrap.ts` → `next build` — against a live Neon database with
  per-branch preview databases, and as of `4b8aac7` it reports `Build Completed in /vercel/output`.
  That is the first completed build in this project's history.
  Read the logs with `mcp__Vercel__get_deployment_build_logs`; project
  `prj_rKg6aVuZNp7tTLpMwk8oQzseIArp`, team `team_y3P3E4bDmgC3FwXkpuWMzjft`.

  Two earlier env failures are resolved and should not be re-diagnosed:
  `Connection url is empty` (the production DB URL was unset — the owner set it), and
  `AUTH_SECRET is required` / `NEXT_PUBLIC_SITE_URL: Invalid URL`. The second was half owner action
  (`AUTH_SECRET`) and half a real code bug, fixed in `f1538ac`: a variable declared with **no value**
  arrives as `""`, which `.optional()` does not admit and `??` does not replace. `env.ts` strips
  blanks before parsing and `constants.ts` falls back on blank as well as absent — the latter
  mattered most, because a blank `NEXT_PUBLIC_WHATSAPP_NUMBER` would have emptied every `wa.me`
  link on a WhatsApp-only business with the build still passing.

- **Production env vars were missing and are now set.** The first production deploy (Phase 1 merge,
  `2382d02`) died at `Error: Connection url is empty` because the Vercel Production environment had
  none of `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING` / `DATABASE_URL`. Not a code
  regression — `prisma.config.ts` has only ever been touched by the baseline import. The next
  production deploy (`4083d4b`) connects and reports `database already seeded`, so the variables
  were added in between.
- **`src/lib/media.ts` is dead code** — zero importers, holds 8 of the Cloudinary URLs. Deleting it
  changes nothing that renders.
- **Categories do not nest.** `Category` has no `parentId`; grouping is presentation-only via
  `CATALOG_GROUPS` slug lists.
- **Doc drift:** CLAUDE.md says 57 image slots / 21 bundled files; the truth is 62 / 25. The same
  stale numbers appear in comments in `site-images-import.ts` and `actions/site-images.ts`.

Two items still open from Phase 0.5:
- **`.env.example`** needs `DATABASE_URL_UNPOOLED` and `RESEND_FROM` — `.env*` edits are denied in
  this environment, so the owner must add them.
- **`happy-dom` → `devDependencies`**, and decide on `three` (zero imports today).

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

---

## FILES CHANGED

Baseline commit `32f21a6` — 920 files imported unmodified, 1 file modified (`README.md` replaced by
the ZIP's own).
This commit — added `docs/PROJECT-AUDIT.md`, `PROJECT_STATE.md`, `CHANGELOG.md`. **No source file
has been modified yet.**

## DATABASE MIGRATIONS

43 existing migrations, **all applied successfully** to local Postgres 16.13.
History is **purely additive** — zero `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN` across all 43.
**No new migration written yet.**

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
- **Zero** coverage of API routes, server actions, React components, or database queries.
- E2E: `scripts/e2e-smoke.mjs` exists (not run this session — needs a running server + browser).
- **CI has never executed any of it** — see the `ci.yml` `Main` defect.

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

### BLOCKER — GitHub Actions cannot run on this repository
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
3. `happy-dom` in `dependencies`; `three` present with zero imports (open, deferred).
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
- 3D: `@google/model-viewer` only. `three` is unused.

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

`32f21a6` — *Import ResinRiva2.0 source as transformation baseline* (920 files, unmodified)
`54974ff` — *Phase 0: forensic audit of the imported baseline* (documentation only)
(this Phase 0.5 defect-fix commit follows)

## SAFE CONTINUATION POINT

**Phases 0 and 0.5 are complete and committed.** No application code has been modified — the
changes so far are workflows, previously-broken unwired scripts, and stale documentation.
The baseline is verified green and fully reproducible from `32f21a6`.

**CI is now live on `main`.** Every gate was run locally on the same commit before enabling it, so
a red CI from here is a real regression, not a pre-existing failure surfacing.

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
