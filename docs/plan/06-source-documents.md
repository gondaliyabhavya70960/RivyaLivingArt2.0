# Source documents — what each one is, and which repository it describes

Five briefs were supplied on 2026-09-15. They do not agree, and **two of them
describe a different codebase**. This file records which is which, so a future
session does not spend a day looking for `lib/sheets/` in a repo that has never
had it.

| # | Document | Describes | Verdict |
|---|---|---|---|
| 1 | `RivyaLivingArt-Implementation-Plan.md` | **This repo** | **Authoritative.** Accurate on stack, scraper and Sheets surface. Folded in below. |
| 2 | `RivyaLivingArt-WorldClass-UI-Prompt.md` | **This repo** | Adopt, with one conflict resolved (§3). |
| 3 | `Rivya_Living_Art___World-Class_Website…Rebuild.md` | Repo-agnostic | Directive brief. Adopt the requirements; it asserts no false paths. |
| 4 | `RIVYA-REDESIGN-IMPLEMENTATION-PLAN.md` | ❌ **`RivyaLivingArt` (the older repo)** | Do not follow its paths. Salvage its principles (§4). |
| 5 | `RIVYA-WORLD-CLASS-UI-PROMPT.md` | ❌ **`RivyaLivingArt` (the older repo)** | Same. |

## 1. Why documents 4 and 5 point elsewhere

Document 4 states: *"Requested repository: …/RivyaLivingArt2.0.git — **does not
exist (GitHub 404)**"* and proceeds against `RivyaLivingArt` instead. The 404
was a **visibility artefact** — this repository was private when that review
ran. It exists, it is the production repo, and its Vercel project deploys from
it.

Every path those two documents give was tested against this tree:

```
ABSENT  lib/sheets                     ABSENT  supabase/migrations
ABSENT  app/(studio)                   ABSENT  app/api/cron/sheets-sync
ABSENT  components/studio/sheets       ABSENT  scripts/sheets
ABSENT  data/higgsfield                ABSENT  app/styles/tokens.css
ABSENT  docs/design/DESIGN_SYSTEM.md
```

They describe a **Supabase** application with `research_*` schema isolation,
seven-stage RAW→CONFIRMED staging, `app/(studio)/`, 106 `page.tsx` files and a
`data/higgsfield/asset-manifest.json`. This repository is **Prisma + Neon
Postgres**, `src/app/studio/` (52 routes), and `docs/media-v3-manifest.json`.
Two different products.

## 2. Findings folded in from document 1 — verified against this tree

| Claim | Status | Action |
|---|---|---|
| Scraper sends a **spoofed Chrome User-Agent** | ✅ **Verified** — `types.ts` defaulted to a Chrome string, its own comment citing bot-protection 403s | ✅ **Fixed** — see §5 |
| CSP carries a blanket `img-src … https:` | ✅ Verified — `next.config.ts:55`, commented as needed for the imported four-tier catalog | Tighten to Blob + known hosts once image mirroring is universal |
| Forced locale redirect, no consent | ✅ Verified — `src/i18n/routing.ts:23` `localeDetection: true` | Replace with a consent-based switcher (W3) |
| ResinRiva brand remnants | ✅ Verified — `src/ResinRivaFavicon.svg`, `src/ResinRivaLogo.svg` | Purge in the design-system PR |
| Product images hot-linked to Shopify CDN, 404ing in production | ⚠️ **Not yet verified** | Verify before scheduling; if true it outranks everything in workstream A |
| "Showing 24 of 1,000" browse cap | ⚠️ Not verified — no such constant found | Re-check against the live shop before acting |
| `exceljs` + `papaparse` already present | ✅ Verified | ✅ **Used** — the new export needs no package |
| Client-polling scrape loop | ✅ Verified — `use-scrape-runner.ts` polls `continueScrapeJob` | Cron drain, per `02-scraper-rebuild.md` §3 |

