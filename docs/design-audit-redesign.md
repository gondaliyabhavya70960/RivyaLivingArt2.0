> **ARCHIVED (historical design record, v2 → v4, 2026-08-09/12).** Every
> system described here was superseded — first by v7 (now
> docs/design-v7-sapphire-atelier.md, archived), then by the owner's v2.0
> master document /DESIGN.md, which is the only live design authority. §E's
> known follow-ups have all since been closed or retired. Reference only.

# Rivya Living Art — Two-Skill Design Audit & Redesign Program (2026-08-09)

Skills applied, in order, per the owner's instruction: **hallmark v1.1.0**
(`.agents/skills/hallmark`) and **ui-ux-pro-max v2.13.0** (plugin). Audit ran
before any edit (hallmark `audit` verb contract). Redesign scope per the
owner: **complete redesign, preserving logo, main colours, and all content +
features** — which maps exactly to hallmark's `redesign` verb ("new section
rhythm, new heading placement, new component voice; preserve routes,
component ownership, copy intent, brand, information architecture").

## A. hallmark audit — ranked punch list (before any edit)

| # | Severity | Anti-pattern (hallmark name) | Where it shows in Rivya Living Art |
|---|---|---|---|
| 1 | Critical | **Default-attractor sameness** | Every public page shares ONE structural fingerprint: dark hero band (eyebrow → KineticHeading → sub-copy → pill CTAs) → content bands → gradient CTA band → footer. 15 pages, one shape — the AI fingerprint the skill exists to break. |
| 2 | Critical | **Inter-everywhere** | Body face is Inter — first entry on the banned-defaults list. (Fraunces display is allow-listed and stays: it is the brand.) |
| 3 | Major | **Eyebrow on every section** | The lowercase `.eyebrow` label opens nearly every section on every page. The skill's rule: an eyebrow is earned, not ambient. |
| 4 | Major | **Aurora-blob background / floating-orb decoration** | `GradientMesh` (animated blurred blue blobs) mounts on almost every hero and CTA band site-wide. |
| 5 | Major | **Animate-on-scroll on everything** | `ScrollReveal` wraps most sections; KineticHeading splits on most heads. Motion is ambient, not narrative. |
| 6 | Major | **`transition-all`** | `Button` base uses `transition-all` (also flagged by ui-ux-pro-max's checklist as a perf/intent smell). |
| 7 | Major | **Universal `hover:scale-105`** | Card imagery across shop/blog/portfolio all share the same grow-on-hover reflex. |
| 8 | Major | **Single button voice** | One CTA register everywhere: gold `rounded-full` pill. No outlined / typographic-link registers; hierarchy is carried by repetition. |
| 9 | Minor | **Centred everything** | Hero + CTA heads centred on every page; section heads uniform. No placement variety (hanging / bottom-aligned / overlapping). |
| 10 | Minor | **Shadow-glow on dark** | `shadow-glow` utility on dark bands — listed tell when ambient. |
| 11 | Minor | **Divider monotony** | Sections separate only by background-colour change; no hairline / ornament / negative-space vocabulary. |

Passing marks worth recording: no purple-gradient hero, no gradient
headlines, no card-in-card, no invented metrics (testimonial schema renders
only real rows), no italic headers, no fake browser chrome, no emoji icons
(lucide + inline SVG throughout), real `:focus-visible` treatment, reduced
motion respected globally, tokens are locked (no mid-render hex — enforced
since DS-001/006), mobile `overflow-x` discipline via prior audits.

## B. ui-ux-pro-max — generated design system (query: "luxury handcrafted resin art gifting e-commerce India premium editorial")

- **Pattern:** Feature-Rich Showcase, CTA above fold.
- **Style: Liquid Glass** — "flowing glass, translucent, animated blur…
  luxury portfolios / high-end e-commerce." The brand already owns this
  language (`LiquidGlass`, header glass) → keep, but *purposeful, not
  ambient* (converges with hallmark #4/#5).
- **Colours:** premium dark + gold accent — matches the preserved Midnight
  Sapphire + gold palette; no palette change needed (owner constraint).
- **Typography:** serif-display + clean body ("Playfair/Inter" class).
  Combined with hallmark's Luxury row (Fraunces · Cormorant · **body: EB
  Garamond / Crimson Pro / Source Serif 4**) → **Fraunces display (kept) +
  Crimson Pro body**, per-script fallbacks moved to Noto **Serif** faces.
- **Effects:** morphing/fluid 400–600 ms curves, dynamic blur — scoped to
  the glass surfaces. **Avoid:** vibrant block-based, playful colours.
- **Checklist carried into verification:** cursor feedback, 150–300 ms hover
  transitions, ≥4.5:1 text, visible focus, reduced-motion, 375/768/1024/1440.

## C. Redesign — the final design (structural fingerprints per page)

One brand voice, **different macrostructure per key route** (hallmark's
structural-variety mandate). Logo, palette tokens, copy, routes, features
all preserved.

| Route | Macrostructure | Fingerprint notes |
|---|---|---|
| `/` | **08 · Photographic** | The generated imagery leads: full-bleed folds, text as small annotation; hero keeps the above-fold WhatsApp CTA (ui-ux-pro-max pattern). |
| `/about` | **12 · Letter** | First-person note from the maker; no buttons in the fold; hanging heads. |
| `/process` | **14 · Narrative Workflow** | Numbered stages (01→05) as the page spine — it IS a process. |
| `/shop` | **11 · Catalogue** | The grid is the design: uniform SKU index, hairline rules, catalogue head. |
| `/faq` | **06 · Conversational FAQ** | Bold questions, human answers (already accordion — voice sharpened). |
| `/portfolio` | **18 · Portfolio Grid** | Work-led grid (kept), captions as annotations. |
| `/custom-order` | **15 · Split Studio** | Diptych: brief form ↔ proof/testimonials. |
| Blog | Editorial single-column | Reading-led; covers full-bleed with margin reset. |

**Component voice (site-wide):**
- **Type:** Fraunces display (kept) + **Crimson Pro** body + Noto *Serif*
  script fallbacks; scale = perfect fourth (1.333); weight extremes
  (display 350↔600 via Fraunces axes, body 400↔650).
- **Buttons:** three registers — primary **outlined** (hairline, squared
  radius), band CTA **typographic underline**, gold solid reserved for the
  single highest-intent action per page (order/WhatsApp). Pill silhouette
  retired except the floating WhatsApp button (brand-functional).
- **Dividers:** hairline rules (inset) on light bands; negative space on
  dark; numbered rules in Workflow.
- **Motion:** one orchestrated reveal per fold maximum; GradientMesh only
  on the two glass CTA surfaces; `transition-all` removed; image hover =
  opacity/duotone shift, not scale.
- **Eyebrows:** ≤1 per page (the hero), everywhere else heads stand alone.

Verification: band-audit script (0-flag bar), slop-test universal gates,
build/tsc/eslint, responsive gate greps (overflow-x, minmax(0,1fr), no
two-line buttons), pre-emit critique stamp in globals.css.

## D. Phase-2 execution record (2026-08-09)

Shipped per §C, one commit per route, each verified (tsc/eslint per agent,
then combined build + 0-flag band audit across 17 pages incl. /hi + /ar):

- `/process` → 14 · Narrative Workflow (stacked ghost numerals as the spine,
  hairline stage rules, one reveal, one gold CTA).
- `/shop` → 11 · Catalogue (compact light masthead over a hairline rule, the
  grid owns the fold, reveal: none).
- `/about` → 12 · Letter (65ch reading column, hanging heads, negative-space
  dividers, zero fold buttons, one image moment, quiet outline sign-off).
- `/` → 08 · Photographic (imagery leads every fold, heads demoted to
  alternating bottom/top/side annotations — never the same placement twice
  in a row; two reveal moments; glass cards flattened; marquee demoted).
- Eyebrow discipline across the other 12 routes: 16 ambient labels removed,
  6 data labels restyled to quiet uppercase micro-labels; every page body
  now carries exactly one eyebrow (the hero's). The footer's three column
  headings are chrome, not section labels, and keep their register.

- `/custom-order` → 15 · Split Studio (true diptych: hero pairs the
  statement half with the process-proof column; fold 2 flips direction —
  testimonial quotes ↔ brief form — with one staggered cross-fade, gutter
  only between halves, outlined chip closing the proof half. Glass rail and
  duplicated mobile steps removed; the form's live-summary label restyled
  from `.eyebrow` to the quiet micro-label register).
- `/faq` → 06 · Conversational FAQ (questions are the headings — display
  face at xl/2xl on the accordion triggers; no reveal on load, the only
  motion is the 200 ms expand; Magnetic + kinetic close removed; the foot
  keeps the gold WhatsApp CTA — the page's single highest-intent action,
  brand rule over the spec's outlined default).

Variety score: the pre-emit stamp's V3 → V5 at page level — seven distinct
macrostructures now live across the site (Photographic, Letter, Narrative
Workflow, Catalogue, Portfolio Grid, Split Studio, Conversational FAQ)
plus the editorial blog. All §C rows are shipped; the program is closed.

## E. v3 "Midnight Gallery" — full-site redesign (2026-08-12)

Owner brief: *"completely redesign my full website with hallmark and
ui-ux-pro-max … just don't change logo and product … modern and latest
design."* Executed as hallmark's **multi-page redesign** (design.md-first;
diversification inverted — consistency across pages) + the ui-ux-pro-max
generated system (premium dark + gold, Liquid Glass scoped, serif-display +
clean body). **`design.md` at the repo root is now the locked system**; the
v2 sections above are the historical record.

**Adjusted**: the master prompt's "light porcelain canvas / both themes"
constraint is superseded by the owner's 2026-08-12 instruction (evidence:
this brief). Only the logo (currentColor SVG wordmark) and product/DB
content are fixed points.

The system: dark-led canvas (`dark` on `<html>`, the AA-tuned token set),
porcelain **paper sheets** (`tone="paper"`) as the signature reading
surfaces; **Playfair Display + Manrope** (Noto Sans script fallbacks);
uppercase gold eyebrow (≤1/page); three CTA registers (gold = one
highest-intent WhatsApp action per page); **N10 scroll-morph** header
(transparent row → floating glass chip); **Ft5 Statement** footer. Families:
Photographic (marketing) / Catalogue (grids) / Paper-document (content).

Shipped in six commits (A: canvas+type; B: chrome; C: 15-agent fan-out over
every public route; C2a: Higgsfield media pipeline; mirror via Actions +
ffmpeg fix; D: media wiring + cross-cutting fixes). Ambient media
(brand-only, never products): 4 Seedance loops + 6 Recraft stills, mirrored
first-party to `public/media/` (videos ~0.8 MB h264 + posters). Wired with
one-backdrop-per-page restraint: hero-pour → home hero, process-pour →
process hero, resin-waves → custom-order diptych, studio-night → contact
hero; workshops consumes workshop-table/hands-polish/texture-macro.
**Spares available in /media**: gallery-block.mp4, gallery-wall.webp,
pigment-still.webp.

Verification (all green): tsc · eslint --max-warnings=0 · production build ·
dark-led band audit **0 flags / 21 pages** (incl. /hi, /ar, blog paper
sheet) · one body eyebrow per page (legal 0 by design) · no
transition-all/scale-hover · real 404s · hreflang · /media served.

Known follow-ups (non-blocking): pre-existing hardcoded-English microcopy in
shared components (CollectionsRail, ShopExplorer strings, breadcrumb
Home/Shop labels, "Last updated") — needs a new-keys i18n pass;
`portfolio-card.tsx` now unused (kept per the non-destructive rule); Radix
select dropdowns render dark over paper sheets (site-consistent floating
chrome — change `ui/select.tsx` if light is preferred); NewsletterForm is
dark-band-only by construction.

## F. v4 "Sapphire Atelier" — blue-led combined theme + animation + 3D (2026-08-12)

Owner brief: *"dark blue is my primary color … dark and light combine theme
… Animation fill … gold is only for accent … creative, modern and luxury …
add creative 3d object relatable to resin."* Executed as an **amendment to
design.md** (multi-page rule) — v3's structure survives; the system's color
application, motion budget and hero centerpiece changed.

- **Canvas**: near-black → deep sapphire night `#061224` (navy panels
  `#0f2440`, void re-tuned blue-black `#050b18`). Dark blue is unmistakably
  primary.
- **Combined theme**: every public page now carries ≥1 porcelain band —
  verified served (new paper surfaces on shop/category/search/blog-index/
  process/workshops/portfolio/whatsapp-order/home-journal).
- **Gold demotion**: primary CTA fill flipped gold → sapphire (porcelain
  ink); eyebrow re-inked sapphire; chips/icons/numerals/badges swept.
  Surviving gold: star fills, dot separators, one earned hairline per
  surface, the announcement + footer rules. Gold never animates.
- **Animation layer**: kinetic heads on heroes + section heads, staggered
  reveals at ≤2 moments/fold, `animate-gradient-pan` on dopamine bands,
  drifting mesh on the home hero, marquee kept — reduced-motion collapses
  everything.
- **3D**: `ResinForm` (three + @react-three/fiber) — translucent sapphire
  glass knot, procedural RoomEnvironment IBL (zero network assets), float +
  cursor-tilt, lazy-mounted, DPR-capped, static frame under reduced motion.
  Mounted on the home hero; one mount per page max.
- **Media**: all 16 first-party assets now placed — gallery-wall backs the
  portfolio masthead, gallery-block breathes under the 404, hero-pour moved
  beneath the home closing band. No new generation needed (the 3D form is
  v4's new centerpiece).

Verification: tsc · eslint --max-warnings=0 · build · band audit **0 flags /
21 pages** (incl. /hi /ar) · 1 eyebrow/page · no transition-all/scale ·
404/hreflang · paper-band presence per page confirmed in served HTML.
