# A — Storefront & Studio redesign

> **Blocked on D25 and D29** (see [`README.md`](README.md)). Everything below assumes **D25 = (b)**:
> a v4 visual layer expressed as a *token extension* over the same information architecture.

---

## 1. Where the two surfaces actually stand

|  | Storefront | Studio |
|---|---|---|
| Routes | 21 public (+5 demo detail) | 52 |
| Components | 48 `storefront/` + 20 in `product`/`shop`/`sections`/`portfolio`/`blog` | **120** |
| Locales | 9, incl. Arabic RTL | English only, by design |
| Design system | `REDESIGN.md` v3 "Liquid Luxury", fully applied | shadcn semantic layer re-pointed under `.studio-v2`, with its own dark block |
| CI gates | `redesign-audit` · `a11y-audit` · `keyboard-audit` · `e2e-smoke` · `motion-budget` | Studio audit at two widths |
| Condition | **Finished and shipping** | **Functional, under-designed** |

The asymmetry is the plan. The storefront has had a design system applied to it with discipline;
the Studio has had features applied to it with speed. 120 components across 52 routes, built
surface by surface against `docs/studio-cms/`, is where the visible quality gap lives — and it is
the surface the owner uses every day.

**Recommendation: weight the effort roughly 35 / 65 storefront-to-Studio**, which is the inverse of
where redesign effort usually goes and is the right call here.

---

## 2. The constraint that shapes every decision

A redesign of this repo is not a redesign of a static site. Four registries sit between a component
and what it renders:

```
site-copy.generated.ts   1,297 copy slots  ─┐
site-images.ts              78 image slots ─┤    resolved at request time,
page-sections.ts        7 pages of bands   ─┤    overridable from /studio,
custom-blocks.ts            16 block types ─┘    published as drafts
```

Consequences, all of them non-negotiable:

- **A component that hardcodes a string deletes an owner's ability to edit it.** New copy goes
  through `next-intl` *and* the copy registry (`npm run copy:registry`), then into all nine locales.
- **A component that hardcodes an image path breaks `/studio/site-images`.** New imagery becomes a
  slot in `site-images.ts` with a bundled fallback that exists on disk — `site-images.test.ts`
  asserts the file is really there.
- **Reordering a page means editing `page-sections.ts`**, not the JSX, or the sections board stops
  describing reality.
- **Deleting a section deletes its copy slots.** `copy:check` will catch it; plan the removal.

A redesign that ignores this ships a beautiful site the owner can no longer edit. That failure mode
is the single largest risk in workstream A.

---

## 3. Storefront — what to actually change

The live site's structure is sound. The work is craft, not composition. Ranked by visible return:

### 3.1 Typography and rhythm (highest return, lowest risk)
The v3 scale is `clamp()`d and correct, but applied evenly. A luxury surface earns its feel from
*contrast* in the scale, not from more of it. Targets: the hero statement, section openers, the
manifesto band, pull-quotes. Keep `font-display`/`font-body`/`font-mono` roles exactly as the
contract assigns them — every price, dimension and eyebrow stays mono and tabular.

### 3.2 The collections band and the featured grid
Six category doorways and the featured grid are the commercial core. They currently read as a grid
of tiles. Uplift: asymmetric editorial composition, real crops from the new masters (workstream D),
`MeniscusImage` on each, and mono metadata that says something (timeline, scale class) rather than
repeating the title.

### 3.3 Large-format work
`REDESIGN.md` Part 6 and the dedicated `/large-resin-art` route treat this as the brand's apex, and
the homepage carousel under-sells it. This is the surface where Batch D's bench concepts,
large-format art and concept-room renders were generated to land.

### 3.4 Product detail page (Part 9)
The commerce split (gallery 60 / information 40), the spec sheet, the customization fields and the
WhatsApp order path all work. Uplift the **gallery** and the **spec sheet** — the two places a
buyer decides. Do not touch the order logic; `e2e-smoke` asserts the wa.me round trip and the
`[DEMO] ` prefix.

### 3.5 Empty, loading and error states
The contract (§9) specifies flat `sand` skeletons at exact final dimensions, no shimmer, no
spinner where a skeleton will do, and an empty state that is a statement plus one action. These are
specified and partially applied. Finishing them is invisible until it isn't.

### 3.6 What not to touch
Routes, URLs, filtering, search vocabulary, customization fields, uploads, Server Actions, auth, the
order flow, `wa.me/917096036250`. §1.1 stays in force here even under D26.

---

