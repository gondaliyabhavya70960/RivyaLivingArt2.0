# Liquid Luxury v3.1 — interactive mockups

Three self-contained HTML mockups (open any of them in a browser — no build,
no server) implementing the redesign in `../awwwards-redesign-spec.md`:

| File | What it shows |
|---|---|
| `index.html` | Home: preloader, kinetic hero, manifesto word-scrub, hover-expanding doorways, pinned horizontal featured rail, pinned process scrub, testimonials rotator, maker parallax + counters, journal cursor previews, magnetic CTAs, marquee footer |
| `pdp.html` | Product page: sticky gallery with hover zoom + lightbox, option pills/swatches, live WhatsApp order preview, spec accordions, story band, related rail, sticky mobile CTA |
| `custom-order.html` | 4-step commission wizard: meniscus progress line, visual material cards, real image dropzone, live WhatsApp review, animated success state with order number + real wa.me link |

## ⚠️ One manual step (same as the images)

Binary/HTML files can't be written through the API channel that produced
this branch, so the three `.html` files and the 14 `.jpg` images travel in
the design handoff. Upload them on github.com into this folder (**Add file →
Upload files**, commit to `redesign/liquid-luxury`):

- `index.html`, `pdp.html`, `custom-order.html` → `design/mockup/`
- the 14 `.jpg` assets → `design/mockup/assets/` **and** `public/redesign/`
  (see `public/redesign/README.md` for the list)

Until then, the live interactive preview saved with the handoff (version
`9f1c6e0`) shows all three pages working end-to-end.

## Relationship to the production code

These are the reference implementations. The production translations in this
branch are:

- `src/components/storefront/featured-rail.tsx` — the pinned horizontal
  gallery (home §03), using the house `CatalogProductCard`.
- `src/components/storefront/collection-doors.tsx` — the hover-expanding
  doorways (home §05), CSS-only, six tiles.
- Styles appended to `src/app/globals.css` under the "Liquid Luxury v3.1"
  banner.

Mockups use CDN GSAP/Lenis for portability; production uses the repo's own
`@/lib/gsap` + `SmoothScrollProvider` guards (reduced-motion + coarse-pointer
safe).
