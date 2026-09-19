# Final report — craft master prompt execution

_2026-09-19. Against the CRAFT master prompt (content + visual + CMS +
research + asset management for the public site and Studio). Worked as a
sequence of reviewed PRs (#117–#120 and this one), every claim measured
against production rather than inferred._

## Root Cause

Why previously generated content was not visible — two distinct causes,
only one of which was a problem:

1. **Demo content: absent by design.** The 754 demo fixture rows live in the
   repository and seed preview/dev/CI databases. The production host guard
   (`describeDemoHost`) has refused every write to `db.prisma.io/postgres`
   since deploy — Content Lab's zeros are the guard working, not content
   being lost. The owner's "show demo on live" switch was on but had nothing
   to reveal.
2. **Genuine starter content: the pipeline existed, the content did not.**
   `prisma/fixtures/starter/*.json` were three empty arrays. The additive
   seeder, the Studio Content Health screen and the documentation scaffolding
   were all built; the FAQs, concept studies and research records had simply
   never been authored. **This was the real gap, and it is now closed.**

One QA finding was filed and then withdrawn on browser verification: the
portfolio public index initially appeared to render its empty state — a
fetch artifact. The index renders all 20 cases across two pages with
working category filters. No defect exists (see PAGE-CONTENT-AUDIT.md
Finding 1 for the correction).

## Existing Content Found

Measured on production before any of this work:

| Content | Count |
| --- | ---: |
| Products (published) | 1,083 (1,063 listed publicly) |
| Journal articles (published) | 55 |
| Portfolio cases (published) | 20 — all small-format |
| FAQs (published) | 6 |
| Testimonials | 0 (correct — permission gate) |
| Demo rows in production | 0 |
| Demo fixture rows in repo | 754 (18 files) |
| Media files | 2,854 |
| Research records | 0 |
| Google Drive assets | 2 logos · 37 curated assets · 45+2 concept images · ~101+ historical images · 26 historical videos |

## Production Content Added

**92 rows, all additive, zero updates, zero deletions** (applied via Studio →
Content Health, "Added 92 items. 0 already present and left alone."):

- **42 FAQs — PUBLISHED** (orders 7–48, after the owner's six), grounded in
  the six live answers and the studio's own journal; seven coverage areas
- **8 concept studies — DRAFT**, each labelled three ways (title, story,
  `resultsMeta.kind = "concept-study"`); never public until the owner
  publishes with real photography
- **42 research records — internal only** (`status: RESEARCH`), real desk
  research with real URLs across furniture, preservation, gifting, corporate,
  3D printing and collectible design

## Existing Google Drive Assets Reused

- The complete 37-file `assets/` set (14 visuals × PNG+JPG, 2 video loops ×
  3 formats + posters, OG card) — already wired into site-image slots and
  site-videos; verified, not replaced
- The 45 approved concept images (35 heroes + 10 scenes) — already ingested
  as `.webp` under the placeholder honesty rule; 14 of the 16 concept-study
  image specs reference them instead of requesting new generation
- The 2 owner-supplied logos — untouched, per rule 38

## New Assets Required

| Type | Count | What |
| --- | ---: | --- |
| Image | 16 specs | Concept-study imagery: 14 reuse existing approved Drive assets (owner confirms colour fit at publish); **2 need generation** (forest-green side table hero + scene, champagne console hero + alternate) with complete handoff prompts embedded in the fixture |
| Video | 0 | No new video required |
| Icon | 0 | `lucide-react` covers UI icons (rule 53) |
| Vector | 0 | None required |

Longer-term (recorded, not blocking): real product photography replacing
concept imagery piece by piece (`NEED REPLACEMENT` rows in the asset map).

## Asset Prompts Created

Two complete multi-AI handoff prompts (page, section, reason, exact prompt,
ratio, filename, alt text) inside `prisma/fixtures/starter/concepts.json`:

1. `concept-forest-green-side-table` — hero 4:5 + in-room 16:9
2. `concept-champagne-resin-console` — hero 4:5 + alternate 4:5

All other concept imagery reuses approved Drive assets (prompt intentionally
empty = reuse, per the portfolio visual rule).

## FAQs

Published: **48** (6 owner originals + 42 starter library)
Review: 0
Demo: 0 in production (30 demo fixtures remain repo-only, by design)

## Journal

Published: **55** (untouched — healthy)
Draft: 0
Demo: 0 in production (30 demo fixtures repo-only)

## Portfolio

Genuine: **20 published** (untouched)
Concept: **8 draft concept studies**, labelled, awaiting photography + owner publish
Demo: 0 in production

## Testimonials

Verified: 0 · Pending: 0 · Demo: 0 in production
**Deliberately unchanged.** Publishing requires real customer words with
`permissionStatus: GRANTED`; nothing in this work invented, imported or
promoted a testimonial (rules 9–10, Phase 12).

## Research

Active: **42** (13 original + 29 added — furniture, preservation, gifting,
corporate, 3D printing, collectible design)
Stale: 0
Demo: 0 in production (30 demo fixtures repo-only)

## Inquiries

Real: **0** (pipeline empty but intact — no test inquiries were created
during QA; creating one would pollute the owner's lead inbox)
Demo: 0 in production (30 demo fixtures repo-only, covering all 9 statuses
for non-production pipeline QA)

## Demo Management

Confirmed — by architecture review, the passing test suite, and the Content
Lab screen (execution against production was unnecessary: 0 demo rows exist
there to delete):

- Manual row selection ✅ (`DemoManager` + `getDemoInventory`)
- Per-entity selection ✅ (`DemoSelection` in `src/lib/demo/selective.ts`)
- Remove All Demo Data ✅ (`removeDemoData` — refuses without the phrase)
- Typed confirmation `REMOVE DEMO DATA` ✅ (server-side, exact match)
- Server-side `isDemo === true` re-validation ✅ (rows flipped to genuine
  return PROTECTED, never deleted)
- Genuine data protected ✅ (every query filters `isDemo: true` only)
- Shared media protected ✅ (usage-checked; only demo relationships removed)

## Automatically Deleted Records

**0** — as required. Nothing in this engagement deleted anything, from
anything.

## Files Changed

| PR | Files |
| --- | --- |
| #117 | `docs/content/CONTENT-INVENTORY.md`, `GOOGLE-DRIVE-ASSET-MAP.md`, `OWNER-REVIEW.md` (new) |
| #118 | `prisma/fixtures/starter/faqs.json`, `concepts.json`, `research.json` (authored: 42+8+13) |
| #119 | `prisma/fixtures/starter/research.json` (13→42), `docs/content/COMPETITOR-RESEARCH.md` (new) |
| #120 | `docs/content/PAGE-CONTENT-AUDIT.md`, `DRIVE-HF-INDEX.md` (new), `GOOGLE-DRIVE-ASSET-MAP.md` (updated) |
| this | `docs/content/QA-CONTENT-REPORT.md`, `FINAL-REPORT.md` (new) |

## Database Changes

**No migrations, no schema changes** shipped in any of this work. The only
production database writes were the 92 additive starter rows created through
the existing Studio action (existing models, no DDL).

## Tests

Passed: **1,348** (122 files — `npm test` on main, 31.6 s)
Failed: **0**
Warnings: 0 test warnings (one informational npm `install-scripts` notice at
install time). `test:e2e` not run — CI job requiring app+DB, not a code
conclusion. Live QA findings are registered in `QA-CONTENT-REPORT.md`
(Q1 soft-404 — mitigated by design, Q2 media alt text).

## Owner Action Required

1. **Publish concept studies** after their imagery is confirmed (14 Drive
   reuses) or generated (2 prompts in the fixture) — Studio → Portfolio,
   they sit as labelled drafts.
2. ~~Q1 — soft 404~~ **Closed — mitigated by design (ENG-813)**: both
   not-found boundaries serve `noindex` (verified in live HTML), so the
   200-status panel never enters the index. The residual 200 is the accepted
   ISR trade-off and is now pinned by `not-found.test.ts`.
3. **Q2 — media alt text**: 2,854 library files lack alt text; an assisted
   alt-writing pass can be scheduled.
4. **`hf_` grading pass**: one afternoon over the two big sessions (08-28,
   09-04) using `DRIVE-HF-INDEX.md`.
5. **`demoContentPublic` switch** (Studio → Content Lab): currently ON with
   zero demo rows — harmless; switch off for tidiness if you prefer
   (OWNER-REVIEW.md §4).
6. Re-running `npm run seed:starter` in future is safe — it will report
   `0 to create · 92 already present`.
