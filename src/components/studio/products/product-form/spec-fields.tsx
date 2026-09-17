import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaPicker } from "@/components/studio/media/media-picker";
import { describedBy } from "@/components/studio/field-hint";
import { FieldError } from "./form-section";
import type { FormValues } from "./schema";

/**
 * Spec and media-URL fields shared between their home sections and the
 * "3D printing" section. Each field registers exactly once: the sections swap
 * on the print predicate (import list 4, or a print-group category — see
 * `useIsPrintProduct`), so only one instance of a field is ever mounted.
 */

export function TimelineField({ hint }: { hint?: string }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormValues>();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="product-timeline">Timeline</Label>
      <Input
        id="product-timeline"
        placeholder="e.g. 2–3 weeks"
        aria-invalid={!!errors.timeline}
        aria-describedby={describedBy(
          hint && "product-timeline-hint",
          errors.timeline && "product-timeline-error",
        )}
        {...register("timeline")}
      />
      <FieldError id="product-timeline-error">
        {errors.timeline?.message}
      </FieldError>
      {hint && (
        <p id="product-timeline-hint" className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
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
  const {
    register,
    formState: { errors },
  } = useFormContext<FormValues>();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="product-materials">Materials</Label>
      <Input
        id="product-materials"
        placeholder={placeholder}
        aria-invalid={!!errors.materials}
        aria-describedby={describedBy(
          hint && "product-materials-hint",
          errors.materials && "product-materials-error",
        )}
        {...register("materials")}
      />
      <FieldError id="product-materials-error">
        {errors.materials?.message}
      </FieldError>
      {hint && (
        <p
          id="product-materials-hint"
          className="text-xs text-muted-foreground"
        >
          {hint}
        </p>
      )}
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
  const {
    register,
    formState: { errors },
  } = useFormContext<FormValues>();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="product-dimensions">{label}</Label>
      <Input
        id="product-dimensions"
        placeholder={placeholder}
        aria-invalid={!!errors.dimensions}
        aria-describedby={describedBy(
          hint && "product-dimensions-hint",
          errors.dimensions && "product-dimensions-error",
        )}
        {...register("dimensions")}
      />
      <FieldError id="product-dimensions-error">
        {errors.dimensions?.message}
      </FieldError>
      {hint && (
        <p
          id="product-dimensions-hint"
          className="text-xs text-muted-foreground"
        >
          {hint}
        </p>
      )}
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
    setValue,
    formState: { errors },
  } = useFormContext<FormValues>();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="product-video">Video URL</Label>
      {/* A film from the media library, or a pasted address — the pair the
          testimonial form and the film blocks already carry. The picker lists
          videos only and writes through setValue, so the form goes dirty and
          the unsaved-changes guard knows. */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="product-video"
          className="min-w-56 flex-1"
          placeholder="Choose from the library, or paste a full https:// address"
          aria-invalid={!!errors.videoUrl}
          aria-describedby={errors.videoUrl ? "product-video-error" : undefined}
          {...register("videoUrl")}
        />
        <MediaPicker
          accept="VIDEO"
          defaultFolder="products"
          onSelect={(item) =>
            setValue("videoUrl", item.url, { shouldDirty: true })
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <FieldError id="product-video-error">
        {errors.videoUrl?.message}
      </FieldError>
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
