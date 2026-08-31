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

const STUDIO_PATH = "/studio/testimonials";

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  location: z.string().trim().max(120).optional(),
  quote: z.string().trim().min(1, "Quote is required").max(2000),
  rating: z.number().int().min(1).max(5),
  avatarUrl: z.string().trim().max(2048).optional(),
  translations: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export type UpsertTestimonialInput = z.input<typeof upsertSchema>;

/** Create or update a testimonial. New entries append to the end of the order. */
export async function upsertTestimonial(
  input: UpsertTestimonialInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = upsertSchema.parse(input);

    // Prune per-locale overrides to known locales + translatable fields (the
    // customer's name is never translated); an empty result writes SQL NULL
    // so the column stays clean.
    const normalizedTranslations = normalizeTranslations(
      parsed.translations,
      TRANSLATABLE_FIELDS.testimonial,
    );
    const translationsWrite: Prisma.InputJsonValue | typeof Prisma.DbNull =
      normalizedTranslations === null
        ? Prisma.DbNull
        : (normalizedTranslations as Prisma.InputJsonValue);

    const data = {
      name: parsed.name,
      location: parsed.location || null,
      quote: parsed.quote,
      rating: parsed.rating,
      avatarUrl: parsed.avatarUrl || null,
      translations: translationsWrite,
    };

    let id: string;
    if (parsed.id) {
      const updated = await db.testimonial.update({
        where: { id: parsed.id },
        data,
      });
      id = updated.id;
    } else {
      // Append to the end of the current ordering.
      const maxOrder = await db.testimonial.aggregate({
        _max: { order: true },
      });
      const created = await db.testimonial.create({
        data: { ...data, order: (maxOrder._max.order ?? -1) + 1 },
      });
      id = created.id;
    }

    await logActivity({
      userId: session.user.id,
      action: parsed.id ? "update" : "create",
      entity: "Testimonial",
      entityId: id,
      meta: { name: parsed.name },
    });
    revalidatePath(STUDIO_PATH);
    revalidatePublic("testimonial");
    return { id };
  });
}

const deleteSchema = z.array(z.string().min(1)).min(1);

/** Bulk delete testimonials. */
export async function deleteTestimonials(
  input: string[],
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const ids = deleteSchema.parse(input);

    await db.testimonial.deleteMany({ where: { id: { in: ids } } });

    await logActivity({
      userId: session.user.id,
      action: ids.length > 1 ? "bulk-delete" : "delete",
      entity: "Testimonial",
      meta: { count: ids.length, ids },
    });
    revalidatePath(STUDIO_PATH);
    revalidatePublic("testimonial");
    return undefined;
  });
}

const reorderSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

/**
 * Swap a testimonial with its neighbour in display order. Works in index
 * space so duplicate `order` values are normalised as a side effect.
 */
export async function reorderTestimonial(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = reorderSchema.parse({ id, direction });

    const all = await db.testimonial.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, order: true },
    });
    const index = all.findIndex((t) => t.id === parsed.id);
    if (index === -1) throw new Error("Testimonial not found");

    const target = parsed.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= all.length) return undefined; // already at the edge

    [all[index], all[target]] = [all[target], all[index]];

    const writes = all.flatMap((t, i) =>
      t.order === i
        ? []
        : [db.testimonial.update({ where: { id: t.id }, data: { order: i } })],
    );
    if (writes.length > 0) await db.$transaction(writes);

    await logActivity({
      userId: session.user.id,
      action: "reorder",
      entity: "Testimonial",
      entityId: parsed.id,
      meta: { direction: parsed.direction },
    });
    revalidatePath(STUDIO_PATH);
    revalidatePublic("testimonial");
    return undefined;
  });
}