Document 1's removal checklist is more granular than
[`03-sheets-removal.md`](03-sheets-removal.md) and both agree on the critical
sequencing: **replacement first, removal second.** Where they differ, note that
document 1 lists `src/lib/sheet-status.ts` and `src/actions/sheet-fill.ts` for
deletion — `sheet-fill.ts` is the **CSV** fill's action module and must be
renamed, not deleted (`03` §2.2). Deleting it takes the catalogue importer with it.

## 3. Palette conflict (document 2)

Document 2 proposes obsidian `#0A0A0F`, gold `#C9A24B`, teal `#3FA7A0`.
The repo's actual tokens are obsidian `#080a0e`, champagne `#b89b63`,
sapphire `#164e6b` (`src/styles/tokens.css`).

**The repo tokens win.** They are the audited set: three AA companions
(`sapphire-ink`, `champagne-ink`, `whatsapp-deep`) exist precisely because the
base roles fail contrast as text, and the design audit measures them. The
proposed values are close enough to be the same intent recalled approximately;
adopting them would invalidate the contrast work without changing the look.

Document 2's `#3FA7A0` teal has **no counterpart** in the system. Adding a
chromatic role is a design-system decision (D25), not a token swap.

## 4. Principles worth salvaging from documents 4 and 5

Wrong repository, sound thinking. These transfer:

- **Competitor imagery is never downloaded, cached or re-hosted.** This repo
  stores scraped image *URLs*, which is consistent — but `catalog-mirror.ts`
  and `/api/cron/mirror-images` exist and mirror images to Blob. **Whether that
  path can reach competitor-sourced images is an open question that should be
  answered before the scraper work**, because document 1 proposes universal
  mirroring to fix 404s and the two positions collide.
- **Concept media is labelled, never presented as delivered work.** Already
  this repo's §15.2 rule; the same conclusion reached independently.
- **Cap public top-level navigation at four.** Matches the live header.
- **A component registry** recording source, licence, bundle delta, keyboard
  and reduced-motion behaviour for every adopted external component. Adopt —
  `docs/design/COMPONENT_REGISTRY.md`.
- **Do not seed named competitor domains into git.** Worth an explicit owner
  decision: this repo's `seed-data.ts` already carries ~108 seeded stores, so
  the horse may have left. Document 1 conversely proposes seeding 15 more.

## 5. Implemented in this change

**Confirmed-products export — the Sheets replacement.** All five documents make
this the precondition for removal. `src/lib/export/`:

- `confirmed.ts` — pure row shaping on the canonical machine-friendly keys
  (`internal_product_id`, `price_basis`, `confirmed_at`), with `PriceBasis` making
  the quote-only rule explicit: **a quote-only row exports empty price cells, never `0`.**
- `csv.ts` — generic CSV with RFC-4180 quoting and the formula-injection guard.
  `scraper/export.ts` now delegates to it rather than carrying a second copy.
- `workbook.ts` — XLSX via the existing `exceljs`. No new dependency.
- `GET /api/studio/export/confirmed?format=csv|xlsx` — the same query the Sheet
  push used (`where: { confirmedAt: { not: null } }`, newest first, staff
  permission), so it is a faithful replacement rather than a similar one.

**Honest crawler identity.** `SCRAPER_BOT_TOKEN` is now one constant that both
the User-Agent and `robots.ts`'s group matching derive from. The Chrome default
is gone. Its own comment had said it existed because *"many storefronts …403 an
identifying bot UA"* — that is a stealth mechanism, and the 403 is the site's
answer. Sources that refuse an honest crawler belong in `manual_research` mode.
`SCRAPER_USER_AGENT` still overrides, for a more specific contact address.

Tests: 23 new (`export/confirmed.test.ts`, `scraper/user-agent.test.ts`),
789 passing overall.

## 6. Not yet implemented

Everything else. The Sheets code is **still present and still working** — it
must stay until the owner has exported once from the new route and archived the
spreadsheet ([`03-sheets-removal.md`](03-sheets-removal.md) §4). The Studio
Export Center UI, the resin ontology, durable orchestration, the Drive asset
pipeline and both redesigns remain as planned, still gated on D25–D29.
