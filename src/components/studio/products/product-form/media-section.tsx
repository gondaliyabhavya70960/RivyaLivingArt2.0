import { useRef } from "react";
import { isOptimizableImageSrc } from "@/lib/image-src";
import Image from "next/image";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadMediaFiles } from "@/actions/media";
import { MediaPicker } from "@/components/studio/media/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "./form-section";
import { Model3dUrlField, VideoUrlField } from "./spec-fields";
import type { FormValues } from "./schema";

/** Gallery image upload/order/alt + video and 3D-model URLs. */
export function MediaSection({
  uploading,
  setUploading,
}: {
  uploading: boolean;
  setUploading: (value: boolean) => void;
}) {
  const { register, control } = useFormContext<FormValues>();
  const imagesArray = useFieldArray({ control, name: "images" });
  const watchedImages = useWatch({ control, name: "images" });
  const tier = useWatch({ control, name: "tier" });
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
      imagesArray.append({ url: media.url, alt: "" });
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
          onSelect={(item) => imagesArray.append({ url: item.url, alt: "" })}
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
                unoptimized={!isOptimizableImageSrc(watchedImages[index]?.url ?? item.url)}
                alt={watchedImages[index]?.alt ?? ""}
                width={320}
                height={320}
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              <Input
                aria-label={`Alt text for image ${index + 1}`}
                placeholder="Alt text"
                {...register(`images.${index}.alt`)}
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

      {/* Tier 4 moves these into the dedicated 3D-printing section —
          each field is only ever mounted once. */}
      {tier !== "4" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <VideoUrlField />
          <Model3dUrlField />
        </div>
      )}
    </FormSection>
  );
}
