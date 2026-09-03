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
import { logActivity, snapshotBefore } from "@/lib/activity";
import { db } from "@/lib/db";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { normalizeTranslations, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { describeTestimonialProblem } from "@/lib/testimonials-rules";

const STUDIO_PATH = "/studio/testimonials";

const STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "VERIFIED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

const PERMISSIONS = ["UNKNOWN", "REQUESTED", "GRANTED", "DECLINED"] as const;

/** The fields `logActivity`'s `before` snapshot keeps — the ones an edit is
 *  most likely to silently change: who it's about, what it says, its
 *  editorial state and what it's linked to. */
const SNAPSHOT_FIELDS = [
  "name",
  "quote",
  "status",
  "featured",
  "productId",
  "portfolioId",
  "permissionStatus",
] as const;

/**
 * A URL field must be something the storefront can actually render: a
 * site-root path, or a host in `next.config.ts`'s `remotePatterns` (Vercel
 * Blob, Cloudinary, the owner's catalogue host). Applied to every URL column
 * this row carries — `avatarUrl`, `installationImageUrl`, `videoUrl`,
 * `videoPosterUrl` — the same check `site-images.ts`'s `urlSchema` runs,
 * because next/image (and, for the video columns, a raw `<video>` fetching
 * an origin the site's CSP does not allow) fails at REQUEST time on
 * anything else, and a hand-pasted URL from another site is the only way one
 * reaches here — an upload or a library pick always yields an accepted host.
 */
const urlFieldSchema = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .refine(
    (v) => !v || v.startsWith("/") || isOptimizableImageSrc(v),
    "Upload the file or pick it from the library — a URL from another site cannot be rendered.",
  );

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  location: z.string().trim().max(120).optional(),
  quote: z.string().trim().min(1, "Quote is required").max(2000),
  rating: z.number().int().min(1).max(5),
  avatarUrl: urlFieldSchema,
  translations: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),

  status: z.enum(STATUSES).default("DRAFT"),
  featured: z.boolean().default(false),
  designation: z.string().trim().max(160).optional(),
  category: z.string().trim().max(120).optional(),
  /** ISO date string, or null to clear. Omitted leaves it untouched on
   *  update and unset on create. */
  givenAt: z.string().trim().min(1).nullable().optional(),
  language: z.string().trim().max(20).optional(),
  productId: z.string().min(1).nullable().optional(),
  portfolioId: z.string().min(1).nullable().optional(),
  productTitle: z.string().trim().max(200).optional(),
  purchaseType: z.string().trim().max(60).optional(),
  mediaId: z.string().min(1).nullable().optional(),
  installationImageUrl: urlFieldSchema,
  installationMediaId: z.string().min(1).nullable().optional(),
  videoUrl: urlFieldSchema,
  videoPosterUrl: urlFieldSchema,
  internalNotes: z.string().trim().max(10_000).optional(),
  permissionStatus: z.enum(PERMISSIONS).default("UNKNOWN"),
});

export type UpsertTestimonialInput = z.input<typeof upsertSchema>;

/**
 * Create or update a testimonial. New entries append to the end of the
 * order.
 *
 * `describeTestimonialProblem` runs BEFORE the write and, when it returns a
 * reason, the row is never touched — the message comes straight back as the
 * action's error rather than a generic "something went wrong", so a refused
 * publish tells the owner exactly what to fix. See that function's own
 * JSDoc for the one case it deliberately does NOT catch: a back-filled live
 * testimonial nobody has opened since the guard shipped.
 */
