import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";

/**
 * First-touch attribution (MKT-201) — an allow-listed, length-bounded set of
 * marketing params captured client-side (src/lib/attribution.ts). Anything
 * else is dropped so a public payload can't stuff arbitrary data into the
 * Inquiry Json column. Shared by the order actions AND submitContactInquiry
 * (Part 0 audit S-05) — it lives outside the "use server" modules because
 * action modules may only export async functions.
 */
export const attributionSchema = z
  .object({
    utm_source: z.string().max(200).optional(),
    utm_medium: z.string().max(200).optional(),
    utm_campaign: z.string().max(200).optional(),
    utm_term: z.string().max(200).optional(),
    utm_content: z.string().max(200).optional(),
    referrer: z.string().max(300).optional(),
    landing: z.string().max(200).optional(),
  })
  .optional();

/** Attribution → Prisma Json, or undefined (omit the column) when empty. */
export function attributionJson(
  attr: z.infer<typeof attributionSchema>,
): Prisma.InputJsonValue | undefined {
  if (!attr || Object.keys(attr).length === 0) return undefined;
  return attr as Prisma.InputJsonValue;
}
