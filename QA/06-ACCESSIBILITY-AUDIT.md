# Accessibility audit — NOT AUDITED

No axe run, no keyboard walkthrough, no screen-reader pass, no contrast
measurement. Execution was unavailable.

## This is the best-covered area in CI

Unusually, **a11y is gated on every PR** — which is why this gap matters less
than the others:

- `a11y-audit.mjs` — axe-core over 12 public routes at **1440px and 390px**.
  Fails on critical or serious (§19.6). Moderate/minor printed, not failed.
- `redesign-audit.mjs` — structural rules at both widths: exactly one `h1`, no
  duplicated section heading, no ellipsis in an accessible name, alt text that
  describes the picture, no horizontal overflow.
- `studio-audit.mjs` — signs in and sweeps the 30 staff routes the public
  audits cannot reach, at both widths.
- `lighthouse-audit.mjs` — a11y >= 95.

So PR #138 will produce real accessibility results. **This pass did not.**

## What CI cannot reach

Run these by hand — they need content the CI database has no seed for:

```bash
node scripts/a11y-audit.mjs "/en/product/<slug>,/en/blog/<slug>,/en/portfolio/<slug>,/en/p/<slug>"
node scripts/a11y-audit.mjs "…" --w 390
```

## What automation cannot catch

axe finds perhaps a third of real barriers. Still needed:

1. **Keyboard.** Tab through the header mega-menu, the drawer, the search
   overlay and the order form. The drawer and overlay are opened via module
   signals from non-descendant triggers — that is exactly the pattern that
   breaks focus return. Verify focus goes into the overlay and comes **back to
   the trigger** on close, and that Escape works.
2. **RTL.** Arabic is shipped. Confirm the mirroring is real, not just text
   direction — grep storefront components for physical `ml-/mr-/pl-/pr-/left-/
   right-` that should be logical `ms-/me-/ps-/pe-/start-/end-`.
3. **Reduced motion.** Both pinned scrubs (homepage material story, process
   steps) must have a static fallback.
4. **Screen reader.** One pass over the order flow with VoiceOver or NVDA.
5. **Contrast.** `champagne` is 2.35:1 on mineral and has an AA companion
   (`champagne-ink`); confirm the companion is used wherever champagne carries
   text, and that champagne is never a fill or a button background.
