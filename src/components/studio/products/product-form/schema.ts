import { z } from "zod";
import type {
  ContentStatus,
  FieldType,
  ProductImageRole,
} from "@/generated/prisma/enums";
import type { UpsertProductInput } from "@/actions/products";
import {
  OCCASIONS,
  type Occasion,
} from "@/components/studio/products/occasions";
import { toTranslationsRecord } from "@/lib/translations-form";
import { CONTENT_STATUSES } from "@/lib/content-status";
import { PRODUCT_LIMITS, tooLong } from "@/lib/studio-limits";

// ————————————————————— Initial (server) shape —————————————————————

export type ProductFormInitial = {
  id: string;
  slug: string;
  title: string;
  displayName: string | null;
  shortTagline: string;
  description: string;
  priceMin: number | null;
  priceMax: number | null;
  showPrice: boolean;
  timeline: string;
  materials: string;
  dimensions: string;
  occasions: string[];
  lexical: { label: string; value: string }[];
  /** Provenance links (gap 3) — linked product id + display data. */
  madeWith: { linkId: string; title: string; tier: number | null }[];
  careNotes: string;
  categoryId: string;
  featured: boolean;
  status: ContentStatus;
  videoUrl: string;
  model3dUrl: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  /** Raw per-locale overrides JSON from the database (`{ [locale]: {…} }`). */
  translations: unknown;
  needsRewrite: boolean;
  /** Owner-sheet tier (1–4); null for products created in the studio. */
  tier: number | null;
  inStock: boolean;
  /** Import provenance — read-only in the form, shown in the Provenance panel. */
  importSource: string | null;
  importRef: string | null;
  images: {
    url: string;
    alt: string;
    order: number;
    role: ProductImageRole | null;
  }[];
  customFields: {
    label: string;
    type: FieldType;
    options: string[];
    required: boolean;
    helpText: string;
    order: number;
  }[];
};

// ————————————————————— Custom-field types —————————————————————

export const FIELD_TYPES = [
  "SELECT",
  "TEXT",
  "SWATCH",
  "SIZE",
  "NUMBER",
  "FILE",
] as const;

export const FIELD_TYPE_LABEL: Record<(typeof FIELD_TYPES)[number], string> = {
  SELECT: "Dropdown",
  TEXT: "Text",
  SWATCH: "Swatch",
  SIZE: "Size",
  NUMBER: "Number",
  FILE: "File upload",
};

export const typeHasOptions = (type: string) =>
  type === "SELECT" || type === "SWATCH" || type === "SIZE";

// ————————————————————— Tiers —————————————————————

/** Select values are strings; "none" persists as SQL NULL (studio product). */
export const TIER_OPTIONS = [
  { value: "none", label: "— (studio product)" },
  { value: "1", label: "Tier 1 — Owner" },
  { value: "2", label: "Tier 2 — Resin goods" },
  { value: "3", label: "Tier 3 — Supplies" },
  { value: "4", label: "Tier 4 — 3D printing" },
] as const;

export const TIER_LABEL: Record<number, string> = {
  1: "Tier 1 — Owner",
  2: "Tier 2 — Resin goods",
  3: "Tier 3 — Supplies",
  4: "Tier 4 — 3D printing",
};

// ————————————————————— Image roles —————————————————————

/** "none" persists as SQL NULL — most shots carry no role at all. */
export const IMAGE_ROLE_OPTIONS = [
  { value: "none", label: "No role" },
  { value: "HERO", label: "Hero" },
  { value: "DETAIL", label: "Detail" },
  { value: "IN_ROOM", label: "In room" },
  { value: "PROCESS", label: "Process" },
] as const;

// ————————————————————— Schema —————————————————————

const priceString = z
  .string()
  .refine((v) => v === "" || /^\d+$/.test(v), "Enter a whole number in ₹.");

const optionalUrl = z.union([z.literal(""), z.url("Enter a valid URL.")]);

/** A lexical row the payload builder will actually send (see below). */
const sentLexicalRow = (row: { label: string; value: string }) =>
  Boolean(row.label.trim() && row.value.trim());

