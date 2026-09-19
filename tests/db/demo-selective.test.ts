import { afterAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import { demoCounts } from "@/lib/demo/apply";
import { removeDemoSelection } from "@/lib/demo/selective";
import { findMediaUsageDetails } from "@/lib/media-usages";

/**
 * Scoped demo removal, against a real Postgres.
 *
 * The pure tests in `src/lib/demo/selective.test.ts` prove the selection
 * rules — what needs a typed phrase, what gets de-duplicated. They cannot
 * prove the two facts that actually protect data, because both are about
 * ORDER and REFERENCES in a live database:
 *
 * 1. A demo media file that GENUINE content also uses survives, and the one
 *    whose only referrer was demo content does not. That distinction is not
 *    made by a demo/genuine test in the media pass — it is made by deleting
 *    content first, so whatever `findMediaUsageDetails` still reports is a
 *    genuine referrer by construction. Only a database can show that the
 *    ordering delivers the outcome the ordering claims.
 * 2. A row that stopped being demo between the screen rendering and the
 *    button being pressed is PROTECTED rather than deleted, and is reported
 *    apart from one that simply is not there any more.
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const db = await getTestDb();

const TAG = "demo-selective-test";
const SHARED_URL = `/uploads/${TAG}-shared.jpg`;
const DEMO_ONLY_URL = `/uploads/${TAG}-demo-only.jpg`;

async function cleanup() {
  if (!db) return;
  await db.blogPost.deleteMany({ where: { slug: { startsWith: TAG } } });
  await db.media.deleteMany({ where: { pathname: { startsWith: TAG } } });
  await db.faq.deleteMany({ where: { question: { startsWith: TAG } } });
}

afterAll(cleanup);

describe.skipIf(!db)("removeDemoSelection", () => {
  it("keeps a demo media file that genuine content still uses, and removes the one nothing needs", async () => {
    if (!db) return;
    await cleanup();

    // Two demo media rows…
    await db.media.create({
      data: {
        url: SHARED_URL,
        pathname: `${TAG}-shared.jpg`,
        isDemo: true,
      },
    });
    await db.media.create({
      data: {
        url: DEMO_ONLY_URL,
        pathname: `${TAG}-demo-only.jpg`,
        isDemo: true,
      },
    });

    // …one referenced by a GENUINE post the owner wrote,
    await db.blogPost.create({
      data: {
        title: "Genuine post",
        slug: `${TAG}-genuine`,
        coverImage: SHARED_URL,
        isDemo: false,
      },
    });
    // …the other only by a demo post that this run is about to delete.
    await db.blogPost.create({
      data: {
        title: "Demo post",
        slug: `${TAG}-demo`,
        coverImage: DEMO_ONLY_URL,
        isDemo: true,
      },
    });

    const report = await removeDemoSelection(
      db,
      { entities: ["BlogPost", "Media"] },
      findMediaUsageDetails,
      demoCounts,
    );

    // The genuine post is untouched — it was never in scope.
    const genuine = await db.blogPost.findUnique({
      where: { slug: `${TAG}-genuine` },
    });
    expect(genuine).not.toBeNull();
    expect(genuine?.coverImage).toBe(SHARED_URL);

    // Its picture survives, and the report says why rather than staying silent.
    const shared = await db.media.findUnique({
      where: { pathname: `${TAG}-shared.jpg` },
    });
    expect(shared).not.toBeNull();
    expect(
      report.sharedMediaPreserved.map((m) => m.url),
    ).toContain(SHARED_URL);
    const preserved = report.sharedMediaPreserved.find(
      (m) => m.url === SHARED_URL,
    );
    expect(preserved?.usedBy.length).toBeGreaterThan(0);

    // The demo-only picture is gone — its last referrer went with the content
    // pass, which is exactly what the ordering is for.
    const demoOnly = await db.media.findUnique({
      where: { pathname: `${TAG}-demo-only.jpg` },
    });
    expect(demoOnly).toBeNull();
    expect(report.sharedMediaPreserved.map((m) => m.url)).not.toContain(
      DEMO_ONLY_URL,
    );

    // And the demo post itself went.
    const demoPost = await db.blogPost.findUnique({
      where: { slug: `${TAG}-demo` },
    });
    expect(demoPost).toBeNull();
  });

  it("protects a selected row that is no longer demo, and separates it from one already gone", async () => {
    if (!db) return;
    await cleanup();

    const stillDemo = await db.faq.create({
      data: { question: `${TAG} still demo?`, answer: "a", isDemo: true },
    });
    const promoted = await db.faq.create({
      data: { question: `${TAG} promoted?`, answer: "b", isDemo: true },
    });

    // The owner keeps this one between the screen rendering and the click.
    await db.faq.update({
      where: { id: promoted.id },
      data: { isDemo: false },
    });

    const report = await removeDemoSelection(
      db,
      { ids: { Faq: [stillDemo.id, promoted.id, "cuid-that-never-existed"] } },
      findMediaUsageDetails,
      demoCounts,
    );

    const faq = report.byEntity.find((o) => o.entity === "Faq");
    expect(faq?.selected).toBe(3);
    expect(faq?.deleted).toBe(1);
    // Exists, but not demo any more — left alone on purpose.
    expect(faq?.protectedRows).toBe(1);
    // Never existed — stale screen, not a decision.
    expect(faq?.missing).toBe(1);

    expect(await db.faq.findUnique({ where: { id: stillDemo.id } })).toBeNull();
    const kept = await db.faq.findUnique({ where: { id: promoted.id } });
    expect(kept).not.toBeNull();
    expect(kept?.isDemo).toBe(false);
  });

  it("touches only the content types in the selection", async () => {
    if (!db) return;
    await cleanup();

    await db.faq.create({
      data: { question: `${TAG} untouched?`, answer: "a", isDemo: true },
    });
    await db.blogPost.create({
      data: { title: "Demo post", slug: `${TAG}-other`, isDemo: true },
    });

    await removeDemoSelection(
      db,
      { entities: ["BlogPost"] },
      findMediaUsageDetails,
      demoCounts,
    );

    expect(
      await db.faq.findFirst({ where: { question: `${TAG} untouched?` } }),
    ).not.toBeNull();
    expect(
      await db.blogPost.findUnique({ where: { slug: `${TAG}-other` } }),
    ).toBeNull();
  });
});
