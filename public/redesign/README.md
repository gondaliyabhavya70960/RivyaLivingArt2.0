# /public/redesign — Liquid Luxury v3.1 asset set

Fourteen generated brand assets for the v3.1 redesign (spec:
`design/awwwards-redesign-spec.md`). They are referenced by eleven
site-image slot fallbacks in `src/lib/site-images.ts` and by the mockups in
`design/mockup/`.

## ⚠️ Images are not in git yet — one manual step

The GitHub API channel used for this branch cannot write binary files, so
the 14 `.jpg` files travel out-of-band. They are attached in the design
handoff (and reproducible from `design/mockup/assets/`). To complete the
setup:

1. Open this folder on the `redesign/liquid-luxury` branch on github.com.
2. **Add file → Upload files**, drop all 14 `.jpg` files in, commit to the
   same branch.

Expected filenames (all web-optimized JPEG, 83–422 KB):

| File | Used for |
|---|---|
| `hero-pour.jpg` | `home.hero` poster, `home.why.heirloom` |
| `texture-resin-flow.jpg` | `home.bespoke`, `about.hero`, `portfolio.hero`, `studio.login`, `home.why.slowMade` |
| `doorway-memory.jpg` | `home.collections.create`, `customOrder.hero`, `home.why.bespoke` |
| `doorway-collectible.jpg` | mockup doorways / large-format reference |
| `doorway-gifts.jpg` | mockup doorways / gifts reference |
| `maker-hands.jpg` | `home.why.handcrafted` (maker slots intentionally NOT repointed — real photo required per §15.2) |
| `product-bangle.jpg` | PDP/product reference |
| `product-varmala-frame.jpg` | PDP/product reference |
| `product-coasters.jpg` | PDP/product reference |
| `product-platter.jpg` | PDP/product reference |
| `insitu-bangle-wrist.jpg` | PDP in-situ reference |
| `insitu-tray-table.jpg` | in-situ interior reference |
| `testimonial-home.jpg` | testimonial band reference |
| `visual-404.jpg` | 404 page visual |

Once uploaded, every repointed slot renders these immediately; each remains
owner-overridable from **Studio → Site Images** as before.