/**
 * The caps `upsertProductSchema` in `src/actions/products.ts` enforces, read
 * from the same module so the two cannot drift.
 *
 * NOTE THE MISSING `.trim()`. This action counts the RAW string —
 * `z.string().max(300)`, not `.trim().max(300)` — unlike settings, pages,
 * blog and the testimonial. Trimming here would accept a value the action
 * refuses: 300 characters plus a trailing space passes a trimmed cap and is
 * refused by a raw one. Measured, not assumed. `lexical` is the exception
 * inside this action and does trim, so it is mirrored trimmed below.
 */
const capped = (max: number, what: string) =>
  z.string().max(max, tooLong(what, max));

export const formSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(PRODUCT_LIMITS.titleMin, "Title needs at least 2 characters."),
    displayName: capped(PRODUCT_LIMITS.displayName, "the display name"),
    shortTagline: capped(PRODUCT_LIMITS.shortTagline, "the tagline"),
    description: z.string(),
    categoryId: z.string().min(1, "Pick a category."),
    featured: z.boolean(),
    status: z.enum(CONTENT_STATUSES),
    priceMin: priceString,
    priceMax: priceString,
    showPrice: z.boolean(),
    inStock: z.boolean(),
    tier: z.enum(["none", "1", "2", "3", "4"]),
    timeline: capped(PRODUCT_LIMITS.timeline, "the timeline"),
    materials: capped(PRODUCT_LIMITS.materials, "materials"),
    dimensions: capped(PRODUCT_LIMITS.dimensions, "dimensions"),
    occasions: z.array(z.string()),
    lexical: z
      .array(
        z.object({
          // The one place this action trims before it counts.
          label: z
            .string()
            .trim()
            .max(
              PRODUCT_LIMITS.lexicalLabel,
              tooLong("a label", PRODUCT_LIMITS.lexicalLabel),
            ),
          value: z
            .string()
            .trim()
            .max(
              PRODUCT_LIMITS.lexicalValue,
              tooLong("a value", PRODUCT_LIMITS.lexicalValue),
            ),
        }),
      )
      // Counted the way the payload counts it. `buildUpsertPayload` drops
      // rows missing a label or a value before sending, so a bare `.max()`
      // here would refuse eight filled rows plus one the owner added and
      // left blank — a save the action accepts. `Add row` and the suggestion
      // chips both append exactly such a row.
      .refine(
        (rows) =>
          rows.filter(sentLexicalRow).length <= PRODUCT_LIMITS.lexicalRows,
        `Up to ${PRODUCT_LIMITS.lexicalRows} specification rows.`,
      ),
    madeWith: z
      .array(
        z.object({
          linkId: z.string().min(1),
          title: z.string(),
          tier: z.number().nullable(),
        }),
      )
      .max(
        PRODUCT_LIMITS.madeWithRows,
        `Up to ${PRODUCT_LIMITS.madeWithRows} linked products.`,
      ),
    careNotes: z.string(),
    images: z.array(
      z.object({
        url: z.string().min(1),
        alt: capped(PRODUCT_LIMITS.imageAlt, "alt text"),
        role: z.enum(["none", "HERO", "DETAIL", "IN_ROOM", "PROCESS"]),
      }),
    ),
    videoUrl: optionalUrl,
    model3dUrl: optionalUrl,
    customFields: z.array(
      z.object({
        label: z.string().trim().min(1, "Label is required."),
        type: z.enum(FIELD_TYPES),
        options: z.string(),
        required: z.boolean(),
        helpText: capped(PRODUCT_LIMITS.customFieldHelpText, "the help text"),
      }),
    ),
    seoTitle: capped(PRODUCT_LIMITS.seoTitle, "the SEO title"),
    seoDescription: capped(
      PRODUCT_LIMITS.seoDescription,
      "the SEO description",
    ),
    ogImage: optionalUrl,
    translations: z.record(z.string(), z.record(z.string(), z.unknown())),
    confirmRewrite: z.boolean(),
  })
  .refine(
    (d) =>
      d.priceMin === "" ||
      d.priceMax === "" ||
      Number(d.priceMin) <= Number(d.priceMax),
    {
      message: "Minimum price cannot exceed maximum price.",
      path: ["priceMax"],
    },
  );

