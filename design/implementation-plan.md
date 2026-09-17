# Rivya Living Art — Full Implementation Plan (v3.3)
### Every page of the storefront + the Studio · all assets · all motion · all dependencies · interaction layer · Claude Code prompt · zero DB changes

**Inputs this plan consolidates:** the UI/UX audit v2, the Awwwards-level redesign spec, the three interactive mockups (preview version `9f1c6e0`), PR #96 (merged to `main`), the repo's own REDESIGN.md / three-tier architecture, and the **Google Drive asset library** — https://drive.google.com/drive/folders/1P2HCTmPge6HsEwtoo-xGEzPTSn68oZOW — fully inventoried and visually verified (§4.2, file-ID appendix §4.7).

**Legend** — Effort: `S` ≤½ day · `M` 1–2 days · `L` 3–5 days. Priority: **P0** trust/correctness · **P1** conversion & brand · **P2** depth & polish · **P3** award garnish. Asset status: ✅ generated/delivered · 📁 in the Drive library (verified) · 🎬 to produce (brief included) · 📷 must be real photography.

---

## 0. Phase 0 — Land what's already built + ingest the Drive library (do first)

| # | Action | Where | Effort |
|---|---|---|---|
| 0.1 | ~~Merge **PR #96**~~ ✅ **Done** — verified merged into `main` (`featured-rail.tsx`, `collection-doors.tsx`, `design/*` all present; branch deleted) | GitHub | — |
| 0.2 | Upload the 14 `public/redesign/*.jpg` assets (Add file → Upload files; names per `public/redesign/README.md`) — **still open**: only `README.md` is on `main`, the JPGs are not | GitHub | S |
| 0.3 | **Content integrity sweep** (audit §2.1): unpublish/rewrite `wide-boulder-bangle`, `baby-keepsakes-detailing-frame-radhika-art`, `wedding-invitation-card-in-resin`; sweep all published products for competitor copy, watermarks, wrong categories | Studio → Products | M |
| 0.4 | Redirects: `/journal` → `/blog`, `/collection` → `/shop` (one line each in `next.config.ts` `redirects()`) | Code | S |
| 0.5 | Locale default = English on first visit + cookie memory (audit §2.6, `src/proxy.ts`) | Code | S |
| 0.6 | **Drive ingestion:** download `final/product-heroes/` (35 PNG) + `final/room-scenes/` (10 PNG) from Drive → run the optimization pipeline (§5.4) → commit WebP masters to `public/redesign/catalog/heroes/` + `…/scenes/` | Local → GitHub | M |
| 0.7 | **Visual QA pass** on all 45 Drive images (contact-sheet review; 3 already verified: hero-001 river table, hero-020 varmala frame, scene-001 golden-hour dining — all on-palette). Reject/regenerate anything off-grade | Browser | S |
| 0.8 | **Video QA pass** on `videos/` (26 Higgsfield MP4s, 0.6–5.8MB): pick hero-loop + maker-loop candidates, check duration/loopability/first-frame; transcode picks per §4.4 | Local (ffmpeg) | S |

---

## 1. Foundation layer (shared by every page)

Build these once; every page below consumes them.

| # | Item | Spec | Packages | Effort |
|---|---|---|---|---|
| F1 | **Icon set** | 6 custom duotone SVGs (1.5px stroke + champagne fill accent): `pour` · `gild` · `cure` · `polish` · `preserve` · `print`. Self-drawing on first scroll-in (`stroke-dashoffset`, 600ms). Live in `src/components/icons/` beside the Lucide set. Hand-authored SVG — no library | — (code) | M 🎬 |
| F2 | **Vector motifs** | `meniscus-line.svg` (3 stroke weights) — draws under section eyebrows; `flow-contours.svg` — 3–5 topographic curves at 8% opacity behind dark bands, 2% scroll drift. Hand-authored SVG | — (code) | S 🎬 |
| F3 | **Grain** | Already shipped as inline SVG (`sf-grain` in globals.css) — keep opacity ≤ 2–6% per surface | — | — ✅ |
| F4 | **Italic-accent utility** | `@utility u-accent { font-style: italic; }` scoped to display font; once per headline max (Instrument Serif italic). Never in non-Latin locales — gate via `locale` check | tailwindcss v4 | S |
| F5 | **Kinetic heading helper** | Re-register `SplitText` in `src/lib/gsap.ts` (GSAP ≥3.13 ships it free — repo has 3.15, zero added weight beyond the plugin itself); `KineticHeading` client component: word-split rise + rotateX 8°, stagger 0.05s, `power4.out`, trigger 85%. Guards identical to `SmoothScrollProvider` | gsap | M |
| F6 | **CTA restyle** | Retire teal everywhere (`variant="whatsapp"` → champagne-on-dark / ink-on-light per audit §2.4); one hover sweep (background scaleX 0→1 from left, 300ms); magnetic pull on desktop pills (guard pattern in `featured-rail.tsx`) | tailwindcss · gsap (magnetic) | M |
| F7 | **Copy/i18n rule** | Every new string lands in `messages/en.json` + the other 8 locale files (English fallback acceptable interim) → `npm run copy:registry` → CI gate `copy:check` | next-intl | per-page |

**Performance & accessibility budgets (every page, no exceptions):** LCP < 2.5s · INP < 200ms · CLS < 0.1 · hero media ≤ 6MB · one `priority` image per page (the hero) · every animation behind `prefers-reduced-motion` with a stated resting frame · `save-data` → no video · Lighthouse ≥ 90 mobile · axe-core clean.

---

## 2. Storefront — page-by-page

### 2.1 Home `/` — *70% done in PR #96*

