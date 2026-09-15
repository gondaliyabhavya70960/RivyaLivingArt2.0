/**
 * Delete catalog products, permanently, with the blast radius shown first.
 *
 *   npm run products:purge                    # dry run — writes nothing
 *   npm run products:purge -- --confirm       # do it
 *
 * The owner asked for every product to be removed. Deleting them — here or in
 * /studio/products — is only half of it: `prisma/bootstrap.ts` runs the tier
 * fill on EVERY deploy, so the catalogue refills unless the fill is stopped.
 *
 * TWO MECHANISMS, AND ONLY ONE OF THEM EMPTIES THE CATALOGUE.
 *
 * `DeletedImport` tombstones — one per `(importSource, importRef)` pair, which
 * `tier-fill.ts` honours before it plans a single create — stop *these exact
 * rows* coming back. This script writes them, exactly as the studio's bulk
 * delete does. For Tier 1 that is enough: 372 rows in the CSV, no cap, so
 * tombstoning all of them leaves nothing to import.
 *
 * For Tiers 2-4 it is NOT enough, and this was measured rather than assumed.
 * `planTierRows` applies the cap AFTER the tombstone filter, and the pools are
 * far bigger than the caps: 35,128 rows against a cap of 1,000 · 21,508
 * against 2,500 · 7,685 against 500. Tombstoning the current selection simply
 * promotes the next rows down the list. A full purge + redeploy on a real
 * 4,385-product catalogue re-created 4,000 DIFFERENT products, and would keep
 * doing so for about thirty-five more runs. That is correct behaviour for
 * "I deleted these items, show me the next ones" — and it is the opposite of
 * what "remove all products" means.
 *
 * So a --confirm run switches the automatic fill OFF, and --keep-fill-on is
 * the opt-out for an owner who really does want the next rows promoted.
 *
 * WHAT GOES, WHAT STAYS. Prisma's referential actions decide, not this file:
 *
 *   CASCADE (deleted with the product)
 *     ProductImage · CustomizationField · ImportConflict
 *   SET NULL (kept, unlinked)
 *     Inquiry.productId · Testimonial.productId — a past WhatsApp order and a
 *     customer's own words outlive the catalogue row they pointed at. The
 *     order keeps the title it was placed with; the testimonial keeps its
 *     quote. Neither is deleted here, ever.
 *   UNTOUCHED, and left orphaned on purpose
 *     PriceHistory holds plain ids rather than relations (schema.prisma's own
 *     comment: "history outlives the staged row it came from"), so its rows
 *     survive with a productId pointing at nothing. That is the design.
 *     ScrapedProduct is staging, not catalogue — a scrape RECORDS what a
 *     supplier's site said, and deleting a product does not un-happen it.
 *
 * Blob files are NOT deleted. The studio's per-product delete does a
 * best-effort storage sweep; a purge of thousands of rows doing the same thing
 * unattended is how a shared URL gets pulled out from under a blog post. The
 * count is reported so the storage bill is not a surprise.
 *
 * Read the dry run before passing --confirm. There is no undo.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

type Args = {
  confirm: boolean;
  importedOnly: boolean;
  keepDemo: boolean;
  keepFillOn: boolean;
};

function parseArgs(argv: string[]): Args | { error: string } {
  const known = new Set([
    "--confirm",
    "--imported-only",
    "--keep-demo",
    "--keep-fill-on",
  ]);
  for (const arg of argv) {
    if (!known.has(arg)) return { error: `Unknown option ${arg}` };
  }
  return {
    confirm: argv.includes("--confirm"),
    importedOnly: argv.includes("--imported-only"),
    keepDemo: argv.includes("--keep-demo"),
    keepFillOn: argv.includes("--keep-fill-on"),
  };
}

const parsed = parseArgs(process.argv.slice(2));
if ("error" in parsed) {
  console.error(
    `${parsed.error}\n\n` +
      "  npm run products:purge                      dry run (default)\n" +
      "  npm run products:purge -- --confirm         delete, for real\n" +
      "  npm run products:purge -- --imported-only   spare hand-made products\n" +
      "  npm run products:purge -- --keep-demo       spare the Content Lab set\n" +
      "  npm run products:purge -- --keep-fill-on    leave the automatic fill ON\n",
  );
  process.exit(1);
}
const args = parsed;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is required — this deletes from the live catalogue.\n" +
      "  DATABASE_URL=… npm run products:purge",
  );
  process.exit(1);
}

// The same adapter shape as src/lib/db.ts. Its own client, so this stays a
// plain script with no Next.js env validation to satisfy.
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

/** The rows this run is about. Narrowed by the flags, nothing else. */
function buildWhere(a: Args) {
  const where: Record<string, unknown> = {};
  if (a.importedOnly) where.importSource = { not: null };
  if (a.keepDemo) where.isDemo = false;
  return where;
}

/** Ids in pages — `deleteMany` on 4,000+ ids in one statement is a bad plan. */
const PAGE = 500;

