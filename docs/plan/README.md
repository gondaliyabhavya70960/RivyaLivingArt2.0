# Rivya Living Art — redesign & rebuild plan

**Date:** 2026-09-14 · **Base:** `main` @ `b593f72` · **Branch:** `claude/peaceful-cannon-7dck80`

Four workstreams, one sequence:

| #   | Workstream                        | Doc                                                                |
| --- | --------------------------------- | ------------------------------------------------------------------ |
| A   | Storefront + Studio redesign      | [`01-redesign-main-and-studio.md`](01-redesign-main-and-studio.md) |
| B   | Product scraper rebuild           | [`02-scraper-rebuild.md`](02-scraper-rebuild.md)                   |
| C   | Google Sheets removal             | [`03-sheets-removal.md`](03-sheets-removal.md)                     |
| D   | Drive asset pipeline              | [`04-drive-asset-pipeline.md`](04-drive-asset-pipeline.md)         |
| —   | The UI build prompt (deliverable) | [`05-ui-generation-prompt.md`](05-ui-generation-prompt.md)         |
| —   | Source-document reconciliation    | [`06-source-documents.md`](06-source-documents.md)                 |

---

## What was reviewed

- **Repo** at `b593f72` — 639 TS/TSX files, 21 public storefront routes, 52 Studio routes,
  1,201-line Prisma schema, 9 locales, `public/` 22 MB committed.
- **https://rivyalivingart.com/** — fetched and read. A finished, shipping premium site.
- **https://rivyalivingart.com/studio** — staff login wall, as designed. The dashboard behind it
  was read from source, not from the live deployment (no credentials in this session).
- **Google Drive → "Higgsfield Originals"** — enumerated: 101+ PNG masters (~2.1 GB), 26 MP4,
  `Higgsfield_Prompts_250.csv`, and a `Rivya_All_Generated_Images` subfolder.
- **The attached rebuild prompt sequence** (`resin-art-merchandiser-rebuild-prompts_1.md`).

---

## Five findings that change the shape of the work

### 1. The storefront is already built — "redesign" has to be scoped before it can be planned

The live site renders eighteen composed sections (hero → the pour → manifesto → featured →
large-format → process → collections → maker → commissions → bespoke → workshops → 3D printing →
how it works → why → journal → footer), nine locales, WhatsApp ordering intact, and it is built to
`REDESIGN.md` v3 "Liquid Luxury" with a token system, two signature motion devices, and five CI
gates holding it in place.

This is not a site that needs designing. It is a site that needs a **decision about how far to move
it** — see D25 below. Everything in workstream A is conditional on that answer.

### 2. The Drive folder unblocks the entire media queue — by exact filename match

`CLAUDE.md` records 43 generated-but-unpromoted `plannedSets` rows whose renders exist only on the
Higgsfield CDN, which answers **403** to this environment's egress policy. The plan of record was
"run the script on a machine with ordinary internet."

The Drive folder makes that unnecessary. Its filenames are the CDN basenames verbatim
(`hf_<YYYYMMDD>_<HHMMSS>_<jobId>.png`). Matching the manifest's recorded candidate URLs against the
Drive listing:

| Batch                    | Manifest candidates | Present in Drive                                                             |
| ------------------------ | ------------------- | ---------------------------------------------------------------------------- |
| 20260823 (Batches A–C)   | 46                  | 8 — irrelevant, these 24 masters are **already built** in `public/media/v3/` |
| 20260826 (process video) | 2                   | 0 — already built                                                            |
| **20260904 (Batch D)**   | **56**              | **56** (50 PNG in `images/`, 6 MP4 in `videos/`)                             |
| **20260905 (Batch E)**   | **15**              | **15**                                                                       |

**71 of 71** outstanding candidates are present. Workstream D is now a wiring job, not a
regeneration job. See [`04`](04-drive-asset-pipeline.md).

### 3. Google Sheets removal is smaller and far safer than the docs imply

`CLAUDE.md` warns that "Sheet→catalog fill has run on every deploy since long before it was a
feature," which reads as though removing Sheets would sever catalog ingestion.

It would not. `src/lib/import/tier-fill.ts` — the 48 KB module that actually fills the catalog —
reads **committed CSV files** from `data/tiers/*.csv.gz` (15 MB, in the repo). It never calls the
Sheets API. Neither does `/studio/sheet-import`, despite its name.

The live Sheets API surface is the **write** direction only: `src/lib/scraper/sheets.ts` (a
hand-rolled service-account JWT client — there is no `googleapis` npm dependency to drop) and five
modules above it. Removal is bounded and catalog fill is untouched. See [`03`](03-sheets-removal.md).

