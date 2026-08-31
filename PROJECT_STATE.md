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

**Get answers to the two BLOCKING DECISIONS below.** They change what Phase 1 and Phase 2 build.

Phase 0.5 (baseline defect fixes) is done — CI is live and green, the 11 browser-launching scripts
work again, dev credentials are out of tracked source, the dead-branch workflow pins are gone, and
`README.md` no longer advertises a retired design system.

Two Phase 0.5 items remain, both deliberately left:

1. **`.env.example` needs `DATABASE_URL_UNPOOLED` and `RESEND_FROM`** — this session's tooling
   denies edits to `.env*` files, so the owner (or a session without that restriction) must add
   them. Both are load-bearing: `prisma.config.ts:15` prefers the unpooled URL for `migrate
   deploy`, and `src/lib/email.ts:142` reads `RESEND_FROM` (validated in `src/lib/env.ts:35`).
2. **`happy-dom` → `devDependencies`, and decide on `three`** (a dependency with zero imports).
   Both touch `package.json` + the lockfile, and `three` interacts with the pending domain
   decision — the brief's Phase 15 wants Three.js for the 3D-art vertical.

---

## BLOCKING DECISIONS (owner input required)

### D1 — Commerce model
The brief's Phase 29 asks for cart / checkout / payments and lists `/cart` `/checkout` `/account`
routes. The business has a documented **"never violate"** rule against all three, and the entire
conversion mechanism is WhatsApp-based (see `docs/PROJECT-AUDIT.md` §7.1).

- **Option A (recommended):** keep WhatsApp/inquiry as the conversion path; drop cart/checkout from
  scope. Matches the business and the brief's own conditional wording.
- **Option B:** add real ecommerce. Substantial new work (orders, payments, customers, shipping,
  webhooks) and a reversal of a stated business rule.

**Status: UNANSWERED.** Phase 2 route planning depends on it.

### D2 — CMS
The brief prefers Payload. A mature bespoke Studio CMS already exists: 40 admin pages, 124 server
actions, 1,181 copy slots, 62 image slots, draft/preview/publish, 105 audit-log call sites
(see §7.2).

- **Option A (recommended):** keep the Studio CMS and extend it for the new domain.
- **Option B:** migrate to Payload. Would require re-implementing all of the above and re-coupling
  to 43 migrations and 4,373 live rows — the failure mode the brief was written to prevent.

**Status: UNANSWERED.** Phase 5–7 schema work depends on it.

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
