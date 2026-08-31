# v3 "Liquid Luxury" — build contract

The single reference for every component and page built against
**REDESIGN.md** (Master UI/UX Redesign Specification v1.0). REDESIGN.md is the
spec; this file is the vocabulary it compiles to in this repo. Where the two
disagree, REDESIGN.md wins and this file is wrong — say so rather than
inventing a third answer.

---

## 1. Hard rules that outrank the design (CLAUDE.md, REDESIGN.md §1.1)

- No payment gateway, checkout, cart or bag. No currency switcher.
- No customer login, account or membership. The only login is `/studio`.
- No AI-invented products. The catalogue is owner-fed only.
- Every order finalises on WhatsApp: Place Order → Inquiry via Server Action →
  `wa.me/917096036250` with the pre-filled message.
- Do not change product data, filtering, search, form fields, upload, auth,
  Studio/CMS behaviour, URLs, routes, API behaviour or order logic. **Change
  the visual layer only.** If a redesign appears to need a data change, stop
  and report it instead.

## 2. Colour — `src/styles/tokens.css`

| Utility | Role |
|---|---|
| `obsidian` | hero, footer, premium sections, Studio UI, dark product presentation |
| `deep-ocean` | brand backgrounds, highlighted sections, resin storytelling |
| `sapphire` / `sapphire-hi` | primary action, links, cure-line fill, focus / hover only |
| `mineral` | light page ground |
| `sand` | warm neutral — alternate section ground, card surface |
| `champagne` | accent: tiny highlights, active states, micro-labels, hairlines |
| `champagne-ink` | champagne as TEXT on a light ground (champagne itself is 2.35:1 there) |
| `ink` | body text on light |
| `graphite` | secondary text, all mono metadata |
| `mist` | secondary text on dark |
| `hairline` / `hairline-dk` | every divider, light / dark |
| `whatsapp` / `whatsapp-deep` | WhatsApp accent / WhatsApp button fill (AA with white) |
| `alert` · `success` | errors and destructive · success and in-stock |

Use them as Tailwind utilities: `bg-obsidian`, `text-graphite`,
`border-hairline`, `text-champagne`. **No raw hex in components, ever.**

**Champagne discipline.** Never a fill. Never a button background. Never text
below 16px on light (use `champagne-ink`, or put it on a dark ground where
champagne clears 7.5:1). **Max two champagne elements per viewport.**

**Dark-band rhythm.** Dark sections never sit adjacent — always
light → dark → light. **Max three dark bands per page.** A dark band wraps
itself in `data-theme="navy"` so nested inks, hairlines and focus rings
resolve correctly:

```tsx
<section data-theme="navy" className="section-standard bg-obsidian text-mineral">
```

## 3. Type — `font-display` · `font-body` · `font-mono`

| Face | Utility | Used for |
|---|---|---|
| Instrument Serif | `font-display` | hero, section headings, campaign statements, pull-quotes |
| Inter | `font-body` | navigation, product info, buttons, forms, paragraphs |
| JetBrains Mono | `font-mono` | **every** price, count, date, dimension, project number, cure time, timer, spec value, eyebrow |

Sizes: `text-hero` · `text-h1` · `text-h2` · `text-h3` · `text-body` ·
`text-small` · `text-micro`. All are `clamp()`d — one scale, no mobile fork.
`h1/h2/h3` already default to Instrument Serif at `tracking-display`.

Composite utilities:

- `u-micro` — the mono micro label. Every eyebrow and every metadata line.
  Carries face, 11px, `.14em`, uppercase, tabular-nums and the correct
  secondary ink for its scope. Use it instead of re-specifying those six things.
- `u-num` — mono + tabular-nums, for a number inside running text.
- `u-shell` — the content shell (max 1440px, fluid 20→72px padding).
- `u-prose` — 68ch measure. `u-lede` — 52ch, for section intros.

Sentence case for headings and buttons. UPPERCASE only for `u-micro`.

## 4. Layout

- `u-shell` for every section rail. 12-column grids via `grid-cols-12`.
- Editorial split: text `col-span-7`, sticky mono rail `col-start-9 col-span-4`.
- Commerce split: gallery 60%, information 40%.
- Section tiers: `section-major` (max **two per page**) · `section-standard`
  (most sections) · `section-compact` (rails, breadcrumbs, CTA strips).
- Cure gutter: 56px reserved outside the shell at ≥1024px (`lg:ps-cure`
  where a page renders the cure line).

## 5. Border, radius, elevation

- Borders 1px, very low contrast: `border-hairline` / `border-hairline-dk`.
  Separate content with whitespace, image, type and a `mineral → sand` surface
  shift — not boxes.
- Radius: buttons `rounded-full` · inputs `rounded-input` (2px) · cards
  `rounded-card` (4px) · image containers `rounded-image` (2px) · large
  editorial blocks square.
- **No drop shadows on the storefront.** Two exceptions only: the mobile bottom
  bar and the Studio's floating bulk-action bar.
- **Blur in exactly one place**: the sticky header on scroll.

## 6. Buttons — `@/components/storefront/button`

