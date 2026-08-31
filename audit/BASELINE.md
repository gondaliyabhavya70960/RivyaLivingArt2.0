# Part 0 — Measured baseline (v2.0-audit-baseline)

Captured 2026-08-20 against the production build (`next build` + `next
start`), Lighthouse **mobile** emulation, simulated throttling, one run per
route. **Sandbox caveat:** this environment's proxy blocks all external image
hosts and Vercel's analytics/speed-insights scripts and throttles CPU —
Performance/LCP are therefore **lower bounds** and Best-Practices carries a
constant −4 from proxy-blocked-resource console errors. A11y/SEO are valid as
measured. Re-run `scripts/audit-lighthouse.mjs` (BASE=<preview-url>) on the
Vercel preview for production-true numbers; these local numbers are the
regression thresholds for every later phase gate (same environment, same
method — compare like with like).

## Lighthouse (before → after remediation)

| Route | Perf | A11y | BP | SEO | LCP | CLS |
|-------|------|------|----|----|-----|-----|
| `/` | 64 → 76 | 100 → 100 | 96 | 100 | 6.5 → 5.4s | 0.024 → 0.023 |
| `/shop` | 71 → 72 | 100 → 100 | 96 | 100 | 7.3 → 6.9s | 0 → 0 |
| `/product/[slug]` | 76 → 77 | 100 → 100 | 96 | 100 | 5.0 → 5.4s | 0.023 |
| `/blog` | 74 → 76 | 100 → 100 | 96 | 100 | 6.1 → 5.9s | 0.023 |
| `/blog/[slug]` | 77 → 79 | **99 → 100** | 96 | 100 | 5.1 → 5.0s | 0.023 |
| `/about` | 68 → 72 | 100 → 100 | 96 | 100 | 6.6 → 6.4s | 0.023 |
| `/contact` | 69 → 71 | 100 → 100 | 96 | 100 | 6.5 → 6.8s | 0.023 |

## Crawl (19 route shapes, 393px mobile, axe WCAG 2 A/AA) — after

Zero axe violations · zero real console errors (all classified sandbox
artifacts) · zero broken local images · **zero horizontal overflow** (blog
fixed) · exactly one h1 per route · skip-link target on every page shape ·
404 returns 404 · WhatsApp CTA present on every storefront route ·
`whatsapp_cta_click` fires site-wide via the delegated tracker.
Raw data: `crawl-report.json`.

## Data integrity (read-only sweep, 4373 published products)

Blog (55) and portfolio (20) rows fully populated. Product content debt is
owner-side (see FINDINGS.md E-01/E-02/E-03): 103 missing descriptions, 19
without images (monogram fallback covers display), 0 testimonials, 6 external
image hosts hotlinked. No duplicate slugs, no price inconsistencies, no
malformed URLs.

## Dependency state

`npm audit --omit=dev`: 0 critical, 4 high — all documented (FINDINGS S-08
prisma-CLI chain, upstream-pending; S-09 xlsx, risk-accepted with owner
one-liner). next 16.3.1 · next-auth 5.0.0-beta.32 (@auth/core 0.41.3) ·
prisma 7.9.1. (Snapshot at capture; since closed — S-08/S-09 in FINDINGS.md:
highs now 0 via the deepmerge-ts override + the exceljs migration.)

## Part F reconciliation (guide assumptions → repo reality)

The implementation guide was written without repo access; these are the
authoritative mappings for Parts D–I:

| Guide assumes | Repo reality |
|---------------|--------------|
| `app/` paths, `/products`, `/blog` | `src/app/[locale]/(v2)/…`, `/shop`, `/product/[slug]` (next-intl, 9 locales incl. ar RTL — do not restructure) |
| Add Lenis | Already shipped: `SmoothScrollProvider` (Lenis) wraps the public tree |
| Add GSAP + ScrollTrigger + SplitText | Already shipped via `src/lib/gsap` dynamic-import pattern (H12): SplitTextHeading, HeroParallax, Reveal, PourCureShowcase, CraftChapters etc. |
| Add Motion (`motion/react`) | NOT installed — decide in Phase 1 whether Motion is needed at all; GSAP + CSS carry today's motion |
| Add `@theme` tokens `--ease-luxury`, `--duration-*` | Token law is DESIGN.md Appendix A in `src/styles/tokens.css`: `--dur-micro` (200ms), `--dur-enter`, `--ease-out` cubic-bezier(0.22,1,0.36,1) — the guide's new token names must NOT be added; map guide snippets onto A5 tokens |
| Prisma 6, fields `price`, `image`, `secondaryImage`, `gallery`, `post` | Prisma 7.9.1; `Product.priceMin/priceMax/showPrice`, `ProductImage[]` relation (`images`), `BlogPost.coverImage/publishedAt`; card hover-swap uses `images[1]` |
| Vercel Blob + Neon | @vercel/blob today (Cloudinary is the DESIGN.md target); Postgres |
| Add reduced-motion global net | Already shipped (single Appendix A collapse incl. animation-iteration-count) + per-effect guards + WCAG 2.2.2 MotionPauseToggle |
| Add smooth-scroll/`overflow-x` advice | Storefront uses `overflow-x: clip` discipline already; sticky verified working |
| Sticky WhatsApp CTA, card hover crossfade, skeletons, editorial blog/about, marquee, reading progress | All already shipped in Phases 5–7 |
| View Transitions flag | Not enabled — a Phase 2 decision (`experimental.viewTransition`) |
| `next/font` swap/preload | Shipped (`src/app/fonts.ts` + per-script fonts) |

**Hard rules (Part 0 of DESIGN.md, unchanged and re-verified):** no payment
gateway/checkout/cart payment; no customer accounts (staff-only /studio);
no AI-invented products; every order finalizes through wa.me/917096036250
with the Inquiry persisted first.

## Exit gate status

- P0: none found. P1: all closed (8/8 — see FINDINGS.md "Fixed").
- P2: quick set closed (21); remainder scheduled with IDs S-01…S-10.
- P3: all recorded as owner decisions E-01…E-05.
- Lighthouse ≥90/95 targets: a11y 100 ✓ SEO 100 ✓ BP 96* / Perf 71–79* —
  *sandbox lower bounds, exceptions documented above; re-verify on preview.
- 0 console errors / broken images / axe critical-serious across the crawl ✓
- Security headers configured (CSP report-only by design — flip tracked in
  FINDINGS); rate limiting + upload validation re-verified ✓
- WhatsApp CTA tracking verified on every placement class ✓
- Data-integrity script: no structural issues ✓ (content debt escalated)
- Motion inventory: keep/remove/replace recorded (removals landed) ✓
- Part F reconciliation recorded above ✓ — closes the guide's assumptions.

Tag `Main` as `v2.0-audit-baseline` once PR #86 merges; then Phase 1 work
starts on a fresh branch per the guide's sequence rule.
