# The two UI briefs vs. HEAD `91c93b5` — read-only audit (2026-09-16)

Contract in force: `REDESIGN.md` + `docs/redesign-contract.md` (v3 "Liquid Luxury"), `CLAUDE.md` §1.1 HARD RULES, `docs/plan/07-three-tier-architecture.md`. `docs/plan/06-source-documents.md` already ruled on both briefs: doc 1 is adopted with its palette conflict resolved (§3, "the repo tokens win"); doc 2 was written against the OLDER `RivyaLivingArt` repo (§1) and its paths/stack do not exist here. Legend: DONE · PARTIAL · NOT DONE · SUPERSEDED (refused by the contract, rule cited) · N/A.

## Document 1 — `RivyaLivingArt-WorldClass-UI-Prompt.md` ("Cast in Light")

| Doc § | Requirement (short) | Status | Evidence | Note |
|---|---|---|---|---|
| Role & Mission | Next 16 + React 19 + TS + Tailwind v4, storefront + Studio in one codebase | DONE | `package.json` next ^16.3.1, react 19.2.4; `src/app/[locale]/(v2)` + `src/app/studio` | all |
| Role & Mission | Storefront at award calibre | DONE | REDESIGN.md v3 applied; `redesign-audit.mjs` gates every PR (`.github/workflows/ci.yml:229-231`) | all |
| Role & Mission | Studio as a DARK ops console | SUPERSEDED | `src/app/globals.css:190-203` `.studio-v2` is light (`--bg: var(--mineral)`, `--surface: #ffffff`); dark only under `prefers-color-scheme: dark`; `docs/plan/01 §1` | all |
| Role & Mission | "deliberately slow where it matters" | DONE | `src/styles/tokens.css:223-228` `--ease-luxury`, `--dur-slow 800ms`, `--dur-reveal 900ms` | all |
| Brand | Palette obsidian `#0A0A0F` · gold `#C9A24B` · teal `#3FA7A0` · ivory, dark-first | SUPERSEDED | `docs/plan/06-source-documents.md §3`: repo tokens win (obsidian `#080a0e`, champagne `#b89b63`, sapphire `#164e6b`); contract §2 light ground, max 3 dark bands; teal has no counterpart (D25) | all |
| Brand | No blue-purple gradients, no neon | DONE | zero `gradient` hits in `tokens.css`; palette is obsidian/ocean/sapphire/champagne | all |
| Brand | Glassmorphism, gold rgba hairlines, inner glows, caustics | SUPERSEDED | contract §5 "Blur in exactly one place: the sticky header" (`site-header.tsx:415`); hairlines are `--hairline` tokens; no glow | all |
| Brand | Textures: resin noise, gold foil headings, macro pigment backdrops | PARTIAL | macro material slots exist (`large-resin-art/page.tsx:77-82` `process.material1–4`, `about.material1–4.macro`); foil/noise refused by contract §2 (champagne never a fill) | all |
| Brand | Instrument Serif hero 96–140px · Inter · mono micro 11–12px 0.12em uppercase | DONE | `src/app/fonts.ts:1`; `tokens.css:95` `--text-hero` clamp 48→120px; `globals.css:332-335` `.u-micro` (`--text-micro`, `--tracking-micro`) | all |
| Brand | Numbered section rails `01 — The Pour` | DONE | `CureLine` (`src/components/storefront/cure-line.tsx`; contract §12); `page-sections.ts:509-598` `01 · Concept … 10 · Delivery` | all |
| Brand | Voice: no exclamation marks, no salesy badges | DONE | `grep -c '!' messages/en.json` = 0; only MADE TO ORDER / out-of-stock badges (`catalog-product-card.tsx:317,383`) | all |
| Brand | Soft ambient shadows, never hard | SUPERSEDED (stricter) | contract §5 "No drop shadows on the storefront" (2 exceptions); `tokens.css:212-214` e1–e3 for the Studio | all |
| Brand | 8-pt grid, 1440 max width, full-bleed media | DONE | `tokens.css:179` `--shell-max: 1440px`; `globals.css:358`; `HeroMedia` full-bleed | all |
| Components | threeui: 3D rotating slab hero (home, large-format) | SUPERSEDED | contract §8 motion JS ≤45KB (`scripts/motion-budget.mjs:12-13` ceiling 49KB); Part 14 nothing delays LCP. `three`/`@google/model-viewer` are installed but used only for a product's own `model3dUrl` (`product/model-viewer.tsx:44-76`, lazy + poster) | LARGE |
| Components | magicui gold-foil/shimmer text reveals | SUPERSEDED | contract §2; hero entrance is `sf-hero-rise` (`globals.css:459-463`) | all |
| Components | magicui marquee of collections | SUPERSEDED | no marquee component (grep); collections are a bento + `SnapRail` (`page.tsx:12,897`); contract §8 kills marquee under reduced motion | all |
| Components | magicui bento grids for categories | DONE | `docs/plan/01 §3.2` lead tile 8/12 cols; home `collections` section | all |
| Components | magicui animated number counters | NOT DONE | no `CountUp` in storefront (only `design-lab/motion.tsx`); contract §7 "proof blocks use mono numerals" — static by rule | all |
| Components | magicui border-beam cards | SUPERSEDED | contract §5 no boxes, §8 no glow | all |
| Components | reactbits splash/liquid cursor | SUPERSEDED | CLAUDE.md D18 `CursorFollower` deleted; Part 14 "technology demo is rejected" | all |
| Components | reactbits scroll text-split reveals | SUPERSEDED | D18 `SplitTextHeading`/`KineticHeading` deleted; `motion/reveal.tsx` rise only | all |
| Components | reactbits magnetic buttons | SUPERSEDED | D18 `Magnetic` deleted; contract §6 "No scale or lift on hover" | all |
| Components | reactbits tilted/spotlight cards | SUPERSEDED | contract §8; card hover is image `scale-[1.03]` only (`catalog-product-card.tsx:158`) | all |
| Components | reactbits infinite horizontal collections rail | SUPERSEDED | `storefront/snap-rail.tsx` snap rail below `md`; no auto-scroll | all |
| Components | smoothui accordion (PDP Production/Delivery/Care) | DONE | `product/[slug]/page.tsx:25-29`; `en.json:1342-1350,1403`; contract §8 0fr→1fr 350ms | all |
| Components | smoothui animated tabs (shop type switcher) | DONE | `shop/(index)/page.tsx:148-151` five type tabs as saved views of `?type=`; `ui/tabs.tsx:84` ink underline | all |
| Components | smoothui toast polish | DONE | `sonner` dep; `custom-order-form.tsx:422`, Studio lists | all |
| Components | smoothui theme transitions | N/A | no theme toggle; Studio follows `prefers-color-scheme` (`globals.css:202`) | — |
| Components | 21st.dev hero blocks, testimonial walls, quote cards, mega-footer | DONE (first-party) | `HeroMedia`, `TestimonialWall`, `footer.tsx`; packs refused (CLAUDE.md; `docs/ui-master-plan-reconciliation.md §1.3`) | all |
| Components | ui.unlumen layout shells | N/A | reference only; built on `u-shell`/`section-*` | — |
| Components | animmasterlib pinned horizontal galleries | SUPERSEDED | contract §8 "No scroll-jacking beyond the material-story pin and the process steps" | all |
| Components | animmasterlib parallax image stacks | PARTIAL | one `HeroParallax` capped `min(40, h*0.12)` on the bespoke band (`page.tsx:19`; CLAUDE.md A2); contract §8 caps 20–40px | all |
| Components | animmasterlib section-wipe dark↔ivory transitions | SUPERSEDED | `page-transition.tsx:29` is `--dur-base` fade + 14px rise | all |
| Components | animmasterlib staggered grid entrances | DONE | `reveal.tsx:21-23,66` `stagger`; `sf-card-enter` (`globals.css:435`) | all |
| Components | skiper before/after comparison slider | DONE, no data | `portfolio/before-after.tsx`; wired `shop/[category]/page.tsx:252-306`, `portfolio/[slug]/page.tsx:12`; CLAUDE.md Known gaps: no row has `beforeImageUrl` | MEDIUM |
| Components | skiper card carousels | DONE | `SnapRail`; PDP related rail (`product/[slug]/page.tsx:266`) | all |
| Components | skiper hover-expanding galleries | SUPERSEDED | `shop/card-hover-video.tsx` + FLIP lightbox instead | all |
| Components | vengenceui campaign sections | DONE (first-party) | `/large-resin-art`, `/workshops` with `HeroMedia` | LARGE |
| Components | daisyui inside the Studio | SUPERSEDED | not in `package.json`; Studio is shadcn `.studio-v2` (`globals.css:190`) | all |
| Components | originkit data tables, filter bars, ⌘K, KPI cards, settings | DONE (first-party) | `studio/command-palette.tsx` (products/sources/runs/media/routes; `cmdk` dep); `dashboard/stat-card`; `products/product-list.tsx`; `settings/settings-form.tsx` | all |
| Motion | Lenis + GSAP, ease `cubic-bezier(0.22,1,0.36,1)` | PARTIAL | `tokens.css:223-224` `--ease-luxury: cubic-bezier(0.16,1,0.3,1)` / `--ease-settle`; `motion-tokens.ts:14-19` mirrors — deliberate house values | all |
| Motion | staggered reveals 60–120ms | DONE | `reveal.tsx:16-23` `delay`/`stagger` props | all |
| Motion | page transitions 400–600ms cross-dissolve | SUPERSEDED | `page-transition.tsx:13-14` "bespoke 450ms … not one of Part 3.8's four durations" → `--dur-base` 350ms | all |
| Motion | `prefers-reduced-motion` global; nothing bounces | DONE | `tokens.css` global collapse; `redesign-audit.mjs` reduced-motion pass; `motion-reduce:` on every animation | all |
| Assets | All imagery from the Drive folder | PARTIAL | `docs/plan/drive-asset-map.json`, `scripts/lib/media-v3-drive.mjs` (Drive fallback, byte-identical); masters are Higgsfield renders committed under `public/media/v3` (CLAUDE.md Part 15); catalogue photos from supplier hosts | all |
| Assets | Folder shared "Anyone with the link" | N/A | owner action | — |
| Assets | No stock/AI placeholders | SUPERSEDED | REDESIGN.md §15.2 permits generated concept imagery except the maker; `conceptLabel` (`en.json:334,372`); maker slot recorded as a generation to replace (CLAUDE.md "Wired") | all |
| Assets | Ingest to Blob, content-addressed, checksum dedupe, `Media` registry, no Drive hotlink | DONE | `src/lib/media-ingest.ts:21-35` sha256; `media/upload-zone.tsx:88` dedupe; `storage.ts`; no runtime Drive URLs | all |
| Assets | AVIF/WebP, srcsets, lazy, muted loop ≤8MB + poster, LCP priority | DONE | AVIF masters; `hero-media.tsx:15-29,99` poster `priority`, muted loop; `public/media/hero-pour.mp4` 0.74MB, `v3/process-pour.mp4` 1.0MB | all |
| Assets | Alt on every asset; AA scrims | DONE | `a11y-audit.mjs` + `redesign-audit.mjs` alt rule and header ink ≥4.5:1 (CLAUDE.md Design QA) | all |
| Storefront 1 | Home (01) 3D/video hero + gold-vein reveal | PARTIAL | video hero with poster (`page-sections.ts:111` `pour`); `sf-hero-rise`; 3D + gold vein refused (rows above) | all |
| Storefront 1 | (02) manifesto on ivory | DONE | `page-sections.ts:123`; `sf-manifesto-brighten` | all |
| Storefront 1 | (03) Pieces bento/marquee | DONE | `:133` `pieces`, `:172` `collections` bento | all |
| Storefront 1 | (04) large-format feature with pinned parallax | PARTIAL | `:144` is a 4-up grid (`docs/plan/01 §3.3` "there is no carousel"); parallax on bespoke band; pin refused | LARGE |
| Storefront 1 | (05) material story macro split-screen | DONE | `:159` `material` → `PourCureShowcase` (`page.tsx:578`), the sanctioned pin | all |
| Storefront 1 | (06) collections rail, magnetic hover | PARTIAL | rail exists (`SnapRail` `page.tsx:897`); magnetic refused | all |
| Storefront 1 | (07) maker portrait | DONE (data caveat) | `:206` `maker`; §15.2 file is a generation the owner must replace | all |
| Storefront 1 | (08) recent work · (09) bespoke CTA · (10) workshops · (11) 3D-print · (12) process | DONE | `:235 work`, `:265 bespoke` (+HeroParallax), `:276 workshops`, `:286 print` (`page.tsx:1057-1076`), `:296 process` | all |
| Storefront 1 | (13) journal + newsletter | DONE | `:320 journal`; `newsletter-signup.tsx` in footer (`page.tsx:145` duplicate section removed) | all |
| Storefront 1 | numbered rail persists on left edge | DONE | `CureLine` ≥1024px, contract §12 | all |
| Storefront 2 | Filter drawer (collection, occasion, price band, availability), animated | DONE | `shop-explorer.tsx:548-591` Radix Dialog drawer `duration-(--dur-base)`; `shop.ts:48-92` all four facets | all |
| Storefront 2 | Type tabs Resin art/Gifts/Supplies/3D print | DONE | `shop/(index)/page.tsx:148-151`; `site-header.tsx:67-68` MEGA_GROUPS `?type=` | all |
| Storefront 2 | Spotlight cards hover zoom + Ask on WhatsApp | DONE | `catalog-product-card.tsx:158` (motion-reduce off), `:338` `CardAskWhatsApp` | all |
| Storefront 2 | Quick-view modal | DONE | `shop/quick-view.tsx`, `quick-view-trigger.tsx` | all |
| Storefront 2 | Wishlist hearts | DONE | `shop/wishlist-button.tsx`, `wishlist-panel.tsx`, `/shop/wishlist` | all |
| Storefront 2 | Infinite scroll or pagination; remove 24 cap | DONE | `shop.ts:494` `SHOP_PAGE_SIZE=24` is page size; numbered pager + `Load more` cursor (`:520-547`); `docs/plan/06 §2` cap never existed | all |
| Storefront 2 | Luxury template for art vs compact for supplies | DONE | `src/lib/card-meta.ts:45-56` `full \| compact \| collectible`; `shelfVariant` per grid | all (collectible = LARGE) |
| Storefront 3 | PDP before/after slider where relevant | PARTIAL | slider on category page + case studies, not in `product/gallery.tsx`; no data | MEDIUM |
| Storefront 3 | "price agreed on WhatsApp" note | DONE | `en.json:1393 artConfirm`, `:1396`, `:1430 priceOnWhatsApp` | all |
| Storefront 3 | 4-part customize form + live WhatsApp chat-bubble preview | DONE | `product/order-panel.tsx:126-140` "Preview your message ▾"; `customization-controls.tsx` | all |
| Storefront 3 | Specs table mono | DONE | `product/spec-sheet.tsx` (`page.tsx:22`) | all |
| Storefront 3 | Production/Delivery/Care accordions | DONE | `en.json:1342-1350,1403`; `page.tsx:261` empty headings not rendered | all |
| Storefront 3 | Testimonials strip | DONE | `product/product-testimonials.tsx` (`page.tsx:30,338`) | all |
| Storefront 3 | Related pieces carousel | DONE | `page.tsx:110,266` one rail of four, ±60% price | all |
| Storefront 4 | 4-step wizard with animated step transitions | DONE / SUPERSEDED (animation) | `sections/custom-order-form.tsx:98-119` "Step 2 of 4" mobile stepper + desktop scroll-spy; transitions are `--dur-fast` colour only (`:530`) | MEDIUM |
| Storefront 4 | Drag-drop reference upload with progress | DONE | `reference-image-uploader.tsx:163-168,44,275` real progress hairline | MEDIUM |
| Storefront 4 | Live WhatsApp preview | DONE | `custom-order-form.tsx:208-212` `previewMessage = buildOrderMessage` | MEDIUM |
| Storefront 4 | Completion resin-pour micro-animation | NOT DONE (by design) | form saves Inquiry then redirects `/whatsapp-order?i=…` → wa.me (`:427`); no completion screen; Part 14 rejects decorative motion | MEDIUM |
| Storefront 5 | Large-format dark cinematic landing | DONE | `/large-resin-art` HeroMedia, CureLine, Reveal, TestimonialWall | LARGE |
| Storefront 5 | 3D slab viewer | SUPERSEDED | see threeui row | LARGE |
| Storefront 5 | Scale diagrams | NOT DONE | page has "shapes a brief takes" k1–k4 (`:61-73`) and prose "made to your room"; no dimension/scale diagram | LARGE |
| Storefront 5 | Material library | DONE | `:75-82` MATERIAL_SLOTS | LARGE |
| Storefront 5 | Past-work horizontal pinned gallery | PARTIAL | `work` band is a `CatalogProductCard` grid; pin refused | LARGE |
| Storefront 5 | Brief-intake form | PARTIAL | `page-sections.ts:734` `brief` band = copy + CTA to `/custom-order`; no in-page form | LARGE |
| Storefront 6 | Portfolio masonry + category filters | DONE | `portfolio/(index)/page.tsx:124-153,28,331` | all |
| Storefront 6 | Case pages: story, spec table, process parallax | PARTIAL | `portfolio/[slug]/page.tsx:268-282` story cols 1–7 + sticky mono spec rail 9–12, `LightboxGallery`, `BeforeAfter`; no parallax (contract §8) | all |
| Storefront 7 | About/Process/Workshops/Journal/Contact/FAQ unified | DONE | all routes present; `page-sections.ts` manifests (about `:350-428`, process `:445-486`, contact `:783-813`, workshops `:832-858`) | all |
| Storefront 7 | FAQ 25+ entries, search, JSON-LD | PARTIAL | `faq/page.tsx:93-105` FAQPage JSON-LD; `faq-explorer.tsx:35-38` client search; seed carries 7 (`prisma/seed.ts:117`) — count is owner content via `/studio/faqs` | all |
| Storefront 7 | Contact: 4 channels + frosted-glass form | PARTIAL | `contact/page.tsx:50-105` PHONE·WHATSAPP·EMAIL·STUDIO + `ContactForm`; frosted glass refused (contract §5) | all |
| Storefront 8 | Announcement bar rotating lead-times/WhatsApp | DONE | `announcement-bar.tsx:16-42` ≤3 messages, 6s crossfade, pause; `schema.prisma:595-620` | all |
| Storefront 8 | Mega-menu with imagery | DONE | `site-header.tsx:55-98` hover-intent panel, three server-resolved tile pictures | all |
| Storefront 8 | Full-screen search overlay, keyboard nav | DONE | `search-overlay.tsx:194-211` ⌘K + `/`, `:370`, `:851`; `keyboard-audit.mjs` in CI | all |
| Storefront 8 | Locale switcher WITH CONSENT, never forced geo-redirect | PARTIAL | `layout/locale-switcher.tsx` exists; `src/i18n/routing.ts:23` `localeDetection: true` redirects first visit by Accept-Language (not geo) and remembers `NEXT_LOCALE`; `docs/plan/06 §2` lists "consent-based switcher (W3)" as open | all |
| Storefront 8 | Floating WhatsApp bubble | DONE | `storefront/whatsapp-fab.tsx` | all |
| Storefront 8 | Mega-footer | DONE | `footer.tsx` (`nav-menus.ts:83-92` four menus, socials, address as text `:76`) | all |
| Studio | Dark ops-console, gold accents | SUPERSEDED | `globals.css:190-203`; contract §2 champagne never a fill; `sapphire-ink` lifted for Studio dark (CLAUDE.md) | all |
| Studio | Collapsible sidebar with 9 groups (…Merchandising, Operations, System) | PARTIAL | `sidebar.tsx:64-168` six groups (today · catalogue · site content · editorial · research · settings); collapse + mobile nav (`(dashboard)/layout.tsx:12-13,57`); no Merchandising/Operations/System | all |
| Studio | ⌘K command palette | DONE | `studio/command-palette.tsx` in `(dashboard)/layout.tsx` | all |
| Studio | Breadcrumb bar · user/role menu | DONE | `studio/breadcrumbs.tsx`; `topbar.tsx:9-17,124` | all |
| Studio | Dashboard KPI, activity, workflow-run health, inquiry pipeline | PARTIAL | `(dashboard)/page.tsx` StatCard, ActivityPanel, InquiriesChart, `:97-150` pipeline; scrape health lives on `/studio/scraper` (`scraper-kpis.tsx`) not the dashboard | all |
| Studio | Products table virtualized, URL filters, saved views, bulk | PARTIAL | `products/product-list.tsx` searchParams, bulk (category/sizeTier), `:111` saved views; NOT virtualized | all |
| Studio | Categories/collections/materials managers | DONE | `/studio/categories`, `/studio/materials`; `sidebar.tsx:50-52` "Collections is Categories" | all |
| Studio | Media library dedupe indicators | PARTIAL | `media-detail-drawer.tsx:251-275` checksum; dedupe at ingest; no duplicate badge in the grid | all |
| Studio | Source cards with health/freshness | DONE | `scraper/source-list.tsx:56-78` `SourceHealth` | all |
| Studio | Scrape control per-source policy | DONE | `scraper/source-policy.tsx`; `policy.ts` fails closed | all |
| Studio | Runs feed live progress + stage timeline | DONE | `job-dashboard.tsx:362`; `stage-rail.tsx`; `/studio/scraper/runs` | all |
| Studio | Review queue image-first approve/reject/shortlist | DONE | `shortlist-inbox.tsx:144,574,905` (2/3/4-col image grid), APPROVE/REJECT/SHORTLIST | all |
| Studio | Explorer with full resin-attribute filter set | PARTIAL | `scraper/explorer/page.tsx:33-101` chips for league/source/state/priceBasis/text; materials/wood/pigment/dimensions are columns, not filters | all |
| Studio | Similarity search with explanation chips | PARTIAL | `scraper/large-format/page.tsx:151` similarity % only; `embedding-query.ts`; no per-attribute chips | LARGE |
| Studio | Opportunities board with score breakdowns | DONE | `scraper/analytics/page.tsx` + `lib/scraper/opportunity.ts` COMPONENTS/WEIGHTS (B8) | all |
| Studio | Export Center: builder, dry-run, download or email, history | PARTIAL | `exports/page.tsx:53-76` fixed downloads (confirmed CSV/XLSX, subscribers CSV, scraper CSV); no builder, dry-run, email or history | all |
| Studio | No Google Sheets UI anywhere | DONE | CLAUDE.md workstream C complete; only `import/page.tsx:13` (paste a public sheet URL — never the owner's Sheet) | all |
| Studio | Content/CMS: pages, journal, portfolio, FAQs, testimonials, nav, SEO | DONE | routes `/studio/pages, blog, portfolio, faqs, testimonials, navigation, seo` (+site-copy, site-images, sections, forms) | all |
| Studio | Users & roles admin/merchandiser/viewer | SUPERSEDED | `schema.prisma:14-17` `Role { ADMIN EDITOR }`; §1.1 auth off-limits; `/studio/users`; `sidebar.tsx:43-44` adminOnly | all |
| Studio | Settings, flags, audit log, docs viewer | PARTIAL | `/studio/settings`, `/studio/activity`; no feature flags, no documentation viewer (grep) | all |
| Studio | Skeletons, empty states WITH ILLUSTRATION, error retry | PARTIAL / SUPERSEDED | 19 studio `loading.tsx`, `studio/error.tsx` ×2, `studio/skeleton.tsx`; storefront `empty-state.tsx`/`error-state.tsx`; contract §9 forbids illustrations | all |
| Studio | Every mutation audit-logged and toasted | DONE | 135 `activityLog.create`/`logActivity` writers; sonner | all |
| Engineering | Next 16, RSC, TS strict, Tailwind tokens, no ad-hoc hex, shadcn | DONE | `tsconfig.json:7`; 2 hex hits in components/app are comments (`button.tsx:26`, `layout.tsx:155`); `components/ui` | all |
| Engineering | Lighthouse ≥90, LCP <2.0s, zero CLS | PARTIAL | `scripts/lighthouse-audit.mjs:31-32` PERF_MIN 85, A11Y_MIN 95 on home/PLP/PDP; no LCP/CLS numeric budget | all |
| Engineering | 3D lazy-hydrated with poster | DONE | `product/model-viewer.tsx:44-76,117` | all |
| Engineering | WCAG 2.2 AA, GOLD focus rings, keyboard, aria | DONE (ring superseded) | `tokens.css:90` `--focus: var(--sapphire)`, `:292` champagne inside dark bands; a11y + keyboard audits in CI | all |
| Engineering | Per-route metadata, JSON-LD Product/FAQ/LocalBusiness, hreflang sitemap, canonicals | DONE | `@type` Product ×4, FAQPage (`faq/page.tsx:95`), LocalBusiness; `sitemap.ts:54-57`; `i18n/seo.ts:14-21` | all |
| Engineering | 9 locales, consent switcher, graceful fallback | PARTIAL | 9 locales; `localize.ts:8-31` fallback; consent → see locale row | all |
| Engineering | Fonts via `next/font`, no runtime googleapis | DONE | `src/app/fonts.ts:1` `next/font/google`; 0 `fonts.googleapis` in src | all |
| Engineering | No third-party hot-linked assets | PARTIAL | editorial imagery bundled/Blob; catalogue products still render supplier-CDN `<img>` (`docs/plan/06 §7`, `src/lib/image-src.ts`); `next.config.ts:55` `img-src https:` | all |
| Engineering | No broken/placeholder imagery | DONE | `site-images.test.ts` on-disk fallbacks; `redesign-audit` `naturalWidth===0` rule | all |
| Engineering | shadcn storefront / daisyui Studio boundary | SUPERSEDED | no daisyui; shadcn on both | all |
| Engineering | Responsive 360/768/1440/1920 | PARTIAL | CI sweeps 1440·1280·390·360 (`ci.yml:216-231`); 768 and 1920 not gated | all |
| Engineering | Dark-first with ivory alternation | SUPERSEDED | contract §2 light ground, ≤3 dark bands never adjacent (`describeArrangementProblem` enforces at Publish) | all |
| Engineering | Storybook-style component states | PARTIAL | no Storybook; `src/app/design-lab/page.tsx` is the in-repo state gallery | all |
| Engineering | a11y/perf checks in CI | DONE | `ci.yml:246-301` | all |
| How to use | staging process | N/A | process guidance | — |

## Document 2 — `RIVYA-WORLD-CLASS-UI-PROMPT.md`

| Doc § | Requirement (short) | Status | Evidence | Note |
|---|---|---|---|---|
| Role | No theme packs, no second app | DONE | no daisyui/magicui in `package.json`; single tree | all |
| Objective | Repo `github.com/…/RivyaLivingArt` | N/A | wrong repo (`docs/plan/06 §1`); canonical is `RivyaLivingArt2.0` | — |
| Objective | Working routes, tokens, components, motion, empty states | DONE | this tree | all |
| Product truth | Persisted inquiry BEFORE WhatsApp | DONE | `order-panel.tsx` `submitProductOrder`; `custom-order-form.tsx:427`; e2e-smoke asserts wa.me | all |
| Product truth | Content priority large→…→gifts; home not a gift shop | PARTIAL | `page-sections.ts` home: pour, manifesto, pieces, large-format (4th), material, collections, furniture OFF, maker, rooms OFF, work…; `docs/plan/07` T8 homepage band is an open owner question | LARGE |
| Product truth | No cart/checkout/account/payment | DONE | CLAUDE.md HARD RULES; contract §1 | all |
| Hard constraints | `--rv-*` tokens, Supabase, Cloudinary, custom Studio | N/A | 0 `--rv-` in `tokens.css`; Prisma + Postgres; Blob uploads (Cloudinary is a `remotePattern` only, `next.config.ts:160`) | — |
| Hard constraints | No Sanity/Shopify/second design system | DONE | — | all |
| Hard constraints | Keep slugs `/collection`, `/large-format`, `/custom-commissions`, `/journal` | N/A | routes here are `/shop`, `/large-resin-art`, `/custom-order`, `/blog`, `/search`; §1.1 forbids URL changes | — |
| Hard constraints | Public copy in CMS; no hardcoded claims/lead times/contact | DONE | `site-copy.generated.ts` 1,297 slots; `SiteSettings.announcement/whatsappNumber` (`schema.prisma:595`, `settings-form.tsx:529`); `footer.tsx:94-96` settings override constants | all |
| Hard constraints | Higgsfield assets are concept media; label; galleries honestly empty | PARTIAL | `conceptLabel` on home + large-format (`en.json:334,372`); product galleries carry supplier imagery by this repo's owner-approved import model (CLAUDE.md HARD RULES) | all |
| Hard constraints | Media only from pipeline + Drive; no Drive hotlink | DONE | `drive-asset-map.json`; `media-v3-drive.mjs`; no runtime Drive URLs | all |
| Hard constraints | Sheets retired; CSV/PDF export in Studio | PARTIAL | CSV/XLSX at `/studio/exports`; no PDF (`inquiries/[id]/card` is a print view only) | all |
| Hard constraints | Research data never public; confirming ≠ creating a product | PARTIAL / SUPERSEDED | 0 `scrapedProduct` reads under `(v2)`/storefront; but the owner-approved promote path DOES create a `Product` by design (CLAUDE.md "Staged rows are immutable") | all |
| Hard constraints | Preserve RLS, owner flags, `npm run check` | PARTIAL / N/A | no RLS (Prisma); inquiry persistence DONE; `motion-budget.mjs`; no `check` script — CI runs typecheck·lint·test | all |
| Hard constraints | Don't disable tests/lint | DONE | `ci.yml` gates everything | all |
| Visual | Tokens obsidian `#080A0E` · ocean · sapphire `#164E6B` · champagne `#B89B63` · ivory/bone | DONE | `tokens.css` (`docs/plan/06 §3` cites the identical values) | all |
| Visual | Display serif (documented Instrument Serif switch), Inter | DONE | `fonts.ts:1`; REDESIGN.md Part 3 | all |
| Visual | Labels small tracking champagne/stone, no uppercase paragraphs | DONE | `.u-micro` `globals.css:332-335`; contract §3 | all |
| Visual | Viewport-filling resin/timber; alternate obsidian and ivory | DONE | `HeroMedia`; contract §2 band rhythm enforced at save | all |
| Visual | Asymmetry, oversized crops, furniture at room scale | PARTIAL | bento lead 8/12; `furniture` and `rooms` bands ship `defaultVisible: false` (`page-sections.ts:193,224`) | LARGE |
| Visual | Ken-Burns heroes, blur-fade galleries, Studio tab ink, reduced motion | DONE / SUPERSEDED | `sf-hero-drift` (`globals.css:489-492`); galleries use `MeniscusImage` not blur-fade (contract §12); `ui/tabs.tsx:84`; reduced-motion gated | all |
| Visual | Gold is a rim, not a theme | DONE | contract §2 champagne never a fill, max two per viewport | all |
| Header | Wordmark, ≤4 destinations, icon search, one commission CTA | DONE (CTA wording) | `constants.ts` NAV_LINKS shop/bespoke/studio/journal; `site-header.tsx:499-503` search, `:521` `startOnWhatsApp` CTA; `docs/plan/07` T2 tables the four items | all |
| Header | Remaining destinations in drawer + footer | DONE | `site-header.tsx:615-753`; `nav-menus.ts` header-secondary/footer-* | all |
| Header | Search is a 44px trigger to `/search`, not a 26px field | DONE | header icon button opens `SearchOverlay` (`search-signal.ts`); `/search` route exists; 44px floor gated by `redesign-audit` at 390/360 (`ci.yml:230-231`) | all |
| Footer | Quiet, CMS-driven contact, no invented phone | DONE | `footer.tsx:34,76-96` settings-fed | all |
| Studio | Sidebar groups Today, Catalog, Content, Media, Inquiries, Research, Operations | PARTIAL | `sidebar.tsx:64-153` today · catalogue · site content · editorial · research · settings; Media/Inquiries nested; no Operations | all |
| Studio | Bone sheets, hairline rules, sapphire focus rings, sparse status colour | DONE | `globals.css:190-201` `--bg: mineral`, `--border: hairline`, `--focus: sapphire`; `--success` (`layout.tsx:155`) | all |
| Studio | Research boards cinematic (large still, attributes, provenance) | DONE | `shortlist-inbox.tsx:144,574,604` image + `<dl>`; source provenance | all |
| Studio | Tables, filters in URL, count in header, empty states with next action | DONE | `product-list.tsx` searchParams, `:908 total`; 33 Studio components carry empty copy | all |
| Studio | Raw and normalized side by side; missing data never 0 | DONE | `explorer/page.tsx:53-55,217` "Price — raw → normalized"; `price-basis.ts` QUOTE_ONLY = NULL (B3a) | all |
| Studio | Role-aware nav server-enforced | DONE | `requireStaffPage`; `sidebar.tsx:43-44,106,112,159` | all |
| Component sources | `docs/design/COMPONENT_REGISTRY.md` per adoption | NOT DONE | file absent; `docs/plan/06 §4` adopts the idea; nothing has been adopted from a kit, so it would be empty | all |
| Component sources | Review all, adopt few, no catalogue installs | DONE | none installed | all |
| Component sources | First-party primitives; one motion lib per page; no second icon set | DONE | GSAP + Lenis (page transition is CSS `tw-animate-css`); lucide only (0 other sets); `next-view-transitions` in `[locale]/layout.tsx` + `morph-link.tsx` is one small extra runtime | all |
| Pages · Public | Home … search, privacy, terms, not-found | DONE | all 21 `(v2)` routes + `src/app/[locale]/not-found.tsx` (+ workshops, whatsapp-order, wishlist, `/p` landers) | all |
| Pages · Public | First screen states scale (furniture in a room) | PARTIAL | `site-images.ts:80-85` `home.hero` fallback `hero-pour.avif` is a pour; `/large-resin-art` hero is at scale | LARGE |
| Pages · Public | CMS-bound media with concept labelling | DONE | 78 slots + `conceptLabel` | all |
| Pages · Public | Honest empty state when unpublished | DONE | `storefront/empty-state.tsx` conditional (contract §9); `portfolio/(index)/page.tsx:308` | all |
| Pages · Public | Conversion saves before WhatsApp | DONE | see Product truth | all |
| Pages · Public | Responsive 390/768/1024/1280/1440/1920 | PARTIAL | CI: 1440·1280·390·360; 768/1024/1920 unswept | all |
| Pages · Public | No invented price/stock/lead-time/"20 commissions" | DONE | `en.json:126` `"{count} commissions documented"` is computed; announcement from `SiteSettings`; workshop facts (`en.json:640-646`) are owner-editable copy slots | all |
| Pages · Studio | Login, overview, products, categories, collections, materials, forms, pages+homepage, journal, portfolio, navigation, footer, SEO, FAQs editable, media, inquiries | DONE | route list; sections board edits the homepage; footer = `nav-menus.ts:83-92`; `/studio/faqs` | all |
| Pages · Studio | Media library + Higgsfield | PARTIAL | library DONE; Higgsfield runs via manifest scripts, no Studio screen (0 hits in `src/app/studio`); credits exhausted (CLAUDE.md Part 15) | all |
| Pages · Studio | Research dashboard, sources, scrape control, explorer, compare, opportunities, similarity, shortlist, confirmed, quality, runs | PARTIAL | all exist except a dedicated "compare" screen (`leagues.ts` benchmarks only); similarity is a % on `/scraper/large-format` | all |
| Pages · Studio | Settings blocked until WhatsApp env-vs-DB decided | DONE (decided) | `SiteSettings.whatsappNumber` in DB (`settings-form.tsx:123,529`; `whatsapp.ts` constant fallback) | all |
| Method | Read `CONTEXT.md`, `PROJECT_STATE.md`, `docs/SESSION-STATE.md`, `docs/design/*`, `docs/studio/*`, `docs/architecture/*` | N/A | only CLAUDE.md, CONTEXT.md (archived), PROJECT_STATE.md exist; rest are the older repo's | — |
| Method | Tokens at `app/styles/tokens.css` | N/A (path) | `src/styles/tokens.css` | — |
| Method | Bind media through `MediaSlot`/Cloudinary | SUPERSEDED | `site-images.ts` slots + `getSiteImages()` | all |
| Method | Keep filters as GET forms | DONE | `shop-explorer.tsx:436` `<form>`; `shop.ts` URL params | all |
| Method | Measure islands and LCP | DONE | `motion-budget.mjs`; `lighthouse-audit.mjs:124` prints LCP | all |
| Method | Record external component decisions | NOT DONE | see registry row | all |
| Method | No secrets; no competitor domains in repo | PARTIAL | 19 supplier hosts in `src/lib/scraper/seed-data.ts`; `docs/plan/06 §4` flags as an owner decision | all |
| Quality bar | Commissioned look, keyboard/SR/contrast, reduced motion, empty/error, inquiry persists, concept labelled, checks pass | DONE (1920 unswept) | redesign/a11y/keyboard/e2e audits in CI | all |
| Non-goals | No Sheets, no accounts, no scraper rebuild here | N/A | respected; scraper rebuilt separately as workstream B | — |
| Output | Feature branch, docs updated, owner-gated list | DONE | `docs/plan/README.md`; `docs/plan/07` T1–T11; CLAUDE.md "what remains stops at an owner question" | all |

## Summary

1. **Document 1 (138 items):** DONE 79 · PARTIAL 29 · SUPERSEDED/REFUSED BY CONTRACT 24 · NOT DONE 3 · N/A 3.
2. **Document 2 (56 items):** DONE 36 · PARTIAL 12 · NOT DONE 2 · N/A 5 · SUPERSEDED 1.
3. Every SUPERSEDED row traces to one of: the palette ruling (`docs/plan/06 §3`), contract §5/§8 (no blur, no glow, no lift, no extra pins), D18 (cursor/magnetic/split-text deleted), the 45 KB motion budget, or §1.1 (roles, URLs). None is a gap to build.
4. **Top NOT DONE / PARTIAL #1 — consent-based locale switcher.** `src/i18n/routing.ts:23` still `localeDetection: true` (Accept-Language redirect, not geo); both briefs ask for consent and `docs/plan/06 §2` filed it as W3. Small, storefront-wide, all tiers.
5. **#2 — Export Center is fixed downloads only** (`exports/page.tsx:53-76`): no entity/column builder, no dry-run preview, no email delivery, no run history, no PDF. Both briefs describe a builder.
6. **#3 — the room-scale / large-format story is owner-gated, not built:** home `furniture` and `rooms` bands ship OFF (`page-sections.ts:193,224`), `home.hero` is a pour macro (`site-images.ts:85`), the large-format page has no scale diagram or in-page brief form. All LARGE tier, all sitting on `docs/plan/07` T8/T2 owner questions.
7. **#4 — catalogue photography is still hot-linked from supplier CDNs** (`docs/plan/06 §7`; `next.config.ts:55` `img-src https:`), contradicting both briefs' "no third-party assets"; the mirror cron exists but coverage is unmeasured.
8. **#5 — two documentation/hygiene items:** `docs/design/COMPONENT_REGISTRY.md` does not exist (empty by construction, but the rule is unrecorded), and 19 supplier domains sit in `src/lib/scraper/seed-data.ts` against doc 2's "no competitor domains in the repo" — an owner decision `docs/plan/06 §4` already flagged.
9. Secondary gaps: explorer lacks resin-attribute FILTERS (columns only) and similarity shows a bare % with no explanation chips (Studio research); Lighthouse perf floor is 85 not 90 (`lighthouse-audit.mjs:31`); CI does not sweep 768/1024/1920; products table is not virtualized; no feature flags or docs viewer in the Studio.
10. Everything else the briefs name as a page, route, chrome piece, CMS surface, research board, JSON-LD type, font, state or a11y gate is present and cited above; no file was changed during this audit.
