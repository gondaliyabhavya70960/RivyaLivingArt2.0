# Rivya Living Art — Awwwards-Level Redesign Spec
### Visual, motion & content design only — zero database / structural changes

**Goal:** Take the existing "Liquid Luxury" foundation to award-tier execution. Every recommendation below is confined to presentation: section design, layout, typography, imagery, iconography, vectors, video and animation. Nothing touches the data model, order flow logic, or studio workflows.

---

## 0. Design North Star

**Positioning:** *A Surat resin atelier presented with the gravity of a luxury maison — dark, material, cinematic, and quiet.*

**Reference set (study these, steal the discipline, not the look):**

| Reference | What to take |
|---|---|
| **Aesop** (aesop.com) | Quiet luxury retail rhythm; restraint; product as still-life |
| **Cartier / Boucheron** | Jewelry macro photography on black; champagne-on-obsidian discipline |
| **Henge / Minotti / B&B Italia** | Collectible furniture editorial — full-bleed interiors, enormous serif, sparse UI |
| **Obys** | Kinetic typography; word-by-word scroll reveals; type as the interface |
| **Lusion / Active Theory** | Real-time material/3D experiences; shader-grade motion smoothness |
| **Simply Chocolate** (Awwwards SOTY 2017) | Product-as-hero color blocking; playful precision in product grids |
| **Bang & Olufsen** | Cinematic product video heroes; sound-of-silence pacing |

**The one-sentence test for every decision:** *Would this frame look at home next to a Cartier product film? If not, cut it.*

---

## 1. Art Direction 2.0 — Elevate, Don't Re-theme

Your tokens stay (obsidian · deep-ocean · sapphire · mineral · sand · champagne · ink · graphite · mist · hairline; Instrument Serif + Inter + JetBrains Mono). The upgrade is **execution discipline**:

### 1.1 Color discipline (stricter than today)
- **Champagne** = accent only: rules, micro-labels, icon strokes, one underline. Never a fill, max 2 instances per viewport. (Your spec says this; the live site breaks it with teal — teal is deleted entirely.)
- **Dark bands** max 3 per page, never adjacent. Light "sand" sections are the breath between them.
- **CTA system, final:** Primary conversion = champagne-outline pill on dark / ink-solid pill on light. Secondary = hairline ghost button. One hover behavior everywhere: background sweeps in from left (300ms, ease-out), text inverts.

### 1.2 Signature visual assets (what makes it *yours*)
1. **Resin gradient mesh** — a deep sapphire→obsidian flowing gradient with gold vein filaments, used as: preloader backdrop, hero fallback poster, section dividers, 404. *(Generated — see Asset 5.)*
2. **Meniscus line** — a thin curved SVG stroke (like the surface tension edge of poured resin) that draws itself beneath section headings on scroll. One motif, used everywhere = instant brand recognition.
3. **Film grain** — 4–6% opacity noise overlay on all dark sections. Cheap, instant cinema.
4. **Duotone grade** — all photography (real or generated) graded to one curve: crushed obsidian shadows, warm champagne highlights, slight desaturation. This single treatment makes AI images, phone photos and studio shots look like one shoot.

### 1.3 Typography — the Awwwards lever
- Display sizes go **bigger**: H1 `clamp(56px, 9vw, 164px)`, section titles `clamp(40px, 6vw, 96px)`. Current sizes are ~20% too timid.
- **Italic accent words** inside headlines (Instrument Serif italic) — one per headline max: *"Cast for the room it will **live** in."*
- **Kinetic moments:** display lines split by word (GSAP SplitText — already in your stack), rise + rotateX from 8°, stagger 0.05s, `power4.out`, triggered at 85% viewport.
- Mono (JetBrains) for *all* prices, counts, dates, dimensions, lead times — you have this; extend it to nav index numbers and footer micro-copy.
- Line length discipline: body copy max 62ch; hero sub max 48ch.

### 1.4 Grid & rhythm
- 12-col, but **asymmetric**: content sits on cols 2–7 or 6–12, never dead-center everywhere. Alternating alignment is what reads "editorial" vs "template."
- Section padding: `clamp(120px, 18vh, 220px)` vertical. Luxury is 60% empty space.
- Every section gets the mono eyebrow (`—— THE SIGNATURE`) — you have this; make the rule animate in (width 0→48px) on scroll.

### 1.5 Iconography & vectors
- **Icons:** Lucide at 1.5px stroke (already your stack) — but *animated*: stroke draws itself on first scroll into view (`stroke-dashoffset` 600ms). Used for trust chips, process steps, contact cards.
- **Custom duotone icons** (6, commission or hand-build as SVG): the pour (droplet over mould), gild (leaf), cure (hourglass with wave), polish (gem facet), preserve (flower in block), print (lithophane layers). These become the process/collection icons — the one place custom > Lucide.
- **Vector motifs:** meniscus line (above) + **flow contours** — 3–5 thin topographic curves at 8% opacity behind large dark sections, slow drift on scroll (parallax 2%).

