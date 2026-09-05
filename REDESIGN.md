# RIVYA LIVING ART — Master UI/UX Redesign Specification

**v1.0 · Consolidated**
**Storefront:** www.rivyalivingart.com · **Studio:** /studio
**Scope:** visual design, UI and UX only

This document merges three sources into one buildable spec:

| Source | What was taken |
|---|---|
| **A** — Complete UI/UX Redesign & Visual Implementation Specification | Scope rules, north star, design personality, colour system, type scale, grid, radius logic, header/mega-menu structure, homepage section order, collection naming, mobile bottom bar, priority tiers, 23-step build order, Figma structure, token naming, QA question sets, page-purpose table, scorecard |
| **B** — Master UI/UX Redesign & Implementation Specification | Monospace numeric face, before/after preservation slider, 48px carousel controls, reading-progress bar, Kanban production board with stage timers, media library AI indicator, Higgsfield prompt-catalog format, component code patterns |
| **C** — Live site audit (22 Aug 2026) | Section-by-section findings, duplicate-block fixes, empty-accordion fix, empty-state contradictions, filter-chip gaps, state design, accessibility standards, motion discipline |

---

## 0. Decisions log — where the sources conflicted

These are resolved. Build to the right-hand column.

| # | Conflict | Decision | Why |
|---|---|---|---|
| 1 | Palette: A `#080A0E / #08283A / #164E6B / #F4F1E9 / #E7E0D5 / #B89B63` vs B `#040813 / #0A1128 / #1E6F9F / #D4AF37` | **Source A's palette is canonical.** | A's champagne `#B89B63` is muted and reads as real gold leaf; B's `#D4AF37` is saturated costume gold. A's Deep Ocean matches the existing brand. |
| 2 | Glassmorphism (B: `.glass-luxury-dark`, gold glows, `rounded-3xl`) | **Rejected**, with one exception: the header may use a light backdrop-blur on scroll (A §16 already calls for this). | Frosted panels + gold glow + 24px radius is the single most common AI-luxury template look. A §13 explicitly calls for an architectural, low-radius language. The two cannot both be true. |
| 3 | Typeface | **Display: Instrument Serif. Body: Inter. Numerals: JetBrains Mono.** | A's first display choice, A's body choice, B's numeric face. All three sources land here once merged. |
| 4 | Cart / Bag / Wishlist / Razorpay Instant Buy / currency switcher (B §2, §3.1) | **Rejected.** | A §01 and §177 forbid changing order logic. Rivya Living Art has no checkout — everything finalises on WhatsApp. Adding a Bag would be a business change wearing a design costume. Wishlist stays (D11, 2026-09): an account-less local list; it is not a bag. |
| 5 | "14-day curing", walnut/teak species selector, river dining tables, epoxy volume calculator (B) | **Rejected as written; the *patterns* are kept.** | The live site states 24–72 h per layer, 7–10 days for small pieces, 3–6 weeks for statement pieces. Kanban stage timers and spec selectors are good ideas — they must carry Rivya Living Art's real numbers, not invented ones. |
| 6 | Client order-lookup tab on the login screen (B §4.1) | **Deferred.** Documented in §12.6 as an optional future feature, not part of this redesign. | It is new functionality, outside the stated scope. |
| 7 | A separate `/preservation` route (B §5) | **Rejected as a new route.** Delivered instead as the Varmala Preservation **collection landing page**, which A §59 already specifies. | Keeps existing URLs. Same outcome, no route churn. |
| 8 | Mobile WhatsApp FAB (C) vs mobile bottom bar (A §110) | **Bottom bar wins on mobile.** The floating WhatsApp button exists on desktop only. | Two persistent WhatsApp affordances on a 375px screen is one too many. |
| 9 | Number of homepage sections | **13** (A's structure, with C's duplicate-block deletions applied). | |
| 10 | 360° turntables, verified review wall, UGC masonry (B) | **Out of scope.** | Both depend on content that does not exist yet. Noted in the backlog. |

---

# PART 1 — Scope

## 1.1 Do not change

Product data · customization logic · filtering · search · WhatsApp ordering · custom-order form fields · image upload · contact form · newsletter · portfolio, blog and workshop management · admin authentication · Studio/CMS functionality · existing URLs and routes · backend and API behaviour · database content · order logic.

## 1.2 Change only

Visual hierarchy · layout · typography · colour · spacing · components · navigation presentation · product-card design · product-page design · image treatment · motion · responsive behaviour · UX clarity · information-architecture *presentation* · interaction design · editorial storytelling · dashboard visual design.

## 1.3 The rule

> **Recompose → simplify → prioritize → style → animate → responsive-optimize.**

Do not rebuild functionality. Do not remove content unless it is visually duplicated.

---

# PART 2 — Objective & north star

## 2.1 The problem

The site already carries good brand storytelling (`Liquid luxury, cast forever.`, `Slow made, made once`, `From idea to heirloom.`). What it lacks is hierarchy. Luxury resin art, gifts, supplies, 3D printing, workshops, portfolio, editorial and a large catalogue are all presented at the same visual weight, in the same width, with the same padding.

## 2.2 The goal

Make it read as **a contemporary luxury craft atelier with an integrated ecommerce catalogue** — not a large Shopify-style catalogue.

## 2.3 The test

Every screen must pass: **Premium? Artistic? Crafted? Personal? Calm? Editorial? Trustworthy?**
If a component looks like a generic ecommerce template, redesign it.

## 2.4 Design personality

| Mode | Delivered by |
|---|---|
| Luxury editorial | Large typography, large photography, strong whitespace, minimal UI |
| Contemporary craft | Natural textures, hands, material close-ups, studio photography |
| Digital gallery | Large visual presentation, minimal product metadata, immersive transitions |
| Modern ecommerce | Clear product information, fast scanning, simple filters, obvious CTA |

Sit between a contemporary art gallery, a luxury fashion site, an independent artisan studio and premium ecommerce. Avoid Etsy, Amazon, generic Shopify themes and decorative handmade-craft styling.

## 2.5 Each page has one job

| Page | Job |
|---|---|
| Homepage | Emotional |
| Shop | Efficient |
| Product | Desirable + informative |
| Collection | Editorial entry point |
| Portfolio | Artistic |
| About | Personal |
| Process | Educational |
| Custom order | Confident + simple |
| Workshops | Experiential |
| Journal | Editorial |
| Studio | Operational |

One visual language, nine different jobs.

## 2.6 The signature element — the Cure Line

The one thing this site will be remembered by, and the one place boldness is spent.

A 1px vertical hairline in the left gutter that **fills as the page scrolls**, notched with short ticks at each section boundary, each tick labelled in 11px mono (`01 · THE POUR`, `04 · CURE 72H`). It is a resin level rising in a mould, a scroll-progress indicator and a section nav at once. Source A §76 already asks for exactly this on the process page — it is promoted to a global device.

- Desktop ≥1024px: fixed left, 56px gutter reserved outside the content shell.
- Below 1024px: collapses to a 2px top progress bar with the active section label.
- Reduced motion: renders as a static ruler with the active tick marked.

Everything else stays quiet around it.

## 2.7 The second device — the meniscus reveal

No image on this site fades in. Images are revealed by a horizontal edge rising from the bottom of the frame, with a brighter 1px leading line and a slight vertical squash settling out (`scaleY(1.015) → 1`). It reads as liquid filling a frame. One curve, one duration, used for every image reveal, card hover swap and gallery change. This replaces every generic fade-up.

---

# PART 3 — Design system

## 3.1 Colour

| Token | Hex | Role |
|---|---|---|
| `--color-obsidian` | `#080A0E` | Hero, footer, premium sections, Studio UI, dark product presentation |
| `--color-deep-ocean` | `#08283A` | Brand backgrounds, highlighted sections, resin storytelling |
| `--color-sapphire` | `#164E6B` | Primary action, links, cure-line fill, focus ring |
| `--color-sapphire-hi` | `#1D6389` | Hover only |
| `--color-mineral` | `#F4F1E9` | Light page ground |
| `--color-sand` | `#E7E0D5` | Warm neutral — alternate section ground, card surface |
| `--color-champagne` | `#B89B63` | Accent. Tiny highlights, active states, micro-labels, hairlines |
| `--color-ink` | `#12141A` | Body text on light |
| `--color-graphite` | `#5B6068` | Secondary text, all mono metadata (4.7:1 on mineral) |
| `--color-mist` | `#A9B4BC` | Secondary text on dark |
| `--color-hairline` | `rgba(18,20,26,.12)` | Every divider on light |
| `--color-hairline-dk` | `rgba(244,241,233,.16)` | Every divider on dark |
| `--color-whatsapp` | `#128C7E` | WhatsApp actions only, never decorative |
| `--color-alert` | `#9B3A2E` | Errors, destructive |
| `--color-success` | `#2C6B5B` | Success, in-stock |

