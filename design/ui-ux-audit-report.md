# Rivya Living Art — UI/UX Audit & Improvement Report (v2, integrated)

**Scope:** rivyalivingart.com (all public pages) + /studio admin panel + repo architecture
**Method:** Live page-by-page visual audit (desktop), full codebase structure review, ADMIN_GUIDE / REDESIGN / README / three-tier plan analysis — integrated with the owner's second audit document, every claim of which was re-verified against the live site on 2026-09-17.
**Date:** September 2026

---

## 0. Executive Summary

The site has a genuinely strong foundation: a distinctive "Liquid Luxury" art direction (obsidian + champagne, Instrument Serif display type, editorial section rhythm), a coherent WhatsApp-order flow with live message preview, and an unusually capable admin panel. **The design system is ahead of the catalog.** Two problems dominate everything else:

1. **Information architecture:** the site is running *three businesses on one surface* — collectible furniture, memory/wedding preservation, and small personal gifts — but the navigation, shop tabs, product cards and CTAs treat them as one grid. Your own architecture doc (`docs/plan/07-three-tier-architecture.md`) already prescribes the fix; the live site hasn't caught up.
2. **Content integrity:** at least three published products are unrewritten competitor scrapes (one describes a *brass metal bangle* on a *resin* store), photography swings between AI renders, amateur phone shots, and watermarked third-party images — exactly the trust leak a WhatsApp-only, no-payment store cannot afford.

**Good news:** the earlier audit document's worst media complaints (blank featured-piece wells, empty PDP main stage, grey portfolio tiles, "24 of 1,000 pieces" marketplace density) are **already fixed in the current deploy** — the featured grid, PDP gallery and portfolio all render real images, and the catalog is trimmed to 10 pieces. The publish-guard recommendations below exist to make sure it never regresses.

**Top 5 moves, in order of impact:**

1. **Purge/repair scraped catalog content** (wrong descriptions, competitor watermarks, wrong categories) — brand-critical.
2. **Rebuild the IA around the three customer intents** (Collectible · Memory · Personal gifts · Commission) — nav, shop tabs, card variants, per-tier CTAs.
3. **Unify photography** into one standard and add **social proof** (testimonials, Instagram) — currently almost absent from the journey.
4. **One CTA language** — kill the teal third color, kill competing actions, kill the mobile FAB.
5. **Studio: publish guards + action-queue dashboard** — so the storefront can't rot again.

---

## 1. The Core Strategic Issue — Three Businesses on One Surface

| Intent | Examples | Buyer mindset | What the UI should do |
|---|---|---|---|
| **Collectible / spatial** | Dining tables, wall panels, installations | Slow, quote, conversation | Editorial photos, dimensions, "Request a consult" |
| **Memory / celebration** | Varmala, wedding frames, engagement trays | Guided, emotional, upload | Stepper: style → size → photo → confirm |
| **Personal gift** | Bangles ₹365–650, keychains, rakhi | Fast, price-visible | Tight grid, customize, WhatsApp |

- **What:** The live header is **Shop · Bespoke · Studio · Journal**, and shop tabs are `All / Resin art / Gifts / Supplies / 3D printing`. The repo's own three-tier architecture (in force since 2026-09-15) says the catalog is three customer intents with different price ladders, customization depth and *interface density* — "not three filters on one grid."
- **Where:** Header nav, `/shop` tabs, product card component, PDP CTA logic, homepage section order.
- **Why it matters:** A visitor lands on "Cast for the room it will live in" (architectural promise), then immediately hits a ₹365 bangle next to a ₹2,500 "Resin White". A bangle and a dining table get the same card, the same PDP, the same CTA. Each intent needs a different density, different photography, different action. Until IA is split by intent, no amount of motion or type polish will move conversion.
- **How:**
  1. Header becomes **Collectible · Memory · Gifts · Commission** (Journal/About move to footer or a "More" menu).
  2. Home gets a **"three doorways" band** — three full-bleed photos, one per intent — right after the manifesto.
  3. Shop tabs = the three intents (+ "Print" as a sub-link under Gifts or footer).
  4. Card variants per tier (see §3.3), PDP CTA per tier (see §3.4), inquiry routing per tier (see §4).

