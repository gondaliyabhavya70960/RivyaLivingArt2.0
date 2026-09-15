import { Controller, useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describedBy, FieldHint } from "@/components/studio/field-hint";
import { PRODUCT_LIMITS } from "@/lib/studio-limits";
import {
  SIZE_TIER_EXAMPLES,
  SIZE_TIER_OPTIONS,
} from "@/lib/product-size-tier";
import { FormSection, FieldError } from "./form-section";
import type { FormValues } from "./schema";

/** Title, tagline, description, category, status, product tier, featured. */
export function EssentialsSection({
  categories,
}: {
  categories: { id: string; name: string; slug: string }[];
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormValues>();

  return (
    <FormSection title="Essentials">
      <div className="space-y-1.5">
        <Label htmlFor="product-title">Title</Label>
        <Input
          id="product-title"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "product-title-error" : undefined}
          {...register("title")}
        />
        <FieldError id="product-title-error">
          {errors.title?.message}
        </FieldError>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-display-name">Display name</Label>
        <Input
          id="product-display-name"
          placeholder="Short editorial name for cards — blank derives one from the title"
          aria-invalid={!!errors.displayName}
          aria-describedby={describedBy(
            "product-display-name-hint",
            errors.displayName && "product-display-name-error",
          )}
          {...register("displayName")}
        />
        <FieldError id="product-display-name-error">
          {errors.displayName?.message}
        </FieldError>
        <FieldHint id="product-display-name-hint">
          Up to {PRODUCT_LIMITS.displayName} characters.
        </FieldHint>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-tagline">Short tagline</Label>
        <Input
          id="product-tagline"
          placeholder="One line under the title on the product page"
          aria-invalid={!!errors.shortTagline}
          aria-describedby={describedBy(
            errors.shortTagline && "product-tagline-error",
          )}
          {...register("shortTagline")}
        />
        <FieldError id="product-tagline-error">
          {errors.shortTagline?.message}
        </FieldError>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-description">Description</Label>
        <Textarea
          id="product-description"
          rows={8}
          {...register("description")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  ref={field.ref}
                  className="w-full"
                  aria-label="Category"
                  aria-invalid={!!errors.categoryId}
                  aria-describedby={
                    errors.categoryId ? "product-category-error" : undefined
                  }
                >
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError id="product-category-error">
            {errors.categoryId?.message}
          </FieldError>
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full" aria-label="Status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="REVIEW">Review</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Product tier</Label>
        <Controller
          control={control}
          name="sizeTier"
          render={({ field }) => (
            <>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  ref={field.ref}
                  className="w-full"
                  aria-label="Product tier"
                  aria-invalid={!!errors.sizeTier}
                  aria-describedby={describedBy(
                    "product-size-tier-hint",
                    errors.sizeTier && "product-size-tier-error",
                  )}
                >
                  <SelectValue placeholder="Pick a product tier" />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_TIER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="product-size-tier-error">
                {errors.sizeTier?.message}
              </FieldError>
              <FieldHint id="product-size-tier-hint">
                {field.value !== "none" && field.value in SIZE_TIER_EXAMPLES
                  ? SIZE_TIER_EXAMPLES[
                      field.value as keyof typeof SIZE_TIER_EXAMPLES
                    ]
                  : "Which of the three worlds this piece belongs to — it decides how the piece is presented, what is asked for on its page and where it is found. Required before publishing."}
              </FieldHint>
            </>
          )}
        />
      </div>

      <Controller
        control={control}
        name="featured"
        render={({ field }) => (
          <Label className="cursor-pointer font-normal">
            <Checkbox
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
            Featured — highlighted on the homepage and collection tops
          </Label>
        )}
      />
    </FormSection>
  );
}
