# 03 — The Image Layer

**Start here with the finding that changes the plan:** the image problem the
uploaded spec describes has already been solved in this repository. There is no
hardcoded `/media/…` string left in any storefront component, and no raw
`<img>` hotlinking a competitor's CDN.

```
$ grep -rn '"/media/\|"/sequences/\|src="/' src/app src/components \
      --include=*.tsx --include=*.ts | grep -v site-images.ts
(no matches)

$ grep -rn 'src="http' src/app src/components --include=*.tsx
src/components/analytics/marketing-scripts.tsx:37   ← Google Tag Manager, not an image
```

One nuance that reconciles this with the crawl. An image on a host outside
`remotePatterns` renders through `next/image` with `unoptimized`
(`src/lib/image-src.ts:24`), and `unoptimized` still emits a plain `<img>` into
the DOM pointing at the third-party URL. A crawler sees an unoptimized
third-party `<img>` and concludes the code bypasses `next/image`. It does not —
the degradation is deliberate, so that ~10k mirrored catalogue images cannot
exhaust the Vercel optimization quota. The exposure the spec worried about
(a third party can 404 or swap the file) is real for those rows; the diagnosis
is not.

Every picture on the storefront comes from one of three owner-controlled
channels. The work in this phase is **depth**, not rescue.

---

## 3.1 The three channels that exist today

| Channel | What it covers | Owner control | Where |
|---|---|---|---|
| **Site-image slots** | Editorial photography — heroes, process steps, material macros, workshop rooms, nav tiles | Replace, upload, pick from library, reset to default | `/studio/site-images` |
| **Entity images** | Product images, category tiles, portfolio cases + gallery, blog covers | Full CRUD in each entity's editor | `/studio/products`, `/categories`, `/portfolio`, `/blog` |
| **Brand assets** | Logo, hero video | `SiteSettings.logoUrl`, `heroVideoUrl` | `/studio/settings` |

### The slot registry, measured

`src/lib/site-images.ts` — **62 slots, 25 distinct bundled files:**

| Group | Slots | Notable members |
|---|--:|---|
| Homepage | 8 | `home.hero`, `home.maker`, `home.bespoke`, `home.print`, `home.why.*` ×4 |
| About | 17 | `about.hero`, `about.maker`, `about.material{1-4}.image` + `.macro`, `about.chapter{1-4}`, `about.studio{1-3}` |
| Process | 12 | `process.heroVideo`, `process.heroPoster`, `process.step{1-6}`, `process.material{1-4}` |
| Workshops | 9 | `workshops.hero`, `workshops.benefit{1-3}`, `workshops.private`, `workshops.room{1-4}` |
| Large format | 5 | `largeFormat.hero`, `largeFormat.consultation`, `largeFormat.step{1-3}` |
| Shop | 4 | `shop.editorialBreak`, `shop.group.{art,supplies,print}` |
| Navigation | 3 | `nav.art`, `nav.print`, `nav.supplies` (mega-menu tiles) |
| Commission · Contact · Portfolio | 1 each | the page heroes |
| Studio | 1 | `studio.login` |

Ratios already declared per slot: `4:5` ×29, `16:9` ×10, `4:3` ×8, `1:1` ×4,
`3:4` ×3, `21:9` ×2, `3:2` ×1.

The resolution contract is the one worth preserving verbatim, because the copy
layer copies it: `getSiteImages()` returns a **total** map — every registry key
resolves to a URL, so a missing row can never render a hole
(`src/lib/site-images-server.ts`). A DB failure logs and falls back to the
bundled set rather than failing the page.

### Why the "five image sources" finding no longer applies

| Spec claim | Repository reality |
|---|---|
| `/public/media` + `v2`/`v3`/`v6` folders, un-swappable | 52 files under `public/media`, referenced **only** as slot `fallback` defaults. Every one is replaceable from the studio, and "Import bundled images" copies all 25 into Blob storage. |
| Hotlinked `resinartsjaipur.com` / `i0.wp.com` raw `<img>` on 8 homepage products | No raw `<img>` for content images anywhere. Product images are DB rows; third-party URLs that arrive via sheet import are mirrored to Blob by `src/lib/catalog-mirror.ts` and the `/api/cron/mirror-images` job, and a mirror that fails degrades to an unoptimized `<img>` deliberately (`src/lib/image-src.ts:24`). |
| Cloudinary as a rogue second CDN | Still in `remotePatterns` (`next.config.ts:92`), still legitimate — but now one of three allowed hosts, all gated by `isOptimizableImageSrc()`. |
| No optimization | Every content image goes through `next/image` or a documented, quota-driven unoptimized path. |

