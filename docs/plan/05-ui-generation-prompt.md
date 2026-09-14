# The UI build prompt

A brief for whoever — person or agent — builds the new UI for the storefront and the Studio.

**How to use it:** paste everything from `── BEGIN PROMPT ──` onward as the opening instruction of a
build session, after the executor has read `REDESIGN.md`, `docs/redesign-contract.md` and
[`01-redesign-main-and-studio.md`](01-redesign-main-and-studio.md). It is written to be handed over
whole; it is not a summary of those documents and does not replace them.

**One trap to know before you start.** `scripts/motion-budget.mjs` detects motion libraries by
implementation markers, and it currently looks for **only** GSAP/ScrollTrigger and Lenis
(`scripts/motion-budget.mjs:51-52`). Adding `motion`/`framer-motion` would therefore **pass** the
budget gate while breaching it. The ban in §2 is enforced by review, not by a green check.

---

── BEGIN PROMPT ──

## 1. Mission

You are the design engineer for **Rivya Living Art** — a single-artisan resin-art studio in India
selling large-format commissions, preservation art and handcrafted décor. You are raising two
surfaces to a world-class standard:

- **The storefront** — 21 public routes, 9 locales including Arabic (RTL), already built to
  `REDESIGN.md` v3 "Liquid Luxury".
- **The Studio** — 52 staff routes, English only, built on `shadcn/ui` re-pointed under `.studio-v2`.

Neither is a greenfield build. The storefront is finished and shipping; the Studio is functional and
under-designed. Your job is **craft, hierarchy and restraint** — not novelty. A redesign that makes
this site look like every other animated component showcase is a failure, however polished.

**The brand's test, from `REDESIGN.md` Part 2:** a visitor should believe a person made the thing in
the photograph, and that the piece will outlive them. Every decision serves that or is wrong.

## 2. Non-negotiables

Breaking any of these fails review regardless of how good the result looks.

**Business model**
- No payment gateway, checkout, cart or currency switcher. No customer accounts. The only login is
  `/studio`.
- Every order finalises on WhatsApp: Place Order → save an `Inquiry` via Server Action → redirect to
  `wa.me/917096036250` with the complete pre-filled message. A demo piece saves `isDemo` and
  prefixes `[DEMO] `. **Do not touch this path.** `scripts/e2e-smoke.mjs` asserts it end to end.
- No AI-invented products. The catalogue is owner-fed only.

**Scope**
- Change the **visual layer**. Product data, filtering, search, customization fields, uploads,
  Server Actions, auth, Studio data behaviour, URLs and routes are off-limits. If a design appears
  to require a data change, **stop and report it** rather than making it.

**Tokens**
- Colour, type, spacing and motion values come from `src/styles/tokens.css` and `REDESIGN.md` Part 3.
  **Never invent a value. No raw hex in components, ever.**
- Champagne is never a fill, never a button background, never text below 16px on light (use
  `champagne-ink`). **Max two champagne elements per viewport.**
- Dark bands never sit adjacent; **max three per page**; each wraps itself in `data-theme="navy"`.
- In the Studio's dark scheme, every sapphire **text or indicator icon** reads `sapphire-ink`
  (`#5fafd6`) — raw sapphire is 2.2:1 on obsidian. Never as a fill.
- Every price, count, date, dimension, cure time and eyebrow is `font-mono`, tabular.

**Motion**
- **Do not add `motion`, `framer-motion`, `react-spring`, `auto-animate` or any new animation
  runtime.** The repo ships GSAP + ScrollTrigger + Lenis against a 45 KB gzipped budget and a 49 KB
  enforced ceiling. Most of the reference libraries in §4 are built on `motion`; you are harvesting
  their *ideas*, not their dependencies.
- Every effect uses the Part 3.8 tokens (`--ease-luxury`, `--ease-settle`, `--dur-*`) and has a
  `prefers-reduced-motion` fallback. `redesign-audit.mjs` drives a `reduce` context per route and
  fails anything still animating.
- **No image fades in.** Every image reveal goes through `MeniscusImage`. The cure line and the
  meniscus reveal are the two signature devices; do not add a third.
- Buttons: 120–180ms colour and underline only. No scale, no lift, no glow. Parallax capped at
  20–40px. No scroll-jacking beyond the two sanctioned pins.
- Nothing may move or delay the LCP element.

**The four registries** — this is the constraint that most often gets violated:
- Copy lives in `site-copy.generated.ts` (1,297 slots) → a hardcoded string **deletes the owner's
  ability to edit it**. New copy goes through `next-intl` *and* the registry (`npm run copy:registry`).
- Images live in `site-images.ts` (78 slots) → a hardcoded path **breaks `/studio/site-images`**.
  New imagery becomes a slot with a bundled fallback that exists on disk.
