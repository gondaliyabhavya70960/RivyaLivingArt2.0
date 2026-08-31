import type { FieldType } from "@/generated/prisma/enums";

export type TemplateField = {
  label: string;
  type: FieldType;
  options: string[];
  required: boolean;
  helpText?: string;
};

/**
 * One-click customization-field templates per category (Phase 11 §3):
 * the owner's size/price-band reference turned into ready-made Custom
 * Form Builder fields. Applied from the product form's "Apply template"
 * button; fully editable afterwards.
 */
export const CATEGORY_FIELD_TEMPLATES: Record<string, TemplateField[]> = {
  "varmala-preservation": [
    { label: "Frame size", type: "SIZE", options: ['8x8"', '10x10"', '12x12"', '14x14"'], required: true },
    { label: "Frame finish", type: "SELECT", options: ["Teakwood", "Matte black", "Ivory white", "Gold-edged"], required: true },
    { label: "Backing colour", type: "SWATCH", options: ["Ivory", "Sapphire", "Blush", "Charcoal"], required: false },
    { label: "Names & date engraving", type: "TEXT", options: [], required: false, helpText: "e.g. Bhavya & Riva — 12.12.2026" },
    { label: "Photo inset", type: "SELECT", options: ["None", "Single photo", "Couple photo"], required: false },
  ],
  "wedding-photo-frames": [
    { label: "Size", type: "SIZE", options: ['8x8"', '10x10"', '12x12"', '14x14"'], required: true },
    { label: "Border", type: "SELECT", options: ["Teakwood", "Resin only"], required: true },
    { label: "LED lighting", type: "SELECT", options: ["None", "Warm LED", "Cool LED"], required: false },
    { label: "Names & date", type: "TEXT", options: [], required: false },
  ],
  "resin-trays-serving-platters": [
    { label: "Size", type: "SIZE", options: ['6x6"', '9x9"', '12x12"'], required: true },
    { label: "Metallic finish", type: "SWATCH", options: ["Gold leaf", "Silver leaf", "Rose-gold leaf", "None"], required: true },
    { label: "Handles", type: "SELECT", options: ["None", "Gold", "Silver", "Wooden"], required: false },
    { label: "Engraving", type: "TEXT", options: [], required: false, helpText: "Names, initials or a short line" },
  ],
  "resin-wall-clocks": [
    { label: "Diameter", type: "SIZE", options: ['12"', '18"', '24"'], required: true },
    { label: "Pattern", type: "SWATCH", options: ["Ocean wave", "Geode", "Marble"], required: true },
    { label: "Numerals", type: "SELECT", options: ["None", "Roman", "Modern"], required: false },
    { label: "Name engraving", type: "TEXT", options: [], required: false },
  ],
  "resin-jewelry-keychains": [
    { label: "Piece type", type: "SELECT", options: ["Earrings", "Ring", "Necklace", "Bracelet", "Charm", "Keychain"], required: true },
    { label: "Inclusions", type: "SELECT", options: ["Dried flowers", "Glitter", "Gold foil", "Custom text"], required: false },
    { label: "Colour theme", type: "SWATCH", options: ["Sapphire", "Ocean foam", "Blush", "Midnight"], required: false },
    { label: "Initials / name", type: "TEXT", options: [], required: false },
  ],
  "candle-tea-light-holders": [
    { label: "Set of", type: "NUMBER", options: [], required: true, helpText: "How many holders" },
    { label: "Colour theme", type: "SWATCH", options: ["Sapphire & gold", "Ivory", "Festive red-gold", "Ocean"], required: false },
    { label: "Occasion pack", type: "SELECT", options: ["None", "Diwali", "Housewarming", "Wedding favours"], required: false },
  ],
  "resin-furniture-surfaces": [
    { label: "Dimensions", type: "TEXT", options: [], required: true, helpText: 'Length x width in inches, e.g. 60" x 30"' },
    { label: "Wood", type: "SELECT", options: ["Teak", "Mango", "Acacia"], required: true },
    { label: "River colour", type: "SWATCH", options: ["Sapphire", "Ocean foam", "Deep teal"], required: true },
    { label: "Finish", type: "SELECT", options: ["Gloss", "Matte"], required: false },
  ],
  workshops: [
    { label: "Preferred date", type: "TEXT", options: [], required: true, helpText: "A date or a rough window works" },
    { label: "Participants", type: "NUMBER", options: [], required: true },
    { label: "Session type", type: "SELECT", options: ["Group", "Private"], required: true },
  ],
};

/** Sensible default for categories without a bespoke template. */
export const GENERIC_TEMPLATE: TemplateField[] = [
  { label: "Size", type: "TEXT", options: [], required: false, helpText: "Approximate size or dimensions" },
  { label: "Colour theme", type: "SWATCH", options: ["Sapphire & gold", "Ocean", "Midnight", "Ivory"], required: false },
  { label: "Personalization", type: "TEXT", options: [], required: false, helpText: "Names, dates or a short message" },
];

export function templateForCategorySlug(slug: string | undefined): TemplateField[] {
  return (slug && CATEGORY_FIELD_TEMPLATES[slug]) || GENERIC_TEMPLATE;
}