### 1.6 Imagery system — 4 classes, one grade
| Class | Use | Ratio | Treatment |
|---|---|---|---|
| **Macro pour** | Hero, textures, dividers, 404 | 16:9 | Cinematic side-light, obsidian bg, gold veins |
| **In-situ interior** | Collectible doorway, large-format, PDP lifestyle | 4:5 / 3:2 | Moody interior, window light, piece in a room |
| **Bench documentary** | Maker, process, about, workshops | 3:2 | Warm lamp pools, real hands, film grain |
| **Studio product** | All product cards & PDP galleries | 4:5 | Mist/sand seamless bg, single soft shadow |

Rules: product cards **always 4:5** `object-cover`; every image gets the duotone grade via CSS `filter` + overlay so mixed sources unify; no image ships without art-directed alt text.

### 1.7 Video
- **Hero:** 8–12s macro pour loop (resin ribbon folding over itself, gold drifting), ≤6MB, muted, `playsinline`, poster = generated hero still. Slow `scale 1.0→1.06` over the loop so it never feels static.
- **Maker band:** 6s hands-polishing loop.
- **Process:** keep the 121-frame pour→cure canvas scrub from your spec — it's your most awardable asset; finish it.
- All video gated: `prefers-reduced-motion` + `save-data` → poster only.

---

## 2. Motion System (GSAP + ScrollTrigger + Lenis + next-view-transitions — all already installed)

**Global feel:** Lenis `lerp: 0.09`; nothing moves faster than 250ms or slower than 900ms; easings only `power2/4.out` and one `expo.inOut` for page morphs. Motion should feel like liquid, not UI.

| # | Signature move | Where | Spec |
|---|---|---|---|
| 1 | **Preloader "the drop"** | First visit | Resin-drop SVG forms the wordmark, grain backdrop, ≤1.2s, skips on return visits |
| 2 | **SplitText rise** | Every display headline | Word split, y:40→0, rotateX 8°→0, stagger 0.05s |
| 3 | **Meniscus draw** | Every section eyebrow | SVG stroke-dash draw 600ms |
| 4 | **Parallax wells** | All editorial images | `overflow:hidden` wrapper, image yPercent −8→8 scrub |
| 5 | **Magnetic CTAs** | Primary pills, nav | Cursor attraction within 80px, spring back 0.4s |
| 6 | **Pinned pour scrub** | Home process strip | 121-frame canvas, 4 text stops fade through |
| 7 | **Card → PDP morph** | Shop → product | Shared-element transition (next-view-transitions), 500ms expo.inOut |
| 8 | **Cursor image preview** | Journal list, portfolio | Thumbnail follows cursor with 0.15s lag, tilts ±4° |
| 9 | **Counter ticks** | Stats (lead time, grit, commissions) | Mono numbers count up on enter |
| 10 | **Custom cursor** | Desktop | 12px dot + 40px ring, expands over links, hides on touch |
| 11 | **Staggered grid entry** | Shop, portfolio | Cards fade-up 24px, stagger 0.06s, FLIP re-flow on filter |
| 12 | **Marquee whisper** | Announcement bar | Slow infinite scroll, pauses on hover |

Gates: `prefers-reduced-motion` disables 2/4/5/6/8/10 globally; `save-data` kills video; INP budget < 200ms.

---

## 3. Page-by-Page Redesign

### 3.1 HOME — from 13 sections to 9 award frames

**S0 · Preloader** *(new)*
Grain + resin-mesh backdrop; the wordmark condenses out of a falling drop. Sets the cinema before anything loads.

**S1 · Hero — "The Pour"**
- *Content:* eyebrow `LARGE-FORMAT COMMISSIONS · RESIN ART · MADE TO ORDER` → H1 "Cast for the room it will *live* in." → one-line sub → 2 CTAs.
- *Design:* full-viewport pour video (Asset 1 as poster/fallback), grain, 64px inset frame hairline.
- *Motion:* SplitText rise; video slow-zoom; scroll cue (thin line + `SCROLL` mono) fades after 2s; hero pins for 20vh with content parallaxing up over the video.

**S2 · Manifesto — "Objects made slowly."**
- *Design:* sand section, statement at 96px, **word-by-word opacity scrub** (each word 15%→100% as it crosses center — the Obys move). One image: macro gold-vein detail, parallax well, right-aligned cols 8–12.