**Champagne discipline.** Never a fill. Never a button background. Never text below 16px. **Maximum two champagne elements visible in any viewport** — if a third appears, delete one. This single rule is what separates real luxury restraint from gold-plated template.

**Dark-band rhythm.** Dark sections never sit adjacent. Always `light → dark → light`. Maximum three dark bands per page.

## 3.2 Typography

| Role | Family | Used for |
|---|---|---|
| Display | **Instrument Serif** | Hero, major section headings, campaign statements, editorial headings, pull-quotes |
| UI / Body | **Inter** | Navigation, product info, buttons, forms, paragraphs |
| Numeric / Meta | **JetBrains Mono** | Every price, count, date, dimension, project number, cure time, timer, spec value, eyebrow label |

The third face is the most important addition in this whole document. Right now prices, cure times, project numbers and dates all sit in the same face as body copy, so none of them read as *data*. Moving every number to a tabular monospace changes the character of the site more than any layout move.

### Scale — desktop

| Level | Size | Settings |
|---|---|---|
| Hero | `80–120px` | Instrument Serif 400, tracking `-.02em`, leading `.95` |
| H1 | `64–88px` | Instrument Serif 400, leading `1.0` |
| H2 | `48–64px` | Instrument Serif 400, leading `1.08` |
| H3 | `28–36px` | Instrument Serif 400 or Inter 500, leading `1.2` |
| Body | `16–18px` | Inter 400, leading `1.65` |
| Small | `13–14px` | Inter 400 |
| Micro / meta | `11–12px` | JetBrains Mono 400, tracking `.14em`, uppercase |

### Scale — mobile

Hero `48–64px` · H1 `40–52px` · H2 `34–42px` · H3 `24–28px` · Body `15–17px`. Implement with `clamp()` so there is one scale to maintain, not two.

### Rules
- Prose measure never exceeds `68ch`; preferred `600–720px`. Section intros cap at `52ch`.
- **Every eyebrow** on the site (`the signature`, `bespoke commissions`, `our process`, `from the journal`) becomes mono micro, left-aligned, with an optional index number and a 24px champagne hairline to its left.
- Sentence case for headings and buttons. Uppercase only for mono micro labels.
- `font-variant-numeric: tabular-nums` on every numeric element.

## 3.3 Grid

- 12 columns, max content `1440px`, column gap `24px` (`16px` under 768px).
- Horizontal padding: desktop `48–72px` · tablet `32–48px` · mobile `20–24px`.
- On ≥1024px, a **56px cure gutter** sits outside the content shell at the left.
- **Editorial split:** text cols 1–7, sticky mono metadata rail cols 9–12.
- **Commerce split:** gallery cols 1–7 (60%), information cols 8–12 (40%).

## 3.4 Spacing

8px base: `8 · 16 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 120 · 160 · 200`.

Three section tiers, and **this is the fix for the flat hierarchy**:

| Tier | Padding | Used for | Limit |
|---|---|---|---|
| `major` | `120–200px` | Hero, the one climax section, dark storytelling bands | **Max 2 per page** |
| `standard` | `80–120px` | Most sections | |
| `compact` | `24–48px` | Rails, related items, breadcrumbs, CTA strips | |

## 3.5 Border, radius, elevation

- **Borders:** 1px only, at very low contrast. Separate content with whitespace, image, typography and background change — not boxes.
- **Radius:** buttons `999px` · inputs `0–4px` · product cards `0–4px` · image containers `0–2px` · large editorial blocks `0`. The language is architectural, not SaaS.
- **Elevation:** no drop shadows. Separation comes from hairlines and surface tone shifts (`mineral` → `sand`). Two exceptions: the mobile bottom bar (`0 -1px 0 var(--color-hairline)`) and the Studio dashboard's floating bulk-action bar.
- **Blur:** permitted in exactly one place — the sticky header on scroll.

## 3.6 Buttons

| Variant | Style | Example |
|---|---|---|
| Primary | Solid `--color-obsidian`, white text, radius 999px | `Explore the collection` |
| Secondary | Transparent, underline draws L→R on hover | `View the work →` |
| Premium | 1px champagne outline on dark, fills to obsidian text on champagne at hover | `Commission your piece` |
| WhatsApp | Solid `--color-whatsapp`, white text | `Continue on WhatsApp` |
| Ghost | Text with an animated underline | In-card links |

Sizes `sm 40px` / `md 48px` / `lg 56px`. Label: Inter 500, sentence case, never all-caps.
**No scale or lift on hover** — colour and underline only.
Disabled = 40% opacity **plus** a mono reason line beneath (`Add your phone number`). Never a silently dead button.
Loading = inline spinner replacing the label, width locked.

Keep WhatsApp recognisable but integrated. It is the order channel, not the brand.

## 3.7 Icons

One family: **Lucide**, stroke `1.5px`, 24px box. Never mix icon sets. Icons support text; never use an icon alone where the user must understand an action without context. **Never** an icon per benefit — the "Why Rivya Living Art" and "What we hold to" blocks use mono numerals and photography instead.

## 3.8 Motion tokens

```
--ease-luxury:  cubic-bezier(0.16, 1, 0.3, 1);   /* the house curve */
--ease-settle:  cubic-bezier(0.22, .61, .36, 1); /* UI state changes */
--dur-fast:  180ms;
--dur-base:  350ms;
--dur-slow:  800ms;
--dur-reveal: 900ms;
```

---
# PART 4 — Component system

Build the system before any page. Every component ships with all six states: **default · hover · focus · active · disabled · loading**.

## 4.1 Global
`Header` · `MegaMenu` · `MobileNav` · `MobileBottomBar` · `AnnouncementBar` · `Footer` · `WhatsAppButton` · `Breadcrumb` · `PageHero` · `SectionHeading` · `CureLine` · `MeniscusImage` · `Marquee`

## 4.2 Commerce
`ProductCard` · `ProductGrid` · `CollectionCard` · `ProductGallery` · `ProductInfo` · `FilterDrawer` · `SortMenu` · `Price` · `CustomizationSelector` · `RelatedProducts` · `StickyBuyBar` · `WhatsAppSummaryCard`

## 4.3 Editorial
`EditorialHero` · `ArticleCard` · `StoryBlock` · `ImageText` · `CaseStudyCard` · `Quote` · `MaterialCard` · `ProcessStep` · `BeforeAfterSlider` · `Timeline` · `ReadingProgress`

## 4.4 Forms
`Input` · `Textarea` · `Select` · `Radio` · `Checkbox` · `Upload` · `Progress` · `Summary` · `Error` · `Success` · `Toast`

## 4.5 Studio
`Sidebar` · `Topbar` · `KPI` · `DataTable` · `Kanban` · `StatusBadge` · `MediaGrid` · `EditorPanel` · `ActivityFeed`

---

## 4.6 Key component specifications

### `SectionHeading`
Mono eyebrow (optional index + 24px champagne hairline) → display heading → optional 52ch intro → optional right-aligned text link. **Left-aligned in cols 1–7.** Used ~40 times; one component, no variants beyond alignment.

### `ProductCard`
```
┌─────────────────┐
│                 │  4:5 image, radius 0–4px
│      image      │  hover → second image via meniscus wipe (350ms)
│                 │  one badge max, top-left, mono micro
├─────────────────┤
│ COLLECTION      │  mono micro, graphite
│ Piece name on   │  Inter 500, line-clamp 2
│ two lines       │  full title stays in the DOM — no "…" in the accessible name
│ ₹9,499          │  JetBrains Mono tabular
│ Made to order   │  mono micro
│ View piece →    │  ghost link, underline draws on card hover
└─────────────────┘
```
**No large button inside the card.** The whole card is the target.
**Badges:** one per card, only three exist — `Atelier pick` (hard cap of 12 across the whole site), `Made to order`, `Ships in 7–10 days`. A curation badge applied to everything signals nothing.
**Compact variant** for items under ₹1,000: 1:1 image, single-line title, price only, no badge, no link, 4–6 up. This is what stops a ₹8 part sharing visual furniture with a ₹16,499 frame.
**Image discipline:** one ratio per context, clean background, controlled shadow, consistent lighting and scale. Never mix random aspect ratios in one grid.

### `CollectionCard`
Large editorial tile, not a small ecommerce card:
```
┌───────────────────────────┐
│                           │
│          IMAGE            │  3:4 or 4:5
│                           │
│ PRESERVE                  │  display-s
│ Keep the day forever →    │  small + arrow
└───────────────────────────┘
```

### `FilterDrawer`
Desktop `420–480px` right drawer; mobile bottom sheet at 70–90% height, slide-up `350ms`. Accordion sections: Collection · Occasion · Price · Availability. Every option carries a live count in mono; zero-count options disable rather than disappear. Sticky footer: `Clear all` ghost + `Apply (48 pieces)` primary.

### `Active filter chips`
Directly under the toolbar, one chip per active filter with an `×`, plus `Clear all` and a live result count. **The single most important missing control on the current shop page** — you cannot presently see or undo what you have applied.

