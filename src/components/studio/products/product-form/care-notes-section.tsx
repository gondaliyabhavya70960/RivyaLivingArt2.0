import { useFormContext } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "./form-section";
import type { FormValues } from "./schema";
import { useIsPrintProduct } from "./use-print-product";

/**
 * Per-product care notes; falls back to the site-wide default when empty.
 * Print products register the same field as "Print notes" inside the
 * 3D-printing section instead (audit M-A3) — only one instance ever mounts.
 */
export function CareNotesSection({
  categories,
}: {
  categories: { id: string; slug: string }[];
}) {
  const { register } = useFormContext<FormValues>();
  const isPrint = useIsPrintProduct(categories);
  if (isPrint) return null;

  return (
    <FormSection title="Care notes">
      <div className="space-y-1.5">
        <Textarea aria-label="Care notes" rows={4} {...register("careNotes")} />
        <p className="text-xs text-muted-foreground">
          Leave empty to fall back to the site-wide default care notes.
        </p>
      </div>
    </FormSection>
  );
}
