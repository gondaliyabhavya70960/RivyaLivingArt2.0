# 04 — The Structure Layer

Copy (`02`) and images (`03`) hand the owner every word and every picture. Four
things remain out of reach: **order, visibility, arity and new pages.** This
layer delivers three of them and deliberately refuses the fourth.

---

## 4.1 The decision that shapes everything else

The uploaded spec models a section as a **content container**: 24 Zod schemas,
each holding its own headline, body, images and CTAs in a `data` JSON blob, with
the existing components rewritten to take those props. That is the standard CMS
shape and it is the wrong one *for this repository*, for one reason:

> The content is already addressed. `Home.why.title` is a stable key.
> `home.why.handcrafted` is a stable slot. Moving the same string into
> `PageSection.data.heading.en` does not make it more editable — it makes it
> editable **in a second place**, and then the JSON file and the blob disagree.

So this plan splits what the spec fuses:

| | Spec's model | This plan |
|---|---|---|
| Section holds the copy | ✅ `data.headline.en` | ❌ — copy stays keyed, in `SiteCopy` |
| Section holds the images | ✅ `data.image.assetId` | ❌ — images stay slotted, in `SiteImage` |
| Section holds order | ✅ | ✅ |
| Section holds visibility | ✅ | ✅ |
| Section holds presentation switches | ✅ | ✅ (whitelisted per type) |
| Components rewritten to be props-driven | 40+ components | **0** for system pages |

A `PageSection` row here is a **manifest entry**, not a content blob. The
component keeps calling `t()` and reading `images[...]`; it simply learns
whether it renders, where in the order, and with which of a handful of declared
switches.

**Consequence, and it is the point:** the structure layer can ship page by
page, and a page that has not been converted still renders exactly as it does
today.

---

## 4.2 Schema

```prisma
/// Per-page section manifest. Rows carry ORDER, VISIBILITY and a small set of
/// whitelisted presentation switches — never the copy or the pictures, which
/// stay in SiteCopy and SiteImage against their own stable keys.
model PageSection {
  id        String   @id @default(cuid())
  /// Registry page key: "home" | "about" | "process" | …
  pageKey   String
  /// Registry section key: "home.why". Must exist in PAGE_SECTIONS.
  key       String
  order     Int
  enabled   Boolean  @default(true)
  /// Whitelisted switches, validated against the section's own Zod schema.
  options   Json     @default("{}")
  /// Internal staff note: "matches the Diwali campaign — don't reorder".
  notes     String?
  updatedById String?
  updatedAt DateTime @updatedAt

  @@unique([pageKey, key])
  @@index([pageKey, order])
}
```

No `data`, no `draftData`, no `version` on this table. Draft/publish is a
property of the whole content layer and lands once, in `06-governance.md`,
covering copy, images and structure together — three half-built draft
mechanisms would be worse than one.

---

## 4.3 The registry — and why it is the keystone

`src/lib/page-sections.ts` declares every section of every system page. It is
the third registry, and crucially it is the one that **joins the other two**:

```ts
export type SectionOption =
  | { name: string; type: "toggle";  label: string; default: boolean }
  | { name: string; type: "select";  label: string; options: { value: string; label: string }[]; default: string }
  | { name: string; type: "number";  label: string; min: number; max: number; default: number; suffix?: string };

export type SectionDef = {
  /** Stable key; also the DOM id and the anchor. */
  key: string;
  label: string;
  /** One line on what the section is for, shown in the editor. */
  description: string;
  /** false for sections the page cannot lose — the hero, the order CTA. */
  hideable: boolean;
  /** false for sections pinned in place — the hero is always first. */
  movable: boolean;
  /** Copy slots this section owns, so the editor can show its words. */
  copyKeys: string[];
  /** Image slots this section owns, so the editor can show its pictures. */
  imageKeys: SiteImageKey[];
  /** Entities it reads, so the editor can link to them. */
  entities?: ("product" | "category" | "portfolio" | "post" | "faq" | "testimonial")[];
  /** Whitelisted presentation switches. Never CSS. */
  options?: SectionOption[];
  /** Design constraints the editor must enforce — see §4.6. */
  band?: "dark" | "light";
};

export const PAGE_SECTIONS: Record<string, SectionDef[]> = {
  home: [ /* 20 entries, in default order */ ],
  about: [ /* 9 */ ],
  process: [ /* 6 */ ],
  workshops: [ /* 10 */ ],
  "custom-order": [ /* 7 */ ],
  contact: [ /* 4 */ ],
};
```

