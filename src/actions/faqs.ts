"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { normalizeTranslations, TRANSLATABLE_FIELDS } from "@/lib/localize";

const STUDIO_PATH = "/studio/faqs";

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  question: z.string().trim().min(1, "Question is required").max(300),
  answer: z.string().trim().min(1, "Answer is required").max(5000),
  translations: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export type UpsertFaqInput = z.input<typeof upsertSchema>;

/** Create or update an FAQ. New entries append to the end of the order. */
export async function upsertFaq(
  input: UpsertFaqInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = upsertSchema.parse(input);

    // Prune per-locale overrides to known locales + translatable fields; an
    // empty result writes SQL NULL so the column stays clean.
    const normalizedTranslations = normalizeTranslations(
      parsed.translations,
      TRANSLATABLE_FIELDS.faq,
    );
    const translationsWrite: Prisma.InputJsonValue | typeof Prisma.DbNull =
      normalizedTranslations === null
        ? Prisma.DbNull
        : (normalizedTranslations as Prisma.InputJsonValue);

    const data = {
      question: parsed.question,
      answer: parsed.answer,
      translations: translationsWrite,
    };

    let id: string;
    if (parsed.id) {
      const updated = await db.faq.update({ where: { id: parsed.id }, data });
      id = updated.id;
    } else {
      // Append to the end of the current ordering.
      const maxOrder = await db.faq.aggregate({ _max: { order: true } });
      const created = await db.faq.create({
        data: { ...data, order: (maxOrder._max.order ?? -1) + 1 },
      });
      id = created.id;
    }

    await logActivity({
      userId: session.user.id,
      action: parsed.id ? "update" : "create",
      entity: "Faq",
      entityId: id,
      meta: { question: parsed.question },
    });
    revalidatePath(STUDIO_PATH);
    revalidatePublic("faq");
    return { id };
  });
}

const deleteSchema = z.array(z.string().min(1)).min(1);

/** Bulk delete FAQs. */
export async function deleteFaqs(input: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const ids = deleteSchema.parse(input);

    await db.faq.deleteMany({ where: { id: { in: ids } } });

    await logActivity({
      userId: session.user.id,
      action: ids.length > 1 ? "bulk-delete" : "delete",
      entity: "Faq",
      meta: { count: ids.length, ids },
    });
    revalidatePath(STUDIO_PATH);
    revalidatePublic("faq");
    return undefined;
  });
}

const reorderSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

/**
 * Swap an FAQ with its neighbour in display order. Works in index space
 * so duplicate `order` values are normalised as a side effect.
 */
export async function reorderFaq(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = reorderSchema.parse({ id, direction });

    const all = await db.faq.findMany({
      orderBy: [{ order: "asc" }, { question: "asc" }],
      select: { id: true, order: true },
    });
    const index = all.findIndex((f) => f.id === parsed.id);
    if (index === -1) throw new Error("FAQ not found");

    const target = parsed.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= all.length) return undefined; // already at the edge

    [all[index], all[target]] = [all[target], all[index]];

    const writes = all.flatMap((f, i) =>
      f.order === i
        ? []
        : [db.faq.update({ where: { id: f.id }, data: { order: i } })],
    );
    if (writes.length > 0) await db.$transaction(writes);

    await logActivity({
      userId: session.user.id,
      action: "reorder",
      entity: "Faq",
      entityId: parsed.id,
      meta: { direction: parsed.direction },
    });
    revalidatePath(STUDIO_PATH);
    revalidatePublic("faq");
    return undefined;
  });
}