---

## 2. Global / Site-Wide Findings

### 2.1 Content integrity: scraped products published without rewrite
- **What:** Live, published products that are unrewritten competitor scrapes:
  - **"Wide Boulder Bangle"** — "About this piece" describes a *brass / silver-plated brass* bangle with imperial units (6.10oz, 2.6in) — a metal jewelry brand's copy, verbatim, categorized "Resin Jewelry & Keychains". Zero customization fields despite a ₹365–650 price *range*.
  - **"Baby KeepSakes Detailing Frame -Radhika Art"** — competitor's brand name in the title.
  - **"Wedding Invitation Card In Resin"** — "Radhika art" watermark on the published image; miscategorized as "Resin Furniture & Surfaces".
- **Where:** `/product/wide-boulder-bangle`, shop grid; the repo's `needsRewrite` publish-block exists but these slipped past it (or arrived via another import path).
- **How:** (a) Immediately audit all published products against the rewrite flag + source registry; unpublish or rewrite. (b) Studio publish guard v2 (see §5.3): block publish when description contains imperial-only specs, external image URLs, or known source-brand tokens. (c) Dashboard card: "Published products with unresolved rewrite flags."

### 2.2 Three conflicting photography languages
- **What:** AI-generated concept imagery ("Made at scale", "Why Rivya", collections cards, workshop photo) vs. real-but-amateur phone photos (varmala frame on grass, seaside candle) vs. scraped competitor photos (one watermarked).
- **Where:** Home §04/06/08/12, shop grid, PDP galleries, About "maker" image, large-format hero.
- **How:** One photo standard (backdrop, light, 4:5 ratio, grade). Replace AI section imagery with real bench/pour/process photos — for a handmade brand, real process beats perfect renders. Strip every third-party watermark pre-publish (lint in §5.6).

### 2.3 Social proof is structurally missing
- **What:** Studio supports rich testimonials (photo, video, permission workflow, featured band) — yet the live journey shows **no homepage testimonials, no PDP reviews, no Instagram/social icons in the footer** (Site Settings has a socials field, apparently unwired).
- **Where:** Home (slot between "Recent commissions" and "Bespoke"), PDP below specs, footer.
- **How:** Publish 4–6 real testimonials (piece-in-home photo + name + city) into the featured quote band; product-linked testimonials on PDP; wire Instagram into the footer icon row. For high-consideration WhatsApp orders, peer proof *is* the funnel.

### 2.4 CTA language: too many actions, three brand colors
- **What (actions):** Announcement bar + header "Start on WhatsApp" + hero dual CTAs + floating WhatsApp bubble + mobile bottom bar + **four** actions per product card (image link, View piece, Quick view, Ask on WhatsApp).
- **What (color):** Primary button color shifts by page — cream fill on home, solid black in the shop header, black "Customize" + **teal** WhatsApp on PDP, teal primary on `/large-resin-art` (verified), teal on 404. Teal reads like a different product.
- **How:**
  - **One primary, one secondary, one color system.** Primary conversion (WhatsApp / commission) = champagne on dark surfaces, ink on light. Secondary (browse / customize) = outline, always. Retire teal as a CTA color everywhere.
  - **One action per context:** product card = whole-card link + hover quick view only (drop per-card "Ask on WhatsApp" — order context belongs on the PDP). PDP = one sticky primary per tier (see §3.4).
  - **Mobile:** the bottom bar (Home / Shop / Search / WhatsApp / Menu) is the right pattern for India + WhatsApp — **kill the floating FAB on mobile** (your own spec already says bottom bar wins); keep it desktop-only, and suppress it where a WhatsApp CTA is already in view.
  - Quick view fights the bottom bar on mobile — desktop-only or drop it.

