# 01 — Content Inventory

Every page, everything on it, where that thing lives today, and which layer of
the plan hands it to the owner. This is the map the rest of the guide builds
against.

**Legend for "Owner control today"**

| | Meaning |
|---|---|
| ✅ | Editable from `/studio` right now |
| 🟡 | Editable indirectly (e.g. via Site Settings) or only partly |
| ❌ | Needs a deploy |

**Legend for "Layer"** — which phase of this plan makes it editable:
**C** = Copy layer (`02`) · **I** = Image layer (`03`) · **S** = Structure
layer (`04`) · **G** = Globals & business config (`05`) · **—** = already done.

---

## 1.1 The three-line summary

| Content class | Volume | Today | After Copy layer | After Structure layer |
|---|--:|---|---|---|
| **Words** | 1,149 strings × 9 locales | ❌ deploy | ✅ all of it | ✅ + reorder / hide |
| **Editorial images** | 57 named slots, 25 files | ✅ replace / reset | ✅ + alt inline | ✅ + per-section |
| **Catalogue & editorial entities** | Products, categories, portfolio, journal, FAQ, testimonials, legal pages | ✅ full CRUD | — | — |

Everything else in this document is the detail behind those three rows.

---

## 1.2 Route inventory

| Route | Copy source | Images | Entities read | Rendering | Owner control today |
|---|---|---|---|---|---|
| `/` | `Home` (184) | 8 slots + `Category.image` ×6 | Product, Category, Portfolio, BlogPost, SiteSettings | ISR 300s | 🟡 images ✅ · words ❌ |
| `/shop` | `Shop` (109) | 4 slots | Product, Category | ISR 300s | 🟡 |
| `/shop/[category]` | `Shop` (109) | `Category.image`, group fallbacks | Product, Category | ISR 300s, `dynamicParams` | ✅ per category |
| `/product/[slug]` | `Product` (112) | `ProductImage[]` | Product, Category, Inquiry fields | ISR 86400s | ✅ |
| `/about` | `About` (61) | **17 slots** | SiteSettings | ISR 300s | 🟡 |
| `/process` | `Process` (63) | **12 slots** (incl. hero video + poster) | — | ISR 300s | 🟡 |
| `/workshops` | `Workshops` (65) | **9 slots** | — | ISR 300s | 🟡 |
| `/custom-order` | `CustomOrder` (114) | 1 slot + `Category.image` ×4 | Category, Portfolio, Faq | ISR 300s | 🟡 |
| `/contact` | `Contact` (67) | 1 slot | SiteSettings, Faq | ISR 300s | 🟡 |
| `/faq` | `Faq` (21) | — | **Faq rows** | ISR 300s | ✅ |
| `/portfolio` | `Portfolio` (74) | 1 slot | Portfolio, Category | ISR 300s | ✅ |
| `/portfolio/[slug]` | `Portfolio` (74) | `PortfolioImage[]` | Portfolio | ISR 300s | ✅ |
| `/blog`, `/blog/[slug]` | `Blog` (33) | `BlogPost.coverUrl` | BlogPost, BlogCategory, Tag | ISR 300s | ✅ |
| `/privacy`, `/terms` | `Legal` (6) | — | **Page rows (Tiptap)** | ISR 300s | ✅ |
| `/search` | `Search` (50) | — | Product | `force-dynamic` | ❌ words |
| `/shop/wishlist` | `Wishlist` (19) | — | Product | client | ❌ words |
| `/whatsapp-order` | `WhatsAppOrder` (20) | — | Product | `force-dynamic` | ❌ words |
| 404 / error | `NotFound` (13), `ErrorPage` (6) | — | — | — | ❌ words |
| **Global chrome** | `Nav` (30), `Header` (9), `Footer` (24), `Common` (24), `Newsletter` (9), `WhatsApp` (14), `Consent` (4) | 3 nav slots + `SiteSettings.logoUrl` | Category (nav), SiteSettings | in layout | 🟡 |

