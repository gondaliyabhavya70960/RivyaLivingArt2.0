# Rivya Living Art — Full Implementation Plan (v3.1)
### Every page of the storefront + the Studio · all assets · all motion · zero DB changes

**Inputs this plan consolidates:** the UI/UX audit v2, the Awwwards-level redesign spec, the three interactive mockups (preview version `9f1c6e0`), PR #96 (`redesign/liquid-luxury`), and the repo's own REDESIGN.md / three-tier architecture.

**Legend** — Effort: `S` ≤½ day · `M` 1–2 days · `L` 3–5 days. Priority: **P0** trust/correctness · **P1** conversion & brand · **P2** depth & polish · **P3** award garnish. Asset status: ✅ generated/delivered · 🎬 to produce (brief included) · 📷 must be real photography.

---

## 0. Phase 0 — Land what's already built (do first)

| # | Action | Where | Effort |
|---|---|---|---|
| 0.1 | Merge **PR #96** (`redesign/liquid-luxury` → `main`) | GitHub | S |
| 0.2 | Upload the 14 `public/redesign/*.jpg` assets (Add file → Upload files on the branch or main; names per `public/redesign/README.md`) | GitHub | S |
| 0.3 | **Content integrity sweep** (audit §2.1): unpublish/rewrite `wide-boulder-bangle`, `baby-keepsakes-detailing-frame-radhika-art`, `wedding-invitation-card-in-resin`; sweep all published products for competitor copy, watermarks, wrong categories | Studio → Products | M |
| 0.4 | Redirects: `/journal` → `/blog`, `/collection` → `/shop` (one line each in `next.config.ts` `redirects()`) | Code | S |
| 0.5 | Locale default = English on first visit + cookie memory (audit §2.6, `src/proxy.ts`) | Code | S |

---

## 1. Foundation layer (shared by every page)

Build these once; every page below consumes them.

| # | Item | Spec | Effort |
|---|---|---|---|
| F1 | **Icon set** | 6 custom duotone SVGs (1.5px stroke + champagne fill accent): `pour` · `gild` · `cure` · `polish` · `preserve` · `print`. Self-drawing on first scroll-in (`stroke-dashoffset`, 600ms). Live in `src/components/icons/` beside the Lucide set | M 🎬 |
| F2 | **Vector motifs** | `meniscus-line.svg` (3 stroke weights) — draws under section eyebrows; `flow-contours.svg` — 3–5 topographic curves at 8% opacity behind dark bands, 2% scroll drift | S 🎬 |
| F3 | **Grain** | Already shipped as inline SVG (`sf-grain` in globals.css) — no work, just keep opacity ≤ 2–6% per surface | — ✅ |
| F4 | **Italic-accent utility** | `@utility u-accent { font-style: italic; }` scoped to display font; used once per headline max (Instrument Serif italic). Note: never applied in non-Latin locales — gate via `locale` check (Latin only) | S |
| F5 | **Kinetic heading helper** | Re-register `SplitText` in `src/lib/gsap.ts` (was removed as dead weight — now it has a consumer); `KineticHeading` client component: word-split rise + rotateX 8°, stagger 0.05s, `power4.out`, trigger 85%. Guards identical to `SmoothScrollProvider` | M |
| F6 | **CTA restyle** | Retire teal everywhere (`variant="whatsapp"` → champagne-on-dark / ink-on-light per audit §2.4); one hover sweep (background scaleX 0→1 from left, 300ms); magnetic pull on desktop pills (`featured-rail.tsx` already shows the guard pattern) | M |
| F7 | **Copy/i18n rule** | Every new string lands in `messages/en.json` + the other 8 locale files (English fallback text is acceptable interim), then `npm run copy:registry` to regen `site-copy.generated.ts`; CI gate: `copy:check` must pass | per-page |

**Performance & accessibility budgets (every page, no exceptions):** LCP < 2.5s · INP < 200ms · CLS < 0.1 · hero media ≤ 6MB · one `priority` image per page (the hero) · every animation behind `prefers-reduced-motion` with a stated resting frame · `save-data` → no video · Lighthouse ≥ 90 mobile · axe-core clean.

---

## 2. Storefront — page-by-page

### 2.1 Home `/` — *70% done in PR #96*

