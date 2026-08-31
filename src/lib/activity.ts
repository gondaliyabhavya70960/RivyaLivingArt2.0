import { db } from "@/lib/db";

/**
 * Fire-and-forget audit trail. Logging must never break the mutation it
 * describes.
 */
export async function logActivity(entry: {
  userId?: string | null;
  action: string; // e.g. "create", "update", "delete", "bulk-delete", "publish"
  entity: string; // e.g. "Product", "Category", "Media"
  entityId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        meta: (entry.meta ?? {}) as object,
      },
    });
  } catch (error) {
    console.error("ActivityLog write failed:", error);
  }
}