### `Accordion`
56px rows, chevron rotates 180° over 180ms, open via `grid-template-rows: 0fr → 1fr` at 350ms. Single-open per group. Deep-linkable by hash so a specific FAQ answer can be pasted straight into a WhatsApp reply. **An accordion with no content must not render** — three empty accordions currently make the product page look broken.

### `Upload`
```
+ ADD REFERENCES

Drop images here or browse
JPG · PNG · WEBP · MAX 5 MB          0 / 5
```
Dashed 1px hairline zone, 120px. Drag-over fills to sand with a sapphire hairline. Uploaded files render as 64px thumbnails with a per-file progress hairline and an `×`. Failures show inline with a `Retry` link.

### `WhatsAppSummaryCard`
Keep the existing live-summary functionality — it is genuinely good UX. Redesign it as a premium summary card: mono text on a sand ground, radius `4px 4px 4px 0`, empty fields shown as `Name: —` in graphite so the user can see what is still missing. **Collapsed by default** behind `Preview your message ▾`. Desktop: sticky right column. Mobile: expandable bottom sheet.

### `BeforeAfterSlider`
Draggable vertical divider, 1px sapphire line, 40px circular handle with a champagne hairline ring. Corner labels in mono (`BEFORE` / `AFTER`). Keyboard operable with arrow keys, `role="slider"`, `aria-valuenow`. Used on varmala collection pages and portfolio case studies.

### `CarouselNav`
48×48px circular buttons, 1px hairline, Lucide chevron, hover raises border contrast, `active:scale-95`, disabled at 30% opacity with pointer events off. Full touch-swipe on mobile and tablet. Never smaller than 44px.

### `Toast`
Bottom-centre mobile, bottom-left desktop. 320px, obsidian, white text, 3px left border in success or alert colour, auto-dismiss 5s with a hairline countdown, paused on hover/focus. `role="status"` for success, `role="alert"` for errors.

### `EmptyState`
No illustration, no icon. Statement → one line of direction → one primary action.
> **No commissions yet.**
> Your next project starts with an idea.
> `Start a commission →`

Must be conditionally rendered — never shown alongside populated content.

### `Skeleton`
Flat sand blocks at exact final dimensions. Text lines render as 1px hairlines at the right widths. **No shimmer** — it fights the meniscus language. Never a spinner where a skeleton will do.

### `ErrorState`
Human language, never technical.
> **Something went wrong.** Please try again.
Plus a retry action and a WhatsApp escape hatch.

---

# PART 5 — Global chrome

## 5.1 Announcement bar
36px, obsidian, 1px champagne bottom hairline at 15%, 11px mono uppercase, centred, dismissible (persists 30 days). Rotates through up to three messages every 6s with a 300ms crossfade; pauses on hover/focus; frozen under reduced motion. Content should be a fact, not a slogan: `CURRENT LEAD TIME · SMALL 7–10 DAYS · STATEMENT 3–6 WEEKS`.

**No currency switcher.** **Language moves to the footer** — it is not a primary navigation act, and it currently occupies prime header space.

## 5.2 Desktop header

The current header exposes Shop, Resin Art & Gifting, Studio Supplies, 3D Printing, Custom Order, Workshops, Portfolio, Blog, Search, About, Process, FAQ and Contact. That is excessive density, and Search — on a 4,386-item catalogue — is currently a footer link.

```
┌ cure ┬──────────────────────────────────────────────────────────┐
│      │ RIVYA LIVING ART      Shop  Bespoke  Studio  Journal    ⌕  ◉ WA │
└──────┴──────────────────────────────────────────────────────────┘
   72–80px · transparent at top · opaque + blurred + compact on scroll
```

- **Left:** RIVYA LIVING ART wordmark. Give the home link a real accessible name — it currently renders as a literal `/`.
- **Centre:** four items only — **Shop · Bespoke · Studio · Journal**.
- **Right:** Search · WhatsApp · Menu.
- Active route marked by a 1px sapphire underline offset 6px below the baseline; hover draws that underline left→right over 180ms.
- **Scroll behaviour:** transparent over dark heroes with white text; after 80px becomes opaque `mineral` with a light backdrop-blur and a bottom hairline; hides on scroll-down past 400px, returns immediately on scroll-up with an 8px threshold so it never flickers.

## 5.3 Mega menu

Visual, not a link dump. Full-width panel, mineral ground, 1px hairline, 32px padding, opening on a 120ms hover-intent delay **and** on click/Enter. Closes on `Esc`, outside click, or focus leaving. 200ms fade + 6px rise.

```
SHOP
┌──────────────┐  Home Decor        ┌──────────────┐  ┌──────────────┐
│  RESIN ART   │  Trays             │ 3D PRINTING  │  │  SUPPLIES    │
│  (image)     │  Frames            │  (image)     │  │  (image)     │
└──────────────┘  Preservation      └──────────────┘  └──────────────┘
                  Gifts                                Explore all pieces →
```

## 5.4 Mobile navigation

Top bar: logo · search · menu. The drawer is full-height obsidian entering from the right over 320ms, items staggered 40ms, focus trapped, background `inert`, `Esc` closes, body scroll locked, 48px close target.

**Do not put ten links in the mobile menu.** Use sections: *Shop* / *Bespoke* / *Studio* / *Journal*, with secondary links (About, Process, FAQ, Contact) below a divider at small size, then language and social.

## 5.5 Mobile bottom bar

Fixed, `64–72px`, mineral with a top hairline and a safe-area inset:

```
HOME  |  SHOP  |  SEARCH  |  WHATSAPP  |  MENU
```

Active item marked with a sapphire dot and a filled label. **Because this exists, there is no floating WhatsApp button on mobile** — the desktop FAB remains, appearing after 25% scroll, and is suppressed on product and commission pages where a sticky action bar already occupies that role.

## 5.6 Search overlay

Full-screen dark overlay, obsidian at 92%, large field:
> **Search the studio…**

Results appear from the second character, debounced 180ms, grouped under mono headings — **Products · Collections · Portfolio · Journal**:
- Product result: image + name + price
- Journal result: image + title + category
- Portfolio result: image + project name

Empty input shows `Recent` plus six suggestion chips. Full keyboard loop (`⌘K` / `/` to open, ↑↓ to move, Enter to open, Esc to close).

**No results:**
> **Nothing found.**
> Try another search — or `Start a bespoke commission →`

## 5.7 Footer

Large dark obsidian footer. Do not repeat every navigation item.

**CTA band above it:**
> **Have something in mind?**
> **Let's make it real.**
> `Start a commission`

**Four columns:**

| Explore | Studio | Journal | Contact |
|---|---|---|---|
| Shop · Collections · Bespoke | About · Process · Workshops | Stories · Guides | WhatsApp · Email · Studio address |

Plus: wordmark, one-line brand statement, newsletter, social, language control, and a single legal rail (`© 2026 Rivya Living Art · Privacy · Terms · Made in India ✦`).

**Delete the raw `wa.me` URL currently rendered as visible link text in the footer.** Include the studio address as real text, not just a Maps link.

## 5.8 Newsletter

One component, two placements only (footer, journal index) — it currently appears twice on the homepage, once under a duplicate "Notes from the studio" heading. Dark section, large display heading, one line of copy, single field, `Subscribe`. Real states: idle → submitting → success (`You're on the list.`) → already subscribed → error with retry. Helper line in mono: `THREE OR FOUR LETTERS A YEAR`.

---

# PART 6 — Homepage

Current content is valuable; the hierarchy has to be rebuilt. Thirteen sections, two of them `major`.

> **Recorded divergences (2026-09-05).** The shipped page is SEVENTEEN sections
> and one `major`, and the difference was never written down, so every reader of
> this Part measured the page against a sentence it had outgrown.
>
> - `largeFormat`, `furniture`, `rooms` and `words` were added after this Part
>   was written. `furniture` and `rooms` ship `defaultVisible: false`, so the
>   default page is fifteen; four more are `conditional` and render nothing on
>   an empty database, so a fresh install is eleven.
> - §01 is spec'd `major` and does not carry the `section-major` class: it is
>   `min-h-svh` with its own padding, and the class's vertical rhythm would
>   fight that. The consequence is measurable — `redesign-audit.mjs` counts
>   `major` by class, so it sees one where the spec allocates two — and it is
>   deliberate. Both `major` slots are spoken for (§01 and §08); a new band
>   claiming the "spare" one is spending a slot this Part already assigned.
> - §01's display line reads **Cast for the room it will live in.** on the
>   shipped site, not the line below. Owner decision, 2026-09-05: the studio
>   makes to order for a specific space, and the headline now says so.
>   `Liquid luxury, cast forever.` survives as the name of the design system
>   (Part 3) and in the §5.8 brand-storytelling note above.

