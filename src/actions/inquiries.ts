"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { type InquiryStatus, Role } from "@/generated/prisma/enums";

const STUDIO_PATH = "/studio/inquiries";

// Inquiries are created by the public site only — the studio can just
// move them through the status workflow or delete them.

const idsSchema = z
  .array(z.string().min(1))
  .min(1, "Select at least one inquiry.");

const statusSchema = z.enum([
  "NEW",
  "CONTACTED",
  "DISCUSSION",
  "QUOTED",
  "CONFIRMED",
  "IN_PRODUCTION",
  "DELIVERED",
  "CLOSED",
  "LOST",
]);

// C1: prices are settled manually in WhatsApp — these fields only RECORD that
// conversation. Rupee integers; 1 crore cap catches fat-fingered entries.
const priceSchema = z
  .number()
  .int("Enter whole rupees.")
  .min(0)
  .max(10_000_000)
  .nullable()
  .optional();

const pricingSchema = z.object({
  quotedPrice: priceSchema,
  finalPrice: priceSchema,
  staffNotes: z.string().max(5000).nullable().optional(),
});

export async function setInquiriesStatus(
  ids: string[],
  status: InquiryStatus,
): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = z
      .object({ ids: idsSchema, status: statusSchema })
      .parse({ ids, status });

    const { count: updated } = await db.inquiry.updateMany({
      where: { id: { in: parsed.ids } },
      data: { status: parsed.status },
    });

    await logActivity({
      userId: session.user.id,
      action: "status-change",
      entity: "Inquiry",
      entityId: parsed.ids.length === 1 ? parsed.ids[0] : null,
      meta: { count: updated, status: parsed.status },
    });

    revalidatePath(STUDIO_PATH);
    for (const id of parsed.ids) revalidatePath(`${STUDIO_PATH}/${id}`);
    return { updated };
  });
}

export async function updateInquiryPricing(
  id: string,
  input: {
    quotedPrice?: number | null;
    finalPrice?: number | null;
    staffNotes?: string | null;
  },
): Promise<ActionResult> {
  return runAction<undefined>(async () => {
    // Pricing is part of working an inquiry — EDITOR-able like status changes.
    const session = await requireStaff();
    const parsedId = z.string().min(1).parse(id);
    const parsed = pricingSchema.parse(input);

    // Only touch fields the caller sent: null clears, undefined leaves as-is.
    const data: {
      quotedPrice?: number | null;
      finalPrice?: number | null;
      staffNotes?: string | null;
    } = {};
    if (parsed.quotedPrice !== undefined) data.quotedPrice = parsed.quotedPrice;
    if (parsed.finalPrice !== undefined) data.finalPrice = parsed.finalPrice;
    if (parsed.staffNotes !== undefined) {
      data.staffNotes = parsed.staffNotes?.trim() || null;
    }

    await db.inquiry.update({ where: { id: parsedId }, data });

    await logActivity({
      userId: session.user.id,
      action: "pricing-update",
      entity: "Inquiry",
      entityId: parsedId,
      // Prices are audit-worthy; the notes body is not — just note it changed.
      meta: {
        fields: Object.keys(data),
        ...(parsed.quotedPrice !== undefined
          ? { quotedPrice: parsed.quotedPrice }
          : {}),
        ...(parsed.finalPrice !== undefined
          ? { finalPrice: parsed.finalPrice }
          : {}),
      },
    });

    revalidatePath(STUDIO_PATH);
    revalidatePath(`${STUDIO_PATH}/${parsedId}`);
    return undefined;
  });
}

export async function deleteInquiries(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  return runAction(async () => {
    // Irreversible customer-PII loss — ADMIN only, so a lower-trust EDITOR
    // can't wipe the lead history (SEC-109). Status updates stay EDITOR-able.
    const session = await requireStaff([Role.ADMIN]);
    const parsed = idsSchema.parse(ids);

    const { count: deleted } = await db.inquiry.deleteMany({
      where: { id: { in: parsed } },
    });

    await logActivity({
      userId: session.user.id,
      action: parsed.length > 1 ? "bulk-delete" : "delete",
      entity: "Inquiry",
      entityId: parsed.length === 1 ? parsed[0] : null,
      meta: { count: deleted, ids: parsed },
    });

    revalidatePath(STUDIO_PATH);
    return { deleted };
  });
}
