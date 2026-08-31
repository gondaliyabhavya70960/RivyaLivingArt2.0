import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  generatedCategoryCover,
  generatedCategoryRemoteUrl,
} from "./generated-cover";

/**
 * Reconcile catalog category cover images from the studio's branded Cloudinary
 * library. Runs on EVERY deploy (from bootstrap.ts, outside the empty-DB
 * guard) so category art reaches an already-seeded production database without
 * anyone re-seeding.
 *
 * NON-DESTRUCTIVE: only fills a category whose `image` is still empty, so it
 * never overwrites an image the owner set later in the studio. Idempotent —
 * once every mapped category has an image, re-runs are no-ops.
 */
// `f_auto,q_auto` — Cloudinary delivers an optimized AVIF/WebP from its CDN;
// the cards render these directly (unoptimized), no Next optimizer round-trip.
const CLOUDINARY =
  "https://res.cloudinary.com/dhaqpl1kz/image/upload/f_auto,q_auto";

/** Catalog category slug → Cloudinary cover image. */
const CATEGORY_IMAGES: Record<string, string> = {
  "resin-furniture-surfaces": `${CLOUDINARY}/v1782289478/resinriva/cat-resin-furniture.jpg`,
  "art-craft-pieces": `${CLOUDINARY}/v1782289373/resinriva/cat-art-craft.jpg`,
  "varmala-preservation": `${CLOUDINARY}/v1782289469/resinriva/cat-varmala-preservation.jpg`,
  "wedding-photo-frames": `${CLOUDINARY}/v1782289466/resinriva/cat-wedding-photo-frames.jpg`,
  "resin-trays-serving-platters": `${CLOUDINARY}/v1782289386/resinriva/cat-resin-trays.jpg`,
  "candle-tea-light-holders": `${CLOUDINARY}/v1782289406/resinriva/cat-candle-holders.jpg`,
  "resin-wall-clocks": `${CLOUDINARY}/v1782289456/resinriva/cat-resin-wall-clocks.jpg`,
  "resin-jewelry-keychains": `${CLOUDINARY}/v1782289378/resinriva/cat-resin-jewelry.jpg`,
  "resin-home-decor": `${CLOUDINARY}/v1782289382/resinriva/cat-home-decor.jpg`,
  "drinkware-barware": `${CLOUDINARY}/v1782297263/resinriva/cat-resin-coasters.jpg`,
  "sculptures-objets": `${CLOUDINARY}/v1782297260/resinriva/cat-spiritual-festive.jpg`,
};

/**
 * The 5 categories the Cloudinary library never covered (Step-4 image audit)
 * get brand-generated covers — first-party `/images/categories/*.webp` when
 * mirrored, else the public Higgsfield CDN URL (see prisma/generated-cover.ts).
 */
for (const slug of [
  "resin-vases",
  "tablespace-sets",
  "vanity-mirrors",
  "kids-room-decor",
  "workshops",
]) {
  const cover = generatedCategoryCover(slug);
  if (cover && !CATEGORY_IMAGES[slug]) CATEGORY_IMAGES[slug] = cover;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("seed-category-images: DATABASE_URL not set — skipping.");
    return;
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  let filled = 0;
  try {
    for (const [slug, image] of Object.entries(CATEGORY_IMAGES)) {
      // Fill categories with no cover — or still holding the machine-set
      // generated CDN URL for this slug, so the first-party mirror flip lands
      // on the next deploy (IMG-901). Owner-set images are never touched.
      const remote = generatedCategoryRemoteUrl(slug);
      const res = await db.category.updateMany({
        where: {
          slug,
          OR: [
            { image: null },
            ...(remote && remote !== image ? [{ image: remote }] : []),
          ],
        },
        data: { image },
      });
      filled += res.count;
    }
    console.log(
      `seed-category-images: filled ${filled} categor${filled === 1 ? "y" : "ies"} (of ${Object.keys(CATEGORY_IMAGES).length} mapped).`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  // Never fail the deploy on an image-seed hiccup — cards fall back to the
  // gradient placeholder. Log loudly so it is visible in the build output.
  console.error("seed-category-images: failed (continuing):", error);
});