### 01 · Fullscreen hero — `major`
Height `100svh`. Full-bleed cinematic visual, dark gradient overlay `rgba(8,10,14,.6)`. **Text bottom-left, not centred.**

- Mono eyebrow: `CUSTOM RESIN ART · 3D PRINTING · MADE TO ORDER`
- Display: **Liquid luxury,<br>cast forever.** (80–120px)
- Description, 18px, 1.6 leading
- Primary `Explore the collection` · Secondary `Commission a piece`
- Fact row in mono replacing the existing three-item list: `SURAT, INDIA · MADE TO ORDER · ₹380–₹50,000 · 7 DAYS–6 WEEKS`
- Scroll indicator: a thin vertical line with a slowly pulsing champagne droplet

**Media:** hybrid — real product footage where it exists, Higgsfield atmospheric transitions elsewhere (`HF-HERO-POUR-01`).
**Motion:** slow fade in; headline rises 20–40px; image scales `1 → 1.04` over 4–8s. No aggressive zoom.

### 02 · Manifesto — `standard`
Large blank space. Centred type — the **only** centred block on the site.
> **Objects made slowly.**
> **Memories made permanent.**

Short paragraph beneath. No cards, no CTA. This is the breathing room the current page never takes.

### 03 · Featured pieces — `standard`
Do not open with eight dense cards. One hero piece plus three supporting:

```
┌─────────────────────┬───────────┐
│                     │ Product 02│
│     HERO PIECE      ├───────────┤
│                     │ Product 03│
├─────────────────────┴───────────┤
│ Product 04       View collection│
└─────────────────────────────────┘
```

### 04 · Material story — `major`
The climax. **The current page renders "From liquid to light" twice — delete the duplicate and keep one exceptional version.**

Left: sticky full-height video. Right: `01 POUR · 02 GILD · 03 CURE · 04 POLISH`. Scrolling changes the visual; the active step is full opacity, the rest at 30%. Transitions `600–1000ms` using opacity, blur, scale and mask reveal. The existing `/sequences/pour-cure/` frames can drive this directly.
Below 1024px or under reduced motion: four static frames stacked, no pin, no scrub.

### 05 · Collections — `standard`
Reduce the many visible categories to six editorial tiles:

| | |
|---|---|
| **PRESERVE** — wedding flowers and memories | **KEEP** — photo frames and keepsakes |
| **LIVE** — home objects | **GIFT** — personalised gifts |
| **CREATE** — bespoke commissions | **PRINT** — 3D objects |

This absorbs and replaces both the 8-link collections list and the "three studios" block, which currently compete on adjacent screens.

### 06 · The maker — `standard`
Left: portrait or studio photograph. Right:
> **Made by one pair of hands.**

Short story. `Meet the maker →`.
**Use real photography.** Higgsfield may supply supplementary cinematic studio visuals but must not replace the maker portrait.

### 07 · Recent commissions — `standard`
Editorial, not a grid: one huge image, two smaller, project title, tiny description, `View all commissions →`. Project numbers in mono over the image corner. This is the strongest proof on the site and currently sits eighth.

### 08 · Bespoke — `major`-weight dark band
Full-screen dark. **Made to your story.** Visual: wedding flowers embedded in resin.
> Your flowers.
> Your names.
> Your dates.

`Start a commission`.
Desktop interaction: mouse movement shifts the flower image, resin surface and typography in layered parallax, capped at `20–30px`.

### 09 · 3D printing — `standard`
Visually separated from resin: technical, monochrome, dark.
> **From digital form<br>to physical object.**

Show CAD → print → finished piece. `Explore 3D printing`.

### 10 · How it works — `standard`
Keep Choose → Customize → WhatsApp → Craft & Deliver. Change the presentation to a horizontal timeline with a connecting hairline that draws on scroll, one visual per step, numerals in mono. Add the missing reassurance line: `No payment on this website — price is agreed on WhatsApp before anything is poured.`

### 11 · Why Rivya Living Art — `standard`
Turn the existing three claims into four proof points with photography, no icons:
**HANDCRAFTED** every piece passes through human hands · **BESPOKE** built around your story · **SLOW MADE** time is part of the process · **HEIRLOOM** made to be kept.

**Delete the current stat row** (`100% handcrafted / 500+ hours / 1 of 1`) and replace with defensible mono facts: `24–72 H PER LAYER · 400→3000 GRIT · 20 COMMISSIONS DOCUMENTED`.

### 12 · Journal — `standard`
Three articles only: one large featured, two smaller. No tag wall. **The only section allowed the heading "Notes from the studio."**

### 13 · Newsletter + final CTA — `compact` + dark band
Minimal newsletter, then:
> **Commission something<br>that exists only once.**
> `Start a commission` · `WhatsApp the studio`

### Deleted from the homepage
Duplicate "From liquid to light" · the 8-link collections list · the separate "three studios" block (absorbed into 05) · the arbitrary single-featured-piece block · the second portfolio strip · the second marquee · the standalone duplicate newsletter section.

**Cure Line marks:** `POUR · MANIFESTO · PIECES · MATERIAL · COLLECTIONS · MAKER · WORK · BESPOKE · PRINT · PROCESS · JOURNAL`

---
# PART 7 — Shop

Functionality stays. The UI changes dramatically.

### 7.1 Shop hero — `compact`
Breadcrumb, then:
> **The Collection**
> Objects, keepsakes and pieces made to order.

No hero image — this is a working page.

### 7.2 Category switcher
Large text tabs on desktop, horizontal scroll on mobile:
`ALL · RESIN ART · GIFTS · SUPPLIES · 3D PRINTING`
Active tab: sapphire underline. Not a row of buttons.

### 7.3 Collection strip
Horizontal scroll of collections as 3:4 image tiles with names overlaid. Art is browsed by look, not by list. Counts hidden here — a `139 pieces` label on a candle-holder category reads as dropship, not atelier.

### 7.4 Toolbar
Sticky under the header at 64px. Left: search-within-shop. Right: a labelled `Sort` control opening a proper menu (`Featured · Newest · Price low→high · Price high→low · Name`) — not a bare `select`. Then `Filter` opening the drawer.

**Do not show every filter permanently.** The current always-open sidebar with 21 collections and counts up to 1,841 is the main source of visual overwhelm.

### 7.5 Active filters
Chip row beneath the toolbar with `×` per chip, `Clear all`, and a live count in mono.

### 7.6 Grid
Desktop 3 columns · tablet 2–3 · mobile 2. Large images, generous whitespace, `ProductCard` with the compact variant auto-applied under ₹1,000.

Insert one full-width editorial break after row three — a case study or process teaser — to break the endless-grid feel.

### 7.7 Pagination
Numbered, mono, with prev/next. Keep `Load more` as an option, but 24-at-a-time behind a single button on 4,386 items is 183 taps. Never infinite scroll.

### 7.8 States
*Loading:* nine flat skeleton cards, filters stay interactive.
*Empty:* `No pieces match those filters yet.` + `Clear all` + `Start a commission`.
*Error:* `Couldn't load pieces.` + `Try again`.

---

# PART 8 — Collection pages

Every collection behaves like a mini editorial landing page.

1. **Hero** — full-width image, text overlay, small mono category label, large serif heading, `Explore pieces`.
   > **Keep the flowers.**
   > **Keep the day.**
2. **Short explanation** — 200 words, cols 1–7. Unique per collection.
3. **Before/after slider** — on Varmala Preservation and any transformation-led collection. This is where source B's preservation concept lands, without adding a route.
4. **Product grid** — as §7.6.
5. **Related collections** strip.
6. **Commission CTA.**

---

# PART 9 — Product detail page

Major redesign. Desktop split: **60% gallery / 40% information.**

### 9.1 Gallery (60%)
Main image with hover pan-zoom, vertical thumbnail rail with an active champagne border, video thumbnail where available, full-screen lightbox (obsidian at 96%, mono counter `03 / 07`, arrows, pinch-zoom, `Esc`, focus returned to trigger). Mobile: swipe with a mono counter.

Four defined image roles in order: **hero · detail macro · in-room scale · process.**

### 9.2 Information panel (40%) — sticky
Order:
1. Collection (mono)
2. Product name (display)
3. Price (mono tabular)
4. Short description
5. Customization note
6. Production information (lead time chip)
7. Primary CTA: **Customize this piece**
8. Secondary CTA: **Ask on WhatsApp**

Keep the existing trust list (`Poured, cured & finished by hand` etc.) but place it **below** the CTA as a hairline-divided mono list, where it reassures rather than delays.
Keep the live WhatsApp summary, collapsed behind `Preview your message ▾`.
Ask for **name and phone only** — email is redundant when the next step is a WhatsApp thread.

Do not make the CTA area visually noisy.

### 9.3 Customization UI
Functionality unchanged; presentation changes from generic dropdowns to:
- colour **swatches** (circular, champagne ring when selected)
- material **chips**
- size **cards** with a small silhouette indicating scale
- engraving input with a **live typography preview**
- image upload as the visual `Upload` component

