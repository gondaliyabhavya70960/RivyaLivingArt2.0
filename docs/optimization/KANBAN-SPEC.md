# Kanban spec — one foundation, three boards

_2026-09-19. The shared Studio Kanban architecture, written before the code
so the review happens on the design rather than on a diff. Entity state
machines are quoted from the schema and existing actions — nothing here
invents a status._

## Shared primitives (`src/components/studio/kanban/`)

| Primitive | Responsibility |
| --- | --- |
| `KanbanBoard` | Horizontal scroller + lane layout; owns the move mutation lifecycle (optimistic apply → server action → toast → rollback on failure) |
| `KanbanColumn` | Lane header (icon + label + true count from server data) + `KanbanEmptyColumn` state; columns derive from the entity's REAL status enum, never a spec's invented stages |
| `KanbanCard` | Shell: selection checkbox, quick actions slot, the **required accessible move control**, busy state |
| `KanbanToolbar` | Search, entity filters, sort, `Table \| Kanban` view toggle |
| `KanbanFilter` | One filter chip set per entity, wired to URL params |
| `KanbanEmptyColumn` | "Nothing at this stage" — never a blank lane |
| `KanbanDropIndicator` | Reserved for a future drag decision (see below); NOT built in PR-2 |

Entity-specific card *content* stays per board (commission card, product
card, scraped card) — the primitives own chrome and behaviour only.

## The move interaction (non-negotiable)

- **The accessible path is the primary path on every card:** a native
  `Move to → [Status]` control (select or menu) — keyboard reachable in one
  Tab, works on a phone, one pointer interaction. This is the prompt's
  "dragging cannot be the only interaction" satisfied as the default, not
  as a fallback.
- **Drag and drop: not built.** The orders board's recorded decision stands
  (a second way to do the same thing, and a second way for it to disagree
  with the server). `KanbanDropIndicator` is named here only so a future,
  separately-approved drag PR has a home; no drag code ships in this
  sequence.
- **Persistence is real.** Every move calls the entity's EXISTING Server
  Action. No fake front-end-only movement, no new write paths:
  - Orders → `setInquiriesStatus([id], next)`
  - Products → the existing product status/publish actions (see guards)
  - Scraper → `setShortlistState([id], target, reason?)`
- **Optimistic update + rollback:** the lane updates instantly; failure
  restores the card and toasts the server error; success toasts and
  `router.refresh()` reconciles true counts.
- **Concurrency:** moves serialize per card (`busyId`); a second move on
  the same card is disabled until the first settles. Cross-user conflicts
  surface as the server error, never silent overwrite (the actions already
  guard).
- **Audit trail:** moves flow through the same actions that already write
  `ActivityLog` where the entity supports it (inquiries, shortlist) — the
  Kanban adds nothing new to log, and nothing is lost.

## View toggle + URL state

- `Table | Kanban` segmented control per screen; the existing tables are
  never removed or degraded.
- Preference persists in `localStorage` per screen (no DB field for a UI
  preference); `?view=kanban|table` in the URL so refresh/share/back work;
  URL wins over storage when present.
- Filters/search reflect in URL params (`?status=`, `?q=`, entity filters)
  using existing routing conventions.

## Board 1 — Orders (`/studio/inquiries`)

Already exists as `commission-board.tsx` — **migrate, don't rebuild.**
Seven active lanes from `InquiryStatus` (NEW · CONTACTED · DISCUSSION ·
QUOTED · CONFIRMED · IN_PRODUCTION · DELIVERED); CLOSED/LOST stay off the
board by the existing decision. PR-2 extracts the primitives from it with
zero visual diff. PR-5 adds: board-level filters mirroring the table's,
bulk moves via the existing bulk action, optimistic updates, and an
optional detail drawer alongside the full detail page.

## Board 2 — Products (`/studio/products`)

New board over `ContentStatus`: **DRAFT · REVIEW · PUBLISHED · ARCHIVED**.

- **Guards are the spec.** A card's move menu offers only transitions the
  EXISTING actions allow: publishing an untiered product or a
  placeholder-covered product is refused by the same server-side checks the
  product form already enforces — the Kanban calls the same action, so the
  refusal and its reason appear as the toast, never a silent dead card.
  Archive/restore use the existing status action.
- Card content: image, title, tier badge (ProductSizeTier — never the
  import-list "Tier"), price band, size-tier guard marker, status.
- Filters: category, sizeTier, stock, search — in URL, reusing
  `product-filter.ts`'s existing vocabulary.
- Bulk where the existing actions already support it (status, confirm); no
  new bulk semantics invented for the board.

## Board 3 — Scraped products (`/studio/scraper/review`)

Column view over the SHORTLIST funnel (NEW · REVIEW · SHORTLISTED ·
CONFIRMED with REJECTED/INSPIRATION_ONLY/DUPLICATE as parking lanes),
consuming the existing `shortlist-inbox` state machine:

- **CONFIRMED is reachable only from SHORTLISTED**, enforced by the same
  `SHORTLIST_TRANSITIONS` map the inbox uses — the Kanban renders only the
  targets the map allows for each card's state.
- The current grid stays as the screen's Table view (it already has the
  drawer, bulk, URL filters). The board is the second view, not a
  replacement.
- Card content: image, title, price range, source, suggested tier, state
  badge; detail drawer reused from the inbox implementation.

## Performance + a11y requirements

- Lanes virtualize or cap (board shows most-recent N per lane with a true
  server count in the header, exactly as the orders board already does).
- Column icons from the enum-pinned icon registry (never colour alone).
- Focus order: lane → card → move control → quick actions; card focus
  visible; every lane reachable by keyboard without the board trapping Tab.
- `prefers-reduced-motion`: no lane/card motion beyond opacity fades.

## Tests (per the prompt's Kanban testing section)

1. Primitives render lanes from each entity's real enum (no invented stage).
2. Move calls the entity action with the right ids; failure rolls back and
   toasts; success toasts and refreshes.
3. Products: a move to PUBLISHED on an untiered/placeholder card surfaces
   the guard's refusal (no silent publish).
4. Scraper: CONFIRMED offered only from SHORTLISTED.
5. Keyboard: full move completes without a pointer.
6. Toggle: Table↔Kanban preserves filters; URL reflects view + filters.
7. Existing suites keep passing (`npm test` — currently 1,351).
