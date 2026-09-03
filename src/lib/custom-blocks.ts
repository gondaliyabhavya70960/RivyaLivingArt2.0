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
] as const;

export type CustomBlockType = (typeof CUSTOM_BLOCK_TYPES)[number];

export type HeroData = z.infer<typeof heroSchema>;
export type RichTextData = z.infer<typeof richTextSchema>;
export type ProductGridData = z.infer<typeof productGridSchema>;
export type ImageCtaData = z.infer<typeof imageCtaSchema>;
export type FaqPickerData = z.infer<typeof faqPickerSchema>;
export type FinalCtaData = z.infer<typeof finalCtaSchema>;
export type CollectionGridData = z.infer<typeof collectionGridSchema>;

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
  /** At most one per page — a second hero is two `h1`s. */
  once?: boolean;
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
    once: true,
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
    once: true,
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
  for (const type of CUSTOM_BLOCK_TYPES) {
    if (!CUSTOM_BLOCKS[type].once) continue;
    const count = blocks.filter((b) => b.type === type).length;
    if (count > 1) {
      return `A page has one ${CUSTOM_BLOCKS[type].label.toLowerCase()}, not ${count}.`;
    }
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
  const heroAt = blocks.findIndex((b) => b.type === "hero");
  const ownerIndex = heroAt >= 0 ? heroAt : blocks.length > 0 ? 0 : -1;
  return blocks.map((_, index) => (index === ownerIndex ? "h1" : "h2"));
}
