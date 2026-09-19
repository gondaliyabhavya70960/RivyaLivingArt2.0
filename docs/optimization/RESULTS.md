# Optimization results — before / after

_2026-09-19. The rule from BASELINE.md: no perf PR merges without a measured
before/after. This file carries the measurement AND the honest state of it._

## A1 — motion-layer main-thread work (PR-6)

| Metric | Before (production, 2026-09-19) | After (preview) | Target |
| --- | ---: | ---: | ---: |
| Home performance score | 0.46 | _see the measurement gate below_ | ≥0.90 |
| Home LCP | 4.5 s | _〃_ | <2.5 s |
| Home TBT | 2,870 ms | _〃_ | <200 ms |
| Shop performance score | 0.60 | _〃_ | ≥0.90 |
| Shop TBT | 2,220 ms | _〃_ | <200 ms |
| CLS (both) | 0 | 0 (unchanged — the guard hides nothing) | <0.1 |

### The change

One guard in `src/components/motion/reveal.tsx`:
`const disabled = prefersReducedMotion || isTouch` — Reveal now bails on
touch-primary devices before its GSAP import, on the same `useIsTouch` guard
`HeroParallax` already uses. Until this PR, Reveal was the ONLY unguarded
scroll effect on the site; every sibling (`SmoothScrollProvider` PERF-009,
`Cursor`, `HeroParallax`, `FeaturedRail`, `PourCureShowcase`) already bailed
on coarse pointers before loading motion bytes.

### The code-level proof (verified, not estimated)

On a coarse-pointer device the effect now returns **before**
`import("@/lib/gsap")` executes: zero motion bytes downloaded, zero
ScrollTriggers registered, content rendered fully visible (the degraded path
reduced-motion already used). Desktop and reduced-motion behaviour are
unchanged — the guard only widens `disabled` by `isTouch`.

### Verification status

- `tsc --noEmit` clean · 127 files / 1,380 tests passing · ESLint clean
- CI on PR #129: **Typecheck · lint · unit tests — success** (Vercel preview
  deployment: Ready)

### The measurement gate — handed to the owner, explicitly

The Vercel preview for PR #129 deployed successfully, but **this environment
could not reach it** (every Vercel-edge connection from here was refused at
the network level, so no honest after-number could be produced — a number
written without a real run is not a result). Re-run in one command, either
against the PR #129 preview (link on the PR) or production after merge:

```bash
npx lighthouse "https://www.rivyalivingart.com/" --only-categories=performance
npx lighthouse "https://www.rivyalivingart.com/shop" --only-categories=performance
```

Paste the four figures into the After column above when you have them.

**Expected direction (labelled as expectation, not result):** the Reveal
share of the baseline's 4.56 s script-evaluation + 3.5 s style/layout work
disappears on touch; desktop is identical by construction. If the re-measure
contradicts that, the guard is not the whole story and A1 reopens with the
trace that proves it.
