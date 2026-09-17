# /public/redesign — Liquid Luxury asset set

Two sets live here, and the difference between them is binding.

## 1. The brand set — 15 files, publishable

`hero-pour` · `texture-resin-flow` · `doorway-{collectible,memory,gifts}` ·
`maker-hands` · `product-{bangle,varmala-frame,coasters,platter}` ·
`insitu-{bangle-wrist,tray-table}` · `testimonial-home` · `visual-404` ·
`og-home` (1200x630 social card).

Spec: `design/awwwards-redesign-spec.md` §4. Twelve site-image slot fallbacks
in `src/lib/site-images.ts` resolve to these; each stays owner-overridable from
**Studio → Site Images**, and deleting the override restores the file named
here.

They arrive already graded and web-optimized (85–432 KB) from the design
handoff, so `scripts/optimize-redesign-assets.mjs` reads them only to derive
LQIP placeholders — a second lossy pass would cost quality to save nothing.

> **These were missing from git until 2026-09-17.** The branch that repointed
> the slots could not write binaries through its API channel, so eleven
> fallbacks pointed at files no commit carried: every one 404'd from
> `/_next/image`, and `site-images.test.ts` had been failing on `main` the
> whole time. They are tracked now. The lesson is the test's, not the
> uploader's — a slot fallback is a promise that a file exists, and the suite
> is what keeps it one.

## 2. The catalog set — 45 files under `catalog/`, NEVER publishable

`catalog/heroes/product-hero-001…035-4x5.webp` (1200w) and
`catalog/scenes/product-scene-001…010-16x9.webp` (1920w), built from the
owner's Drive library by `scripts/optimize-redesign-assets.mjs`.

**The placeholder rule (plan §4.6) is binding.** Every file under
`catalog/` is a design/dev placeholder for a product that does not exist yet.
It may render in dev, in preview deployments, in captioned "concept
visualisation" frames and in Studio seed data — **never as the imagery of a
purchasable product**. Enforcement is presentation-layer only, no schema
change: `isPlaceholderAsset()` in `src/lib/placeholder-assets.ts` is the one
copy of the path test. Owner photography replaces these product by product.

Native sizes are preserved — the Drive masters measure 1122x1402 and
1672x941, under both caps, and the pipeline passes `withoutEnlargement` so
they are never silently upscaled. That is fine for cards, rails and PDP
stages; a full-bleed ≥2000px hero needs a real upscale pass first (plan §5.4
step 3), which a resize filter is not.

## Rebuilding

Sources stay out of git (plan §7, binary hygiene — the raw Drive PNGs are
~2.2 MB each). Drop them into `assets-inbox/{heroes,scenes}/` and run:

```
node scripts/optimize-redesign-assets.mjs           # build
node scripts/optimize-redesign-assets.mjs --check   # verify, write nothing
```

File IDs for a scripted download are in `design/implementation-plan.md` §4.7.
