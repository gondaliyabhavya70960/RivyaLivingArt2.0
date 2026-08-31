> **Status note (2026-08-21).** §B was verified against the v7 tree —
> component paths have since moved to src/components/storefront/ and
> src/app/[locale]/(v2)/ (v2.0 rebuild). §C ledger: gaps 1–2 shipped (gallery
> light-play autoplay; pourVariance ×9); gaps 3, 4, 7, 9 open and buildable;
> gaps 5, 6, 8, 10 await owner content/decisions. /DESIGN.md governs any
> visual change proposed here.

# ResinRiva — Product-UX Benchmark (v6 layer, 2026-08-13)

Provenance: 20 luxury/product e-commerce leaders researched across five
clusters — heritage jewelry maisons (Cartier, Tiffany & Co., Van Cleef &
Arpels, Bulgari), heritage fashion maisons (Hermès, Bottega Veneta, Gucci,
Loewe), luxury multi-brand editorial commerce (Net-a-Porter, Mytheresa,
SSENSE, Farfetch), design-purist quiet luxury (Aesop, Vitsoe, Herman Miller,
Georg Jensen), and made-to-order/customization specialists (Brilliant Earth,
BenchMade Modern, Etsy top-tier ateliers, Framebridge). This **extends
[docs/luxury-ecom-strategy.md](./luxury-ecom-strategy.md)** (the v5 layer):
the ten-site strategy table, the 2026 cross-cutting findings, and the three
elements already shipped in §C (provenance strip, concierge reply promise,
honest one-of-one line) are recorded there and not repeated here. This
document is the area-by-area benchmark the owner's brief asks for, checked
against the storefront as it exists today.

Vocabulary note: the research speaks of four tiers; in this codebase the
catalog is three **ecosystems** (`art` / `supplies` / `print`,
src/lib/catalog-taxonomy.ts) plus a `tier` field where tier 1 = owner
("studio") originals inside `art`. Adaptations below use the real taxonomy.

## A. Benchmark table

