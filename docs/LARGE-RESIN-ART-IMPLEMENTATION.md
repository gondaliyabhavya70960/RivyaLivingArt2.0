# `/large-resin-art` — implementation record

## The finding that shaped it

The brief asked for a statement-piece gallery: eleven furniture sub-categories,
dimension diagrams, 3D inspection, room visualisations, project stories.

**The catalogue cannot support any of it.** Verified against the database, not
inferred:

| Check | Result |
|---|---|
| Products | 4,385 |
| `resin-furniture-surfaces` | 3 items — table-*top decor*, ₹40–₹350, 1 draft |
| `sculptures-objets` | 2 items — 3D-printed souvenirs, ₹24–₹26, both draft |
| Tables / chairs / consoles / benches | **0** |
| Products with a 3D model | **0** |
| Products with `dimensions` | **2** |
| Most expensive item in the catalogue | ₹99,000 — a Mirka sanding kit |
| Top 14 by price | all tools, printers, filament — no finished art |

The two "river table" hits are a ₹2,500 e-course and a ₹10,999 DIY kit for an
18×12-inch piece. The chair and bench hits are a ₹40 *Miniature* Beach Chair
and a ₹40 *Miniature* Bench.

The catalogue is a resin-**supplies** and 3D-printing shop (~2,500 molds, tools
and pigments; ~500 print supplies) plus small decor and workshops.

Building the specced gallery would have meant fabricating a product line —
against CLAUDE.md's *"NO AI-invented products, ever"* and the brief's own
RULE 19, 34 and 38. RULE 38 names the alternative: **redesign the layout rather
than invent products.** The owner chose that path.

## What this page is

A **bespoke commission capability page**. It sells the conversation, not a
shelf. Every section stands up with zero products behind it, and the single
section that shows real pieces renders an invitation instead of an empty grid
when there are none.

**Nothing on this page states a size, a weight, a load rating, a lead time or
an installation service**, because none of those are recorded anywhere the site
can read.

## Classification — no schema change

A piece is large-format if it sits in `resin-furniture-surfaces` or
`sculptures-objets` (`src/lib/large-format.ts`). Category membership *is* the
classification, which is how the Studio already works — the owner moves a
product into a category and it appears here. A parallel "statement piece" flag
would be a second source of truth for the same fact.

Per-piece detail uses columns that already exist: `materials`, `dimensions`,
`model3dUrl`, `videoUrl`, `featured`.

- `featured` **orders, it never gates** — it is a site-wide flag that also
  promotes a row into the homepage band and the default shop sort.
- `materials` and `dimensions` are owner-typed free text, rendered as written
  and **never parsed, sorted or compared**. They sit beside a translated label,
  never inside a translated sentence — they are not in
  `TRANSLATABLE_FIELDS.product`.
- `model3dUrl` is null on all 4,385 products, so `ModelViewer` mounts nowhere.
  That is correct: a fabricated 3D model would be worse than none.

## Structure

| # | key | ground | dark | major | notes |
|---|---|---|---|---|---|
| 0 | `scale` | obsidian | ✅ | | hero, owns the `h1`, breadcrumb inside the band |
| 1 | `scope` | mineral | | | four kinds of large work, one image each |
| 2 | `how` | obsidian | ✅ | | four stages, mono numerals |
| 3 | `brief` | sand | | | what to send for a quick quote |
| 4 | `gallery` | sand | | | **conditional** — real pieces or an invitation |
| 5 | `commission` | mineral | | ✅ | closing invitation into the existing flow |

Two dark bands, never adjacent, last band light so it does not run into the
obsidian footer. One `section-major`. One `h1`. All six headings distinct.

`gallery` is deliberately **not** dark: `describeArrangementProblem` cannot see
conditionality, so a dark section that renders `null` would let an owner
publish a band the guardrail counted and the DOM does not have.

The cure rail skips `gallery`'s tick when there are no pieces — `CureMark.id`
is fed to `getElementById`, so a tick for a null section points at nothing.

## Wiring

| Concern | File | Note |
|---|---|---|
| Route | `src/app/[locale]/(v2)/large-resin-art/page.tsx` | |
| Catalogue read | `src/lib/large-format.ts` | own `select`; `ShopProductItem` carries no `materials`/`dimensions` |
| Sections (CMS) | `src/lib/page-sections.ts` | `large-format` page key, owner reorders/hides at `/studio/sections` |
| Copy (CMS) | `messages/*.json` → `LargeFormat` | 64 keys × 9 locales, editable at `/studio/site-copy` under **Large format** |
| Images (CMS) | `src/lib/site-images.ts` | 5 slots, all reusing existing v3 masters |
| Route validation | `src/lib/nav-menus.ts` | `KNOWN_ROUTES` |
| Footer link | `src/lib/constants.ts` | appended to `FOOTER_LINKS.explore` |
| Nav backfill | `prisma/bootstrap.ts` | see below |
| Sitemap | `src/app/sitemap.ts` | 9 `<loc>` entries, one per locale |
| Transparent header | `(v2)/layout.tsx` | hero pulls under with `-mt-20` |
| CI | `.github/workflows/ci.yml` | in `AUDIT_ROUTES` **and** `AR_ROUTES` |

