# Regression checklist — optimization + Kanban program

_2026-09-19. Every check the program must pass to be called done, and its
evidence. Suite of record: `npm test` (vitest, 127 files at close)._

## Business rules (the prompt's hard eight)

| Rule | Check | Evidence |
| --- | --- | --- |
| WhatsApp is checkout | Product → customisation → contact → inquiry → WhatsApp message → redirect, untouched by this program | No order-flow file in any PR diff; QA-CONTENT-REPORT.md Phase 30 |
| No customer accounts | `/studio` remains staff-only | No auth change in any diff |
| No AI-invented business data | Zero fabricated products/prices/testimonials/orders anywhere | Every fixture already existed; this program added no content rows |
| Preserve CMS editability | SiteCopy/SiteImage/sections/blocks/nav/forms/settings/drafts/previews untouched | No CMS file in any diff |
| Preserve internationalization | next-intl, locales, RTL, metadata, canonicals untouched | Only ADDITIVE params (`?view=kanban`); no route moved |
| Preserve URL structure | No route renamed, no endpoint changed | All changes are component-level; `?view=` params only |
| Preserve business workflows | Publishing, scraper review, import, customisation, inquiry, WhatsApp, drafts, auth, permissions | Every move calls an EXISTING action (`setProductsStatus`, `setShortlistState`, `setInquiriesStatus`) — no new write paths anywhere |
| Production safety | No auto-merge, no deploy by the agent | Every PR opened for owner merge; the one delegated write in this engagement (starter apply) predates this program and was owner-delegated |

## Kanban

| Check | Status |
| --- | --- |
| One shared foundation, not three implementations | ✅ `components/studio/kanban/` — all three boards consume it (PR-2) |
| Accessible move on every card (never drag-only) | ✅ `KanbanMoveSelect` — native select; drag declined by recorded decision |
| Keyboard-complete move | ✅ tested (kanban.test.tsx interaction test) |
| True counts on lane headers (never the rendered slice) | ✅ tested on all three boards |
| Lanes derive from the entity's real enum — no invented stages | ✅ tested (orders 7, products 4, shortlist 7) |
| Guards enforced on moves | ✅ products: publish guards toast the exact refusal (tested); shortlist: Confirmed only from Shortlisted (tested) |
| Real persistence via existing Server Actions | ✅ `setProductsStatus` / `setShortlistState` / `setInquiriesStatus` |
| Optimistic update + rollback (orders) | ✅ `applyOptimisticMove` tested — rollback array never mutated |
| Bulk where existing actions support it | ✅ orders + scraper; products board deliberately keeps bulk in its table (recorded) |
| Table\|Kanban toggle on all three screens | ✅ products + scraper via view-preference; orders via `?view=board` (its own earlier convention) |
| URL state + localStorage preference | ✅ URL wins, storage fallback, toggling writes both — tested (`resolveKanbanView`) |
| Detail drawer reused, not rebuilt (scraper) | ✅ grid and board open the same extracted sheet |

## Engineering gates (every PR)

| Gate | Result |
| --- | --- |
| `tsc --noEmit` | ✅ clean on every PR |
| ESLint | ✅ clean on every touched file |
| `npm test` progression | 1,348 → 1,351 (Q1 pin) → 1,358 (PR-2) → 1,367 (PR-3) → 1,375 (PR-4 + PR-3 test restoration) → **1,380 passing (PR-5)** |
| CI check-runs | ✅ "Typecheck · lint · unit tests" green on the PRs; preview deployments Ready |
| Migrations / schema changes | **ZERO** across the whole program |

## Performance

| Check | Status |
| --- | --- |
| Baseline measured before any perf edit | ✅ BASELINE.md (home 0.46 / LCP 4.5 s / TBT 2.87 s; shop 0.60 / TBT 2.22 s; CLS 0; ~910 KiB) |
| Root cause identified by code, not guessed | ✅ Reveal was the only unguarded scroll effect; all five siblings already guarded |
| Fix is the codebase's own pattern | ✅ Reveal bails on `useIsTouch` before the GSAP import (PR-6) |
| Desktop + reduced-motion unchanged | ✅ guard only widens `disabled` |
| After-measurement | ⏳ handed to owner with the one-command re-run — preview deployed but unreachable from this environment; no fabricated numbers (RESULTS.md) |

## Design consistency

| Check | Status |
| --- | --- |
| Component audit measured, not assumed | ✅ COMPONENT-AUDIT.md — two real inconsistencies found (button vocabulary, missing Kanban foundation), everything else already disciplined |
| Canonical system documented | ✅ DESIGN-SYSTEM-MAP.md incl. justified variants and the regression pin |
| Consolidation built | ✅ the Kanban foundation (the real one); button migration scheduled for owner visual review (recorded) |
