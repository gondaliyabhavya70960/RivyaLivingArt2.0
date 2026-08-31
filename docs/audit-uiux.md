# ResinRiva Public Site — UI/UX Findings Report (ui-ux-pro-max)

**Scope & method.** Five public pages (home `/`, `/shop`, `/product/[slug]` — primarily `boho-night-lights`, `/custom-order`, `/contact`) were reviewed at two viewports (1440×900 desktop, 390×844 mobile / iPhone-13 touch emulation) against the ui-ux-pro-max rule database (touch targets, WCAG contrast, forms, focus management, fixed-element offsets, etc.). All measurements were taken live with Playwright — `getBoundingClientRect`, computed styles, alpha-blended WCAG contrast math, real keyboard Tab sequences, `(hover:none)/(pointer:coarse)` emulation, and pixel-level screenshot comparison. Every finding was then adversarially re-verified in a second pass: all 37 findings below reproduced and carry **Status: CONFIRMED**. One severity was adjusted during verification (UIUX-P25, Major→Minor: WCAG 2.2 SC 2.5.8's spacing exception passes, leaving a best-practice rather than normative failure); two evidence details were corrected without affecting verdicts (noted inline in P08 and P22).

## Summary

| ID | Severity | Pages | Finding |
|----|----------|-------|---------|
| UIUX-P01 | Critical | shop, product, contact | Brand sapphire #0F52BA as text fails AA (2.60–2.77:1) on prices, links, buttons site-wide |
| UIUX-P02 | Critical | shop | Quick-view action buttons collapse to 20–22px tall on mobile (`flex-1` in a column layout) |
| UIUX-P03 | Critical | shop, product | Shared dialog close button is a 16×16px hit area; lightbox arrows 42×42px |
| UIUX-P04 | Critical | product, custom-order | Reference-image uploader is an invisible keyboard stop — sr-only input focused, zero visible indication |
| UIUX-P05 | Critical | custom-order | Failed submit moves neither focus nor scroll; first error sits 881px above the viewport |
| UIUX-P06 | Critical | product | Thumbnail rail forces a 540px grid on a 390px viewport — 170px horizontal page scroll crops the form |
| UIUX-P07 | Major | all pages | Fixed header controls all under 44px: hamburger/close 40×40, menu links 39px, announcement link 19.5px |
| UIUX-P08 | Major | home, contact (shared footer) | Footer targets cluster under 44px: 36px social icon, 36px Notify me, 17px nav links, 16px legal links |
| UIUX-P09 | Major | contact | Primary tel: and Google Maps links only 24px tall on mobile |
| UIUX-P10 | Major | product | Sticky "Customize" CTA (111×36) and share buttons (36px) below touch minimum |
| UIUX-P11 | Major | shop | 36×36px quick-view trigger always tappable on touch, sitting on the card link — misses navigate |
| UIUX-P12 | Major | shop, custom-order | Select triggers 40px, dropdown options 32px — under 44px and inconsistent with 44px inputs |
| UIUX-P13 | Major | product, custom-order | Uploader image-remove button is a 24×24px touch target |
| UIUX-P14 | Major | custom-order | Fixed WhatsApp FAB overlaps the design-idea textarea corner (56×56 intersection) on mobile |
| UIUX-P15 | Major | home | Hero trust chips 4.32:1 and "scroll" hint 3.65:1 — below AA over a photographic backdrop |
| UIUX-P16 | Major | product | Focus ring on the gallery zoom button fully clipped by parent `overflow-hidden` — invisible |
| UIUX-P17 | Major | product | Closing the lightbox drops focus to `<body>` instead of returning to the trigger |
| UIUX-P18 | Major | shop | Filter/sort/search updates never announced — zero live regions on the page |
| UIUX-P19 | Major | custom-order | Field errors not associated with inputs and never announced (`aria-invalid` with no reason) |
| UIUX-P20 | Major | custom-order | Required fields carry no programmatic required indicator — asterisk is aria-hidden |
| UIUX-P21 | Major | product | Sticky mobile CTA bar reserves no space — permanently covers "Place order" and the legal links |
| UIUX-P22 | Major | custom-order | Translucent fixed header lets scrolled form content collide with top-bar text; errored fields hide under it |
| UIUX-P23 | Major | custom-order | "How commissions work" 3-step explainer completely absent on mobile (`hidden lg:block`) |
| UIUX-P24 | Major | home | Instagram section degrades to a dead end — 383px section with one unactionable sentence |
| UIUX-P25 | Minor | shop, product | Breadcrumb links 15–20px tall (adjusted Major→Minor: SC 2.5.8 spacing exception passes) |
| UIUX-P26 | Minor | shop | Heading hierarchy skips H1→H3 with no H2 anywhere on the page |
| UIUX-P27 | Minor | contact | All 7 external links open new tabs with no indication to AT users |
| UIUX-P28 | Minor | custom-order | Validation runs only on submit; corrected fields keep stale red errors |
| UIUX-P29 | Minor | contact | Contact form validates on submit only — no per-field blur feedback |
| UIUX-P30 | Minor | home | Newsletter email field has no visible label (placeholder + aria-label only) |
| UIUX-P31 | Minor | shop | Search field is plain `type=text` — no Search key or native clear on mobile keyboards |
| UIUX-P32 | Minor | product | Order-summary footnote is 11px at 50% opacity — sole sub-12px text on the page |
| UIUX-P33 | Minor | contact | Email address `break-all` splits mid-token ("gmail.c / om") on mobile |
| UIUX-P34 | Minor | home | Collections rail is scroll-gesture-only on desktop — 2540px of cards, no prev/next controls |
| UIUX-P35 | Polish | custom-order, contact | Character counters are visual-only; near-limit state is color-only; maxLength truncates silently |
| UIUX-P36 | Polish | home | "How it works" numerals 01–04 render at 1.08:1 — invisible visually yet announced by screen readers |
| UIUX-P37 | Polish | contact | Announcement copy renders twice in the first viewport (fixed bar + hero pill) |

---

## Critical

#### [UIUX-P01] Brand sapphire #0F52BA used as text fails WCAG AA everywhere it appears on the dark surfaces
- **Severity:** Critical
- **Effort:** M
- **Pages:** shop, product, contact (both viewports)
- **Observation:** Every text use of the brand sapphire measures 2.60–2.77:1. Shop: `article.group p.text-sapphire` "Customize" rgb(15,82,186) on rgb(10,10,10) at 14px/500 = **2.77:1** (near-illegible in shop-desktop.png); `globals.css:84` even documents "sapphire #0f52ba only reaches ~2.8:1" on the dark canvas. Product: the price `p.font-display.text-3xl` "₹30" = **2.77:1** at 36px/30px — fails even the 3:1 large-text threshold — and the live-order-summary "₹30" at 14px/500 on the LiquidGlass background composited to rgb(11,17,28) = **2.64:1**. Contact: "Open in Google Maps" (`contact/page.tsx:196`) = **2.64:1** at 16px/400; the "All questions" outline Button (`button.tsx` outline variant `text-sapphire`) = **2.60:1** at 14px/500 on rgb(16,19,25); `hover:text-sapphire` on the tel/mailto links drops contrast from ~9.07:1 to 2.64:1 on hover. **Verifier proof:** every cited element re-measured on both viewports; all ratios reproduce exactly, including the hover-state drop (default is 0.7-alpha near-white, ~9:1 composited). The comparison claim also holds: the eyebrow's lighter azure rgb(59,130,246) measures **4.75–5.38:1** on the same backgrounds — an in-palette fix already exists.
- **Impact:** Prices, links, and buttons — conversion-bearing text — are illegible to low-vision users and hard to read for everyone, on three of the five pages. This is a site-wide AA text failure rooted in one token decision.
- **Recommendation:** Reserve #0F52BA for fills/borders. For text on dark surfaces, use the existing light interactive blue — `--ring` #5b9dff or the eyebrow azure rgb(59,130,246) (measured ≥4.75:1 here) — in `product-card.tsx`'s Customize label/arrow, both price elements, the contact maps link, the Button outline variant's dark-surface text color, and link hover states.
- **Status:** CONFIRMED

#### [UIUX-P02] Quick-view dialog action buttons collapse to 20–22px tall on mobile
- **Severity:** Critical
- **Effort:** S
- **Pages:** shop (mobile)
- **Observation:** In `src/components/shop/quick-view.tsx` the button wrapper is `div.flex.flex-col.gap-3.sm:flex-row`; inside the stacked column, `flex-1` (flex-basis:0%) overrides `h-11`. At 390×844: "View & customize" `<a>` = **308×20px** (computed height 20px, flexBasis 0%) and "Ask on WhatsApp" = **308×22px**; the whole button row is 54px tall (squished pills visible in shop-mobile-quickview2.png). **Verifier proof:** reproduced under iPhone-13 touch emulation (the trigger only becomes tappable under `@media(hover:none)`); desktop re-measure shows the same elements at 198.6×44 / 201.4×44 in `sm:flex-row`, confirming the collapse is mobile-only and that `flex-1`'s flex-basis:0 in the column layout is the mechanism.
- **Impact:** The dialog's two primary actions — including the path to the product page — are less than half the 44px minimum on exactly the devices where the quick-view trigger is always visible.
- **Recommendation:** Change the Button className from `flex-1` to `w-full sm:flex-1` (or add `min-h-11`) so flex-basis:0 only applies in the horizontal sm+ layout; buttons then keep their 44px height on mobile.
- **Status:** CONFIRMED

#### [UIUX-P03] Shared dialog close button has a 16×16px hit area — the only visible dismiss control for quick-view and the gallery lightbox
- **Severity:** Critical
- **Effort:** S
- **Pages:** shop, product (both viewports)
- **Observation:** `button[aria-label="Close"]` inside `[role="dialog"]` measures **16.0×16.0px** on both viewports — in the /shop quick-view and in the product lightbox (product-mobile-lightbox.png). `dialog.tsx:72-79` renders `DialogPrimitive.Close` with only `rounded-xs`, a size-4 (16px) svg, and **zero padding**. The lightbox prev/next arrows measure **42×42px**. **Verifier proof:** close button re-measured at 16.0×16.0px in the quick-view on mobile (x:341,y:152) and desktop (x:906,y:162 — exactly matching the original evidence) and in the lightbox on both viewports; arrows 42×42 on both. The Critical rating rests on the 16×16 close button, which is the only *visible* dismiss control (Esc/overlay-tap work but are undiscoverable); the arrows are a 2px near-miss.
- **Impact:** Dismissing either overlay by touch requires hitting a target one third of the 44px minimum; users get stuck or mis-tap the overlay/photo.
- **Recommendation:** Give the shared close button a real hit area in `dialog.tsx`, e.g. `flex size-11 items-center justify-center` (or p-3 with -m-3 offset) while keeping the 16px icon — it already has aria-label/sr-only text — and bump the lightbox prev/next arrows to p-3 (⇒ 44–46px).
- **Status:** CONFIRMED

#### [UIUX-P04] Reference-image uploader is an invisible keyboard stop on both order forms
- **Severity:** Critical
- **Effort:** S
- **Pages:** product, custom-order (both viewports)
- **Observation:** The sr-only file input (`input#custom-order-reference-images`, rect **1×1px**, clip-path inset(50%)) receives Tab focus — between the Timeline select and Notes textarea on custom-order, and after "Show image 6 of 6" on the product page — while the visible dropzone label shows zero focus styling: outline `none 0px`, box-shadow `none`, border unchanged. **Verifier proof:** reproduced via real keyboard Tab on both pages; `activeElement===input`, `matches(':focus-visible')===true`, and the browser paints its 2px rgb(91,157,255) outline on the 1×1 clipped element — i.e. invisibly. The label's computed styles are byte-identical idle vs focused despite `label:focus-within` being true; source (`src/components/product/reference-uploader.tsx:102-129`) confirms no peer-focus-visible/focus-within styling exists. (The rest of the product form is otherwise solid: role=alert errors, aria-invalid + aria-describedby, auto-focus of `#order-name`.)
- **Impact:** A keyboard user tabbing through either order form hits a stop where nothing on screen indicates focus or that "Add reference images" is actionable — an invisible, inoperable-looking control mid-form.
- **Recommendation:** Mark the input `peer sr-only` and add focus styles to the dropzone label (`peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--ring)] peer-focus-visible:border-sapphire`), or use wrap-level `:focus-within` / `has-[:focus-visible]` ring-2 ring-ring so keyboard focus on the hidden input is visible.
- **Status:** CONFIRMED

#### [UIUX-P05] Failed custom-order submit moves neither focus nor scroll — errors render far off-screen
- **Severity:** Critical
- **Effort:** M
- **Pages:** custom-order (both viewports)
- **Observation:** Clicking "Send commission request" on an empty form: `document.activeElement` stays the submit BUTTON; scroll position is effectively unchanged (1794→1802 mobile). The first error "Paint us a picture — at least 10 characters…" renders at **top=-881px** (mobile) / **-587px** (desktop) — not visible; "Please tell us your name." at -21px (mobile); no error summary exists. **Verifier proof:** reproduced exactly at both viewports; the few scrolled pixels are layout growth from errors appearing, not corrective scrolling; first `aria-invalid` field `#custom-idea` sits at top=-1035px (mobile). The sole comfortably-visible mobile error ("Please enter a valid phone number.", top=89–109) overlaps the fixed header's box (bottom=100px mobile / 116px desktop) by 11px — the "sliced by the pill" phrasing is mildly overstated but immaterial. Critical is defensible for a primary conversion flow that gives no visible feedback on submit.
- **Impact:** A user who taps submit sees nothing happen — the form appears broken, and the actual reasons are two screens above them. This is the commission funnel's endpoint.
- **Recommendation:** On failed `validate()` in `custom-order-form.tsx` `handleSubmit`, `focus()` and `scrollIntoView()` the first aria-invalid field (accounting for the ~100px fixed header via `scroll-margin-top`), and/or render an error summary adjacent to the submit button linking to each field.
- **Status:** CONFIRMED

#### [UIUX-P06] Gallery thumbnail rail forces the product grid to 540px on a 390px viewport — 170px of horizontal page scroll
- **Severity:** Critical
- **Effort:** S
- **Pages:** product (mobile)
- **Observation:** At 390×844: `document.scrollingElement.scrollWidth=560` vs `innerWidth=390`. Culprit chain: the thumb rail `div.mt-4.flex.gap-3.overflow-x-auto` is **540px** wide (6 thumbs × 80px + 5 gaps × 12px) with clientWidth == scrollWidth == 540, so it never scrolls internally — the grid column stretches instead: gallery stage 540×540, `h1` w=540, Name/Phone/Email/Notes inputs all w=540 with right edge at x=560 (inputs visibly cut at the viewport edge in product-mobile-submit.png). **Verifier proof:** reproduced at a plain 390×844 viewport; all measurements match exactly. A scan of all 12 products confirms causation: every 6-thumb product (5 of them) overflows to 560, the 5-thumb product to 469, and ≤4-thumb products stay at 390 — overflow scales with thumb count. Desktop is fine (scrollWidth 1430 < 1440).
- **Impact:** On the primary conversion template, the price, gallery, and every order-form input are partially cropped off-screen and the whole page wobbles horizontally — for any product with 5+ images.
- **Recommendation:** In `src/app/(public)/product/[slug]/page.tsx` add `min-w-0` to both children of the `grid gap-12 lg:grid-cols-[1.1fr_1fr]` wrapper (or `max-w-full` on the ProductGallery root in `src/components/product/gallery.tsx`) so the overflow-x-auto rail scrolls inside its column instead of widening the page.
- **Status:** CONFIRMED

## Major

#### [UIUX-P07] Fixed header controls all miss the 44px minimum on mobile, on every page
- **Severity:** Major
- **Effort:** S
- **Pages:** home, shop, custom-order, contact (mobile)
- **Observation:** Measured at 390×844 on all four pages: `button[aria-label='Open menu']` (`dynamic-header.tsx:227`, class size-10) = **40×40px**; mobile-menu "Close menu" = **40×40px**; mobile nav links (Shop/Custom Order/Workshops/Portfolio/Process/Blog/About/Contact) all **39px** tall; the announcement-bar anchor "Made-to-order luxury resin art…" = **348×19.5px** inside the 36px-tall strip — the link doesn't stretch to fill the bar. All sit in the always-visible `position:fixed z-50` header. **Verifier proof:** every value reproduced on all four pages, including the open-menu state.
- **Impact:** The site's global navigation entry points are undersized on every page for touch users — the single most-used interactive cluster on mobile.
- **Recommendation:** Bump the hamburger/close buttons to size-11 (44px) — the design already uses size-11 as the shared Button icon size — set `min-h-11` on mobile-menu nav links, and make the announcement anchor fill the bar height (`flex h-full items-center` plus py-3) so the full strip is tappable.
- **Status:** CONFIRMED

#### [UIUX-P08] Shared footer interactive elements cluster under the 44px minimum
- **Severity:** Major
- **Effort:** S
- **Pages:** home, contact (shared footer, both viewports)
- **Observation:** WhatsApp social icon link = **36×36px** (size-9); "Notify me" newsletter button = **105×36px**; newsletter email input **40px** tall; footer nav links (Shop 34.2×17, Custom Order 92.7×17, Workshops 74.7×17, Portfolio 55.3×17, Blog 29.5×17) all **17px** tall at a **32px** row pitch; "Privacy Policy" 79.3×**16** and "Terms & Conditions" 110.6×**16**. **Verifier proof:** all values reproduced on home (390×844) and contact (both viewports). One evidence correction: Instagram is conditionally rendered (`footer.tsx:51-59`, only when a profile URL is set) and is absent on the live site — only the WhatsApp icon exists, at the claimed 36×36; verdict unaffected.
- **Impact:** Every interactive element in the sitewide footer — navigation, legal links, newsletter capture, and the social channel — is below the touch minimum, with 17px links on a 32px pitch inviting wrong-row taps.
- **Recommendation:** Use size-11 for the social icon, default size (h-11) for the "Notify me" button and email input, and add vertical padding (e.g. py-1.5 with -my-1.5, or min-h-11 rows) to footer nav and Privacy/Terms links to extend their hit areas.
- **Status:** CONFIRMED

#### [UIUX-P09] Contact page's primary actions — tel: link and Google Maps link — are only 24px tall on mobile
- **Severity:** Major
- **Effort:** S
- **Pages:** contact (mobile)
- **Observation:** At 390×844: `a[href^=tel]` "+91 7096036250" = **129.5×24px**; "Open in Google Maps" = **185.5×24px**. Both are bare inline text links inside p-6 LiquidGlass cards; only the text is tappable, not the card. **Verifier proof:** reproduced exactly (tel link display:block padding:0; maps link display:inline-flex padding:0); neither card is wrapped in an anchor (`cardWrappedInAnchor=false`), so only the 24px-tall text is tappable. Major is fair for primary contact actions in the touch category.
- **Impact:** The two actions the contact page exists for — calling and finding the studio — are hardest to hit on the device people call from.
- **Recommendation:** Add vertical padding (e.g. py-2.5 with negative margin, or `min-h-11 inline-flex items-center`) to the tel/maps anchors, or make the whole contact card the tap target like the WhatsApp card's 44px Button.
- **Status:** CONFIRMED

#### [UIUX-P10] Product page's sticky "Customize" CTA and share buttons are 36px tall on mobile
- **Severity:** Major
- **Effort:** S
- **Pages:** product (mobile)
- **Observation:** At 390×844: sticky-bar "Customize" button = **111×36px**; share "WhatsApp" = **134×36px**; "Copy link" = **126×36px**. **Verifier proof:** re-measured at 111.1×36, 133.8×36, and 126.2×36 — all 36px tall, matching the claimed values exactly.
- **Impact:** The always-visible mobile CTA — the button the whole sticky bar exists to surface — and the share actions are all under the 44px minimum on the conversion page.
- **Recommendation:** Use the default (h-11/44px) button size instead of `size="sm"` for the sticky CTA and the share row on mobile.
- **Status:** CONFIRMED

#### [UIUX-P11] 36×36px quick-view trigger is always tappable on touch and sits directly on the card link — misses navigate
- **Severity:** Major
- **Effort:** S
- **Pages:** shop (both viewports; consequence is touch-specific)
- **Observation:** `button[aria-label^="Quick view"]` = **36×36px** (class size-9) on all cards; under `(hover:none)` emulation the wrapper computes opacity=1 / pointer-events=auto (always shown on phones), with **0px gap** to the underlying full-card `<a>`. **Verifier proof:** reproduced; under touch emulation `document.elementFromPoint` 4px left and 4px below the button both resolve to the IMG inside the card's `<a href='/product/…'>` — a missed tap navigates away instead of opening the quick view.
- **Impact:** An undersized target where the miss penalty is a full page navigation — the worst-case failure mode for a small target.
- **Recommendation:** Increase the trigger to size-11 (44px), or keep the 36px visual circle and extend the hit area with padding/pseudo-element (e.g. `after:absolute after:-inset-1`).
- **Status:** CONFIRMED

#### [UIUX-P12] Select triggers are 40px and dropdown options 32px on touch devices — under minimum and inconsistent with the 44px inputs beside them
- **Severity:** Major
- **Effort:** S
- **Pages:** shop, custom-order (mobile; triggers also 40px on desktop)
- **Observation:** All `[data-slot="select-trigger"]` elements measure **h=40px** (`data-[size=default]:h-10` in `select.tsx`) — 340×40 at 390px on /custom-order where the adjacent Input fields are h-11/**44px**; opened listbox `[role="option"]` items measure **32px** tall (154×32 shop sort under iPhone-13 emulation; 332×32 custom-order, py-1.5 SelectItem). **Verifier proof:** re-measured — custom-order's 4 triggers 328×40 desktop / 340×40 mobile vs inputs `#custom-name/#custom-phone/#custom-email` at 44px, confirming the inconsistency; shop under touch emulation (`(hover:none)`=true, `(pointer:coarse)`=true) all 4 triggers h=40, options 297.9×32 with 6px vertical padding.
- **Impact:** Filtering the shop and completing the commission form require repeated taps on sub-minimum targets, and the 40px/44px mismatch reads as visual sloppiness in the form rows.
- **Recommendation:** Bump SelectTrigger default to h-11 (44px) to match inputs, and give SelectItem py-2.5/min-h-11 on coarse pointers (e.g. `pointer-coarse:min-h-11` or a mobile-specific size).
- **Status:** CONFIRMED

#### [UIUX-P13] Reference-uploader's image-remove button is a 24×24px touch target
- **Severity:** Major
- **Effort:** S
- **Pages:** product, custom-order (both viewports)
- **Observation:** `button[aria-label='Remove <file>.png']` (class size-6, `reference-uploader.tsx:153`) measures **24×24px**, positioned `-top-2 -right-2` over the 80×80 thumbnail on both forms. **Verifier proof:** re-measured after `setInputFiles` — 24×24px on /custom-order at both viewports and on the product page at 390×844; thumbnail 80×80; live class string contains `absolute -top-2 -right-2 flex size-6 … rounded-full`.
- **Impact:** Removing a wrongly-attached photo is a fiddly sub-half-minimum tap; a miss hits the thumbnail instead.
- **Recommendation:** Increase to min 44×44 (e.g. size-11 with a smaller visual glyph) or extend the hit area with padding/pseudo-element (`before:absolute before:-inset-2`) while keeping the 24px visual.
- **Status:** CONFIRMED

#### [UIUX-P14] Fixed WhatsApp FAB overlaps the design-idea textarea corner on mobile custom-order
- **Severity:** Major
- **Effort:** S
- **Pages:** custom-order (mobile)
- **Observation:** The FAB `a[aria-label='Chat with ResinRiva on WhatsApp']` occupies x 304–360, y 768–824 (56×56 fixed) at 390×844; `#custom-idea` spans x 20–360, y 767–889 — a **56×56px overlap** on the textarea's corner at load, sitting on the placeholder text. Every full-width control (340px wide, right edge x=360) passes under it while scrolling/typing. **Verifier proof:** reproduced exactly; computed intersection 56×56, `elementFromPoint` at the FAB center returns the FAB's svg (FAB on top of the textarea), and `floating-whatsapp.tsx` only lifts the FAB on /product/* routes, not here.
- **Impact:** The floating chat button covers part of the form users are actively filling in — including tap area of the very field that starts the commission.
- **Recommendation:** Inset the form column's right edge or hide/shrink the FAB while a form field is focused; alternatively add right padding/safe offset so fixed elements don't cover interactive controls.
- **Status:** CONFIRMED

#### [UIUX-P15] Hero microcopy fails AA contrast: trust chips 4.32:1, "scroll" hint 3.65:1
- **Severity:** Major
- **Effort:** S
- **Pages:** home (both viewports)
- **Observation:** The trust chips "poured by hand / no two pieces alike / ordered over whatsapp" are text-porcelain/45 blended on rgb(10,10,10) = **4.32:1** at 13px; the "scroll" hint is porcelain/40 = **3.65:1** at 11px — both below the 4.5:1 minimum for normal-size text, over a photographic backdrop (opacity-60 image) that can locally brighten. **Verifier proof:** per-pixel WCAG contrast computed against the real rendered backdrop (element hidden, region screenshotted, 45%-alpha text composited): chips **4.06–4.36:1** across all three on both viewports — the 45%-alpha blend cannot exceed ~4.36:1 on any backdrop; scroll hint **3.57–3.67:1**. (Minor nit: the originally stated blend color was wrong, but the ratios match measurement.) Chips are a near-threshold miss, so this is the low end of Major.
- **Impact:** The hero's trust signals — the copy doing persuasion work on the first screen — are below AA and washed out further wherever the photo brightens.
- **Recommendation:** Raise the trust chips to text-porcelain/60+ (≥6:1 on the base) and the scroll label to porcelain/55, or enlarge/mark them decorative; verify against the brightest area of the hero photo.
- **Status:** CONFIRMED

#### [UIUX-P16] Keyboard focus on the gallery zoom button is completely invisible — outline clipped by `overflow-hidden`
- **Severity:** Major
- **Effort:** S
- **Pages:** product (both viewports)
- **Observation:** `button[aria-label='View image full screen']` (absolute inset-0, 674×674 desktop / 540×540 mobile) computes a `:focus-visible` outline of 2px solid rgb(91,157,255) with 2px offset, but its parent `div.relative.aspect-square.overflow-hidden.rounded-2xl` clips everything painted outside the button's box. **Verifier proof:** keyboard-Tab to the button gives `:focus-visible=true` with the computed outline present, yet focused-vs-blurred screenshots of the parent region +16px margin are **byte-identical** on desktop (`Buffer.compare===0`); the mobile pair differed only at the animated WhatsApp FAB in the corner, with no ring visible in the focused shot.
- **Impact:** The largest interactive element on the product page gives keyboard users zero indication it is focused, despite a correct global focus-ring system existing.
- **Recommendation:** Use an inset indicator on this button, e.g. `focus-visible:outline-offset-[-3px]`, or a `focus-visible:ring-2 ring-inset`, or style the wrapper via `:focus-within` so the ring renders inside the rounded clip.
- **Status:** CONFIRMED

#### [UIUX-P17] Closing the lightbox drops keyboard focus to `<body>` instead of returning it to the trigger
- **Severity:** Major
- **Effort:** S
- **Pages:** product (both viewports)
- **Observation:** After opening the lightbox and pressing Escape (also after mouse-close), `document.activeElement === BODY`. The Radix Dialog in `gallery.tsx` is state-controlled with no DialogTrigger, so Radix's default focus restore has no trigger to return to. (The focus trap inside the dialog works: Tab cycles Previous/Next/Close correctly.) **Verifier proof:** all four close scenarios measured on both viewports (Escape and Close-button click) — focus lands on BODY every time (`isStageBtn:false`); initial focus on open correctly lands inside the dialog.
- **Impact:** Keyboard and screen-reader users are stranded at the top of the document after every lightbox close, losing their place mid-shopping.
- **Recommendation:** Add `onCloseAutoFocus` to DialogContent that focuses the main-stage button (or the active thumbnail): `onCloseAutoFocus={(e) => { e.preventDefault(); stageButtonRef.current?.focus(); }}`.
- **Status:** CONFIRMED

#### [UIUX-P18] Filter/sort/search result updates are never announced — zero live regions on the shop page
- **Severity:** Major
- **Effort:** S
- **Pages:** shop (both viewports)
- **Observation:** `document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')` returns **[]**; the only feedback is the visual `opacity-50` during useTransition and the silently re-rendered "Showing 12 pieces" `<p>` in `shop-explorer.tsx`. **Verifier proof:** at both viewports, `[aria-live], [role=status], [role=alert], output` count === 0; the count element `<p class="mt-8 text-sm text-foreground/55">` has aria-live=null and role=null; filtering confirmed client-side (typed into search, window marker survived, URL stayed /shop, still 0 live regions); `shop-explorer.tsx:81` uses useTransition with the count rendered at line 283 with no live attributes.
- **Impact:** Screen-reader users applying a filter, searching, or loading more items get complete silence — no way to know the grid changed or how many results exist.
- **Recommendation:** Add `role="status" aria-live="polite"` to the "Showing N pieces" paragraph (and render it in the empty state too) so result-count changes are announced.
- **Status:** CONFIRMED

#### [UIUX-P19] Custom-order field errors are not associated with their inputs and never announced
- **Severity:** Major
- **Effort:** S
- **Pages:** custom-order (both viewports)
- **Observation:** After a failed submit, `#custom-idea/#custom-name/#custom-phone` get `aria-invalid='true'` but **aria-describedby=null**; each error `<p class='text-sm text-destructive'>` has no id, role=null, aria-live=null (only the separate serverError `<p>` has role='alert'). A screen reader hears "invalid" with no reason. **Verifier proof:** reproduced at both viewports; all three error paragraphs unwired; source confirms field errors are plain `<p>`s (`custom-order-form.tsx:230, 324, 346`) with only the serverError at line 383 carrying role='alert'.
- **Impact:** Non-sighted users know a field is wrong but not why or how to fix it — compounding P05's missing focus management on the same form.
- **Recommendation:** Give each error `<p>` an id (e.g. `custom-phone-error`), reference it via `aria-describedby` on the input, and add `role='alert'` (or wrap errors in an `aria-live='polite'` region) in `custom-order-form.tsx`.
- **Status:** CONFIRMED

#### [UIUX-P20] Required fields are not conveyed as required to assistive technology
- **Severity:** Major
- **Effort:** S
- **Pages:** custom-order (both viewports)
- **Observation:** `#custom-idea/#custom-name/#custom-phone`: required=false, aria-required=null, aria-describedby=null; the "*" marker is `<span aria-hidden>` (`custom-order-form.tsx:214, 310, 330`). **Verifier proof:** reproduced pre- and post-submit at both viewports; `form.noValidate=true`, so no native required semantics exist either — assistive tech has no programmatic or textual required indicator, and users can only infer requiredness from the absence of "(optional)" on other labels.
- **Impact:** Screen-reader users can't tell which of the seven fields are mandatory before submitting — feeding directly into the P05/P19 failed-submit experience.
- **Recommendation:** Add `aria-required='true'` (or `required`, with noValidate already set on the form) to the three mandatory controls, and consider a visible "required" legend.
- **Status:** CONFIRMED

#### [UIUX-P21] Sticky mobile CTA bar reserves no space — permanently covers "Place order" and the footer legal links
- **Severity:** Major
- **Effort:** S
- **Pages:** product (mobile)
- **Observation:** The fixed bar `.glass-dark.fixed` is h=**62px**, z-30, always visible; body and main padding-bottom are both **0px**. With the submit button scrolled to block:end its bottom=844 vs barTop=782 ⇒ **62px of the primary CTA sits behind the bar** (product-mobile-submit.png); at maximum scroll, footerBottom=844 vs barTop=782 — the Privacy/Terms row is permanently occluded (product-mobile-bottom.png). **Verifier proof:** reproduced — 61.6px overlap with `elementFromPoint` at the submit's center returning the bar's Customize BUTTON; at max scroll (scrollTop=6077===maxScroll) `elementFromPoint` at both legal links' centers returns the bar's inner div with no further scroll available; while `#order-panel` is centered in the viewport the bar remains visible — it never hides, duplicating and covering the very CTA it points to.
- **Impact:** The actual "Place order" submit can be physically un-tappable at its natural scroll position, and Privacy/Terms are unreachable on mobile.
- **Recommendation:** Add bottom padding equal to the bar height on mobile (e.g. `pb-20 lg:pb-0` on the page wrapper or body), and hide the bar (`translate-y-full`) while `#order-panel` intersects the viewport via IntersectionObserver.
- **Status:** CONFIRMED

#### [UIUX-P22] Translucent fixed header lets scrolled form content collide with the top-bar text; errored fields hide under it
- **Severity:** Major
- **Effort:** M
- **Pages:** custom-order (mobile)
- **Observation:** The header element computes background rgba(0,0,0,0); its inner aria-hidden layer carries blur(18px) with a translucent gradient (alpha 0.2 at the nav row). At scrollY=1200 on 390×844, form text renders legibly *through* the top-bar line "Made-to-order luxury resin art…" and around the logo row; the phone validation error is sliced by the 100px header. **Verifier proof:** symptom fully reproduced, with one wording correction — the blur covers the entire 380×100 header (not just a pill), but the tint is translucent so the collision is real: `elementsFromPoint(195,18)` returns the announcement link stacked over `#custom-budget`; `scrollIntoView` on errored `#custom-phone` parks the input at top=-0.125 under the header with its red border wrapping the announcement text and the error message at y 51.9–71.9 hidden behind the logo row; `#custom-phone` scroll-margin-top computes **0px**. Major stands — errored/focused fields become invisible.
- **Impact:** Text-through-text collisions look broken while scrolling, and a field brought into view by focus or error correction lands underneath the header where its message can't be read.
- **Recommendation:** Give the whole fixed header (including the announcement top-bar) an opaque or fully-blurred background surface once scrolled, and add `scroll-margin-top` to form fields so focused/errored fields clear the 100–116px header.
- **Status:** CONFIRMED

#### [UIUX-P23] "How commissions work" 3-step explainer is completely absent on mobile
- **Severity:** Major
- **Effort:** M
- **Pages:** custom-order (mobile)
- **Observation:** The aside (class `hidden lg:block`, `src/app/(public)/custom-order/page.tsx:84`) computes display:none at 390×844, with no mobile equivalent anywhere on the page. **Verifier proof:** a whole-document text-node scan for "how commissions work" / "Share your idea" / "We design & quote" / "Poured, cured" found visible=false for every match (all inside the hidden aside; remaining hits are script/RSC payload text); at 1440×900 the same aside renders (width 340) with all three steps — the content is desktop-only. The objective claim (complete absence on mobile) is verified; the Major weighting reflects that this is the funnel's trust/process content on the majority viewport.
- **Impact:** Mobile users — the majority — commission without ever seeing what happens after they submit: no process, timeline framing, or reassurance.
- **Recommendation:** Render the 3 steps on mobile as a compact horizontal stepper or collapsed section above/below the form instead of hiding them entirely.
- **Status:** CONFIRMED

#### [UIUX-P24] Instagram section degrades to a dead end — a 383px section with one unactionable sentence
- **Severity:** Major
- **Effort:** S
- **Pages:** home (both viewports)
- **Observation:** When the Behold widget fails to hydrate and no Instagram profile URL is configured, the section titled "follow along on instagram" renders region `aria-label='ResinRiva on Instagram'` (height 220px inside a 383.5px section) containing only "Our latest work lives on Instagram." with **zero links or buttons** — the fallback button in `instagram-feed.tsx:120` is gated on profileUrl, and `socials.instagram` is unset in Site Settings. **Verifier proof:** reproduced live at both viewports — waited 6s past the 3.5s timeout; `<behold-widget>` present but hydrated=false (no shadowRoot/children); linkCount=0, 0 buttons. Caveat: the dead end manifests only when the Behold script fails to hydrate (reproduced here) — a state the component explicitly anticipates (ad-blockers/CSP/outage).
- **Impact:** A full homepage section invites follow-along and then offers nothing clickable — for every visitor with an ad-blocker or during any widget outage.
- **Recommendation:** In `src/components/sections/instagram-feed.tsx`, fall back to a hardcoded brand profile URL constant (or hide the entire section from page.tsx when `socials.instagram` is unset) so the fallback always offers a working "View us on Instagram" link.
- **Status:** CONFIRMED

## Minor

#### [UIUX-P25] Breadcrumb links are only 15–20px tall on mobile
- **Severity:** Minor *(adjusted Major→Minor during verification)*
- **Effort:** S
- **Pages:** shop, product (mobile)
- **Observation:** At 390×844: shop `nav[aria-label="Breadcrumb"]` "Home" = **34.8×15px**; product breadcrumbs = 39.2×20 / 34.2×20 / 235.2×**20px** — all far under the 44px recommendation. **Verifier proof:** sizes reproduce exactly, but the original "fails even WCAG 2.2's 24px absolute minimum" clause is overstated: SC 2.5.8's spacing exception passes — 24px circles centered on each undersized target do not intersect adjacent targets/circles (product: 2px vertical clearance between rows; 38.8px horizontal circle gap Home→Shop; shop: 7.5px clearance to the logo link). Genuine touch-target best-practice defect (44px), not a normative WCAG failure; severity accordingly reduced given breadcrumbs are secondary, redundant navigation.
- **Impact:** Back-navigation via breadcrumbs is frustrating to tap, though duplicate routes exist via the header.
- **Recommendation:** Add `inline-flex min-h-11 items-center` (or py-3.5 with negative margin / py-2) to breadcrumb links in the shared breadcrumb rendering so their effective height reaches ≥44px.
- **Status:** CONFIRMED

#### [UIUX-P26] Shop heading hierarchy skips a level — H1 straight to H3 with no H2
- **Severity:** Minor
- **Effort:** S
- **Pages:** shop (both viewports)
- **Observation:** Heading scan returns H1 "Shop ResinRiva" followed directly by 12 H3 product-card titles; the empty-state heading "No pieces match this view" is also an H3 directly under the H1. **Verifier proof:** reproduced at both viewports — zero H2 elements on the page (remaining H3s are footer headings); empty-state confirmed as `<h3>` at `shop-explorer.tsx:321-322`.
- **Impact:** Screen-reader heading navigation implies a missing section level; rotor users get a lopsided outline of the page.
- **Recommendation:** Make card titles (and the empty-state heading) h2, or insert a visually-hidden h2 (e.g. "All pieces") above the grid in `shop-explorer.tsx`.
- **Status:** CONFIRMED

#### [UIUX-P27] All external links open new tabs with no indication
- **Severity:** Minor
- **Effort:** S
- **Pages:** contact (both viewports; shared components affect all pages)
- **Observation:** 7 `a[target=_blank]` instances on the contact page (Start on WhatsApp, Message on WhatsApp, Open in Google Maps, social icon, footer Find our studio / Chat on WhatsApp, FAB): none has "new tab" in aria-label, visually-hidden text, or an external-link icon — the ArrowRight on the maps/WhatsApp links actually implies in-page navigation. **Verifier proof:** exactly 7 instances found; regex `/new (tab|window)/i` over ariaLabel + sr-only text + title matched **0 of 7**.
- **Impact:** Screen-reader and keyboard users get an unannounced context change on every primary CTA; WCAG 3.2.5 advisory (G201) unmet.
- **Recommendation:** Append sr-only text " (opens in new tab)" or extend aria-labels on the shared WhatsApp/maps link builders — one change in the Button/link composition covers all instances.
- **Status:** CONFIRMED

#### [UIUX-P28] Custom-order validation runs only on submit and error messages go stale
- **Severity:** Minor
- **Effort:** S
- **Pages:** custom-order (both viewports)
- **Observation:** `fieldErrors` is only written inside `validate()` called from handleSubmit (`custom-order-form.tsx:117-138`); onChange handlers only set values, and no onBlur validation exists. **Verifier proof:** after a failed submit produced 3 errors, filling `#custom-name` and `#custom-phone` with valid values and blurring (no resubmit) left all 3 error texts visible and `aria-invalid` still 'true' on both corrected fields.
- **Impact:** Users who fix a field still see red errors accusing them, undermining confidence that the fix "took" until they resubmit blind.
- **Recommendation:** Clear the field's error in its onChange/onBlur once the value passes its rule (validate-on-blur, re-validate-on-change after first error).
- **Status:** CONFIRMED

#### [UIUX-P29] Contact form validates only on submit — invalid phone gives no feedback on blur
- **Severity:** Minor
- **Effort:** S
- **Pages:** contact (both viewports)
- **Observation:** Typing "abc" into `#contact-phone` then blurring via Tab: `#contact-phone-error` = null, aria-invalid = null, 0 role=alert elements until "Send message" is clicked. **Verifier proof:** reproduced; clicking submit then produced `#contact-phone-error`='Please enter a valid phone number.', aria-invalid='true', and 3 role=alert errors at once. `useForm()` at `src/components/sections/contact-form.tsx:80` passes only defaultValues, so react-hook-form's default `mode:'onSubmit'` applies. (Error rendering/announcement itself is already correct.)
- **Impact:** Users get a batch of three errors at submit time instead of per-field guidance while their attention is on the field.
- **Recommendation:** Pass `mode:'onTouched'` (validate on first blur, then on change) to useForm.
- **Status:** CONFIRMED

#### [UIUX-P30] Newsletter email field has no visible label
- **Severity:** Minor
- **Effort:** S
- **Pages:** home (shared footer, both viewports)
- **Observation:** The footer NewsletterForm input relies on placeholder ('you@email.com') plus aria-label only — no `<label>` exists anywhere in the form (`newsletter-form.tsx:78-97`); once the user types, the only visible identification of the field disappears. **Verifier proof:** reproduced (noting the form's first input is an sr-only honeypot; the real email input was measured): no label[for], no wrapping label, `anyLabelInFooterForm=false`; the visible line "Get first access to new drops." sits above but unassociated. Empty-submit behavior verified good (role=alert "Enter a valid email address.", aria-invalid='true', aria-describedby='newsletter-error') but focus stays on BODY after the error, and the submitting state renders only "…" with no spinner.
- **Impact:** Placeholder-only labeling fails once text is entered and weakens the association for AT users; error focus loss makes correction clumsy.
- **Recommendation:** Promote "Get first access to new drops." to a `<label htmlFor>` bound to the input, and refocus the input when the server returns a validation error.
- **Status:** CONFIRMED

#### [UIUX-P31] Shop search field is a plain text input — no Search action key or native clear on mobile
- **Severity:** Minor
- **Effort:** S
- **Pages:** shop (mobile)
- **Observation:** `input[name="q"]` inside `form[role="search"]` has no type attribute (defaults to text) and no enterkeyhint; there is no visible submit control, so applying a query relies solely on the keyboard's generic return key (`shop-explorer.tsx:191-198`). **Verifier proof:** reproduced — `getAttribute('type')=null` (.type resolves to 'text'), enterkeyhint=null, inputmode=null, and the form contains zero button/input[type=submit] controls.
- **Impact:** Mobile keyboards show a generic Return instead of Search, and users lose the built-in one-tap clear affordance.
- **Recommendation:** Use `type="search"` (plus `enterkeyhint="search"`) on the input; keep the existing aria-label.
- **Status:** CONFIRMED

#### [UIUX-P32] Live-order-summary footnote is 11px at 50% opacity — below the type-scale floor
- **Severity:** Minor
- **Effort:** S
- **Pages:** product (both viewports)
- **Observation:** "Updates as you type — image links are added once your photos upload." computes font-size **11px** (`text-[11px]`) at 50% alpha (`order-panel.tsx:502`); contrast on the glass panel (composited rgb(11,17,28)) is ~5.1:1 — passing — but it is the only sub-12px text on the page. **Verifier proof:** page-wide scan of visible elements with own text found exactly one element under 12px — this footnote; contrast re-measured at 5.10:1 (matches the claimed 5.12:1 within rounding).
- **Impact:** A note users are expected to read (explains why image links appear later) sits below the readable floor and outside the 12/14/16 scale.
- **Recommendation:** Bump to text-xs (12px) and text-foreground/60 to match the sibling helper texts and keep the scale consistent.
- **Status:** CONFIRMED

#### [UIUX-P33] Contact email splits mid-token on mobile ("gondaliyabhavya70960@gmail.c / om")
- **Severity:** Minor
- **Effort:** S
- **Pages:** contact (mobile)
- **Observation:** At 390px the mailto link renders 255×48px over two lines, breaking after "gmail.c"; class `break-all` at `src/app/(public)/contact/page.tsx:170` permits a break at any character even when a cleaner break at "@" or "." exists. **Verifier proof:** reproduced — computed word-break='break-all', overflow-wrap='normal'; per-character Range measurement shows the two rendered lines are exactly "gondaliyabhavya70960@gmail.c" and "om" (contact-mobile.png).
- **Impact:** The studio's email reads as a typo/broken address at the exact moment someone is copying it.
- **Recommendation:** Replace `break-all` with `break-words` + `[overflow-wrap:anywhere]` (or a `<wbr>` after "@") so the address wraps at sensible boundaries only when it must.
- **Status:** CONFIRMED

#### [UIUX-P34] Collections rail is scroll-gesture-only on desktop — 3+ cards hidden with no prev/next controls
- **Severity:** Minor
- **Effort:** M
- **Pages:** home (desktop)
- **Observation:** The rail wrapper is overflow-x:auto with scrollWidth **2540** vs clientWidth **1430** (8 cards, first card 288px wide); the only affordance is a 10px `::-webkit-scrollbar` with a 40%-alpha sapphire thumb, and the rail has no tabindex. **Verifier proof:** reproduced at 1440×900 — the "The collections" section contains zero buttons/[role=button]. One evidence caveat: the testimonial-carousel comparison isn't observable live (that section renders null with 0 testimonials), though `testimonial-carousel.tsx:88-103` does define aria-labelled Previous/Next buttons — the pattern exists in the codebase to reuse.
- **Impact:** Mouse users must drag a thin scrollbar or know shift+wheel to reach categories 5–8; several collections are effectively invisible on desktop.
- **Recommendation:** Add the same round outline prev/next buttons defined by TestimonialCarousel above the rail on lg+ (scrollBy one card width), keeping swipe on touch devices.
- **Status:** CONFIRMED

## Polish

#### [UIUX-P35] Character counters are visual-only; near-limit state is color-only; maxLength truncates silently
- **Severity:** Polish
- **Effort:** S
- **Pages:** custom-order, contact (both viewports)
- **Observation:** All three CharCounter `<p>` elements (custom-order idea + notes; contact message) compute aria-live=null, role=null, aria-atomic=null (`char-counter.tsx` renders a bare `<p>`); at ≥90% of the cap the counter switches to text-destructive with no text/icon change. **Verifier proof:** reproduced at 1440×900 — filling the first textarea to 1900/2000 (95%) flipped counter color from rgb(154,165,180) to rgb(239,125,114) with no accompanying text change; with value at maxLength=2000, typing "zzz" left value.length at 2000 with no announcement. (Evidence nit: contact's counter is 0/2000, not 0/1500. Form was cleared, never submitted.)
- **Impact:** Screen-reader users get no warning approaching the limit and no explanation when typing silently stops (WCAG 4.1.3); color-blind users miss the near-limit signal.
- **Recommendation:** Add `aria-live='polite'` to CharCounter (debounced, or only when crossing the 90% threshold) announcing remaining characters, and pair the color change with text like "112 characters left".
- **Status:** CONFIRMED

#### [UIUX-P36] "How it works" step numerals 01–04 are functionally invisible at 1.08:1 yet announced by screen readers
- **Severity:** Polish
- **Effort:** S
- **Pages:** home (both viewports)
- **Observation:** Step numbers use text-sapphire/15 (`page.tsx:597`): #0f52ba at 15% over #0a0a0a blends to ~rgb(10,21,36) = **1.08:1** — barely-perceptible smudges — yet they are real DOM text with aria-hidden=null, so the visual and audible experiences diverge. **Verifier proof:** all four numerals re-measured at both viewports (computed oklab = sapphire at 0.15 alpha; blended contrast 1.08:1); ground-truth pixel decode of the element and full-page screenshots confirms glyph core rgb(10,20,36) vs bg rgb(10,10,10) = 1.07:1 (448 glyph pixels vs 14183 bg — visually near-invisible); aria-hidden absent on all four.
- **Impact:** Sighted users see no numbering; screen-reader users hear stray "01…04" tokens — the worst of both.
- **Recommendation:** If the numerals are meant as ghost numbering, raise to sapphire/35–40 (~2–3:1, still watermark-like); if purely decorative, add aria-hidden and rely on the `<ol>` semantics for order.
- **Status:** CONFIRMED

#### [UIUX-P37] Announcement copy renders twice within the first viewport on the contact page
- **Severity:** Polish
- **Effort:** S
- **Pages:** contact (both viewports)
- **Observation:** The identical string "Made-to-order luxury resin art — every order finalized personally on WhatsApp" prints in the fixed AnnouncementBar and again as the gold hero pill (`contact/page.tsx:71-77`), both visible on load. **Verifier proof:** reproduced — announcement bar (top 8–28, inside the fixed header) and hero pill both simultaneously visible in the first viewport (desktop pill top=751 in a 900px viewport; mobile top=394 in 844px). Evidence correction: desktop vertical separation is ~743px, not the claimed ~380px (which matches mobile) — the defect stands.
- **Impact:** Verbatim duplicated messaging in one view reads as templating oversight rather than intent, diluting both placements.
- **Recommendation:** Drop the hero pill on pages where the announcement bar is visible, or give the pill distinct contact-specific copy such as reply-time expectations.
- **Status:** CONFIRMED

---

## Strengths worth keeping

Evidenced during measurement and re-verification — patterns to preserve (and extend to the failing areas above):

- **Product order form error semantics** are solid: role=alert errors, `aria-invalid` + `aria-describedby` wiring, and auto-focus of `#order-name` (observed in P04's context) — the exact pattern P05/P19 need on the custom-order form.
- **Contact form error rendering and announcement** are already correct (P29); only the validation mode needs changing.
- **Newsletter empty-submit handling** is properly wired: role=alert message, `aria-invalid`, `aria-describedby='newsletter-error'` (P30).
- **A real global focus system exists** — 2px solid `--ring` #5b9dff `:focus-visible` outline (P16) — the fixes are about letting it show, not building one.
- **The lightbox focus trap works**: Tab correctly cycles Previous/Next/Close inside the dialog (P17); only close-restore is missing.
- **The design system already contains the right sizes**: size-11 (44px) icon Buttons and h-11 inputs (P07/P12), plus an AA-passing on-dark azure rgb(59,130,246) measured at 4.75–5.38:1 (P01) — most touch and contrast fixes are one-token swaps to components that already exist.
- **Dismiss controls carry proper aria-labels/sr-only text** (dialog close, gallery arrows, FAB) — the accessibility naming layer is in place; the hit areas just need to catch up.