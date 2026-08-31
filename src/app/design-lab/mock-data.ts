import type { ProductCardData } from "@/components/storefront/product-card";

/**
 * DEV-ONLY PLACEHOLDER DATA for the Phase 1 kitchen sink (DESIGN.md E6
 * Phase 1: "realistic resin-product mock data"). Part 0: this is NOT catalog
 * content and must never be seeded, imported, or deployed as products — the
 * real catalog comes only from the owner's intake paths (scraper approval,
 * bulk import, manual /studio adds). The page consuming this 404s in
 * production. Images are Higgsfield-generated brand media (E4.1), mirrored
 * first-party into /public/mock by .github/workflows/fetch-assets.yml.
 */

export const MOCK_PRODUCTS: ProductCardData[] = [
  {
    title: "Ocean Wave Coaster Set",
    slug: "mock-ocean-wave-coasters",
    fromPrice: 1499,
    image: "/mock/coasters.webp",
    hoverImage: "/mock/pour-detail.webp",
    badge: "atelierPick",
    alt: "Set of round ocean-wave resin coasters with gold-leaf veins on a navy backdrop",
  },
  {
    title: "Gilded Geode Serving Tray",
    slug: "mock-gilded-geode-tray",
    fromPrice: 3299,
    image: "/mock/geode-tray.webp",
    hoverImage: "/mock/pour-detail.webp",
    badge: "shipsIn",
    alt: "Oval gold-leaf geode resin serving tray with sapphire bands",
  },
  {
    title: "Varmala Keepsake Block",
    slug: "mock-varmala-keepsake",
    fromPrice: 4999,
    image: "/mock/varmala-block.webp",
    hoverImage: "/mock/pour-detail.webp",
    badge: "madeToOrder",
    alt: "Clear resin keepsake block preserving red and marigold wedding garland flowers",
  },
  {
    title: "Midnight Bloom Pendant",
    slug: "mock-midnight-bloom-pendant",
    fromPrice: 899,
    image: "/mock/pendant.webp",
    hoverImage: "/mock/pour-detail.webp",
    badge: "madeToOrder",
    alt: "Teardrop resin pendant with gold flakes and pressed white flowers",
  },
];

export const MOCK_TESTIMONIALS = [
  {
    quote:
      "The varmala block made my mother cry — our wedding garland, held in light forever.",
    name: "Placeholder Customer",
    location: "Surat",
    rating: 5,
  },
  {
    quote:
      "The tray looks like the ocean decided to live on my table. Gorgeous work.",
    name: "Placeholder Customer",
    location: "Mumbai",
    rating: 5,
  },
] as const;

export const MOCK_SELECTIONS = [
  { label: "Size", value: "Medium · 20 cm" },
  { label: "Shape", value: "Hexagon" },
  { label: "Color story", value: "Midnight & gold" },
  { label: "Personalization", value: "A & R · 14.02.2026" },
  { label: "Occasion", value: "Anniversary" },
  { label: "Quantity", value: "1" },
] as const;

export const MOCK_CUSTOMER = {
  name: "Test Customer",
  phone: "+91 90000 00000",
  email: "test@example.com",
} as const;

/** Mirrors the Part 0 order-summary shape the Server Action will build. */
export const MOCK_WA_MESSAGE = [
  "Hello Rivya Living Art! I'd like to place an order.",
  "",
  "Product: Ocean Wave Coaster Set",
  ...MOCK_SELECTIONS.map((s) => `${s.label}: ${s.value}`),
  "",
  `Name: ${MOCK_CUSTOMER.name}`,
  `Phone: ${MOCK_CUSTOMER.phone}`,
  `Email: ${MOCK_CUSTOMER.email}`,
  "",
  "Notes: Please keep the gold veining subtle.",
  "(Inquiry #RR-MOCK-001 · sent from the design lab)",
].join("\n");
