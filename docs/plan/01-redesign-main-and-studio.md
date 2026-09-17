# A — Storefront & Studio redesign

> **Status, 2026-09-16:** workstream A is closed. Every row of the two UI briefs is checked against HEAD in `docs/audits/2026-09-16/ui-prompts.md`; what is still owed is in `docs/NEEDED-WORK.md`.

> **Blocked on D25 and D29** (see [`README.md`](README.md)). Everything below assumes **D25 = (b)**:
> a v4 visual layer expressed as a _token extension_ over the same information architecture.

---

## 1. Where the two surfaces actually stand

|               | Storefront                                                                         | Studio                                                                       |
| ------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Routes        | 21 public (+5 demo detail)                                                         | 52                                                                           |
| Components    | 48 `storefront/` + 20 in `product`/`shop`/`sections`/`portfolio`/`blog`            | **120**                                                                      |
| Locales       | 9, incl. Arabic RTL                                                                | English only, by design                                                      |
| Design system | `REDESIGN.md` v3 "Liquid Luxury", fully applied                                    | shadcn semantic layer re-pointed under `.studio-v2`, with its own dark block |
| CI gates      | `redesign-audit` · `a11y-audit` · `keyboard-audit` · `e2e-smoke` · `motion-budget` | Studio audit at two widths                                                   |
| Condition     | **Finished and shipping**                                                          | **Functional, under-designed**                                               |

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
  through `next-intl` _and_ the copy registry (`npm run copy:registry`), then into all nine locales.
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

> **Verified against the live site and the code, 2026-09-15.** Every subsection below was checked
> before being acted on, and **four of the six turned out to describe a storefront this repo does
> not have.** The claims were written from an impression of the rendered page rather than from it;
> each is corrected in place, with what was measured.
>
> The pattern is worth stating once, because it cost four surveys to learn: **this section's
> "currently reads as…" judgements are the unreliable part, and its "not to touch" list is the
> reliable part.** Before building anything from §3, load the route in a browser and measure it.
> `scripts/preview-proxy.mjs` makes that a two-line job against any PR's own preview.
>
> One trap, which caught me: `MeniscusImage` opens its mask on an IntersectionObserver, so a
> stitched full-page screenshot photographs everything below the fold **mid-reveal**, as a pale
> wash that reads exactly like a broken image. `scripts/shots.mjs` already walks the page to avoid
> this. Use it rather than writing your own capture.

The live site's structure is sound. The work is craft, not composition. Ranked by visible return:

### 3.1 Typography and rhythm (highest return, lowest risk)

The v3 scale is `clamp()`d and correct, but applied evenly. A luxury surface earns its feel from
_contrast_ in the scale, not from more of it. Targets: the hero statement, section openers, the
manifesto band, pull-quotes. Keep `font-display`/`font-body`/`font-mono` roles exactly as the
contract assigns them — every price, dimension and eyebrow stays mono and tabular.

### 3.2 The collections band and the featured grid ~~— uplift~~ · CORRECTED

> ~~"They currently read as a grid of tiles. Uplift: asymmetric editorial composition, real crops
> from the new masters, `MeniscusImage` on each, and mono metadata that says something rather than
> repeating the title."~~
>
> **Every one of those was already true.** The band is a bento — the lead tile spans 8 of 12
> columns and two rows at 4:5, the other five take 4 columns at 3:4. Every tile renders through
> `MeniscusImage`. The mono eyebrow (`PRESERVE`) and the display promise ("Keep the day forever")
> are different strings, not a repeat, and `CollectionCard` already carries an optional mono
> footnote whose docstring explains why a count is NOT put there: §7.3, "a '139 pieces' label on a
> candle-holder category reads as dropship, not atelier". The featured grid is one hero at
> `col-span-7` beside three supporting at `col-span-5`, not the dense card grid described.
>
> **What was actually wrong, and this section never mentioned:** two of the six doorways —
> Gift and Print, measured in Chromium against the live site — rendered as a two-letter monogram
> on a flat block, because `CANONICAL_CATEGORIES[].image` was declared for all eight categories
> and written by no code path. Fixed in #64. A composition uplift would have restyled a band whose
> real problem was that a third of it had no picture.

