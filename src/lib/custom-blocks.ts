/**
 * The block catalogue for custom landing pages.
 *
 * Everywhere else in this codebase, content is addressed by a key that exists
 * in the repository: a copy slot, an image slot, a section in the manifest.
 * That works because the pages are known in advance. A seasonal lander is not
 * — a Diwali gifting page has no `Home.hero.title` because nobody wrote one,
 * and inventing keys at runtime would put strings in `messages/*.json` that no
 * translator ever sees. So **here, and only here, the content lives in the
 * row** (`docs/studio-cms/04-structure-layer.md` §4.8).
 *
 * The price of that is layout rot: a page whose blocks are arbitrary drifts
 * away from the design the moment two of them disagree. The guard is the
 * catalogue's SIZE. Six types. Each one validated by a Zod schema, each field
 * declared, each ground computed rather than chosen. Adding a seventh is a
 * decision to maintain a seventh through the next redesign — take it
 * deliberately or not at all.
 *
 * Plain module, no server imports: the studio editor and the storefront
 * renderer both read it.
 */

import { z } from "zod";

import { describeHrefProblem } from "@/lib/nav-menus";

/* ═══════════════════════ field primitives ═══════════════════════ */

const text = (max: number) => z.string().trim().max(max).default("");

/**
 * A link an owner typed. Validated against the site's real routes by the same
 * function the navigation board uses, so "/p/diwali-2026" is accepted and
 * "/diwali" is refused with the reason.
 *
 * Empty is allowed and means "no button" — a hero without a call to action is
 * a legitimate hero, and forcing one would put a dead button on the page.
 */
