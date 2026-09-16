import type { CopySlot } from "./site-copy";

/**
 * Hand-written overlay for the generated copy registry.
 *
 * The generator derives a slot's surface, kind and constraints from the key
 * itself, which is right often enough that most of the ~1,100 slots need no
 * entry here. This file exists for the ones where a derived label would leave
 * the owner guessing — "Fact commissions" tells them nothing — and for the
 * handful where changing the words changes what the studio is promising.
 *
 * Add an entry when the answer to "would the owner know what this is?" is no.
 * Everything omitted falls back to the humanised leaf name.
 */
export const COPY_SLOT_OVERRIDES: Record<string, Partial<CopySlot>> = {
  /* ————————————————— Homepage ————————————————— */
  "Home.hero.eyebrow": {
    label: "Hero eyebrow",
    where: "The mono line above the headline, first thing on the page",
    max: 48,
  },
  "Home.hero.headline": {
    label: "Hero headline",
    where: "The first line a visitor reads",
    max: 80,
    note: "Best at three to five words — it is set very large and wraps badly past that.",
  },
  "Home.hero.lead": {
    label: "Hero paragraph",
    where: "Under the headline, above the two buttons",
    max: 400,
  },
  "Home.hero.ctaExplore": {
    label: "Hero button · explore",
    where: "Links to /shop",
  },
  "Home.hero.ctaBespoke": {
    label: "Hero button · commission",
    where: "Links to /custom-order",
  },
  "Home.hero.factPlace": {
    label: "Hero fact · place",
    where: "The mono row beneath the hero buttons",
  },
  "Home.hero.factMadeToOrder": {
    label: "Hero fact · made to order",
    where: "The mono row beneath the hero buttons",
  },
  "Home.hero.factLeadTime": {
    label: "Hero fact · lead time",
    where: "The mono row beneath the hero buttons",
  },
  "Home.hero.factCommissions": {
    label: "Hero fact · commission count",
    where: "The mono row beneath the hero buttons",
    note: "{count} is filled in from the number of published portfolio cases. Keep it.",
  },
  "Home.manifesto.line1": {
    label: "Manifesto line 1",
    where: "Homepage · 02, the large two-line statement",
  },
  "Home.manifesto.line2": {
    label: "Manifesto line 2",
    where: "Homepage · 02, the large two-line statement",
  },
  "Home.showcase.heading": {
    label: "Material story heading",
    where: "Homepage · 04, over the pinned pour animation",
  },
  "Home.showcase.stage1Title": {
    label: "Stage 1 title",
    where: "Homepage · 04 — “The pour”",
  },
  "Home.showcase.stage2Title": {
    label: "Stage 2 title",
    where: "Homepage · 04 — “The gild”",
  },
  "Home.showcase.stage3Title": {
    label: "Stage 3 title",
    where: "Homepage · 04 — “The cure”",
  },
  "Home.showcase.stage4Title": {
    label: "Stage 4 title",
    where: "Homepage · 04 — “The polish”",
  },
  "Home.showcase.staticAlt": {
    label: "Pour animation description",
    where:
      "Read aloud in place of the animation, and shown under reduced motion",
    note: "Describe what the animation shows. It is the only description a screen reader gets.",
  },
  "Home.collections.heading": {
    label: "Collections heading",
    where: "Homepage · 05, above the six tiles",
  },
  "Home.collections.pieceCount": {
    label: "Collection piece count",
    where: "On each collection tile",
    note: "{count} is the live number of pieces. Removing it deletes the number everywhere.",
  },
  "Home.maker.heading": {
    label: "The maker · heading",
    where: "Homepage · 06",
  },
  "Home.maker.imageAlt": {
    label: "The maker · photo description",
    where: "Describes the maker portrait",
    note: "This is the one photograph on the site that is never AI-generated. Describe the real person.",
  },
  "Home.cta.heading": {
    label: "Closing heading",
    where: "Homepage · 13, the final dark band",
  },

  /* ————————————————— About ————————————————— */
  "About.hero.headline": {
    label: "About headline",
    where: "About, over the wide texture band",
    max: 80,
  },
  "About.maker.heading": {
    label: "The maker · heading",
    where: "About · the maker block",
  },
  "About.materials.alt1": {
    label: "Material 1 · photo description",
    where: "Describes the first material frame",
  },
  "About.materials.alt2": {
    label: "Material 2 · photo description",
    where: "Describes the second material frame",
  },
  "About.materials.alt3": {
    label: "Material 3 · photo description",
    where: "Describes the third material frame",
  },
  "About.materials.alt4": {
    label: "Material 4 · photo description",
    where: "Describes the fourth material frame",
  },

  /* ————————————————— Process ————————————————— */
  "Process.timelines.smallHeading": {
    label: "Lead time · small pieces",
    where: "Process · the timeline bands, and quoted on the commission page",
    note: "This is a promise. The commission board measures real jobs against these bands.",
  },
  "Process.timelines.statementHeading": {
    label: "Lead time · statement pieces",
    where: "Process · the timeline bands, and quoted on the commission page",
    note: "This is a promise. The commission board measures real jobs against these bands.",
  },

  /* ————————————————— Commission ————————————————— */
  "CustomOrder.page.heroHeadline": {
    label: "Commission headline",
    where: "The split hero on /custom-order",
    max: 80,
  },
  "CustomOrder.page.heroAnchorSmall": {
    label: "Hero anchor · small pieces",
    where: "The mono lead-time line in the commission hero",
    note: "Keep this in step with the Process page's timeline bands — they are the same promise.",
  },
  "CustomOrder.page.heroAnchorStatement": {
    label: "Hero anchor · statement pieces",
    where: "The mono lead-time line in the commission hero",
    note: "Keep this in step with the Process page's timeline bands — they are the same promise.",
  },
  "CustomOrder.form.disclaimer": {
    label: "Form disclaimer",
    where: "Directly above the send button",
    note: "States that no payment happens on the site. Do not remove that — it is how the studio takes orders.",
  },
  "CustomOrder.form.submitSend": {
    label: "Send button",
    where: "Opens WhatsApp with the filled-in summary",
  },

  /* ————————————————— Site chrome ————————————————— */
  "Common.announcementDefault": {
    label: "Announcement bar · default",
    where: "The strip above the header",
    note: "Only shown when Site Settings has no announcement of its own.",
  },
  "Footer.rights": {
    label: "Copyright line",
    where: "The bottom of every page",
    note: "{year} is filled in automatically. Keep it, or the year stops updating.",
  },
  "Footer.explore": {
    label: "Footer column 1 heading",
    where: "Rendered in uppercase whatever you type",
  },
  "Footer.studio": {
    label: "Footer column 2 heading",
    where: "Rendered in uppercase whatever you type",
  },
  "Footer.journal": {
    label: "Footer column 3 heading",
    where: "Rendered in uppercase whatever you type",
  },
  "Footer.contact": {
    label: "Footer contact heading",
    where: "Rendered in uppercase whatever you type",
  },

  /* ————————— The three product tiers (docs/plan/07) ————————— */
  // Keyed by the enum value, so a section on the board reads "LARGE_FORMAT"
  // — these entries are what make the rows legible. `name` and `shortName`
  // must stay equal to the studio's own labels (product-size-tier.ts);
  // product-size-tier.test.ts fails the build if they drift.
  "ProductTier.LARGE_FORMAT.name": {
    label: "Tier 1 · customer name",
    where: "Collectible Furniture & Spatial Art — the tier's name wherever the storefront says it",
    note: "Must match the studio's label in product-size-tier.ts; a test pins the two.",
    max: 48,
  },
  "ProductTier.LARGE_FORMAT.shortName": {
    label: "Tier 1 · one-word name",
    where: "Collectible — dense cells and chips",
    max: 16,
  },
  "ProductTier.LARGE_FORMAT.promise": {
    label: "Tier 1 · promise line",
    where: "Collectible Furniture & Spatial Art — the one-line promise on a band or collection header; a card's eyebrow is the piece's own category",
    max: 48,
  },
  "ProductTier.LARGE_FORMAT.primaryCta": {
    label: "Tier 1 · primary button",
    where: "Collectible pieces — the order panel's main action",
  },
  "ProductTier.LARGE_FORMAT.secondaryCta": {
    label: "Tier 1 · secondary button",
    where: "Collectible pieces — opens the WhatsApp thread; nothing is booked",
  },
  "ProductTier.MEDIUM_FORMAT.name": {
    label: "Tier 2 · customer name",
    where: "Memory & Celebration Art — the tier's name wherever the storefront says it",
    note: "Must match the studio's label in product-size-tier.ts; a test pins the two.",
    max: 48,
  },
  "ProductTier.MEDIUM_FORMAT.shortName": {
    label: "Tier 2 · one-word name",
    where: "Memory — dense cells and chips",
    max: 16,
  },
  "ProductTier.MEDIUM_FORMAT.promise": {
    label: "Tier 2 · promise line",
    where: "Memory & Celebration Art — the one-line promise on a band or collection header; a card's eyebrow is the piece's own category",
    max: 48,
  },
  "ProductTier.MEDIUM_FORMAT.primaryCta": {
    label: "Tier 2 · primary button",
    where: "Memory pieces — the order panel's main action",
  },
  "ProductTier.MEDIUM_FORMAT.secondaryCta": {
    label: "Tier 2 · secondary button",
    where: "Memory pieces — jumps to the customization fields",
  },
  "ProductTier.SMALL_FORMAT.name": {
    label: "Tier 3 · customer name",
    where: "Personal Art & Gifting — the tier's name wherever the storefront says it",
    note: "Must match the studio's label in product-size-tier.ts; a test pins the two.",
    max: 48,
  },
  "ProductTier.SMALL_FORMAT.shortName": {
    label: "Tier 3 · one-word name",
    where: "Personal — dense cells and chips",
    max: 16,
  },
  "ProductTier.SMALL_FORMAT.promise": {
    label: "Tier 3 · promise line",
    where: "Personal Art & Gifting — the one-line promise on a band or collection header; a card's eyebrow is the piece's own category",
    max: 48,
  },
  "ProductTier.SMALL_FORMAT.primaryCta": {
    label: "Tier 3 · primary button",
    where: "Personal pieces — the order panel's main action. WhatsApp ordering; there is no cart",
  },
  "ProductTier.SMALL_FORMAT.secondaryCta": {
    label: "Tier 3 · secondary button",
    where: "Personal pieces — jumps to the personalization fields",
  },
};