### 9.4 Information sections below the hero
Large alternating image/text blocks, so the page reads like an editorial article:

```
IMAGE
        THE PIECE
        MATERIALS
        DIMENSIONS

        IMAGE
CUSTOMIZATION
        HOW IT'S MADE
        CARE
        DELIVERY
```

Then **RELATED PIECES** — one rail of four, same collection, price within ±60%. Delete the second near-identical rail ("From the same shelf").

**Important:** Production, Delivery and Care currently render as **empty accordion headings**. Either populate them or do not render them. On a made-to-order heirloom, three empty panels are the single most damaging detail on the page.

### 9.5 Mobile order
Image gallery → title → price → Customize → WhatsApp → description → materials → details → related.
Sticky action bar appears once the CTA scrolls out: title (one line) + price + WhatsApp button.

---

# PART 10 — Bespoke / custom order

The current form is comprehensive. **Do not remove any field.** Change the experience.

### 10.1 Hero — split screen
Left: emotional commission image. Right:
> **Commission something bespoke.**
> `Begin your commission`

Plus a mono anchor line: `TYPICAL COMMISSION ₹3,000–₹25,000 · 7 DAYS–6 WEEKS`. Price anchoring before the form is what makes people start it.

### 10.2 What people commission
Four tiles before the form — Varmala preservation · Photo frames & portraits · Nameplates & corporate gifts · Tables & surfaces — each with a *from* price and typical timeline.

### 10.3 Guided form
Progress indicator `01 / 04` in mono, docked left so it rhymes with the Cure Line:

**01 YOUR IDEA · 02 DETAILS · 03 REFERENCES · 04 YOUR DETAILS**

Visual treatment: large inputs, large labels, generous whitespace, minimal borders, floating helper text. Desktop shows all four groups with the rail scroll-spying; mobile shows one at a time with `Back` / `Continue` and a `Step 2 of 4` label.

Validation on blur, then on change once errored. The submit button states its blocker while disabled.

### 10.4 Live summary
Keep it. Redesign as the premium `WhatsAppSummaryCard`. Sticky right column on desktop, expandable bottom sheet on mobile.

### 10.5 CTA
Replace `Send commission request` with:
> **Continue on WhatsApp**
> Your details will be prepared automatically.

### 10.6 Success state
A real screen, not just a redirect: `Your brief is with the maker.` + what happens next + a fallback `Open WhatsApp` link + `See recent commissions`.

---

# PART 11 — Editorial and support pages

## 11.1 Portfolio
Art-gallery experience, not a list.

- **Masonry grid** with varied sizes for rhythm: large `2×2`, small `1×1`, vertical `1×2`.
- **Card:** image · project number (mono) · project name · category. Hover: short story fades up, image scales `1.03`, `View project →`.
- **Filters** as chips with counts and a real active state.
- **Fix the two grid cells currently rendering as empty bullets** — a case without a cover image renders as a text-only tile, never a blank.
- **Fix the empty state**: it currently fires while twenty case studies are on screen. Render it only when a filter returns nothing. The "yours could be first" line moves to the CTA band, where it is true.
- Index line in mono: `20 COMMISSIONS · 2025–2026 · 8 COLLECTIONS`.

## 11.2 Case study
Hero image → project title → category → short story, then:
**THE BRIEF · THE MATERIAL · THE PROCESS · THE FINAL PIECE · COMMISSION SIMILAR**

- Editorial split: story cols 1–7, sticky mono spec rail cols 9–12 (Type · Material · Technique · Complexity · Timeline · Completed).
- Before/after slider where a transformation exists.
- **Remove duplicate gallery frames** — `case-seaside-shell-candle` currently repeats its first image twice.
- Caption every gallery frame in mono (`Layer 3 · 36 hours in`). Captions are where craft credibility lives.
- Stat row: `LAYERS 4 · CURE 96 H · GRIT 400→3000 · BUILD 11 DAYS`.
- Keep the existing per-case WhatsApp prefill.

## 11.3 About
Content unchanged; presentation rebuilt.

1. **Hero** — full-screen image, mono label `THE STUDIO`, **Where resin meets reverence.**
2. **Story in chapters** rather than three stacked paragraphs: **THE BEGINNING · THE MATERIAL · THE PHILOSOPHY · THE MAKER**, large editorial type, 68ch measure.
3. **The maker — moved up.** Large portrait, mono `THE MAKER`, **Bhavya Gondaliya**, description, `Start a conversation`. This is the page's whole proposition and it currently sits last with no photograph.
4. **Process** — the four stages as a vertical sticky story (left image, right step, scroll changes image). **The current page renders this block twice — delete the duplicate**, keep one, and link out with `See the full process →`.
5. **Materials** — four large cards, each with image, name, one line, hover revealing a macro.
6. **The studio** — three photographs, address, hours.

## 11.4 Process
Keep the six stages. Redesign visually.

1. **Hero** — **From idea to heirloom.** over a cinematic process video.
2. **Timeline** — desktop: sticky left visual, right `01 → 06`. Mobile: vertical cards. A **vertical progress line fills as you scroll and the current step number goes active** — this is the Cure Line, in its native habitat.
3. **Step card:** number · title · description · time · image.
   > **04**
   > ### THE POUR
   > Layer by layer.
   > `24–72 HOURS`
4. **Materials** — **Materials chosen to endure.** Four cards. Keep this as the canonical instance; About links here.
5. **Timelines** — two editorial cards, not a table:
   **SMALL PIECES** `7–10 days` · **STATEMENT PIECES** `3–6 weeks`
   Plus a `Currently quoting` line driven by the same field as the announcement bar.

## 11.5 Workshops
Experiential page.

1. **Hero** — large studio image or video, **Pour your first masterpiece.**, `Ask about workshops`.
2. **Facts strip** in mono: `2.5 HOURS · MAX 8 SEATS · MATERIALS INCLUDED · SURAT`. Publish concrete facts even before dates exist.
3. **Three benefits** — SMALL GROUPS · ALL MATERIALS INCLUDED · BEGINNER FRIENDLY, as large photographic cards, not icons.
4. **Experience timeline** — `ARRIVE → MIX → POUR → CREATE → TAKE HOME`.
5. **Sessions** — when dates exist, rows with seats remaining as a mono fraction (`3 / 8 SEATS`). When they don't, an actual waitlist form, and an empty state that invites rather than apologises: `Next dates are being set.`
6. **Private workshops** — dark band, **A table for your people.**, imagery of friends / bridal groups / corporate tables. AI imagery may support this section.
7. **The room** — four photographs of the real studio space.

## 11.6 FAQ
Large heading · search field · category filters · accordion list.
Desktop two-column: categories left (sticky, scroll-spied), questions right. Mobile: single-column accordions.
Every answer deep-linkable by hash with a copy-link affordance — operationally useful for WhatsApp replies.

## 11.7 Contact
Split-screen. Left: studio image. Right: **Let's make something personal.**

Four large blocks — **PHONE · WHATSAPP · EMAIL · STUDIO** — each with an expected response time in mono (`WHATSAPP · USUALLY UNDER 2 H`). The WhatsApp block visually dominates.

Form: all current fields kept, plus a `What's this about?` select at the top so the form shapes itself. Large labels, large inputs, one column, clear success and error states, and an error state that preserves everything typed.

Click-to-activate map with the address as real text beside it.

## 11.8 Journal
The blog currently exposes **195 tags**, which is substantial visual noise. Keep the data and functionality; simply do not expose all 195.

1. **Hero** — **Notes from the studio.**
2. **Category navigation** — only the major ones: Studio · Materials · Care · Gifting · Weddings · 3D Printing · Inspiration.
3. **Featured article** first, then a 3-column grid, then pagination.
4. **Card:** category · image · title · short excerpt · date · read time. No borders.

## 11.9 Article
Large editorial layout: hero image · category · title · date · reading time · body (68ch) · related products · related articles · final commission CTA.
Sticky **reading progress bar** (2px sapphire at the top of the viewport) and a floating table of contents in cols 9–12 with scroll-spy.
Pull-quotes in Instrument Serif with a champagne hairline above. High-res macro media embeds. Contextual product CTA cards mid-article.

## 11.10 Legal pages
Single column, cols 1–8, 68ch, `LAST UPDATED` in mono, sticky TOC, anchor-linked headings, 48px between sections.

## 11.11 Error pages
- **404** — **This piece isn't here.** + search field + four popular collections + WhatsApp. No cartoon.
- **500** — **Something went wrong.** Please try again. + retry + WhatsApp + a mono reference code.

---

# PART 12 — Studio portal

Keep all authentication and CMS functionality. Redesign the visual interface only.

## 12.1 Login
Split screen. Left: dark cinematic studio image or ambient loop. Right: login panel on a solid surface.

