# 05 — Globals & Business Config

The chrome, the nav, and the handful of values that are not copy at all — they
are how the business runs. This is the shortest layer and, per hour spent, the
one the owner will feel most often.

---

## 5.1 What `SiteSettings` already gives you

`prisma/schema.prisma` — a singleton row, `id = "main"`, edited at
`/studio/settings` (ADMIN-only):

| Field | Consumed by |
|---|---|
| `brandName`, `tagline` | metadata, footer |
| `logoUrl` | header, footer |
| `heroVideoUrl` | process hero |
| `announcement` | announcement bar, falling back to `Common.announcementDefault` |
| `phone`, `email`, `whatsappNumber` | footer, contact, every `wa.me` link |
| `mapsUrl`, `address` | footer, contact |
| `socials` (JSON) | footer — Instagram, Facebook, YouTube, Pinterest |
| `defaultSeo` (JSON) | metadata defaults |
| `defaultCareNotes` | product pages |
| `chartTimezone` | studio charts |

Two observations that matter:

- **The social links are fully wired already.** `settings.socials` is edited at
  `/studio/settings` (`settings-form.tsx:87`) and rendered in the footer, which
  shows only the URLs the owner actually filled
  (`src/components/storefront/footer.tsx:33`, `SOCIAL_ORDER` = Instagram,
  Facebook, YouTube, Pinterest). The spec's finding "no social links anywhere"
  is therefore about the *accounts*, not the code — nothing renders because
  nothing is filled in. That is a business task, not a build task. LinkedIn is
  the only listed channel with no field.
- **There is no opening-hours field** (CLAUDE.md, Known gaps), so `/contact`
  shows the address and no hours.

---

## 5.2 The four fields to add to `SiteSettings`

Small, additive, one migration:

```prisma
model SiteSettings {
  // …existing…
  /// [{ day: "Mon–Sat", hours: "10:00–19:00" }, …] — rendered on /contact.
  businessHours   Json    @default("[]")
  /// "We usually reply within 4 hours." — shown next to the WhatsApp CTA.
  responseNote    String?
  /// Announcement scheduling, so a festival strip retires itself.
  announcementStartsAt DateTime?
  announcementEndsAt   DateTime?
  announcementDismissible Boolean @default(true)
  announcementHref     String?
}
```

The announcement fields are worth their small cost: today the strip is a
string that stays until someone remembers to clear it. A Diwali message still
running in December is the kind of thing a customer notices and a studio does
not.

---

## 5.3 Commission form options — the highest-value single change

Four English literals in a client component
(`src/components/sections/custom-order-form.tsx:41–65`) decide what a customer
can tell you about their commission:

```
MATERIAL_OPTIONS   Epoxy resin · Resin + wood · Jesmonite · 3D printed · Not sure — advise me
BUDGET_OPTIONS     Under ₹2,000 · ₹2,000–₹5,000 · ₹5,000–₹15,000 · ₹15,000–₹50,000 · Above ₹50,000 · Flexible
TIMELINE_OPTIONS   No rush · Within 2 weeks · Within a month · A specific date (mention in notes)
OCCASION_OPTIONS   OCCASIONS + "Other"
```

Two defects in one place:

1. **Business config in code.** A new budget band, a new material, a
   festival-specific timeline — each is a deploy.
2. **They bypass next-intl entirely.** `"Under ₹2,000"` renders in English on
   all nine locales, inside a form whose labels *are* translated. That is a
   live bug today, independent of any CMS work.

### The model

```prisma
enum FormOptionList { MATERIAL OCCASION BUDGET TIMELINE }

model FormOption {
  id       String         @id @default(cuid())
  list     FormOptionList
  /// Stable machine value stored on the Inquiry and sent to WhatsApp.
  value    String
  /// Localized label shown in the dropdown: { en: "…", hi: "…", … }
  label    Json           @default("{}")
  order    Int            @default(0)
  enabled  Boolean        @default(true)

  @@unique([list, value])
  @@index([list, order, enabled])
}
```

**The `value` / `label` split is the whole design.** Existing `Inquiry` rows
store the option text that was chosen. If the owner renames a band, historical
inquiries must not change meaning and the WhatsApp message must stay
consistent. So `value` is minted once and immutable; `label` is what the
customer reads and what the owner edits, per locale.

### Migration without touching a single Inquiry

Seed `FormOption` from the current constants, using the **existing English
strings as the `value`s**. That way every historical inquiry still matches, the
form renders identically on day one, and localisation becomes an edit rather
than a data migration.

```ts
// prisma/seed-form-options.ts
const SEED = {
  MATERIAL: ["Epoxy resin", "Resin + wood", "Jesmonite", "3D printed", "Not sure — advise me"],
  BUDGET:   ["Under ₹2,000", "₹2,000–₹5,000", "₹5,000–₹15,000", "₹15,000–₹50,000", "Above ₹50,000", "Flexible"],
  TIMELINE: ["No rush", "Within 2 weeks", "Within a month", "A specific date (mention in notes)"],
  OCCASION: [...OCCASIONS, "Other"],
};
// value = the string, label = { en: the string }
```

### Studio screen — `/studio/forms`

A four-tab list: drag to reorder, toggle `enabled`, edit the label per locale,
add a row. **Delete is a soft disable**, never a hard delete, because a deleted
option orphans the inquiries that chose it.

### What must not change

`src/actions/order.ts` builds the WhatsApp message from the submitted values
(`submitCustomOrder`, line 351) and saves an `Inquiry` before redirecting to
`wa.me/…`. That flow is a HARD RULE (CLAUDE.md) and this change must be
invisible to it: the form still submits a string, the action still stores a
string, `buildOrderMessage` still formats it. Only the *source of the list*
moves.

