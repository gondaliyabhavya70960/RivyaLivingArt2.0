import { useRef } from "react";
import { isOptimizableImageSrc } from "@/lib/image-src";
import Image from "next/image";
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadMediaFiles } from "@/actions/media";
import { MediaPicker } from "@/components/studio/media/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describedBy } from "@/components/studio/field-hint";
import { FieldError, FormSection } from "./form-section";
import { Model3dUrlField, VideoUrlField } from "./spec-fields";
import { IMAGE_ROLE_OPTIONS, type FormValues } from "./schema";
import { useIsPrintProduct } from "./use-print-product";

/** Gallery image upload/order/alt + video and 3D-model URLs. */
export function MediaSection({
  categories,
  uploading,
  setUploading,
}: {
  categories: { id: string; slug: string }[];
  uploading: boolean;
  setUploading: (value: boolean) => void;
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormValues>();
  const imagesArray = useFieldArray({ control, name: "images" });
  const watchedImages = useWatch({ control, name: "images" });
  const isPrint = useIsPrintProduct(categories);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (const file of list) formData.append("files", file);
    formData.append("folder", "products");

    const result = await uploadMediaFiles(formData);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const uploaded = result.data ?? [];
    for (const media of uploaded) {
      imagesArray.append({ url: media.url, alt: "", role: "none" });
    }
    toast.success(
      `Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}.`,
    );
  }

  return (
    <FormSection
      title="Media"
      description="The first image is the cover. Drag order with the arrows."
    >
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus /> {uploading ? "Uploading…" : "Upload images"}
        </Button>
        <MediaPicker
          defaultFolder="products"
          onSelect={(item) =>
            imagesArray.append({ url: item.url, alt: "", role: "none" })
          }
        />
      </div>

      {imagesArray.fields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {imagesArray.fields.map((item, index) => (
            <div
              key={item.id}
              className="space-y-2 rounded-card border border-border p-3"
            >
              <Image
                src={watchedImages[index]?.url ?? item.url}
                unoptimized={
                  !isOptimizableImageSrc(watchedImages[index]?.url ?? item.url)
                }
                alt={watchedImages[index]?.alt ?? ""}
                width={320}
                height={320}
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              <Input
                id={`product-image-alt-${index}`}
                aria-label={`Alt text for image ${index + 1}`}
                placeholder="Alt text"
                aria-invalid={!!errors.images?.[index]?.alt}
                aria-describedby={describedBy(
                  errors.images?.[index]?.alt &&
                    `product-image-alt-${index}-error`,
                )}
                {...register(`images.${index}.alt`)}
              />
              <FieldError id={`product-image-alt-${index}-error`}>
                {errors.images?.[index]?.alt?.message}
              </FieldError>
              <Controller
                control={control}
                name={`images.${index}.role`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      className="w-full"
                      aria-label={`Role for image ${index + 1}`}
                    >
                      <SelectValue placeholder="No role" />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Move image up"
                    disabled={index === 0}
                    onClick={() => imagesArray.move(index, index - 1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Move image down"
                    disabled={index === imagesArray.fields.length - 1}
                    onClick={() => imagesArray.move(index, index + 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove image"
                  onClick={() => imagesArray.remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* A print product carries these in its dedicated 3D-printing section
          instead, so each field is mounted once. The SAME predicate as that
          section — import list 4 OR a print-group category — because gating on the
          tier alone mounted both copies for a print product filed without
          the tier: two inputs with one id, and a label pointing at the
          wrong one. */}
      {!isPrint && (
        <div className="grid gap-5 sm:grid-cols-2">
          <VideoUrlField />
          <Model3dUrlField />
        </div>
      )}
    </FormSection>
  );
}