### 2.5 Chrome & length
- **What:** Stacked chrome on every page (announcement bar, 7-element header, FAB, bottom bar, cure-line ticks); home is ~16,000px with three overlapping process/value sections; the "no payment on this website" line appears ~5 times per journey.
- **How:** Dismissible, shorter announcement bar ("Made to order · finalized on WhatsApp"). Cap home at ~9 sections (see §3.2). Say the no-payment line **once per page, at the decision point**. Cure rail: 4–5 notches, normalized label case, verified anchor offsets (rail "10" currently aligns to the 3D-printing section).

### 2.6 Locale auto-redirect
- **What:** First visit hard-redirects on `Accept-Language` (my audit browser was served the full Chinese `/zh` site with no consent step). Language switcher lives only in the footer.
- **Where:** `src/proxy.ts`.
- **How:** Default English on first visit + cookie memory; compact globe switcher in the header; if keeping detection, use a dismissible banner instead of a hard redirect.

### 2.7 Broken & colliding routes (verified 2026-09-17)
- **`/journal` → 404.** The real page is `/blog`; nav points there, but anyone typing/sharing `/journal` hits the dead end. **Add a permanent redirect.**
- **`/collection` → 404.** Old furniture IA, possibly still indexed or linked externally — redirect to `/shop`.
- **"Studio" does two jobs.** Public nav "Studio" → `/about`; admin lives at `/studio`. Same word, two meanings — and the 404 page's "Back to the studio" sounds like admin. Rename the public nav item to **About** or **The studio**; keep `/studio` for staff only.
- Copy repetition cleanup: Contact's WhatsApp card says "The fastest way to reach…" twice; custom-order "How it works" has step 03 "Poured, cured & shipped" and step 04 "Curing" — merge into Idea → Quote → Make → Deliver.

---

## 3. Page-by-Page — Storefront

### 3.1 Header / Navigation
- Expose category entry in the main nav (mega-menu on the intent items) — today category pages are reachable only via footer/shop carousel, hiding your best SEO landing pages.
- Rename "Studio" → "The studio" (see 2.7). Add header language switcher (see 2.6).
- Search should surface categories and journal posts, not just products, while the catalog is thin.

### 3.2 Home (`/`)
**What's good:** Award-tier hero; distinctive section rail; journal teaser is clean.

| # | What | Where | How |
|---|------|-------|-----|
| 1 | Featured-pieces staggered grid leaves a huge dead column mid-scroll | §03 | Balanced 2-col masonry or uniform 4:5 grid; stagger offset ≤ 25% card height |
| 2 | No "three worlds" band despite it being the official architecture; hero promises large-format, first products are small gifts | After manifesto | Insert **three doorways** (Collectible / Memory / Gifts), full-bleed real photos, ≤ 4 real pieces per doorway beneath |
| 3 | Card meta mismatch: "Resin White" labeled Furniture, photo is a ring platter; "Resin White" is not a product name | Featured cards | Fix categories; naming pattern = **material + form + use** ("Live-edge river dining table") |
| 4 | Duplicate product name in card DOM (screen-reader noise) | Card component | One accessible name, `aria-hidden` the visual duplicate |
| 5 | Wishlist heart — no customer accounts, saves nowhere meaningful | Cards | Remove, or persist locally styled as "save", never resembling add-to-cart |
| 6 | "Made at scale" gallery: 4 unlabeled images, no titles/prices/links | §04 | Caption each (piece + "from ₹X"), link to category/PDP — or fold into the Collectible doorway |
| 7 | "Recent commissions": labels illegible over bright images; no meta | §08 | Scrim chips; add one meta line ("Varmala · 16×20in · 3 weeks") |
| 8 | Bespoke band: background near-black void; fragment list immediately repeated by paragraph | §09 | +20% exposure or localized gradient; keep one of the two copy blocks |
| 9 | Duplicate storytelling: "From liquid to light" + "How it works" + "Why Rivya" + Process page all tell pour→cure→polish | §05/12 | One process strip on home; long version lives on `/process` only |
| 10 | Workshops + 3D printing sections inflate the scroll; workshops should only be promoted if sessions are actually bookable | §10/11 | Move both off home; link from footer/About |
| 11 | No testimonials band | After §08 | Add featured quote band (see 2.3) |

