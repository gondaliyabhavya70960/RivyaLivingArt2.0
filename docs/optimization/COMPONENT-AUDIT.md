# Component consistency audit

_2026-09-19. Inventory: 96 studio component files + the storefront and
`components/ui` primitives, read via code search and direct file reads.
Families judged against the prompt's consolidation rule: same component,
implemented once — but no merging things that are genuinely different._

| Family | Components found | Pages used | Differences | Canonical design | Action |
| --- | --- | --- | --- | --- | --- |
| Buttons (Studio) | TWO systems in daily contact: `components/ui/button` (shadcn-style: `default/outline/secondary/ghost`) and `components/storefront/button` (design-system: `primary/premium/secondary/ghost`, Magnetic) | Scraper inbox, shortlist funnel use ui/button; commission board, system pages, 404 use storefront/button | Variant vocabularies differ; the same "move" action renders as different-looking buttons on adjacent screens | `storefront/button` is the design-system voice; ui/button is the shadcn default | **Rule, then migrate (PR-7):** Studio actions use storefront/button; ui/button remains for shadcn composite internals only. Documented in DESIGN-SYSTEM-MAP with the migration list |
| Dialogs | 8 purpose dialogs (prompt, confirm-delete, unsaved-changes, approve, add-to-catalog, inbox-add-to-catalog, move-to-folder, bulk-alt) over `ui/dialog` + `ui/sheet` | All Studio | Healthy: one primitive, purpose-built shells, typed confirmation pattern shared | `ui/dialog` + `PromptDialog` for destructive confirms | Keep. Document the confirmation pattern as canonical (typed-confirm for irreversible) |
| Empty states | `studio/page-header#EmptyState` and `storefront/empty-state` | Studio vs storefront | Two components, two surfaces — a justified split, not duplication | One per surface, deliberately | Keep both; record as **justified variants** in DESIGN-SYSTEM-MAP (Studio ≠ storefront styling, motion rules differ) |
| Badges | `ui/badge` + bespoke pills (commission-board `PRIORITY_TONE`, scraper STATE_BADGE map) | Orders board, scraper | Bespoke pills exist where a badge carries two data points — documented in place | `ui/badge`; bespoke only with an in-code reason | Keep; the reasons are already written where they live. Rule: new two-fact pills go through the same documented exception |
| Tables | `studio-table-head`, `studio-row`, `sort-header`, `columns-menu`, `pagination` (+ `usePagination`), `saved-views`, `bulk-bar` | All Studio lists | Healthy — genuinely shared | Current set | Keep. These are what the Kanban `Table` view reuses |
| Form fields | `field-error`, `field-hint`, `form-section`, `password-field`, `login-fields` | All Studio forms | Healthy — shared | Current set | Keep |
| Status icons | `components/icons` registry, `INQUIRY_STATUS_ICON`-style `Record<Enum, IconName>` maps | Orders, scraper, system pages | Healthy — enum-pinned, `tsc` fails on a new schema value without a mark | Current registry | Keep. Kanban lanes use it |
| **Kanban primitives** | **None shared.** `inquiries/commission-board.tsx` (bespoke columns) and `scraper/shortlist-inbox.tsx` (bespoke grid+drawer) implement board behaviour independently | Orders board, scraper review | Two board implementations, zero shared parts; Products has no board at all | **Does not exist yet** | **Build once (PR-2):** `KanbanBoard/Column/Card/Toolbar/Filter/EmptyColumn(/DropIndicator)`; commission-board migrates first, Products + Scraper boards consume — see KANBAN-SPEC.md |

## Reading of the prompt's consolidation rule

The audit found a codebase already disciplined about shared primitives
(tables, fields, dialogs, badges, icons). The real inconsistencies are
exactly two: the **button vocabulary split** across Studio screens and the
**absence of a shared Kanban foundation** while board behaviour is being
built independently in two places. Everything else is documented-where-it-
lives variation, which this audit deliberately does not "fix".

## Explicitly not consolidated

- `storefront/empty-state` ↔ `studio/page-header#EmptyState` — different
  surfaces, different motion budgets (justified variants)
- The commission-board priority pill — carries `priority · band` as two
  data points; the code documents why it is not a `<Badge>`
- `PriorityTone` weights were already aligned with scraper badge weights in
  a prior pass (the comment in commission-board.tsx records it)
