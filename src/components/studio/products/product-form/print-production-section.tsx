import { useFormContext } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormSection } from "./form-section";
import {
  DimensionsField,
  MaterialsField,
  Model3dUrlField,
  TimelineField,
  VideoUrlField,
} from "./spec-fields";
import type { FormValues } from "./schema";
import { useIsPrintProduct } from "./use-print-product";

/**
 * Print-flavored grouping of the existing spec fields (audit M-A3). Renders
 * while the product belongs to the 3D-print ecosystem — import list 4 OR a category
 * in the "print" catalog group; the same fields hide in Pricing & specs /
 * Care notes / Media meanwhile, so each registers exactly once. Uses only
 * existing Product columns: materials (filament), dimensions (size + pack),
 * timeline (print/production time), careNotes (print notes).
 */
export function PrintProductionSection({
  categories,
}: {
  categories: { id: string; slug: string }[];
}) {
  const { register } = useFormContext<FormValues>();
  const isPrint = useIsPrintProduct(categories);
  if (!isPrint) return null;

  return (
    <FormSection
      title="3D printing"
      description="Production details for printed products."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <MaterialsField
          hint="Filament / resin, e.g. PLA, PETG, TPU."
          placeholder="e.g. PLA, PETG, TPU"
        />
        <DimensionsField
          label="Dimensions / pack size"
          placeholder="e.g. 200 × 200 mm · pack of 10"
          hint="Physical size and pack count, shown in the spec sheet."
        />
        <TimelineField hint="Print + production time." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="product-care-notes">Print notes</Label>
        <Textarea
          id="product-care-notes"
          rows={4}
          placeholder="Layer height, infill, tolerances, post-processing, compatibility…"
          {...register("careNotes")}
        />
        <p className="text-xs text-muted-foreground">
          Shown where resin products show care notes. Leave empty to fall back
          to the site-wide default.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Model3dUrlField hint="GLB/GLTF shown in the 3D viewer on the product page; STL/OBJ source files belong in Media." />
        <VideoUrlField />
      </div>
    </FormSection>
  );
}