const href = z
  .string()
  .trim()
  .max(300)
  .default("")
  .superRefine((value, ctx) => {
    if (!value) return;
    const problem = describeHrefProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/**
 * A media-library URL for a video (or its poster), or empty. Same rule as
 * `imageUrl` — site-root paths and absolute URLs only — with wording that
 * does not tell an owner to "pick a picture" when they are pointing at a
 * film.
 */
const mediaUrl = z
  .string()
  .trim()
  .max(600)
  .default("")
  .superRefine((value, ctx) => {
    if (!value) return;
    if (value.startsWith("/") || /^https?:\/\//i.test(value)) return;
    ctx.addIssue({
      code: "custom",
      message: "Pick a file from the library, or paste a full https:// URL.",
    });
  });

/** A media-library URL, or empty. Site-root paths and absolute URLs only. */
const imageUrl = z
  .string()
  .trim()
  .max(600)
  .default("")
  .superRefine((value, ctx) => {
    if (!value) return;
    if (value.startsWith("/") || /^https?:\/\//i.test(value)) return;
    ctx.addIssue({
      code: "custom",
      message: "Pick a picture from the library, or paste a full https:// URL.",
    });
  });

/** A Tiptap document. Shape only — the renderer sanitises hrefs on output. */
const richText = z
  .record(z.string(), z.unknown())
  .default(() => ({ type: "doc", content: [] }));

/* ═══════════════════════ the six blocks ═══════════════════════ */

export const heroSchema = z.object({
  image: imageUrl,
  imageAlt: text(200),
  eyebrow: text(60),
  headline: text(160),
  body: text(600),
  ctaLabel: text(40),
  ctaHref: href,
});

export const richTextSchema = z.object({
  heading: text(160),
  body: richText,
});

export const productGridSchema = z.object({
  heading: text(160),
  intro: text(400),
  /**
   * Where the products come from. `manual` is a list of slugs the owner
   * picked; `category` is one category slug; `featured` is the catalogue's own
   * curated flag. No mode invents a product — HARD RULES §1.1.
   */
  mode: z.enum(["manual", "category", "featured"]).default("featured"),
  slugs: z.array(z.string().trim().max(160)).max(12).default([]),
  category: text(160),
  limit: z.number().int().min(2).max(12).default(4),
});

export const imageCtaSchema = z.object({
  image: imageUrl,
  imageAlt: text(200),
  heading: text(160),
  body: text(800),
  ctaLabel: text(40),
  ctaHref: href,
  /** Which side the picture sits on. Logical, so Arabic mirrors it. */
  imageSide: z.enum(["start", "end"]).default("start"),
});

export const faqPickerSchema = z.object({
  heading: text(160),
  faqIds: z.array(z.string().trim().max(40)).max(12).default([]),
});

/** Section spacing an owner may choose. Never `section-major` — a lander
 *  assembled from a menu does not get to claim the page's two big moments,
 *  those are reserved for pages a person actually designed. */
const spacing = z.enum(["compact", "standard"]).default("standard");

export const collectionGridSchema = z.object({
  heading: text(160),
  intro: text(400),
  /** Up to six collections, in the order the owner picked them. */
  slugs: z.array(z.string().trim().max(160)).max(6).default([]),
  spacing,
});

export const portfolioGridSchema = z.object({
  heading: text(160),
  intro: text(400),
  /** `recent` is the newest published case studies; `manual` is up to six the
   *  owner chose by slug. No mode invents a case study (HARD RULES §1.1). */
  mode: z.enum(["recent", "manual"]).default("recent"),
  slugs: z.array(z.string().trim().max(160)).max(6).default([]),
  limit: z.number().int().min(2).max(6).default(4),
  spacing,
});

export const journalGridSchema = z.object({
  heading: text(160),
  intro: text(400),
  /** One journal category's slug, or empty for the newest across all of
   *  them. Always the newest published — a lander has no "manual" mode here
   *  because the journal already has one page whose whole job is browsing by
   *  hand (/blog); this block is a taste, not a second archive. */
  categorySlug: text(160),
  limit: z.number().int().min(2).max(6).default(4),
  spacing,
});

export const testimonialSchema = z.object({
  /** The Testimonial row's id. The row must be PUBLISHED and pass the demo
   *  gate at RENDER time or the block shows nothing — an id an owner picked
   *  while a quote was live is not a promise it stays live. */
  testimonialId: text(40),
  /** `editorial` is the pull-quote card; `featured` is the cinematic single-
   *  quote treatment `FeaturedTestimonial` already builds for a homepage or
   *  PDP moment. */
  variant: z.enum(["editorial", "featured"]).default("editorial"),
  spacing,
});

export const testimonialGridSchema = z.object({
  heading: text(160),
  /** `featured` is the catalogue's own curated flag; `manual` is up to six
   *  ids the owner chose. No mode invents a review (HARD RULES §1.1). */
  mode: z.enum(["featured", "manual"]).default("featured"),
  ids: z.array(z.string().trim().max(40)).max(6).default([]),
  limit: z.number().int().min(2).max(6).default(4),
  spacing,
});

/**
 * The same fields `heroSchema` carries, minus `spacing` (a dark, full-bleed
 * opening band has no compact/standard choice, like the plain hero) — plus a
 * video. Shares the `"hero"` slot with `hero` in `CUSTOM_BLOCKS` below: a
 * page opens once, and this is the other way to do it.
 */
export const videoHeroSchema = z.object({
  videoUrl: mediaUrl,
  posterUrl: imageUrl,
  imageAlt: text(200),
  eyebrow: text(60),
  headline: text(160),
  body: text(600),
  ctaLabel: text(40),
  ctaHref: href,
});

/**
 * A film beside a passage of text — the "video beside text" idiom, on a
 * light ground rather than the hero's dark opening treatment. Uses the same
 * `HeroMedia` component as `videoHero`, wrapped in an aspect-ratio box
 * instead of a full-bleed one, so it inherits the same "poster is the LCP,
 * film gated off reduced motion and touch" behaviour without re-deriving it.
 */
export const videoStorySchema = z.object({
  videoUrl: mediaUrl,
  posterUrl: imageUrl,
  imageAlt: text(200),
  heading: text(160),
  body: text(800),
  spacing,
});

/**
 * One picture in a gallery block — the URL, what it shows, and an optional
 * caption rendered as written. Captions and alt text live inside the array,
 * so they are outside `TranslationsSection`'s flat-field reach; like a
 * product's materials line they render beside translated chrome rather than
 * inside a translated sentence, and the owner types them once.
 */
export const galleryImageSchema = z.object({
  url: imageUrl,
  alt: text(200),
  caption: text(200),
});

/**
 * `masonryGallery` — up to twelve pictures in CSS columns. The tiles cycle
 * through four aspect ratios so the columns stagger without the block having
 * to know each upload's real dimensions (Part 15: no image on this site
 * fades in — every tile is a `MeniscusImage`).
 */
export const masonryGallerySchema = z.object({
  heading: text(160),
  images: z.array(galleryImageSchema).max(12).default([]),
  spacing,
});

export const finalCtaSchema = z.object({
  heading: text(160),
  body: text(600),
  ctaLabel: text(40),
  ctaHref: href,
  /**
   * Send the button to WhatsApp instead of `ctaHref`. Every order finalizes on
   * WhatsApp (HARD RULES), so a lander's last action usually should too — and
   * the number comes from settings, never from the block.
   */
  whatsapp: z.boolean().default(false),
});

/* ═══════════════════════ the catalogue ═══════════════════════ */

export const CUSTOM_BLOCK_TYPES = [
  "hero",
  "richText",
  "productGrid",
  "imageCta",
  "faqPicker",
  "finalCta",
  "collectionGrid",
  "portfolioGrid",
  "journalGrid",
  "testimonial",
  "testimonialGrid",
  "videoHero",
  "videoStory",
  "masonryGallery",
] as const;

export type CustomBlockType = (typeof CUSTOM_BLOCK_TYPES)[number];

export type HeroData = z.infer<typeof heroSchema>;
export type RichTextData = z.infer<typeof richTextSchema>;
export type ProductGridData = z.infer<typeof productGridSchema>;
export type ImageCtaData = z.infer<typeof imageCtaSchema>;
export type FaqPickerData = z.infer<typeof faqPickerSchema>;
export type FinalCtaData = z.infer<typeof finalCtaSchema>;
export type CollectionGridData = z.infer<typeof collectionGridSchema>;
export type PortfolioGridData = z.infer<typeof portfolioGridSchema>;
export type JournalGridData = z.infer<typeof journalGridSchema>;
export type TestimonialBlockData = z.infer<typeof testimonialSchema>;
export type TestimonialGridData = z.infer<typeof testimonialGridSchema>;
export type VideoHeroData = z.infer<typeof videoHeroSchema>;
export type VideoStoryData = z.infer<typeof videoStorySchema>;
export type GalleryImage = z.infer<typeof galleryImageSchema>;
export type MasonryGalleryData = z.infer<typeof masonryGallerySchema>;

/** One field an owner translates, in the shape `TranslationsSection` wants. */
export type BlockTranslatableField = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "richtext";
};

type BlockDef = {
  type: CustomBlockType;
  /** What the owner is adding, in their words. */
  label: string;
  /** One line on what it is for. */
  description: string;
  schema: z.ZodType;
  /** Text an owner translates. Never an href, a slug or a mode. */
  translatable: readonly BlockTranslatableField[];
  /**
   * Whether the block paints a dark ground. The hero does; everything else
   * alternates mineral and sand, so a custom page cannot break §3.1's band
   * rhythm by accident — the accident is not expressible.
   */
  ground: "dark" | "alternating";
  /**
   * A slot this block claims. At most one block occupying a given slot may
   * appear on a page — the mechanism a plain "at most one of this exact
   * type" boolean cannot express once two DIFFERENT types compete for the
   * same opening: `hero` and `videoHero` are two ways to open a page, never
   * both, so they share the `"hero"` slot. `finalCta` keeps a slot of its
   * own (`"finalCta"`) for the same single-per-page rule it always had —
   * nothing else may ever claim it, so it is still, in effect, "at most one
   * of this type".
   */
  slot?: "hero" | "finalCta";
};

export const CUSTOM_BLOCKS: Record<CustomBlockType, BlockDef> = {
  hero: {
    type: "hero",
    label: "Hero",
    description: "The opening picture, headline and one button.",
    schema: heroSchema,
    translatable: [
      { name: "eyebrow", label: "Eyebrow", kind: "text" },
      { name: "headline", label: "Headline", kind: "text" },
      { name: "body", label: "Body", kind: "textarea" },
      { name: "ctaLabel", label: "Button label", kind: "text" },
      { name: "imageAlt", label: "Picture description", kind: "text" },
    ],
    ground: "dark",
    slot: "hero",
  },
  richText: {
    type: "richText",
    label: "Words",
    description: "A heading and a passage of formatted text.",
    schema: richTextSchema,
    translatable: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "body", label: "Body", kind: "richtext" },
    ],
    ground: "alternating",
  },
  productGrid: {
    type: "productGrid",
    label: "Products",
    description: "A row of pieces, picked by hand or by category.",
    schema: productGridSchema,
    translatable: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "intro", label: "Intro", kind: "textarea" },
    ],
    ground: "alternating",
  },
  imageCta: {
    type: "imageCta",
    label: "Picture and words",
    description: "A picture beside a heading, a passage and a button.",
    schema: imageCtaSchema,
    translatable: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "body", label: "Body", kind: "textarea" },
      { name: "ctaLabel", label: "Button label", kind: "text" },
      { name: "imageAlt", label: "Picture description", kind: "text" },
    ],
    ground: "alternating",
  },
  faqPicker: {
    type: "faqPicker",
    label: "Questions",
    description: "Questions chosen from the ones already answered on the FAQ.",
    schema: faqPickerSchema,
    translatable: [{ name: "heading", label: "Heading", kind: "text" }],
    ground: "alternating",
  },
  finalCta: {
    type: "finalCta",
    label: "Closing invitation",
    description: "The last word and the button that starts an enquiry.",
    schema: finalCtaSchema,
    translatable: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "body", label: "Body", kind: "textarea" },
      { name: "ctaLabel", label: "Button label", kind: "text" },
    ],
    // NOT dark, and there is no switch to make it so. The site's footer is
    // obsidian and the closing invitation is by definition the last band, so a
    // dark ground here always puts two dark grounds edge to edge — the exact
    // §3.1 violation `scripts/redesign-audit.mjs` reports as "the page's last
    // band is dark and runs straight into the obsidian footer". A toggle that
    // is wrong in every arrangement anyone builds is not a toggle.
    ground: "alternating",
    slot: "finalCta",
  },
  collectionGrid: {
    type: "collectionGrid",
    label: "Collections",
    description: "A row of collections, picked by hand, doorway tiles.",
    schema: collectionGridSchema,
    translatable: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "intro", label: "Intro", kind: "textarea" },
    ],
    ground: "alternating",
  },
  portfolioGrid: {
    type: "portfolioGrid",
    label: "Case studies",
    description: "Real commissions — the newest ones, or ones you choose.",
    schema: portfolioGridSchema,
    translatable: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "intro", label: "Intro", kind: "textarea" },
    ],
    ground: "alternating",
  },
  journalGrid: {
    type: "journalGrid",
    label: "Journal",
    description: "The newest posts from the journal, or one category's.",
    schema: journalGridSchema,
    translatable: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "intro", label: "Intro", kind: "textarea" },
    ],
    ground: "alternating",
  },
  testimonial: {
    type: "testimonial",
    label: "Testimonial",
    description: "One customer's words, alone — a pull-quote or a moment.",
    schema: testimonialSchema,
    // Nothing here is text an owner types — the words live on the
    // Testimonial row and are translated there, in the testimonials Studio.
    translatable: [],
    ground: "alternating",
  },
  testimonialGrid: {
    type: "testimonialGrid",
    label: "Testimonials",
    description: "A wall of words — the featured ones, or ones you choose.",
    schema: testimonialGridSchema,
    translatable: [{ name: "heading", label: "Heading", kind: "text" }],
    ground: "alternating",
  },
  videoHero: {
    type: "videoHero",
    label: "Video hero",
    description: "The opening film, headline and one button.",
    schema: videoHeroSchema,
    translatable: [
      { name: "eyebrow", label: "Eyebrow", kind: "text" },
      { name: "headline", label: "Headline", kind: "text" },
      { name: "body", label: "Body", kind: "textarea" },
      { name: "ctaLabel", label: "Button label", kind: "text" },
      { name: "imageAlt", label: "Poster description", kind: "text" },
    ],
    ground: "dark",
    slot: "hero",
  },
  videoStory: {
    type: "videoStory",
    label: "Video and words",
    description: "A film beside a heading and a passage of text.",
    schema: videoStorySchema,
    translatable: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "body", label: "Body", kind: "textarea" },
      { name: "imageAlt", label: "Poster description", kind: "text" },
    ],
    ground: "alternating",
  },
  masonryGallery: {
    type: "masonryGallery",
    label: "Masonry gallery",
    description: "Up to twelve pictures in staggered columns, each with an optional caption.",
    schema: masonryGallerySchema,
    translatable: [{ name: "heading", label: "Heading", kind: "text" }],
    ground: "alternating",
  },
};