---

## 5.4 Navigation — header and footer

### Today

| | Labels | Hrefs |
|---|---|---|
| Header nav | `Nav` namespace (30 keys) | route constants + `getCatalogNav()` for categories |
| Mega menu | `Nav` | Category rows from the DB ✅ |
| Footer | `Footer` namespace (24 keys) | **`FOOTER_LINKS` in `src/lib/constants.ts:61`** — four columns, 12 links, all hardcoded |

The copy layer already makes every label editable. What remains is the **href,
the order, and the ability to add or remove a link.**

### The model

Take the spec's `NavMenu`/`NavItem` almost unchanged — it is the right shape:

```prisma
model NavMenu {
  key   String    @id     // header | footer-explore | footer-studio | footer-journal | footer-legal
  label String
  items NavItem[]
}

model NavItem {
  id       String   @id @default(cuid())
  menuKey  String
  menu     NavMenu  @relation(fields: [menuKey], references: [key], onDelete: Cascade)
  parentId String?
  parent   NavItem? @relation("NavTree", fields: [parentId], references: [id], onDelete: Cascade)
  children NavItem[] @relation("NavTree")
  /// Localized label. Seeded from the current Footer.* / Nav.* values.
  label    Json     @default("{}")
  href     String
  order    Int
  visible  Boolean  @default(true)
  newTab   Boolean  @default(false)

  @@index([menuKey, order])
}
```

### The one validator that matters

A nav item pointing at a route that does not exist is a 404 the owner shipped
themselves. `href` must validate against a **route manifest** — the known
storefront routes, plus `category:<slug>`, `product:<slug>`, `page:<slug>`,
`whatsapp`, and external `https://`. Resolve the prefixed forms at render, so
renaming a category slug does not silently break the footer.

Seed from `FOOTER_LINKS` and the current header list so day one is
byte-identical, then delete the constant.

---

## 5.5 SEO

**This is the layer that is furthest ahead of the spec.** The uploaded spec
lists `FAQPage` JSON-LD as the "biggest quick win" and treats structured data
as unbuilt. It is built. Counted across `src/app`:

```
FAQPage · Product · AggregateOffer · Organization · LocalBusiness · Brand
Article · VisualArtwork · CollectionPage · WebSite · SearchAction
BreadcrumbList ×4 · ListItem ×10 · Person · PostalAddress · ContactPoint
```

`FAQPage` is emitted from the live studio-managed questions
(`src/app/[locale]/(v2)/faq/page.tsx:91`), reading the same localized rows the
page renders — so the schema can never drift from the visible content. Do not
rebuild any of this.

The genuine remaining work is small:

1. **Keep JSON-LD reading the same data the page renders.** As copy becomes
   editable, an SEO description that was hand-written and a heading that is now
   owner-edited can diverge. Prefer deriving from the rendered content.
2. **`LocalBusiness` gains `openingHours`** once §5.2 lands — the schema is
   already emitted, the field simply does not exist yet.
3. **`Event` per workshop** when Workshops become an entity.
4. **Custom pages** join `sitemap.ts` (which already reads the database) with a
   `noindex` toggle for campaign pages that should not be discoverable.

Never let JSON-LD itself become an editable field: a hand-typed schema block is
a permanent source of invalid markup. Emit it from server components off the
database, as the repo already does.

`sitemap.ts` and `robots.ts` already exist and read the database. When custom
pages land (`04`, §4.8), add them to the sitemap and give `CustomPage` a
`noindex` toggle for campaign pages that should not be discoverable.

---

## 5.6 Price presentation

The spec flags a contradiction — exact prices on cards, "indicative price band"
in the FAQ. In this repo the model is already closer than the spec assumes:
`Product` has `priceMin`, `priceMax` and `showPrice`.

What is missing is a single, explicit resolution of how those three combine, so
that cards, the PDP, JSON-LD and the WhatsApp message all agree:

| State | Renders |
|---|---|
| `showPrice = false` | "Price on request" |
| `priceMin` only | "From ₹9,499" |
| `priceMin = priceMax` | "₹9,499" |
| `priceMin < priceMax` | "₹8,000 – ₹12,000" |

Implement as one exported helper (`formatPriceDisplay(product, locale)`) used
by every surface, and make the FAQ copy match — it is now an editable string,
so the owner can reconcile it themselves once the rule is real.

---

## 5.7 Locales — decide, don't drift

Nine locales are enabled and, with the copy layer, nine locales become editable.
That is 1,149 × 9 ≈ 10,300 strings of owned surface area.

The catalogues are genuinely translated today (`routing.ts` turned on
`localeDetection` for exactly that reason), so this is not the spec's "9
locales, 1 language" finding. The risk is different and slower: **the owner
edits English and the other eight drift.**

Two mechanisms, both cheap:

1. **A coverage indicator per locale on the copy board** — "Hindi · 1,137
   default · 12 changed" — so drift is visible rather than discovered.
2. **A staleness flag.** When an English override is saved, mark the same key's
   other-locale rows `stale = true` and surface them in a "Needs re-translation"
   filter. Without this, an owner improving an English headline silently leaves
   eight languages describing the old one.

`scripts/i18n-missing.mjs` keeps guarding the JSON files; the flag guards the
overrides. Add an AI-assist button per field if you want (the spec's §9 pattern
works), but flag machine output so a human verifies before it ships — a luxury
brand is exactly the wrong place for an unreviewed translation.
