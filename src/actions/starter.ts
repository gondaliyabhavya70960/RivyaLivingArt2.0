"use server";

import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { applyStarterContent, type StarterReport } from "@/lib/starter/apply";
import { loadStarterFixtures } from "@/lib/starter/fixtures";
import { Role } from "@/generated/prisma/client";

/**
 * Starter content from the Studio — the same code path as
 * `npm run seed:starter`, for an owner who does not have a terminal.
 *
 * There is deliberately NO host guard here, and that is the difference from
 * `src/actions/demo.ts` next door. Demo fixtures are synthetic and refuse a
 * production database; starter content IS the site's content and production
 * is where it belongs. What stands in for the guard is that the plan is a
 * separate call from the write, the write only ever CREATES, and a row that
 * already exists is never touched — so the worst outcome of a mistaken click
 * is content the owner can delete, not an edit they cannot get back.
 */

/** What a write would do, without doing it. */
export async function getStarterPlan(): Promise<ActionResult<StarterReport>> {
  await requireStaff([Role.ADMIN]);
  return runAction(async () =>
    applyStarterContent(db, loadStarterFixtures(), { apply: false }),
  );
}

export async function applyStarterContentAction(
  publishFaqs: boolean,
): Promise<ActionResult<StarterReport>> {
  const session = await requireStaff([Role.ADMIN]);
  return runAction(async () => {
    const report = await applyStarterContent(db, loadStarterFixtures(), {
      apply: true,
      publishFaqs,
    });
    await logActivity({
      userId: session.user.id,
      action: "seed",
      entity: "starter-content",
      meta: {
        created: report.created,
        skipped: report.skipped,
        publishFaqs,
        byEntity: report.byEntity.map((o) => ({
          entity: o.entity,
          created: o.created,
          skipped: o.skipped,
        })),
      },
    });
    revalidatePublic("faq");
    revalidatePublic("portfolio");
    return report;
  });
}
