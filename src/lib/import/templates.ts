/**
 * Bulk Import — single source of truth for every importable content type.
 * Plain module (no "use client" / "use server") so the client wizard, the
 * server-side validator and the import action all share one definition.
 *
 * Column conventions across all templates:
 * - Headers are case-insensitive; the parser lowercases them.
 * - List cells (images, occasions, tags, options) accept " | " or ","
 *   separators.
 * - Boolean cells accept TRUE/FALSE (also 1/0, yes/no).
 */

export const IMPORT_TYPE_KEYS = [
  "products",
  "categories",
  "blog-posts",
  "faqs",
  "testimonials",
  "portfolio",
  "pages",
] as const;

export type ImportTypeKey = (typeof IMPORT_TYPE_KEYS)[number];

export type ImportTemplate = {
  key: ImportTypeKey;
  label: string;
  requiredColumns: readonly string[];
  optionalColumns: readonly string[];
  /** One realistic sample row, keyed by column — powers the template download. */
  example: Readonly<Record<string, string>>;
  /** Short human guidance shown on the type-picker card. */
  docs: string;
};

/** Both preview and import are capped at this many data rows per file. */
export const MAX_IMPORT_ROWS = 500;

/** Products carry custom1_* … custom6_* customization-field columns. */
export const CUSTOM_FIELD_SLOTS = 6;

const customFieldColumns: string[] = [];
for (let i = 1; i <= CUSTOM_FIELD_SLOTS; i += 1) {
  customFieldColumns.push(
    `custom${i}_label`,
    `custom${i}_type`,
    `custom${i}_options`,
    `custom${i}_required`,
  );
}