export function isCustomBlockType(value: string): value is CustomBlockType {
  return (CUSTOM_BLOCK_TYPES as readonly string[]).includes(value);
}

/**
 * Parse a stored `data` blob against its type's schema.
 *
 * TOTAL: an unparseable blob returns the type's defaults rather than throwing.
 * A row written by an older shape of the schema, or by hand, must not be able
 * to take a live page down — it should render empty and be obvious in the
 * studio, which is what defaults do.
 */
export function parseBlockData<T = Record<string, unknown>>(
  type: CustomBlockType,
  data: unknown,
): T {
  const schema = CUSTOM_BLOCKS[type].schema;
  const parsed = schema.safeParse(data ?? {});
  if (parsed.success) return parsed.data as T;
  return schema.parse({}) as T;
}

/** The empty block an owner gets when they add one. */
export function defaultBlockData(type: CustomBlockType): unknown {
  return CUSTOM_BLOCKS[type].schema.parse({});
}

/**
 * Why a block's fields are refused, in the owner's words. Null when valid.
 *
 * Runs in the editor before the call and in the action after it, the pattern
 * the navigation and section boards already use: `runAction` reports every
 * throw as "something went wrong", and a refusal with no subject is a dead end.
 */
export function describeBlockDataProblem(
  type: CustomBlockType,
  data: unknown,
): string | null {
  const parsed = CUSTOM_BLOCKS[type].schema.safeParse(data ?? {});
  if (parsed.success) return null;
  return parsed.error.issues[0]?.message ?? "Check this block's fields.";
}

