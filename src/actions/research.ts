"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";

const STUDIO_PATH = "/studio/research";

export const RESEARCH_STATUSES = [
  "RESEARCH",
  "SHORTLISTED",
  "DISCARDED",
] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];

// ————————————————————— Create / update —————————————————————

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  source: z.string().trim().min(1, "Source is required.").max(200),
  url: z.string().trim().max(2048).nullable(),
  title: z.string().trim().min(1, "Title is required.").max(300),
  category: z.string().trim().max(200).nullable(),
  materials: z.string().trim().max(300).nullable(),
  dimensions: z.string().trim().max(200).nullable(),
  price: z.string().trim().max(100).nullable(),
  images: z.array(z.string().trim().min(1)).max(20).default([]),
  description: z.string().trim().max(4000).nullable(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  notes: z.string().trim().max(4000).nullable(),
  /** ISO date the reference was found — optional, the owner's own record. */
  extractedAt: z.string().trim().max(40).nullable(),
  status: z.enum(RESEARCH_STATUSES).default("RESEARCH"),
});

export type UpsertResearchInput = z.input<typeof upsertSchema>;

/**
 * Create or update a research record. This is a hand-kept reference note —
 * "here's a piece I like the look of, worth adapting" — never a product:
 * `docs/scraper.md`'s pipeline (ScrapedProduct → review → catalog) is the
 * only path to a live listing, and nothing here writes to it.
 */
export async function upsertResearchRecord(
  input: UpsertResearchInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const p = upsertSchema.parse(input);

    let extractedAt: Date | null = null;
    if (p.extractedAt) {
      const parsed = new Date(p.extractedAt);
      if (!Number.isNaN(parsed.getTime())) extractedAt = parsed;
    }

    const data = {
      source: p.source,
      url: p.url || null,
      title: p.title,
      category: p.category || null,
      materials: p.materials || null,
      dimensions: p.dimensions || null,
      price: p.price || null,
      images: p.images as Prisma.InputJsonValue,
      description: p.description || null,
      tags: p.tags,
      notes: p.notes || null,
      status: p.status,
    };

    let id: string;
    if (p.id) {
      const updated = await db.researchRecord.update({
        where: { id: p.id },
        data: { ...data, ...(extractedAt ? { extractedAt } : {}) },
      });
      id = updated.id;
    } else {
      const created = await db.researchRecord.create({
        data: {
          ...data,
          extractedAt: extractedAt ?? new Date(),
          createdById: session.user.id,
        },
      });
      id = created.id;
    }

    await logActivity({
      userId: session.user.id,
      action: p.id ? "update" : "create",
      entity: "ResearchRecord",
      entityId: id,
      meta: { title: p.title },
    });
    revalidatePath(STUDIO_PATH);
    return { id };
  });
}

// ————————————————————— Bulk status —————————————————————

const statusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one item."),
  status: z.enum(RESEARCH_STATUSES),
});

export async function setResearchStatus(
  ids: string[],
  status: ResearchStatus,
): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = statusSchema.parse({ ids, status });

    const res = await db.researchRecord.updateMany({
      where: { id: { in: parsed.ids } },
      data: { status: parsed.status },
    });

    await logActivity({
      userId: session.user.id,
      action: "status",
      entity: "ResearchRecord",
      meta: { status: parsed.status, count: res.count },
    });
    revalidatePath(STUDIO_PATH);
    return { updated: res.count };
  });
}

// ————————————————————— Delete —————————————————————

const deleteSchema = z.array(z.string().min(1)).min(1);

export async function deleteResearchRecords(
  ids: string[],
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = deleteSchema.parse(ids);

    await db.researchRecord.deleteMany({ where: { id: { in: parsed } } });

    await logActivity({
      userId: session.user.id,
      action: parsed.length > 1 ? "bulk-delete" : "delete",
      entity: "ResearchRecord",
      meta: { count: parsed.length, ids: parsed },
    });
    revalidatePath(STUDIO_PATH);
    return undefined;
  });
}
