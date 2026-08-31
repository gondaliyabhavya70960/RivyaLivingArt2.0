> **ARCHIVED (Step-4 imagery sweep, 2026-08-09 — pre-v2.0).** Palette, slots,
> and component paths here describe the pre-v2.0 tree and no longer match the
> v2.0 Midnight Gild codebase (/DESIGN.md). Notably superseded: the
> "hero/process video — No slot built" row — Phase 6 shipped a settings-driven
> hero video (SiteSettings.heroVideoUrl → HeroMedia on the home hero).
> Reference only.

# Image Inventory & Generation Prompts — Step 4 (2026-08-09)

Full sweep of every image/video slot in the codebase + CMS at HEAD of
`claude/resinriva-audit-tasks-tfz6cs`. Brand palette encoded in every prompt is
the **repo ground-truth token set** (sapphire `#0f52ba`, azure `#3b82f6`,
deep-ocean `#0e3a53`, midnight `#0a1a2f`, gold `#d4af37`, porcelain `#f8f9fa`)
— NOT the ivory/teal/amber list from the master brief, which does not exist in
this codebase (see the Adjusted note in audit.md).

## A. Inventory — every slot, with status

| Route | Component | Slot | Dimensions / aspect | Format | Theme variant | Priority | Status |
|---|---|---|---|---|---|---|---|
| `/` | `home-hero.tsx` | Hero backdrop | full-bleed, ~16:9 | Cloudinary AVIF/WebP | works on both (dark overlay) | P0 | **Filled** — `resinriva/hero-ocean.jpg` |
| `/` | `page.tsx` feature band | Brand-story feature | 4:5 card | Cloudinary | both | P1 | **Filled** — `studio-ocean-wall-art.jpg` |
| `/` | `page.tsx` gallery strip | 5 gallery images | mixed (4/3, 3/4, 1/1, 16/10) | Cloudinary | both | P1 | **Filled** — `GALLERY_IMAGES` |
| `/` + `/shop` | category rail / explorer | 16 category covers | mixed card crops (object-cover) + full-bleed category hero | DB `Category.image` | both (30% opacity under dark gradient on hero) | P0 | **11 filled / 5 MISSING** → generate (§B) |
| `/about` | `about-story` | Story visual | 4:5 | Cloudinary | both | P2 | **Filled** — `about-preserved-flower-frame.jpg` |
| `/blog`, `/blog/[slug]` | featured/grid cards + article hero | 55 post covers | 16:9 (featured), 16:10 (grid) | DB `BlogPost.coverImage` | both | P1 | **ALL 55 NULL** → generate (§C) |
| `/product/[slug]` | gallery | Product photos | 1:1-ish gallery | DB, owner-fed | both | — | **Owner-fed** (brand rule: no AI-invented product imagery) |
| `/portfolio` | cards + detail | Portfolio photos | mixed | DB, owner-fed | both | — | **Owner-fed** |
| testimonials | carousel | Avatars | small circle | DB, owner-fed | both | — | **Owner-fed** (never fabricate) |
| OG cards | `opengraph-image.tsx` + per-route Satori | 1200×630 | dynamic | both n/a | — | **Filled** — generated at request time |
| favicons/PWA | `icon.svg`, `icon-512.png`, `apple-icon.png`, `manifest.ts` | icon set | various | static | n/a | — | **Filled** |
| 404 / empty states | `not-found.tsx`, shop/blog empty states | decorative | n/a | GradientMesh (CSS) | both | — | **By design** — token-driven mesh, no raster needed |
| hero/process video | — | none exist in code | — | — | — | — | **No slot built** — flagged Optional (new feature, not a placeholder) |

No `picsum`/`unsplash`/placeholder URLs exist anywhere in the repo (verified by
grep). The two real gaps are the 5 category covers and the 55 blog covers.

**Hosting decision:** this environment has no Cloudinary/Blob credentials, so
generated assets are committed under `public/images/{categories,blog}/` and
served through the Next image optimizer (root-relative public paths are
optimizable; `isRenderableSrc` extended to accept them). The owner can later
re-host on Cloudinary by URL swap without any component change.

## B. Category cover prompts (5 × 3:4 portrait, Seedream 5.0 Pro, 1.5k)

