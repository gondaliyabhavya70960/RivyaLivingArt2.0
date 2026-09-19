# Implementation plan — optimization + Kanban program

_2026-09-19. Sequence follows the prompt's own order — audit → consolidate
→ optimize → implement → test → compare → document — and the hard rules:
PRs only, the owner merges and deploys (rule 8 — no auto-merge, no
production promotion by the agent). Each PR is independently shippable and
independently revertable._

| PR | Scope | Depends on | Risk | Regression gate |
| --- | --- | --- | --- | --- |
| **PR-1 (this one)** | The audit set: BASELINE, COMPONENT-AUDIT, AUDIT, KANBAN-SPEC, IMPLEMENTATION-PLAN | — | None (docs) | Docs review |
| **PR-2** | Shared Kanban primitives (`components/studio/kanban/*`); migrate `commission-board` onto them with **zero visual diff**; primitive tests | PR-1 | Low — extraction proven by no visual change | `npm test` + visual comparison of `/studio/inquiries?view=board` before/after |
| **PR-3** | Products Table\|Kanban (Board 2): guarded status moves via EXISTING publish/status actions, URL filters, tier/status badges | PR-2 | Low — no new write paths | Guard tests (untiered + placeholder publish refusals surface as toasts); existing product suites pass |
| **PR-4** | Scraper column view (Board 3) over the shortlist state machine; grid stays as Table view; drawer reused | PR-2 | Low — additive view | CONFIRMED-only-from-SHORTLISTED test; existing scraper suites pass |
| **PR-5** | Orders board enhancements: board-level filters (URL), bulk via `setInquiriesStatus`, optimistic update + rollback, optional detail drawer | PR-2 | Low — additive | Move rollback test; keyboard-only move test |
| **PR-6** | Perf (A1): post-idle/budgeted motion init on the heaviest routes, Lenis/GSAP overlap audit, per-route motion budget. Re-run Lighthouse on home + shop + touched routes | BASELINE.md | Medium — motion is the brand signature | RESULTS.md: LCP/TBT before-vs-after on home; no CLS regression; reduced-motion unchanged |
| **PR-7** | Component consolidation (A3): canonical button rule recorded in DESIGN-SYSTEM-MAP + visible migrations; A6 documented; Q2 alt-text pass scheduled | PR-2 | Low — visual only | DESIGN-SYSTEM-MAP.md published; design-consistency regression note; `npm test` |
| **PR-8** | Close-out: RESULTS.md (before/after incl. Lighthouse), REGRESSION-CHECKLIST.md, final report in the prompt's format | all | None | Owner sign-off |

## Rules for every PR

1. **Evidence before edits** — each optimization PR names its baseline in
   the PR body (route + metric) and its measured result before merge.
2. **No schema changes** anywhere in this program. If a need surfaces, it
   is recorded and escalated to the owner, never shipped.
3. **No new write paths** — every mutation reuses an existing Server
   Action; the Kanban boards are views over workflows that already exist.
4. **Tables are never removed** — every board ships beside its table view
   behind the toggle.
5. **The business rules are load-bearing:** WhatsApp is checkout, no
   customer accounts, no invented data, CMS editability, i18n, URL
   structure, existing workflows, production safety. A PR that would bend
   one does not start.
6. `npm test` green on every PR; new behaviour ships with its tests in the
   same PR.

## Open items for the owner (recorded, not started)

- DESIGN-SYSTEM-MAP.md lands with PR-7 — it documents the canonical
  primitives INCLUDING the Kanban set, and writing it before PR-2 exists
  would document invention rather than fact.
- Q2 media alt-text pass (2,854 files) — scheduled after PR-7; runs in
  reviewed batches.
- `hf_` grading pass (owner's afternoon, DRIVE-HF-INDEX.md protocol).
- Publishing the 8 concept studies (Studio → Portfolio) after imagery
  confirmation.
