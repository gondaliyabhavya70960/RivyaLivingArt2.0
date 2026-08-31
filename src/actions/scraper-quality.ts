"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";

const STUDIO_PATH = "/studio/scraper/quality";

const resolveSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(2000).optional(),
  /** Close an entire root cause at once: every OPEN row for one field. */
  field: z.string().min(1).max(64).optional(),
  sourceKey: z.string().min(1).max(128).optional(),
  status: z.enum(["RESOLVED", "IGNORED", "REVIEWING", "OPEN"]),
});

export type TriageReport = { updated: number };

/**
 * Resolve, ignore or reopen validation failures.
 *
 * Takes either explicit ids or a (field, source) pair, because the two ways
 * an operator actually works are "this one row" and "every row failing for
 * this reason" — a backlog of thousands is almost always a handful of root
 * causes, and clicking them one at a time is not triage.
 */
export async function setFailureStatus(
  input: z.input<typeof resolveSchema>,
): Promise<ActionResult<TriageReport>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = resolveSchema.parse(input);
    if (!parsed.ids && !parsed.field) {
      throw new Error("Pick rows, or a field to resolve in bulk.");
    }

    const res = await db.validationFailure.updateMany({
      where: parsed.ids
        ? { id: { in: parsed.ids } }
        : {
            field: parsed.field,
            ...(parsed.sourceKey ? { sourceKey: parsed.sourceKey } : {}),
            // A bulk action never reaches rows somebody already decided about.
            status: { in: ["OPEN", "REVIEWING"] },
          },
      data: {
        status: parsed.status,
        ...(parsed.status === "RESOLVED" || parsed.status === "IGNORED"
          ? { resolvedAt: new Date(), resolvedById: session.user.id }
          : { resolvedAt: null, resolvedById: null }),
      },
    });

    await logActivity({
      userId: session.user.id,
      action: `quality-${parsed.status.toLowerCase()}`,
      entity: "ValidationFailure",
      meta: {
        count: res.count,
        ...(parsed.field ? { field: parsed.field } : {}),
        ...(parsed.sourceKey ? { sourceKey: parsed.sourceKey } : {}),
      },
    });
    revalidatePath(STUDIO_PATH);
    return { updated: res.count };
  });
}