| What | Detail | Assets | Effort |
|---|---|---|---|
| Hero | New poster already wired via `home.hero` slot → `hero-pour.jpg` ✅. Add: italic accent word (F4), keep `sf-hero-rise` entrance | 🎬/📁 `hero-pour.mp4` 8–12s loop ≤6MB — **first try Drive `videos/` picks (0.8)**; else generate via video tool. Poster = existing jpg → Site Settings hero video field | S |
| Manifesto | Keep current `sf-manifesto-brighten` (view-timeline) — matches spec | — | — |
| Collections → Doors | ✅ shipped (PR #96). Follow-up P2: collapse six tiles to the **three intents** when tier copy lands | doorways ✅ (slot fallbacks) | — |
| Featured → Rail | ✅ shipped (PR #96). Production imagery = owner's Studio photos; **dev/preview placeholders: Drive heroes 028–035 (small objects) — flagged, never publishable (§4.6 rule)** | 📁 + 📷 | — |
| Process strip | `PourCureShowcase` already implements the pinned scrub with bundled 121 frames — keep; restyle text stops to mockup (mono numbers, meniscus rule) | frames ✅ bundled | S |
| Testimonials | Add featured quote band between Work and Bespoke (big serif italic quote, in-home photo, 3-dot rotator — mockup §S6) | ✅ `testimonial-home.jpg`; 📁 scenes 001–010 as rotator stand-ins | M |
| Maker | Keep section; repoint slot only when a **real** maker photo exists (slot rule §15.2 forbids generated here). Interim: keep `maker-hands.jpg` (hands only — allowed) | 📷 maker portrait + 4 bench shots | S (code) |
| Journal | Convert featured+2 grid → editorial list with cursor-follow cover previews (mockup §S8) | 📁 covers: form studies hero-024–027 + texture crops ✅ | M |
| Final CTA | Restyle to mockup §S9: obsidian + `texture-resin-flow.jpg` at 30%, 120px serif, magnetic champagne pill | ✅ texture (slot repointed) | S |
| Delete/demote | Move Workshops + 3D-print bands off home (footer/About links); single process story | — | S |

**Acceptance:** 9 sections max · 3 dark bands max, never adjacent · mobile rail native-scroll · `copy:check` green.

### 2.2 Shop `/shop` + collection pages

| What | Detail | Assets | Effort |
|---|---|---|---|
| Intent tabs | Tabs = Collectible · Memory · Gifts (+Print as secondary); sliding pill indicator (layout-animated); hide tabs with 0 published products | — | M |
| Tier card variants | `cardVariantFor` exists in `card-meta.ts` — extend to 3 layouts: Gift (square, price, one action) · Memory (portrait, occasion, lead time, "Preserve this") · Collectible (landscape, materials+size, "Price on request") | — | L |
| Filter chips | Active filters as removable chips under toolbar + "Clear all"; FLIP re-flow on change | — | M |
| Collection strip | 45% bottom scrim on cards, titles padded inside, peek+drag affordance | ✅ doorway trio + 📁 Drive crops per category | S |
| Grid polish | Uniform 4:5 crop enforced; hover = second image crossfade (`hoverImage` already in data model); staggered entry only below fold. **Dev placeholders by tier: Collectible = heroes 001–019 · Memory = 020–023 · Gift = 028–035 (§4.6 rule)** | 📁 | M |
| Thin-catalog reframe | Drop "X of Y" counter; grid ends with editorial card: *"Can't find it? It doesn't exist yet — commission it."* → `/custom-order` | — | S |

### 2.3 Product page `/product/[slug]` — *mockup ready (`pdp.html`)*

| What | Detail | Assets | Effort |
|---|---|---|---|
| Gallery | Sticky 4:5 stage + thumb rail + hover zoom lens (desktop) / swipe+dots (mobile) + lightbox (custom on `@radix-ui/react-dialog` — no new dep). Shot list enforced: hero · macro · in-situ · process. **Dev shot-list placeholders: matching Drive hero + scene pair (e.g. hero-001 + scene-001), macro = center-crop of hero** | 📁 + 📷 per-product in-situ; ✅ `insitu-bangle-wrist.jpg` as reference | L |
| Buy panel | Mono price ("from ₹X" when ranged), required option pills/swatches, engraving input, accordion specs (Materials/Dimensions/Lead time/Care), icon trust chips (F1), one sticky primary CTA per tier | F1 icons | L |
| Live WhatsApp preview | Promote the existing message preview into the green-bubble card (mockup pattern) — repo logic exists; restyle only | — | S |
| Mobile | Sticky bottom CTA bar (price + "Customize & order") — biggest mobile conversion win | — | S |
| Below fold | Story band (full-width in-situ + 60ch story) → spec table → product-linked testimonials → "Pieces like this" rail (same intent) | 📁 scenes as dev in-situ | M |
| Hygiene | Hide empty accordions; one accessible product name; honeypot `aria-hidden` check | — | S |

### 2.4 Custom order `/custom-order` — *mockup ready (`custom-order.html`)*

| What | Detail | Assets | Effort |
|---|---|---|---|
| True wizard | Convert the 01–04 anchor rail into a real 4-step flow (Idea → Details → References → You) with slide+fade transitions, per-step validation, meniscus progress line filling 0→100% | F2 meniscus | L |
| Visual pickers | Material = 5 macro-thumbnail cards (📁 center-crops of heroes 024–027 + `texture-resin-flow.jpg`); occasion = icon chips (F1/Lucide); budget/timeline = pills. Replaces native selects | 📁 + ✅ | M |
| Dropzone | Existing `reference-image-uploader.tsx` — restyle dashed zone, thumb strip, pop-in animation (client compression already installed: `browser-image-compression`) | — | S |
| Review & send | Whole brief rendered as the exact WhatsApp message (green bubble, mono); submit → success screen: animated check draw, mono order number, *"Saved — even if WhatsApp doesn't open."* | — | M |
| Dedupe | Merge "How it works" steps 03/04 (curing said twice) into Idea → Quote → Make → Deliver | — | S |
| Inspirations strip (new, optional P2) | "What we can preserve" band: framed varmala / block / keepsake set | 📁 heroes 020–023 | S |

### 2.5 Large format `/large-resin-art`

Hero = finished piece in a real interior (audit §3.6 — repo slot rule §15.2 forbids presenting generated work as a delivered commission — **resolve by captioning Drive scenes as "concept visualisation" or shooting a real install**); single CTA (delete the duplicate); 3 case frames with dimensions/materials/lead-time in mono — **📁 scenes 001 / 004 / 010 with "concept" caption chips until real installs exist**; "how a large commission runs" 4-step hairline. **Effort:** M · **Assets:** 📁 now · 📷 3 real interiors for the final frames.

### 2.6 About `/about`

Maker-first order (portrait → story → 4-photo documentary strip with parallax → 4 value icons animated (F1) → address/hours/map card). Fix H1 widow. New hero texture already slotted ✅ (`about.hero` → resin-flow). **Effort:** M · **Assets:** 📷 maker + bench set (mandatory-real §15.2); 📁 hero-026 (material panel) as interim texture band.

### 2.7 Portfolio `/portfolio` + case pages

Filters → commission types (Wedding · Furniture · Objects · Wall) with mono counts; card hover reveals one-line brief; project number on scrim chip; publish guard: no cover → no render. Case page: 70vh hero → brief 2-col → before/after slider with champagne meniscus handle (custom pointer component — no new dep) → masonry lightbox → next-project giant link. **Assets:** 📁 heroes/scenes as dev case placeholders (§4.6 rule); 📷 real cases replace them. **Effort:** M.

### 2.8 Journal `/blog` + article

Index = editorial list + cursor-preview covers; featured = 70vh cover + oversized title; cut chips with <3 posts. Article: 62ch column, serif-italic pull quotes 40px, progress hairline, mono read-time. **Assets:** 📁 covers from form studies hero-024/025/027 + `flow-contours.svg` (F2) for text-led posts. **Effort:** M.

### 2.9 Workshops / Contact / FAQ / Search / Legal / 404

| Page | Moves | Assets | Effort |
|---|---|---|---|
| Workshops | Keep page; promote on home only when bookable | 📷 real room photos | S |
| Contact | Dedupe WhatsApp card copy; response time on the button; 2×2 animated-icon cards (F1); duotone map + champagne pin (styled static map SVG — code) | F1 | S |
| FAQ | Keep; accordion chevron animation; link into PDP care accordion | — | S |
| Search | Results group: Pieces · Collections · Journal; empty state → commission CTA | — | M |
| Privacy/Terms | No design change; prose measure 68ch, mono date stamp | — | — |
| 404/error | `visual-404.jpg` vortex full-bleed ✅ · 200px "Lost in the pour." · one magnetic pill · rename "Back to the studio" → "Back to the collection" — full spec §2.10 | ✅ | S |

### 2.10 System pages — 404 · error · login · maintenance

**Note:** the storefront has **no customer login by design** (business rule: no accounts; orders finalize on WhatsApp). "Login" = the staff-only Studio login. All four pages share one system-page shell: full-bleed obsidian, one display headline, one action, cure-line at the foot, mono meta line.

| Page | Design & copy | Motion | Assets | Effort |
|---|---|---|---|---|
| **404** `/404` | `visual-404.jpg` vortex full-bleed at 60% under obsidian veil · 200px serif "Lost in the pour." (F4 italic on "pour") · mono sub: `ERR-404 / page not found` · one magnetic champagne pill "Back to the collection" · no nav, no footer links | Headline word-rise (F5) · pill magnetic (§6.2) · veil fade 400ms | ✅ `visual-404.jpg` | S |
| **Error / 500** | Same shell, `texture-resin-flow.jpg` at 20% · "The pour broke." · mono error reference code + `Try again` pill (soft reload) · calm, never alarming | Same as 404, no magnetic on retry | ✅ texture | S |
| **Studio login** `/studio/login` | Split 50/50: left = calm card (mono label, floating-label inputs §6.8, caps-lock hint, submit pill) · right = `maker-hands.jpg` with "today" strip (new-inquiries count) once authed-data allows; failed login = one 300ms shakeX + vermilion mono error | Card rise 16px/300ms on mount · input focus hairline | ✅ `maker-hands.jpg` (📷 real studio photo replaces later) | S |
| **Maintenance / coming-soon** | `texture-resin-flow.jpg` veil · "Back when the resin cures." · cure-line progress animation (loops at 90%) · notify-me input → existing subscribers feature | Cure-line loop 2.4s · input = §6.8 | ✅ texture | S |

**Acceptance:** all four render in 9 locales (RTL included) · no layout shift on font load · reduced-motion = static resting frame · `copy:check` green.

---

## 3. Studio `/studio` — page-by-page

**Design principle:** the Studio is a tool, not a showroom — no display serif in data tables, numbers in `u-num`, champagne marks the active nav item only. Every list gets a designed empty state with the next action.

| # | Screen | What to build | Packages | Effort |
|---|---|---|---|---|
| S1 | **Login** | Real studio photo or "today" strip (new-inquiries count) in the dead right pane; caps-lock hint; keep the calm card. Interim visual: ✅ `maker-hands.jpg` — full spec §2.10 | — | S 📷 |
| S2 | **Overview (Dashboard)** | Become the morning **action queue**: cards = New inquiries since last visit · Inquiries stuck >24h · Published with rewrite flags · Live products missing images · **Products on placeholder covers (§4.6 lint)** · Drafts >30 days. Each card deep-links to its filtered list | recharts (existing) | M |
| S3 | **Commissions (Inquiries)** | **Kanban view** (New→Contacted→Quoted→Confirmed→Delivered) beside the table; one-click **"Open WhatsApp + mark Contacted"**; product thumbnail on every row; mobile card-list first | **@dnd-kit/core + sortable (new — §5.2)** | L |
| S4 | **Products list** | Default filters `Live + missing image`, `No tier`, `Placeholder cover`; thumbnails + rewrite-flag column; bulk: set tier / unpublish / replace cover / **duplicate** | — | M |
| S5 | **Product form + Form Builder** | Per-tier field **templates** one-click applicable (exist since Phase 11 — surface them); gallery uploader slot hints (hero/macro/in-situ/process) + auto-alt suggestions; **publish guard**: no hero image · no tier · `needsRewrite` unresolved · **cover under `/redesign/catalog/` (placeholder)** · spec-lint (imperial-only units / external image URLs / source-brand tokens) → cannot publish | — | L |
| S6 | **Categories** | Keep; add per-category image-quality hint (ratio + min width from `siteImageMinWidth`) | — | S |
| S7 | **Media Library** | "Used by" surfaced on card; **"Set as product cover"** action; 7-day **marked-deleted** state before permanent purge; bulk WebP convert/compress (server `sharp` — installed); "large files" smart filter; image lint (watermark/low-res/placeholder-path heuristics) → feeds S2 card | sharp | L |
| S8 | **Bulk Import / Catalog fill / Exports** | Rename "Catalog fill" → "Catalog pipeline (auto)" + distinct icon + cross-link from Bulk Import; keep conflict UI; preview stays default-on | exceljs · papaparse (existing) | S |
| S9 | **Site Content hub** | Consolidate 9 surfaces (Site Copy · Site Images · Page Sections · Process Steps · Materials · Navigation · Commission Form · Pages · Landing Pages) into one hub with tabs; Pages + Landing Pages merge via a "landing" flag | @radix-ui/react-tabs | L |
| S10 | **Editorial** (Journal · Portfolio · Testimonials · FAQs) | No redesign — add per-list empty states + publish guards (portfolio needs cover; testimonial needs permission — exists) | — | S |
| S11 | **Research** (Scraper · Research · Content Gaps) | Collapse into one weekly-tool nav group, hidden from first screen; review inbox defaults: suggested tier + has image + not marketplace; "Add to catalog" always lands draft + needs-rewrite + hidden (existing rule — keep) | — | M |
| S12 | **Settings / SEO / Users / Subscribers / Content Lab / Activity** | Keep; add Instagram/socials wiring check so the footer icon actually renders (audit §2.3) | — | S |
| S13 | **Studio shell** | Sidebar → **Today · Catalogue · Content · Editorial · Settings** (~18 items) + pin/favorites row; ⌘K palette surfaced in topbar (`cmdk` — installed); no new tokens | cmdk | M |

---

## 4. Master asset production list

### 4.1 Images — delivered ✅ (14, in handoff; go to `public/redesign/`)
hero-pour · texture-resin-flow · doorway-collectible · doorway-memory · doorway-gifts · maker-hands · product-bangle · product-varmala-frame · product-coasters · product-platter · insitu-bangle-wrist · insitu-tray-table · testimonial-home · visual-404 — web-optimized JPEG, one grade.

### 4.2 Drive library — verified 📁 (45 images + 26 videos)

Source: Google Drive — https://drive.google.com/drive/folders/1P2HCTmPge6HsEwtoo-xGEzPTSn68oZOW (folder ID `1P2HCTmPge6HsEwtoo-xGEzPTSn68oZOW`). **This Drive folder is the single source of truth for all generated imagery** — fetch from here (file IDs in §4.7), never invent substitutes. Own README caveat: portraits are **1122×1402** (brief minimum was 2048×2560) and scenes **1672×941** (minimum 2560×1440) — all AI concept visualisations of placeholder designs. Consequences: fine for cards, rails, PDP stages, dev seeding, and captioned concepts; **not** for full-bleed ≥2000px heroes without an upscale pass (§5.4 step 3).

| Group | Files | Subjects (per `asset-index.csv`) | Used for |
|---|---|---|---|
| Furniture heroes 📁 | `product-hero-001…010-4x5.png` | Live-edge dining river table · full-pour dining · coffee table · circular centre table · 2 consoles · desk slab · side-table pair · bench · monumental table | Collectible PDP/card dev placeholders · large-format concept frames · lookbook |
| Wall heroes 📁 | `product-hero-011…015-4x5.png` | Horizon panel · vertical drop · triptych · layered relief · circular wall piece | Collectible (wall) placeholders · portfolio dev covers |
| Hybrid heroes 📁 | `product-hero-016…019-4x5.png` | Lattice object · parametric vessel · desk object · architectural cast | 3D-print + resin collection placeholders |
| Memory heroes 📁 | `product-hero-020…023-4x5.png` | **Varmala framed (visually verified — deep-blue wall, rose+marigold garland, on-palette)** · varmala block · keepsake small · keepsake set | Memory PDP placeholders · custom-order "what we can preserve" strip · doorway-memory alternates |
| Form studies 📁 | `product-hero-024…027-4x5.png` | Form Study I–III · material panel | Journal covers · texture bands · custom-order material cards (center-crops) · Studio empty-state art |
| Gift heroes 📁 | `product-hero-028…035-4x5.png` | Serving tray · coaster set · catch-all bowl · bookends · desk piece · paperweight · ring dish · keepsake box | Gift PDP/card placeholders · featured-rail dev content |
| Room scenes 📁 | `product-scene-001…010-16x9.png` | Interiors for the ten furniture subjects (scene-001 verified — golden-hour river-table room, on-palette) | Large-format case frames (captioned) · PDP in-situ stand-ins · testimonial band rotator |
| Video clips 📁 | `videos/hf_*.mp4` ×26 (0.6–5.8MB) | Higgsfield resin clips (one verified: shimmering blue resin block on plinth — on-brand) | Hero pour loop + maker polish loop **candidates** — pick at 0.8; losers stay out of the repo |

Full file-ID appendix (for scripted download): §4.7.

### 4.3 Images — still to generate 🎬 (me, same prompt family as 4.1)
Nothing blocking remains after 4.1 + 4.2 — the Drive library closed the gaps (collection cards, PDP in-situ stand-ins, journal covers). Regenerate only what 0.7 rejects. Prompt template: *"[subject], deep sapphire + champagne gold on obsidian/sand, cinematic side light, editorial luxury, photorealistic, no text"* — portraits 1122×1402 minimum, then §5.4 pipeline.

### 4.4 Video 🎬/📁
| Asset | Spec | Source |
|---|---|---|
| Hero pour loop | 8–12s, 1080p, ≤6MB MP4 (+WebM), muted loop, poster = hero-pour.jpg | **0.8 pick from Drive `videos/`** → ffmpeg transcode; fallback: I generate one via the video tool |
| Maker polish loop | 6s, ≤3MB | Drive pick or 📷 real bench clip (preferred long-term) |
| Workshop ambient | 10s, optional | 📷 real only (rule §15.2 spirit) |
| Pour→cure frames | 121-frame sequence | ✅ already bundled (`public/sequences/pour-cure`) |

Transcode recipe (ffmpeg, no npm dep): `ffmpeg -i in.mp4 -c:v libx264 -crf 26 -preset slow -an -movflags +faststart out.mp4` + `-c:v libvpx-vp9 -b:v 0 -crf 34 out.webm` + poster `-ss 00:00:01 -frames:v 1 -q:v 4 poster.jpg`.

### 4.5 Icons & vectors 🎬 (hand-authored code — zero libraries)
6 duotone SVGs (F1) · meniscus-line.svg ×3 weights · flow-contours.svg · animated Lucide trust set (hand / shield / rotate / clock / chat) · Studio empty-state line set ×3 (packages / inbox / images) · contact map duotone SVG.

### 4.6 Images — must be real 📷 + the placeholder honesty rule
Maker portrait · 4 bench documentary shots · workshop room · per-hero-product in-situ · any product currently shot on grass/cloth → reshoot on mist seamless. Slot rules §15.2 make maker/workshop mandatory-real.

**Placeholder rule (new, binding):** every Drive-catalog image lives under `public/redesign/catalog/` and is a **design/dev placeholder for products that don't exist yet**. They may render in dev, preview deployments, captioned "concept visualisation" marketing frames, and Studio seed data — never as imagery of a purchasable product. Enforcement is presentation-layer only (no DB change): S5 publish guard rejects covers whose path starts `/redesign/catalog/`; S2/S7 lint surfaces any live product still on one. Owner photography replaces placeholders product-by-product.

### 4.7 Drive file-ID appendix (scripted-download ready)
Folder IDs: heroes `16MdLIbNyM0LlGqPmS56bcTK7OWbhe4JS` · scenes `1uG6U5sBhds7XkQ75YNmNuaotkVi_QRKN` · videos `1Gd6UDWu3Q36qfGbWgaCXmRVHd9K1UVno` · index `asset-index.csv` = `1cgkeziT6VjkrIZW81YmWbjA997YT2fDH`.

**Heroes (product-hero-NNN-4x5.png = ID):** 001 `1wtFuURNJd1SrsOgDTlMIMTt2L5c32_AA` · 002 `1BEx1I54Mc8egNABcHflXwbz2B9LFq2TR` · 003 `1geZaezr1z_MB48o8CDjfOgwh4MngpT-I` · 004 `1YyfPSj3TO1mh334mUkyvxTZrH8eX8zbL` · 005 `1adOM_e6IKQXmFoe_g5QYSZCfJn8hOr9I` · 006 `1R21DJqDHsY0awS9yYl1D_SYZK0I1xRKo` · 007 `1AhKQRAmk61VAI__N2GLMaM18us0fWw5g` · 008 `16JjHsAjH8ecknhB85aLn5IzrQ8XhYZHx` · 009 `1fD9XjpgAv475ezYmOoXbUu6bJnHBbvxA` · 010 `1c6uv3QnwYCP5x6hDJWmejqucvNyGXQ87` · 011 `1HLg8RELE7RN4lPEzra0xk_eDdW17QJA9` · 012 `1JQFe4snpJ4UtqUp6dCCyn1BgRJS1Br5C` · 013 `1xPoFFnESZ3OdClov8AhHggzrBg0LG2hN` · 014 `1P6Yt1-Pco510U3lhn_DrIfVu_kG2U_6F` · 015 `1c31O6NIqQPb3l8r7RcJUjri08gozIuLz` · 016 `1KzBYasJEOaZVesVcKI9hMALfAWEs5yxf` · 017 `1JY8wjAEHNAo5PyTaZd62f1kZTh3MDYMv` · 018 `1wuk2Iwib-6KchiPZLepOwsE_JZ2Gk34X` · 019 `1_HHnbZynaLCG6uGqllD5sLyCaIxWoEER` · 020 `1nUKSOQEIv_v4vi5wAMyiCdwHwOdjcqht` · 021 `1DosNKbMWmu8sw15T5gJp8GJH56WWtcSR` · 022 `1WEJH8k709FKt-CDkbe1ZE4sxCV_oh9iq` · 023 `1Z0-8_MlYgtL_Cfuf97RrH2FfLfdCfQ5J` · 024 `1R5ftlUueLYDZnKc-d-cQDlzQdYyEBMOI` · 025 `1C_hd4HpacV9hzN9-FoKtupP3o7NSbMWQ` · 026 `1foIAhUlU4YoVcp1FkezcmZgGfgEuf701` · 027 `1bJ5tufRbBO0NQ3HyqGbEN2v5eEAoqwm3` · 028 `1Sxekl_BNtChWtGf8liG45zRqjCo_RKy2` · 029 `1-UwPuWOGff6eHrRrAp1gl8e1f5VLc3EG` · 030 `169mQa0scD9YIMLM34eCVCQJ5hokIjCXy` · 031 `1cUksWCGYzrckY6rKafUM5KSi7SA9qM9j` · 032 `1DGi3CPL_Fah-aqcAIshahSv9DWNCMIQc` · 033 `15LiffEgpWddc0ZNGBMZuLd_2jtxbzbpd` · 034 `1wBF2JgF6SGGoQzn7FBhT7YSquTa6ZO5a` · 035 `1jmzwaalv9A-BGxX-Y4d5Qs9_kT-TOTly`

**Scenes (product-scene-NNN-16x9.png = ID):** 001 `1u2LZxGMlzbhXw3NYkgMdU_MFWfe-4VQP` · 002 `1NompXwBn-ReuU27jXJAehdZKxnE-Ue6y` · 003 `1F8Nq3JeZhHq-fZ4RT0mk8kg50ACtV684` · 004 `1GCDxoW8mWn-v7-JD_g_Nuky_zBELf4i2` · 005 `1b7u4XxBD6MvIQB7P8uL6SFg4wJBEUPPB` · 006 `1bhrpvhSyC1qHgOdnQWsCotcdnnEenS0Z` · 007 `1HfbjT9-RrVqTb9j7XQHCGHQtopddAHqS` · 008 `1D1wMnVxC1h5UfP4wB-YEo7koRRLLi9KL` · 009 `12lpHEcIFSvJpLDJ5HBWxAdTXppaSzgLb` · 010 `1SCaz-baYnmVFwRczYYtEPstWKcH80VOk`

**Videos (`videos/` — 26 MP4, pick at 0.8):** Aug-12 batch (5 clips, 3.7–5.5MB — richest motion, hero-loop candidates): `17MqLYEXo8Bd0lIMKpNPuOKF6KdBIYmh2` (verified: shimmering blue resin block) · `14ERnjmrC3bXXE9MaPBFj3f1xHqJWJps7` · `1yAom4paJILhLhpLkEIbZbZxLB_EQAaLa` · `1Yx3X35gWAYwIeGMeADQMQAhV6Fg8eTtC` — plus Aug-26 (2 small clips) · Aug-28 (10 clips, 2.4–5.8MB — `16MM-1ODfVhwCWlY77ioYBjRC2fENCDpg` · `1ceD0DbGdi5BpNModsRftHRAyvqk_XLQS` · `1AAWElMHq4d5MCXmguQBGj9ThGbbgVJOg` · `1i_pbw6Y5riTHpXAGAwTMW8TQc86-rSXu` · `1GCQwCgrJavFR4DHktutU-bYylg4Xbgw0` · `1SF7chVscwV4xn--yjZfRYjrFkwAXa6FF` · `1yxt5xVg7LHneWNwZwaUAmM97BJ45iOce` · `14ZEBvf1w8eQnGaaDI4KMi120y1aAhtzu` · `1QySHQBTidIBsREHHtpSwbi1_ZiWLHiqe` · `1C_kR1LyZ-CSOpUsLYqIeEy5wjFiUUubK` · `1VN-NqaDqfkTRFC6MVEQfgKgzJbGbLG6h`) · Sep-4 (9 short clips 0.6–1.4MB — maker-loop candidates): `19ws6XN-YraX7YEtgO7NaGoaHng7onDU6` · `13SKDWEF2o6JqSjnTYTZOp8LW2eyPw4-M` · `1SPNOIZ5HYec9KlhCs5J3i04Era7kugf8` · `1Vsmjj_0fT9tco3o3ATV2DQZgZibZls76` · `1I-Hsb75CRp3YOWk7R67i7aKGyy4gCjjj` · `1X1AqAw9WtnW5bO81sJAw8oFXZBH8HnXt` · `10-AMEBqXahCPt4hvhmajGvb_FZ1PIai0` · `1WJwDAqPwmLZ3UgzX9BrBqaGQTJr21Id_` · `1ydpgt_ky-MwE4RKhl3M4YDkH5XMCg6jC` · `1rXTXhhIMjjzEAM9bqlMIChxjdExjECRF` · `1v-b1fjVR-Q2Y8inNJ9jBlOv4_mWIQXos`

---

## 5. Dependencies

### 5.1 Everything the plan needs is already in `package.json` (verified on `main`)

| Plan feature | Package (version pinned in repo) |
|---|---|
| Scroll motion · pinning · SplitText (F5) | `gsap` ^3.15.0 — ScrollTrigger + **SplitText ships free since GSAP 3.13**, no Club key |
| Smooth scrolling | `lenis` ^1.3.25 |
| Route transitions | `next-view-transitions` ^0.3.5 |
| Base icon set | `lucide-react` ^1.23.0 |
| CSS animation utilities | `tw-animate-css` ^1.4.0 |
| Accordion / dialog / tabs / select / chips primitives (PDP, wizard, hub) | `@radix-ui/react-*` (9 packages already installed) |
| Forms + validation (custom order, Studio) | `react-hook-form` ^7.81 · `zod` ^4.4 · `@hookform/resolvers` ^5.4 |
| 3D viewer band (print collection) | `@google/model-viewer` ^4.3 · `three` ^0.183 |
| Reference-image client compression | `browser-image-compression` ^2.0.2 |
| Server image pipeline · LQIP blur (`blurFor`) · S7 bulk convert | `sharp` ^0.35.3 |
| i18n ×9 locales | `next-intl` ^4.13.2 |
| ⌘K palette (S13) | `cmdk` ^1.1.1 |
| Toasts | `sonner` ^2.0.7 |
| Studio dashboard charts | `recharts` ^3.10.1 |
| Bulk import / exports | `exceljs` ^4.4 · `papaparse` ^5.5 |
| Rich text (journal/pages) | `@tiptap/*` ^3.27.1 (7 packages) |
| Media storage | `@vercel/blob` ^2.5 |
| Auth (staff-only) | `next-auth` v5 beta · `bcryptjs` |
| DB | `prisma` ^7.8 · `@prisma/client` · `@prisma/adapter-pg` · `pg` |
| Styling core | `tailwindcss` v4 · `@tailwindcss/postcss` · `clsx` · `tailwind-merge` · `class-variance-authority` |
| Tests / budgets (dev) | `vitest` · `happy-dom` · `playwright-core` · `@axe-core/playwright` · `lighthouse` · `chrome-launcher` · `tsx` |
| Cursor, magnetic buttons, progress bars, preloader, marquee, skeleton shimmer (§6) | `gsap` + `lenis` + CSS — all installed; no new dep |
| Lightbox, before/after slider, cursor-follow previews, kanban empty states | **Custom components on the above** — deliberately no new library |

### 5.2 New packages — exactly one proposed addition
| Package | Why | Cost |
|---|---|---|
| `@dnd-kit/core` + `@dnd-kit/sortable` | S3 commissions kanban drag-and-drop — the only UI in the plan whose interaction (sortable drag across columns with keyboard + touch a11y) is unsafe to hand-roll | ~40KB min+gz total; Studio-only route → lazy-loaded, storefront bundle untouched |

*If we want zero additions: native HTML5 drag-and-drop with a pointer fallback — acceptable but weaker mobile/a11y; call it at S3 build time.*

### 5.3 System tooling (not npm)
`ffmpeg` — video transcode/poster extraction (§4.4) · Drive download at 0.6 via browser UI, Drive MCP, or `rclone` · nothing else.

### 5.4 Asset pipeline (new repo script, uses installed `sharp` + `tsx`)
`scripts/optimize-redesign-assets.mjs`: (1) read `assets-inbox/` (the Drive download drop); (2) resize to slot maxima — hero 2048w / scene 1920w / card 1200w / thumb 640w; (3) AI-upscale flag (`--upscale`) for anything destined full-bleed that misses the 2048×2560 / 2560×1440 minimums (Drive images do — run them through an upscaler first if used beyond card size; card/rail/PDP-stage use is fine as-is); (4) encode WebP q82 (+ keep master PNG out of repo); (5) emit `blurDataURL` map JSON consumed by `site-images.ts`; (6) write to `public/redesign/catalog/{heroes,scenes}/`. Commit output, not sources.

### 5.5 Explicitly excluded (business rules — do not add)
No payment/checkout/cart libraries (Stripe, Razorpay, Shopify SDKs) · no customer-account/auth libraries beyond staff `next-auth` · no third-party product-data feeds — catalog stays owner-fed only.

---

## 6. Interaction layer — reference component designs (build once, use everywhere)

Every micro-interaction on the site comes from this table — same eases, same durations, same guards. Eases are the named curves in `src/lib/gsap.ts`: `luxury` (out-expo-ish, entrances) and `settle` (gentle out, hovers). **Global rules:** nothing animates above 60fps budget · every animation has a `prefers-reduced-motion` resting frame (listed) · pointer effects disable on `pointer: coarse` · durations ≤ 600ms except the preloader · no animation blocks input (INP < 200ms).

| # | Component | File | Behavior & animation spec | Package | Resting / reduced-motion |
|---|---|---|---|---|---|
| 6.1 | **Custom cursor** | `src/components/ui/cursor.tsx` (client, storefront only) | 8px champagne dot + 36px trailing ring (`gsap.quickTo`, ring lerp 0.15). States: `default` · `link` (ring → 56px + mono label "View") · `drag` on rails (label "Drag") · `media` (label "Open") · text inputs keep native I-beam. `mix-blend-mode: difference` so it survives dark/light bands | gsap | Hidden entirely: native cursor; `pointer: coarse` → never mounted |
| 6.2 | **Magnetic button** | `src/components/ui/magnetic.tsx` wrapper | Child translates toward cursor ±6px, spring back 400ms `settle`; click = scale 0.96 (120ms) + champagne fill sweep scaleX 0→1 from left (300ms); focus-visible ring 1.5px champagne, offset 3px | gsap | No magnetism; sweep + focus ring kept |
| 6.3 | **Scroll progress hairline** | `src/components/ui/scroll-progress.tsx` | 2px champagne line pinned to viewport top, `scaleX` = page progress via ScrollTrigger scrub (transform only — no layout) | gsap ScrollTrigger | Static 0-width (hidden) |
| 6.4 | **Route loading bar** | `src/components/ui/route-progress.tsx` | Top bar on navigation start: trickles to 70% (800ms), completes 100% + fades 200ms on commit; hooks `next-view-transitions` events; never on same-page anchors | next-view-transitions | Thin static bar that simply appears/disappears |
| 6.5 | **Preloader** (first visit per session only, `sessionStorage` flag) | `src/components/ui/preloader.tsx` | Obsidian veil · cure-line fills 0→100% with mono counter (JetBrains Mono, tabular-nums) · curtain lifts 700ms `luxury` revealing hero already mid-entrance. Max 1.8s, skips if page ready earlier | gsap | Skipped entirely |
| 6.6 | **Text selection** | `globals.css` `::selection` | Champagne background, obsidian text; on dark bands inverse (sand bg). One rule each, no JS | CSS | Same (selection style is harmless) |
| 6.7 | **Dropdown / menu** | radix `dropdown-menu` + `src/components/ui/menu.tsx` skin | Panel: fade + y −4→0, 180ms `settle`; item hover = 45% veil slide left→right; typeahead + arrow keys (radix); scrim click closes | @radix-ui/react-dropdown-menu | Instant open/close |
| 6.8 | **Inputs / floating label** | `src/components/ui/field.tsx` | Label floats up 160ms on focus/fill · focus = champagne hairline grows from left (scaleX) · error = one 300ms shakeX + vermilion mono message · success = champagne check draw | CSS + tailwind | Instant states, no shake |
| 6.9 | **Accordion** | radix accordion + skin | Height auto-animate 300ms `settle`; chevron rotates 45°→225°; only one open per group on PDP | @radix-ui/react-accordion | Instant expand |
| 6.10 | **Tabs pill** | radix tabs + skin | Active pill slides via layout animation 250ms `settle`; content crossfades 200ms | @radix-ui/react-tabs | Instant switch |
| 6.11 | **Card hover** | `catalog-product-card.tsx` skin | Image scale 1.04 (600ms `settle`) + hoverImage crossfade 300ms; title meniscus underline draws; doorway expansion ✅ already shipped (pure CSS flex) | CSS | No scale; crossfade instant |
| 6.12 | **Toast** | `sonner` restyle | Obsidian glass panel, champagne icon, slide-up 250ms + fade; mono 12px text; max 3 stacked | sonner | Fade only |
| 6.13 | **Dialog / lightbox** | radix dialog + skin | Veil fade 200ms · panel rise 16px + fade 300ms `luxury` · Esc/scrim close · focus trap (radix) | @radix-ui/react-dialog | Instant |
| 6.14 | **Marquee whisper** | `src/components/ui/marquee.tsx` | 24px/s linear loop, masked 64px edges, pauses on hover/focus; mono uppercase 11px, champagne separators | CSS | Static centered line |
| 6.15 | **Tooltip** | radix-style custom | 120ms hover delay, 150ms fade, mono 11px, 4px offset; never on touch | CSS | Same (text only) |
| 6.16 | **Skeleton** | `skeletons.tsx` restyle | Champagne 6% shimmer sweep 1.6s across obsidian block; matches final layout 1:1 (no CLS) | CSS | Static block |
| 6.17 | **Empty state** | `empty-state.tsx` + F1-style line art | Line illustration self-draws 600ms (`stroke-dashoffset`) + one next-action pill; used in every Studio list + search empty + 404 family | SVG code | Static illustration |

**Where each lives:** storefront = 6.1–6.5, 6.9–6.16 · Studio = 6.2 (no magnetic), 6.6–6.10, 6.12, 6.13, 6.16, 6.17 · both share 6.6/6.8/6.12. The Studio never gets the cursor, preloader, marquee, or scroll hairline — it is a tool.

---

## 7. Engineering notes (repo-specific)

- **Stack is already correct:** GSAP + ScrollTrigger (`@/lib/gsap`), Lenis (`SmoothScrollProvider` guards), view-transitions, MeniscusImage, SnapRail — new work plugs into these, never around them.
- **Guards pattern to copy:** `featured-rail.tsx` (PR #96) — SSR-safe default, dynamic import, reduced-motion + coarse-pointer gates.
- **Motion budget ratchet:** `scripts/motion-budget.mjs` weighs GSAP chunks — SplitText re-add (F5) must stay under the 49KB gate.
- **Copy:** all new strings → `messages/*.json` ×9 → `npm run copy:registry` → `copy:check` green in CI.
- **Tests:** `vitest` for logic; `test:e2e` smoke; Playwright + axe-core for a11y passes on changed pages; Lighthouse CI budgets above.
- **No DB/schema changes anywhere in this plan.** Studio-facing data needs (kanban status, marked-deleted) reuse existing fields; the placeholder lint (§4.6) is path-based, computed at render/lint time.
- **Binary hygiene:** images enter the repo only through the §5.4 pipeline (optimized WebP) or the manual `public/redesign/` upload — never as raw Drive PNGs (~2.2MB each would bloat the repo to ~100MB; pipeline output ≈ 12–18MB total).

## 8. Roadmap

| Phase | Window | Contents |
|---|---|---|
| **P0** | Week 1 | Phase 0 (~~merge PR~~ done · 14 images · content sweep · redirects · locale · **Drive ingestion 0.6–0.8**) · F6 CTA restyle · Studio S5 publish guard (+placeholder lint) |
| **P1** | Weeks 2–4 | Home remainder (testimonials band, journal list, final CTA, demote bands) · PDP · Custom Order wizard · Shop tabs + chips · Studio S2 action queue + S3 kanban (+@dnd-kit decision) · F1/F2/F5 foundation |
| **P2** | Weeks 5–8 | Large format (Drive concept frames) · About · Portfolio · Journal · Contact/404 · Shop tier cards · Studio S7 media + S9 content hub + shell IA |
| **P3** | Weeks 9–10 | Preloader · SplitText everywhere · cursor system · marquee whisper · **video loops from Drive picks** · award submission assets (case-study video) |

**Definition of done (every phase):** budgets green · reduced-motion resting states verified by hand · 9 locales render · `copy:check` + `tsc` + `eslint` + e2e smoke green · owner walkthrough on the Vercel preview before merge.

---

## 9. Claude Code craft prompt (copy-paste block)

Paste this block into Claude Code at session start — or save it as `CLAUDE.md` in the repo root so it loads automatically every session. It points Claude at the three design docs, the Drive library, and every hard rule. Also saved standalone at `design/claude-code-prompt.md`.

```
# Rivya Living Art — Build Rules (Liquid Luxury redesign)

You are building the Awwwards-level redesign of rivyalivingart.com:
Next.js 16 App Router · TypeScript · Tailwind v4 · shadcn-style components ·
Prisma 7 + Neon · Auth.js v5 (staff only) · next-intl (9 locales, incl. RTL).

READ FIRST (in this repo):
1. design/implementation-plan.md  — master plan: pages, components, assets, deps
2. design/awwwards-redesign-spec.md — art direction + 12-motion system
3. design/ui-ux-audit-report.md — what is broken and why
4. REDESIGN.md + src/lib/site-images.ts — slot system and repo conventions

HARD RULES — never violate:
- NO database/schema changes. NO payment/cart/checkout. NO customer accounts
  (only staff login at /studio). Every order finalizes on WhatsApp.
- All UI copy goes through messages/en.json (+ 8 locale files), then run
  `npm run copy:registry`. Never hardcode strings. `npm run copy:check` must pass.
- Motion only via `@/lib/gsap` (named eases "luxury"/"settle"). Every animation
  needs a prefers-reduced-motion resting frame and pointer:coarse guards —
  copy the pattern in src/components/storefront/featured-rail.tsx.
  GSAP bundle must stay under the 49KB gate (scripts/motion-budget.mjs).
- Images use the site-image slot system (src/lib/site-images.ts). Never hotlink.

IMAGES — Google Drive library:
All brand/product imagery lives in:
https://drive.google.com/drive/folders/1P2HCTmPge6HsEwtoo-xGEzPTSn68oZOW
The file-ID map of all 45 images + 26 videos is in implementation-plan.md §4.7.
If a Google Drive MCP tool is available, fetch by file ID. If not, STOP and ask
me to download the folder into `assets-inbox/`, then run
`scripts/optimize-redesign-assets.mjs` (plan §5.4) before using any image.
Anything under `public/redesign/catalog/` is a PLACEHOLDER for a product that
does not exist — allowed in dev/preview and captioned "concept" frames only,
never publishable on a real product (plan §4.6). The maker portrait and workshop
photos are NEVER AI-generated (slot rule §15.2).

DEPENDENCIES:
Everything needed is already in package.json (plan §5.1). The only approved new
package is @dnd-kit/core + @dnd-kit/sortable for the Studio kanban. Ask me
before adding anything else.

BUILD ORDER: follow the roadmap (plan §8). Current phase: P0 → P1.
Component specs for cursor, progress bars, preloader, dropdowns, buttons,
inputs, dialogs etc.: plan §6 — use those exact eases/durations, don't invent.

VERIFY BEFORE FINISHING ANY TASK:
npm run typecheck && npm run lint && npm run copy:check && npm run test:e2e
Budgets: LCP < 2.5s · CLS < 0.1 · INP < 200ms · hero media ≤ 6MB.

DESIGN LANGUAGE: obsidian + champagne, Instrument Serif / Inter / JetBrains Mono,
meniscus hairlines, one italic accent word per headline max, max 3 dark bands per
page and never adjacent. Reference level: Aesop · Cartier · Henge · Lusion.
```

**Usage:** save as `CLAUDE.md` in the repo root → Claude Code reads it every session automatically; or paste it as the first message of each Claude Code session. Keep it next to the three docs in `design/` — together they are the complete brief.