`primary` (solid obsidian) · `secondary` (transparent, underline draws L→R) ·
`premium` (1px champagne outline on dark, fills at hover) · `whatsapp` ·
`ghost`. Sizes `sm 40` / `md 48` / `lg 56`. Inter 500, sentence case, never
all-caps. **No scale or lift on hover** — colour and underline only.
Disabled = 40% opacity **plus** a mono reason line beneath. Loading = inline
spinner replacing the label, width locked.

## 7. Icons

Lucide only, `strokeWidth={1.5}`, 24px box. Icons support text; never an icon
alone where the action must be understood without context. **Never an icon per
benefit** — proof blocks use mono numerals and photography.

## 8. Motion — REDESIGN.md Part 14

Tokens: `ease-(--ease-luxury)` (house curve) · `ease-(--ease-settle)` (UI
state) · `duration-(--dur-fast|--dur-base|--dur-slow|--dur-reveal)`.

- **No image fades in.** Every image reveal goes through `MeniscusImage`
  (`@/components/storefront/meniscus-image`) — a horizontal edge rising from
  the bottom with a bright leading line. Once per element.
- Buttons: 120–180ms colour and underline only. No scale, no lift, no glow.
- Parallax capped at 20–40px, hero and editorial images only.
- Accordion opens `grid-template-rows: 0fr → 1fr` at 350ms.
- Card/text reveal: 16–24px rise + opacity, 350ms, trigger at 85% viewport, once.
- **`prefers-reduced-motion: reduce` disables parallax, large transforms,
  autoplay, pinned scrubs, the marquee and complex transitions, and jumps every
  reveal to its final state.** The global collapse in tokens.css handles
  transitions; anything JS-driven must check the media query itself.
- No scroll-jacking beyond the single material-story pin and the process steps.
- Motion JS ≤45KB gzipped. Nothing may move or delay the LCP element.

## 9. States — every component ships all six

`default · hover · focus · active · disabled · loading`, plus, on every list:

- **Empty** — no illustration, no icon. Statement → one line of direction →
  one action (`@/components/storefront/empty-state`). **Conditionally
  rendered — never shown alongside populated content.**
- **Error** — human language, never technical. Retry + a WhatsApp escape hatch.
- **Loading** — flat `sand` skeletons at exact final dimensions, text lines as
  1px hairlines. **No shimmer.** Never a spinner where a skeleton will do.
- **Focus** — 2px sapphire ring at 3px offset (champagne inside dark bands),
  never removed.
- **Disabled** — 40% opacity + a stated reason.
- **Success** — explicit confirmation, `role="status"`.

An accordion, tab or panel **with no content must not render.**

## 10. Accessibility — REDESIGN.md Part 17

- Body text ≥4.5:1; large display and mono micro ≥3:1. Champagne is never text
  below 16px on a light ground.
- One `h1` per page, no skipped levels, **no duplicated heading text on a page.**
- Card links carry the full title even when the visible text clamps — no `…`
  in the accessible name.
- 44×44px minimum touch targets, 8px separation.
- Labels always visible, never placeholder-only. Errors wired with
  `aria-describedby`.
- `Esc` closes every layer and focus returns to the trigger. Full keyboard path
  through header, mega menu, drawer, search, filters, gallery, lightbox,
  accordions, forms.
- 9 locales including Arabic: use logical properties (`ps-`/`pe-`/`ms-`/`me-`/
  `start-`/`end-`/`text-start`), never `pl-`/`left-`.

## 11. Repo conventions

- TypeScript strict, no `any`, named exports. Server components by default;
  `"use client"` only for interactivity or motion.
- Storefront routes in `src/app/[locale]/(v2)`; Studio in `src/app/studio`.
- All user-facing copy goes through `next-intl` (`useTranslations` /
  `getTranslations`). New keys go in `messages/en.json` **and all eight other
  locales** (ar, de, es, fr, gu, hi, ja, zh). Arabic needs real Arabic, not
  English.
- Images through `next/image` with `sizes`; external hosts use
  `sizedExternalSrc` + `isOptimizableImageSrc` from `@/lib/image-src`.
- `cn()` from `@/lib/utils` for class merging.
- Alt text describes the picture, not the brand. Decorative art gets `alt=""`.

## 12. The two signature devices

**Cure line** (`@/components/storefront/cure-line`) — a 1px vertical hairline
in the left gutter that fills as the page scrolls, notched with ticks at each
section boundary, each labelled in mono (`01 · THE POUR`). Desktop ≥1024px
only; below that it collapses to a 2px top progress bar with the active label.
Under reduced motion it is a static ruler with the active tick marked.

**Meniscus reveal** (`@/components/storefront/meniscus-image`) — the ONLY image
reveal on the site. A horizontal edge rises from the bottom of the frame with a
brighter 1px leading line and a slight vertical squash settling out. It
replaces every fade-up.

## 13. Definition of done

typecheck ✓ · lint ✓ · build ✓ · works at 360px and 1280px · keyboard
reachable · reduced-motion checked · hard rules respected · order flow intact.