Keep the spec's acceptance test — *"when `remotePatterns` has exactly one
entry, the hotlinking is gone"* — as a **goal**, not a defect report. Today the
list is three: Vercel Blob, Cloudinary, `kanhakreation.com`. Removing the last
two is a catalogue-migration task (`07-build-order.md`, Phase G), not a CMS
task.

---

## 3.2 What is actually missing

Six gaps, ordered by how often the owner will hit them.

### Gap 1 — Alt text is not editable next to the picture

Alt text lives in `messages/*.json` (`About.materials.alt1`,
`CustomOrder.page.heroImageAlt`, …). After `02-copy-layer.md` ships it becomes
editable — but on a *different screen* from the image it describes. An owner
who swaps `about.material2.image` for a different macro will not think to open
Site Copy and fix `About.materials.alt2`, and the site will confidently
describe the wrong photograph.

**Fix:** each `SiteImageSlot` gains `altKey?: string` naming its copy slot. The
Site Images board renders the alt field inline under the picture and writes
through to `SiteCopy`. One screen, two tables, no new concept.

```ts
export type SiteImageSlot = {
  key: string;
  group: SiteImageGroup;
  label: string;
  where: string;
  ratio: string;
  fallback: string;
  note?: string;
  /** The copy slot describing this picture, edited inline on the board. */
  altKey?: string;              // e.g. "About.materials.alt2"
};
```

Publishing gate: a slot with an `altKey` whose resolved value is empty is a
**publish blocker**, matching the spec's §6.8 rule and the existing
`a11y-audit.mjs` floor.

### Gap 2 — No mobile crop

Every slot is one file at one ratio. Ten slots are `16:9` and two are `21:9`;
on a 390px phone those lose their subject. This is the spec's finding #4 and it
is correct.

**Fix — additive, no migration of existing rows:**

```prisma
model SiteImage {
  key         String   @id
  url         String
  mediaId     String?
  /// Optional separate crop for viewports below 768px. Null renders `url`.
  mobileUrl   String?
  mobileMediaId String?
  /// Object-position for the desktop crop, 0–1. Defaults to dead centre.
  focalX      Float    @default(0.5)
  focalY      Float    @default(0.5)
  updatedAt   DateTime @updatedAt

  @@index([mediaId])
}
```

Rendering follows the spec's `<picture>` approach (§5.4), but as an extension
of the existing `MeniscusImage` component rather than a parallel `CmsImage` —
because **no image on this site fades in; the meniscus reveal replaces every
fade-up** (CLAUDE.md), and a second image component would quietly reintroduce
the fade.

`getSiteImages()` must keep returning a total map; make the map's value an
object (`{ url, mobileUrl, focalX, focalY }`) and update the ~40 call sites
mechanically, or add a parallel `getSiteImageRefs()` and migrate call sites
per-page. Prefer the latter — it keeps each page's diff reviewable.

### Gap 3 — Media rows carry almost no metadata

`Media` holds `url`, `pathname`, `type`, `folder` (a plain string, not a tree),
`bytes`, and nullable `width`/`height`. The upload action writes `bytes` and
leaves the dimensions null (`src/actions/media.ts:80–86`), so there is no LQIP,
no dominant colour, no checksum dedupe, no alt default, and no provenance —
which is also why §12.5's "AI Generated" filter cannot be built (CLAUDE.md,
Known gaps).

**Fix:** adopt the spec's `finalizeAsset()` ingest (§5.2) into the existing
upload path (`src/app/api/upload`, `src/lib/storage.ts`) rather than adding a
new `MediaAsset` table beside `Media`:

| Field | Why |
|---|---|
| `width`, `height` | Removes CLS; lets the picker warn below a slot's `minWidth` |
| `blurDataUrl` | The 20px LQIP the v3 masters already have in `src/lib/media-v3-blur.json` — uploads should get the same treatment |
| `checksum` (sha256, unique) | Dedupe. The owner *will* upload the same varmala shot four times |
| `dominantHex` | Placeholder colour before the meniscus reveal |
| `alt` | Per-asset default alt, inherited by any slot that does not override |
| `usageCount` | Powers the delete guard and the "Unused" filter |

`sharp` is the only new dependency and it is already in the Next.js image
pipeline's orbit; if adding it to the runtime is unwelcome, compute dimensions
and LQIP in the client before upload and validate server-side.

### Gap 4 — No focal point

