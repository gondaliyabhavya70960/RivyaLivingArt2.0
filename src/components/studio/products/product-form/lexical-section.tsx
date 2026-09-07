"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/studio/field-error";
import { describedBy } from "@/components/studio/field-hint";
import { FormSection } from "@/components/studio/form-section";
import { groupForTier } from "@/lib/catalog-taxonomy";

import type { FormValues } from "./schema";

/**
 * Aesop-style lexical rows (product-ux benchmark gap 4): fixed labeled
 * fields ("Suited to / Feels like / Pour story") that scale a literary voice
 * across thousands of SKUs. Owner-authored label + value pairs, rendered
 * into the PDP spec sheet. The suggestion chips follow the piece's ecosystem
 * (from the tier select) — the benchmark's per-ecosystem vocabulary.
 */
const SUGGESTED_LABELS = {
  art: ["Suited to", "Feels like", "Pour story", "Pigments"],
  supplies: ["Use for", "Grade", "Coverage"],
  print: ["Material", "Layer height", "Tolerance"],
} as const;

export function LexicalSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<FormValues>();
  const rows = useFieldArray({ control, name: "lexical" });
  const tier = useWatch({ control, name: "tier" });
  const lexicalValues = useWatch({ control, name: "lexical" }) ?? [];
  const group = groupForTier(tier === "none" ? null : Number(tier));
  const suggestions = SUGGESTED_LABELS[group].filter(
    (label) => !lexicalValues.some((row) => row?.label === label),
  );

  return (
    <FormSection title="Lexical fields">
      <p className="text-sm text-muted-foreground">
        Labeled voice lines shown in the product page&apos;s specification sheet
        — &ldquo;Suited to&rdquo;, &ldquo;Pour story&rdquo;. Leave empty for
        terse data-driven pieces.
      </p>

      {rows.fields.map((field, index) => (
        <div key={field.id} className="flex flex-wrap items-start gap-2">
          <Input
            id={`product-lexical-label-${index}`}
            placeholder="Label"
            aria-label={`Lexical label ${index + 1}`}
            className="w-40 shrink-0"
            aria-invalid={!!errors.lexical?.[index]?.label}
            aria-describedby={describedBy(
              errors.lexical?.[index]?.label &&
                `product-lexical-label-${index}-error`,
            )}
            {...register(`lexical.${index}.label`)}
          />
          <Input
            id={`product-lexical-value-${index}`}
            placeholder="Value"
            aria-label={`Lexical value ${index + 1}`}
            aria-invalid={!!errors.lexical?.[index]?.value}
            aria-describedby={describedBy(
              errors.lexical?.[index]?.value &&
                `product-lexical-value-${index}-error`,
            )}
            {...register(`lexical.${index}.value`)}
          />
          <div className="w-full">
            <FieldError id={`product-lexical-label-${index}-error`}>
              {errors.lexical?.[index]?.label?.message}
            </FieldError>
            <FieldError id={`product-lexical-value-${index}-error`}>
              {errors.lexical?.[index]?.value?.message}
            </FieldError>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 shrink-0"
            aria-label={`Remove lexical row ${index + 1}`}
            onClick={() => rows.remove(index)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => rows.append({ label: "", value: "" })}
        >
          <Plus /> Add row
        </Button>
        {suggestions.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => rows.append({ label, value: "" })}
            className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            + {label}
          </button>
        ))}
      </div>
      {/* The Add row button and the suggestion chips keep working past the
          cap, so the array-level refusal can only be reported here. */}
      <FieldError id="product-lexical-error">
        {errors.lexical?.root?.message ?? errors.lexical?.message}
      </FieldError>
    </FormSection>
  );
}