- Page order lives in `page-sections.ts` → reorder there, not in JSX.
- Landing-page content lives in `custom-blocks.ts` (16 types).

**Internationalisation**
- Every user-facing string goes in `messages/en.json` **and all eight other locales**
  (ar, de, es, fr, gu, hi, ja, zh) in the same PR. Arabic needs real Arabic.
- Logical properties everywhere: `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`/`text-start`. Never `pl-`,
  never `left-`. An unmirrored RTL is worse than none.

**Accessibility** (`REDESIGN.md` Part 17)
- Body text ≥4.5:1, large display and mono micro ≥3:1. One `h1` per page, no skipped levels, **no
  duplicated heading text on a page**. No `…` in an accessible name.
- 44×44px touch targets with 8px separation — **this fails, not warns, at ≤700px**.
- `Esc` closes every layer and focus returns to the trigger. Full keyboard path through header, mega
  menu, drawer, search, filters, gallery, lightbox, accordions, forms.
- Focus: 2px sapphire ring at 3px offset, champagne inside dark bands, never removed.

**Code**
- TypeScript strict, no `any`, named exports. Server components by default; `"use client"` only for
  interactivity or motion. Never call `setState` synchronously in an effect body — the repo lints
  for it. Lucide icons only, `strokeWidth={1.5}`.

## 3. What "world-class" means here

Not more effects. These five, in order:

1. **Typographic contrast.** The scale is already correct and applied evenly, which reads as
   competent rather than confident. Widen the gap between the hero statement and body copy; tighten
   the measure; let `font-display` carry real weight at the top of a page and disappear elsewhere.
