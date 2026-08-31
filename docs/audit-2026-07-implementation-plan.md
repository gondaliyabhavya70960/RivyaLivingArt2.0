> **ARCHIVED (historical — pre-v2.0 codebase).** Superseded by `audit/FINDINGS.md` + `audit/BASELINE.md`; file paths herein no longer exist, and all checkbox tasks shipped (see the addenda) despite the boxes never being ticked.
> Still live at archive time: Higgsfield scratch-website cleanup (Phase-5 backlog #10 — owner dashboard action) and SEC-009 key rotation (see `audit-2026-07-master.md`).

# ResinRiva 2.0 — Phased Implementation Plan
_Derived from [audit-2026-07-master.md](./audit-2026-07-master.md) · 2026-07-12 · Commit 2173abe_

## Prioritization Rationale
Sequencing: **security & correctness first** (they carry business/legal risk regardless of severity label — key rotation, security headers, login throttling, stored-XSS), then **high-ROI CRO/UX** on the conversion path (WhatsApp funnel, product page, dark-theme contrast that makes swatches unreadable), then **SEO / performance / accessibility** hardening, then **design-system consolidation & polish**. Phases are mostly independent, but the dark-theme token retune (Phase 1) underlies several UI/A11y contrast fixes, and the env-validation module (Phase 0) de-risks every later change. Total ≈ 26.5 dev-days.

## Phase Overview

| Phase | Theme | Finding IDs | Effort | Priority |
|-------|-------|-------------|:------:|:--------:|
| 0 | Security hardening & secret hygiene | SEC-009, SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-010, ENG-002, ENG-003 | ~4.0 dev-days | P0 — do before/at launch |
| 1 | Measurement, CRO & funnel accessibility | MKT-001, MKT-002, MKT-003, MKT-004, ENG-001, A11Y-001, A11Y-004, A11Y-002, MKT-010, MKT-008, MKT-009, MKT-005, MKT-011, MKT-006, MKT-007 | ~4.5 dev-days | P1 — highest ROI |
| 2 | SEO, performance & accessibility | SEO-001, SEO-002, SEO-003, SEO-004, SEO-006, SEO-007, SEO-008, PERF-001, PERF-002, PERF-003, PERF-004, PERF-005, PERF-006, PERF-007, PERF-008, PERF-009, A11Y-003, A11Y-005, A11Y-007, A11Y-008, A11Y-009, UIUX-003, UIUX-005, UIUX-006 | ~8.5 dev-days | P2 |
| 3 | Design-system consolidation & polish | DS-001, DS-002, DS-003, DS-005, DS-006, DS-007, DS-008, DS-009, UIUX-001, UIUX-002, UIUX-004, UIUX-008, UIUX-009, ENG-004, ENG-005, ENG-006 | ~5.0 dev-days | P3 |

## Phase Detail

### Phase 0 — Security hardening & secret hygiene
- **Goal:** Close the exploitable and operational-risk gaps so the site can be exposed publicly with a defensible baseline.
- **Addresses:** SEC-009, SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-010, ENG-002, ENG-003
- **Tasks:**
  - [ ] Rotate the exposed Resend key and Google service-account JSON, invalidate old ones (-> SEC-009)
  - [ ] Add a headers()/middleware baseline: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (-> SEC-001)
  - [ ] Add a durable (Upstash/Redis) rate-limit store and apply login attempt throttling/lockout (-> SEC-002, SEC-005)
  - [ ] Remove image/svg+xml from accepted uploads or force attachment disposition (-> SEC-003)
  - [ ] Rate-limit the public Blob upload token endpoint and the password-reset request (-> SEC-004, SEC-007)
  - [ ] Sanitize rendered Tiptap HTML to strip javascript: hrefs before dangerouslySetInnerHTML (-> SEC-006)
  - [ ] Gate the scraper CSV export behind requireStaff (-> SEC-008)
  - [ ] Add a content-policy check on WhatsApp inquiry free-text/image URLs (-> SEC-010)
  - [ ] Add a centralized env-var validation module that fails fast at boot (-> ENG-002)
  - [ ] Route contact notification email through studioFrom() (-> ENG-003)
- **Acceptance criteria / DoD:** securityheaders.com scan passes A/A+; SVG upload rejected; login locks out after N attempts across instances; rotated keys confirmed live and old keys revoked; blog/legal pages render sanitized HTML; boot fails loudly on missing required env vars.
- **Dependencies:** Durable rate-limit store provisioning (Upstash/Redis) unblocks SEC-002/SEC-004/SEC-005/SEC-007.
- **Estimated effort:** ~4.0 dev-days
- **Risk & rollback:** CSP can break Cloudinary/Behold/analytics — roll out in report-only mode first, then enforce. Key rotation must be coordinated to avoid email/scraper downtime; keep a rollback of the previous env values until the new keys are verified.

### Phase 1 — Measurement, CRO & funnel accessibility
- **Goal:** Stop launching blind: instrument the funnel, create a remarketing + re-engagement path, seed trust, and make the conversion form readable/announced.
- **Addresses:** MKT-001, MKT-002, MKT-003, MKT-004, ENG-001, A11Y-001, A11Y-004, A11Y-002, MKT-010, MKT-008, MKT-009, MKT-005, MKT-011, MKT-006, MKT-007
- **Tasks:**
  - [ ] Add a typed track() helper and fire whatsapp_click on every WhatsApp CTA (-> MKT-001)
  - [ ] Mount GA4 + Meta Pixel with consent handling and map key events (-> MKT-002)
  - [ ] Fix place_order_clicked mis-fire and add form-start/drop-off events (-> MKT-007)
  - [ ] Add an email/lead-capture component (newsletter + launching-soon block) (-> MKT-003)
  - [ ] Seed testimonials and render the section with photo/UGC + aggregate rating + review schema (-> MKT-004, MKT-006)
  - [ ] Wire Studio Site Settings to the live header/footer/announcement bar and real social URLs (-> ENG-001, MKT-005)
  - [ ] Rewrite the hero h1 to be offer-clear and keyword-bearing (-> MKT-010)
  - [ ] Add benefit/trust bullets adjacent to the product CTA and an offer/urgency + link to the announcement bar (-> MKT-008, MKT-009)
  - [ ] Populate product OG/share descriptions (-> MKT-011)
  - [ ] Fix funnel form-error contrast to AA and associate errors with inputs via aria-describedby + announce/focus on failure; strengthen focus indicator on dark (-> A11Y-001, A11Y-004, A11Y-002)
- **Acceptance criteria / DoD:** WhatsApp CTA clicks appear in GA4 + Meta with correct attribution; a remarketing audience is populating; newsletter capture stores leads; testimonials render on a fresh deploy with review schema validating in Rich Results; editing a setting in Studio changes the live header/footer; funnel form errors pass AA and are read by a screen reader.
- **Dependencies:** track() helper (MKT-001) precedes MKT-002/MKT-007; ENG-001 unblocks MKT-005/MKT-009; consent/CSP allowances from Phase 0.
- **Estimated effort:** ~4.5 dev-days
- **Risk & rollback:** Pixel/consent mis-config can leak PII or violate consent — gate behind a consent banner and test in staging. Announcement/social changes now come from DB, so validate empty/malformed settings degrade gracefully.

### Phase 2 — SEO, performance & accessibility
- **Goal:** Protect crawl budget, cut mobile LCP/JS weight, and bring the site to a broadly accessible baseline.
- **Addresses:** SEO-001, SEO-002, SEO-003, SEO-004, SEO-006, SEO-007, SEO-008, PERF-001, PERF-002, PERF-003, PERF-004, PERF-005, PERF-006, PERF-007, PERF-008, PERF-009, A11Y-003, A11Y-005, A11Y-007, A11Y-008, A11Y-009, UIUX-003, UIUX-005, UIUX-006
- **Tasks:**
  - [ ] noindex + de-sitemap /search; add canonicals to category pages; add BreadcrumbList/CollectionPage + product brand/offer/image-fallback schema; add Twitter/OG defaults; enrich Org schema; prune/lastmod the sitemap (-> SEO-001,SEO-002,SEO-003,SEO-004,SEO-006,SEO-007,SEO-008)
  - [ ] Add width transforms/responsive sizing to hero/category/about/homepage-feature and all /uploads images so a real srcset ships (-> PERF-001)
  - [ ] Scope GSAP/Lenis/SmoothScroll/preloader/motion out of root layout to only the routes that use them (-> PERF-002,PERF-004,PERF-007,PERF-008,PERF-009)
  - [ ] Replace zod on the client contact form with a lighter validator or shared server schema (-> PERF-003)
  - [ ] Defer the Behold Instagram script until near-viewport and remove the dead three.js/@react-three tree (-> PERF-005,PERF-006)
  - [ ] Add a focus trap to the mobile menu and a skip-to-content link + main id (-> A11Y-003,A11Y-005)
  - [ ] Signal required fields with text not just aria-hidden asterisks; fix search placeholder + announcement/header ink contrast (-> A11Y-007,A11Y-008,A11Y-009)
  - [ ] Stop GSAP hiding the hero h1/LCP until fonts.ready (-> UIUX-003)
  - [ ] Give the Instagram feed loading/empty/error states and make Quick View discoverable/tappable on touch (-> UIUX-005,UIUX-006)
- **Acceptance criteria / DoD:** /search returns noindex and is absent from sitemap; category pages self-canonicalize; Rich Results validates breadcrumb/product/collection schema; Lighthouse mobile LCP improves materially and static/admin routes no longer load GSAP/Lenis/zod; axe/keyboard audit passes on menu, skip link, and forms.
- **Dependencies:** PERF-001 image work benefits from Cloudinary transform conventions; provider-scoping (PERF-002) should land before per-route perf measurement; builds on Phase 1 headline/schema changes.
- **Estimated effort:** ~8.5 dev-days
- **Risk & rollback:** Removing smooth-scroll/motion changes feel — get design sign-off. Provider re-scoping can regress animations on pages that legitimately need them; verify hero/scroll sections after the move.

### Phase 3 — Design-system consolidation & polish
- **Goal:** Pay down the theme-inverted token debt and code-quality drift so future work is consistent and cheap.
- **Addresses:** DS-001, DS-002, DS-003, DS-005, DS-006, DS-007, DS-008, DS-009, UIUX-001, UIUX-002, UIUX-004, UIUX-008, UIUX-009, ENG-004, ENG-005, ENG-006
- **Tasks:**
  - [ ] Introduce an AA-passing gold-ink token and replace the 5 hardcoded #8a6d1a uses (-> DS-001)
  - [ ] Make Section actually consume headerTheme (revive the dark-ink system) and rename tone tokens to describe what they render (-> DS-002,DS-003)
  - [ ] Tokenize off-white/near-black drift, the WhatsApp green, and the .eyebrow inline clones; extract a shared studio table-header primitive; move order-panel's raw palette onto tokens (-> DS-005,DS-006,DS-007,DS-008,DS-009)
  - [ ] Differentiate porcelain/ice section bands and fix the remaining light-tuned token contrast (swatch label, badge) (-> UIUX-001,UIUX-002)
  - [ ] Reposition the WhatsApp FAB so it clears the sticky mobile CTA; add category imagery/placeholders; add character counters to capped fields (-> UIUX-004,UIUX-008,UIUX-009)
  - [ ] Clear the 6 ESLint warnings, un-track the generated Prisma client, and split the 954-line product-form monolith (-> ENG-004,ENG-005,ENG-006)
- **Acceptance criteria / DoD:** No raw brand hex outside the token layer (grep clean); Section headerTheme changes header ink; section bands are visually distinct; FAB no longer overlaps the mobile CTA; ESLint clean; generated Prisma client no longer tracked; product-form split into composable pieces with no behavior change.
- **Dependencies:** Token rename (DS-003) should follow the Phase 1/2 contrast fixes so values are final before renaming; product-form split (ENG-006) is independent and can be parallelized.
- **Estimated effort:** ~5.0 dev-days
- **Risk & rollback:** Token renames touch many files — do them mechanically with codemods and a visual-regression pass. Product-form refactor risks form regressions; cover with the existing create/edit flows before merging.

## Fallback: Prioritized Fix Order
1. SEC-009
2. SEC-001
3. SEC-002
4. SEC-003
5. SEC-004
6. SEC-005
7. SEC-006
8. ENG-002
9. ENG-003
10. SEC-008
11. SEC-007
12. SEC-010
13. MKT-001
14. MKT-002
15. MKT-003
16. MKT-004
17. ENG-001
18. A11Y-001
19. A11Y-004
20. A11Y-002
21. MKT-010
22. MKT-008
23. MKT-009
24. MKT-005
25. MKT-011
26. MKT-006
27. MKT-007
28. SEO-001
29. SEO-002
30. PERF-001
31. PERF-002
32. PERF-003
33. A11Y-003
34. A11Y-005
35. UIUX-003
36. PERF-004
37. SEO-007
38. SEO-004
39. SEO-003
40. SEO-006
41. SEO-008
42. PERF-009
43. PERF-005
44. PERF-007
45. PERF-006
46. PERF-008
47. A11Y-007
48. A11Y-008
49. A11Y-009
50. UIUX-005
51. UIUX-006
52. UIUX-004
53. DS-001
54. DS-002
55. DS-003
56. UIUX-001
57. UIUX-002
58. DS-009
59. DS-007
60. DS-005
61. DS-006
62. DS-008
63. UIUX-008
64. UIUX-009
65. ENG-004
66. ENG-005
67. ENG-006


---

# 2026-07-19 Re-verification Addendum — Phases 0–3 (Master Audit)

_Derived from [audit-2026-07-master.md](./audit-2026-07-master.md) Appendix C · Commit 035b395 (branch `Main`)._

This addendum re-plans the work that remains **at HEAD**, after the post-2026-07-12 remediation wave. The original Phases above are preserved for history; **use the phases below going forward.** Scope covers: the 16 Partial/Adjusted register residuals (Appendix C.1), the 61 new findings (Appendix C.3), and the 5 still-open + notable Partial prior findings (Appendix C.2). Fully-implemented items (SEC-104, PERF-303, UIUX-603, and the 57 Fixed prior findings) are excluded.

Bias, per the master document: **safety & correctness → funnel robustness → Studio workflows → performance & shared architecture.** Effort key: S ≈ 0.25 dev-day, M ≈ 0.5, L ≈ 1.5.

## Phase 0 — Baseline Safety & Correctness (Public + Studio)

Everything that can break orders/auth/uploads/data, plus exploitable authz gaps. No Blockers survived verification, but three new Major authz findings sit here.

| ID | Scope | Effort | Owner | What |
|----|-------|:------:|-------|------|
| SEC-105 | Studio | S | Security | Gate `whatsappNumber`/phone/email in `updateSiteSettings` behind `requireStaff([ADMIN])` — EDITOR funnel-hijack |
| SEC-106 | Studio | M | Security | `tokenVersion`/`sessionEpoch` on User, re-checked in `requireStaff` — JWT revocation on delete/demote/reset (also closes the ENG "30-day access" finding) |
| SEC-107 | Studio | M | Security | Shared SSRF guard (reject loopback/RFC1918/link-local + revalidate on redirect) in scraper `probe`/`loadRules`/both mirror fns |
| SEC-109 | Studio | M | Security | `requireStaff([ADMIN])` on `deleteInquiries` + scraper export/delete (least-privilege) |
| SEC-108 | Studio | S | Full-stack | Neutralise formula-leading cells (`= + - @ tab CR`) in `csvCell` before quoting |
| SEC-110 | Studio | S | Security | Constant-time login: bcrypt-compare a dummy hash when no user row exists |
| SEC-102 | Studio | S | Security | Back login/reset limiter keys with a durable store (Prisma table — no paid infra); keep the `rateLimit()` signature (also closes SEC-005/ENG-008) |
| SEC-103 | Shared | M | Security | Add `/api/csp-report` + `report-to`, run report-only 1–2 wks, then enforce CSP; add `frame-ancestors 'none'` on `/studio`; nonce follow-up |
| ENG-802 | Public | S | Full-stack | Gate `?preview=1` on a staff session (or `draftMode()`) + `robots:{index:false}` for non-PUBLISHED — unblocks PERF-304 |
| ENG-803 | Studio | S | Full-stack | Add `studio/(dashboard)/{error,loading,not-found}.tsx` (light `:root`, `reset()` retry) — closes the UIUX error-boundary finding |
| ENG-806 | Studio | S | Full-stack | Reference-count a media URL before deleting the blob; `@@index([url])`; batch lookups |
| UIUX-605 | Shared | M | Full-stack | `findMediaUsages(urls)` guard + in-use Badge before Media delete (data-integrity twin of ENG-806) |
| ENG-811 | Public | S | Full-stack | Bind `/whatsapp-order` readback to a one-time token (SHA-256 on Inquiry) or sessionStorage — stop unauthenticated PII readback |
| ENG-804 | Public | S | Full-stack | `await`/`after()` the contact-notification email so Vercel can't freeze it mid-send |
| ENG-808 | Studio | S | Full-stack | Wrap first-admin count-then-create in `$transaction` |
| ENG-809 | Studio | S | Full-stack | Catch P2002 and retry `uniqueSlug` with next suffix at create sites |
| ENG-801 | Shared | S | Full-stack | `revalidatePublic(entity, slug)` helper called after every content mutation (studio edits go stale ≤5 min today) |
| SEC-009 | Shared | — | Owner | Confirm Resend + Google key rotation (provider-side, not verifiable in repo) |

- **Exit criteria:** an EDITOR cannot change the WhatsApp number or delete inquiries/exports; a deleted/demoted user's existing session is rejected on the next action; a scraper job pointed at `169.254.169.254`/`localhost` is refused; an exported CSV cell starting `=` is text-inert; login timing is uniform for real vs fake emails; login/reset lockout survives cold starts; `curl` shows an **enforced** CSP; `?preview=1` 404s for anonymous users and never indexes; a studio DB hiccup shows an in-shell error with retry; deleting an in-use media file is blocked; `/whatsapp-order` needs its token; a published product edit reflects on `/shop` + `/product/[slug]` + home within seconds.
- **Dependencies:** SEC-102/SEC-103 want the durable store + report route first; ENG-802 must land before PERF-304 (same preview-off-searchParams change).
- **Risks:** enforced CSP can break Behold/analytics/Blob → report-only window first; JWT re-check adds one indexed query per action (negligible). **Rollback:** all additive — revert `next.config.ts`, `requireStaff`, or the migration; the settings/limiter changes are guard-only.

## Phase 1 — Funnel & Feature Robustness (Public)

| ID | Scope | Effort | Owner | What |
|----|-------|:------:|-------|------|
| MKT-201 | Public | S | Marketing+FE | Fire `generate_lead`/Meta `Lead` on inquiry success; persist first-touch UTM as a `Json attribution` field on Inquiry |
| MKT-206 | Public | S | Marketing+FE | Mirror `order_submitted`/`custom_order_submitted`/`newsletter`/`contact` to `fbq`/`gtag` via a shared `src/lib/analytics.ts` |
| MKT-209 | Public | S | FE | Skip share-composer (`wa.me/` no number) in `WhatsAppTracker` so shares don't inflate `whatsapp_cta_click`/Contact |
| MKT-205 | Public | M | Marketing | Consent gate (LiquidGlass banner, existing tokens) before Pixel/GA fire; then flip CSP to enforced |
| MKT-207 | Shared | S | Full-stack | `sendOrderNotification` (never-throw) from both order actions — blocked-popup leads no longer sit unseen |
| MKT-203 | Public | S | Content+FE | Surface existing testimonials on product + custom-order via one `getTestimonials(take)` helper |
| MKT-210 | Public | S | Content+FE | Render 1–2 testimonials + "recent commissions" link on `/custom-order` |
| MKT-204 | Public | S | FE | Conditional-spread `images` in product/blog OG so the Satori fallback cards activate; add portfolio OG card |
| UIUX-607 | Public | S | FE/UX | `aria-invalid` on SWATCH/SIZE groups + uploader; role/id on the OrderField error `<p>`; extend focus recovery + `scrollIntoView` (closes A11Y-402 public half) |
| UIUX-609 | Public | S | Content/UX | Branch shop empty-state copy on `hasActiveFilters` — "first pieces being poured" for the launch catalog |
| ENG-807 | Public | S | Full-stack | Cap `/search` `q` at 120 chars, matching the shop action |
| SEO-502 | Public | M | SEO+FE | Crawlable `?page=N` `<Link>` fallback on `/shop` + `/shop/[category]`; extend CollectionPage ItemList |
| SEO-503 | Public | S | SEO | Self-canonicalise `/blog?page=N` + " — Page N" titles |
| SEO-504 | Public | S | SEO | Homepage `title:{absolute}` — single brand, ≤60 chars |
| SEO-505 | Public | S | SEO | Move Review/AggregateRating off the self-serving LocalBusiness node |
| SEO-506 | Public | S | SEO | Add WebSite JSON-LD node + SearchAction (closes SEO-501 residual) |
| SEO-507 | Shared | S | SEO | Un-disallow `/whatsapp-order` (its `noindex` does the job); add `X-Robots-Tag` to `/studio` |
| SEO-508 | Public | S | SEO | Canonicals on `/privacy` + `/terms` |
| SEO-509 | Public | S | SEO | VisualArtwork/CreativeWork JSON-LD on portfolio detail |
| SEO-501 | Public | S | SEO | (register residual) WebSite node + `BlogPosting` subtype — merged into SEO-506 |
| SEO-004 | Public | S | SEO | (prior Partial) offers node for price-shown products |
| SEO-005 / MKT-010 | Public | S | SEO/Content | (prior Open/Partial) keyword-bearing, offer-clearer hero H1 |
| MKT-004 / MKT-006 | Public | S | Owner/FE | (prior Open/Partial) seed real testimonials; add photos + product-page reviews |

- **Exit criteria:** submitted orders produce a Pixel `Lead`; UTM lands on the Inquiry and shows in studio; shares don't fire Contact; pixels only after consent; a blocked-popup order emails the owner; testimonials render on product + custom-order; media-less products/posts/portfolios get a branded OG card; a required-swatch-only failure focuses + announces; `/shop` page 2 is crawlable; Rich Results validates Product/WebSite/Article/Breadcrumb/FAQ; legal pages self-canonicalise.
- **Dependencies:** Phase 0 CSP allowlist already covers analytics/pixel hosts; MKT-205 consent precedes CSP enforce. **Risks:** consent friction, event-name churn → freeze names in `analytics.ts` first. **Rollback:** all additive; feature-flag pixel + consent.

## Phase 2 — Studio Workflows & Admin UX (Studio)

| ID | Scope | Effort | Owner | What |
|----|-------|:------:|-------|------|
| UIUX-604 | Studio | S | Full-stack | Point inquiry "Open in WhatsApp" at the **customer's** number via `buildWaLink(greeting, inquiry.phone)` |
| ENG-805 | Studio | M | Full-stack | Paginate + `select`-scope the inquiries inbox (drop full `whatsappMessage`/Json per row) |
| UIUX-606 | Studio | M | Product/UX | `useUnsavedChangesGuard(isDirty)` across the 5 long-form editors (+ optional blog draft snapshot) |
| MKT-208 | Studio | M | Full-stack | `/studio/subscribers` list + CSV export + dashboard count — make the newsletter table usable |
| UIUX-610 | Studio | M | Product/UX | Add `CLOSED` InquiryStatus terminal state (Badge outline) + "Mark closed" in BulkBar/detail |
| UIUX-611 | Studio | S | FE/UX | Link dashboard inquiry rows; `STATUS_LABELS` not raw enums; drop "(Phase 5/5B)" jargon |
| UIUX-612 | Studio | S | FE/UX | Show per-row import errors (title + reason) in the approve dialog, not just console |
| UIUX-608 | Public | S | FE/UX | Add `/search` entry points (header icon, mobile menu, footer, 404) — the built route is orphaned |
| UIUX-601 | Studio→Shared | S | Full-stack | (register residual) wire tagline/JSON-LD/brandName/logoUrl from settings; dedupe announcement fallback |
| UIUX-602 | Studio→Shared | M | Product/UX | (register residual) promote shared `FormSection`; split `portfolio-form`; add autosave/guard (pairs with UIUX-606) |
| A11Y-402 | Shared | S | FE/UX | (register residual) shared `FieldError` + `aria-invalid`/`describedby` across studio forms |
| A11Y-404 | Studio | S | FE/UX | Add `.dark` class to AuthShell so studio auth focus rings use the tuned `--ring #5b9dff` |
| A11Y-406 | Studio | S | FE/UX | `has-[:focus-visible]` ring on studio upload labels (media + import) |
| DS-703 | Studio | S | DS+FE | Add `.dark` to studio dark-painted chrome (sidebar/mobile-nav/bulk-bar/auth); replace `text-red-200` with `text-destructive` (pairs with A11Y-404) |
| DS-704 | Studio | S | DS | Add `--success`/`--warning` functional tokens; replace ad-hoc emerald/amber |
| DS-705 | Studio | S | DS | Replace `hover:text-electric` on auth links (GLOW-ONLY role violation) with `hover:text-porcelain` |

- **Exit criteria:** the inquiry reply button opens a chat with the customer; the inbox stays fast at 10k+ rows; leaving a dirty editor prompts; the owner can see/export subscribers; dead leads get a non-destructive `CLOSED`; dashboard rows are clickable with friendly labels; `/search` is reachable from chrome; studio auth focus rings clear 3:1; studio status colours are tokenised.
- **Dependencies:** ENG-801 (Phase 0) underlies settings freshness for UIUX-601; A11Y-404/DS-703 are the same `.dark`-scope fix — do together. **Risks:** editor refactor regressions → migrate one content type at a time (products last). **Rollback:** keep old form components behind a flag per migrated editor.

## Phase 3 — Performance & Shared Architecture (Public + Studio)

| ID | Scope | Effort | Owner | What |
|----|-------|:------:|-------|------|
| PERF-304 | Public | M | Perf+FE | Move preview off `searchParams` (from ENG-802) so `revalidate=300` ISR actually caches the catalog |
| PERF-305 | Public | M | Perf+FE | Stop the reduced-motion element-type flip: render `motion.div` unconditionally with `initial={false}` on first paint |
| PERF-306 | Public | S | Perf+FE | Defer/`(hover:hover)`-gate the second product-card hover image — stop doubling catalog bytes on mobile |
| PERF-307 | Public | S | Full-stack | Wrap `getProduct`/`getPortfolio` in React `cache()` (dedupe metadata vs page) |
| PERF-308 | Public | S | Perf | IntersectionObserver-pause off-screen `GradientMesh` drift |
| PERF-309 | Shared | S | Full-stack | `formats:['image/avif','image/webp']` in `next.config.ts` |
| PERF-301 | Shared | S | Perf+FE | (register residual) conditional dynamic-import GSAP/Lenis in `SmoothScrollProvider` |
| PERF-302 | Shared | S | Full-stack | (register residual) explicit pg `PoolConfig` (`max:5`) on `PrismaPg` |
| PERF-008 | Public | S | Perf | (prior Open) CSS-keyframe the FloatingWhatsApp mount so `motion` leaves the baseline |
| PERF-006 | Shared | S | Full-stack | (prior Partial) drop the unused `three` dependency |
| A11Y-401 | Shared | S | FE+DS | (register residual) contrast sweep: selected swatch (UIUX-002), blog/portfolio/search sapphire links, marginal `/45` microcopy → existing `*-ink` tokens |
| A11Y-403 | Public | S | FE | `[&_a]:text-sapphire-ink` in `PROSE_LEGAL_CLASS` — CMS/legal links from 2.77:1 → 5.38:1 |
| A11Y-405 | Public | S | FE | `onCloseAutoFocus` focus-restore on the portfolio lightbox (mirror product gallery) |
| A11Y-407 | Public | S | FE | Full-opacity `focus-visible:ring-ring` on the quick-view trigger |
| A11Y-409 | Public | M | FE | Optional `captionsUrl` (WebVTT) + `<track>` for product/portfolio videos |
| A11Y-410 | Public | S | FE | Raise before/after label chips to `bg-midnight/75 text-porcelain/90 text-xs` |
| A11Y-408 | Public | S | FE | `aria-hidden` the decorative kinetic marquee |
| A11Y-411 | Public | S | FE | Custom-order footnote `text-xs text-foreground/60` (twin of fixed UIUX-P32) |
| DS-702 | Public | M | DS+FE | Fix inverted light-theme utilities on the dark canvas (`hover:bg-foreground/10`, scroll rule, `inverse` Button variant) |
| DS-701 | Shared | S | DS | (register residual) `var(--border)` at globals.css:189; tokenise `bg-[#c9a233]`; `text-gold-ink` on stray pills |
| DS-706 | Shared | S | DS | Interpolate `BRAND` into the password-reset email template |
| DS-707 | Public | S | DS | Delete dead `data-header-theme`/`data-ink` plumbing + stale comment |
| DS-708 | Public | S | DS | Extract a shared `MediaChip` for the overlay-chip recipe |
| ENG-810 | Shared | S | Full-stack | Hoist copy-pasted `isRenderableSrc`/`clientIp`/`nullIfEmpty` into shared modules |
| UIUX-001 | Shared | M | DS+FE | (prior Open) differentiate `base`/`panel` bands (hairline/shadow or raised tone) |
| UIUX-008 | Public | S | FE | (prior Open) monogram/name-on-tile for image-less category cards |
| DS-006 | Shared | S | DS | (prior Partial) token-link the `glass-dark` rgba + fix off-brand `icon.svg` hex |

- **Exit criteria:** catalog routes serve from ISR cache (not per-request SSR); no post-hydration page blank/re-fade; catalog ships ~half the image bytes on mobile; AVIF served for Blob media; GSAP/Lenis absent from static routes; all core text ≥4.5:1 and focus ≥3:1 per theme; portfolio lightbox restores focus; zero un-tokenised brand hex; `three` gone from `package.json`.
- **Dependencies:** ENG-802 (Phase 0) unblocks PERF-304; Phase 1 measurement in place so perf wins are provable in field data (Speed Insights already installed). **Risks:** dynamic-import waterfalls delaying hero animation → preload on viewport intersection; band-differentiation needs design sign-off. **Rollback:** per-route commits; token remap behind semantic aliases so component classes don't churn.

## Fallback: Prioritized Fix Order (2026-07-19)

If gates change (security event, finding volume, dev-days): **SEC-105 → SEC-106 → SEC-107 → ENG-802 → ENG-811 → SEC-109 → SEC-102 → SEC-103 → ENG-803 → UIUX-605/ENG-806 → ENG-801 → SEC-108 → SEC-110 → ENG-804/808/809 → MKT-201 → MKT-206 → MKT-207 → UIUX-604 → UIUX-607 → SEO-502 → ENG-805 → UIUX-606 → PERF-304 → PERF-305 → PERF-306 → A11Y-403 → A11Y-404/DS-703 → A11Y-401 → DS-702 → MKT-205 → MKT-203/210 → SEO cluster (503–509) → UIUX-608/609/610/611/612 → MKT-208 → remaining PERF/A11Y/DS/ENG per phase order → prior-Open items (SEO-005/MKT-004/UIUX-001/UIUX-008/PERF-008) → SEC-009 (owner).**

---

# Phase 5 Backlog — ranked residuals (2026-08-09, post Step-5/6)

All Blocker/Critical/Major findings from the 2026-08-09 re-audit
(audit-2026-07-master.md Appendix D) are closed. What remains, in priority order:

| # | ID / item | Scope | Effort | What & why |
|---|---|:--:|:--:|---|
| 1 | I18N-901 (structural) | Shared | M | Per-route-group root layouts so `<html lang/dir>` is SERVER-rendered per locale (today a pre-paint script mirrors it — correct for AT/translate UIs, but no-JS crawlers still see lang="en"). Moves fonts/analytics into two root layouts; test /studio + error routes. |
| 2 | Mirror flip (owner step) | Shared | S | Run `node scripts/mirror-generated-images.mjs` on an open network, commit `public/images/`, run `npm run db:seed:blogs` once (categories reconcile on deploy), then drop the cloudfront entries from next.config.ts AND isOptimizableImageSrc in one commit. Ends the third-party-CDN dependency for the 60 generated covers. |
| 3 | Studio dark theme | Studio | M-L | Master-brief Section A wants Studio theme-switchable; Adjusted to backlog because the `.dark` block is tuned for the public canvas and ~20 admin screens are contrast-audited light-only. Needs a studio-scoped dark token pass + toggle + AA sweep. |
| 4 | PERF-311 residual | Public | L (Optional) | ~63 KB gz of CJK @font-face CSS still render-blocking on public routes (inert bytes — unicode-range gates downloads). Only fix if field data demands: self-hosted coarser-sliced JP/SC faces or per-locale `<link>` loading. |
| 5 | Instagram-feed fallback strings | Public | S | "View us on Instagram" / "See our latest work on WhatsApp" / sr-only "(opens in new tab)" hardcoded English — add to catalogs ×9. |
| 6 | Server error strings in order actions | Public | S | GENERIC_ERROR / RATE_LIMITED_ERROR / "Please fill: …" are English-only; localize via getTranslations({locale}) now that actions carry the locale. |
| 7 | whatsapp-order page copy | Public | S | Recovery-page body + metadata title still English (greeting now localized, I18N-903); translate the page copy ×9. |
| 8 | Footer-links focus ring | Public | S | A11Y-412 fixed the toggle; the adjacent footer links share the same weak light-theme ring on midnight (pre-existing) — apply ring-azure there too. |
| 9 | DS-708 MediaChip / UIUX-001 band differentiation / other open Appendix-C Minor-Polish | Mixed | S-M | Carried unchanged from the 2026-07-19 register — see Appendix C.3 statuses. |
| 10 | Higgsfield scratch website cleanup (owner) | — | S | Delete the unused `resinriva-assets` website project (id d4cbd1bc-…) from the Higgsfield dashboard — created only to probe an asset-transfer route. |

Optional — outside current brand scope: extending the locale set beyond the
shipped 9 (the master brief lists ~29; each added locale is catalog-file +
config-entry only, zero refactor, per the I-series architecture).

### Phase 5 addendum (2026-08-09, continuation session)

- **#2 CLOSED — mirror flip complete:** the 60 covers are first-party in
  `public/images/{categories,blog}` (11 MB WebP, committed by the
  `mirror-images.yml` Actions run — the sandbox/remote egress policies block
  the CDN host, Actions runners don't). Local end-to-end verified: category
  seed + reconcile-blog-covers flipped all 60 DB rows to `/images/...` and
  `/blog` renders zero cloudfront references through the optimizer. On the
  first production deploy of this branch the bootstrap reconcile flips the
  prod DB the same way, automatically. LAST cleanup (one commit, after that
  deploy is confirmed green): drop the `d8j0ntlcm91z4.cloudfront.net`
  entries from next.config.ts (remotePatterns + CSP img-src) and
  `isOptimizableImageSrc`; the mirror workflow + script can be deleted or
  kept as re-usable tooling.
- **#1 CLOSED — I18N-901 structural fix shipped:** per-tree root layouts
  (`app/[locale]/layout.tsx` and new `app/studio/layout.tsx` each render
  their own `<html>`; shared defaults in `app/shared-metadata.ts`), so
  `<html lang/dir>` is SERVER-rendered per locale — `/ar` is document-level
  RTL, `/hi` is `lang="hi"` with no script involved. Fully-unmatched URLs go
  through the new `app/global-not-found.tsx` (experimental `globalNotFound`
  flag) with a real 404 status + the branded panel, matching the old root
  not-found (English — global-not-found is static and cannot localize; the
  in-chrome `[locale]/not-found` still handles in-tree notFound()).
- **#5–#8 CLOSED** (commit b61f659): IG-fallback strings, whatsapp-order
  page copy + copy-button, order-action error strings localized ×9;
  footer link/social focus rings on azure. **DS-708 verified already
  closed** (shared `ui/media-chip.tsx` in use; gallery spans are button
  labels, not the chip recipe).
- **NEW — ENG-813 (Major, pre-existing, Public):** content-route
  `notFound()` responses (unknown product/blog/category slugs) stream a
  **200** soft-404 — the `[locale]/loading.tsx` boundary + async layout
  commit the status before `notFound()` unwinds. Verified identical on the
  PRE-restructure build (product/blog/category all 200), so this is not a
  regression from the layout split; fully-unmatched URLs correctly 404 via
  global-not-found. Remediation options, needing an owner UX call: drop the
  top-level `[locale]/loading.tsx` (status then commits after the page
  resolves — slower perceived navigation on cold loads), or move slug
  existence checks ahead of the streamed shell (per-route generateStaticParams
  + dynamicParams=false for fully-static catalogs, or a lightweight
  exists-query in the layout). Until then, per-page `robots: noindex` on the
  not-found metadata and the sitemap keep crawler impact bounded.

### Round 3 (2026-08-09, post-merge continuation)

- **NEW + FIXED — ENG-814 (Major, Shared):** the blog-cover reconcile's
  `NOT { coverImage: cover }` guard is NULL under SQL three-valued logic for
  NULL covers — production logged "updated 0" while all 55 posts sat empty
  (local tests passed only because local rows held CDN URLs). Guard dropped;
  verified from the reproduced prod state (55 NULLs → 55 local covers). The
  prod flip lands on the next deploy.
- **Step-2 cleanup DONE:** cloudfront host removed from remotePatterns, CSP
  img-src and isOptimizableImageSrc (prod rows never held CDN URLs — they
  were NULL, so the drop is safe immediately).
- **ENG-813 FIXED (owner call received):** `[locale]/loading.tsx` removed —
  it committed a 200 before notFound() could unwind. Unknown
  product/blog/portfolio/category slugs now return real 404s (verified);
  [locale]/not-found gains robots noindex as belt-and-braces. Navigation
  keeps the current page until the next is ready (Next default) instead of
  the wordmark pulse.
- **Studio dark theme SHIPPED (backlog #3):** see commit; default light,
  opt-in dark, owner eyeball of screens recommended. Toaster theming =
  polish follow-up.
- **Higgsfield scratch project:** confirmed present and never deployed
  (`resinriva-assets`, id d4cbd1bc-…); the MCP exposes no delete — remove it
  from the Higgsfield dashboard (Websites → resinriva-assets → delete).
- **Prod category covers:** the deploy logged "filled 0 of 16" — prod's 5
  generated-category rows are neither NULL nor the CDN URL (owner-set or
  absent); the non-destructive seed correctly leaves them alone. If the
  owner wants the generated art there, clear those category images in
  Studio and redeploy (the seed then fills the local /images files).

### Round 4 (2026-08-09) — FINAL combined theme (owner decision)

The owner chose ONE fixed theme blending both palettes — no toggle. This is
the design the token architecture was originally built for:

- **Light porcelain canvas** (`:root` tokens) as the page base; **dark
  Midnight Sapphire bands** scoped per surface with the `dark` class:
  Section tones midnight/deep-ocean/void, the 7 gradient-dopamine CTA
  bands, the header chrome, the footer. `base`/`panel` sections render the
  original porcelain/white light bands. The `.dark` token block stays — it
  now serves the scoped bands (and the studio's dark chrome), not a mode.
- **Removed:** both public toggles + the studio toggle, both pre-paint
  scripts, rr-theme/rr-studio-theme storage, the Theme catalog namespace ×9
  (parity kept). Studio returns to fixed light with its dark sidebar.
- **Contrast fixes for the mix:** `.eyebrow` now uses the theme-resolved
  `--sapphire-ink` (sapphire 7.2:1 on light bands, azure on dark — azure
  alone was 3.6:1 on porcelain); the custom-order timeline hairline
  `bg-porcelain/15` → `bg-foreground/15`.
- **Verified:** automated band audit (DOM walk flagging dark-only ink
  outside `.dark` scopes, and text-azure) = ZERO flags across 17 rendered
  pages incl. /hi, /ar and an article; no literal `text-midnight` in public
  components (the Phase-2 semantic sweep holds — DS-702's inverted-utility
  concern dissolves under scoped tokens); 404s/hreflang/root-canvas smoke
  all green; tsc/eslint/build clean.
