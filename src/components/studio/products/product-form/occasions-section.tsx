import { useFormContext, useWatch } from "react-hook-form";
import {
  OCCASIONS,
  type Occasion,
} from "@/components/studio/products/occasions";
import { FormSection } from "./form-section";
import type { FormValues } from "./schema";
import { useIsPrintProduct } from "./use-print-product";

/**
 * Occasion tag chips — used for filtering on the public site. The chip set is
 * resin-gift vocabulary (Wedding, Diwali, …), so print products hide this
 * section (audit M-A3) — the 3D-printing section carries their specs instead.
 * Stored occasion values are left untouched (the chips only edit form state).
 */
export function OccasionsSection({
  categories,
}: {
  categories: { id: string; slug: string }[];
}) {
  const { control, setValue } = useFormContext<FormValues>();
  const occasions = useWatch({ control, name: "occasions" });
  const isPrint = useIsPrintProduct(categories);
  if (isPrint) return null;

  function toggleOccasion(occasion: Occasion) {
    setValue(
      "occasions",
      occasions.includes(occasion)
        ? occasions.filter((o) => o !== occasion)
        : [...occasions, occasion],
      { shouldDirty: true },
    );
  }

  return (
    <FormSection
      title="Occasions"
      description="Tag the occasions this piece suits — used for filtering on the public site."
    >
      <div className="flex flex-wrap gap-2">
        {OCCASIONS.map((occasion) => {
          const active = occasions.includes(occasion);
          return (
            <button
              key={occasion}
              type="button"
              onClick={() => toggleOccasion(occasion)}
              aria-pressed={active}
              className={
                active
                  ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors"
                  : "rounded-full border border-foreground/15 px-4 py-1.5 text-sm text-foreground/70 transition-colors hover:border-sapphire-ink/40 hover:text-sapphire-ink"
              }
            >
              {occasion}
            </button>
          );
        })}
      </div>
    </FormSection>
  );
}
