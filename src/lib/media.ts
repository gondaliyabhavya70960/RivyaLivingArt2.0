/**
 * Branded ResinRiva imagery hosted on Cloudinary (the `resinriva/` folder of
 * the studio's Cloudinary account). Centralised so the hero, About page,
 * homepage feature and gallery strip all reference one canonical URL each.
 *
 * Category card images are DB-driven (`Category.image`) and seeded separately
 * by `prisma/seed-category-images.ts`.
 */
// `f_auto,q_auto` lets Cloudinary deliver an optimized AVIF/WebP at automatic
// quality straight from its CDN, so these load with `unoptimized` (no Next.js
// image-optimizer round-trip needed).
const CLOUDINARY =
  "https://res.cloudinary.com/dhaqpl1kz/image/upload/f_auto,q_auto";

/**
 * Cloudinary + owner-uploaded (`/uploads`) images are served directly rather
 * than through the Next.js optimizer — Cloudinary is already a CDN, and
 * `/uploads` is served by the app itself.
 */
export function servesDirectly(url: string): boolean {
  return url.startsWith("/uploads") || url.includes("res.cloudinary.com");
}

/** Single-purpose feature images, keyed by where they appear. */
export const SITE_IMAGES = {
  /** Home hero — photographic backdrop behind the WebGL liquid-resin scene. */
  hero: `${CLOUDINARY}/v1782359311/resinriva/hero-ocean.jpg`,
  /** Homepage brand-story feature. */
  homepageFeature: `${CLOUDINARY}/v1782288799/resinriva/studio-ocean-wall-art.jpg`,
  /** About page — "Our story" framed visual. */
  aboutStory: `${CLOUDINARY}/v1782289010/resinriva/about-preserved-flower-frame.jpg`,
} as const;

/**
 * Extra branded studio pieces (no dedicated catalog category) used to fill the
 * homepage social/gallery strip instead of a bare placeholder.
 */
export const GALLERY_IMAGES: { url: string; alt: string }[] = [
  {
    url: `${CLOUDINARY}/v1782297264/resinriva/cat-nameplates.jpg`,
    alt: "Custom resin nameplate with gold detailing",
  },
  {
    url: `${CLOUDINARY}/v1782297261/resinriva/cat-corporate-gifting.jpg`,
    alt: "Resin corporate gifting set",
  },
  {
    url: `${CLOUDINARY}/v1782289473/resinriva/cat-3d-printed-decor.jpg`,
    alt: "3D-printed decor piece",
  },
  {
    url: `${CLOUDINARY}/v1782288799/resinriva/studio-ocean-wall-art.jpg`,
    alt: "Ocean-blue resin wall art from the studio",
  },
  {
    url: `${CLOUDINARY}/v1782289010/resinriva/about-preserved-flower-frame.jpg`,
    alt: "Preserved flower resin frame",
  },
];