### 4. The scraper is a sourcing pipeline; the attached doc specifies an intelligence platform

Today `ScrapedProduct` is catalog-shaped and flat: `materials` and `dimensions` are free-text
strings, `priceMin`/`priceMax` are integers with no price _basis_, and the row is **upserted in
place** on `@@unique([sourceKey, externalId])` — one row per product, not one snapshot per scrape.
Its purpose is to become a Rivya `Product`.

The attached document specifies something else: immutable per-scrape snapshots, structured geometry
normalized to millimetres, a resin visual-language vocabulary, variant matrices, price basis
(including quote-only, which must never coerce to zero), analytics leagues, opportunity scoring and
visual similarity. That is a different data model, not a feature added to this one.

It is buildable here, in phases, and workstream B lays them out — but it should be commissioned
knowing it is a rebuild of the staging layer. See [`02`](02-scraper-rebuild.md).

### 5. Three standing rules forbid this work as written

None of this is a reason not to proceed. Each simply needs the owner to say so, because agents
reading `CLAUDE.md` will otherwise correctly refuse. See the decision table below.

---

## Decisions required before any code is written

| ID      | Decision                                                                                                                    | What it overrides                                                                                                                                                                 | Recommendation                                                                                                                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D25** | How far does the storefront move? **(a)** uplift on v3 tokens · **(b)** a v4 visual layer over the same IA · **(c)** new IA | —                                                                                                                                                                                 | **(b)**, defined as a _token extension_ so the 1,297 copy slots, 78 image slots, 9 locales and 5 CI gates survive intact. (c) would cost the locale corpus and the audits.                                                                                                                              |
| **D26** | Scraper may change schema, Server Actions and Studio behaviour                                                              | `CLAUDE.md` HARD RULES / `REDESIGN.md` §1.1 — _"the redesign changes the visual layer only … product data, Server Actions, Studio/CMS behaviour, URLs and routes are off-limits"_ | **Grant, scoped** to the scraper/research subsystem and the Sheets surface. Keep §1.1 in force for storefront visual work, so the two rules do not collapse into "anything goes."                                                                                                                       |
| **D27** | Google Sheets is removed entirely                                                                                           | The attached document makes Sheets first-class (Prompt 29, the canonical field list, Definition-of-Done item 13)                                                                  | **Grant.** The user's instruction supersedes the attached doc. Restate DoD item 13 as _"export the confirmed list as CSV/XLSX."_ Removal must land **after** the replacement export ships (see [`03`](03-sheets-removal.md) §5).                                                                        |
| **D28** | AI may generate product _concepts_ in the Studio                                                                            | HARD RULE _"NO AI-invented products, ever"_                                                                                                                                       | **Grant, narrowly.** The attached doc's Prompts 25–26 produce design directions and draft copy. Safe **only** if they write to a research/concept table that no public reader queries and no promote path touches. The hard rule stays: nothing reaches the catalogue without an explicit owner action. |
| **D29** | May `motion` (framer-motion) be added?                                                                                      | The 45 KB motion budget / 49 KB enforced ceiling (`scripts/motion-budget.mjs`)                                                                                                    | **No.** Most of the named component libraries ship on `motion`. Harvest their _patterns_ and re-implement on the repo's GSAP + CSS tokens. The prompt in [`05`](05-ui-generation-prompt.md) is written to that constraint.                                                                              |

---

## Sequence

Workstreams are ordered by what unblocks what, not by appetite.

| Phase | Work                                                                  | Depends on                    | Gate to pass                                                            |
| ----- | --------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| **0** | Ratify D25–D29; record them in `CLAUDE.md`                            | —                             | Owner sign-off                                                          |
| **1** | **D** — Drive → masters → wire the 43 unpromoted slots                | D25 (which slots survive)     | `bundled-media.test.ts`, `media-v3-preflight.mjs`, `redesign-audit.mjs` |
| **2** | **C** — Sheets removal, phase 1 (replacement export)                  | D27                           | `test`, `test:db`, `test:e2e`                                           |
| **3** | **A** — design-system layer: tokens, primitives, motion               | D25, D29                      | `motion-budget`, `redesign-audit`, `a11y-audit`                         |
| **4** | **C** — Sheets removal, phase 2 (delete the surface, drop the schema) | Phase 2 shipped and used once | full CI                                                                 |
| **5** | **A** — storefront surfaces, route by route                           | Phase 3                       | all five audits, 4 widths, RTL                                          |
| **6** | **B** — scraper: schema + snapshots + normalization                   | D26, phase 4                  | `test:db`, fixture adapter tests                                        |
| **7** | **A** — Studio redesign, including the new scraper workspaces         | Phases 3, 6                   | Studio audit at both widths                                             |
| **8** | **B** — analytics, opportunity scoring, similarity                    | Phase 6                       | Coverage labels on every payload                                        |

