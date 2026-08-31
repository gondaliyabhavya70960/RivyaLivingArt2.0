"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { Role } from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";

const STUDIO_PATH = "/studio/users";
const BCRYPT_ROUNDS = 12;

const roleSchema = z.enum(["ADMIN", "EDITOR"]);

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(320),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: roleSchema,
});

export type CreateUserInput = z.input<typeof createSchema>;

/** Create a staff account. Emails are stored lowercase and must be unique. */
export async function createUser(
  input: CreateUserInput,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const session = await requireStaff([Role.ADMIN]);
    const parsed = createSchema.parse(input);

    const existing = await db.user.findUnique({
      where: { email: parsed.email },
      select: { id: true },
    });
    if (existing) {
      return {
        refusal: "A user with that email already exists." as string | null,
        id: null as string | null,
      };
    }

    const hashedPassword = await hash(parsed.password, BCRYPT_ROUNDS);
    const created = await db.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        hashedPassword,
        role: parsed.role,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "User",
      entityId: created.id,
      meta: { email: parsed.email, role: parsed.role },
    });
    revalidatePath(STUDIO_PATH);
    return { refusal: null, id: created.id };
  });

  if (!result.ok) return result;
  if (result.data?.refusal) return { ok: false, error: result.data.refusal };
  if (!result.data?.id) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  return { ok: true, data: { id: result.data.id } };
}

const updateRoleSchema = z.object({
  id: z.string().min(1),
  role: roleSchema,
});

/**
 * Change a user's role. Refuses to demote the last remaining admin so the
 * studio can never be locked out of user management.
 */
export async function updateUserRole(
  id: string,
  role: Role,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const session = await requireStaff([Role.ADMIN]);
    const parsed = updateRoleSchema.parse({ id, role });

    const target = await db.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, email: true, role: true },
    });
    if (!target) return { refusal: "User not found." as string | null };
    if (target.role === parsed.role) return { refusal: null }; // no-op

    if (target.role === Role.ADMIN) {
      const adminCount = await db.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        return {
          refusal:
            "Cannot demote the last admin — promote someone else first.",
        };
      }
    }

    await db.user.update({
      where: { id: parsed.id },
      // Bump tokenVersion so the target's existing sessions pick up the new
      // role on their next action instead of running on the stale token (SEC-106).
      data: { role: parsed.role, tokenVersion: { increment: 1 } },
    });
    await logActivity({
      userId: session.user.id,
      action: "update-role",
      entity: "User",
      entityId: parsed.id,
      meta: { email: target.email, from: target.role, to: parsed.role },
    });
    revalidatePath(STUDIO_PATH);
    return { refusal: null };
  });

  if (!result.ok) return result;
  if (result.data?.refusal) return { ok: false, error: result.data.refusal };
  return { ok: true };
}

const resetPasswordSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

/** Set a new password for a user. The password itself is never logged. */
export async function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const session = await requireStaff([Role.ADMIN]);
    const parsed = resetPasswordSchema.parse({ id, password: newPassword });

    const target = await db.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, email: true },
    });
    if (!target) return { refusal: "User not found." as string | null };

    const hashedPassword = await hash(parsed.password, BCRYPT_ROUNDS);
    await db.user.update({
      where: { id: parsed.id },
      // Invalidate the target's outstanding sessions — an admin-forced reset
      // should log the (possibly compromised) session out immediately (SEC-106).
      data: { hashedPassword, tokenVersion: { increment: 1 } },
    });
    await logActivity({
      userId: session.user.id,
      action: "reset-password",
      entity: "User",
      entityId: parsed.id,
      meta: { email: target.email },
    });
    revalidatePath(STUDIO_PATH);
    return { refusal: null };
  });

  if (!result.ok) return result;
  if (result.data?.refusal) return { ok: false, error: result.data.refusal };
  return { ok: true };
}

const deleteSchema = z.array(z.string().min(1)).min(1);

/**
 * Bulk delete. Refuses to delete your own account and refuses any batch
 * that would leave the studio without a single admin.
 */
export async function deleteUsers(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  const result = await runAction(async () => {
    const session = await requireStaff([Role.ADMIN]);
    const parsed = deleteSchema.parse(ids);

    if (parsed.includes(session.user.id)) {
      return {
        refusal: "You cannot delete your own account." as string | null,
        deleted: 0,
      };
    }

    const [adminsInBatch, totalAdmins] = await Promise.all([
      db.user.count({ where: { id: { in: parsed }, role: Role.ADMIN } }),
      db.user.count({ where: { role: Role.ADMIN } }),
    ]);
    if (adminsInBatch > 0 && totalAdmins - adminsInBatch < 1) {
      return {
        refusal:
          "This would remove the last admin — promote someone else first.",
        deleted: 0,
      };
    }

    const { count } = await db.user.deleteMany({
      where: { id: { in: parsed } },
    });
    await logActivity({
      userId: session.user.id,
      action: parsed.length > 1 ? "bulk-delete" : "delete",
      entity: "User",
      meta: { count, ids: parsed },
    });
    revalidatePath(STUDIO_PATH);
    return { refusal: null, deleted: count };
  });

  if (!result.ok) return result;
  if (result.data?.refusal) return { ok: false, error: result.data.refusal };
  return { ok: true, data: { deleted: result.data?.deleted ?? 0 } };
}
