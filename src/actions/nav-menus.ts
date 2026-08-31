"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { locales } from "@/i18n/config";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  NAV_MENUS,
  NAV_MENU_DEFAULTS,
  describeHrefProblem,
  isNavMenuKey,
} from "@/lib/nav-menus";
import { NAV_MENUS_TAG } from "@/lib/nav-menus-server";

/**
 * Navigation actions — the write half of /studio/navigation.
 *
 * ADMIN-only. A wrong link is on every page of the site at once, which is a
 * wider blast radius than any single piece of copy.
 *
 * Revalidates by tag: the menus render in the layout, so every route in nine
 * locales depends on them and there is no path worth enumerating.
 */

const STUDIO_PATH = "/studio/navigation";

const menuSchema = z.string().refine(isNavMenuKey, "Unknown menu");
const hrefSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const problem = describeHrefProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });
const labelSchema = z
  .string()
  .trim()
  .min(1, "Give the link some words")
  .max(60, "Keep a navigation label under 60 characters");

function revalidate() {
  revalidateTag(NAV_MENUS_TAG, "max");
  revalidatePath(STUDIO_PATH);
}

/** Ensure the parent menu row exists before writing an item into it. */
async function ensureMenu(key: string) {
  await db.navMenu.upsert({ where: { key }, create: { key }, update: {} });
}

export async function addNavItem(input: {
  menuKey: string;
  label: string;
  href: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const menuKey = menuSchema.parse(input.menuKey);
    const label = labelSchema.parse(input.label);
    const href = hrefSchema.parse(input.href);

    await ensureMenu(menuKey);

    // A key minted from the label, uniqued within the menu. It is only ever an
    // identifier here — an added link has no `Nav.*` catalogue entry, so its
    // words come from the stored label instead.
    const base =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "link";
    let key = base;
    for (let n = 2; ; n += 1) {
      const clash = await db.navItem.findUnique({
        where: { menuKey_key: { menuKey, key } },
      });
      if (!clash) break;
      key = `${base}-${n}`;
    }

    const last = await db.navItem.findFirst({
      where: { menuKey },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    await db.navItem.create({
      data: {
        menuKey,
        key,
        label: { en: label },
        href,
        order: (last?.order ?? -1) + 1,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "NavItem",
      entityId: `${menuKey}:${key}`,
    });
    revalidate();
    return undefined;
  });
}

/** Change where a link goes. Validated against the site's real routes. */
export async function updateNavHref(input: {
  id: string;
  href: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const href = hrefSchema.parse(input.href);
    const row = await db.navItem.update({
      where: { id: input.id },
      data: { href },
    });

    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "NavItem",
      entityId: `${row.menuKey}:${row.key}`,
      meta: { href },
    });
    revalidate();
    return undefined;
  });
}

/**
 * Override what a link reads as, in one language.
 *
 * Blanking it falls the link back to the `Nav.*` catalogue — which is where a
 * seeded link's nine translations live, and which the copy layer already
 * edits. So "reset" here means "go back to the translated wording", not
 * "leave it blank".
 */
export async function updateNavLabel(input: {
  id: string;
  locale: string;
  label: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const locale = z
      .string()
      .refine(
        (v) => (locales as readonly string[]).includes(v),
        "Unknown language",
      )
      .parse(input.locale);
    const row = await db.navItem.findUniqueOrThrow({ where: { id: input.id } });

    const label: Record<string, string> =
      row.label && typeof row.label === "object" && !Array.isArray(row.label)
        ? Object.fromEntries(
            Object.entries(row.label as Record<string, unknown>).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          )
        : {};

    const next = input.label.trim();
    if (next) label[locale] = labelSchema.parse(next);
    else delete label[locale];

    await db.navItem.update({ where: { id: row.id }, data: { label } });

    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "NavItem",
      entityId: `${row.menuKey}:${row.key}`,
      meta: { locale },
    });
    revalidate();
    return undefined;
  });
}

/** Show or hide a link. Hidden rather than deleted, so it can come back. */
export async function setNavItemVisible(input: {
  id: string;
  visible: boolean;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const row = await db.navItem.update({
      where: { id: input.id },
      data: { visible: input.visible },
    });

    await logActivity({
      userId: session.user.id,
      action: input.visible ? "show" : "hide",
      entity: "NavItem",
      entityId: `${row.menuKey}:${row.key}`,
    });
    revalidate();
    return undefined;
  });
}

/** Reorder one menu — the order a visitor reads the links in. */
export async function reorderNavItems(input: {
  menuKey: string;
  ids: string[];
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const menuKey = menuSchema.parse(input.menuKey);

    await db.$transaction(
      input.ids.map((id, index) =>
        db.navItem.update({ where: { id }, data: { order: index } }),
      ),
    );

    await logActivity({
      userId: session.user.id,
      action: "reorder",
      entity: "NavItem",
      entityId: menuKey,
    });
    revalidate();
    return undefined;
  });
}

/** Put every menu back to the links the site shipped with. */
export async function resetNavMenus(): Promise<
  ActionResult<{ restored: number; hidden: number }>
> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    let restored = 0;
    const bundled = new Set<string>();

    for (const menuKey of NAV_MENUS) {
      await ensureMenu(menuKey);
      for (const [index, link] of NAV_MENU_DEFAULTS[menuKey].entries()) {
        bundled.add(`${menuKey}:${link.key}`);
        await db.navItem.upsert({
          where: { menuKey_key: { menuKey, key: link.key } },
          create: { menuKey, key: link.key, href: link.href, order: index },
          // Clears any label override too, so the link goes back to its
          // catalogue wording in all nine languages.
          update: {
            href: link.href,
            order: index,
            visible: true,
            label: {},
            newTab: false,
          },
        });
        restored += 1;
      }
    }

    const extras = await db.navItem.findMany({ where: { visible: true } });
    const hiding = extras.filter((r) => !bundled.has(`${r.menuKey}:${r.key}`));
    if (hiding.length) {
      await db.navItem.updateMany({
        where: { id: { in: hiding.map((r) => r.id) } },
        data: { visible: false },
      });
    }

    await logActivity({
      userId: session.user.id,
      action: "reset",
      entity: "NavItem",
      meta: { restored, hidden: hiding.length },
    });
    revalidate();
    return { restored, hidden: hiding.length };
  });
}