```
┌───────────────────────┬─────────────────────────────┐
│  RIVYA LIVING ART            │                             │
│  OWNER & STAFF ACCESS │      cinematic studio       │
│                       │      image / loop           │
│  Email                │                             │
│  Password        👁    │      RIVYA LIVING ART · STUDIO     │
│  Forgot password?     │      (mono, bottom-left)    │
│  [ Sign in ]          │                             │
│  ← Back to the store  │                             │
└───────────────────────┴─────────────────────────────┘
```

States: idle · submitting (spinner, fields disabled) · invalid credentials (one generic message above the form, never field-specific) · rate-limited with a live `Try again in 4:32` countdown · account disabled.
`autocomplete` set correctly, show/hide password toggle, `Caps Lock is on` hint, visible focus ring, Enter submits.
Mobile: image becomes a 28vh top band.

## 12.2 Dashboard shell
Should feel like a creative atelier management system, not a generic admin template.

- **Sidebar** `240–260px`, dark, minimal, small Lucide icons + text, active item marked by a champagne line or sapphire highlight.
  `Overview · Products · Collections · Commissions · Portfolio · Journal · Workshops · Media · Customers · Users · Settings`
- **Top bar** — page title left; search, notifications, WhatsApp shortcut, profile right.
- **Main content**, with an optional right-hand activity panel.
- Shared `⌘K` command palette with the storefront.

## 12.3 Overview
Four KPI cards, no excessive graphs:
**NEW INQUIRIES · ACTIVE COMMISSIONS · PENDING APPROVALS · UPCOMING WORKSHOPS**
Large mono numerals, one hairline sparkline each.

## 12.4 Commission Kanban
Columns mapped to the real workflow:
`Inquiry → Quoted → Approved → Design → Production → Curing → Finishing → Ready → Delivered`

Card shows: customer · project · thumbnail · deadline · status · priority.
**Stage timer badge** — a circular progress ring using Rivya Living Art's actual cure times (`Layer 2 · 48 of 72 h`), not an invented 14-day schedule.

## 12.5 Data screens
- **Products table:** image · product · collection · price · status · updated · actions. Sticky header, sortable columns, saved views as chips, checkbox selection with a floating bulk-action bar, server-side pagination.
- **Product editor:** two columns — information left, live preview right. Tabs: General · Images · Customization · Details · SEO. Sticky footer with `Discard` · `Save draft` · `Publish` and an unsaved-changes indicator.
- **Media library:** visual asset grid, filters for Products · Studio · Portfolio · Journal · Video · **AI Generated**. Card shows image, filename, type, dimensions, used-in, and an AI indicator.
- **Portfolio CMS:** card grid — thumbnail · title · category · status · updated · edit.
- **Journal CMS:** editor left, preview right, with metadata, category, featured image and publish controls.
- **Destructive actions** in alert colour, behind a typed confirmation for anything bulk.

## 12.6 Studio responsive
Desktop-first. Tablet: collapsible sidebar. Mobile: slide-in or bottom navigation, tables become cards.

**Backlog (not this phase):** client order-lookup tab on login, magic-link client proofing portal, epoxy volume calculator. All are new functionality and fall outside the redesign scope.

---
# PART 13 — Mobile UX

Mobile is a priority, not a scaled-down desktop. Build mobile-specific layouts.

| Breakpoint | |
|---|---|
| Mobile | `< 640px` |
| Tablet | `640–1024px` |
| Desktop | `1024–1440px` |
| Large | `1440px+` |

**Mobile priority order per section:** 1. Image → 2. Heading → 3. CTA → 4. Essential information → 5. Details.

| Element | Mobile behaviour |
|---|---|
| Header | Logo · search · menu. Bottom bar handles the rest. |
| Bottom bar | Fixed `64–72px`: `HOME · SHOP · SEARCH · WHATSAPP · MENU` |
| Product grid | 2 columns, 4:5, minimal information, no oversized CTA |
| Product page | Gallery → title → price → Customize → WhatsApp → description → materials → details → related |
| Filter | Bottom sheet, slide-up, 70–90% height, sticky `Apply` footer |
| Collections | Horizontal swipe cards, large images, text overlay |
| Cure Line | Collapses to a 2px top progress bar with the active section label |
| Sequences / pins | Disabled. Static frames instead. |
| Forms | 16px minimum input font (prevents iOS zoom), `inputmode="tel"` on phone, submit never trapped under the keyboard |
| Targets | 44×44px minimum, 8px separation |

**Desktop rule:** use whitespace aggressively. Premium design is not about filling every available area.

---

# PART 14 — Motion system

Motion should communicate **craftsmanship**, not a technology demo.

| Element | Motion |
|---|---|
| Page transition | Fade + slight vertical movement, `350–500ms` |
| Image reveal | Meniscus mask reveal, `700–1000ms`, once per element |
| Hero | Fade in; headline rises 20–40px; image `1 → 1.04` over 4–8s |
| Product hover | Image scale `1.02–1.04` or second-image wipe; text lifts slightly |
| Card / text reveal | 16–24px rise + opacity, `350ms`, trigger at 85% viewport, once |
| Cure Line | Scroll-linked fill, linear |
| Material story | Sticky pin with step change over `600–1000ms` using opacity, blur, scale and mask |
| Parallax | Hero, editorial images and campaign sections only. Maximum `20–40px` |
| Buttons | 120–180ms colour and underline only. No scale, no lift, no glow |
| Accordion | `grid-template-rows: 0fr → 1fr`, 350ms |
| Drawers / sheets | Slide 320–350ms with a small settle |
| Toast | 200ms rise, 5s dismiss with hairline countdown |
| Lightbox | FLIP from the thumbnail rect, 260ms |

**Reduced motion.** When `prefers-reduced-motion: reduce`, disable parallax, large transforms, auto-play motion, pinned scrubs, the marquee and complex transitions — and jump every reveal to its final state. No exceptions.

**Budgets.** Motion JS ≤ 45 KB gzipped. No animation may move or delay the LCP element. No scroll-jacking beyond the single material-story pin and the process-page steps.

---

# PART 15 — Image system & Higgsfield AI

## 15.1 Photography standard

| Context | Ratio |
|---|---|
| Product hero | `4:5` |
| Product detail | `4:5` |
| Lifestyle | `4:5` |
| Wide editorial | `16:9` |
| Panoramic banner | `21:9` |
| Mobile hero / fullscreen | `9:16` |
| Square / turntable | `1:1` |

**Style:** dark neutral backgrounds · controlled directional lighting · subtle reflections · natural shadows · premium studio composition.
**Avoid:** random backgrounds · inconsistent lighting · excessive props · stock photography · unrelated product environments · mixed aspect ratios in one grid.

## 15.2 Asset generation rule

| Need | Source |
|---|---|
| Real product · real customer · real maker | **Authentic photography** |
| Atmosphere · campaign · material macro · cinematic background | **Higgsfield AI** |
| Final product presentation | Prefer authentic photography |
| AI campaign asset | Must match the Rivya Living Art photography system exactly |

**Use Higgsfield for:** hero campaigns · editorial backgrounds · material close-ups · studio atmosphere · lifestyle concepts · abstract resin visuals · campaign transitions · 3D-printing atmosphere · motion backgrounds · private-workshop mood imagery.

**Do not use Higgsfield as the factual representation of:** exact products · exact dimensions · customer commissions · actual customer flowers · real customer photographs · finished custom orders · real studio staff portraits.

The AI imagery should make the site look more premium without making the brand look artificial.

## 15.3 Visual consistency

Every generated asset must share the same lighting language, colour palette, lens aesthetic, contrast, background family and material treatment. **Do not generate each image independently.** Generate in sets — all six process shots in one batch, all four material macros in one batch — so each set is internally consistent.

Append this to every image prompt:

> *— palette limited to deep ocean `#08283A`, obsidian `#080A0E`, sapphire `#164E6B` and muted champagne gold `#B89B63`; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces*

Video suffix: *— locked-off or very slow dolly; no whip pans, no zoom punch; seamless loop; steady, no shake.*

Negative prompt: `text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background`.

**Video spec:** 4K source, shot at high frame rate and slowed to 25–40% for fluid viscosity, seamless `6–16s` loops, exported as MP4 (H.264, yuv420p) + WebM (VP9), ≤2.5 MB per loop, always `muted playsinline loop preload="metadata"` with a poster. The poster stands in under reduced motion or on a metered connection.

## 15.4 Prompt catalog

