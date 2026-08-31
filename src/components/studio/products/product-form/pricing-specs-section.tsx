import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPriceBand } from "@/lib/utils";
import { FormSection, FieldError } from "./form-section";
import {
  DimensionsField,
  MaterialsField,
  TimelineField,
} from "./spec-fields";
import { TIER_OPTIONS, type FormValues } from "./schema";
import { useIsPrintProduct } from "./use-print-product";

/** Price band, show-price toggle + live preview, stock, tier and spec fields. */
export function PricingSpecsSection({
  categories,
}: {
  categories: { id: string; slug: string }[];
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormValues>();

  const priceMin = useWatch({ control, name: "priceMin" });
  const priceMax = useWatch({ control, name: "priceMax" });
  const showPrice = useWatch({ control, name: "showPrice" });
  const isPrint = useIsPrintProduct(categories);

  const pricePreview = showPrice
    ? formatPriceBand(
        priceMin === "" ? null : Number(priceMin),
        priceMax === "" ? null : Number(priceMax),
      )
    : "Enquire";

  return (
    <FormSection title="Pricing & specs">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="product-price-min">Price from (₹)</Label>
          <Input
            id="product-price-min"
            type="number"
            min={0}
            inputMode="numeric"
            aria-invalid={!!errors.priceMin}
            aria-describedby={
              errors.priceMin ? "product-price-min-error" : undefined
            }
            {...register("priceMin")}
          />
          <FieldError id="product-price-min-error">
            {errors.priceMin?.message}
          </FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-price-max">Price to (₹)</Label>
          <Input
            id="product-price-max"
            type="number"
            min={0}
            inputMode="numeric"
            aria-invalid={!!errors.priceMax}
            aria-describedby={
              errors.priceMax ? "product-price-max-error" : undefined
            }
            {...register("priceMax")}
          />
          <FieldError id="product-price-max-error">
            {errors.priceMax?.message}
          </FieldError>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Controller
          control={control}
          name="showPrice"
          render={({ field }) => (
            <Label className="cursor-pointer font-normal">
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              Show price on the public site
            </Label>
          )}
        />
        <p className="text-sm text-muted-foreground">
          Shown as:{" "}
          <span className="font-medium text-foreground">{pricePreview}</span>
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tier</Label>
          <Controller
            control={control}
            name="tier"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  ref={field.ref}
                  className="w-full"
                  aria-label="Tier"
                >
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Owner-sheet catalog tier. Tier 4 (or a 3D-print category) swaps in
            the 3D-printing section below.
          </p>
        </div>
        <div className="space-y-1.5 sm:pt-6">
          <Controller
            control={control}
            name="inStock"
            render={({ field }) => (
              <Label className="cursor-pointer font-normal">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                In stock
              </Label>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Out-of-stock products stay listed with an honest badge on the
            storefront.
          </p>
        </div>
      </div>

      {/* Print products (tier 4 or a print-group category) move these into
          the dedicated 3D-printing section below — each field is only ever
          mounted once (audit M-A3). */}
      {!isPrint && (
        <div className="grid gap-5 sm:grid-cols-3">
          <TimelineField />
          <MaterialsField />
          <DimensionsField />
        </div>
      )}
    </FormSection>
  );
}