### Images — no new generation

All five slots reuse committed v3 masters:

| Slot | File | Depicts |
|---|---|---|
| `largeFormat.hero` | `studio-interior.avif` | the bench of curing moulds under one lamp |
| `largeFormat.k1` | `tile-live.avif` | resin-and-teak serving board |
| `largeFormat.k2` | `macro-epoxy.avif` | bevelled edge of a cured slab |
| `largeFormat.k3` | `story-cure.avif` | moulds curing |
| `largeFormat.k4` | `tile-preserve.avif` | pressed petals in clear resin |

The hero is the honest weak point: it is shared with `/contact`. A purpose-built
master showing **formwork, a pour, or the bench** would be better — never a
finished piece presented as a delivered commission, which §15.2 forbids. The
owner can replace it from `/studio/site-images` with no deploy.

### The nav backfill

The nav seed is gated on the whole `NavItem` table being empty, so it
short-circuits permanently after the first deploy — a link added to
`NAV_MENU_DEFAULTS` afterwards reaches a fresh database and no other, and
`getNavMenus`'s fallback replaces a menu only when it resolves to zero visible
rows, never merges.

So `prisma/bootstrap.ts` carries a keyed backfill: insert
`("footer-explore", "largeFormat")` only when `findUnique` misses, at
`order = max+1`, with **no** `label` (an empty label falls through to the
nine-language `Nav.*` catalogue; writing one would pin the link to English).

**Safe against an owner who took the link down** because `/studio/navigation`
has no delete path — hiding sets `visible: false` and the row survives. A
`findUnique` hit is proof the owner was already offered this link. *If a hard
delete is ever added to that screen, this becomes a link-resurrection bug.*

Verified: seed skipped on a populated table, backfill added 1, second run added
0, link landed at `order: 3`.

## Structured data

- **`BreadcrumbList`** — mirrors a visible trail rendered inside the hero.
- **`Service`** — `provider` is an `@id` edge into the `Organization` the layout
  already emits; `areaServed` India.

Deliberately **not** emitted: `Product`, `Offer`, `AggregateOffer`, `price`,
`aggregateRating`, `review`, `ItemList`. There is no product and no price — an
`Offer` without one is invalid and with one would be fabricated. Add a
`pieces.length > 0`-guarded `ItemList` when real pieces exist.

## Verification

```
typecheck ✓  lint ✓  test 322/322 ✓  copy:check ✓  i18n-missing 0 ✓  build ✓
redesign-audit  13 routes @1440 ✓ @390 ✓ · 6 /ar routes @1440 ✓ @390 ✓
a11y-audit      13 routes @1440 ✓ @390 ✓ · /ar @390 ✓
studio-audit    30 routes @390 ✓
lighthouse      home 98 · plp 97 · CLS 0
sitemap         9 <loc> entries for the route
bootstrap       backfill idempotent (1 then 0)
```

One serious a11y violation was caught and fixed during the build: a `<p>`
directly inside a `<dl>`. A definition list may only contain `dt`/`dd` groups,
`div`, `script` or `template`.

## What is deliberately not built

- **No `/large-resin-art/[slug]` detail route.** Pieces link to their existing
  PDP. A parallel detail route would duplicate the product model for no data.
- **No 3D viewer.** Zero products have `model3dUrl`. `ModelViewer` is reused as
  soon as one does.
- **No room visualisation.** It would require generating a finished piece in a
  room — a factual claim about a commission that does not exist (§15.2).
- **No dimension diagram.** Two products in the whole catalogue have dimensions.
- **No project stories.** No client data exists, and inventing one is forbidden.
- **No Studio "large art" workspace.** The existing category filter on
  `/studio/products` already isolates these pieces, and
  `parseProductListFilter` also drives bulk select-all-matching — a wrong change
  there is dangerous for no gain.

## For the owner

To populate the gallery: put a product in `resin-furniture-surfaces` or
`sculptures-objets`, publish it, and fill `dimensions` and `materials` if you
want them printed. The section switches from the invitation to a grid on its
own, and the cure rail grows its tick.

To change any words: `/studio/site-copy` → **Large format**.
To change any picture: `/studio/site-images` → **Large format**.
To reorder or hide sections: `/studio/sections` → **Large format**.
