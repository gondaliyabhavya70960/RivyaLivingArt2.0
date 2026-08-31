import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "./form-section";
import type { FormValues } from "./schema";

/**
 * Spec and media-URL fields shared between their home sections and the tier-4
 * "3D printing" section. Each field registers exactly once: the sections swap
 * on the tier value, so only one instance of a field is ever mounted.
 */

export function TimelineField({ hint }: { hint?: string }) {
  const { register } = useFormContext<FormValues>();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="product-timeline">Timeline</Label>
      <Input
        id="product-timeline"
        placeholder="e.g. 2–3 weeks"
        {...register("timeline")}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function MaterialsField({
  hint,
  placeholder = "e.g. Epoxy resin, dried florals",
}: {
  hint?: string;
  placeholder?: string;
}) {
  const { register } = useFormContext<FormValues>();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="product-materials">Materials</Label>
      <Input
        id="product-materials"
        placeholder={placeholder}
        {...register("materials")}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DimensionsField({
  label = "Dimensions",
  placeholder = 'e.g. 12" × 12"',
  hint,
}: {
  label?: string;
  placeholder?: string;
  hint?: string;
}) {
  const { register } = useFormContext<FormValues>();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="product-dimensions">{label}</Label>
      <Input
        id="product-dimensions"
        placeholder={placeholder}
        {...register("dimensions")}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function VideoUrlField({
  hint = "A short making-of or showcase clip, shown in the gallery.",
}: {
  hint?: string;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormValues>();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="product-video">Video URL</Label>
      <Input
        id="product-video"
        placeholder="https://…"
        aria-invalid={!!errors.videoUrl}
        aria-describedby={errors.videoUrl ? "product-video-error" : undefined}
        {...register("videoUrl")}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
      <FieldError id="product-video-error">{errors.videoUrl?.message}</FieldError>
    </div>
  );
}

export function Model3dUrlField({
  hint = "Optional AR preview model for supported devices.",
}: {
  hint?: string;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormValues>();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="product-model3d">3D model URL</Label>
      <Input
        id="product-model3d"
        placeholder="https://… (.glb / .usdz)"
        aria-invalid={!!errors.model3dUrl}
        aria-describedby={
          errors.model3dUrl ? "product-model3d-error" : undefined
        }
        {...register("model3dUrl")}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
      <FieldError id="product-model3d-error">
        {errors.model3dUrl?.message}
      </FieldError>
    </div>
  );
}