| Area | Best practice (attributed) | What we adapt (ResinRiva-specific) |
|---|---|---|
| **Product Card** | Absolute card uniformity at any scale: one object per frame on a single neutral plate, 2–3 quiet text lines (brand-caps, name, plain price), nothing else (SSENSE, Hermès, Bottega Veneta). Exactly two states — resting packshot → crossfade to alternate/context shot on hover, 250–400ms, never scale-bounce (Tiffany, Bulgari, Net-a-Porter, Etsy). Badges are text-only letter-spaced small caps ('New', 'Exclusive', 'Only 1 left'), never colored pills or discount stickers (Cartier, Farfetch); genuine unit-level scarcity is the one honest urgency (Farfetch's 'last one'). | Keep the flat hairline card as the locked skeleton for all 4,374 SKUs: category eyebrow, display name, quiet price band, ≤2 variant chips as a caption line. Hover stays an opacity crossfade to the second gallery image (duotone shift when only one exists) — never zoom. Badges remain uppercase micro-labels on dark glass: Studio original (tier 1, outranks all), Atelier pick, honest Out of stock; no red, no percentages, no stars anywhere in the grid. Gold never appears on ordinary cards — grid-level gold is spent solely where exclusivity is true. |
| **Product Page** | Ascetic above-the-fold block — name, one-line descriptor, plain price, single CTA — with dimensions/materials/care pushed into accordions (Hermès, Loewe); human contact stacked at the CTA as the luxury path, not friction ('Contact an ambassador' — VCA; concierge overlay — Gucci); trust microcopy exactly at the decision moment: delivery date, returns, 'you are not committing to anything' (Farfetch, Mytheresa, Vitsoe). No cart is framed as a service upgrade (Vitsoe's personal planner). | The PDP right rail is the VCA ambassador pattern natively: category eyebrow → name → tier badge → tagline → quiet price + 'crafted in N' + one-of-one line → reason-to-believe checklist ('no payment now') → order panel whose submit opens a structured WhatsApp message → reply-time promise directly under the CTA. Below, the single porcelain paper sheet carries story, spec sheet (real fields only), production/delivery/care accordions and top-3 FAQs. Vitsoe's 'send a photo of your space' is the reference uploader on the order panel. Never 'DM for price' — priced pieces show the band; enquire-only pieces say Enquire as fact. |
| **Product Gallery** | A locked shot recipe per SKU — hero on the house plate, material macro, scale/in-hand, in-context — enforced as required slots so the marketplace reads as one house (all four multi-brands; Baymard's image-type audits); scale is the #1 jewelry-ecom failure, so one human-context frame is mandatory (Tiffany, Cartier); motion is real capture, not renders — turntable/catwalk loops as a gallery slot (Net-a-Porter, Brilliant Earth's 360° stone videos); deep zoom rewarded (Gucci). | The signature crop is the resin equivalent of Bottega's intrecciato: a raking-light macro of pigment depth, cells, and polished edge — mandated as slot 2 for every `art` piece; for `print`, macro the layer lines as craft texture rather than hiding them. The Brilliant Earth 360° equivalent is a 6–10s **light-play loop** (light moving across the cured surface — resin only moves under light), real capture per the no-decorative-3D rule; the existing `videoUrl`/`model3dUrl` rail slots carry it. Scale shots use relatable references ('spans a palm'); supplies need only packshot + label close-up to keep the photo burden sane. |
| **Search** | Search opens as a focused overlay with grouped, typed suggestions — designers / categories / products as distinct clusters, so one keystroke routes to the right shelf instead of a flat dump (Farfetch, Net-a-Porter); synonym coverage for what buyers actually type; query pages stay out of the index. | Group /search results by ecosystem — `art` above `supplies` above `print` — so "blue" returns pieces before pigments; index the audience's real vocabulary ('epoxy', 'geode tray', 'lithophane', 'PLA') as synonyms over title/tagline. Keep the existing noindex/follow discipline and the hand-off to /shop?q= for the full set. At 4,374 SKUs this stays a lightweight DB/Fuse pass — no search vendor needed. |
| **Filtering** | Two modes off one system: luxury shelves get deliberately few facets behind a 'Refine' veil with curation protecting atmosphere (Hermès, Gucci, Loewe); utility shelves get dense spec facets because that buyer is on a mission (accepted trade-off, per Baymard's under-filtering flags); need-based facets beat taxonomy trees (Aesop's 'skin type'); applied filters echoed as removable pills, state carried in the URL so views are shareable (Farfetch, Brilliant Earth); 'Quick Ship / made-to-order' elevated to a first-class axis (BenchMade Modern, Brilliant Earth, Etsy's arrival filter). | Keep the URL as the single source of truth (already so): every filtered view is pasteable into a WhatsApp thread — filtering doubles as the owner's concierge tool ('all ocean pieces under ₹5k' as one link). Facet by need, not internal taxonomy: ecosystem tabs, category chips with live counts (empty shelves hidden), occasion, price band, availability. The Ready-to-ship/made-to-order split is the most important axis in a mixed stocked+commissioned catalog — surface lead time before the chat starts to cut the commonest WhatsApp back-and-forth. Scope any future dense spec facets (volume, grade, nozzle) to `supplies`/`print` only. |
| **Category** | Price tier is encoded through grid density and photography, not labels: airy 2-up editorial grids for hero lines, compact spec-forward grids for utility lines, one PLP component serving both (Hermès, Gucci, Loewe's module system); default sort is always curated — 'Our picks', expert-trained rank — never price or recency, because the house has an opinion (Farfetch, Net-a-Porter, Mytheresa); editorial interruptions only as full-width bands between complete rows, never as a stolen grid cell (SSENSE, Net-a-Porter). | The grid IS the design (already the /shop macrostructure): one ShopExplorer serves every shelf; density and register — not labels — should keep separating `art` from `supplies`. Default sort stays 'featured' (featured desc → tier asc → newest): the curated default costs one field and a weekly owner ritual, and is the cheapest way to make 4,374 SKUs feel edited. Category pages keep the pinned-category variant of the same component; any editorial insertions go in as full-width dark bands after complete rows only. |
| **Collection** | Merchandise by named, icon-led collection first — Alhambra, Serpenti, LOVE — with a landing that opens on origin story before the grid (VCA, Bulgari, Cartier); gifting is the one place luxury filters openly by price, merchandised by occasion, recipient and band, with packaging monetized as UX — the Blue Box on every giftable PDP and a 'drop a hint' share flow (Tiffany, Cartier). | Name collections and lead with them ('Nebula', 'Tidepool' — never 'Coasters'); a collection landing = one short story block (inspiration, pour process) above the pinned grid. Build /gifts off the existing occasion vocabulary × price bands — the strategy doc's §D candidate, now backed by four-cluster evidence. Photograph the signature dark-sapphire box once, beautifully; every giftable PDP gets an 'arrives in the ResinRiva box' line and the packaging frame as the final gallery slide. 'Drop a hint' — a custom build for the maisons — is one recipient-framed wa.me deep link for a WhatsApp-first brand. |
| **Product Storytelling** | No star ratings anywhere on true luxury PDPs — trust is structural: maker attribution, cast/batch numbers, certificates, care service, packaging (all four maisons, Aesop, Vitsoe, Georg Jensen); fixed labeled lexical fields ('Suited to / Feels like / Aroma') scale a literary voice across hundreds of SKUs (Aesop); specificity is the tell — '3000 grit' is atelier language, 'handmade with love' is mass language (Etsy top ateliers, BenchMade's 'handcrafted in Dallas'); natural variance stated as preciousness, not disclaimed (VCA's mother-of-pearl note); cross-sell is set-completion and provenance, never collaborative filtering (VCA, Aesop, Etsy's 'more from this shop'). | Keep zero star widgets (testimonials stay curated, gated until real). Add Aesop's lexical block per ecosystem as structured fields — `art`: Suited to / Feels like / Pour story / Pigments; `supplies`: Use for / Grade / Coverage; `print`: Material / Layer height / Tolerance — bespoke sentences only for tier-1 pieces, terse data-driven copy elsewhere. State variance as fact: 'Each pour is unique — yours will differ subtly from the photograph.' The unfair advantage no maison can copy is **cross-tier provenance linking**: 'Made with' on an art PDP names the actual pigments/resins from `supplies`; 'What this creates' on a supply PDP shows finished pieces — the catalog monetized in both directions, doubling as craft proof. |
| **Mobile Product UX** | Sticky bottom bar with price + the primary CTA once the gallery scrolls away — the single separator between mediocre and good mobile PLP/PDP work (Mytheresa, Farfetch, Etsy; Baymard 2025); edge-to-edge swipe gallery with edge-peek and a thin counter; filters and saved lists as bottom sheets; quick-view suppressed on luxury shelves — the full PDP protects immersion (Hermès) — allowed only where speed beats immersion; the wishlist as the real conversion object for considered purchases (Gucci, Farfetch, Etsy). | Since WhatsApp ordering is inherently mobile, the sticky bar is the site's single highest-value component — it exists (StickyMobileCta: name + price, returns to #order-panel); keep it one action plus nothing. The wishlist IS the cartless checkout and already works as one: localStorage hearts → /shop/wishlist → one prefilled WhatsApp message listing saved pieces ('+N more' beyond 12) — the Shortlist pattern the multi-brand cluster reaches for, native here. Quick-view stays a grid affordance for triage, never a substitute PDP. Honor prefers-reduced-motion everywhere (already enforced via motion-reduce classes). |
| **Luxury Visual Design** | The lighting system, not card chrome, signals luxury: the grid as a museum vitrine wall — uniform plate, soft top light, contact shadow (all four jewelry maisons); 2–3× more whitespace than mass market (NN/g via Hermès/Bottega); a motion budget of few deliberate moves at 200–400ms ease-out — motion confirms, never entertains (Aesop, Hermès, Loewe); price in quiet body type as a fact, never a pitch; zero urgency mechanics — scarcity only as truth (Hermès' withholding, Farfetch's real 'last one'); restraint as the shared mechanism across all five clusters. | The dark-sapphire system inverts the vitrine: each piece photographed consistently and floated on the deep canvas reads museum-lit — photography + CSS only, and the no-decorative-3D rule matches what the maisons actually do (none run WebGL toys). The existing disciplines — motion budget, gold ≤5% and demoted to hairlines/star fills, protected silence, one sapphire primary per surface, honest scarcity copy — are exactly the benchmark's conclusions; they are gates to defend, not debts to pay. The one addition worth its pixels: keep spending gold only where conversion or true exclusivity lives (the tier-1 mark, the one hairline per surface), never on chrome. |

## B. Deltas already satisfied

Verified against the storefront, not the plan:

- **Two-state hover card, never scale** — src/components/shop/product-card.tsx:
  300ms ease-luxe opacity crossfade to the second gallery image, duotone
  fallback, hover image unmounted on touch devices (PERF-306); monogram
  fallback panel for imageless rows.
- **Text-only honest badges** — same file: uppercase micro-labels on dark
  glass (Studio original / Atelier pick / Out of stock), tier 1 outranks the
  curated pick; no pills, no red, no stars.
- **PDP depth + trust at the decision moment** —
  src/app/[locale]/product/[slug]/page.tsx: quiet price band + 'crafted in N'
  + one-of-one line on one hairline; reason-to-believe checklist ('no payment
  now'); reply-time promise under the order CTA; SpecSheet rendering only
  real fields (src/components/product/spec-sheet.tsx); production / delivery
  / care accordions; top-3 FAQs on-page; provenance pillar strip; JSON-LD
  with honest availability (no fabricated offers).
- **Structured WhatsApp order composition** —
  src/components/product/order-panel.tsx: per-product custom fields (SELECT /
  SWATCH / SIZE / NUMBER / FILE) serialize into the order message via
  buildOrderMessage; reference-image upload = Vitsoe's 'send a photo of your
  space'; localized wa locale handling.
- **Curated cross-sell, capped** — product page: 'You may also like' (same
  category, 4) plus the band-widening 'From the same shelf' row that only
  renders on genuinely deep categories — set-completion logic, zero
  collaborative filtering.
- **Ecosystem filtering with URL as source of truth** —
  src/app/[locale]/shop/page.tsx + src/components/shop/shop-explorer.tsx:
  art/supplies/print tabs, category chips with live counts (empty shelves
  hidden), occasion / price-band / stock facets, shareable filtered URLs,
  infinite scroll, quick-view slot outside the card anchor.
- **Curated default sort** — src/lib/shop-filters.ts: DEFAULT_SORT
  'featured' (featured desc → tier asc → newest); price/newest offered,
  never default.
- **Wishlist as the cartless checkout** —
  src/components/shop/wishlist-panel.tsx: localStorage store, published-only
  refetch, single sapphire primary that serializes the saved list into one
  prefilled WhatsApp message (capped at 12 + 'N more').
- **Sticky mobile CTA** — src/components/product/sticky-mobile-cta.tsx,
  mounted with reserved bottom padding on the PDP.
- **Gallery with real-capture media slots** —
  src/components/product/gallery.tsx: thumb rail, video slot, product 3D
  slot, lightbox with counter and focus return.
- **No fake urgency anywhere; testimonials gated until real** — per
  luxury-ecom-strategy §C; TestimonialCarousel renders only with content.

## C. Gaps worth implementing (prioritized, max 10)

| # | Gap | Effort | Lands in |
|---|---|---|---|
| 1 | **Light-play loop as an autoplaying gallery moment** — today `videoUrl` sits behind a rail click; play it inline, muted, on scroll-into-view (reduced-motion aware) so resin depth moves without a tap. The Brilliant Earth 360° equivalent, real capture only. | S | src/components/product/gallery.tsx |
| 2 | **Pour-variance line** — 'Each pour is unique — yours will differ subtly from the photograph' near the gallery/specs on `art` pieces: converts handmade variance from complaint risk into exclusivity cue (VCA's materials note). One key ×9 locales. | S | src/app/[locale]/product/[slug]/page.tsx (+ messages/*) |
| 3 | **Cross-tier provenance linking** — 'Made with' (art PDP → the actual supplies used) and 'What this creates' (supply PDP → finished pieces). Needs a product↔product relation + studio picker; the one pattern in the whole benchmark no reference site can copy. | L | prisma/schema.prisma + product/[slug]/page.tsx + studio admin |
| 4 | **Aesop lexical fields** — per-ecosystem labeled blocks (Suited to / Feels like / Pour story; Use for / Grade / Coverage; Material / Layer height / Tolerance) as structured columns rendered on the paper sheet; bespoke prose only for tier 1. | M | prisma/schema.prisma + src/components/product/spec-sheet.tsx |
| 5 | **/gifts pathway** — occasion rails × existing price bands over the pinned ShopExplorer grid, opened by the signature-box frame; the strategy doc's §D candidate, now the clearest cross-cluster consensus (Tiffany/Cartier/Etsy). Copy ×9. | M | new src/app/[locale]/gifts/page.tsx |
| 6 | **Photographed resin-chip swatches** — SWATCH options currently resolve to a CSS colour map; replace with photographs of real cured chips (option → image URL) so variant choice shows true material depth (Bottega/Herman Miller 2D-first). | M | src/components/product/order-panel.tsx + CustomField options shape |
| 7 | **Search grouped by ecosystem + synonym vocabulary** — art above supplies above print in /search results; index 'epoxy', 'geode', 'lithophane', 'PLA' against titles/taglines so buyer language hits studio language. | M | src/app/[locale]/search/page.tsx + src/lib/shop.ts |
| 8 | **Packaging as UX** — photograph the dark-sapphire box once; 'arrives in the ResinRiva box' line in the delivery accordion + the frame as the final gallery slide on giftable pieces. | S | product/[slug]/page.tsx (delivery accordion) + one asset |
| 9 | **Drop a hint** — a second, recipient-framed WhatsApp share ('thought you'd love this…') beside the existing share composer; one deep link where the maisons built custom flows. | S | src/components/product/share-buttons.tsx |
| 10 | **Editorial band in long grids** — one full-width dark band (process photo + one sentence) after a fixed row interval on `art` shelves only, between complete rows, never as a grid cell; supplies/print stay pure grid. | M | src/components/shop/shop-explorer.tsx |

Rule holding over everything above: nothing ships that adds urgency,
decoration, or noise — the restraint gates in design.md remain the arbiter.
