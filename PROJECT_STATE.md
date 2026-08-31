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
**Production launch fixes: COMPLETE** (blank env vars · trailing-slash URLs · wa.me number)

## CURRENT MILESTONE

**The site is LIVE at https://www.rivyalivingart.com** and correct: `/shop` serves the art
ecosystem (1,373 pieces, not the 4,373 mixed catalogue), the brand is Rivya Living Art throughout,
and no old-brand or old-domain strings remain in the served HTML.

Five PRs merged: Phase 0 (audit) · Phase 0.5 (baseline defects) · Phase 1 (rename) ·
Phase 2a (art-first shop) · production launch fixes.

**Phase 2c (imagery) is the next substantial work** and is now the largest open defect — see below.

---

## NEXT EXACT TASK

**Phase 2c — imagery. Blocked on GitHub Actions minutes, and NOT on generation.**

The site has no photography: `git ls-files public` returns **0**, 62 slots resolve to files that do
not exist, and every deploy logs `imported 0 site image(s)` with 25 `ENOENT`s.

**Do not regenerate the asset set.** Investigated 2026-08-31; everything needed already exists:

| Piece | State |
|---|---|
| 24 image prompts + 1 video prompt | in `docs/media-v3-manifest.json` |
| Candidate renders | generated, URLs recorded |
| Human cull | **done** — every asset carries a `keeper` (20 `a`, 4 `b`); video keeper `b` |
| Contact sheets the cull was made from | committed, `docs/media-v3-review/` (5 files) |
| LQIP blur manifest | committed, `src/lib/media-v3-blur.json`, **25 real entries** |
| The AVIF masters themselves | **missing** — never added in this git history |

The 25-entry LQIP manifest could only have come from a completed `masters` run, so the masters were
built in the original repo; the ZIP this repo was imported from was simply exported without
`public/`.

### The runbook — two workflow_dispatch runs, once Actions has minutes

1. `.github/workflows/fetch-media-v3.yml` → mode **`masters`**
   (skip `candidates`: the cull is already made). Writes the AVIFs into
   `public/media/v3/` and refreshes `src/lib/media-v3-blur.json`, then commits to the branch it
   runs on.
2. `.github/workflows/fetch-media-v3-video.yml` → mode **`masters`**.
   Writes `process-pour.mp4` + `.webm` and cuts the AVIF poster from frame 0 of that same clip —
   which is what keeps the poster matching the video.

Then redeploy and confirm the build logs no longer say `imported 0 site image(s)`.

**Why it must run on Actions and not in a session:** the Higgsfield CDN
(`d8j0ntlcm91z4.cloudfront.net`) answers **403 to a sandbox's egress policy** — re-verified
2026-08-31 by generating one image successfully and then failing to download it
(`CONNECT tunnel failed, response 403`). The agent-proxy README says to report such a denial, not
route around it. `fetch-media-v3.yml` exists precisely because a previous session hit this same
wall; its header documents it.

**If the recorded candidate URLs have expired** by the time Actions runs, the script fails loudly
(`if (!res.ok) throw`). Only then regenerate: the manifest holds every prompt, the model is
`nano_banana_pro` (served as `nano_banana_2`), generation costs **2 credits per image**, and the
account holds 679. Record fresh `jobId`/`url` per candidate and re-run mode `masters`.

**Two slots are permanently excluded from this set** (§15.2): `home.maker` / `about.maker` are the
maker, never AI — and `src/lib/site-images-import.test.ts` records that the file currently behind
them is itself a generation, which is the owner's to replace with a real photograph.

---

## AFTER IMAGERY — Phase 2b, commission-led copy (decision D5)

The storefront still describes the old proposition; the hero eyebrow reads
*"custom resin art · 3D printing · made to order"*. English first in `messages/en.json`, then
`node scripts/site-copy-registry.mjs` (a CI gate — `copy:check` fails when stale), then translate
the batch into all 8 locales with `scripts/i18n-missing.mjs` as the gate (currently 0 missing).

Scope by namespace rather than all at once — 1,181 leaf keys across 30 namespaces
(Shop 311, Homepage 151, Site chrome 120, Commission 114). Start with Homepage + site metadata.

Still open from earlier phases:
- **`.env.example`** omits `DATABASE_URL_UNPOOLED` and `RESEND_FROM`; `.env*` edits are denied in
  this environment, so the owner must add them.
- **`happy-dom` → `devDependencies`**, and decide on `three` (zero imports today).
- **Stale counts in `docs/studio-cms/`** still say 57 slots (actual 62). Those are plan documents,
  not current-state docs; CLAUDE.md is the authority and has been corrected.

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
