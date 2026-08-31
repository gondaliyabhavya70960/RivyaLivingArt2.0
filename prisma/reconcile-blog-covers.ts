import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import covers from "./generated-covers.json";
import { generatedBlogCover } from "./generated-cover";

/**
 * Reconcile Step-4 generated blog covers on EVERY deploy (run from
 * bootstrap.ts beside the category-image reconcile, outside the empty-DB
 * guard). Twin purpose:
 *
 *  1. Back-fill: a post whose cover is still empty gets its generated cover.
 *  2. First-party flip: once public/images/blog/<slug>.webp is committed
 *     (scripts/mirror-generated-images.mjs), generatedBlogCover() resolves
 *     to the local path and any row still holding the machine-set CDN URL is
 *     switched over — no manual `db:seed:blogs` run against production
 *     needed (blog seeding is otherwise gated on an empty DB).
 *
 * NON-DESTRUCTIVE: a cover the owner set in Studio (anything that is neither
 * empty nor this slug's known generated CDN URL) is never touched.
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("reconcile-blog-covers: DATABASE_URL not set — skipping.");
    return;
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  let updated = 0;
  try {
    for (const [slug, remoteUrl] of Object.entries(
      covers.blog as Record<string, string>,
    )) {
      const cover = generatedBlogCover(slug);
      if (!cover) continue;
      // No `NOT: { coverImage: cover }` idempotency guard here — under SQL
      // three-valued logic `NOT (coverImage = x)` is NULL (not TRUE) for a
      // NULL coverImage, so that guard silently excluded exactly the
      // empty-cover rows this reconcile exists to fill (ENG-814; production
      // logged "updated 0" while all 55 posts sat at NULL). Re-writing an
      // already-correct value on later runs is a harmless no-op update.
      const res = await db.blogPost.updateMany({
        where: {
          slug,
          OR: [{ coverImage: null }, { coverImage: remoteUrl }],
        },
        data: { coverImage: cover },
      });
      updated += res.count;
    }
    console.log(`reconcile-blog-covers: updated ${updated} post cover(s).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  // Never fail the deploy on a reconcile hiccup — covers just stay as-is.
  console.error(
    "reconcile-blog-covers: failed (continuing):",
    error instanceof Error ? error.message : error,
  );
});