**Reading of the table:** the entity-backed surfaces (products, portfolio,
journal, FAQ, legal) are already the owner's. The marketing surfaces — home,
about, process, workshops, commission, contact — are the ones where the words
are locked and the pictures are not. That asymmetry is the whole problem, and
the copy layer closes it in one move.

---

## 1.3 Per-page detail

### `/` — Homepage · 184 strings · 8 slots · 13 sections

The homepage renders **13 `<section>` elements**, three of them conditional on
data (`#pieces`, `#work`, `#journal`). Only 151 of its 184 strings are live —
see the orphan note below.

| Section | i18n | Strings | Images | Data |
|---|---|--:|---|---|
| metadata | `Home.meta` | 2 | — | — |
| cure rail | `Home.cure` | 11 | — | — |
| 01 hero *(dark)* | `Home.hero` | 13 | slot `home.hero` + `SiteSettings.heroVideoUrl` | portfolio count |
| 02 manifesto | `Home.manifesto` | 3 | — | — |
| 03 featured pieces | `Home.featured` | 8 | `ProductImage` | Product ×4 |
| 04 material story | `Home.showcase` | 11 | `pour-cure` sequence, 121 frames | — |
| 05 collections | `Home.collections` | 9 | `Category.image` ×6 | Category ×6 |
| 06 the maker | `Home.maker` | 5 | slot `home.maker` | — |
| 07 recent commissions | `Home.portfolio` | 4 | `Portfolio.afterImageUrl` | Portfolio |
| 08 bespoke *(dark)* | `Home.custom` | 8 | slot `home.bespoke` | — |
| 09 print studio | `Home.printStudio` | 8 | slot `home.print` | — |
| 10 how it works | `Home.how` | 11 | — | — |
| 11 why Rivya Living Art | `Home.why` | 13 | slots `home.why.*` ×4 | — |
| 12 journal | `Home.journal` | 3 | `BlogPost.coverUrl` | BlogPost |
| 13 closing CTA *(dark)* | `Home.cta` | 6 | — | — |

Two details the copy registry has to encode:

- **The homepage carries two step sequences**, not one: the four-stage material
  story (`showcase.stage1–4`, ending "The polish") and the four-step "How it
  works" (`how.step1–4`). Together with `/about`'s four craft panels and
  `/process`'s six stages, the site has **four** independent step lists. An
  owner editing "the steps" needs to be told which.
- **Three dark bands: the hero, Bespoke and the closing CTA.** That is the
  REDESIGN.md maximum, already spent. No section switch may add a fourth.