A `4:5` slot filled with a `16:9` photograph crops the centre. For a maker
portrait that is a torso. `focalX`/`focalY` above plus a click-to-set overlay
in the picker (the spec's §6.4 `ImagePickerField`) solves it for one afternoon
of work and visibly improves half the site.

### Gap 5 — Surfaces with no slot at all

| Surface | Today | Should be |
|---|---|---|
| Favicon / `icon.svg` / `apple-icon.png` | Static files in `src/app/` | Brand settings, with a generated manifest |
| Default OG image | `src/app/opengraph-image.tsx` | `SiteSettings.defaultSeo.ogImage`, already a JSON column |
| The four commission "kinds" tiles | `Category.image` (`custom-order/page.tsx:297`) | Correct as-is — already owner-fed |
| The `pour-cure` scroll sequence | 121 bundled WebP frames | Deliberately excluded — see below |

### Gap 6 — The scroll sequence is un-swappable

121 frames at `public/sequences/pour-cure/frame_NNN.webp`, deliberately
excluded from the slot registry: they are one animation, not editorial imagery,
and 121 remote fetches would wreck the scrub
(`src/lib/site-images.ts`, header comment).

That reasoning is sound and should be preserved. If the owner ever needs to
replace the pour, model it as the spec's `MediaSequence` + `SequenceFrame`
(§3) with a **build-time** materialisation step, not per-request fetches:
the studio uploads a new set, a job writes them into the deployed asset
directory or a single Blob prefix, and the component keeps loading a
predictable path. Treat this as Phase H — genuinely optional.

---

## 3.3 Slot sizing guidance belongs in the picker

The spec's §5.5 table is good and the repo has nowhere to put it. Add
`minWidth` to `SiteImageSlot` and render it as the picker's `help` line, with
an amber warning (not a block) when the chosen asset is narrower:

| Slot kind | Desktop | Mobile | Min width |
|---|---|---|---|
| Page hero | 16:9 | 4:5 | 2400 |
| Collection / nav tile | 4:5 | 4:5 | 1200 |
| Process step | 3:2 | 3:2 | 1400 |
| Material macro | 1:1 | 1:1 | 1400 |
| Story split | 4:5 | 3:2 | 1600 |
| Product card | 1:1 | 1:1 | 1400 |
| Product gallery | 4:5 | 4:5 | 2000 |
| Blog cover | 16:9 | 4:5 | 1800 |
| OG / social | 1.91:1 | — | 1200×630 |

The existing masters are 3584px off the model (CLAUDE.md, Part 15 imagery), so
every bundled default already clears every row of this table. The guidance
exists for what the owner uploads next.

---

## 3.4 Media library, brought up to the spec

`/studio/media` exists. Add, in this order:

1. **Filters:** Images / Videos · by folder · by tag · **Missing alt** ·
   **Unused**. The two bold ones are the only filters that change behaviour
   rather than convenience.
2. **Search** across filename, original name, alt text and linked product name.
3. **"Used in"** per asset — `src/lib/media-usages.ts` already computes usage;
   surface it on the card and in the delete dialog.
4. **Delete guard:** `usageCount > 0` requires typing the filename and lists
   every usage. This repo already has `ConfirmDeleteDialog`
   (`src/components/studio/confirm-delete-dialog.tsx`) — reuse it.
5. **SEO filenames on upload** (spec §5.8). `WhatsApp Image 2026-07-07 at
   15.05.34.jpeg` must never reach production; normalise to
   `customised-resin-photo-frame-lifestyle-02.webp` and keep the original in
   `originalName` for search.

---

## 3.5 The in-studio editor — defer it, and say why

The spec's §5.7 tier-1 editor (crop / rotate / flip / brightness / resize via
`sharp`, recorded as a non-destructive `MediaEdit` row) is a good design and
the right call **later**. Focal point plus a mobile crop slot covers the actual
daily need — "the crop is wrong on phones" — at a fraction of the cost. Ship
Gaps 1, 2 and 4 first; revisit the editor once the owner has been using slots
with focal points for a month and can say what they still cannot do.

---

## 3.6 Guardrails the CMS must enforce

Editable images are the fastest way to break this particular design system.
Each of these maps to a check that already runs in CI or a documented rule:

| Rule | Source | Guardrail in the studio |
|---|---|---|
| Alt text must describe the picture, and must not be an ellipsis or a filename | `scripts/redesign-audit.mjs`, `a11y-audit.mjs` | Inline alt field, publish blocker when empty; reject values matching the filename |
| One `priority` image per page (the LCP) | REDESIGN.md Part 14, CLAUDE.md | `priority` is a property of the **slot**, not the row — the owner cannot add a second |
| No image fades in; the meniscus reveal replaces every fade-up | CLAUDE.md | Reveal is component-owned; no editable field exposes it |
| Max three dark bands per page, never adjacent | REDESIGN.md Part 3 | A dark hero image cannot change band count — band assignment stays in code |
| `next/image` throws at request time on a host outside `remotePatterns` | `next.config.ts:88`, `src/lib/image-src.ts` | Already enforced: `urlSchema` in `src/actions/site-images.ts:44` refuses a pasted third-party URL with a sentence explaining why |

That last row is the model for every validator in this plan: **refuse in the
studio, with a sentence the owner can act on, rather than letting a save
succeed and a page 500 later.**