**S3 · Three doorways — "Choose your world"** *(replaces "collections" cards)*
- *Content:* **Collectible / Memory & Celebration / Personal Art & Gifting** + one poetic line each.
- *Design:* three full-height portrait panels (Assets 2–4), side by side desktop, stacked swipe cards mobile. Hover: panel expands to 42% width (siblings compress), image scales 1.04, champagne arrow slides in, others dim to 60%.
- *Motion:* staggered rise on entry; FLIP width transition 500ms expo.

**S4 · Featured pieces — horizontal gallery**
- *Design:* pinned horizontal scroll (desktop): 4:5 cards on sand, huge mono index numbers behind (`01 02 03`), drag affordance with custom cursor "DRAG". Only pieces with real studio-grade photos. Card = image + name + mono price. Nothing else.
- *Mobile:* native swipe snap, no pin.

**S5 · Process strip — "From liquid to light"** *(the award asset)*
- *Design:* obsidian band; pinned 121-frame pour→cure canvas scrub fills 70vh; four text stops fade through at 25% intervals (The pour / The gild / The cure / The polish), mono numbers, meniscus line under each.
- *Motion:* canvas scrub tied to scroll; text crossfade 300ms; reduced-motion → static 4-up grid with the generated texture.

**S6 · Testimonials — "Kept, gifted, passed on"** *(new section)*
- *Design:* single oversized quote (serif italic, 64px) centered on mist, small piece-in-home photo + name + city beneath; auto-rotates every 6s with vertical mask transition; 3 tiny mono dots as progress.

**S7 · The maker — "One pair of hands."**
- *Design:* split 5/7: left = 6s hands-polishing video loop (Asset 6 as poster), right = statement + 3 mono stats (`24–72h per layer` · `400→3000 grit` · `20 commissions`) with counter ticks. CTA "Meet the maker" ghost.

