import { useFormContext, useWatch } from "react-hook-form";
import { groupForCategorySlug } from "@/lib/catalog-taxonomy";
import type { FormValues } from "./schema";

/**
 * True while the product being edited belongs to the 3D-print ecosystem:
 * tier is 4 OR the selected category maps to the "print" catalog group
 * (audit M-A3 — a print product filed without a tier, or a studio-made print
 * item, must still get the print-flavored editor instead of resin copy).
 * Sections watch this to swap resin placeholders/chips for print fields.
 */
export function useIsPrintProduct(
  categories: { id: string; slug: string }[],
): boolean {
  const { control } = useFormContext<FormValues>();
  const tier = useWatch({ control, name: "tier" });
  const categoryId = useWatch({ control, name: "categoryId" });

  if (tier === "4") return true;
  const slug = categories.find((c) => c.id === categoryId)?.slug;
  return slug ? groupForCategorySlug(slug) === "print" : false;
}
