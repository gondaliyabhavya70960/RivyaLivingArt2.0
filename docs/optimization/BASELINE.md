# Performance baseline — measured, not estimated

_2026-09-19. Lighthouse (mobile profile, simulated throttling) against
production, one run per page — treat as indicative, rerun before/after any
perf PR (the prompt's own rule: measure → optimize → compare)._

## Lighthouse, production

| Metric | Home `/` | Shop `/shop` | Target |
| --- | ---: | ---: | ---: |
| Performance score | **0.46** | **0.60** | ≥0.90 |
| FCP | 1.8–2.1 s | 1.8 s | <1.8 s |
| **LCP** | **4.5 s** | 2.9 s | <2.5 s |
| **TBT** | **2,870 ms** | **2,220 ms** | <200 ms |
| CLS | **0** | **0** | <0.1 ✅ |
| Speed Index | 7.4 s | 5.8 s | <3.4 s |
| Total page weight | 910 KiB | 918 KiB | — ✅ |

## What the diagnostics say

- **The bottleneck is main-thread work, not bytes.** Page weight is lean
  (910–918 KiB, images optimized, unused JS only ~48 KiB, largest JS chunks
  ~75 KB and ~46 KB). Main-thread breakdown on home: **script evaluation
  4.56 s + style/layout 3.5 s** of 10.8 s total. Bootup alone is 4.7 s.
- Root-cause direction (to confirm in PR-6 with per-route CPU traces): the
  interaction/motion layer — Lenis smooth scroll, GSAP timelines, custom
  cursor, scroll hairline, route progress, reveal observers — keeps a
  throttled mobile CPU busy. The effects are individually small; the sum is
  the TBT figure above. CLS 0 and the LCP-never-animated rule are already
  right; the problem is *when and how long* the layer runs, not what it draws.
- LCP on home (4.5 s) follows from the same cause: FCP lands at ~2 s and the
  hero's first frame waits on the main thread the motion layer is holding.

## Already in place (do not redo)

- ISR caching on detail pages (`revalidate` per route, verified via
  `x-nextjs-prerender`), sitemap cached at 1 h, tagged settings cache
- `next/image` + responsive sizes, modern formats, lazy offscreen images;
  page weight figures above are the proof
- Reduced-motion global collapse (CSS + JS media checks)
- Vercel Analytics + Speed Insights wired (real-user metrics exist in the
  Vercel dashboard — the owner sees what synthetic tests can't show)
- Tooling in-repo: `npm test` (1,351 tests), `test:e2e` (Playwright smoke),
  `alt:check` in CI, Lighthouse + chrome-launcher as devDeps

## Baseline for business flow (qualitative)

Verified during QA (2026-09-19): PDP renders the order panel above the fold;
the WhatsApp handoff is one click; the pipeline has 0 genuine inquiries —
perf work must not add JS to the order path without re-measuring TBT there.

## The comparison rule

Every perf PR re-runs this file's two pages plus the route it touches, and
appends the new numbers to `RESULTS.md` beside the baseline. A PR that
cannot show a measured improvement in its target metric does not merge —
that is the prompt's Understand → Measure → Audit → Optimize → Compare rule
made into a gate.