**S8 · Journal — "Notes from the studio"**
- *Design:* editorial **list**, not cards: each row = date (mono) · category · title (40px serif). Hover → cover thumbnail follows cursor (move #8). One featured row with inline image.

**S9 · Final CTA — "Have something in mind?"**
- *Design:* obsidian, resin-mesh at 30% behind, 120px serif "Let's make it *real*.", one magnetic champagne pill "Start a commission", WhatsApp ghost beside it. Grain. Silence. Done.

**Cut from home:** "Made at scale" gallery (→ large-format page), "Why Rivya" 4-up (→ About), Workshops + 3D printing bands (→ footer/About), "How it works" (→ its own page), duplicate bespoke band. Home is a film trailer, not the catalogue.

---

### 3.2 SHOP — "The Collection"

- **Page head:** oversized "The Collection" (128px) with SplitText rise; sub-line; segmented intent tabs with a **sliding pill indicator** (layout-animated).
- **Collection strip:** keep — it's your best merchandising. Add: 45% bottom gradient scrim on every card, titles padded inside (never clipped), peek of next card + `DRAG` cursor, snap scrolling.
- **Product cards:** 4:5, studio-bg, **hover = second image crossfade** (you store a hover image — use it) + 1.03 scale + champagne hairline frame draws in. Name (18px) + mono price + `MADE TO ORDER` micro. One click target: the whole card. Quick view = eye icon top-right, opens a **slide-over panel** (desktop only) with mini gallery + CTA.
- **Filtering:** active filters become removable chips under the toolbar (`Varmala × · ₹500–2,000 × · Clear all`); grid re-flows with FLIP animation; result count in mono.
- **Empty/thin state:** instead of "10 of 10", end the grid with an editorial card: *"Can't find it? It doesn't exist yet — commission it."* → custom order. Turns thinness into the brand promise.
- **Motion:** staggered entry, filter FLIP, tab indicator slide. Nothing else — shop is utility wearing a tuxedo.

### 3.3 PRODUCT PAGE — the jewelry-box treatment

- **Gallery (left, sticky):** main stage 4:5 with **hover zoom lens** (desktop) / swipe + dots (mobile); thumb rail with champagne active frame; lightbox on click; second view = in-situ shot; third = macro detail. Badge row: `MADE TO ORDER` chip only.
- **Buy panel (right, sticky):** mono price large; option pills (size/colour) with selected = ink fill; accordion specs (Materials / Dimensions / Lead time / Care) with animated chevron + hairline separators; trust chips as **icon row** (4 custom animated icons, one line each); one sticky primary CTA + WhatsApp ghost.
- **Mobile:** gallery top, buy panel flows, **sticky bottom CTA bar** (price + "Customize & order") — the single biggest mobile conversion win.
- **Story band below fold:** full-width macro image + 60ch story text; then specs table (mono); then **"Pieces like this"** horizontal rail (same card design as shop).
- **Motion:** card→PDP shared-element morph on entry; content staggers up 100ms after morph completes — the continuity is the wow.

### 3.4 CUSTOM ORDER — the ceremony

- Keep the dark split hero (it's excellent). 
- **The brief becomes a 4-step ceremony:** full-screen steps (01 Idea → 02 Details → 03 References → 04 You), top progress = **meniscus line filling** 0→100%, step transitions slide+fade 400ms, per-step validation with gentle shake.
- Selects become **visual pickers**: material = 5 swatch cards with macro thumbnails; occasion = icon chips; budget = pill radio.
- Review screen: order summary styled like the WhatsApp message itself (mono, hairline frame) — "This is exactly what we'll receive."
- **Success frame:** animated check draw, order number in mono, "Saved. Even if WhatsApp doesn't open, we have your brief." + button "Open WhatsApp".

### 3.5 LARGE FORMAT — the Collectible landing
- Hero: finished river table **in a real interior** (Asset 2 direction) full-bleed; 140px serif "Made to your *room*."; single CTA.
- Below: 3 case frames — each = one interior photo (parallax well) + dimensions/materials/lead-time in mono + one sentence of the brief. No shop grid, no duplicates.
- End: "How a large commission runs" — 4 mono steps on hairline, then the single CTA band.

### 3.6 ABOUT — the atelier
- Hero keeps the obsidian macro bg but H1 sets at 120px with italic accent.
- New sequence: **Maker portrait** (bench documentary class) → story (60ch) → **4-photo documentary strip** (pour / bench / finish / install) with parallax → values as 4 animated custom icons → address/hours/map card (mist panel, mono data).

### 3.7 PORTFOLIO — the archive
- Filters become commission-type chips with mono counts.
- Cards: 4:5 image + title + one-line brief revealed on hover (mask rise), `PROJECT 020` mono index on scrim chip (always legible).
- Case pages: hero image 70vh → brief/story 2-col → before/after draggable slider (you have it — make the handle a champagne meniscus line) → gallery masonry with lightbox → next-project footer link (huge serif title, hover fills).

### 3.8 JOURNAL
- Index = editorial list with cursor-preview thumbnails (as Home S8 but full); featured post = 70vh cover + oversized title.
- Article: 62ch column, pull-quotes in serif italic 40px, progress hairline top of viewport, mono read-time.

### 3.9 CONTACT
- Split hero stays; cards become 2×2 with animated icons; response time moves **onto the button** ("WhatsApp — replies within hours"); map gets duotone treatment + champagne pin.

### 3.10 404 / ERROR
- Resin-mesh full-bleed, 200px "Lost in the pour.", one magnetic pill "Back to the collection", grain. It should be the best 404 your visitors have ever screenshotted.

---

## 4. Delivered Asset Suite (generated for this redesign)

| # | File | Use | Ratio |
|---|---|---|---|
| 1 | `hero-pour.jpg` | Home hero poster / video fallback, 404 bg | 16:9 |
| 2 | `doorway-collectible.jpg` | Home S3 panel 1, Large-format hero | 4:5 |
| 3 | `doorway-memory.jpg` | Home S3 panel 2, Varmala collection card | 4:5 |
| 4 | `doorway-gifts.jpg` | Home S3 panel 3, Gifts collection card | 4:5 |
| 5 | `texture-resin-flow.jpg` | Dark section backgrounds, dividers, final CTA | 16:9 |
| 6 | `maker-hands.jpg` | Home S7 poster, About maker band | 3:2 |

*All six graded in the same obsidian/champagne direction so they sit together as one shoot.*

## 5. Production List — remaining assets to create

**Video (film or generate):**
1. Hero pour loop — 8–12s, macro, sapphire + gold on black, ≤6MB
2. Hands polishing — 6s loop (maker band)
3. Workshop ambient — 10s (About), optional
4. Pour→cure frame sequence — 121 frames for the S5 scrub (finish your spec's asset)

**Custom icons (6 SVG, duotone 1.5px):** pour · gild · cure · polish · preserve · print

**Vectors:** meniscus-line.svg (3 weights) · flow-contours.svg (dark-section backdrop) · grain tile (tileable, 200px)

**Photography (real, irreplaceable):** maker portrait · 4 bench documentary shots · in-situ shot per hero product · reshoot any product currently on grass/cloth backgrounds onto mist seamless

---

## 6. Implementation Guardrails

- **Zero DB/schema changes.** Everything lives in components, styles, copy files, and media.
- Tokens untouched — this is execution discipline, not a new theme.
- Every animation has a `prefers-reduced-motion` fallback; every video a poster.
- Budgets: LCP < 2.5s · INP < 200ms · CLS < 0.1 · hero media ≤ 6MB · images WebP/AVIF.
- Ship order: Home → PDP → Shop → Custom order → Large format → rest. Home alone will carry the award submission.