Shared style block appended to each: *"Photorealistic luxury product
photography, handcrafted resin art, deep ocean-blue graded resin (#0e3a53 →
#0f52ba sapphire) with fine metallic gold (#d4af37) veining and flake, soft
diffused studio key light, macro texture detail, moody dark studio backdrop,
premium Indian gifting context, no text, no watermark, no people's faces."*

| Slug | Subject line |
|---|---|
| `resin-vases` | A pair of sculptural handcrafted resin vases, ocean-blue translucent gradient with gold veining, one holding dried pampas stems, on a dark stone plinth |
| `tablespace-sets` | An elegant resin tablescape set — round serving tray, matching coasters and napkin rings in deep ocean blue resin with gold flake edges, styled on a dark linen table |
| `vanity-mirrors` | A luxurious oval vanity mirror framed in ocean-blue resin with gold leaf inclusions, standing on a dark dresser with soft reflected glow |
| `kids-room-decor` | Playful premium kids-room resin decor — a cloud-and-stars name plaque and small night-light in soft azure blue resin with gentle gold accents, on a shelf |
| `workshops` | A resin-art workshop scene — gloved artisan hands pouring glossy ocean-blue resin from a cup onto a mould, pigment jars and gold flake dishes on the workbench |

## C. Blog cover prompts (55 × 16:9, Seedream 5.0 Pro, 1.5k)

Shared style block appended to each: *"Photorealistic editorial photography for
a luxury handcrafted resin-art studio blog, deep ocean-blue resin tones
(#0e3a53, #0f52ba) with metallic gold (#d4af37) accents, soft studio light,
shallow depth of field, premium Indian craft context, no text, no watermark."*

| Slug | Subject line |
|---|---|
| `3d-printed-architectural-models-business-displays` | A detailed 3D-printed architectural scale model of a modern building displayed on an executive desk, warm accent lighting |
| `3d-printed-gifts-that-surprise-people` | An assortment of intricate 3D-printed gift objects — geometric lamp, custom figurine, lattice bowl — arranged on a dark table |
| `3d-printing-materials-explained-for-buyers` | Close-up of three 3D-printing material samples — matte PLA, glossy PETG and translucent resin print — side by side |
| `anniversary-gifts-by-year-resin-ideas` | A wedding invitation card and dried rose petals suspended in a clear resin block keepsake, anniversary setting with candlelight |
| `baby-milestone-keepsakes-in-resin` | A baby's tiny handprint and footprint cast in a resin keepsake frame with soft gold lettering area left blank, nursery light |
| `birthday-gifts-by-personality-type` | A curated flat-lay of varied resin gifts — bookmark, coaster, pendant, desk tray — wrapped with ribbon on dark paper |
| `bulk-ordering-handcrafted-gifts-guide` | Rows of identical handcrafted resin coaster gift boxes being packed in tissue paper on a studio table |
| `caring-for-resin-trays-coasters-drinkware` | Hands gently polishing a glossy ocean-blue resin serving tray with a soft cloth |
| `christmas-new-year-resin-gift-ideas` | Resin ornaments and small gift pieces in blue and gold beside festive lights and wrapped presents |
| `client-gifts-brand-engraving-logo-trays-desk-pieces` | A corporate desk set — resin tray and pen holder with an engraved blank logo plate area — on an executive desk |
| `combining-3d-printing-with-resin-art` | A hybrid art piece: white 3D-printed geometric lattice partially embedded in glossy ocean-blue resin |
| `commission-journey-brief-to-dispatch` | A studio workbench with a sketch, pigment swatches, a curing resin piece and a shipping box in sequence |
| `complete-resin-care-guide` | A pristine resin ocean-wave art piece being dusted with a soft brush, care products nearby |
| `complete-varmala-preservation-guide` | A preserved wedding varmala of marigolds and roses cast in a large clear resin frame, gold frame edge |
| `conference-event-mementos-guests-keep` | Elegant resin event mementos — medallions and mini plaques — arranged on a conference welcome table |
| `corporate-diwali-gifting-beyond-dry-fruit-box` | A premium Diwali corporate gift box with resin diyas and a gold-flecked tray, rangoli-lit backdrop |
| `custom-3d-printed-desk-accessories-home-office` | A tidy home-office desk with custom 3D-printed organizer, headphone stand and cable holders in matte finishes |
| `custom-nameplates-3d-printed-vs-cast-resin` | Two house nameplates side by side — one crisp 3D-printed, one glossy cast resin with gold flake — on a wall |
| `diwali-gifting-guide-diyas-tea-light-holders-trays` | Lit tea-lights in ocean-blue resin holders with gold rims, festive bokeh background |
| `does-resin-yellow-uv-quality` | A crystal-clear resin block held up to sunlight showing perfect clarity, window light streaming |
| `employee-milestone-awards-in-resin` | A modern resin milestone award trophy with embedded gold flake, on a spotlit shelf |
| `engagement-tray-traditions-modern-resin` | An ornate ocean-blue resin engagement ring tray with gold detailing, rings placed at center, floral surround |
| `first-anniversary-preservation-too-late` | Dried wedding flowers beside a fresh resin casting in progress, hopeful warm light |
| `gifting-varmala-preservation-surprise` | A gift-wrapped large frame being handed over, corner of a preserved varmala visible through paper |
| `gifts-for-people-who-have-everything` | A single extraordinary one-of-one resin art object on a pedestal, gallery lighting |
| `housewarming-gifts-that-feel-bespoke` | A bespoke resin serving board and vase gift set with a linen ribbon in a new home's entryway |
| `how-custom-3d-printing-works-home-decor` | A 3D printer mid-print of a decorative vase, glowing print bed, workshop ambience |
| `how-to-commission-custom-art-no-design-ideas` | A designer's moodboard with fabric swatches, pigment dishes and rough sketches for a resin commission |
| `how-to-store-varmala-before-preservation` | A wedding varmala carefully laid flat in a breathable paper-lined box, gentle morning light |
| `how-we-colour-resin-pigments-inks-ocean-palette` | Macro of pigment dishes and ink drops swirling into ocean-blue resin, gold mica shimmer |
| `is-resin-art-worth-the-price` | A master artisan's hands leveling a large ocean-resin pour, tools and torch nearby, honest workshop scene |
| `lithophanes-photos-you-can-light-up` | A backlit lithophane panel glowing warmly revealing a portrait relief, dark room |
| `made-to-order-vs-mass-production` | A single artisan workbench with one piece in progress, contrasted against neat rows of shipping boxes blurred behind |
| `miniatures-figurines-from-photos-honest-guide` | A detailed custom figurine on a turntable beside reference photos, studio macro |
| `minimalist-vs-statement-resin-pieces` | Two wall pieces side by side — a minimal thin-line resin panel and a bold geode-style statement piece |
| `monsoon-humidity-care-resin-art-indian-homes` | A resin wall clock near a rain-streaked window, dehumidifier hint, monsoon mood |
| `navratri-festive-home-styling-resin-accents` | Festive Navratri vignette with resin diyas, garba-night colors kept in brand blue and gold |
| `packing-resin-art-safely-travel-moving` | A resin frame being wrapped in bubble wrap and foam corners inside a sturdy box |
| `personalised-3d-printed-kids-room-decor` | A kids' room shelf with personalized 3D-printed cloud lamp and star hooks, soft pastel-blue palette |
| `preserving-wedding-elements-beyond-varmala` | A composition of wedding keepsakes — invitation, haldi-stained cloth swatch, bangles — arranged for resin casting |
| `rakhi-gifts-with-meaning-resin-keepsakes` | Delicate resin rakhi keepsakes with embedded threads and gold flake in a gift tray |
| `resin-vs-glass-vs-acrylic-vs-wood` | Four material swatch squares — resin, glass, acrylic, wood — lined up under studio light |
| `resin-wall-art-size-palette-placement` | A large ocean-wave resin wall panel above a console table, interior styling context |
| `resin-wedding-photo-frames-guide` | A teakwood-and-resin wedding photo frame with LED glow edge on a bedside table |
| `revive-gloss-older-resin-pieces` | Half-polished resin coaster showing before/after gloss contrast, polishing compound nearby |
| `river-tables-resin-furniture-indian-interiors` | A walnut river table with a deep ocean-blue resin channel in a warm Indian living room |
| `styling-resin-decor-vignettes-that-work` | A styled console vignette — resin tray, vase, candle holder — balanced with books and linen |
| `tools-of-the-trade-resin-studio` | Flat-lay of resin studio tools — torch, mixing cups, pigments, gloves, heat gun — on dark workbench |
| `varmala-frame-styles-sizes-explained` | Three varmala preservation frames of increasing size leaning on a wall, one with LED backlight |
| `varmala-preservation-myths-debunked` | A pristine preserved varmala frame under bright honest light, magnifying glass resting beside |
| `varmala-preservation-studio-process` | Step-by-step studio scene: flower drying racks, silica trays and a frame mid-pour |
| `wedding-season-gifting-calendar-lead-times` | A planner calendar beside wrapped resin gifts and a curing piece, wedding-season styling |
| `what-makes-good-reference-photo` | A phone photographing a varmala under good window light on a plain backdrop, teaching composition |
| `why-blue-resin-endures-ocean-geode-styles` | A dramatic macro of layered ocean-wave resin with white cell lacing and gold geode veining |
| `why-resin-art-cannot-be-rushed` | A curing resin piece under a dust cover with an hourglass beside it, patient studio stillness |

## D. Spend (actual)

- Model: `seedream_v5_pro` @ 1.5k — 1.5 credits/image; 60 images + 1 retry
  (one 429-rate-limited submission resubmitted; no double-charge).
- Estimate: **90 credits** · Actual: **70 credits** (balance 1800 → 1730, max
  plan). All 60 jobs completed; result URLs recorded in
  `prisma/generated-covers.json`.

## E. Hosting state & follow-ups

- Wired now: 5 `Category.image` + 55 `BlogPost.coverImage` seeded with the
  public Higgsfield CDN URLs (non-destructive: only fills empty covers). The
  CDN host is allow-listed in `next.config.ts` remotePatterns + CSP img-src
  and in `isOptimizableImageSrc`, so Next optimizes/serves AVIF-WebP from it.
- First-party flip: `node scripts/mirror-generated-images.mjs` (open network)
  → commit `public/images/` → re-seed. `prisma/generated-cover.ts` then
  prefers the local `/images/...` paths; the cloudfront allowlist entries can
  be dropped afterwards. (This session's sandbox egress blocks the CDN host,
  which is why the mirror could not be committed here.)
- A scratch Higgsfield website project `resinriva-assets`
  (id d4cbd1bc-fda8-4e27-9f11-6b3531ea918b) was created while probing an
  asset-transfer route and is unused — safe to delete from the Higgsfield
  dashboard.
