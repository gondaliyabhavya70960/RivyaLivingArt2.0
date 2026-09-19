# Optimization audit — findings register

_2026-09-19. Priorities per the prompt's system (P0 critical · P1 high ·
P2 medium · P3 low). Evidence is measured (Lighthouse, live requests, code
reads) — nothing here is a hunch._

| ID | Priority | Surface | Route | Problem | Evidence | Root cause | Files | Fix | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | P1 | Storefront | `/` (worst), all public routes | TBT 2.2–2.9 s, LCP 4.5 s on mobile profile | BASELINE.md: scriptEvaluation 4.56 s + styleLayout 3.5 s of 10.8 s main-thread | The motion/interaction layer runs long on a throttled CPU (Lenis + GSAP + cursor + scroll effects summing); not bytes — page weight is 910 KiB with ~48 KiB unused JS | motion components, Lenis init, scroll observers | PR-6: post-idle/budgeted motion init, per-route motion audit, kill overlap; re-measure gate | Medium — motion is the brand's award-site signature; degrade gracefully, never delete |
| A2 | P1 | Studio | `/studio/products` | No board view for the 1,083-product workflow; status moves are row-by-row in a table | Screen read: `product-list.tsx` table only | No Kanban primitives exist to build the view from | `products/product-list.tsx` + new `components/studio/kanban/*` | PR-3: Products Table\|Kanban via shared primitives; moves go through the EXISTING guarded publish actions (untiered + placeholder-cover guards) | Low — reuses existing actions; guards unchanged |
| A3 | P2 | Studio | Cross-screen | Two button systems in daily contact (ui/button vs storefront/button vocabularies) | COMPONENT-AUDIT.md: scraper inbox uses ui variants, commission board uses storefront variants on adjacent screens | Two legitimate imports converged over time; no recorded rule | Scraper screens (ui) vs orders/system screens (storefront) | PR-7: record the canonical rule (Studio actions → storefront/button; ui/button only inside shadcn composites), migrate the visible deltas | Low — visual only |
| A4 | P2 | Studio | `/studio/inquiries?view=board` | Orders board: no board-level filters, no bulk, no drawer option, non-optimistic moves | commission-board.tsx read: capped "most recent N", table holds filters; move = busy+toast+refresh | Board shipped as the focused view; extras were deferred | commission-board.tsx, inquiry actions | PR-5: board filters (URL), bulk via existing `setInquiriesStatus`, optimistic update + rollback, optional detail drawer | Low — additive; existing action reused |
| A5 | P2 | Studio | Kanban foundation | Board behaviour implemented twice independently (commission-board, shortlist-inbox); a third board (Products) needed with nothing to build on | COMPONENT-AUDIT.md | No shared Kanban primitives | new `components/studio/kanban/*` | PR-2: build KanbanBoard/Column/Card/Toolbar/Filter/EmptyColumn once; migrate commission-board first (zero behaviour change proves the extraction) | Low — extraction proven by no visual diff |
| A6 | P3 | Studio | Empty states | Two EmptyState components | COMPONENT-AUDIT.md | Studio vs storefront surfaces — justified | both files | Document as justified variants in DESIGN-SYSTEM-MAP; no merge | None |
| A7 | P3 | Storefront | Bundle | ~48 KiB unused JS | BASELINE.md diagnostics | Normal framework/vendor slack | — | No action now; revisit if the figure grows | None |
| Q2 | P2 | Studio | `/studio/media` | 2,854/2,854 media files without alt text; inherited everywhere used | Content Health screen | Backlog from bulk imports | Media library | Assisted alt-writing pass in batches (queued after the Kanban sequence) | Low — per-file owner review anyway |

## Explicitly checked and found healthy

- Demo architecture (host guard, manager, typed confirm, shared-media
  protection) — verified in QA, no action
- Portfolio index (browser-verified 12+8 tiles, 7 filter chips) — no defect
- Soft-404 — mitigated by ENG-813 noindex + pinned by `not-found.test.ts`
- Dark token system (D30) — landed; no rework per the prompt's "do not
  reopen completed work unless measurement shows a regression"

## What is NOT in this register (and why)

- **Drag-and-drop for the Orders board** — a recorded decision already
  declined it (`commission-board.tsx`: "No drag-and-drop… Left out on
  purpose"). The new prompt requires the *accessible alternative* —
  `Move to → [Status]` — which already exists as the board's primary
  mechanism (native select per card, keyboard + mobile native). Requirement
  met by design; drag stays out, recorded here so nobody reopens it.