### 3.3 Large-format work ~~— the homepage carousel~~ · CORRECTED

> ~~"the homepage carousel under-sells it."~~
>
> **There is no carousel.** The homepage large-format band is a 4-up scope grid at `aspect-[4/5]`
> with `MeniscusImage`, an intro and a CTA to `/large-resin-art`, reusing that page's own tiles and
> alt text rather than a second set. Whether it under-sells the apex is a judgement worth having —
> but it needs to be made about the grid that exists.

### 3.4 Product detail page (Part 9) — unverified as an uplift, verified as sound

The commerce split (gallery 60 / information 40), the spec sheet, the customization fields and the
WhatsApp order path all work. Do not touch the order logic; `e2e-smoke` asserts the wa.me round
trip and the `[DEMO] ` prefix.

> **Checked on a live PDP, 2026-09-15** (`/product/round-resin-mantra-frame-with-pink-texture`):
> breadcrumb, six-thumbnail rail, 60/40 split, mono category eyebrow, display `h1`, mono price,
> a MADE TO ORDER badge, the Customize and Ask-on-WhatsApp pair, and a three-line mono trust rail.
> That is Part 9. **No defect found to justify an "uplift" from the code**, so none was made — a
> visual change here needs the owner's eye on the rendered page, not an agent's on the markup.
>
> One factual observation, not a defect: every gallery image on that PDP is served from
> `cdn.shopify.com` at 1000×1000 into a 617px box, unoptimised. That is the DOCUMENTED fallback
> working as designed — `mirrorProductImage` keeps the original URL when the C3 mirror has not
> covered a row, and `isOptimizableImageSrc` degrades it to a raw `<img>` rather than crashing,
> because ~10k mirrored images through `next/image` would burn the very quota the mirror exists to
> save. What it indicates is **mirror coverage**, an operational question for the owner, not a code
> change.

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

> **Correction (2026-09-15, on implementing this).** The paragraph below said the Studio had
> _"52 routes reachable through one sidebar"_ and called it a _"flat list"_. **It was not flat.**
> `src/components/studio/sidebar.tsx` already grouped 31 nav destinations under six headings
> (`overview · catalog · commissions & content · growth · system · content arrangement`), with
> role filtering, and exported `SECTIONS` for the ⌘K palette and the breadcrumb bar to read.
> Anyone acting on the original text would have rebuilt something that existed.
>
> The complaint underneath it was real, and narrower: **the headings did not describe their
> contents.** `catalog` held Site Images, Site Copy, Page Sections, Navigation and Commission
> Form — none of them catalogue, and exactly the surfaces "where do I change the homepage hero?"
> has to search. `growth` held four import/export screens and the scraper, plus SEO under a
> comment that itself called SEO a settings surface. `commissions & content` held an inbox,
> analytics and a mailing list alongside six editorial surfaces. `content arrangement` was two
> items appended in a group of their own, under a comment admitting they belong with Page
> Sections.
>
> **Shipped instead:** a regrouping into six headings named for the job —
> `today · catalogue · site content · editorial · research · settings`. Same 31 destinations,
> same labels, same hrefs, no route touched. Six rather than the five below because splitting the
> site's own chrome from the work published on it leaves both coherent, where one `Content` group
> of thirteen does not. `sidebar.test.ts` now compares the list against the filesystem, so a
> screen dropped while regrouping fails CI instead of going quietly missing.

The original proposal, kept because it is what the grouping was measured against:

| Group         | Routes                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**     | Overview · Inquiries · Activity                                                                                                               |
| **Catalogue** | Products · Categories · Media · Import                                                                                                        |
| **Content**   | Site copy · Site images · Sections · Pages · Custom pages · Navigation · Forms · Process · Materials · FAQs · Blog · Portfolio · Testimonials |
| **Research**  | Scraper · Sources · Review · Quality · Mapping · Research · Content gaps                                                                      |
| **Settings**  | Settings · SEO · Users · Subscribers · Content Lab                                                                                            |

