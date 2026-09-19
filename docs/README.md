# `docs/` — what is here, what is in force, and what must not move

The index for 35 loose files and seven subdirectories. Read this before
following a document: **half of what is here is superseded or dated, and a
dated document is not wrong — it is a record of what was true when it was
written.** Owner decision D24 says those are never rewritten, so telling them
apart is the whole job of this page.

`docs/plan/README.md` is the index for the workstream plans specifically.
`CLAUDE.md` is the current state of the project and outranks every document
here where they disagree.

---

## ⚠️ Three paths in here are READ BY CODE — do not move them

They look like documentation and they are pipeline inputs. Moving one breaks a
build or a test with no compile error to warn you.

| Path                             | Read by                                                                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/media-v3-manifest.json`    | `scripts/media-v3-fetch.mjs`, `scripts/media-v3-preflight.mjs`, `scripts/lib/media-v3-planned.mjs`, and `src/lib/media-v3-planned.test.ts` by the relative path `../../docs/media-v3-manifest.json` |
| `docs/plan/drive-asset-map.json` | `scripts/lib/media-v3-drive.mjs` (`MAP_FILE`), `scripts/media-v3-fetch.mjs`                                                                                                                         |
| `docs/media-v3-review/`          | `scripts/media-v3-fetch.mjs` — the contact sheets the cull is made from                                                                                                                             |

**This is also why the rest of this directory was indexed rather than
rearranged.** Every loose file here is referenced from `CLAUDE.md`, `AGENTS.md`,
another doc, a dated record, or code — several from all five. Moving them would
put broken links inside `CHANGELOG.md`, `PROJECT_STATE.md`, `docs/audits/` and
`docs/RENAME-MIGRATION.md`, which D24 forbids rewriting to repair. A hierarchy
that costs four dated records their links is not an improvement, so the
hierarchy is here, in one page, and the files stayed where every existing
reference already points.

---

## In force — read these

### The design system

| Document                                  | What it is                                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../REDESIGN.md`                          | **The spec.** Master UI/UX Redesign Specification v1.0. Read the relevant Part before building any UI, motion or Studio feature                                                        |
| `redesign-contract.md`                    | The short version of the above — token vocabulary, review rules, hard constraints, in the form a change actually needs. Cited from `scripts/motion-budget.mjs` and two component files |
| `reference-design/implementation-plan.md` | The row-by-row build plan (F*, S*, and the per-page tables), kept current as rows ship                                                                                                 |

### The scraper and the Studio

| Document                          | What it is                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scraper.md`                      | The Product Scraper end to end                                                                                                                                                                                     |
| `product-lifecycle.md`            | A product's life — scrape → review → catalogue → confirmed                                                                                                                                                         |
| `studio-workflow.md`              | The Studio workflow                                                                                                                                                                                                |
| `source-adapters.md`              | Adding a source adapter                                                                                                                                                                                            |
| `adapter-acceptance-checklist.md` | What an adapter must satisfy. Cited from six files under `src/lib/scraper/adapters/`                                                                                                                               |
| `troubleshooting.md`              | When something is broken                                                                                                                                                                                           |
| `studio-cms/`                     | The Studio CMS plan (11 files) — built; `CLAUDE.md`'s "one pattern, ten surfaces" table is the summary                                                                                                              |
| `reference-design/`               | **The reference design, moved in from the repository root on 2026-09-19.** `implementation-plan.md` (§4.5's icon brief, §6's interaction table), `awwwards-redesign-spec.md`, the UI/UX audit, `claude-code-prompt.md` and `mockup/`. Reference, **not law** — `REDESIGN.md` and `redesign-contract.md` outrank it wherever they disagree. It is `reference-design/` and not `design/` on purpose: three dated audit records (`audits/2026-09-16/redesign-plan.md`, `audits/2026-09-16/ui-prompts.md`, `plan/06-source-documents.md`) state that `docs/design/COMPONENT_REGISTRY.md` and `docs/design/DESIGN_SYSTEM.md` are ABSENT, and use that absence as evidence those documents were written against the OLDER repository. Creating `docs/design/` would make nine citations in records D24 forbids repairing read as false |

### The workstreams

| Document                           | What it is                                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan/`                            | **IN FORCE.** The storefront/Studio redesign, the scraper rebuild, the Sheets removal, the Drive media pipeline, and the three-tier product architecture. `plan/README.md` is its index |
| `COMPLETED-WORK.md`                | What the five owner briefs asked for and what has shipped                                                                                                                               |
| `NEEDED-WORK.md`                   | What is still owed, tier by tier, plus the tabled owner questions that block real work                                                                                                  |
| `ui-master-plan-reconciliation.md` | All 213 entries of `RIVYA LIVING ART_2.0_UI_MASTER_PLAN.md` verified against HEAD. **Read this instead of that plan**, which is not a plan for this repo                                |
| `import/`                          | Bulk Import's own notes                                                                                                                                                                 |
| `content/`                         | **IN FORCE (2026-09-19).** Why Content Lab reads zero on production, what the live site actually has, the starter-content system, the competitor research and the demo-data manager      |
| `optimization/`                    | **IN FORCE (2026-09-19).** The optimization + Kanban program: measured baseline, component audit, findings register, Kanban spec and the 8-PR implementation plan      |
| `alt-backfill/`                    | Reviewed media-alt batches (Q2) — `batch-01-bundled.json` (124 entries: v3 masters, blog covers, catalog concepts), applied with `npm run alt:backfill -- <batch> --apply` |

