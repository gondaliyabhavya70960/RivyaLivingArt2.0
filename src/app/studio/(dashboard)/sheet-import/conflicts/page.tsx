import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/studio/page-header";
import {
  ConflictList,
  type ConflictRow,
} from "@/components/studio/sheet-import/conflict-list";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Sheet conflicts" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Field-level conflicts a fill flagged instead of silently dropping: an
 * owner-edited product whose studio edit landed AFTER the last fill, on a
 * field the sheet has ALSO since changed (`tier-fill.ts`'s conflict
 * detection). Each row is one field, one product — resolved independently,
 * because "take sheet" on the price says nothing about the description.
 */
export default async function SheetConflictsPage() {
  const conflicts = await db.sheetConflict.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      product: { select: { id: true, title: true, slug: true } },
    },
  });

  const rows: ConflictRow[] = conflicts
    // A product deleted after the conflict was recorded (Cascade would have
    // removed the row too — this is defensive, not an expected path).
    .filter((c) => c.product !== null)
    .map((c) => ({
      id: c.id,
      productId: c.product!.id,
      productTitle: c.product!.title,
      productSlug: c.product!.slug,
      field: c.field,
      sheetValue: c.sheetValue,
      dbValue: c.dbValue,
      createdAt: dateFormatter.format(c.createdAt),
    }));

  return (
    <>
      <PageHeader
        title="Sheet conflicts"
        description="Fields where the sheet and a studio edit both changed the same product since the last fill. Nothing is overwritten until you say so, per field."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/studio/sheet-import">
              <ArrowLeft /> Sheet Import
            </Link>
          </Button>
        }
      />
      <ConflictList conflicts={rows} />
    </>
  );
}