2. **Composition over decoration.** Asymmetry, generous negative space, a 12-column grid used
   deliberately. Separate content with whitespace, image, type and a `mineral → sand` surface
   shift — **not boxes**. 1px hairlines only. No drop shadows on the storefront (two exceptions: the
   mobile bottom bar and the Studio's bulk-action bar). Blur in exactly one place: the sticky header.
3. **Photography as the argument.** The new masters (§5) are the product. Crop them boldly, give
   them room, and let the meniscus reveal do the work.
4. **Motion you notice only when it is missing.** One considered transition beats five ambient ones.
5. **Every state, finished.** `default · hover · focus · active · disabled · loading`, plus empty,
   error and success on every list. Flat `sand` skeletons at exact final dimensions — **no shimmer**,
   no spinner where a skeleton will do. Disabled = 40% opacity **plus a stated reason**. An
   accordion, tab or panel with no content must not render.

## 4. Reference libraries — how to use them

Study these for **interaction patterns, composition and polish**, then re-implement on this repo's
tokens, Tailwind v4 utilities, `shadcn/ui` primitives and GSAP/CSS.

**The rule: harvest patterns, never paste source.** Reasons, all three load-bearing:
1. Most ship on `motion` — forbidden by §2.
2. Several are commercially licensed (Skiper UI sells $129 and $549 tiers); pasted component code
   carries its licence, a described pattern does not.
3. Their design languages are not this brand's. A magicui gradient beam on an obsidian resin-art
   page is a foreign object.

| Source | What it is | Take from it |
|---|---|---|
| [magicui.design](https://magicui.design/) | React/TS/Tailwind + Motion, shadcn-registry compatible | Text reveal timing, marquee and bento composition. Reject: gradient beams, glow, meteors — all fail §2. |
| [21st.dev](https://21st.dev/) | Community registry of shadcn-compatible components | Breadth. Best source for *how a pattern is usually composed* before you decide how it should be here. |
| [reactbits.dev](https://reactbits.dev/) | Animated React components, text and backgrounds; JS/TS + CSS/Tailwind variants | The **CSS variants** are the most directly useful thing on this list — patterns already expressed without a JS runtime. |
| [skiper-ui.com](https://skiper-ui.com/) ✅ *verified* | shadcn + Tailwind + Motion.dev, `npx shadcn add @skiper-ui/…`; free and paid tiers | Image-reveal and scroll-stack choreography. **Check the licence per component before borrowing anything beyond the idea.** |
| [smoothui.dev](https://smoothui.dev/) | React/Tailwind animated components | Micro-interaction timing and easing feel. |
| [daisyui.com](https://daisyui.com/) | A Tailwind **plugin** with semantic class names and a theme system | **Reference only — do not install.** It would put a third token system alongside Tailwind v4 tokens and the shadcn semantic layer. Useful for *semantic component naming* and dense form/table layouts in the Studio. |
| [threeui.com/browse](https://threeui.com/browse) | Three.js components, templates, interactive shaders | `three` is already a dependency, confined to the PDP model viewer. Any WebGL must be lazy, off the LCP path, and disabled under reduced motion. Treat as a Studio-side or single-hero experiment, never a page background. |
| [ui.unlumen.com](https://ui.unlumen.com/) | React component library, primitives + components, has paid tiers | Primitive API shape and composition. |
| [animmasterlib.dev](https://animmasterlib.dev/) · [vengenceui.com](https://www.vengenceui.com/) · [originkit.dev](https://www.originkit.dev/) | ⚠️ **Not verified** — returned no usable content in review (originkit answered HTTP 403) | Evaluate against §2 and the licence before taking anything. Report what you find. |

**Process for borrowing anything:**
1. Name the pattern and what it achieves — *"the gallery reveals with the image scaling from the
   thumbnail's exact rect"*, not *"skiper40"*.
2. Check it against §2. Most ambient background effects die here. That is correct.
3. Re-implement on tokens with a GSAP or CSS equivalent.
4. Ship the reduced-motion fallback in the same commit.
5. Record the source in the PR body so review can check licence and provenance.

## 5. Assets — Google Drive only

**All imagery and video come from the owner's Drive folder**
`1P2HCTmPge6HsEwtoo-xGEzPTSn68oZOW` ("Higgsfield Originals"): 101+ PNG masters at 3712×4608 and
3072×5504, 26 MP4 loops, and the prompt set that produced them.

**Do not generate new imagery. Do not use stock. Do not use a placeholder that survives to review.**

[`drive-asset-map.json`](drive-asset-map.json) maps all 43 generated manifest entries to their Drive
file ids — **71 candidates, 71 matched**. The pipeline is in
[`04-drive-asset-pipeline.md`](04-drive-asset-pipeline.md); the short version:

```
contact sheet → owner culls a keeper → build the AVIF master + LQIP → promote → wire a slot
```

Three rules that outrank any layout need:
- **The maker is never AI** (§15.2). `home.maker` and `about.maker` keep what they have. Do not put
  a generated portrait behind them, and do not add one to a generation queue.
- **No generated picture stands in for a customer's own flowers.** This is why
  `varmala-before-after` was withdrawn; a different aspect ratio does not change the claim a picture
  makes.
- **A built master is not a wired one.** Point a slot at it in `/studio/site-images`, or it is dead
  weight that passes every test.

If a design needs a picture that does not exist in the Drive folder, **say so and stop**. Twelve
manifest entries are still ungenerated and the Higgsfield workspace is out of credits; inventing an
asset is not the workaround.

Any slot whose picture changes needs its **alt text re-read in all nine locales** — alt text
describes the picture, not the brand.

## 6. Order of work

Ship each as its own reviewable PR that leaves the tree green.

**Storefront** — 1. token extension (additive; existing names unchanged) · 2. typographic contrast
pass · 3. primitives with all six states · 4. motion pass within budget · 5. homepage collections
band, featured grid, large-format · 6. PDP gallery and spec sheet.

**Studio** — 7. shell and five-group navigation (Today · Catalogue · Content · Research · Settings) ·
8. data tables and a visible draft/publish state · 9. scraper workspaces — **only after** the data
model in [`02-scraper-rebuild.md`](02-scraper-rebuild.md) lands, so they are designed once.

Weight the effort roughly **35 / 65 storefront-to-Studio**. The Studio is the weaker surface and the
one the owner uses daily.

## 7. Definition of done

Per `CLAUDE.md`, every task:

```
typecheck ✓   lint ✓   build ✓
works at 360px and 1280px        keyboard reachable        reduced-motion checked
screenshots verified             HARD RULES respected      order flow intact
```

Plus the gates, all of which run in CI over the 13 public routes and 5 demo detail routes:

| Gate | Catches |
|---|---|
| `scripts/redesign-audit.mjs` (1440 · 1280 · 390 · 360, + RTL) | Band rhythm, heading rules, mono numerals, alt text, overflow, header contrast, any bundled image with `naturalWidth === 0`, and anything still animating in a `reduce` context |
| `scripts/a11y-audit.mjs` | axe-core critical and serious |
| `scripts/keyboard-audit.mjs` | Overlays and the three lightboxes |
| `scripts/motion-budget.mjs` | 45 KB budget / 49 KB ceiling — **and see the trap at the top of this file** |
| `npm run test:e2e` | The wa.me order round trip |
| `copy:check` · `i18n-missing --stale` | A key that landed in English and nowhere else |

Commits: `feat|fix|chore|refactor(scope): message`. Small and verified.

## 8. When a reference and the contract disagree

The contract wins, and you say so rather than quietly splitting the difference. If you believe a
rule is genuinely wrong for a case — it happens; `hero-parallax.tsx` was deleted as dormant and
restored because the audit filed it under REFINE, not REMOVE — **make the argument in the PR and
let the owner decide.** Do not resolve it silently in either direction.

Precedence, highest first:

```
CLAUDE.md HARD RULES  →  REDESIGN.md Part 0  →  REDESIGN.md  →
docs/redesign-contract.md  →  this prompt  →  the reference libraries
```

── END PROMPT ──