async function main() {
  const where = buildWhere(args);

  const [total, byStatus, imported, demo, images, fields, conflicts] =
    await Promise.all([
      db.product.count({ where }),
      db.product.groupBy({ by: ["status"], where, _count: { _all: true } }),
      db.product.count({ where: { ...where, importSource: { not: null } } }),
      db.product.count({ where: { ...where, isDemo: true } }),
      db.productImage.count({ where: { product: where } }),
      db.customizationField.count({ where: { product: where } }),
      db.importConflict.count({ where: { product: where } }),
    ]);

  if (total === 0) {
    console.log(
      "Nothing matches. The catalogue is already empty of these rows.",
    );
    return;
  }

  const [inquiries, testimonials, blobImages, priceHistory] = await Promise.all(
    [
      db.inquiry.count({ where: { product: where } }),
      db.testimonial.count({ where: { product: where } }),
      db.productImage.count({
        where: {
          product: where,
          url: { contains: ".public.blob.vercel-storage.com/" },
        },
      }),
      db.product.findMany({ where, select: { id: true } }).then((rows) =>
        db.priceHistory.count({
          where: { productId: { in: rows.map((r) => r.id) } },
        }),
      ),
    ],
  );

  const scope = args.importedOnly ? "IMPORTED products" : "ALL products";
  console.log(`\n${args.confirm ? "PURGING" : "DRY RUN —"} ${scope}\n`);
  console.log(`  ${total.toLocaleString("en-IN")} products`);
  for (const g of byStatus.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`    ${String(g._count._all).padStart(7)}  ${g.status}`);
  }
  console.log(
    `\n  of those: ${imported.toLocaleString("en-IN")} imported, ` +
      `${(total - imported).toLocaleString("en-IN")} hand-made, ${demo} demo`,
  );
  console.log("\n  deleted with them (cascade):");
  console.log(`    ${String(images).padStart(7)}  product images`);
  console.log(`    ${String(fields).padStart(7)}  customization fields`);
  console.log(`    ${String(conflicts).padStart(7)}  import conflicts`);
  console.log("\n  KEPT, unlinked (SetNull) — never deleted by this script:");
  console.log(`    ${String(inquiries).padStart(7)}  WhatsApp orders`);
  console.log(`    ${String(testimonials).padStart(7)}  testimonials`);
  console.log("\n  kept, orphaned on purpose:");
  console.log(`    ${String(priceHistory).padStart(7)}  price-history points`);
  console.log("\n  NOT deleted, and not free:");
  console.log(
    `    ${String(blobImages).padStart(7)}  images stored in Vercel Blob ` +
      "(delete from /studio/media if you want the space back)",
  );

  if (!args.confirm) {
    console.log(
      "\nDry run. Nothing was written.\n" +
        "Re-run with --confirm to delete. There is no undo.\n",
    );
    return;
  }

  // Tombstone BEFORE deleting, like the studio's bulk delete: the deploy-time
  // fill honours these pairs, so the removal survives the next build. Without
  // this step every imported row is back within one deploy.
  const tombstoned = await db.product.findMany({
    where: { ...where, importSource: { not: null }, importRef: { not: null } },
    select: { importSource: true, importRef: true },
  });
  let tombstones = 0;
  for (let i = 0; i < tombstoned.length; i += PAGE) {
    const { count } = await db.deletedImport.createMany({
      data: tombstoned.slice(i, i + PAGE).map((p) => ({
        importSource: p.importSource!,
        importRef: p.importRef!,
      })),
      skipDuplicates: true,
    });
    tombstones += count;
  }
  console.log(`\n  ${tombstones.toLocaleString("en-IN")} tombstones written.`);

  let deleted = 0;
  for (;;) {
    const page = await db.product.findMany({
      where,
      select: { id: true },
      take: PAGE,
    });
    if (page.length === 0) break;
    const { count } = await db.product.deleteMany({
      where: { id: { in: page.map((p) => p.id) } },
    });
    deleted += count;
    process.stdout.write(`\r  ${deleted.toLocaleString("en-IN")} deleted…`);
    if (count === 0) break; // nothing deletable left; do not spin
  }
  console.log(`\r  ${deleted.toLocaleString("en-IN")} products deleted.   `);

  if (args.keepFillOn) {
    console.log(
      "\n  The automatic fill is still ON, because you asked for that.\n" +
        "  The tombstones stop these exact rows returning, but Tiers 2-4 hold\n" +
        "  far more rows than their caps, so the next deploy will import the\n" +
        "  next ones down the list. The catalogue will NOT stay empty.",
    );
  } else {
    await db.siteSettings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        catalogFillEnabled: false,
        catalogFillOnDeploy: false,
      },
      update: { catalogFillEnabled: false, catalogFillOnDeploy: false },
    });
    console.log(
      "\n  Automatic catalog fill switched OFF (Settings → catalogFill*).\n" +
        "  Without this the next deploy refills the catalogue from the rows\n" +
        "  that were below the tier caps — tombstones alone cannot empty it.\n" +
        "  Turn it back on from /studio/catalog-fill when you want a catalogue.",
    );
  }

  await db.activityLog.create({
    data: {
      action: "products-purge",
      entity: "Product",
      meta: {
        scope,
        deleted,
        tombstones,
        fillSwitchedOff: !args.keepFillOn,
        keptInquiries: inquiries,
        keptTestimonials: testimonials,
      },
    },
  });
  console.log("\nDone. Recorded in the activity log.\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
