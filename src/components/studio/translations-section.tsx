"use client";

import { useState } from "react";

import { RichTextEditor } from "@/components/studio/rich-text-editor";
import { FormSection } from "@/components/studio/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDir, localeLabels, type Locale } from "@/i18n/config";
import { translatableLocales } from "@/lib/localize";
import { cn } from "@/lib/utils";

/** One translatable field — `name` must match the model's TRANSLATABLE_FIELDS. */
export type TranslatableFieldDef = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "richtext" | "lexical";
  /** English base value, shown as a reference for the translator. */
  base?: string;
  /**
   * English rows for `kind: "lexical"`. The editor draws one block per row and
   * pins it to that row's position, because the resolver matches by position —
   * a free-form "add a row" here would translate the wrong line.
   */
  baseRows?: { label: string; value: string }[];
};

/** Stored shape: `{ [locale]: { [field]: value } }`. */
export type TranslationsValue = Record<string, Record<string, unknown>>;

function hasContent(forLocale: Record<string, unknown> | undefined): boolean {
  if (!forLocale) return false;
  return Object.values(forLocale).some((v) =>
    typeof v === "string" ? v.trim() !== "" : Boolean(v),
  );
}

/**
 * Controlled per-language editor for a model's translatable prose. The base
 * (English) values stay in the fields above this section; here the owner picks
 * a language and overrides individual fields. Anything left blank falls back to
 * English on the public site (see `localize`), so partial translation is fine.
 *
 * Presentational and form-library-agnostic: callers bind `value`/`onChange`
 * however they store the row's `translations` (react-hook-form Controller,
 * plain state, …). Empty entries are pruned server-side by
 * `normalizeTranslations`, so nothing is persisted until real text is typed.
 */
export function TranslationsSection({
  value,
  onChange,
  fields,
  idPrefix,
}: {
  value: TranslationsValue;
  onChange: (next: TranslationsValue) => void;
  fields: readonly TranslatableFieldDef[];
  idPrefix: string;
}) {
  const [active, setActive] = useState<Locale>(translatableLocales[0]);
  const forLocale = value[active] ?? {};

  function setField(field: string, fieldValue: unknown) {
    onChange({
      ...value,
      [active]: { ...(value[active] ?? {}), [field]: fieldValue },
    });
  }

  return (
    <FormSection
      title="Translations"
      description="Optional per-language overrides. Leave a field blank to fall back to the English original — the English text is edited in the fields above."
    >
      {/* Language strip — a dot marks languages that already have content. */}
      <div
        role="tablist"
        aria-label="Translation language"
        className="flex flex-wrap gap-2"
      >
        {translatableLocales.map((locale) => {
          const filled = hasContent(value[locale]);
          const selected = locale === active;
          return (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(locale)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                selected
                  ? "border-sapphire-ink/50 bg-sand text-foreground"
                  : "border-foreground/10 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
              )}
            >
              {localeLabels[locale]}
              {filled && (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                  <span className="sr-only"> (has content)</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Fields for the active language. dir follows the language (Arabic = rtl);
          the English reference stays ltr. */}
      <div className="space-y-5" dir={getDir(active)}>
        {fields.map((field) => {
          const id = `${idPrefix}-${active}-${field.name}`;
          const current = forLocale[field.name];
          const asText = typeof current === "string" ? current : "";
          return (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={field.kind === "richtext" ? undefined : id}>
                {field.label}
              </Label>
              {field.base && field.kind !== "richtext" && (
                <p className="text-xs text-muted-foreground" dir="ltr">
                  <span className="text-muted-foreground">English:</span>{" "}
                  {field.base}
                </p>
              )}
              {field.kind === "text" && (
                <Input
                  id={id}
                  value={asText}
                  onChange={(e) => setField(field.name, e.target.value)}
                />
              )}
              {field.kind === "textarea" && (
                <Textarea
                  id={id}
                  rows={3}
                  value={asText}
                  onChange={(e) => setField(field.name, e.target.value)}
                />
              )}
              {field.kind === "lexical" && (
                <div className="space-y-3">
                  {(field.baseRows ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      No voice lines to translate — add them in English first.
                    </p>
                  ) : (
                    (field.baseRows ?? []).map((baseRow, rowIndex) => {
                      const rows = Array.isArray(current) ? current : [];
                      const stored = rows[rowIndex];
                      const cell =
                        stored && typeof stored === "object"
                          ? (stored as Record<string, unknown>)
                          : {};
                      const setCell = (key: "label" | "value", next: string) => {
                        // Rebuilt sparse: a row left blank keeps its slot so
                        // every later row stays pinned to its English line.
                        const copy = [...rows];
                        while (copy.length <= rowIndex) copy.push(null);
                        copy[rowIndex] = { ...cell, [key]: next };
                        setField(field.name, copy);
                      };
                      return (
                        <div
                          key={rowIndex}
                          className="space-y-1.5 rounded-lg border border-border p-3"
                        >
                          <p
                            className="text-xs text-muted-foreground"
                            dir="ltr"
                          >
                            <span className="text-muted-foreground">English:</span>{" "}
                            {baseRow.label} — {baseRow.value}
                          </p>
                          <Input
                            aria-label={`${field.label} ${rowIndex + 1} label`}
                            placeholder="Label"
                            value={
                              typeof cell.label === "string" ? cell.label : ""
                            }
                            onChange={(e) => setCell("label", e.target.value)}
                          />
                          <Input
                            aria-label={`${field.label} ${rowIndex + 1} value`}
                            placeholder="Value"
                            value={
                              typeof cell.value === "string" ? cell.value : ""
                            }
                            onChange={(e) => setCell("value", e.target.value)}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {field.kind === "richtext" && (
                // Remount per language so the editor loads that language's doc
                // (RichTextEditor reads `value` only on mount).
                <RichTextEditor
                  key={`${active}-${field.name}`}
                  value={current}
                  onChange={(json) => setField(field.name, json)}
                  placeholder="Translated content…"
                />
              )}
            </div>
          );
        })}
      </div>
    </FormSection>
  );
}