/* ═══════════════════════ the page's rhythm ═══════════════════════ */

/** The ground a block paints, resolved against its position on the page. */
export type BlockGround = "obsidian" | "mineral" | "sand";

/**
 * Assign a ground to every block on a page.
 *
 * The owner does not choose these. REDESIGN.md §3.1 caps a page at three dark
 * bands and forbids two adjacent, and a lander assembled from a menu is
 * exactly where that gets broken — so the grounds are COMPUTED: the hero is
 * obsidian and everything after it alternates mineral and sand. A custom page
 * cannot violate the band rhythm by accident, because the accident is not
 * expressible.
 */
export function resolveBlockGrounds(
  blocks: readonly { type: CustomBlockType; data?: unknown }[],
): BlockGround[] {
  const grounds: BlockGround[] = [];
  let light = 0;
  for (const block of blocks) {
    const def = CUSTOM_BLOCKS[block.type];
    if (def.ground === "dark") {
      grounds.push("obsidian");
      continue;
    }
    grounds.push(light % 2 === 0 ? "mineral" : "sand");
    light += 1;
  }
  return grounds;
}

/**
 * Why an arrangement of blocks is refused. Null when it is allowed.
 *
 * Three rules, each one a §3.1 or Part 17 constraint that
 * `scripts/redesign-audit.mjs` enforces in CI — and CI does not run when the
 * owner presses Save.
 */