`copyKeys` and `imageKeys` are derivable, not hand-typed: a section owns the
copy keys under its i18n sub-namespace (`Home.why.*`) and the image slots whose
key shares its prefix (`home.why.*`). The naming discipline the repo already
follows makes this nearly free — `scripts/page-sections-check.mjs` asserts that
every copy key and every image slot is claimed by exactly one section, and
fails CI on an orphan.

### What this unlocks: one editor instead of three

Without the join, the owner has three screens — Site Copy, Site Images, and a
structure screen — and has to know that "the Why band" means `Home.why.*` plus
`home.why.handcrafted`. With it, `/studio/pages/home` can render:

```
Homepage                                  [ Preview ] [ English ▾ ]
──────────────────────────────────────────────────────────────────
⠿ ● Hero                        pinned · dark band
⠿ ● The manifesto                                       3 words
⠿ ● From liquid to light        the pinned pour scrub  11 words
⠿ ● The collections                     26 words · 6 category tiles
⠿ ○ Occasions                   hidden                  8 words
⠿ ● Why ResinRiva                       24 words · 4 pictures   ▾
        ┌────────────────────────────────────────────────────┐
        │ Eyebrow      why resinriva                         │
        │ Heading      Four reasons a piece stays            │
        │ Handcrafted  [🖼 4:5]  Poured by hand, never cast   │
        │ Bespoke      [🖼 4:5]  …                            │
        │ Layout       ⦿ 4 across   ○ 2 × 2                  │
        └────────────────────────────────────────────────────┘
⠿ ● The maker                            5 words · 1 picture
⠿ ● Commission band             dark band  8 words · 1 picture
```

That is the product the request is actually asking for — *"all page content and
image manageable"* on one screen, per page — and it costs a registry file
rather than a rewrite of forty components.

---

## 4.4 Rendering: what each page.tsx has to change

Today a page is one long server component. To honour order and visibility it
becomes a manifest walk. The mechanical shape, using `/about` as the example:

**Step 1 — extract each section into a component.** Pure cut-and-paste; the
JSX, the `t()` calls and the slot reads move together into
`src/components/sections/about/*.tsx`. No behaviour changes, no props beyond
what the section already closed over (`t`, `images`, `settings`).

**Step 2 — declare them in the registry** with their copy and image keys.

**Step 3 — render from the manifest:**

```tsx
const sections = await getPageSections("about");   // cached, tag: page-sections

return (
  <>
    {sections.map((s) => (
      <PageSectionSlot key={s.key} section={s} locale={locale} ctx={ctx} />
    ))}
  </>
);
```

**Step 4 — `PageSectionSlot` never crashes production.** Straight from the
spec's §8.5, and worth keeping verbatim in spirit:

```tsx
export function PageSectionSlot({ section, ctx, draft }: Props) {
  const def = PAGE_SECTIONS_BY_KEY[section.key];
  if (!def) return draft ? <DevError msg={`Unknown section "${section.key}"`} /> : null;

  const parsed = optionsSchema(def).safeParse(section.options);
  if (!parsed.success) {
    console.error("[cms] invalid section options", section.key, parsed.error.flatten());
    return draft ? <DevError msg={`"${section.key}" has invalid options`} /> : null;
  }

  const C = SECTION_COMPONENTS[section.key];
  return (
    <section id={section.key} data-cms-section={section.key}>
      <C {...ctx} options={parsed.data} />
    </section>
  );
}
```

A bad row hides one section instead of 500-ing the homepage.

**Cost, honestly:** roughly a day per page for the six marketing pages, plus a
day for the renderer and the registry. It is the largest single chunk of work
in this plan, which is exactly why it comes after the copy layer has already
delivered most of the value.

---

## 4.5 Presentation switches — the whitelist

Studio owns content plus a small, closed set of switches. Never CSS. The list
below is what the existing components can honour without new design work:

| Switch | Sections | Values |
|---|---|---|
| `imageSide` | story split, image CTA, maker | `start` \| `end` (logical, so RTL mirrors) |
| `align` | hero, section headings | `left` \| `center` |
| `columns` | why grid, materials, values | `4` \| `2` |
| `limit` | featured products, portfolio rail, journal rail | 3–8 |
| `source` | featured products | `featured` \| `newest` \| `category` |
| `showCounts` | collections | on/off |
| `height` | hero | `tall` \| `standard` \| `compact` |
| `overlayOpacity` | dark bands | 25–55, in steps of 5 |

