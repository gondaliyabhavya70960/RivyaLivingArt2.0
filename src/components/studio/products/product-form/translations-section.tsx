import { Controller, useFormContext, useWatch } from "react-hook-form";

import {
  TranslationsSection,
  type TranslatableFieldDef,
} from "@/components/studio/translations-section";
import type { FormValues } from "./schema";

/**
 * Per-language overrides for the product's prose. English lives in the fields
 * above; here the owner translates title / tagline / description / care notes /
 * SEO / the spec sheet's voice lines per language. Bound to the form's `translations` value via a Controller;
 * the current English values are surfaced as reference.
 */
export function ProductTranslationsSection() {
  const { control } = useFormContext<FormValues>();
  const [
    title,
    displayName,
    shortTagline,
    description,
    careNotes,
    seoTitle,
    seoDescription,
    lexical,
  ] = useWatch({
      control,
      name: [
        "title",
        "displayName",
        "shortTagline",
        "description",
        "careNotes",
        "seoTitle",
        "seoDescription",
        "lexical",
      ],
    });

  const fields: TranslatableFieldDef[] = [
    { name: "title", label: "Title", kind: "text", base: title },
    { name: "displayName", label: "Display name", kind: "text", base: displayName },
    { name: "shortTagline", label: "Short tagline", kind: "text", base: shortTagline },
    { name: "description", label: "Description", kind: "textarea", base: description },
    { name: "careNotes", label: "Care notes", kind: "textarea", base: careNotes },
    { name: "seoTitle", label: "SEO title", kind: "text", base: seoTitle },
    {
      name: "seoDescription",
      label: "SEO description",
      kind: "textarea",
      base: seoDescription,
    },
    {
      name: "lexical",
      label: "Lexical field",
      kind: "lexical",
      // Only rows with BOTH halves written are offered: a half-typed English
      // row is not yet a line anyone can translate.
      baseRows: (lexical ?? []).filter(
        (row): row is { label: string; value: string } =>
          Boolean(row?.label?.trim() && row?.value?.trim()),
      ),
    },
  ];

  return (
    <Controller
      control={control}
      name="translations"
      render={({ field }) => (
        <TranslationsSection
          value={field.value}
          onChange={field.onChange}
          fields={fields}
          idPrefix="product"
        />
      )}
    />
  );
}