export function describeBlockArrangementProblem(
  blocks: readonly { type: CustomBlockType; data?: unknown }[],
): string | null {
  // Group by SLOT, not by type — `hero` and `videoHero` are two different
  // types that must never coexist, and a same-type-only check cannot see
  // that. `Map` insertion order matches the blocks' own order, so the
  // message always names the block that was already on the page first.
  const bySlot = new Map<string, CustomBlockType[]>();
  for (const block of blocks) {
    const slot = CUSTOM_BLOCKS[block.type].slot;
    if (!slot) continue;
    const claimants = bySlot.get(slot) ?? [];
    claimants.push(block.type);
    bySlot.set(slot, claimants);
  }
  for (const [slot, claimants] of bySlot) {
    if (claimants.length <= 1) continue;
    if (slot === "hero" && new Set(claimants).size > 1) {
      return `A page opens once — pick either ${CUSTOM_BLOCKS.hero.label.toLowerCase()} or ${CUSTOM_BLOCKS.videoHero.label.toLowerCase()}, not both.`;
    }
    return `A page has one ${CUSTOM_BLOCKS[claimants[0]].label.toLowerCase()}, not ${claimants.length}.`;
  }

  const grounds = resolveBlockGrounds(blocks);
  const dark = grounds.filter((g) => g === "obsidian").length;
  if (dark > 3) {
    return `The page would have ${dark} dark bands. The design allows three.`;
  }
  for (let i = 1; i < grounds.length; i += 1) {
    if (grounds[i] === "obsidian" && grounds[i - 1] === "obsidian") {
      return `${CUSTOM_BLOCKS[blocks[i - 1].type].label} and ${CUSTOM_BLOCKS[
        blocks[i].type
      ].label.toLowerCase()} would both be dark and sit edge to edge. Put a light block between them, or turn the dark ground off.`;
    }
  }

  return null;
}

