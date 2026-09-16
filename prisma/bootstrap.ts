import "dotenv/config";
import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * One-time deploy bootstrap. Runs in the Vercel build AFTER `prisma migrate
 * deploy`, so the schema exists. If the database has already been seeded
 * (any Category present) it does nothing — so it never fights the owner's
 * later edits, deletions or blog changes. On a fresh/empty database it runs
 * the base seed (admin, categories, FAQs, settings, legal pages) and the
 * blog seed (55 posts), giving a working /studio login and populated site
 * without anyone having to run a CLI script by hand.
 *
 * Safe to keep in every build: after the first successful run the guard
 * short-circuits permanently.
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("bootstrap: DATABASE_URL not set — skipping.");
    return;
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  let alreadySeeded = false;
  try {
    alreadySeeded = (await db.category.count()) > 0;
  } catch (error) {
    // Table missing / unreachable — migrations should have run first, but
    // never fail the build here; a later deploy will retry.
    console.warn(
      "bootstrap: could not read the database, skipping seed:",
      error instanceof Error ? error.message : error,
    );
    await db.$disconnect();
    return;
  }
  await db.$disconnect();

  // Reconcile the curated scrape-source registry on EVERY deploy (idempotent,
  // preserves verified platforms + the owner's enable/disable choices). This
  // is separate from the empty-DB guard below so newly-added curated sources
  // reach an already-seeded production database without anyone re-seeding.
  try {
    execSync("tsx prisma/seed-sources.ts", { stdio: "inherit" });
  } catch (error) {
    console.error(
      "bootstrap: scrape-source reconcile failed (continuing):",
      error instanceof Error ? error.message : error,
    );
  }

  // Reconcile branded category cover images too (every deploy, non-destructive
  // — only fills categories that still have no image).
  try {
    execSync("tsx prisma/seed-category-images.ts", { stdio: "inherit" });
  } catch (error) {
    console.error(
      "bootstrap: category-image reconcile failed (continuing):",
      error instanceof Error ? error.message : error,
    );
  }

  // Reconcile generated blog covers the same way (back-fill empty covers and
  // flip machine-set CDN URLs to the first-party /images files once they are
  // committed — owner-set covers are never touched).
  try {
    execSync("tsx prisma/reconcile-blog-covers.ts", { stdio: "inherit" });
  } catch (error) {
    console.error(
      "bootstrap: blog-cover reconcile failed (continuing):",
      error instanceof Error ? error.message : error,
    );
  }

  // Move the bundled site imagery into Vercel Blob so /studio/site-images is
  // backed by the media library from the first deploy, instead of waiting for
  // someone to log in and press "Import bundled images".
  //
  // Two guards, both load-bearing:
  //
  //  1. A REAL Blob token must be present. Without one `putFile` falls back to
  //     the local disk driver and writes into the build container's
  //     filesystem, which is discarded when the build ends — that would put
  //     `/uploads/…` URLs into the production database pointing at nothing.
  //
  //  2. Only when the table is completely empty. "Reset to default" is a row
  //     DELETE, so re-importing on every deploy would quietly undo the owner's
  //     resets. Once any slot has been set this never runs again; the studio
  //     button remains for re-importing by hand.
  try {
    const { blobStorageConfigured, importBundledSiteImages } =
      await import("../src/lib/site-images-import");
    if (!blobStorageConfigured()) {
      // Name the environment: a Blob store can be linked but scoped to
      // Production only, in which case preview builds skip while production
      // imports. Without this the two cases read identically in the log.
      console.log(
        `bootstrap: BLOB_READ_WRITE_TOKEN not set in ${process.env.VERCEL_ENV ?? "local"} — skipping the site-image import.`,
      );
    } else {
      const sdb = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
      try {
        if ((await sdb.siteImage.count()) > 0) {
          console.log(
            "bootstrap: site images already customised — skipping import.",
          );
        } else {
          const summary = await importBundledSiteImages(sdb);
          console.log(
            `bootstrap: imported ${summary.uploaded} site image(s) into Blob` +
              (summary.failed.length
                ? `; failed: ${summary.failed.join(", ")}`
                : "."),
          );
        }
      } finally {
        await sdb.$disconnect();
      }
    }
  } catch (error) {
    console.error(
      "bootstrap: site-image import failed (continuing):",
      error instanceof Error ? error.message : error,
    );
  }

  if (alreadySeeded) {
    console.log("bootstrap: database already seeded — skipping base seed.");
  } else {
    console.log("bootstrap: empty database — seeding structure and blog…");
    execSync("tsx prisma/seed.ts", { stdio: "inherit" });
    execSync("tsx prisma/seed-blogs.ts", { stdio: "inherit" });
    console.log("bootstrap: seed complete.");
  }

  // Import the owner's four-tier product sheet on every deploy (idempotent
  // upserts keyed on importSource+importRef; reads the full tabs from
  // data/tiers/*.csv.gz when the fetch-tiers workflow has committed them,
  // else the partial data/tiers/sample/*.sample.csv extracts). Tier volumes
  // per the owner's brief: Tier1 all, Tier2 top 1000, Tier3 top 2500,
  // Tier4 top 500 (2026-08-13).
  try {
    execSync("tsx prisma/import-tiers.ts", { stdio: "inherit" });
    // Then file what the fill just created (and any other untiered row a
    // person has not edited) under its size tier — docs/plan/07 step 3,
    // by rule. Non-destructive, idempotent, skipped on preview builds; the
    // rule and its reasons live in src/lib/catalog-size-tier.ts.
    execSync("tsx prisma/suggest-size-tiers.ts", { stdio: "inherit" });
  } catch (error) {
    console.error(
      "bootstrap: tier import failed (continuing):",
      error instanceof Error ? error.message : error,
    );
  }

  // Commission-form dropdown options.
  //
  // Gated on the table being empty, like the site-image import above and for
  // the same reason: retiring an option is a row edit, so re-seeding every
  // deploy would resurrect choices the owner deliberately turned off. Values
  // are the exact strings the form used to submit, so existing Inquiry rows
  // keep matching and the WhatsApp message is unchanged.
  try {
    const fdb = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
      if ((await fdb.formOption.count()) > 0) {
        console.log(
          "bootstrap: commission form options already set — skipping seed.",
        );
      } else {
        const { FORM_OPTION_DEFAULTS, FORM_OPTION_LISTS } =
          await import("../src/lib/form-options");
        let seeded = 0;
        for (const list of FORM_OPTION_LISTS) {
          for (const [index, value] of FORM_OPTION_DEFAULTS[list].entries()) {
            await fdb.formOption.create({
              data: { list, value, label: { en: value }, order: index },
            });
            seeded += 1;
          }
        }
        console.log(`bootstrap: seeded ${seeded} commission form option(s).`);
      }
    } finally {
      await fdb.$disconnect();
    }
  } catch (error) {
    console.error(
      "bootstrap: form-option seed failed (continuing):",
      error instanceof Error ? error.message : error,
    );
  }

  // Header, drawer and footer navigation.
  //
  // Gated on the table being empty, same as the site images and form options:
  // hiding a link is a row edit, so re-seeding every deploy would put back a
  // link the owner deliberately took down. Keys match the `Nav.*` message keys
  // so every seeded link keeps its nine translations.
  try {
    const ndb = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
      if ((await ndb.navItem.count()) > 0) {
        console.log("bootstrap: navigation already set — skipping seed.");
      } else {
        const { NAV_MENUS, NAV_MENU_DEFAULTS } =
          await import("../src/lib/nav-menus");
        let seeded = 0;
        for (const menuKey of NAV_MENUS) {
          await ndb.navMenu.upsert({
            where: { key: menuKey },
            create: { key: menuKey },
            update: {},
          });
          for (const [index, link] of NAV_MENU_DEFAULTS[menuKey].entries()) {
            await ndb.navItem.create({
              data: { menuKey, key: link.key, href: link.href, order: index },
            });
            seeded += 1;
          }
        }
        console.log(`bootstrap: seeded ${seeded} navigation link(s).`);
      }
    } finally {
      await ndb.$disconnect();
    }
  } catch (error) {
    console.error(
      "bootstrap: navigation seed failed (continuing):",
      error instanceof Error ? error.message : error,
    );
  }

  // One-key backfill for links added to NAV_MENU_DEFAULTS *after* launch.
  //
  // The seed above is gated on the whole table being empty, so it short-
  // circuits permanently after the first successful deploy: a link added to
  // the defaults later reaches a fresh database and no other. `getNavMenus`'s
  // fallback does not rescue it either — it replaces a menu only when that
  // menu resolved to zero visible rows, never merges.
  //
  // Safe against an owner who took the link down, because /studio/navigation
  // has no delete path: hiding sets `visible: false` and the row survives
  // (schema.prisma "Hidden rather than deleted"). So a findUnique HIT is proof
  // the owner has already been offered this link and made a choice about it.
  // If a hard delete is ever added to that screen, this block becomes a
  // link-resurrection bug and must be revisited.
  //
  // No `label` is written: an empty label falls through to `translate(key)`,
  // which is the nine-language Nav.* catalogue. Writing one would pin the link
  // to English in all nine locales.
  try {
    const ndb = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
      const BACKFILL = [
        {
          menuKey: "footer-explore",
          key: "largeFormat",
          href: "/large-resin-art",
        },
      ] as const;
      let added = 0;
      for (const link of BACKFILL) {
        const existing = await ndb.navItem.findUnique({
          where: { menuKey_key: { menuKey: link.menuKey, key: link.key } },
        });
        if (existing) continue;
        const menu = await ndb.navMenu.findUnique({
          where: { key: link.menuKey },
        });
        if (!menu) continue; // menu itself unseeded — the seed above owns that
        const last = await ndb.navItem.findFirst({
          where: { menuKey: link.menuKey },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        await ndb.navItem.create({
          data: {
            menuKey: link.menuKey,
            key: link.key,
            href: link.href,
            order: (last?.order ?? -1) + 1,
          },
        });
        added += 1;
      }
      if (added > 0)
        console.log(`bootstrap: backfilled ${added} navigation link(s).`);
    } finally {
      await ndb.$disconnect();
    }
  } catch (error) {
    console.error(
      "bootstrap: navigation backfill failed (continuing):",
      error instanceof Error ? error.message : error,
    );
  }

  // Curated portfolio case studies built from the owner's Tier-1 rows.
  // Gated twice inside the script itself (owner decision D22): it needs
  // PORTFOLIO_SEED=1 and an archive with no `case-*` rows, so an unset
  // production environment is a no-op and an owner's edits to a seeded case
  // survive the next deploy. The gate lives in the seed rather than here so
  // that running it by hand is gated too.
  try {
    execSync("tsx prisma/seed-portfolio-cases.ts", { stdio: "inherit" });
  } catch (error) {
    console.error(
      "bootstrap: portfolio case seed failed (continuing):",
      error instanceof Error ? error.message : error,
    );
  }
}

main().catch((error) => {
  // Never fail the deploy on a seed hiccup — the site can boot empty and be
  // seeded later. Log loudly so it is visible in the build output.
  console.error("bootstrap: seed failed (continuing build):", error);
});
