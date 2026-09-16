# Three-tier brief vs. HEAD `91c93b5` — read-only audit (2026-09-16)

Source: `Rivya_Living_Art___Three-Tier_Product_Architecture_Prompt.md` (the
owner's brief; `docs/plan/07-three-tier-architecture.md` is the in-force plan
for it). Statuses: DONE · PARTIAL · NOT DONE · TABLED (Tn = owner question in
`docs/plan/07` §"Conflicts that need an owner decision") · REFUSED BY CONTRACT
· N/A. Paths are relative to the repository root.

| Doc § | Requirement (short) | Tier | Status | Evidence | Note |
|---|---|---|---|---|---|
| **Intro** | Three tiers modelled as three intents, one vocabulary, not three filters | all | DONE | `src/lib/product-size-tier.ts:8-33`; `prisma/schema.prisma:127` `sizeTier ProductSizeTier?`; `product-size-tier.test.ts` pins tuple vs Prisma enum | One list, one enum, one column separate from `Product.tier` (:118). |
| Intro | Integrated into site + Studio + nav + collections + DB + scraper + search + filters + home + PDP | all | PARTIAL | DB/Studio/scraper/filters/PDP presets done (rows below); nav T2, homepage T8, Tier 02 path T4 tabled | Search deliberately does not rank on it: `src/lib/search-query.ts:130-135`. |
| Intro | Journey line "Small object → personal memory → collectible art" on the storefront | all | NOT DONE | no `messages/en.json` hit; only `docs/plan/07` header | Would live in the T8 band. |
| Intro | One coherent premium brand across tiers | all | DONE | one design system (`CLAUDE.md` "Design system — v3"); one card foundation `src/lib/card-meta.ts:39-57`; one PDP route | Variants, not templates. |
| **Tier 01** | Typical-products vocabulary (tables, seating, consoles, panels, sculpture, installations) | LARGE | DONE | `src/lib/scraper/size-tier-suggest.ts:62-96`; `src/lib/catalog-size-tier.ts:82-85`; studio hint `product-size-tier.ts:64-65` | |
| Tier 01 | Materials mix (resin, wood, metal, stone, botanicals, lighting…) as data | LARGE | PARTIAL | `schema.prisma:80` `materials String?` free text; custom-order `materials` `src/actions/order.ts:413` | Structured material list = T3 class. |
| Tier 01 UX | Not the same treatment as a ₹500 keychain | LARGE | PARTIAL | collectible card `src/components/storefront/catalog-product-card.tsx:126-127,257-324`; PDP has no `variant=` (grep empty in `src/app/[locale]/(v2)/product/[slug]/page.tsx`) | Card differs; PDP differs only in order-panel copy. |
| Tier 01 UX | Large editorial / full-screen photography | LARGE | PARTIAL | `large-resin-art/page.tsx:222-296` hero; `storefront/fullscreen-gallery.tsx`, lightbox | Same gallery for every tier. |
| Tier 01 UX | Lifestyle / interior photography | LARGE | PARTIAL | PDP `Product.roomContext` copy; homepage `rooms` band `src/lib/page-sections.ts:219-224` `defaultVisible:false` | Concept tiles, not per-piece photos (T7). |
| Tier 01 UX | Macro material photography | LARGE | PARTIAL | `storefront/accordion-gallery.tsx:22 macroSrc`; slots `about.material1–4.macro` | Brand-level, not per product. |
| Tier 01 UX | Video | LARGE | DONE | `schema.prisma:94 videoUrl`; PDP `page.tsx:758`; form label "Video URL" | Also `model3dUrl` :95. |
| Tier 01 UX | Dimensions | LARGE | DONE | `schema.prisma:81`; PDP `page.tsx:550-551,909-911`; card `card-meta.ts:78,111` | |
| Tier 01 UX | Materials | LARGE | DONE | `schema.prisma:80`; PDP `page.tsx:547-548`; card `catalog-product-card.tsx:300` | |
| Tier 01 UX | Weight | LARGE | NOT DONE | no column in `model Product` (`schema.prisma:66-153`); no copy | T3 class (new product field). |
| Tier 01 UX | Finish options | LARGE | TABLED (T3) | `docs/plan/07` T3 | Expressible today as a per-product `SELECT` `CustomizationField`. |
| Tier 01 UX | Colour possibilities | LARGE | DONE (per product) | `FieldType SWATCH` `schema.prisma:209-216`; `Product.customizationNote` | Owner-configured per product. |
| Tier 01 UX | Edition / one-of-one / limited status | LARGE | TABLED (T3) | `card-meta.ts:79-85` "there is no edition column (T3)" | Card shows "Made to order" in that slot. |
| Tier 01 UX | Lead time | LARGE | DONE | `schema.prisma:79 timeline`; PDP `page.tsx:553-554,803-804`; `Common.announcementDefault` | |
| Tier 01 UX | Shipping / installation information | LARGE | PARTIAL | `Product.delivery` + `Product.trust.shipping` (generic India shipping) | No installation guidance; shipping class is T3. |
| Tier 01 UX | Craft process | LARGE | DONE | `/process` `Process.timeline.step1–10`; `LargeFormat.how.s1–s4`; PDP `Product.production` | Generic, not per piece. |
| Tier 01 UX | Artist / designer story | LARGE | PARTIAL | About maker band `page-sections.ts:379-380`; `home.maker` | Brand-level; no per-product story field. |
| Tier 01 UX | Customization possibilities | LARGE | DONE | `CustomizationField` `schema.prisma:218`; `Product.ctaCustomize` "Customize this piece" | |
| Tier 01 UX | Care instructions | LARGE | DONE | `schema.prisma:91 careNotes`; PDP `page.tsx:513-514` (falls back to `SiteSettings.defaultCareNotes`); `Product.careHeading` | |
| Tier 01 UX | Project enquiry | LARGE | DONE | `/custom-order` zod `src/actions/order.ts:412-418` (idea, materials, occasion, budget, timeline, 5 refs); `InquirySource.CUSTOM_ORDER` `schema.prisma:234-238` | |
| Tier 01 UX | Architect / interior-designer enquiry | LARGE | NOT DONE | no copy hit for architect/trade; `InquirySource` = PRODUCT·CUSTOM_ORDER·CONTACT only | T9-adjacent: nothing to record it in. |
| Tier 01 CTA | Primary "Commission a piece" | LARGE | DONE | `en.json ProductTier.LARGE_FORMAT.primaryCta`; `src/lib/tier-order-copy.ts:27-31`; `src/components/product/order-panel.tsx:161`; `scripts/e2e-smoke.mjs:352` | |
| Tier 01 CTA | Secondary "Request a consultation" | LARGE | PARTIAL → T9 | copy at `ProductTier.LARGE_FORMAT.secondaryCta` in 9 locales; **no consumer** (grep `secondaryCta` in `src` → none) | Copy landed, nothing renders it; consultation record is T9. |
| Tier 01 CTA | "Customize this piece" | LARGE | DONE | `Product.ctaCustomize` | |
| Tier 01 CTA | "Request price" | LARGE | PARTIAL | label `Shop.card.collectible.priceOnRequest`; the WhatsApp thread is the request; no dedicated CTA/record | T9. |
| Tier 01 CTA | "Discuss your project" | LARGE | DONE (equivalent) | `LargeFormat.hero.startCta` → wa.me `large-resin-art/page.tsx:285-287`; `Product.ctaWhatsApp` "Ask on WhatsApp" | Wording differs. |
| Tier 01 CTA | "Download specifications" | LARGE | NOT DONE | no hit; `Product.specs.heading` is on-page only | Buildable (spec sheet → file); not in plan. |
| Tier 01 | Never Add-to-Cart shaped | LARGE | DONE | `src/lib/product-size-tier.test.ts:94-98` refuses cart/checkout/basket wording in any tier | |
| Tier 01 price | Price on Request | LARGE | DONE | `showPrice=false` → `card-meta.ts:101-102` `onRequest`; PDP JSON-LD offer suppressed `page.tsx:685-688`; T6 "Enquire" leak closed | |
| Tier 01 price | Starting From | LARGE | TABLED (T3) | `card-meta.ts:59-66` "deliberately NOT derived" | Needs a price-type field. |
| Tier 01 price | Request Quote | LARGE | TABLED (T9) | `docs/plan/07` T9 | |
| Tier 01 area | Dedicated `/collectible-design` or `/large-art` | LARGE | DONE (as `/large-resin-art`, T10) | `src/app/[locale]/(v2)/large-resin-art/page.tsx`; footer `src/lib/constants.ts:119`; `src/app/sitemap.ts:22` | §1.1 protects the existing URL; no rename. |
| Tier 01 area | Sub-collections Tables · Seating · Consoles | LARGE | PARTIAL | `LargeFormat.scope.k1Title` "Tables and surfaces"; `Home.furniture.kinds` = dining/coffee/side/console/chair/bench; `large-resin-art/page.tsx:508-559` | Copy bands, not routes/filters; furniture band `defaultVisible:false` `page-sections.ts:188-193`. |
| Tier 01 area | Sub-collections Sculptural Objects · Wall Installations · Bespoke Projects | LARGE | PARTIAL | `LargeFormat.scope.k2/k3`; category `sculptures-objets` `catalog-size-tier.ts:84`; brief → `/custom-order` `page.tsx:291-292,521` | Only "sculptures" has a category; no wall-installation slug. |
| Tier 01 area | Gallery feel, few items per screen | LARGE | DONE | `large-resin-art/page.tsx:581` `grid-cols-2 lg:grid-cols-3`; `src/lib/large-format.ts:52 take=6`, `:59` where by category | Where is by category on purpose until backlog worked (:15-30). |
| **Tier 02** | Typical-products vocabulary (varmala, clocks, trays, frames, nameplates, baby, pooja…) | MEDIUM | DONE | `size-tier-suggest.ts:98-136`; `catalog-size-tier.ts:87-95`; `product-size-tier.ts:66-67` | **Inconsistency:** scraper keyword `pooja` → MEDIUM, but catalogue category `festive-pooja` → SMALL (`catalog-size-tier.ts:101`). |
| Tier 02 | Proposition "Preserve the moment. Keep the story." | MEDIUM | NOT DONE | no copy hit; nearest `ProductTier.MEDIUM_FORMAT.promise` has no consumer | Copy-only; needs a surface (T8/T4). |
| Tier 02 UX | Guided customization stronger than ecommerce | MEDIUM | TABLED (T4) | `docs/plan/07` T4 "largest piece of work" | |
| Tier 02 UX | Fields: occasion, bride/groom/couple names, event date | MEDIUM | PARTIAL | `FieldType TEXT/SELECT` `schema.prisma:209-216`; `Product.occasions` :82 is a catalogue facet, not an order field | Owner can add per product; no preset template. |
| Tier 02 UX | Fields: dimensions, shape, resin/base colour, typography, metallic finish | MEDIUM | PARTIAL | `FieldType SIZE/SWATCH/SELECT`; chips `src/lib/shop.ts:241-246` | Same. |
| Tier 02 UX | Flowers/material preserved; extra objects (kaleera, choora, pearls…) | MEDIUM | PARTIAL | TEXT field + order `notes` `actions/order.ts:210` (1500 chars) | No structured list. |
| Tier 02 UX | Photo / wedding-card / reference uploads | MEDIUM | PARTIAL | `FieldType FILE`; `order-panel.tsx:21,165,219,265`; `referenceImageUrls max 5` `actions/order.ts:209` | One reference uploader, not three labelled uploads. |
| Tier 02 UX | Visual 7-step path (choose → size → style → details → upload → review → confirm) | MEDIUM | TABLED (T4) | not built | |
| Tier 02 UX | Pickup / shipping instructions for physical flowers | MEDIUM | NOT DONE | no copy hit (pickup/courier) | Part of T4. |
| Tier 02 UX | Preservation → design confirmation → casting → curing → finishing → QC → delivery explained | MEDIUM | PARTIAL | `/process` `Process.timeline.step1–10` (concept…casting, curing, finishing, QC, delivery); `LargeFormat.scope.k4` "Preservation at scale" | Generic resin process; no flower-preservation stage. |
| Tier 02 UX | Estimated production lead time | MEDIUM | DONE | `timeline` chip `page.tsx:803-804`; announcement bar | |
| Tier 02 UX | PDP explains how a sentimental object becomes resin art | MEDIUM | NOT DONE | PDP has no tier-conditional explainer; `Product.production` generic | T4. |
| Tier 02 CTA | Primary "Preserve your memory" | MEDIUM | DONE | `ProductTier.MEDIUM_FORMAT.primaryCta`; `order-panel.tsx:161`; WA intro `actions/order.ts:187` | |
| Tier 02 CTA | Secondary "Start customization" | MEDIUM | PARTIAL | copy `ProductTier.MEDIUM_FORMAT.secondaryCta`; no consumer | |
| Tier 02 CTA | "Discuss on WhatsApp" | MEDIUM | DONE | `Product.ctaWhatsApp`; `Shop.card.askOnWhatsApp`; `src/components/shop/card-ask-whatsapp.tsx` | |
| **Tier 03** | Typical-products vocabulary (rakhi, jewellery, keychains, coasters, magnets…) | SMALL | DONE | `size-tier-suggest.ts:138-180`; `catalog-size-tier.ts:97-103` | |
| Tier 03 | Small feels premium, not craft-market | SMALL | PARTIAL | `compact` shelf variant for <₹1,000 shelves `catalog-product-card.tsx:31-41`; no `gift` variant (`card-meta.ts:46-49`) | |
| Tier 03 UX | Fast model: Select → Variant → Personalize → Order | SMALL | DONE (as WhatsApp order) | `ProductTier.SMALL_FORMAT.primaryCta` "Order on WhatsApp"; intro byte-equal to default (`CHANGELOG.md` step 8a) | |
| Tier 03 UX | Add to Cart / Checkout | SMALL | REFUSED BY CONTRACT (T1) | `CLAUDE.md` HARD RULES (REDESIGN.md §1.1 / Part 0); `product-size-tier.test.ts:94-98` | Fast ordering, not checkout. |
| Tier 03 UX | Personalization: name/initial/colour/flower/charm/letter/date/message/photo | SMALL | PARTIAL | `FieldType` TEXT/SWATCH/SELECT/FILE; `src/components/shop/quick-view.tsx` | Per product, owner-configured. |
| Tier 03 UX | Gift packaging | SMALL | NOT DONE | no hit | A per-product SELECT could carry it; nothing site-wide. |
| Tier 03 discover | Occasion | SMALL | DONE | `src/lib/shop-filters.ts:114`; `shop.ts:84-86 array_contains` | |
| Tier 03 discover | Festival | SMALL | PARTIAL | `OCCASIONS` = Wedding·Anniversary·Diwali·Birthday·Corporate·Housewarming·Baby (`src/components/studio/products/occasions.ts:6-12`) | Code constant; no Rakhi/Valentine's/Mother's/Father's. |
| Tier 03 discover | Product type · Price | SMALL | DONE | `?category=`/`?type=` `shop.ts:74-81`; `PRICE_BANDS` `shop-filters.ts:76`; sorts :88-94 | |
| Tier 03 discover | Recipient · Colour · Material · Personalization facets | SMALL | NOT DONE | `ShopFilters` `shop-filters.ts:111-126` has none of them | New fields/facets — T3 class. |
| Tier 03 discover | Ready to ship / Made to order | SMALL | PARTIAL → T5 | `?stock=in` `shop.ts:91`; `inStock` renders "Made to order" `catalog-product-card.tsx:383`; `Shop.card.shipsIn` | One boolean, two meanings; T5 says keep it. |
| Tier 03 | Seasonal collections (Rakhi, Diwali, Wedding, Valentine's, Mother's/Father's, Anniversary, Birthday, Corporate) | SMALL | PARTIAL | 4 of 9 in `OCCASIONS`; landers buildable in `/studio/custom-pages` (`custom-blocks.ts`, `isLive()`) | |
| **Homepage** | Do not dump products | all | DONE | `page-sections.ts:133-134` featured ≤12 (`src/lib/demo/fixtures.test.ts:193`); collections band :172-173 | |
| Homepage | "Three scales. One artistic language." band with 01/02/03 blocks | all | TABLED (T8) | no copy hit; `REDESIGN.md:506,551` records the "three studios" block deleted; no such key in `page-sections.ts:111-332` | Must replace a band (§3.1 three dark bands max). |
| Homepage | Dramatically different imagery per tier | all | TABLED (T7) | `docs/plan/07` T7; 12 manifest rows ungenerated (`CLAUDE.md` Part 15) | Blocked on assets/credits, not code. |
| Homepage | Tier 01 architectural imagery | LARGE | PARTIAL | `home.large-format` band `page-sections.ts:144-145`; furniture/rooms tiles off by default | |
| Homepage | Tier 02 intimate / Tier 03 tactile imagery | MEDIUM/SMALL | PARTIAL | `Home.collections.tiles.preserve/keep/gift`; `tile-live.avif` backs 8 slots (`CLAUDE.md` Site Images) | Shared masters. |
| **Navigation** | Collectible Design · Memory Art · Personal Art & Gifts · Custom Commission · Our Story · Journal | all | TABLED (T2) | `src/lib/constants.ts:80-85` Shop·Bespoke·Studio·Journal; `scripts/e2e-smoke.mjs:165-175` asserts by label; REDESIGN §5.2 | Labels/hrefs are owner-editable in `/studio/navigation` (`nav-menus.ts:78`), but the smoke would fail. |
| Navigation | Custom Commission · Our Story · Journal | all | DONE (as Bespoke → `/custom-order`, Studio → `/about`, Journal) | `constants.ts:82-84` | |
| Navigation | Large → Medium → Small hierarchy in discovery | all | PARTIAL | mega menu lists art/print/supplies by category `site-header.tsx:563-613`; shop drawer "Scale" section last and closed `shop-explorer.tsx:733`; footer "Large format" `constants.ts:119` | No tier entry point in the header. |
| Navigation | No "Tier 1/2/3" exposed to customers | all | DONE | slugs `large/medium/small` `product-size-tier.ts:182-189`; "Tier N —" only in `sizeTierStudioLabel` :80-82; chip uses `shortName` `shop-explorer.tsx:385` | |
| **Collection pages** | Tier 01 editorial layout, large imagery, few items | LARGE | DONE | `large-resin-art/page.tsx:581,694`; `large-format.ts:52` | |
| Collection pages | Tier 01 project stories · materials · dimensions · commission CTAs | LARGE | DONE | work band `page.tsx:456-500`; testimonials :157; card :291-300; CTAs :285-292,521 | |
| Collection pages | Tier 02 grid + occasion browsing | MEDIUM | DONE | `src/app/[locale]/(v2)/shop/[category]/page.tsx:66,99,190` | |
| Collection pages | Tier 02 strong preservation explanation | MEDIUM | NOT DONE | category page has generic `Shop.collection.about*` only | T4. |
| Collection pages | Tier 02 customization badges | MEDIUM | NOT DONE | no "customizable" copy; `Shop.card.customize` is a quick-view CTA | Memory card variant pending. |
| Collection pages | Tier 02 before/after/process imagery | MEDIUM | PARTIAL | `shop/[category]/page.tsx:6,246-260,299` `BeforeAfter` from `Portfolio.beforeImageUrl`; `CLAUDE.md` known gap: no row carries it | Built; data-empty. |
| Collection pages | Tier 03 efficient grid | SMALL | DONE | `shop-explorer.tsx:825-826` 3/4/6 cols; `shelfVariant` :393 | |
| Collection pages | Tier 03 quick personalization | SMALL | DONE | `quick-view.tsx`; trigger `catalog-product-card.tsx:408` | |
| Collection pages | Tier 03 price visibility | SMALL | DONE | `showPrice` default true `schema.prisma:78`; `formatPriceBand` on card | |
| Collection pages | Tier 03 variants on the grid | SMALL | PARTIAL | `variantChips` built `shop.ts:241-246,344` but consumed only by `search/page.tsx` and the PDP; card shows "N options" duplicate count `catalog-product-card.tsx:385` | |
| Collection pages | Tier 03 best sellers | SMALL | NOT DONE | `SORTS` `shop-filters.ts:88-94` has none; no sales data (WhatsApp orders) | `featured` is the nearest. |
| Collection pages | Tier 03 new arrivals | SMALL | DONE | `sort=newest` `shop-filters.ts:90`, `shop.ts:214` | |
| Collection pages | Tier 03 festival collections | SMALL | PARTIAL | occasion facet; `OCCASIONS` partial | |
| Collection pages | Shared foundation + tier variants, not one ProductCard | all | PARTIAL | `card-meta.ts:51-57` full/compact/collectible; memory + gift "step 8's" not built (:46-49) | |
| **Card system** | LARGE card: hero, name, object type, material, edition/bespoke, price/from/on request, View piece | LARGE | DONE (minus edition, "from") | `card-meta.ts:72-114`; `catalog-product-card.tsx:257-324` | Edition T3; "from" T3; "Made to order" fills the bespoke slot. |
| Card system | LARGE card used wherever a LARGE piece appears | LARGE | PARTIAL | applied by context only on `/large-resin-art` `page.tsx:694`; `cardVariantFor` has **no grid caller** (`shop-explorer.tsx:393` uses `shelfVariant`) | A LARGE row in `/shop` renders `full`. |
| Card system | MEDIUM card: occasion/preservation type, size, starting price, customizable indicator, Preserve/Customize CTA | MEDIUM | NOT DONE | `card-meta.ts:46-49` resolves MEDIUM to `full` | Buildable now on the collectible pattern; "starting price" T3. |
| Card system | SMALL card: image, name, price, variants, personalizable indicator, Quick view/Add/Customize | SMALL | PARTIAL | full/compact card: image, name, price, quick view, `Shop.card.customize`, Ask on WhatsApp; no personalizable indicator, no chips | "Add" is T1-refused. |
| Card system | Do not overload the card | all | DONE | collectible branch comment `catalog-product-card.tsx:249` "and nothing more"; badges limited to 3 `Shop.card.badge*` | |
| **PDP logic** | Template adapts by tier | all | PARTIAL | `page.tsx:129,330`; `order-panel.tsx:161`; `actions/order.ts:187,310` — CTA, summary note, WhatsApp intro only | Gallery/specs/related/shipping identical across tiers. |
| PDP logic | `<ProductGallery variant="collectible\|memory\|gift">` | all | NOT DONE | `accordion-gallery.tsx:57-59` no variant prop; no `variant=` in the PDP | |
| PDP logic | CTA systems with variants | all | DONE | `tier-order-copy.ts:27-31,67-74`; out-of-stock outranks tier (:67-74) | |
| PDP logic | Customization forms · price presentation · specifications · media galleries · shipping info with variants | all | PARTIAL | one order panel; `SpecSheet` `page.tsx:22,547-554`; `page.tsx:616-620`; `Product.delivery` — all shared | T4 for the form. |
| PDP logic | Related products · lead-time info | all | DONE (shared) | rail `page.tsx:110,360,486-503`; provenance :992-997; lead time :803-804 + `orderSummaryNote` | |
| PDP logic | Not three disconnected sites | all | DONE | one route `product/[slug]/page.tsx` | |
| **Studio** | Mandatory PRODUCT TIER LARGE/MEDIUM/SMALL | all | DONE | `schema.prisma:127`; select `essentials-section.tsx:151-184`; `describeSizeTierPublishProblem` `product-size-tier.ts:132-141`; `src/actions/products.ts:305` (form) and :517-566 (bulk, `skippedUntiered`) | Nullable; refused on the publish TRANSITION — the plan's deliberate reading of "mandatory". |
| Studio | Customer-facing collection label | all | DONE | `SIZE_TIER_NAME` `product-size-tier.ts:41-45`; `ProductTier.*.name`; test pins byte-equality | |
| Studio fields | Product type · category · dimensions · material · price · lead time · customization options · occasion · featured · related · media | all | DONE | `schema.prisma:66-153` (categoryId, :81, :80, :76-77, :79, :152, :82, :93, :89-90, :151/:94/:95); form sections `product-form/*.tsx` | "Related" = provenance `madeWith/usedIn` + derived same-shelf rail, not a free picker. |
| Studio fields | Subcategory | all | NOT DONE | `model Category` `schema.prisma:38-50` has no parent | T3 class. |
| Studio fields | Price type · starting price · finish · personalization type · commission enabled · preservation enabled · shipping class · edition | all | TABLED (T3) | `docs/plan/07` T3; `showPrice` :78 is the only price switch | Seven fields = separate authorization under §1.1. |
| Studio fields | Price on request | all | DONE | `showPrice=false` path (rows above) | |
| Studio fields | Made to order / ready to ship | all | TABLED (T5) | `inStock` :129 carries both | One column for one fact. |
| Studio | Move a product between tiers without code | all | DONE | form select; bulk `setProductsSizeTier` `actions/products.ts:763` + `product-list.tsx:978-981`; import `product_tier` `actions/import.ts:651-654`, `src/lib/import/templates.ts:69,97,118` | Empty cell = no opinion. |
| Studio | Untiered backlog visible | all | DONE | `product-filter.ts:44-45` NONE; `product-list.tsx:491-497,722-725,835`; `src/app/studio/(dashboard)/content-gaps/page.tsx:57-59,192-197` | |
| Studio | Backlog filed by rule (Suggest tiers) | all | DONE | `catalog-size-tier.ts:82-103,213-217`; backfill `catalog-size-tier-backfill.ts:77,159,169`; `prisma/suggest-size-tiers.ts:37-39` preview skip; `prisma/bootstrap.ts:152-154`; `suggest-size-tiers-button.tsx:98` | Supplies stay untiered on purpose (no fourth tier). |
| Studio | Export carries the tier | all | DONE | `src/lib/export/confirmed.ts:65,99,176` | |
| Studio | Demo fixtures tiered | all | DONE | `src/lib/demo/fixtures.test.ts:157-176` (E2E PDP is LARGE) | |
| **Scraper** | Classify imported/reference products into three tiers | all | DONE | `size-tier-suggest.ts:296-330`; source page `source-detail.tsx:109,373-392` | Never stored on the staged row. |
| Scraper | Suggest from title, description, type, dimensions, category | all | DONE | keywords :62-180; `parseMaxDimensionCm` :256; thresholds :48-50, :318-322; tests :123,142,187 | Description never parsed for size (test :211) — by design. |
| Scraper | The 16 examples (Dining Table → LARGE … Coaster → SMALL) | all | DONE | `size-tier-suggest.test.ts:61-76` | |
| Scraper | Admin can override | all | DONE | per-row select `source-detail.tsx:767-776`; dialog `add-to-catalog-dialog.tsx:34,99`; `scraper-review.ts:391,425`; product form afterwards | |
| Scraper | No blind publish; existing review/approval | all | DONE | promote → `status: "DRAFT"` `scraper-review.ts:420`; policy gate (`CLAUDE.md` "A REGISTERED SOURCE IS NOT AN AUTHORISED ONE"); publish refusal | |
| Scraper | Source tier ≠ product tier | all | DONE | `size-tier-suggest.test.ts:46`; `TIER_NUMBER` nulls (`CLAUDE.md`) | |
| **Visual** | Liquid material × craft × memory × function × collectible | all | DONE (design system) | `CLAUDE.md` "Design system — v3 Liquid Luxury"; REDESIGN.md Part 3 | Not pixel-verified here. |
| Visual | Avoid rounded cards, gradients, shadows, random animation, excess badges | all | DONE | `CLAUDE.md` Surfaces rule; `scripts/redesign-audit.mjs` gates every PR; 3 card badges only | |
| Visual | Negative space, controlled type, refined motion, editorial hierarchy | all | DONE | `section-major/standard/compact`, `u-shell`; `src/lib/motion-tokens.ts`; reduced-motion audit | |
| Visual | Premium furniture must not look like merchandise | LARGE | PARTIAL | collectible card yes; LARGE rows inside `/shop` render `full` (card row above) | |
| **References** | Ten sites registered under their tiers, principles only | all | DONE | `src/lib/scraper/seed-data.ts`; `enabled:false`; PENDING until the reference rollout records the review | |
| References | Do not duplicate any reference | all | N/A | design direction, not a code artefact | |
| **Brand hierarchy** | Customer perceives Space → Memory → Person | all | NOT DONE | no "Art for the…" copy; no band (T8); no nav (T2) | Waits on T2/T8. |
| Brand hierarchy | Large = prestige · Medium = emotion · Small = accessibility | all | PARTIAL | `ProductTier.*.promise` copy exists, **no consumer**; `/large-resin-art` positions large | |
| Brand hierarchy | One atelier feel | all | DONE | one design system, one PDP, one card foundation | |
| **Final principle** | One ecosystem, not three sites | all | DONE | single routes/templates with variants | |
| Final principle | Scale, buying behaviour, density and customization flow change per tier | all | PARTIAL | order copy, collectible card, facet, `/large-resin-art` density change; customization flow (T4) and memory/gift cards do not | |

## Summary

1. **Counts (127 rows):** DONE 61 · PARTIAL 38 · NOT DONE 13 · TABLED 13 (T2 ×1, T3 ×5, T4 ×2, T5 ×2, T7 ×1, T8 ×1, T9 ×1) · REFUSED BY CONTRACT 1 (T1) · N/A 1.
2. The data layer, Studio, scraper, backlog tooling, shop facet and the LARGE tier's card + PDP presets are complete and tested; what is missing is almost entirely the customer-facing *presentation* of tiers two and three, plus everything that needs a new product field.
3. **Buildable now — MEDIUM and SMALL card variants** (`card-meta.ts:46-49` still resolves both to `full`); the collectible pattern is already the template.
4. **Buildable now — `cardVariantFor` has no grid caller**: a LARGE piece in `/shop` renders the ordinary card; only `/large-resin-art` passes `variant="collectible"` by context.
5. **Buildable now — orphaned copy**: `ProductTier.*.secondaryCta` ("Request a consultation" / "Start customization" / "Personalize this piece") and `ProductTier.*.promise` exist in nine locales with zero consumers.
6. **Buildable now — classifier inconsistency**: scraper keyword `pooja` → MEDIUM but catalogue category `festive-pooja` → SMALL; the brief puts pooja pieces in Tier 02 and festive products in Tier 03, so one of the two maps needs the owner's word. (PR #92's rule lets a decisive "pooja" title outrank the category, so a "Resin Pooja Thali" files Memory and a "Kanku–Chawal" stays Personal — the two maps now agree on the rows that matter; the owner's word is still owed on the category's default.)
7. **Buildable now — `OCCASIONS` is a code constant** (`occasions.ts:6-12`) covering 4 of the brief's 9 seasonal collections; adding Raksha Bandhan, Valentine's, Mother's/Father's Day is a one-file change (facet + custom-order select).
8. **Waits on an owner answer — T4**: Tier 02's 7-step guided path, labelled uploads, pickup/flower-shipping instructions and the preservation explainer are the largest gap and are explicitly tabled (§1.1 protects customization logic and upload).
9. **Waits on an owner answer — T2/T8**: the tier-first navigation and the "Three scales. One artistic language." homepage band (must replace a band under §3.1); together they are why the brand-hierarchy rows read NOT DONE.
10. **Waits on an owner answer — T3/T9**: edition, finish, price type/"starting from", shipping class, subcategory, weight and the consultation/quote/architect CTAs all need either new product columns or an `InquirySource` value the schema does not have; none should be built under the tier redesign's own authorization.