export const IMPORT_TEMPLATES: readonly ImportTemplate[] = [
  {
    key: "products",
    label: "Products",
    requiredColumns: ["title", "slug", "category_slug"],
    optionalColumns: [
      "short_tagline",
      "description",
      "price_min",
      "price_max",
      "show_price",
      "timeline",
      "materials",
      "dimensions",
      "occasions",
      "care_notes",
      "status",
      "product_tier",
      "tier",
      "in_stock",
      "featured",
      "video_url",
      "model3d_url",
      "seo_title",
      "seo_description",
      "images",
      "image_alts",
      ...customFieldColumns,
    ],
    example: {
      title: "Ocean Wave Serving Tray",
      slug: "ocean-wave-serving-tray",
      category_slug: "trays",
      short_tagline: "Hand-poured ocean waves with a gold-leaf shoreline",
      description:
        "A statement serving tray with layered ocean blues and real gold flakes.",
      price_min: "2499",
      price_max: "3999",
      show_price: "TRUE",
      timeline: "7-10 days",
      materials: "Epoxy resin, mica pigments, gold flakes",
      dimensions: "35cm x 25cm",
      occasions: "Wedding, Housewarming",
      care_notes: "Wipe with a soft damp cloth. Keep away from direct heat.",
      status: "PUBLISHED",
      product_tier: "SMALL",
      tier: "1",
      in_stock: "TRUE",
      featured: "TRUE",
      video_url: "https://example.com/videos/ocean-tray.mp4",
      model3d_url: "",
      seo_title: "Ocean Wave Resin Serving Tray | Rivya Living Art",
      seo_description:
        "Hand-poured ocean wave resin serving tray with gold flakes, made to order.",
      images:
        "https://example.com/img/ocean-tray-1.jpg | https://example.com/img/ocean-tray-2.jpg",
      image_alts: "Ocean wave tray top view | Side profile with gold rim",
      custom1_label: "Colour theme",
      custom1_type: "SWATCH",
      custom1_options: "Ocean Blue | Emerald | Blush Pink",
      custom1_required: "TRUE",
      custom2_label: "Engraving text",
      custom2_type: "TEXT",
      custom2_options: "",
      custom2_required: "FALSE",
    },
    docs: "One product per row. category_slug must match an existing category. Occasions, images and custom-field options take comma or | separated lists; custom field types are SELECT, TEXT, SWATCH, SIZE, NUMBER or FILE. product_tier is the PRODUCT tier — LARGE (collectible furniture & spatial art), MEDIUM (memory & celebration art) or SMALL (personal art & gifting); the full names LARGE_FORMAT/MEDIUM_FORMAT/SMALL_FORMAT also work. tier is a different thing: the IMPORT tier 1-4 (1 owner · 2 resin goods · 3 supplies · 4 3D print), which records where a row came from and sorts the shop — products without one sort last. in_stock is TRUE/FALSE (defaults to in stock). Empty product_tier/tier/in_stock cells leave existing values unchanged on update.",
  },
  {
    key: "categories",
    label: "Categories",
    requiredColumns: ["name", "slug"],
    optionalColumns: ["description", "image", "order"],
    example: {
      name: "Ocean Trays",
      slug: "ocean-trays",
      description: "Serving trays with hand-poured ocean waves.",
      image: "https://example.com/img/ocean-trays-cover.jpg",
      order: "1",
    },
    docs: "Collections that group products. Import these before products so category_slug values resolve. Rows without an order are appended after existing categories.",
  },
  {
    key: "blog-posts",
    label: "Blog posts",
    requiredColumns: ["title", "slug"],
    optionalColumns: [
      "excerpt",
      "content",
      "cover_image",
      "author_name",
      "category",
      "tags",
      "status",
      "published_at",
      "seo_title",
      "seo_description",
    ],
    example: {
      title: "How We Pour Ocean Waves in Resin",
      slug: "how-we-pour-ocean-waves-in-resin",
      excerpt: "A look inside the layered pour behind our best-selling trays.",
      content:
        "## The layered pour\n\nEvery ocean piece starts with **three shades of blue**...",
      cover_image: "https://example.com/img/blog-ocean-pour.jpg",
      author_name: "Rivya Living Art Studio",
      category: "Behind the Scenes",
      tags: "resin art, tutorials",
      status: "PUBLISHED",
      published_at: "2026-01-15T10:00:00Z",
      seo_title: "How Ocean Wave Resin Art Is Made | Rivya Living Art",
      seo_description: "Step-by-step look at layered ocean resin pours.",
    },
    docs: "content is Markdown and is converted to the rich-text editor format on import. category and tags are created automatically when they do not exist yet; published_at is an ISO date.",
  },
  {
    key: "faqs",
    label: "FAQs",
    requiredColumns: ["question", "answer"],
    optionalColumns: ["order"],
    example: {
      question: "How long does a custom order take?",
      answer:
        "Most pieces ship in 7-14 days. Resin needs 72 hours to cure fully before finishing.",
      order: "1",
    },
    docs: "Questions are matched case-insensitively: re-importing an existing question updates its answer instead of duplicating it.",
  },
  {
    key: "testimonials",
    label: "Testimonials",
    requiredColumns: ["name", "quote"],
    optionalColumns: [
      "location",
      "rating",
      "avatar_url",
      "order",
      "designation",
      "product_slug",
      "permission_status",
    ],
    example: {
      name: "Priya Sharma",
      quote:
        "The varmala preservation frame brought tears to my eyes. Every petal is perfect.",
      location: "Mumbai",
      rating: "5",
      avatar_url: "https://example.com/img/avatar-priya.jpg",
      order: "1",
      designation: "Interior designer, Surat",
      product_slug: "varmala-preservation-frame",
      permission_status: "GRANTED",
    },
    docs: "rating is 1-5 (defaults to 5). A row matching an existing name + quote updates that testimonial instead of adding a duplicate. product_slug links the row to an existing catalogue product when the slug matches one; permission_status is UNKNOWN, REQUESTED, GRANTED or DECLINED. Imported testimonials arrive as drafts.",
  },
  {
    key: "portfolio",
    label: "Portfolio",
    requiredColumns: ["title", "slug"],
    optionalColumns: [
      "story",
      "category_slug",
      "before_image_url",
      "after_image_url",
      "video_url",
      "meta_type",
      "meta_material",
      "meta_size",
      "meta_timeline",
      "status",
      "images",
      "image_alts",
    ],
    example: {
      title: "Varmala Preservation — Priya & Arjun",
      slug: "varmala-preservation-priya-arjun",
      story:
        "A wedding varmala preserved in a hexagonal resin block with gold accents.",
      category_slug: "varmala-preservation",
      before_image_url: "https://example.com/img/varmala-before.jpg",
      after_image_url: "https://example.com/img/varmala-after.jpg",
      video_url: "",
      meta_type: "Varmala block",
      meta_material: "Epoxy resin, dried florals, gold leaf",
      meta_size: "20cm hexagon",
      meta_timeline: "3 weeks",
      status: "PUBLISHED",
      images:
        "https://example.com/img/varmala-1.jpg | https://example.com/img/varmala-2.jpg",
      image_alts: "Finished hexagon block | Close-up of preserved petals",
    },
    docs: "Case studies with optional before/after images and meta_* result details. category_slug is optional but must match an existing category when set.",
  },
  {
    key: "pages",
    label: "Pages",
    requiredColumns: ["slug", "title"],
    optionalColumns: ["content", "seo_title", "seo_description"],
    example: {
      slug: "shipping-policy",
      title: "Shipping Policy",
      content:
        "## Shipping\n\nAll pieces ship insured across India within **2-4 business days** of curing.",
      seo_title: "Shipping Policy | Rivya Living Art",
      seo_description:
        "Shipping timelines and packaging for Rivya Living Art orders.",
    },
    docs: "Static site pages. content is Markdown and is converted to the rich-text editor format; re-importing an existing slug updates that page.",
  },
];

export function getImportTemplate(key: string): ImportTemplate | undefined {
  return IMPORT_TEMPLATES.find((template) => template.key === key);
}

/** All columns in template order — required first, then optional. */
export function templateColumns(template: ImportTemplate): string[] {
  return [...template.requiredColumns, ...template.optionalColumns];
}