export async function upsertTestimonial(
  input: UpsertTestimonialInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = upsertSchema.parse(input);

    const problem = describeTestimonialProblem({
      status: parsed.status,
      permissionStatus: parsed.permissionStatus,
      quote: parsed.quote,
      name: parsed.name,
    });
    if (problem) throw new Error(problem);

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

    const existing = parsed.id
      ? await db.testimonial.findUnique({
          where: { id: parsed.id },
          select: {
            name: true,
            quote: true,
            status: true,
            featured: true,
            productId: true,
            portfolioId: true,
            permissionStatus: true,
            verifiedAt: true,
          },
        })
      : null;
    if (parsed.id && !existing) throw new Error("Testimonial not found");

    // Set once, the first time a row enters VERIFIED — a later save (even one
    // that moves the row on to PUBLISHED or back to DRAFT) leaves the record
    // of who verified it, and when, untouched. Mirrors
    // `Product.confirmedAt`/`confirmedById`: an id rather than a relation, so
    // the record outlives the staff account.
    const enteringVerified =
      parsed.status === "VERIFIED" && !existing?.verifiedAt;

    const data = {
      name: parsed.name,
      location: parsed.location || null,
      quote: parsed.quote,
      rating: parsed.rating,
      avatarUrl: parsed.avatarUrl || null,
      translations: translationsWrite,
      status: parsed.status,
      featured: parsed.featured,
      designation: parsed.designation || null,
      category: parsed.category || null,
      givenAt:
        parsed.givenAt === undefined
          ? undefined
          : parsed.givenAt === null
            ? null
            : new Date(parsed.givenAt),
      language: parsed.language || null,
      productId: parsed.productId === undefined ? undefined : parsed.productId,
      portfolioId:
        parsed.portfolioId === undefined ? undefined : parsed.portfolioId,
      productTitle: parsed.productTitle || null,
      purchaseType: parsed.purchaseType || null,
      mediaId: parsed.mediaId === undefined ? undefined : parsed.mediaId,
      installationImageUrl: parsed.installationImageUrl || null,
      installationMediaId:
        parsed.installationMediaId === undefined
          ? undefined
          : parsed.installationMediaId,
      videoUrl: parsed.videoUrl || null,
      videoPosterUrl: parsed.videoPosterUrl || null,
      internalNotes: parsed.internalNotes || null,
      permissionStatus: parsed.permissionStatus,
      ...(enteringVerified
        ? { verifiedAt: new Date(), verifiedById: session.user.id }
        : {}),
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
      meta: {
        name: parsed.name,
        ...(existing
          ? { before: snapshotBefore(existing, SNAPSHOT_FIELDS) }
          : {}),
      },
    });
    revalidatePath(STUDIO_PATH);

    const productSlug = parsed.productId
      ? (
          await db.product.findUnique({
            where: { id: parsed.productId },
            select: { slug: true },
          })
        )?.slug
      : undefined;
    revalidatePublic("testimonial", productSlug);
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

const setStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  status: z.enum(STATUSES),
});

export type SetTestimonialStatusResult = {
  updated: number;
  /** Rows the guard refused, so a bulk "Publish" over a mixed selection
   *  reports what it skipped instead of silently dropping it. */
  refused: { id: string; name: string; reason: string }[];
};

/**
 * Bulk status change. Runs `describeTestimonialProblem` per row — a bulk
 * "Publish" over a mix of GRANTED and not-yet-GRANTED rows publishes only
 * the ones the guard allows — with the same ADMIN-or-EDITOR gate as
 * `upsertTestimonial`.
 */
export async function setTestimonialStatus(
  ids: string[],
  status: (typeof STATUSES)[number],
): Promise<ActionResult<SetTestimonialStatusResult>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = setStatusSchema.parse({ ids, status });

    const rows = await db.testimonial.findMany({
      where: { id: { in: parsed.ids } },
      select: {
        id: true,
        name: true,
        quote: true,
        permissionStatus: true,
        verifiedAt: true,
      },
    });

    const refused: SetTestimonialStatusResult["refused"] = [];
    const ready: typeof rows = [];
    for (const row of rows) {
      const problem = describeTestimonialProblem({
        status: parsed.status,
        permissionStatus: row.permissionStatus,
        quote: row.quote,
        name: row.name,
      });
      if (problem)
        refused.push({ id: row.id, name: row.name, reason: problem });
      else ready.push(row);
    }

    if (ready.length > 0) {
      const enteringVerified = parsed.status === "VERIFIED";
      await db.$transaction(
        ready.map((row) =>
          db.testimonial.update({
            where: { id: row.id },
            data: {
              status: parsed.status,
              ...(enteringVerified && !row.verifiedAt
                ? { verifiedAt: new Date(), verifiedById: session.user.id }
                : {}),
            },
          }),
        ),
      );

      await logActivity({
        userId: session.user.id,
        action: "bulk-status",
        entity: "Testimonial",
        meta: {
          count: ready.length,
          status: parsed.status,
          refused: refused.length,
        },
      });
      revalidatePath(STUDIO_PATH);
      revalidatePublic("testimonial");
    }

    return { updated: ready.length, refused };
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

const searchSchema = z.string().trim().min(1).max(120);

/**
 * Portfolio search for the form's "link a case study" picker — the twin of
 * `searchProductsForLink` (`src/actions/products.ts`): same shape, same
 * ten-row cap, so `testimonial-form.tsx` can use both pickers identically.
 */
export async function searchPortfolioForLink(
  q: string,
): Promise<ActionResult<{ id: string; title: string }[]>> {
  return runAction(async () => {
    await requireStaff();
    const query = searchSchema.parse(q);
    return db.portfolio.findMany({
      where: { title: { contains: query, mode: "insensitive" } },
      orderBy: [{ createdAt: "desc" }],
      take: 10,
      select: { id: true, title: true },
    });
  });
}
