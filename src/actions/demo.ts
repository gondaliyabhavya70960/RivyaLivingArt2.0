"use server";

import { revalidateTag } from "next/cache";

import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { removeDemo, seedDemo, type DemoCounts } from "@/lib/demo/apply";
import { describeDemoHost } from "@/lib/demo/guard";
import { SITE_SETTINGS_TAG } from "@/lib/site-settings";
import { Role } from "@/generated/prisma/client";

const REMOVE_CONFIRMATION = "REMOVE DEMO DATA";

export type DemoContentStatus = {
  demoContentPublic: boolean;
  host: string;
  allowed: boolean;
  production: boolean;
};

/**
 * Current public-visibility switch plus the host guard's read of this
 * database — used by the Settings screen's standalone toggle, which has no
 * server-rendered parent of its own to read the row for it.
 */
export async function getDemoContentStatus(): Promise<
  ActionResult<DemoContentStatus>
> {
  await requireStaff([Role.ADMIN]);
  return runAction(async () => {
    const settings = await db.siteSettings.findUnique({
      where: { id: "main" },
      select: { demoContentPublic: true },
    });
    const { host, allowed, production } = describeDemoHost(
      process.env.DATABASE_URL,
    );
    return {
      demoContentPublic: settings?.demoContentPublic ?? false,
      host,
      allowed,
      production,
    };
  });
}

/**
 * Load every Content Lab fixture into the database (ADMIN only).
 *
 * Refuses on a database that looks like production, exactly like the CLI —
 * a Server Action is a public POST endpoint that anyone with a staff cookie
 * can trigger, so the same host guard has to run here too, not only at the
 * command line.
 */
export async function seedDemoData(): Promise<ActionResult<DemoCounts>> {
  const session = await requireStaff([Role.ADMIN]);
  const { production, host } = describeDemoHost(process.env.DATABASE_URL);
  if (production) {
    return {
      ok: false,
      error: `Refused: ${host} looks like the production database. Content Lab fixtures can only be seeded from the command line with an explicit override.`,
    };
  }
  return runAction(async () => {
    const counts = await seedDemo(db);
    await logActivity({
      userId: session.user.id,
      action: "seed",
      entity: "demo",
      meta: { counts: counts as unknown as Record<string, unknown> },
    });
    revalidatePublic("product");
    revalidatePublic("category");
    revalidatePublic("blogPost");
    revalidatePublic("portfolio");
    revalidatePublic("faq");
    revalidatePublic("testimonial");
    revalidatePublic("customPage");
    return counts;
  });
}

/**
 * Delete every demo row (ADMIN only). Requires the operator to type the
 * confirmation phrase verbatim — the same typed-confirm pattern as every
 * other irreversible bulk action in the Studio (`PromptDialog`), because
 * this removes 400+ rows across eleven tables in one call.
 */
export async function removeDemoData(
  confirmation: string,
): Promise<ActionResult<DemoCounts>> {
  const session = await requireStaff([Role.ADMIN]);
  if (confirmation !== REMOVE_CONFIRMATION) {
    return { ok: false, error: `Type "${REMOVE_CONFIRMATION}" to confirm.` };
  }
  return runAction(async () => {
    const counts = await removeDemo(db);
    await logActivity({
      userId: session.user.id,
      action: "remove",
      entity: "demo",
      meta: { remaining: counts as unknown as Record<string, unknown> },
    });
    revalidatePublic("product");
    revalidatePublic("category");
    revalidatePublic("blogPost");
    revalidatePublic("portfolio");
    revalidatePublic("faq");
    revalidatePublic("testimonial");
    revalidatePublic("customPage");
    return counts;
  });
}

/**
 * The owner's public-visibility switch (ADMIN only — the same gate as
 * Settings). Turning this on in production is the only way demo fixtures
 * ever reach a visitor there, and it is always a deliberate act on this
 * screen — `showDemoContent()` (`src/lib/demo-content.ts`) never defaults it
 * on.
 */
export async function setDemoContentPublic(
  value: boolean,
): Promise<ActionResult> {
  const session = await requireStaff([Role.ADMIN]);
  return runAction(async () => {
    await db.siteSettings.upsert({
      where: { id: "main" },
      create: { id: "main", demoContentPublic: value },
      update: { demoContentPublic: value },
    });
    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "SiteSettings",
      entityId: "main",
      meta: { demoContentPublic: value },
    });
    // Settings are read through a tagged, cached loader — bust the tag so
    // the switch reaches every public page immediately rather than after
    // the cache's TTL.
    revalidateTag(SITE_SETTINGS_TAG, "max");
    // Every reader that gates on the demo clause needs to re-render: a demo
    // product/post/case/testimonial/faq/lander that was hidden a moment ago
    // may now be visible, and vice versa.
    revalidatePublic("product");
    revalidatePublic("category");
    revalidatePublic("blogPost");
    revalidatePublic("portfolio");
    revalidatePublic("faq");
    revalidatePublic("testimonial");
    revalidatePublic("customPage");
    return undefined;
  });
}