## 4. Studio — where the real work is

The Studio consumes `shadcn/ui` re-pointed under `.studio-v2`. That was the right call and should
stay. The redesign is about **information design**, not about replacing the component layer.

### 4.1 Shell and navigation
52 routes currently reachable through one sidebar. Group them by the job being done, not by the
table being edited:

| Group | Routes |
|---|---|
| **Today** | Overview · Inquiries · Activity |
| **Catalogue** | Products · Categories · Media · Import |
| **Content** | Site copy · Site images · Sections · Pages · Custom pages · Navigation · Forms · Process · Materials · FAQs · Blog · Portfolio · Testimonials |
| **Research** | Scraper · Sources · Review · Quality · Mapping · Research · Content gaps |
| **Settings** | Settings · SEO · Users · Subscribers · Content Lab |

Five groups, each a coherent job. Today's flat list makes "where do I change the homepage hero?"
a guessing game across `site-copy`, `site-images` and `sections`.

### 4.2 The draft/publish model deserves to be visible
Every copy and image save stages in `draftValue`/`draft` and publishes per surface. That is a
genuinely good model and the UI barely shows it. A persistent "N unpublished changes on this
surface" affordance, with a preview link and a publish action, converts a hidden safety feature
into a visible one.

### 4.3 Data tables
The Studio's tables carry column visibility, bulk actions and a floating bulk-action bar (one of
the two sanctioned shadows). They are the most-used surface in the app and the least designed one.
Density, alignment (numbers mono and right-aligned), sticky headers, and a consistent empty state
across all of them is a single focused PR with outsized effect.

### 4.4 The scraper workspaces
These get rebuilt in workstream B and should be **designed once, after** the new data model lands —
not restyled now and rebuilt in two months. See [`02`](02-scraper-rebuild.md) §6.

### 4.5 Studio accessibility
`sapphire-ink` exists because raw sapphire is 2.2:1 on obsidian in the Studio's dark scheme. Every
sapphire text or indicator icon must read it, never a fill. This rule is easy to break with new
components and has no automated gate beyond the Studio audit — call it out in review.

---

## 5. The five gates, and what each one will catch

Run them locally for the route or width CI does not sweep; all five run in CI.

| Gate | What breaks a redesign here |
|---|---|
| `redesign-audit.mjs` | Two `section-major` per page, three dark bands, never adjacent; one `h1`; no duplicated section heading; numbers in mono; alt text that describes the picture; no horizontal overflow; **any bundled image that loaded with `naturalWidth === 0`**; and a `reduce`-context pass that fails anything still animating. |
| `a11y-audit.mjs` | axe-core critical/serious over 18 routes at 4 widths plus the RTL set. |
| `keyboard-audit.mjs` | Drawer, search, mega menu and the three lightboxes: open, focus, arrows, Escape, focus return. |
| `motion-budget.mjs` | 45 KB budget, 49 KB enforced ceiling. Adding `motion` fails this immediately (D29). |
| `e2e-smoke.mjs` | The order flow to `wa.me` with the right pre-filled message. |

Plus `copy:check` and `i18n-missing --stale` on every PR.

**At ≤700px the design audit drives a touch-capable context**, so the 44px tap floor *fails* there
rather than being reported. Any new control must clear 44×44 with 8px separation at 390px and 360px.

---

## 6. Suggested PR sequence for workstream A

Each row is one reviewable PR that leaves the tree green.

| # | PR | Notes |
|---|---|---|
| A1 | v4 token extension in `tokens.css` + the utility bridge | Additive only. No component changes. Existing tokens keep their names. |
| A2 | Typography contrast pass — scale, tracking, measure | Storefront only. Highest return. |
| A3 | Primitive refresh: buttons, inputs, cards, skeletons, empty states | Both surfaces. Must ship all six states per §9. |
| A4 | Motion pass within budget — reveals, transitions, the two signature devices | `motion-budget` before and after, numbers in the PR body. |
| A5 | Homepage: collections band, featured grid, large-format | Needs workstream D's masters wired first. |
| A6 | PDP gallery + spec sheet | Order logic untouched. |
| A7 | Studio shell + five-group navigation | |
| A8 | Studio data tables + draft/publish visibility | |
| A9 | Studio scraper workspaces | **After** workstream B phase 6. |

Per `CLAUDE.md`: every PR is `feat|fix|chore|refactor(scope): message`, small and verified —
typecheck, lint, build, 360px and 1280px, keyboard, reduced-motion, screenshots.
