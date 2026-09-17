"use client";

import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { searchProductsForLink } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/studio/field-error";
import { FormSection } from "@/components/studio/form-section";
import { IMPORT_LIST_SHORT, importListOf } from "@/lib/import-list";
import { PRODUCT_LIMITS } from "@/lib/studio-limits";

import type { FormValues } from "./schema";

/**
 * The linked product's import list, in the short form a caption has room
 * for — from import-list.ts, which replaced the third hand-typed copy of
 * these words that used to live here. Total over any number: a value outside
 * the four lists prints as "List n" rather than nothing.
 */
function importListCaption(tier: number): string {
  const list = importListOf(tier);
  return list ? IMPORT_LIST_SHORT[list] : `List ${tier}`;
}

/**
 * Cross-list provenance links (product-ux benchmark gap 3): "Made with" on
 * an art piece names the ACTUAL pigments/resins from the supplies import
 * list; the reverse side renders "What this creates" on the supply's page.
 * Links are owner-picked here — never inferred — so the provenance story
 * stays true.
 */
export function ProvenanceLinksSection() {
  const {
    control,
    formState: { errors },
  } = useFormContext<FormValues>();
  const links = useFieldArray({ control, name: "madeWith" });
  // The picker appends without a limit, so it stops offering rows at the cap
  // rather than letting a Save be refused for a link already on screen.
  const atCap = links.fields.length >= PRODUCT_LIMITS.madeWithRows;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    { id: string; title: string; tier: number | null }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    const query = q.trim();
    if (!query) return;
    setSearching(true);
    setError(null);
    const result = await searchProductsForLink(query);
    setSearching(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResults(result.data ?? []);
  }

  return (
    <FormSection title="Made with (provenance links)">
      <p className="text-sm text-muted-foreground">
        Link the actual supplies or print products this piece is made with — the
        linked product&apos;s page shows it back under &ldquo;What this
        creates&rdquo;.
      </p>

      {links.fields.length > 0 && (
        <ul className="space-y-2">
          {links.fields.map((field, index) => (
            <li
              key={field.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-foreground">
                {field.title}
                {field.tier != null && (
                  <span className="ms-2 text-xs text-muted-foreground">
                    {importListCaption(field.tier)}
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 shrink-0"
                aria-label={`Unlink ${field.title}`}
                onClick={() => links.remove(index)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void runSearch();
            }
          }}
          placeholder="Search products to link…"
          aria-label="Search products to link"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0"
          disabled={searching}
          onClick={() => void runSearch()}
        >
          <Search /> {searching ? "Searching…" : "Search"}
        </Button>
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}

      {atCap && (
        <p className="text-xs text-muted-foreground">
          {PRODUCT_LIMITS.madeWithRows} links is the limit — remove one to add
          another.
        </p>
      )}
      {results.length > 0 && !atCap && (
        <ul className="space-y-1">
          {results
            .filter((row) => !links.fields.some((f) => f.linkId === row.id))
            .map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() =>
                    links.append({
                      linkId: row.id,
                      title: row.title,
                      tier: row.tier,
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-start text-sm text-foreground hover:border-border"
                >
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{row.title}</span>
                  {row.tier != null && (
                    <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                      {importListCaption(row.tier)}
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      )}
      {/* The picker appends without a limit, so the array cap can only be
          reported here — no single control owns it. */}
      <FieldError id="product-made-with-error">
        {errors.madeWith?.root?.message ?? errors.madeWith?.message}
      </FieldError>
      <p className="text-xs text-muted-foreground">
        Up to {PRODUCT_LIMITS.madeWithRows} links.
      </p>
    </FormSection>
  );
}