export type FormValues = z.infer<typeof formSchema>;

// ————————————————————— Mappers —————————————————————

/** Product row (or undefined for create) → react-hook-form default values. */
export function buildDefaultValues(product?: ProductFormInitial): FormValues {
  return {
    title: product?.title ?? "",
    displayName: product?.displayName ?? "",
    shortTagline: product?.shortTagline ?? "",
    description: product?.description ?? "",
    categoryId: product?.categoryId ?? "",
    featured: product?.featured ?? false,
    status: product?.status ?? "DRAFT",
    priceMin: product?.priceMin != null ? String(product.priceMin) : "",
    priceMax: product?.priceMax != null ? String(product.priceMax) : "",
    showPrice: product?.showPrice ?? true,
    inStock: product?.inStock ?? true,
    tier:
      product?.tier != null && product.tier >= 1 && product.tier <= 4
        ? (String(product.tier) as FormValues["tier"])
        : "none",
    timeline: product?.timeline ?? "",
    materials: product?.materials ?? "",
    dimensions: product?.dimensions ?? "",
    occasions: product?.occasions ?? [],
    lexical: product?.lexical ?? [],
    madeWith: product?.madeWith ?? [],
    careNotes: product?.careNotes ?? "",
    images:
      product?.images.map((img) => ({
        url: img.url,
        alt: img.alt,
        role: img.role ?? "none",
      })) ?? [],
    videoUrl: product?.videoUrl ?? "",
    model3dUrl: product?.model3dUrl ?? "",
    customFields:
      product?.customFields.map((field) => ({
        label: field.label,
        type: field.type,
        options: field.options.join(", "),
        required: field.required,
        helpText: field.helpText,
      })) ?? [],
    seoTitle: product?.seoTitle ?? "",
    seoDescription: product?.seoDescription ?? "",
    ogImage: product?.ogImage ?? "",
    translations: toTranslationsRecord(product?.translations),
    confirmRewrite: false,
  };
}

/** Validated form values → the server action payload. */
export function buildUpsertPayload(
  values: FormValues,
  product?: ProductFormInitial,
): UpsertProductInput {
  return {
    id: product?.id,
    title: values.title,
    displayName: values.displayName || undefined,
    shortTagline: values.shortTagline || undefined,
    description: values.description || undefined,
    priceMin: values.priceMin === "" ? null : Number(values.priceMin),
    priceMax: values.priceMax === "" ? null : Number(values.priceMax),
    showPrice: values.showPrice,
    inStock: values.inStock,
    tier: values.tier === "none" ? null : Number(values.tier),
    timeline: values.timeline || undefined,
    materials: values.materials || undefined,
    dimensions: values.dimensions || undefined,
    occasions: values.occasions.filter((o): o is Occasion =>
      (OCCASIONS as readonly string[]).includes(o),
    ),
    lexical: values.lexical
      .filter(sentLexicalRow)
      .map((row) => ({ label: row.label.trim(), value: row.value.trim() })),
    madeWithIds: values.madeWith.map((row) => row.linkId),
    careNotes: values.careNotes || undefined,
    categoryId: values.categoryId,
    featured: values.featured,
    videoUrl: values.videoUrl,
    model3dUrl: values.model3dUrl,
    seoTitle: values.seoTitle || undefined,
    seoDescription: values.seoDescription || undefined,
    ogImage: values.ogImage,
    translations: values.translations,
    status: values.status,
    confirmRewrite: values.confirmRewrite,
    images: values.images.map((img, index) => ({
      url: img.url,
      alt: img.alt,
      order: index,
      role: img.role === "none" ? null : img.role,
    })),
    customFields: values.customFields.map((field, index) => ({
      label: field.label,
      type: field.type,
      options: typeHasOptions(field.type)
        ? field.options
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
      required: field.required,
      helpText: field.helpText || undefined,
      order: index,
    })),
  };
}