**Target home structure (9 sections):** hero → manifesto → three doorways → 4–6 featured (real photos only) → one process strip → testimonials → one commission CTA → journal teaser → footer CTA.

### 3.3 Shop (`/shop`)
**What's good:** lead-time announcement bar; the collection strip is the best merchandising moment on the site.

| # | What | Where | How |
|---|------|-------|-----|
| 1 | Tabs don't match customer intents; "Supplies" and "3D printing" beside varmala flatten the brand | Tab bar | Tabs = **Collectible · Memory · Gifts** (+Print as secondary link) |
| 2 | One card design for a ₹365 bangle and a dining table | Grid | **Tier card variants:** Gift = square crop, price, "Made to order", one WhatsApp action · Memory = portrait, occasion, lead time, "Preserve this" · Collectible = landscape, materials + size, "Price on request" |
| 3 | "Showing 10 of 10 pieces" under enterprise filters reads empty; every filter risks a dead end | Toolbar | Until catalog grows: hide empty tabs dynamically, drop the counter, interleave collection cards into the grid; reframe thinness as curation ("made to order in your size"). Never show marketplace-density numbers — a studio should feel edited |
| 4 | Double active-tab signal ("All" bold + "Resin art" underlined) | Tabs | One signal: underline + semibold on active only |
| 5 | Collection carousel: labels clipped at card edge, eyebrow invisible on light images, no peek/scroll affordance | Carousel | Bottom gradient scrim, padded titles, peek of next card + scroll hint |
| 6 | No active-filter chips | Toolbar | Removable chips: `Varmala ×  Price ₹500–2,000 ×  Clear all` |
| 7 | Default sort can dump scraper residue first | Grid | Curate the default order; keep unpolished imports as drafts |
| 8 | Card ratios inconsistent → ragged rows | Grid | Enforce 4:5 `object-cover`; auto-crop on upload |

### 3.4 Product Detail Page (`/product/...`)
**What's good:** gallery+info split; sticky order summary with **live WhatsApp message preview** — genuinely excellent, keep and promote.

| # | What | Where | How |
|---|------|-------|-----|
| 1 | Price range with no selectable options — nothing explains what moves ₹365→₹650 | Info column | Every ranged product needs ≥1 structured option; show "from ₹365", reveal range on selection |
| 2 | Two equal CTAs (Customize vs Ask on WhatsApp) create hesitation; generic "colour, size and engraving…" copy | CTA stack | **One sticky primary per tier:** Gift → *Customize → WhatsApp* · Memory → *Start preservation* · Collectible → *Request a quote*. Per-product copy, not boilerplate |
| 3 | Description is unstructured prose with specs jammed inline (and on the bangle, it's a competitor's *metal* copy) | About region | Story paragraph + proper **Specifications table** (extend the existing Category/Collection table: materials, dimensions, weight, lead time, care) |
| 4 | Trust rows = four lines of ALL-CAPS mono | Info column | Icon + short-label chips (handmade / insured shipping / WhatsApp confirmation / unique pour) |
| 5 | Gallery: near-identical angles, no zoom, no scale/in-situ shot (bangle on wrist, tray on table, table in a dining room) | Gallery | Required shot list per product: hero + macro detail + in-situ scale + process; hover-zoom desktop, swipe+dots mobile, lightbox |
| 6 | No reviews, no related-pieces rail | Below fold | Product-linked testimonials + "Pieces like this" (same intent, not just same category) |
| 7 | Empty accordions/sections render on sparse products | PDP | Hide any region with no content — empty frames look broken, not minimal |
| 8 | Honeypot "Website" field — verify it's hidden from AT, not just visually | Order form | `aria-hidden` + off-screen |
| 9 | If a product has no custom fields, don't render "customize" framing | Custom form region | Collapse to a compact order panel |

### 3.5 Custom Order (`/custom-order`)
**What's good:** strongest conversion page — dark hero, clear promise, budget/occasion/timeline selects, live summary sidebar.