### 4.2 The draft/publish model ~~deserves to be visible~~ · CORRECTED — it already is

**The original text below was wrong, and it was checked by staging a real draft rather than by
reading the source.** Recipe in `CLAUDE.md` ("Running the Studio locally"): a throwaway Postgres,
`npm run build`, a staff row, then one `SiteCopy.draftValue` and one `SiteImage.draft` staged on
the same surface (Homepage).

What the two screens then showed:

| Screen                | What it rendered                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/studio/site-copy`   | a sticky `PublishBar`: **"2 changes on Homepage are not published yet"** — it counts the copy AND the image — plus a `/api/draft` Preview link and a **Publish Homepage** button |
| `/studio/site-images` | a **"Not published"** badge on exactly the staged slot, a per-group **Publish** button carrying the group's pending count, and Revision history                                  |

So the affordance the paragraph asks for — a persistent "N unpublished changes on this surface",
a preview link, a publish action — is built, on both screens, with the count scoped to the surface.

The two screens deliberately do it DIFFERENTLY, and `site-image-board.tsx` says why in a comment:
Site Images lists every group at once, so a second sticky bar would compete with the composer's,
and a per-group button is the honest shape for a screen with no single surface. A reviewer
measuring for site-copy's sticky bar specifically will conclude Site Images is missing the feature.
It is not — that was my own first reading, and it was wrong.

> **Original text, superseded:** "Every copy and image save stages in `draftValue`/`draft` and
> publishes per surface. That is a genuinely good model and the UI barely shows it. A persistent
> 'N unpublished changes on this surface' affordance, with a preview link and a publish action,
> converts a hidden safety feature into a visible one."

### 4.3 Data tables ~~— a single focused PR with outsized effect~~ · CORRECTED

**Every item this paragraph lists is already built.** Measured against a running Studio with a real
login and seeded content, not read off the markup:

| §4.3 / Part 12.5 asks for                                        | Found                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Sticky header                                                    | `position: sticky; top: 64px; z-index: 20` — and it sticks: the `thead` top went 351 → 64 after a 600px scroll           |
| Sortable columns                                                 | `sort-header.tsx`, on every list                                                                                         |
| Saved views as chips                                             | `saved-views.tsx`                                                                                                        |
| Checkbox selection + floating bulk-action bar                    | `bulk-bar.tsx` — the sanctioned `shadow-e3`, with `Esc` returning focus to the checkbox that raised it                   |
| Server-side pagination                                           | `pagination.tsx`; `products/page.tsx` does count → clamp → skip/take                                                     |
| Column visibility                                                | `columns-menu.tsx`                                                                                                       |
| Consistent empty state                                           | one `EmptyState`, used by 21 components                                                                                  |
| Typed confirmation for bulk destructive                          | `confirm-delete-dialog.tsx`, 20 call sites, arming on `count > 1`                                                        |
| Part 12.6 "tables become cards" on mobile                        | at 390px the `<table>` is `display:none` and card groups render — verified on products, inquiries, blog and testimonials |
| Part 12.3 KPI "large mono numerals, one hairline sparkline each" | four 44px **JetBrains Mono** numerals, four sparkline SVGs                                                               |

`studio-audit.mjs` also ran clean over **38 routes at both 1440px and 390px**.

So there is no "single focused PR with outsized effect" here; the effect has been had. Two things
are worth knowing rather than doing:

- **"numbers mono and right-aligned" is not a Studio rule.** Part 3.2 governs the storefront; the
  Studio has its own Part 12, which asks for mono numerals in the §12.3 KPI cards specifically —
  and those are mono. Applying Part 3.2 across the Studio would be over-reading the spec.
- **There is a real spelling inconsistency, and it is cosmetic.** Of the Studio's numeric
  treatments, 9 files use the `u-num` utility, 10 hand-write `tabular-nums` (mostly without
  `font-mono`, so they are tabular Inter, not mono), and 4 use neither. `u-num` is exactly
  `font-mono` + `tabular-nums` + `tnum`. Converging them is tidying, not a defect fix, and touching
  44 call sites for it is churn unless something else is already in those files.

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

| Gate                 | What breaks a redesign here                                                                                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redesign-audit.mjs` | Two `section-major` per page, three dark bands, never adjacent; one `h1`; no duplicated section heading; numbers in mono; alt text that describes the picture; no horizontal overflow; **any bundled image that loaded with `naturalWidth === 0`**; and a `reduce`-context pass that fails anything still animating. |
| `a11y-audit.mjs`     | axe-core critical/serious over 18 routes at 4 widths plus the RTL set.                                                                                                                                                                                                                                               |
| `keyboard-audit.mjs` | Drawer, search, mega menu and the three lightboxes: open, focus, arrows, Escape, focus return.                                                                                                                                                                                                                       |
| `motion-budget.mjs`  | 45 KB budget, 49 KB enforced ceiling. Adding `motion` fails this immediately (D29).                                                                                                                                                                                                                                  |
| `e2e-smoke.mjs`      | The order flow to `wa.me` with the right pre-filled message.                                                                                                                                                                                                                                                         |