| Placement | Asset | Prompt |
|---|---|---|
| **Homepage hero** | 16:9 + 9:16 loop | `Cinematic 4k macro slow motion top-down view of liquid deep sapphire blue epoxy resin flowing across raw dark teakwood, swirling with genuine gold leaf veins, crystalline water-like refraction, studio rim lighting, smooth seamless loop, photorealistic --ar 16:9` |
| **Material story 01 — pour** | 4:5 | `Extreme slow-motion macro of deep sapphire resin pouring in one unbroken ribbon into a shallow round mould, matte black backdrop, single soft key light from upper left, no hands --ar 4:5` |
| **Material story 02 — gild** | 4:5 | `Gold leaf flakes drifting and suspending inside settling translucent blue resin, macro, catching directional light --ar 4:5` |
| **Material story 03 — cure** | 4:5 | `Poured resin moulds curing overnight under a single warm work lamp in a dark artisan studio, deep shadow, calm --ar 4:5` |
| **Material story 04 — polish** | 4:5 | `Extreme macro of water beading on a mirror-polished resin surface revealing deep 3D sapphire depth and floating gold flakes, high-contrast studio lighting --ar 4:5` |
| **Studio hands** | 4:5 | `Artisan hands in black nitrile gloves using a precision heat gun to create fine wave patterns on deep blue liquid resin, studio workshop, cinematic lighting --ar 4:5` |
| **Bespoke / preservation** | 16:9 | `Hands arranging marigold and rose petals inside an empty silicone mould, warm side light, intimate, no faces --ar 16:9` |
| **Preservation before/after** | 16:9 pair | `Split composition: left, a fresh Indian wedding varmala of roses and jasmine; right, the same garland preserved inside a crystal-clear high-gloss epoxy block with gold flake accents and a teakwood base, luxury studio lighting --ar 16:9` |
| **Material macros ×4** | 1:1 | `Extreme macro on identical neutral ground and identical light: (a) cured clear epoxy edge, (b) seasoned teak grain meeting blue resin, (c) loose mineral pigment powder, (d) a pressed preserved flower --ar 1:1` |
| **3D printing** | 16:9 loop | `Macro of an FDM print head laying translucent blue filament layer by layer, warm work lamp, shallow focus, slow lateral dolly, seamless --ar 16:9` |
| **Collection tiles ×6** | 3:4 | One per collection — PRESERVE, KEEP, LIVE, GIFT, CREATE, PRINT — same light, same ground, so they read as a set |
| **Workshop** | 16:9 | `A long studio table set for eight with mixing cups, gloves, pigments and moulds, morning light, no people --ar 16:9` |
| **Private workshop** | 16:9 | `A small group of friends seated at a craft studio table, warm ambient light, hands working, faces out of frame --ar 16:9` |
| **About / texture** | 21:9 | `Extreme macro of a cured resin surface, gold vein through deep sapphire, dense detail in the left third for headline overlay --ar 21:9` |
| **Studio login backdrop** | 16:9 loop | `Abstract dark navy and midnight blue fluid resin slowly swirling with soft golden luminescence, ambient motion, out-of-focus, luxury loop --ar 16:9` |
| **404** | 16:9 | `An empty, freshly demoulded silicone mould on a pale ground, soft light --ar 16:9` |
| **Journal covers** | 16:9 | One per post, topic-matched, same palette |

## 15.5 Pipeline

`models_explore` → `generate_image_batch` (≤12 per set) → `jobs_wait` → cull to one keeper per ID → `upscale_image` to ≥2560px → `reframe` / `outpaint_image` for the 9:16 and 21:9 crops from the same master → `remove_background` where an object must sit on a colour band → `generate_video` from the approved still → `upscale_video` → `reframe`. Export AVIF + WebP at 640/960/1440/1920/2560 with a 20px LQIP.

**Alt text** describes the picture, not the brand: `alt="Deep sapphire resin pouring into a round mould, a thread of gold leaf drifting through it"` — never `alt="Rivya Living Art luxury resin art"`. Decorative textures get `alt=""`.

---

# PART 16 — States

Every list page and every interactive component needs all of these designed.

| State | Standard |
|---|---|
| Empty | Premium, directive, no illustration. Statement → one line → one action. |
| Error | Human language. Never technical. Retry + WhatsApp escape hatch. |
| Loading | Elegant skeletons at final dimensions. Not spinners everywhere. |
| Hover | Present on every interactive element, with a focus equivalent |
| Focus | 2px sapphire ring at 3px offset, never removed |
| Active | Visible, immediate |
| Disabled | 40% opacity + a stated reason |
| Success | Explicit confirmation, `role="status"` |

---

# PART 17 — Accessibility

- Body text ≥ 4.5:1, large display and mono micro ≥ 3:1. Champagne never used for text below 16px.
- Visible keyboard focus on everything; full keyboard path through header, mega menu, drawer, search overlay, filters, gallery, lightbox, accordions, forms and Studio tables. `Esc` closes every layer and focus returns to the trigger.
- One `h1` per page, no skipped levels, working skip link. **No duplicated heading text on a page** — this alone fixes the homepage and About.
- Card links carry the full title even when the visible text clamps. No `…` in the accessible name.
- 44×44px minimum touch targets. Readable font sizes. Accessible labels always visible, never placeholder-only.
- Errors described by `aria-describedby`; error summary focused on failed submit.
- `prefers-reduced-motion` honoured by every animation.
- If the nine-language switcher stays, each locale must set `lang` correctly and Arabic needs `dir="rtl"` with mirrored layout — an unmirrored RTL is worse than none.

---

# PART 18 — Implementation

## 18.1 Priority

**P0 — must redesign:** Header · Homepage · Shop · Product cards · Product page · Collection page · Custom order · Mobile navigation · Typography · Image system
**P1:** About · Process · Portfolio · Case study · Workshops · Contact · FAQ · Search
**P2:** Journal · Article · Legal pages · Studio dashboard polish

## 18.2 Build order

Do not design page by page independently. Build the system first.

```
01 Design tokens          09 Product system
02 Typography             10 Editorial system
03 Grid                   11 Homepage
04 Buttons                12 Shop
05 Forms                  13 Product
06 Cards                  14 Collections
07 Header                 15 Bespoke
08 Footer                 16 Portfolio
                          17 About
                          18 Process
                          19 Journal
                          20 Studio
                          21 Mobile
                          22 Motion
                          23 Final visual QA
```

## 18.3 Figma structure

```
00 Cover
01 Foundations   — Colours · Typography · Grid · Spacing · Icons · Motion
02 Components    — Buttons · Inputs · Cards · Navigation · Product components
03 Homepage      08 Portfolio     13 Contact
04 Shop          09 About         14 FAQ
05 Product       10 Process       15 Search
06 Collections   11 Workshops     16 Studio
07 Bespoke       12 Journal       17 Responsive
                                  18 Prototype
```

## 18.4 Component naming

`Button/Primary` · `Button/Secondary` · `Card/Product` · `Card/Collection` · `Card/Article` · `Navigation/Header` · `Navigation/Mobile` · `Form/Input` · `Form/Upload` · `Product/Gallery` · `Product/Information` · `Studio/KPI` · `Studio/Kanban`

## 18.5 Token naming

```
color/background/primary     space/1 … space/12
color/background/secondary   radius/small
color/text/primary           radius/button
color/text/secondary         type/display
color/accent                 type/h1 · type/h2 · type/body
```

---

# PART 19 — QA

## 19.1 Every page
alignment · spacing · typography · image ratio · hierarchy · CTA visibility · mobile layout · hover states · focus states · loading states · empty states · error states · contrast · consistency.

Plus: one `h1`; no repeated heading text; **max two `major` sections**; **max two champagne elements per viewport**; no two dark bands adjacent; every number in JetBrains Mono tabular; every image reveals via meniscus, once; nothing centred except the manifesto and the marquee.

## 19.2 Homepage
Does the hero immediately communicate Rivya Living Art? · Does it feel premium within 3 seconds? · Is the primary CTA obvious? · Are the products visually desirable? · Does the maker story appear? · Is bespoke clearly visible? · Does 3D printing feel integrated but separate? · Is there too much information? *If yes, remove visual noise.*

## 19.3 Shop
Can I understand the catalogue quickly? · Can I filter without feeling overwhelmed? · Can I compare products visually? · Can I understand customization? · Can I reach WhatsApp easily?

## 19.4 Product
Does the product image dominate? · Can I understand what I'm buying? · Can I understand customization? · Can I see the details? · Can I see the craft? · Can I contact the studio?

## 19.5 Mobile
Test 375 · 390 · 430 · 768 · 1024 · 1440. Check: no horizontal overflow · no tiny text · no inaccessible controls · no excessive animation · bottom bar clears the safe area.

## 19.6 Performance
LCP < 2.5s · CLS < 0.1 · INP < 200ms · Lighthouse mobile ≥ 90 on `/`, `/shop`, `/product/[slug]`, `/portfolio` · 0 axe critical or serious violations.

## 19.7 Scorecard

| Category | Target |
|---|---|
| Visual hierarchy | 10 |
| Premium feel | 10 |
| Product presentation | 10 |
| Mobile UX | 10 |
| Editorial storytelling | 10 |
| Custom-order UX | 10 |
| Photography consistency | 10 |
| Visual consistency | 10 |
| Typography | 9 |
| Navigation clarity | 9 |
| Accessibility | 9 |
| Studio UI | 9 |
| Motion | 8 |

