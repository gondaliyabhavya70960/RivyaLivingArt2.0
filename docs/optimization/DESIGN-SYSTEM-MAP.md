# Design system map — canonical primitives and their rules

_2026-09-19. The Studio's reusable primitives, their variants and states,
the tokens they consume, where each is for, and the duplication patterns
that are forbidden. Built from the measured COMPONENT-AUDIT — this map
documents what exists and rules it; it does not invent components._

## The rules, first

1. **One component per idea.** A button, a dialog, a badge, an empty state,
   a board lane exists once. New needs extend the canonical component with a
   variant — they do not fork it.
2. **Tokens, never literals.** Colour, spacing, motion and type come from
   `src/styles/tokens.css` / the Tailwind token utilities (`bg-card`,
   `text-graphite`, `rounded-card`, `duration-(--dur-*)`, `ease-(--ease-*)`).
   A hardcoded hex or a one-off duration is a bug by definition.
3. **States are never colour alone.** Every status carries its icon from
   the enum-pinned registry (`components/icons/status.ts`) or text — §16.
4. **The enum is the vocabulary.** Statuses, tiers and sources are the
   Prisma enum's values, never a spec's invented stages. A component that
   invents a tenth stage fails review on sight.

## Buttons — the canonical rule (A3)

**Studio actions use `components/storefront/button`.** Its variants
(`primary`, `premium`, `secondary`, `ghost`) are the design-system voice —
the same voice the storefront's CTAs speak, so an owner's eye learns one
grammar for "this does something".

**`components/ui/button` stays ONLY inside shadcn-style composites** — the
internals of Select, Dialog, Sheet and their kin, whose markup contracts
the primitive owns. It is not used for page-level actions.

| Button | Variants | States | Tokens | Intended use | Forbidden |
| --- | --- | --- | --- | --- | --- |
| `storefront/button` | primary · premium · secondary · ghost (+ Magnetic wrapper) | default · hover · focus-visible ring · disabled · busy | `bg-mineral`/`text-obsidian` (primary), champagne accents (premium), `--ring-focus` | Every page-level action in Studio and storefront | Recreating its variants with raw `<button>` + classes; a fourth button system anywhere |
| `ui/button` | default · outline · secondary · ghost · destructive · link | as the composite defines | shadcn scopes | INTERNALS of shadcn composites (Select, Dialog, Sheet internals) | Page-level actions (that is the inconsistency A3 records) |

**Migration state (recorded, deliberate):** the rule above is now law.
Migrating the existing visible deltas (the scraper screens' ui/button
actions) is a VISUAL change to screens the owner uses daily — it is
scheduled for owner visual review rather than shipped unreviewed in this
sequence, because the change is cheap to make and expensive to get subtly
wrong. The map existing first is what makes that review a yes/no instead of
a design discussion.

## Surfaces and structure

| Primitive | Variants / states | Tokens | Intended use | Forbidden duplication |
| --- | --- | --- | --- | --- |
| `page-header` (+ `EmptyState`) | title/eyebrow/description + actions slot; EmptyState with optional art | `u-micro`, `text-graphite` | Every Studio screen's header; the Studio empty state | A third EmptyState (see Justified variants) |
| `form-section` | titled card section + optional description | `bg-card`, `rounded-card` | Grouping fields on Studio forms/settings | Bespoke bordered divs re-styling the same section |
| `studio-table-head` / `studio-row` / `sort-header` / `columns-menu` / `pagination` (+ `usePagination`) / `saved-views` / `bulk-bar` | sortable, column-visible, server-paginated tables; row selected state | `border-border`, `bg-card`, `text-graphite`, `u-num` | EVERY Studio list table — this is what a board's Table view reuses | Hand-rolled `<table>` markup or a second pagination |
| `field-error` / `field-hint` (+ `describedBy`) | error/hint text with aria wiring | `text-alert` / `text-graphite` | Every form field's message channel | Inline `<p class="text-red">` anywhere |
| Dialogs: `ui/dialog`, `ui/sheet`, `prompt-dialog`, `confirm-delete-dialog`, `unsaved-changes-dialog` | modal + right-sheet; typed-confirm for irreversible actions | `bg-card`, `rounded-card`, `--ring-focus` | Every confirm/edit/detail surface | A second modal primitive; an irreversible action WITHOUT typed confirmation |
| `ui/badge` | default · secondary · outline · success · warning | badge tones | Status and metadata chips | One-off pill classes — unless it carries TWO data points (see Justified variants) |
| `components/icons` + `icons/status` | `Icon name=` from the registry; `*_STATUS_ICON` maps exhaustive per enum | `size`, `className` (currentColor) | Every status/stage mark | A status shown by colour alone; an icon map that is not `Record<Enum, IconName>` (incomplete maps fail `tsc` by design) |

## The Kanban set (PR-2) — the canonical board system

| Primitive | Responsibility | States | Forbidden |
| --- | --- | --- | --- |
| `KanbanBoard` | The horizontal lane scroller | — | A second lane scroller with different widths/scroll behaviour |
| `KanbanColumn` (+ `KanbanEmptyColumn`) | Lane header (icon + label + TRUE count) and the never-blank empty lane | count from server data; empty state | A lane header that counts rendered cards and calls it the total |
| `KanbanCardShell` | Card chrome + the busy fade | `busy` → `opacity-60` | Recreating the card frame per board |
| `KanbanMoveSelect` | THE move control on every card — native select, one Tab, works on a phone | value / options / disabled | Options the SERVER's state machine would refuse (options ARE the machine); drag-and-drop as the only move path (a recorded decision — the select is the accessible primary) |
| `view-preference` (`resolveKanbanView`, `useStoredView`) | Table\|Kanban resolution: URL wins, localStorage fallback via useSyncExternalStore | table · kanban | Storing a view preference in the database; a third view value |

## Justified variants — recorded, not bugs

| Pair | Why two is correct |
| --- | --- |
| `studio/page-header#EmptyState` ↔ `storefront/empty-state` | Different surfaces with different motion budgets and copy registers (admin vs storefront). A merge would force one surface's constraints on the other. |
| Commission-board `PRIORITY_TONE` pill ↔ `ui/badge` | The pill carries TWO data points (`priority · band`) and needs the wider box — the in-code comment records why it is not a Badge, and its weights were already aligned with the scraper's badges. New two-fact pills follow the same documented exception, or they become Badges. |
| `SHORTLIST_LANE_ICON` (local) ↔ `icons/status.ts` (registry) | The shortlist funnel's states are used by the review screens alone; the map is `Record<ShortlistState, IconName>` (exhaustive, tsc-enforced) and is promoted to the registry the day a second consumer appears. |

## The regression pin

`vitest` suites that encode these rules and must keep passing:
`icons/registry.test.ts` (exhaustive icon maps), `kanban.test.tsx`,
`products-kanban.test.tsx`, `scraper-kanban.test.tsx`,
`board-filter.test.ts`, `not-found.test.ts`, `docs-index.test.ts`. A future
component PR that breaks one of these is a design-system change, and it
arrives with an edit to this map or it does not merge.