> **33 orphaned keys.** `Home.story` (4), `stats` (5), `occasions` (2),
> `testimonials` (5), `ugc` (5), `instagram` (1), `explorer` (8), `spotlight`
> (2) and the loose `marquee` (1) are **referenced nowhere in `src/`** — they
> belong to sections the v3 redesign deleted (`page.tsx:84–93` enumerates the
> removals: the duplicate "From liquid to light", the second portfolio strip
> and marquee, the standalone newsletter, and "the undefendable stat row
> (100% handcrafted / 500+ hours / 1 of 1)").
>
> This matters directly: a registry generated from `messages/en.json` would
> offer the owner 33 fields that change nothing on the site. **The generator
> must cross-reference `src/` for each key and mark unreferenced ones
> `orphan: true`, hidden from the board and reported by the CI check** — which
> then doubles as the tool that keeps the catalogues clean. Delete them from
> all nine locale files in the same pass.

### `/about` — 61 strings · 17 slots

| Section | Strings | Slots |
|---|--:|---|
| `About.hero` | 3 | `about.hero` (21:9) |
| `About.story` | 6 | — |
| `About.craft` + `About.chapters` + `About.chapterLabels` | 21 | `about.chapter{1-4}` (4:5) |
| `About.values` | 9 | — |
| `About.materials` (+ copy owned by `Process`) | 1 | `about.material{1-4}.image` (4:5) + `.macro` (1:1) — 8 slots |
| `About.maker` | 7 | `about.maker` (4:5) |
| `About.studio` | 7 | `about.studio{1-3}` (4:3) |
| `About.sustain`, `About.cta`, `About.meta` | 7 | — |

The four material cards read their names and descriptions from the **`Process`
namespace**, not `About` — `/process` is the canonical description of what a
piece is made of (`about/page.tsx`, `MATERIALS` comment). The copy board must
show that, or an owner will edit About and see Process change.

### `/process` — 63 strings · 12 slots

| Section | Strings | Slots |
|---|--:|---|
| `Process.hero` | 3 | `process.heroVideo` + `process.heroPoster` (16:9) |
| `Process.timeline` | 26 | `process.step{1-6}` (4:5) |
| `Process.materials` | 16 | `process.material{1-4}` (4:5) |
| `Process.timelines` | 13 | — — **the published lead-time bands** |
| `Process.cta`, `.meta` | 5 | — |

`Process.timelines` (13 strings) is business-critical: the commission board's
stage timer measures days in pipeline against these bands (CLAUDE.md, Known
gaps), and `/custom-order` quotes them in its hero anchors. Editing them
changes what the studio promises — flag the slot with a note.

### `/workshops` — 65 strings · 9 slots

`Workshops.empty` (5 strings) is the empty-state block that renders because no
session exists yet. Both the populated and empty states are copy today; when
Workshops become an entity (`05`), keep the empty state editable — the spec is
right that this is what actually renders.

### `/custom-order` — 114 strings · 1 slot + 4 category tiles

The single most operationally valuable page in this plan, because the form's
**option lists are English literals in a component**:

```
src/components/sections/custom-order-form.tsx:41  MATERIAL_OPTIONS   (5 values)
src/components/sections/custom-order-form.tsx:49  BUDGET_OPTIONS     (6 values)
src/components/sections/custom-order-form.tsx:58  TIMELINE_OPTIONS   (4 values)
src/components/sections/custom-order-form.tsx:65  OCCASION_OPTIONS   (OCCASIONS + "Other")
```

Two problems, not one:

1. **Business config in code.** Adding a "₹50,000–₹1,00,000" band or a
   "Jesmonite + brass" material is a deploy.
2. **They bypass i18n entirely.** `"Under ₹2,000"` renders in English on all
   nine locales, inside a form whose labels *are* translated. This is a live
   defect independent of the CMS.

`05-globals-and-business-config.md` fixes both with one table.

### `/contact` — 67 strings · 1 slot

Already reads `SiteSettings` for phone, email, WhatsApp number, maps URL and
address (`contact/page.tsx:73`). The address renders only when set — correct
behaviour, keep it. Missing: **opening hours** (no field on `SiteSettings`,
CLAUDE.md Known gaps) and a response-time note.

### `/faq`, `/portfolio`, `/blog`, `/privacy`, `/terms`

Already fully owner-controlled, and **more so than `CLAUDE.md` claims**. That
file's "Known gaps" section says `Faq`, `Testimonial` and `Page` have no
`translations` column. They do — migration
`20260821120000_translations_faq_testimonial_page` added all three
(`schema.prisma:324,333,379`), and they are read through `localize(…)` at
`faq/page.tsx:78` and `privacy/page.tsx:103`. **Correct that project
instruction before anyone plans from it.**

The models genuinely without a `translations` column are `BlogCategory`,
`Tag`, `CustomizationField`, `ProductImage` and `PortfolioImage`. Of those,
`ProductImage.alt` and `PortfolioImage.alt` matter most — image descriptions
render in English on all nine locales.

---

## 1.4 Global chrome

| Element | Copy | Links | Images | Today |
|---|---|---|---|---|
| Announcement bar | `SiteSettings.announcement`, falling back to `Common.announcementDefault` | — | — | 🟡 text ✅, no schedule / dismissible flag |
| Header nav | `Nav` (30) | `FOOTER_LINKS`-style constants + `getCatalogNav()` | `nav.{art,print,supplies}` | 🟡 |
| Mega menu | `Nav` | Categories from the DB | 3 slots ✅ | 🟡 |
| Logo | — | — | `SiteSettings.logoUrl` | ✅ |
| Mobile bottom bar / WhatsApp FAB | `WhatsApp` (14) | `buildWaLink()` from `SiteSettings.whatsappNumber` | — | 🟡 |
| Search overlay | `Search.overlay` (24) | — | — | ❌ words |
| Footer | `Footer` (24) | **`FOOTER_LINKS` in `src/lib/constants.ts`** | — | ❌ |
| Newsletter | `Newsletter` (9) | — | — | ❌ words |
| Locale switcher | `Language` (2) | `routing.locales` | — | ❌ |
| Consent | `Consent` (4) | — | — | ❌ words |

Two structural notes:

- **There is one shell, not two.** The spec's finding of "two shells shipped"
  (a home nav vs a FAQ nav, a flat vs a four-column footer) does not hold
  here: every storefront route renders through
  `src/app/[locale]/(v2)/layout.tsx`, which mounts one `SiteHeader`, one
  `Footer`, one `AnnouncementBar`, one `MobileBottomBar`, one `WhatsAppFab`
  and one `SearchOverlay`. Nav can be modelled once.
- **Footer link hrefs are constants** (`FOOTER_LINKS`, `src/lib/constants.ts`)
  while their labels are i18n keys. The copy layer makes the labels editable;
  the hrefs need the `NavMenu`/`NavItem` model in `05`.

---

## 1.5 What is deliberately not editable, and should stay that way

Copying the spec's §11.2 boundary, adjusted to what this repo actually holds:

```
Component architecture           Responsive breakpoints
React / Next.js logic            Typography scale & font files
Database schema                  Colour tokens (beyond the logo)
Authentication & sessions        Animation timing & easing (Part 3.8 tokens)
WhatsApp order construction      Image optimization pipeline
Rate limiting & security         Route structure & locale prefixes
Arbitrary HTML / CSS / JS        Spacing scale
The two sanctioned scroll pins   Band rhythm (max 3 dark, never adjacent)
```

Add two this repo specifically needs:

- **The `pour-cure` frame set.** 121 bundled frames are one animation. Making
  them individually swappable invites a 121-request scrub.
- **`CANONICAL_CATEGORIES[].image`** in `catalog-taxonomy.ts` — those are seed
  defaults for `Category.image`, which the owner already edits in the category
  editor. Slotting them too would give one picture two owners.

---

## 1.6 Counting the work

| Thing to make editable | Count | Layer | Rough cost |
|---|--:|---|--:|
| Storefront strings (English) | 1,149 | C | 4–6 days |
| …the same strings in 8 more locales | ×8 | C | included (same screen) |
| Editorial image slots — alt inline | 57 | I | 1 day |
| Editorial image slots — mobile crop + focal | 57 | I | 2 days |
| Media metadata on upload (dimensions, LQIP, checksum) | — | I | 1.5 days |
| Commission form option lists | 4 lists, 20 values | G | 1 day |
| Footer / header nav items | ~20 links | G | 2 days |
| Announcement scheduling, social links, hours | ~12 fields | G | 1 day |
| Section order + visibility | ~40 sections across 6 pages | S | 5–7 days |
| Custom landing pages `/p/[slug]` | — | S | 2 days |
| Draft / preview / publish / revisions | — | Governance | 4 days |

**The shape of that table is the argument for the sequencing in `07`:** the
first row is 90% of the owner's felt pain and the smallest, safest change in
the list.