/**
 * The heading level a block renders at, given the page's blocks.
 *
 * Part 17 wants one `h1` and no skipped levels. The hero owns the `h1` when
 * there is one; with no hero the first block that has a heading takes it, so a
 * page built without a hero is still a document rather than a pile of `h2`s.
 */
/**
 * A problem worth telling the owner about that is not worth refusing.
 *
 * There is one: a page whose LAST band is dark runs straight into the
 * obsidian footer, which is the same two-dark-grounds-edge-to-edge violation
 * `scripts/redesign-audit.mjs` reports. Since the closing invitation lost its
 * dark switch, the only way to reach it is a page whose last block is the
 * hero — usually a page still being built, one block in. Refusing that would
 * mean an owner could not add a hero to an empty page, so it warns instead.
 */
export function describeBlockArrangementNotice(
  blocks: readonly { type: CustomBlockType; data?: unknown }[],
): string | null {
  const grounds = resolveBlockGrounds(blocks);
  if (grounds.length === 0) return null;
  if (grounds[grounds.length - 1] !== "obsidian") return null;
  return "The last band on the page is dark, and so is the footer right below it. Add a block after it before this page goes live.";
}

export function resolveHeadingLevels(
  blocks: readonly { type: CustomBlockType }[],
): ("h1" | "h2")[] {
  // `videoHero` shares the `hero` slot: whichever of the two opens the page
  // owns the h1, same as a plain hero always has.
  const heroAt = blocks.findIndex((b) => CUSTOM_BLOCKS[b.type].slot === "hero");
  const ownerIndex = heroAt >= 0 ? heroAt : blocks.length > 0 ? 0 : -1;
  return blocks.map((_, index) => (index === ownerIndex ? "h1" : "h2"));
}