Plus `copy:check` and `i18n-missing --stale` on every PR.

**At ≤700px the design audit drives a touch-capable context**, so the 44px tap floor _fails_ there
rather than being reported. Any new control must clear 44×44 with 8px separation at 390px and 360px.

---

## 6. Suggested PR sequence for workstream A

Each row is one reviewable PR that leaves the tree green.

| #   | PR                                                                          | Notes                                                                  |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A1  | v4 token extension in `tokens.css` + the utility bridge                     | Additive only. No component changes. Existing tokens keep their names. |
| A2  | Typography contrast pass — scale, tracking, measure                         | Storefront only. Highest return.                                       |
| A3  | Primitive refresh: buttons, inputs, cards, skeletons, empty states          | Both surfaces. Must ship all six states per §9.                        |
| A4  | Motion pass within budget — reveals, transitions, the two signature devices | `motion-budget` before and after, numbers in the PR body.              |
| A5  | Homepage: collections band, featured grid, large-format                     | Needs workstream D's masters wired first.                              |
| A6  | PDP gallery + spec sheet                                                    | Order logic untouched.                                                 |
| A7  | Studio shell + five-group navigation                                        |                                                                        |
| A8  | Studio data tables + draft/publish visibility                               |                                                                        |
| A9  | Studio scraper workspaces                                                   | **After** workstream B phase 6.                                        |

> **Where the table stands (2026-09-16).** A1–A3 shipped in #63 (the v4 leading scale, the
> typography pass, one disabled state); A5's real defect shipped in #64 (two blank doorways);
> A7 shipped as the six job-named nav groups (§4.1). A2, A4, A6 and A8 were measured against
> the running site rather than built: §3.2, §3.3, §4.2 and §4.3 record what was found already
> in place, and §3.4 found no PDP defect to justify an uplift without the owner's eye. **A9
> shipped 2026-09-16 (PR #86)**, after B1–B9 closed: `/studio/scraper/runs` (the feed, with
> retry queuing a fresh job and cancel writing an operator-named terminal row),
> `/studio/scraper/explorer` (raw beside normalized, "showing X of N") and
> `/studio/scraper/large-format` (image-first cards, B9 neighbours, the INSPIRATION_ONLY
> reference board). **The table is closed.** What remains for the storefront is workstream E's
> tier-specific card, PDP and shop work in [`07`](07-three-tier-architecture.md), which reads
> this document's §3.6 and REDESIGN.md §1.1 before every step.

Per `CLAUDE.md`: every PR is `feat|fix|chore|refactor(scope): message`, small and verified —
typecheck, lint, build, 360px and 1280px, keyboard, reduced-motion, screenshots.
