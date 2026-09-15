"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/actions/helpers";
import { mirrorCatalogImagesBatch } from "@/lib/catalog-mirror";

/**
 * "Mirror next batch" button on /studio/catalog-fill (audit C3 / M-A5): the
 * on-demand twin of the nightly /api/cron/mirror-images run. Same
 * requireStaff guard as the page itself; the batch writes its own
 * "catalog-mirror" ActivityLog row, so after revalidation the page's
 * External imagery card shows the fresh counts.
 */
export async function mirrorNextCatalogBatch(): Promise<void> {
  await requireStaff();
  await mirrorCatalogImagesBatch(200);
  revalidatePath("/studio/catalog-fill");
}