- **Fake stepper:** the "01 / 04" rail is anchor links, not a wizard — users hunt for "Next". **How:** make it a true 4-step progress with per-step validation and a final **Review & send** screen (spec already calls for this).
- **After submit:** success state with order number + "Your message is saved even if WhatsApp doesn't open" (the inquiry *is* saved — say so; it's a trust feature).
- Merge the duplicate curing steps (2.7). Replace native-styled selects with the custom component used in Studio.

### 3.6 Large Format (`/large-resin-art`) — verified live
- Hero photo is a **desk lamp and small resin blanks on a bench** — it doesn't show a table that shapes a room. **How:** hero must be a finished piece in a real interior.
- Two CTAs ("Start a large commission" / "Open the commission form") do the same job — keep one (the form), styled per the single-CTA rule (2.4); the teal primary here is the worst color offender.
- Show 3 finished commissions with dimensions + room photos instead of a recycled shop grid; this page *is* the Collectible doorway's landing and should feel like it.

### 3.7 About / Process / Portfolio / Journal / Contact / 404
- **About:** H1 widows ("Where resin meets / reverence."). Body shrinks the brand to varmala/photographs, undercutting the large-format hero. **How:** open with maker + workshop + large work, then memory work; real maker portrait + 4 studio photos (pour, bench, finish, install); address + map + visiting hours here, not only Contact.
- **Portfolio:** images now render (fixed since the earlier doc). Remaining: filters are gift-shop categories (Candle Holders, Jewelry, Festive & Pooja) rather than **commission types** — use Wedding · Furniture · Objects · Wall. Card hover should reveal one sentence of the brief. Keep the "don't render a case study without a cover" rule as a publish guard.
- **Journal:** redirect `/journal` → `/blog` (2.7); featured-post cover required; cut category chips with < 3 posts.
- **Process:** keep the timeline here; delete the duplicates on Home/About.
- **Contact:** dedupe the WhatsApp card copy; put response time on the button itself ("Replies within a few hours"); split "WhatsApp now" vs "email the studio" visually.
- **404:** well written; change "Back to the studio" → "Back to the store/home" (sounds like admin).

---

## 4. Functional Flow — Target Journeys per Intent

**Today:** Visit → long story → mixed grid → PDP with generic copy → Customize *or* WhatsApp → hope the prefilled message opens.

**Gift (under ~₹5,000):** Browse collection → pick piece → 3 fields (colour / size / text) → preview WhatsApp message → Place order → wa.me + inquiry saved.

**Memory:** Choose style → size → upload photo/varmala refs → names & date → quote band → WhatsApp.

**Collectible:** See 6–12 projects → open one → dimensions + room photos → "Request consult" → Studio inquiry flagged priority — *not* the gift form.

**Cross-cutting fixes (conversion > visuals):**
1. Never lose the inquiry if WhatsApp is blocked — you already save it; **say so on the success screen**.
2. Prefill must include product URL + selected options + image links, under ~1,500 chars (already the design — keep it enforced).
3. One path per tier; remove competing buttons.
4. Quick view desktop-only or dropped.
5. Wishlist only if it persists locally and never looks like add-to-cart.

---

## 5. Studio (Admin Panel)

*Auth-protected; audited via live login screen + full component/route source + ADMIN_GUIDE. Route/component names are real and developer-actionable.*

### 5.1 Keep (genuinely strong)
Inquiry pipeline with exact WhatsApp message + copy/reopen · type-DELETE bulk confirm · last-admin & category-delete protection · testimonial permission gate · `needsRewrite` publish block · demo-content isolation · draft preview links · activity log · media "used in" tracking · catalog-fill conflict resolution · calm on-brand login.

### 5.2 Information architecture: too many doors
- **What:** 6 nav groups, ~30 items; content editing fragmented across **Site Copy · Site Images · Page Sections · Process Steps · Materials · Navigation · Commission Form · Pages · Landing Pages** (nine surfaces). "Bulk Import" and "Catalog fill" share an icon and near-identical names.
- **Where:** `src/components/studio/sidebar.tsx`.
- **How:**
  1. Merge the nine content surfaces into one **Site Content** hub with tabs (Copy · Images · Sections · Navigation · Forms); Process Steps & Materials become filtered views (they already are — `SUBLIST_PAGES`).
  2. Merge Pages + Landing Pages (a "landing" flag).
  3. Collapse Research (Scraper · Research · Content Gaps) into one weekly-tool group, hidden from the first screen.
  4. Target IA: **Today · Catalogue · Content · Editorial · Settings** (~18 items) + a pin/favorites row.
  5. Rename "Catalog fill" → "Catalog pipeline (auto)" with a distinct icon; cross-link from Bulk Import.

### 5.3 Publish guards (highest-leverage studio change)
Block publish when any is true: **no hero image · no tier assigned · `needsRewrite` unresolved · description contains imperial-only specs / external image URLs / known source-brand tokens**. Same guard for Portfolio (no cover → no publish). This one feature would have prevented every P0 content defect found in this audit.

### 5.4 Dashboard → morning action queue
"Today" opens on: **new WhatsApp orders since last login · unpublished drafts · live products missing images · inquiries stuck in New > 24h · published products with rewrite flags**. Counts alone don't run a studio; an action queue does.

### 5.5 Products
- Default filters: `Live + missing image`, `No tier`. Bulk actions: set tier, unpublish, replace cover, **duplicate product**.
- Form Builder: per-tier **templates** (gift / memory / collectible) one-click applicable — the per-category templates exist since Phase 11; make them discoverable.
- Gallery uploader: enforce the shot list (hero / macro / in-situ / process) with slot hints + auto-alt suggestions.

### 5.6 Media Library
- Surface "used by" on the card itself (the data exists); add **"Set as product cover"** from the library.
- Permanent delete with no trash is dangerous → add a 7-day **marked-deleted** state before purge.
- Bulk WebP convert/compress + "large files" smart filter (Blob costs scale with 6MB heroes); image-quality lint (watermark/low-res heuristics) feeding the dashboard.

### 5.7 Orders (Commissions)
- **Kanban view** (New / Contacted / Quoted / Confirmed / Delivered) suits a WhatsApp studio better than a flat table.
- One-click **"Open WhatsApp + mark Contacted"**.
- Product thumbnail on each row so you don't open every ticket.
- Full mobile usability here first (owner works orders from a phone) — card list under `lg`.

### 5.8 Studio-wide polish
- Don't carry marketing serif display type into data tables; numbers converge on JetBrains Mono (`u-num`).
- Login right pane: replace the dead blurred column with a real studio photo or a "today" strip (new inquiries count).
- ⌘K palette exists — surface it in the topbar or nobody will find it.
- Designed empty states with next-action on every list.
- Scraper stays **research/moodboard, never storefront**: review inbox defaults to "suggested tier + has image + not marketplace"; "Add to catalog" always lands as draft + needs-rewrite + hidden.

---

## 6. Reconciliation — Earlier Document vs. Live Site (verified 2026-09-17)

| Earlier claim | Status now |
|---|---|
| Featured pieces = empty sand wells | **Fixed** — real photos render |
| PDP main stage blank, thumbnails work | **Fixed** — main image renders |
| Portfolio = grey gradient tiles | **Fixed** — 20 commissions with images |
| "Showing 24 of 1,000 pieces" | **Fixed** — "10 of 10"; catalog trimmed |
| `/journal` 404 | **Still true** — add redirect |
| `/collection` 404 | **Still true** — add redirect |
| Large-format hero = lamp & blanks, dual CTAs, teal | **Still true** |
| "Studio" naming collision (About vs admin) | **Still true** |
| CTA color inconsistency (teal third color) | **Still true** |
| Scraped/watermarked products live | **Still true** (bangle, baby frame, invitation card) |

---

## 7. What NOT to Do

- **No checkout, cart, or customer accounts** — the hard rule is correct for this model; the WhatsApp flow is a differentiator, not a gap.
- **Don't keep scraping into the live grid.** Scraper = moodboard/research; catalog = owner-made only.
- **Don't redesign the tokens again.** Liquid Luxury is enough — the gap is content + IA + media, not another palette.
- **Don't blur admin "Studio" into the customer's mental model.** About = the workshop; `/studio` = staff.
- **Don't add motion/type polish before content is real.** P3, not P0.

---

## 8. Priority Roadmap

| Priority | Work | Why |
|---|---|---|
| **P0** | Unpublish/rewrite scraped SKUs; strip watermarks; fix categories (bangle, baby frame, invitation card + full sweep) | Trust & copyright — brand-critical |
| **P0** | Redirects: `/journal`→`/blog`, `/collection`→`/shop`; locale default = English + header switcher | Dead ends & wrong-language first impressions |
| **P0** | Studio publish guards (hero image, tier, rewrite, spec-lint) | Stops the storefront rotting again |
| **P1** | Nav + shop tabs + home doorways = three intents + Commission; rename public "Studio" | Fixes the whole flow |
| **P1** | One CTA per tier; retire teal; kill mobile FAB; card = one action | Stops hesitation |
| **P1** | Testimonials band + PDP reviews + Instagram in footer | Proof for a chat-closed sale |
| **P1** | Photography pass: real maker/process/large-format hero; reshoot grass-background pieces | One visual language |
| **P2** | PDP per tier: sticky CTA, spec table, required options on ranged prices, in-situ shots, related rail | Conversion depth |
| **P2** | Custom order: true 4-step wizard + success state with order number; merge duplicate steps | Completion rate |
| **P2** | Home restructure to 9 sections; single process story; dedupe "no payment" copy | Rhythm & clarity |
| **P2** | Studio: dashboard action queue, orders kanban + one-click Contacted, media soft-delete + set-as-cover, IA consolidation | Owner operations |
| **P2** | Rename products (material + form + use); portfolio filters = commission types | Merchandising |
| **P3** | Motion polish, meniscus reveals, type-contrast tweaks | Only after content is real |

---

## 9. Quick Reference — Confirmed Defects (developer-ready)

| Severity | Location | Defect |
|---|---|---|
| 🔴 | `/product/wide-boulder-bangle` | Competitor brass-bangle copy (imperial units); zero custom fields; wrong category semantics |
| 🔴 | Shop grid | "Baby KeepSakes Detailing Frame -Radhika Art" — competitor brand in title |
| 🔴 | `/product/wedding-invitation-card-in-resin` | "Radhika art" watermark; categorized as Furniture & Surfaces |
| 🔴 | `/journal`, `/collection` | 404 — old IA dead ends (verified) |
| 🟠 | `/` proxy | Hard locale redirect (served /zh to an English audit) |
| 🟠 | Global CTAs | Teal third brand color; 4 actions per card; mobile FAB duplicates bottom bar |
| 🟠 | IA | Live nav/tabs ignore the three-tier architecture; one card/PDP/CTA for all intents |
| 🟠 | `/large-resin-art` | Hero is lamp/blanks, not a finished interior piece; duplicate CTAs |
| 🟠 | Home §03 | Staggered-grid dead space; "Resin White" category/name mismatch |
| 🟡 | Shop tabs | Double active-state signal; no filter chips; counter exposes thinness |
| 🟡 | Home §09 | Near-black background; duplicated copy block |
| 🟡 | Custom order | "01/04" rail implies wizard; steps 03/04 duplicate; no post-submit success framing |
| 🟡 | Footer | No social links; low-contrast newsletter placeholder |
| 🟡 | Studio sidebar | Bulk Import vs Catalog fill collision; 9-surface content fragmentation; no publish guards for image/tier |
| 🟡 | Nav | "Studio" = About publicly, admin internally; 404 says "Back to the studio" |

---

*Report compiled from live audit + repository source + owner's second audit document; every externally-sourced claim re-verified against the live site on 2026-09-17. Every "Where" references a real page, component, or route so fixes can go straight into the backlog.*