### Assets

| Document                    | What it is                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `media-v3-manifest.json`    | The Part 15 imagery manifest — prompt, placement and ratio per asset. **Read by code** (see above) |
| `media-v3-review/`          | The contact sheets each keeper was culled from. **Read by code**                                   |
| `plan/drive-asset-map.json` | The owner's Drive mirrors, used when the CDN refuses. **Read by code**                             |
| `image-inventory.md`        | The Step-4 image inventory and generation prompts. Cited from `prisma/generated-cover.ts`          |

---

## Dated records — true when written, never rewritten (D24)

Do not "correct" these. Where one disagrees with `CLAUDE.md`, `CLAUDE.md` is the
one being kept current, and the disagreement is the historical fact.

Several name **`ResinRiva2.0`**, which was this repository before the rename —
not a different project. `RENAME-MIGRATION.md` has that account.

| Document                                                | What it records                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PROJECT-AUDIT.md`                                      | The Phase 0 forensic audit                                                                                               |
| `RENAME-MIGRATION.md`                                   | The Phase 1 rename, and why older documents say `ResinRiva2.0`                                                           |
| `audits/2026-09-16/`                                    | The 617 audited rows behind `COMPLETED-WORK.md` and `NEEDED-WORK.md`                                                     |
| `transformation-audit.md` · `transformation-roadmap.md` | Phase 0 and the roadmap of the "Complete Website + Studio Transformation"                                                |
| `LARGE-RESIN-ART-IMPLEMENTATION.md`                     | How `/large-resin-art` was built                                                                                         |
| `scraper-audit.md`                                      | The Phase 1 scraper · Studio · Sheets audit                                                                              |
| `design-audit-redesign.md`                              | The two-skill design audit and redesign programme (2026-08-09)                                                           |
| `archive/`                                              | Including `sheets-2026-09-15/` — the entire push history the Sheets integration ever had: one `PUSH` that never executed |

---

## Superseded — history only, do not build from

| Document                                                                    | Superseded by                                                                    |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `design-v7-sapphire-atelier.md`                                             | `../REDESIGN.md`. So is the archived `DESIGN.md` (v2.0 "Midnight Gild")          |
| `audit-2026-07-master.md` · `audit-2026-07-implementation-plan.md`          | The July audit and its plan, against a much earlier tree                         |
| `audit-uiux.md` · `audit-v7.md`                                             | Findings against the superseded v6/v7 vocabulary                                 |
| `luxury-ecom-strategy.md` (v5 layer) · `product-ux-benchmark.md` (v6 layer) | Strategy layers from before the v3 "Liquid Luxury" system                        |
| `prompts/`                                                                  | The scraper/Studio/Sheets master prompt — Sheets is gone (workstream C complete) |

---

## The one thing this index cannot tell you

Whether a document is **currently accurate**. In force means "this is the
document to read", not "every line still holds" — `plan/` records what was true
when each plan was written, and `CLAUDE.md` says so explicitly. When a fact
matters, check it against the code: `git remote -v` for repo identity,
`prisma/schema.prisma` for columns, and the running site for behaviour.