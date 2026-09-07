import { useFormContext, useWatch } from "react-hook-form";
import { SerpPreview } from "@/components/studio/seo/serp-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { describedBy, FieldHint } from "@/components/studio/field-hint";
import { PRODUCT_LIMITS } from "@/lib/studio-limits";
import { FormSection, FieldError } from "./form-section";
import type { FormValues } from "./schema";

/** SEO title/description and OG image override. */
export function SeoSection({ slug }: { slug?: string }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormValues>();

  /* The PDP falls back before it renders — `product/[slug]/page.tsx:189-196`
     is `seoTitle || title` and `seoDescription || shortTagline || body`. So the
     preview has to show the EFFECTIVE result, not the raw override: previewing
     the empty field alone would report "no title" for a page that is perfectly
     fine, and would hide the case that actually matters — a product whose own
     title is already too long once the brand suffix lands. */
  const seoTitle = useWatch({ control, name: "seoTitle" });
  const seoDescription = useWatch({ control, name: "seoDescription" });
  const productTitle = useWatch({ control, name: "title" });
  const shortTagline = useWatch({ control, name: "shortTagline" });

  return (
    <FormSection title="SEO">
      <div className="space-y-1.5">
        <Label htmlFor="product-seo-title">SEO title</Label>
        <Input
          id="product-seo-title"
          aria-invalid={!!errors.seoTitle}
          aria-describedby={describedBy(
            "product-seo-title-hint",
            errors.seoTitle && "product-seo-title-error",
          )}
          {...register("seoTitle")}
        />
        <FieldError id="product-seo-title-error">
          {errors.seoTitle?.message}
        </FieldError>
        {/* Two numbers live under this field: the cap the action refuses at,
            and the ~60 the preview below counts against. One sentence, so a
            "300" beside a "60" does not read as a contradiction. */}
        <FieldHint id="product-seo-title-hint">
          Up to {PRODUCT_LIMITS.seoTitle} characters; search results show about
          60.
        </FieldHint>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="product-seo-description">SEO description</Label>
        <Textarea
          id="product-seo-description"
          rows={3}
          aria-invalid={!!errors.seoDescription}
          aria-describedby={describedBy(
            "product-seo-description-hint",
            errors.seoDescription && "product-seo-description-error",
          )}
          {...register("seoDescription")}
        />
        <FieldError id="product-seo-description-error">
          {errors.seoDescription?.message}
        </FieldError>
        <FieldHint id="product-seo-description-hint">
          Up to {PRODUCT_LIMITS.seoDescription} characters; search results show
          about 160.
        </FieldHint>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="product-og-image">OG image URL</Label>
        <Input
          id="product-og-image"
          placeholder="https://…"
          aria-invalid={!!errors.ogImage}
          aria-describedby={errors.ogImage ? "product-og-image-error" : undefined}
          {...register("ogImage")}
        />
        <FieldError id="product-og-image-error">
          {errors.ogImage?.message}
        </FieldError>
      </div>
      <SerpPreview
        title={seoTitle?.trim() || productTitle || ""}
        description={seoDescription?.trim() || shortTagline?.trim() || ""}
        path={slug ? `/product/${slug}` : "/product/…"}
      />
    </FormSection>
  );
}
