"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { locales } from "@/i18n/config";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  FORM_OPTION_DEFAULTS,
  FORM_OPTION_LISTS,
  isFormOptionList,
} from "@/lib/form-options";
import { FORM_OPTIONS_TAG } from "@/lib/form-options-server";

/**
 * Commission-form option actions — the write half of /studio/forms.
 *
 * ADMIN-only throughout. These lists decide what a customer can tell the
 * studio about a commission, and a mistake here is visible on the page that
 * takes the orders — that is a narrower audience than the copy board, which
 * EDITORs share.
 *
 * Revalidates by tag: `/custom-order` renders in nine locales, each its own
 * cache entry, and `getFormOptions()` is what every one of them reads.
 */

const STUDIO_PATH = "/studio/forms";

const listSchema = z.string().refine(isFormOptionList, "Unknown list");
const valueSchema = z
  .string()
  .trim()
  .min(1, "Give the choice some text")
  .max(80, "Keep a dropdown choice under 80 characters");

function revalidate() {
  revalidateTag(FORM_OPTIONS_TAG, "max");
  revalidatePath(STUDIO_PATH);
}

/**
 * Add a choice to a list.
 *
 * The value is minted from the English label ONCE, here, and never changes
 * afterwards — see `updateFormOption`. That is what keeps a past Inquiry
 * meaning what it meant when it was submitted.
 */
export async function addFormOption(input: {
  list: string;
  label: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const list = listSchema.parse(input.list);
    const value = valueSchema.parse(input.label);

    const existing = await db.formOption.findUnique({
      where: { list_value: { list, value } },
    });
    if (existing) {
      // Re-adding a retired choice should bring it back rather than fail —
      // the value is already the right one and its history still points here.
      if (!existing.enabled) {
        await db.formOption.update({
          where: { id: existing.id },
          data: { enabled: true },
        });
        revalidate();
        return undefined;
      }
      throw new Error("That choice is already in the list.");
    }

    const last = await db.formOption.findFirst({
      where: { list },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    await db.formOption.create({
      data: {
        list,
        value,
        label: { en: value },
        order: (last?.order ?? -1) + 1,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "FormOption",
      entityId: `${list}:${value}`,
    });
    revalidate();
    return undefined;
  });
}

/**
 * Edit what a choice READS AS, in one language.
 *
 * Deliberately cannot change `value`. Renaming "₹2,000–₹5,000" to something
 * else must not rewrite what a customer asked for six months ago, and the
 * WhatsApp message keeps carrying one canonical vocabulary the studio reads
 * across nine locales.
 */
export async function updateFormOptionLabel(input: {
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
    const row = await db.formOption.findUniqueOrThrow({
      where: { id: input.id },
    });

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
    // Blanking a translation falls the option back to English, which is what
    // an untranslated option does anyway — so this is "reset", not "empty".
    if (next) label[locale] = valueSchema.parse(next);
    else delete label[locale];

    await db.formOption.update({ where: { id: row.id }, data: { label } });

    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "FormOption",
      entityId: `${row.list}:${row.value}`,
      meta: { locale },
    });
    revalidate();
    return undefined;
  });
}

/**
 * Show or hide a choice.
 *
 * Never a delete. A removed row would orphan every Inquiry that chose it — the
 * studio would be reading order history against a vocabulary that no longer
 * exists. Retiring hides it from the form and leaves the record intact.
 */
export async function setFormOptionEnabled(input: {
  id: string;
  enabled: boolean;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const row = await db.formOption.update({
      where: { id: input.id },
      data: { enabled: input.enabled },
    });

    await logActivity({
      userId: session.user.id,
      action: input.enabled ? "enable" : "disable",
      entity: "FormOption",
      entityId: `${row.list}:${row.value}`,
    });
    revalidate();
    return undefined;
  });
}

/** Reorder one list. Order is the order the customer reads them in. */
export async function reorderFormOptions(input: {
  list: string;
  ids: string[];
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const list = listSchema.parse(input.list);

    await db.$transaction(
      input.ids.map((id, index) =>
        db.formOption.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    await logActivity({
      userId: session.user.id,
      action: "reorder",
      entity: "FormOption",
      entityId: list,
    });
    revalidate();
    return undefined;
  });
}

/**
 * Put every list back to the choices the site shipped with.
 *
 * Re-enables and re-orders the bundled values and clears their translations;
 * anything the owner added is retired rather than deleted, for the same
 * history reason as above.
 */
export async function resetFormOptions(): Promise<
  ActionResult<{ restored: number; retired: number }>
> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    let restored = 0;

    const bundled = new Set<string>();
    for (const list of FORM_OPTION_LISTS) {
      for (const [index, value] of FORM_OPTION_DEFAULTS[list].entries()) {
        bundled.add(`${list}:${value}`);
        await db.formOption.upsert({
          where: { list_value: { list, value } },
          create: { list, value, label: { en: value }, order: index },
          update: { label: { en: value }, order: index, enabled: true },
        });
        restored += 1;
      }
    }

    const extras = await db.formOption.findMany({ where: { enabled: true } });
    const retiring = extras.filter((r) => !bundled.has(`${r.list}:${r.value}`));
    if (retiring.length) {
      await db.formOption.updateMany({
        where: { id: { in: retiring.map((r) => r.id) } },
        data: { enabled: false },
      });
    }

    await logActivity({
      userId: session.user.id,
      action: "reset",
      entity: "FormOption",
      meta: { restored, retired: retiring.length },
    });
    revalidate();
    return { restored, retired: retiring.length };
  });
}
