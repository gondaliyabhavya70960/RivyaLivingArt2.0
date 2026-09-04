import type { ShopProductItem } from "@/lib/shop";

/**
 * DESIGN LAB ONLY — never imported outside src/app/design-lab.
 *
 * `src/lib/design-lab-isolation.test.ts` greps `src/` for imports of this
 * file from anywhere else and fails the build if it finds one. HARD RULE 3
 * (AGENTS.md, REDESIGN.md §1.1): the catalogue is filled only by the owner —
 * this data must never reach a real page, a real database row, or a real
 * visitor. `/design-lab` itself is staff-gated (`requireStaffPage`) AND
 * 404s outside dev/preview, so this file has two independent reasons it can
 * never serve the public even if someone forgets to check the other one.
 *
 * Images are v3 masters and the legacy `/mock/*.webp` set already bundled
 * under `public/` — real files on disk, never invented paths.
 */

export const MOCK_PRODUCTS: ShopProductItem[] = [
  {
    id: "mock-1",
    slug: "mock-ocean-wave-coasters",
    title: "Ocean Wave Coaster Set — Deep Sapphire",
    displayTitle: "Ocean Wave Coaster Set",
    shortTagline: "A set of four, cast in a single pour.",
    priceMin: 1499,
    priceMax: null,
    showPrice: true,
    categoryName: "Coasters",
    image: {
      url: "/mock/coasters.webp",
      alt: "Round ocean-wave resin coasters with gold-leaf veins on a navy backdrop",
      role: null,
    },
    hoverImage: {
      url: "/mock/pour-detail.webp",
      alt: "Close detail of resin being poured over pigment",
      role: null,
    },
    variantChips: ["Navy", "Sapphire", "Gold vein"],
    tier: 1,
    inStock: true,
    featured: true,
    materials: "Epoxy resin, 24k gold leaf",
    dimensions: "10 cm Ø · set of 4",
    videoUrl: null,
    isDemo: false,
  },
  {
    id: "mock-2",
    slug: "mock-gilded-geode-tray",
    title: "Gilded Geode Serving Tray",
    displayTitle: "Gilded Geode Tray",
    shortTagline: "An oval tray with a hand-built geode edge.",
    priceMin: 3299,
    priceMax: 4199,
    showPrice: true,
    categoryName: "Trays",
    image: {
      url: "/mock/geode-tray.webp",
      alt: "Oval gold-leaf geode resin serving tray with sapphire bands",
      role: null,
    },
    hoverImage: {
      url: "/mock/pour-detail.webp",
      alt: "Close detail of resin being poured over pigment",
      role: null,
    },
    variantChips: ["Small", "Large"],
    tier: 1,
    inStock: true,
    featured: false,
    materials: "Resin, quartz, gold leaf",
    dimensions: "38 × 24 cm",
    videoUrl: null,
    isDemo: false,
  },
  {
    id: "mock-3",
    slug: "mock-varmala-keepsake",
    title: "Varmala Keepsake Block",
    displayTitle: "Varmala Keepsake",
    shortTagline: "Your wedding garland, held in clear resin.",
    priceMin: 4999,
    priceMax: null,
    showPrice: true,
    categoryName: "Varmala Preservation",
    image: {
      url: "/mock/varmala-block.webp",
      alt: "Clear resin keepsake block preserving red and marigold wedding garland flowers",
      role: null,
    },
    hoverImage: null,
    variantChips: ["Cube", "Slab"],
    tier: 1,
    inStock: true,
    featured: false,
    duplicateCount: 3,
    materials: "Crystal-clear resin, preserved garland",
    dimensions: null,
    videoUrl: null,
    isDemo: false,
  },
  {
    id: "mock-4",
    slug: "mock-midnight-bloom-pendant",
    title: "Midnight Bloom Pendant",
    displayTitle: "Midnight Bloom",
    shortTagline: null,
    priceMin: 899,
    priceMax: null,
    showPrice: true,
    categoryName: "Jewelry",
    image: {
      url: "/mock/pendant.webp",
      alt: "Teardrop resin pendant with gold flakes and pressed white flowers",
      role: null,
    },
    hoverImage: null,
    variantChips: [],
    tier: null,
    inStock: false,
    featured: false,
    materials: null,
    dimensions: null,
    videoUrl: null,
    isDemo: true,
  },
];

export const MOCK_COLLECTIONS = [
  {
    href: "/shop/varmala-preservation",
    name: "PRESERVE",
    promise: "Keep the day forever",
    image: "/media/v3/story-pour.avif",
    alt: "Resin being poured over a preserved wedding garland",
  },
  {
    href: "/shop/coasters",
    name: "LIVE",
    promise: "The everyday, made deliberate",
    image: "/media/v3/story-gild.avif",
    alt: "Gold leaf being laid into a resin coaster mid-cure",
  },
  {
    href: "/custom-order",
    name: "COMMISSION",
    promise: "A piece made for you",
    image: "/media/v3/story-polish.avif",
    alt: "A finished resin surface being hand-polished",
  },
] as const;

export const MOCK_TESTIMONIALS = [
  {
    quote:
      "The varmala block made my mother cry — our wedding garland, held in light forever.",
    name: "Placeholder Customer",
    location: "Surat",
    rating: 5,
    avatarUrl: null,
  },
  {
    quote: "The tray looks like the ocean decided to live on my table.",
    name: "Placeholder Customer",
    location: "Mumbai",
    rating: 5,
    avatarUrl: "/media/v3/macro-epoxy.avif",
  },
] as const;