| What | Detail | Assets | Effort |
|---|---|---|---|
| Hero | New poster already wired via `home.hero` slot → `hero-pour.jpg` ✅. Add: italic accent word in headline (F4), keep existing `sf-hero-rise` entrance | 🎬 `hero-pour.mp4` 8–12s loop ≤6MB (poster = existing jpg) → Site Settings hero video field | S |
| Manifesto | Keep current `sf-manifesto-brighten` (view-timeline) — matches spec | — | — |
| Collections → Doors | ✅ shipped (PR #96). Follow-up P2: collapse six tiles to the **three intents** when tier copy lands | doorways ✅ (in slot fallbacks) | — |
| Featured → Rail | ✅ shipped (PR #96) | product imagery = owner's Studio photos | — |
| Process strip | `PourCureShowcase` already implements the pinned scrub with bundled 121 frames — keep; restyle text stops to mockup (mono numbers, meniscus rule) | frames ✅ bundled | S |
| Testimonials | Add featured quote band between Work and Bespoke (big serif italic quote, in-home photo, 3-dot rotator — mockup §S6) | 📷/✅ `testimonial-home.jpg` | M |
| Maker | Keep section; repoint slot only when a **real** maker photo exists (slot rule §15.2 forbids generated here) | 📷 maker portrait + 4 bench shots | S (code) |
| Journal | Convert featured+2 grid → editorial list with cursor-follow cover previews (mockup §S8) | covers = existing blog covers | M |
| Final CTA | Restyle to mockup §S9: obsidian + `texture-resin-flow.jpg` at 30%, 120px serif, magnetic champagne pill | ✅ texture (slot repointed) | S |
| Delete/demote | Move Workshops + 3D-print bands off home (footer/About links); single process story | — | S |

**Acceptance:** 9 sections max · 3 dark bands max, never adjacent · mobile rail native-scroll · `copy:check` green.

### 2.2 Shop `/shop` + collection pages

| What | Detail | Assets | Effort |
|---|---|---|---|
| Intent tabs | Tabs = Collectible · Memory · Gifts (+Print as secondary); sliding pill indicator (layout-animated); hide tabs with 0 published products | — | M |
| Tier card variants | `cardVariantFor` exists in `card-meta.ts` — extend to 3 layouts: Gift (square, price, one action) · Memory (portrait, occasion, lead time, "Preserve this") · Collectible (landscape, materials+size, "Price on request") | — | L |
| Filter chips | Active filters as removable chips under toolbar + "Clear all"; FLIP re-flow on change | — | M |
| Collection strip | 45% bottom scrim on cards, titles padded inside, peek+drag affordance | category images (owner) | S |
| Grid polish | Uniform 4:5 crop enforced; hover = second image crossfade (hoverImage already in data model); staggered entry only below fold | — | M |
| Thin-catalog reframe | Drop "X of Y" counter; grid ends with editorial card: *"Can't find it? It doesn't exist yet — commission it."* → `/custom-order` | — | S |

### 2.3 Product page `/product/[slug]` — *mockup ready (`pdp.html`)*

| What | Detail | Assets | Effort |
|---|---|---|---|
| Gallery | Sticky 4:5 stage + thumb rail + hover zoom lens (desktop) / swipe+dots (mobile) + lightbox. Shot list enforced: hero · macro · in-situ · process | 📷 per-product in-situ; ✅ `insitu-bangle-wrist.jpg` as reference | L |
| Buy panel | Mono price ("from ₹X" when ranged), required option pills/swatches, engraving input, accordion specs (Materials/Dimensions/Lead time/Care), icon trust chips (F1), one sticky primary CTA per tier | F1 icons | L |
| Live WhatsApp preview | Promote the existing message preview into the green-bubble card (mockup pattern) — it already exists in repo logic; restyle only | — | S |
| Mobile | Sticky bottom CTA bar (price + "Customize & order") — biggest mobile conversion win | — | S |
| Below fold | Story band (full-width in-situ + 60ch story) → spec table → product-linked testimonials → "Pieces like this" rail (same intent) | 📷 | M |
| Hygiene | Hide empty accordions; one accessible product name; honeypot `aria-hidden` check | — | S |

### 2.4 Custom order `/custom-order` — *mockup ready (`custom-order.html`)*

| What | Detail | Assets | Effort |
|---|---|---|---|
| True wizard | Convert the 01–04 anchor rail into a real 4-step flow (Idea → Details → References → You) with slide+fade transitions, per-step validation, meniscus progress line filling 0→100% | F2 meniscus | L |
| Visual pickers | Material = 5 macro-thumbnail cards; occasion = icon chips; budget/timeline = pills. Replaces native selects | ✅ doorway/texture thumbs reused | M |
| Dropzone | Existing `reference-image-uploader.tsx` — restyle dashed zone, thumb strip, pop-in animation | — | S |
| Review & send | Whole brief rendered as the exact WhatsApp message (green bubble, mono); submit → success screen: animated check draw, mono order number, *"Saved — even if WhatsApp doesn't open."* | — | M |
| Dedupe | Merge "How it works" steps 03/04 (curing said twice) into Idea → Quote → Make → Deliver | — | S |

### 2.5 Large format `/large-resin-art`

Hero = finished piece in a real interior (audit §3.6 — **note:** repo slot rule §15.2 currently forbids "finished piece presented as delivered commission" — resolve by captioning concept or shooting a real install); single CTA (delete the duplicate); 3 case frames with dimensions/materials/lead-time in mono; "how a large commission runs" 4-step hairline. **Effort:** M · **Assets:** 📷 3 real interiors (or ✅ `doorway-collectible.jpg` as captioned concept).

### 2.6 About `/about`

Maker-first order (portrait → story → 4-photo documentary strip with parallax → 4 value icons animated (F1) → address/hours/map card). Fix H1 widow. New hero texture already slotted ✅ (`about.hero` → resin-flow). **Effort:** M · **Assets:** 📷 maker + bench set.

### 2.7 Portfolio `/portfolio` + case pages

Filters → commission types (Wedding · Furniture · Objects · Wall) with mono counts; card hover reveals one-line brief; project number on scrim chip (always legible); publish guard: no cover → no render (Studio §5.3). Case page: 70vh hero → brief 2-col → before/after slider with champagne meniscus handle → masonry lightbox → next-project giant link. **Effort:** M.

### 2.8 Journal `/blog` + article

Index = editorial list + cursor-preview covers; featured = 70vh cover + oversized title; cut chips with <3 posts. Article: 62ch column, serif-italic pull quotes 40px, progress hairline, mono read-time. **Effort:** M.

### 2.9 Workshops / Contact / FAQ / Search / Legal / 404

| Page | Moves | Effort |
|---|---|---|
| Workshops | Keep page; promote on home only when bookable. Real room photos | S |
| Contact | Dedupe WhatsApp card copy; response time on the button; 2×2 animated-icon cards; duotone map + champagne pin | S |
| FAQ | Keep; accordion chevron animation; link into PDP care accordion | S |
| Search | Results group: Pieces · Collections · Journal; empty state → commission CTA | M |
| Privacy/Terms | No design change; prose measure 68ch, mono date stamp | — |
| 404/error | `visual-404.jpg` vortex full-bleed ✅ · 200px "Lost in the pour." · one magnetic pill · rename "Back to the studio" → "Back to the collection" | S |

---

## 3. Studio `/studio` — page-by-page

**Design principle:** the Studio is a tool, not a showroom — no display serif in data tables, numbers in `u-num`, champagne marks the active nav item only. Every list gets a designed empty state with the next action.

| # | Screen | What to build | Effort |
|---|---|---|---|
| S1 | **Login** | Real studio photo or "today" strip (new-inquiries count) in the dead right pane; caps-lock hint; keep the calm card | S 📷 |
| S2 | **Overview (Dashboard)** | Become the morning **action queue**: cards = New inquiries since last visit · Inquiries stuck >24h · Published with rewrite flags · Live products missing images · Drafts >30 days. Each card deep-links to its filtered list | M |
| S3 | **Commissions (Inquiries)** | **Kanban view** (New→Contacted→Quoted→Confirmed→Delivered) beside the table; one-click **"Open WhatsApp + mark Contacted"**; product thumbnail on every row; mobile card-list first (owner works from a phone) | L |
| S4 | **Products list** | Default filters `Live + missing image`, `No tier`; thumbnails + rewrite-flag column; bulk: set tier / unpublish / replace cover / **duplicate** | M |
| S5 | **Product form + Form Builder** | Per-tier field **templates** (gift/memory/collectible) one-click applicable (templates exist since Phase 11 — surface them); gallery uploader slot hints (hero/macro/in-situ/process) + auto-alt suggestions; **publish guard**: no hero image · no tier · `needsRewrite` unresolved · spec-lint (imperial-only units / external image URLs / source-brand tokens) → cannot publish | L |
| S6 | **Categories** | Keep; add per-category image-quality hint (ratio + min width from `siteImageMinWidth`) | S |
| S7 | **Media Library** | "Used by" surfaced on card; **"Set as product cover"** action; 7-day **marked-deleted** state before permanent purge; bulk WebP convert/compress; "large files" smart filter; image lint (watermark/low-res heuristics) → feeds S2 card | L |
| S8 | **Bulk Import / Catalog fill / Exports** | Rename "Catalog fill" → "Catalog pipeline (auto)" + distinct icon + cross-link from Bulk Import; keep conflict UI; preview stays default-on | S |
| S9 | **Site Content hub** | Consolidate 9 surfaces (Site Copy · Site Images · Page Sections · Process Steps · Materials · Navigation · Commission Form · Pages · Landing Pages) into one hub with tabs; Process Steps & Materials become filtered views (they already are — `SUBLIST_PAGES`); Pages + Landing Pages merge via a "landing" flag | L |
| S10 | **Editorial** (Journal · Portfolio · Testimonials · FAQs) | No redesign — add per-list empty states + publish guards (portfolio needs cover; testimonial needs permission — exists) | S |
| S11 | **Research** (Scraper · Research · Content Gaps) | Collapse into one weekly-tool nav group, hidden from first screen; review inbox defaults: suggested tier + has image + not marketplace; "Add to catalog" always lands draft + needs-rewrite + hidden (existing rule — keep) | M |
| S12 | **Settings / SEO / Users / Subscribers / Content Lab / Activity** | Keep; add Instagram/socials wiring check so the footer icon actually renders (audit §2.3) | S |
| S13 | **Studio shell** | Sidebar → **Today · Catalogue · Content · Editorial · Settings** (~18 items) + pin/favorites row; ⌘K palette surfaced in topbar; no new tokens | M |

---

## 4. Master asset production list

### 4.1 Images — delivered ✅ (14, in handoff; go to `public/redesign/`)
hero-pour · texture-resin-flow · doorway-collectible · doorway-memory · doorway-gifts · maker-hands · product-bangle · product-varmala-frame · product-coasters · product-platter · insitu-bangle-wrist · insitu-tray-table · testimonial-home · visual-404 — all web-optimized JPEG, one grade.

### 4.2 Images — to produce 🎬 (generatable, same prompt family)
Per-category collection cards (16) · journal covers (3–6) · PDP in-situ per hero product · 404 alternates. Prompt template: *"[subject], deep sapphire + champagne gold on obsidian/sand, cinematic side light, editorial luxury, photorealistic, no text"*.

### 4.3 Images — must be real 📷 (no substitutes)
Maker portrait · 4 bench documentary shots (pour/bench/finish/install) · workshop room · per-hero-product in-situ · any product currently shot on grass/cloth → reshoot on mist seamless. Slot rules §15.2 make the maker/workshop ones mandatory-real.

### 4.4 Video 🎬
| Asset | Spec | Use |
|---|---|---|
| Hero pour loop | 8–12s, 1080p, ≤6MB MP4 (+WebM), muted loop, poster = hero-pour.jpg | Home hero (Site Settings field) |
| Maker polish loop | 6s, ≤3MB | Home maker band |
| Workshop ambient | 10s, optional | About |
| Pour→cure frames | 121-frame sequence | ✅ already bundled (`public/sequences/pour-cure`) |

### 4.5 Icons & vectors 🎬
6 custom duotone SVGs (F1) · meniscus-line.svg ×3 weights · flow-contours.svg · animated Lucide trust set (hand / shield / rotate / clock / chat) · empty-state illustration set for Studio lists (3: packages, inbox, images — line style, 1.5px).

---

## 5. Engineering notes (repo-specific)

- **Stack is already correct:** GSAP + ScrollTrigger (`@/lib/gsap`), Lenis (`SmoothScrollProvider` guards), view-transitions, MeniscusImage, SnapRail — new work plugs into these, never around them.
- **Guards pattern to copy:** `featured-rail.tsx` (PR #96) — SSR-safe default, dynamic import, reduced-motion + coarse-pointer gates.
- **Motion budget ratchet:** `scripts/motion-budget.mjs` weighs GSAP chunks — SplitText re-add (F5) must stay under the 49KB gate.
- **Copy:** all new strings → `messages/*.json` ×9 → `npm run copy:registry` → `copy:check` green in CI.
- **Tests:** `vitest` for logic; `test:e2e` smoke; Playwright + axe-core for a11y passes on changed pages; Lighthouse CI budgets above.
- **No DB/schema changes anywhere in this plan.** Studio-facing data needs (kanban status, marked-deleted) reuse existing fields.

## 6. Roadmap

| Phase | Window | Contents |
|---|---|---|
| **P0** | Week 1 | Phase 0 (merge PR, images, content sweep, redirects, locale) · F6 CTA restyle · Studio S5 publish guard |
| **P1** | Weeks 2–4 | Home remainder (testimonials band, journal list, final CTA, demote bands) · PDP · Custom Order wizard · Shop tabs + chips · Studio S2 action queue + S3 kanban · F1/F2/F5 foundation |
| **P2** | Weeks 5–8 | Large format · About · Portfolio · Journal · Contact/404 · Shop tier cards · Studio S7 media + S9 content hub + shell IA |
| **P3** | Weeks 9–10 | Preloader · SplitText everywhere · cursor system · marquee whisper · video loops · award submission assets (case-study video) |

**Definition of done (every phase):** budgets green · reduced-motion resting states verified by hand · 9 locales render · `copy:check` + `tsc` + `eslint` + e2e smoke green · owner walkthrough on the Vercel preview before merge.