Phases 1–2 are independent of the D25 debate and can start immediately once D27 and the slot list
are settled. Phase 1 is the highest value-per-hour work in the plan.

---

## Risk register

| Risk                                              | Likelihood                                                                                     | Impact                                                                           | Mitigation                                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Drive CDN URLs expire before masters are built    | Medium — `CLAUDE.md` gives ~8 days as the observed working window, and these are already older | High — regeneration costs credits the workspace does not have                    | The Drive copies are **local and permanent**. Build masters from Drive, not from the CDN. This risk is already retired by the finding above. |
| Sheets schema drop loses sync history             | Certain if done naively                                                                        | Medium                                                                           | Export `SheetSyncRun` + `SheetConflict` to CSV before the migration; keep the dump in `docs/archive/`.                                       |
| i18n debt from new UI copy                        | High                                                                                           | High — a key added to `en.json` alone renders as its own path in eight languages | `scripts/i18n-missing.mjs` is already a CI gate. Budget the translation batch _in the same PR_, per `CLAUDE.md`.                             |
| Component-library licensing                       | Medium — Skiper UI is $129/$549 tiered; others have paid tiers                                 | Legal                                                                            | The prompt forbids pasting library source. Patterns are not copyrightable; component code is.                                                |
| Scraper rebuild scope creep into a second product | High                                                                                           | High                                                                             | Phase 6 before phase 8. Ship normalization and fair comparison before embeddings — the attached doc's own Build Order Notes say the same.    |
| `motion` added "just for one component"           | Medium                                                                                         | Medium — breaches the ceiling, fails CI                                          | D29 recorded; `motion-budget.mjs` already enforces it.                                                                                       |

---

## What implementing this plan actually found

Recorded on 2026-09-15, after phases 3 and 5 shipped (#63, #64), because the
gap between this plan and the repo is the most expensive thing in it.

**Four of the six claims in [`01`](01-redesign-main-and-studio.md) §3 described a
storefront this repo does not have**, and one in §4.1 described a Studio sidebar
it does not have. Each is corrected in place in that document. The shape of the
error was consistent: the visual judgements ("currently reads as a grid of
tiles", "the homepage carousel", "52 routes through one flat sidebar") were
written from an impression rather than from a measurement, while the
constraints, the gate list and the "what not to touch" sections were accurate
and valuable throughout.

**The defects that were real, none of which this plan names:**

| Found                                                                             | Where                       | Shipped      |
| --------------------------------------------------------------------------------- | --------------------------- | ------------ |
| 79 raw `leading-[…]` literals in 21 values, one intended value per role           | every heading on the site   | #63 (A1, A2) |
| The motion budget measured zero for any library not in its two-entry marker table | `motion-budget.mjs`         | #63          |
| Disabled opacity at three values; 16 of 27 at shadcn's untouched default          | `ui/*` + Studio             | #63 (A3)     |
| `CANONICAL_CATEGORIES[].image` declared for all 8 categories, written by nothing  | two blank homepage doorways | #64 (A5)     |

Each was found the same way: **survey with counts, or load the page and
measure.** None was found by reading this plan.

**So the working method for the remaining phases:** treat §3 and §4's
"currently…" sentences as hypotheses to test, not findings to act on. Load the
route — `scripts/preview-proxy.mjs` makes any PR's own preview auditable in two
lines — and measure before building. Where the measurement disagrees with this
plan, the plan is what gets corrected.

## Verified vs. assumed

**Verified in this session** — every claim above about the repo (file paths, line counts, schema
shape, the `tier-fill` CSV finding, the dependency list, the absence of `googleapis`), the live
storefront's section order and the Studio login wall (both fetched), and the 71/71 Drive filename
match (computed against `docs/media-v3-manifest.json`).

**Not verified** — the Studio dashboard's rendered state (login-gated; read from source instead);
whether the Drive masters are visually the intended keepers (a cull is still required, see
[`04`](04-drive-asset-pipeline.md) §3); the current motion-budget headroom in kilobytes
(`scripts/motion-budget.mjs` needs a build, which needs `DATABASE_URL`); and the internals of three
of the eleven named component libraries, which returned no usable content — flagged individually in
[`05`](05-ui-generation-prompt.md) §4.