---

# PART 20 — Code

## 20.1 Tokens — `styles/theme.css`

```css
@import "tailwindcss";

@theme {
  --color-obsidian:    #080A0E;
  --color-deep-ocean:  #08283A;
  --color-sapphire:    #164E6B;
  --color-sapphire-hi: #1D6389;
  --color-mineral:     #F4F1E9;
  --color-sand:        #E7E0D5;
  --color-champagne:   #B89B63;
  --color-ink:         #12141A;
  --color-graphite:    #5B6068;
  --color-mist:        #A9B4BC;
  --color-whatsapp:    #128C7E;
  --color-alert:       #9B3A2E;
  --color-success:     #2C6B5B;

  --font-display: var(--font-instrument), Georgia, serif;
  --font-body:    var(--font-inter), system-ui, sans-serif;
  --font-mono:    var(--font-jetbrains), ui-monospace, monospace;

  --text-hero: clamp(3rem, 7vw + .5rem, 7.5rem);
  --text-h1:   clamp(2.5rem, 4.5vw + .5rem, 5.5rem);
  --text-h2:   clamp(2.125rem, 2.8vw + .75rem, 4rem);
  --text-h3:   clamp(1.5rem, 1.4vw + .875rem, 2.25rem);
  --text-micro: .6875rem;

  --space-major:    clamp(120px, 14vw, 200px);
  --space-standard: clamp(80px, 9vw, 120px);
  --space-compact:  clamp(24px, 4vw, 48px);

  --ease-luxury: cubic-bezier(.16, 1, .3, 1);
  --ease-settle: cubic-bezier(.22, .61, .36, 1);
  --dur-fast: 180ms;
  --dur-base: 350ms;
  --dur-slow: 800ms;
  --dur-reveal: 900ms;

  --gutter-cure: 56px;
  --shell-max: 1440px;
  --hairline: rgba(18, 20, 26, .12);
  --hairline-dk: rgba(244, 241, 233, .16);
}

@layer base {
  body {
    background: var(--color-mineral);
    color: var(--color-ink);
    font-family: var(--font-body);
    line-height: 1.65;
  }
  .u-micro {
    font-family: var(--font-mono);
    font-size: var(--text-micro);
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--color-graphite);
  }
  .u-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  .u-shell { max-width: var(--shell-max); margin-inline: auto;
             padding-inline: clamp(20px, 4vw, 72px); }
  .u-prose { max-width: 68ch; }
  :focus-visible { outline: 2px solid var(--color-sapphire); outline-offset: 3px; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
      scroll-behavior: auto !important;
    }
  }
}

@layer components {
  .section-major    { padding-block: var(--space-major); }
  .section-standard { padding-block: var(--space-standard); }
  .section-compact  { padding-block: var(--space-compact); }
  .rule    { border-top: 1px solid var(--hairline); }
  .rule-dk { border-top: 1px solid var(--hairline-dk); }
}
```

## 20.2 `MeniscusImage`

```tsx
"use client";
import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

export function MeniscusImage({ className = "", ...props }: ImageProps & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(true);
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <div
        className="h-full w-full will-change-[clip-path,transform]"
        style={{
          clipPath: shown ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)",
          transform: shown ? "scaleY(1)" : "scaleY(1.015)",
          transformOrigin: "bottom",
          transition:
            "clip-path var(--dur-reveal) var(--ease-luxury), transform var(--dur-reveal) var(--ease-luxury)",
        }}
      >
        <Image {...props} />
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-px"
        style={{
          background: "var(--color-champagne)",
          bottom: shown ? "100%" : "0%",
          opacity: shown ? 0 : .8,
          transition:
            "bottom var(--dur-reveal) var(--ease-luxury), opacity var(--dur-reveal) linear",
        }}
      />
    </div>
  );
}
```

## 20.3 `CureLine`

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

type Mark = { id: string; label: string };

export function CureLine({ marks }: { marks: Mark[] }) {
  const fill = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.body.scrollHeight - innerHeight;
        const p = max > 0 ? Math.min(1, scrollY / max) : 0;
        if (fill.current && !reduce) fill.current.style.transform = `scaleY(${p})`;
        let current = 0;
        marks.forEach((m, i) => {
          const el = document.getElementById(m.id);
          if (el && el.getBoundingClientRect().top <= innerHeight * 0.4) current = i;
        });
        setActive(current);
      });
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [marks]);

  return (
    <nav aria-label="Page sections"
      className="pointer-events-none fixed left-0 top-0 z-40 hidden h-screen w-[var(--gutter-cure)] lg:block">
      <span className="absolute left-7 top-0 h-full w-px bg-[var(--hairline)]" />
      <span ref={fill} style={{ transform: "scaleY(0)" }}
        className="absolute left-7 top-0 h-full w-px origin-top bg-sapphire will-change-transform" />
      <ul className="absolute left-0 top-0 h-full">
        {marks.map((m, i) => (
          <li key={m.id} className="absolute left-7 -translate-x-1/2"
              style={{ top: `${((i + 1) / (marks.length + 1)) * 100}%` }}>
            <a href={`#${m.id}`} className="pointer-events-auto flex items-center gap-2"
               aria-current={i === active ? "true" : undefined}>
              <span className={`block h-px transition-all duration-200 ${
                i <= active ? "w-3 bg-sapphire" : "w-2 bg-[var(--hairline)]"}`} />
              <span className={`u-micro whitespace-nowrap transition-opacity duration-200 ${
                i === active ? "opacity-100" : "opacity-0"}`}>
                {String(i + 1).padStart(2, "0")} · {m.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

## 20.4 `CarouselNav` — 48px touch targets

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";

export function CarouselNav({
  onPrev, onNext, canPrev = true, canNext = true,
}: { onPrev: () => void; onNext: () => void; canPrev?: boolean; canNext?: boolean }) {
  const base =
    "w-12 h-12 rounded-full border border-[var(--hairline)] bg-mineral " +
    "flex items-center justify-center text-ink " +
    "hover:border-ink/40 active:scale-95 " +
    "disabled:opacity-30 disabled:pointer-events-none " +
    "transition-[border-color,transform] duration-[var(--dur-fast)]";

  return (
    <div className="flex items-center gap-3">
      <button onClick={onPrev} disabled={!canPrev} aria-label="Previous" className={base}>
        <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
      </button>
      <button onClick={onNext} disabled={!canNext} aria-label="Next" className={base}>
        <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
```

## 20.5 `BeforeAfterSlider`

```tsx
"use client";
import { useState } from "react";

export function BeforeAfterSlider({
  beforeImg, afterImg, beforeLabel = "Before", afterLabel = "After",
}: { beforeImg: string; afterImg: string; beforeLabel?: string; afterLabel?: string }) {
  const [pos, setPos] = useState(50);

  const drag = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPos((x / rect.width) * 100);
  };

  return (
    <div
      className="relative w-full aspect-[16/9] overflow-hidden cursor-ew-resize select-none"
      onMouseMove={drag}
      onTouchMove={drag}
      role="slider"
      tabIndex={0}
      aria-label="Compare before and after"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 2));
        if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 2));
      }}
    >
      <img src={afterImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <span className="u-micro absolute right-4 top-4 bg-obsidian/80 px-3 py-1.5 !text-mineral">
        {afterLabel}
      </span>

      <div className="absolute inset-0 overflow-hidden"
           style={{ clipPath: `polygon(0 0, ${pos}% 0, ${pos}% 100%, 0 100%)` }}>
        <img src={beforeImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className="u-micro absolute left-4 top-4 bg-obsidian/80 px-3 py-1.5 !text-mineral">
          {beforeLabel}
        </span>
      </div>

      <div className="absolute inset-y-0 w-px bg-champagne" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full
                        bg-obsidian border border-champagne flex items-center justify-center
                        text-mineral text-sm">↔</div>
      </div>
    </div>
  );
}
```

---

# The final target

When someone opens the site, the impression should run:

| Moment | Impression |
|---|---|
| Immediately | *This is a premium craft studio.* |
| 5 seconds | *They make beautiful one-of-one pieces.* |
| 15 seconds | *I understand how they create them.* |
| After browsing | *They can make something specifically for me.* |
| Final action | *I want to commission one.* |

The journey: **DISCOVER** (cinematic material) → **EXPLORE** (curated collection) → **DESIRE** (beautiful object) → **UNDERSTAND** (craft and process) → **TRUST** (maker and portfolio) → **PERSONALIZE** (custom options) → **CONNECT** (WhatsApp) → **COMMISSION** (one-of-one piece).

The existing functionality stays underneath. The visual layer becomes refined, editorial, immersive, minimal and premium.

> Transform **content → hierarchy** · **products → objects** · **catalogue → collection** · **process → story** · **custom order → commission experience** · **studio → atelier** · **images → art direction** · **WhatsApp → personal consultation**.