Two rules that keep this from becoming CSS-by-another-name:

1. **Every value maps to an existing token or an existing variant.**
   `overlayOpacity` is clamped to the band range REDESIGN.md already defines;
   it is not a free number.
2. **Logical properties only.** `imageSide` is `start`/`end`, never
   `left`/`right` — Arabic is a shipped locale and an unmirrored RTL is worse
   than none (CLAUDE.md).

---

## 4.6 Guardrails: the design system is not the editor's to break

This is where an editable site normally goes wrong. Every rule below is already
enforced by `scripts/redesign-audit.mjs` in CI; the editor must enforce it at
save time, because CI does not run when the owner presses Publish.

| Rule | Enforcement in the editor |
|---|---|
| **Max three dark bands per page** | `band: "dark"` is declared per section. Enabling a fourth is refused, naming the three already on |
| **Dark bands never adjacent** | Reorder is refused if it would place two `dark` sections next to each other, with the offending pair named |
| **Exactly one `h1`** | The section owning the `h1` is `hideable: false` |
| **Max two champagne accents per viewport** | Accent use is component-owned; no switch exposes it |
| **Max two `section-major`** | Spacing preset is component-owned, not a switch |
| **One `priority` image per page** | `priority` belongs to the slot, not the row |
| **The two sanctioned scroll pins** | `movable: false` on the pinned sections; the pour scrub cannot be reordered into a second pin |
| **Numbers in mono, no raw hex** | Not reachable from any editable field |

A refusal must say *why*, in the owner's language: **"The homepage already has
three dark bands — the hero, Commission and the closing CTA. Hide one before
turning this on."** A silent disable, or a save that quietly breaks the CI
audit on the next PR, is the failure mode to design against.

---

## 4.7 What this layer deliberately does not do

**Arity stays fixed.** The owner cannot add a fifth material to a grid built
for four, or a fourth step to the three-step signature. Repeaters are the
single fastest route to a broken luxury layout, and REDESIGN.md's whole
argument is that the composition is the product. If a fifth material is a real
business need, it is a design change with a code change behind it — which is a
feature of this plan, not a limitation of it.

The one place repeaters are correct is **entities**, and those already have
them: products, portfolio cases, journal posts, FAQs and testimonials are
unbounded lists with full CRUD today.

---

## 4.8 Custom landing pages — where the spec's model *is* right

Seasonal drops (Diwali gifting, wedding-season varmala) have no i18n keys and
no slots, because they do not exist until the owner invents them. Here, and
only here, the content must live in the row.

```prisma
model CustomPage {
  id        String        @id @default(cuid())
  slug      String        @unique          // → /p/diwali-2026
  title     Json                            // localized
  status    PublishStatus @default(DRAFT)
  seo       Json          @default("{}")
  publishAt DateTime?
  blocks    CustomBlock[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

model CustomBlock {
  id       String     @id @default(cuid())
  pageId   String
  page     CustomPage @relation(fields: [pageId], references: [id], onDelete: Cascade)
  /// Registry key from CUSTOM_BLOCKS — a deliberately small catalogue.
  type     String
  order    Int
  /// Zod-validated per type. THIS one holds content, because there is no key.
  data     Json       @default("{}")

  @@index([pageId, order])
}
```

Keep the block catalogue **small and boring** — six types, not twenty-four:

| Block | Fields |
|---|---|
| `hero` | image (slot-free, media picker), eyebrow, headline, body, one CTA |
| `richText` | heading, Tiptap body (the editor already exists, `src/components/studio/rich-text-editor.tsx`) |
| `productGrid` | heading, mode (`manual` \| `category` \| `featured`), refs, limit |
| `imageCta` | image, heading, body, CTA, image side |
| `faqPicker` | heading, FAQ refs |
| `finalCta` | heading, body, CTA (WhatsApp-aware) |

Route: `src/app/[locale]/(v2)/p/[slug]/page.tsx`, `dynamicParams` on, ISR 300s,
`notFound()` for `DRAFT` outside draft mode. Scheduling piggybacks on the cron
in `06-governance.md`.

**Do not let this catalogue grow.** Every block added is a block that must
survive the next redesign. Six blocks cover a festival lander; twenty-four
recreate the layout rot the fixed registry exists to prevent.
