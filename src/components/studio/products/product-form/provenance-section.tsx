import { Badge } from "@/components/ui/badge";
import { FormSection } from "./form-section";
import { TIER_LABEL, type ProductFormInitial } from "./schema";

/**
 * `sheet:kanha-kreation` → "Catalog fill · kanha-kreation"; else scraper key.
 * The `sheet:` prefix is STORED DATA (matched by `startsWith` in half a dozen
 * queries) and is frozen; only the words a person reads change.
 */
function prettySource(importSource: string): string {
  return importSource.startsWith("sheet:")
    ? `Catalog fill · ${importSource.slice("sheet:".length)}`
    : `Product scraper · ${importSource}`;
}

/** Read-only provenance panel for imported products (importSource set). */
export function ProvenanceSection({
  product,
}: {
  product: ProductFormInitial;
}) {
  const { importSource, importRef, tier } = product;
  if (!importSource) return null;

  // A row the catalog fill wrote (import-list CSV), as opposed to the scraper.
  const isSheet = importSource.startsWith("sheet:");
  const isOwnerReady = importSource === "sheet:owner-ready";

  return (
    <FormSection
      title="Provenance"
      description="Where this listing came from — read-only."
    >
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Source</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {prettySource(importSource)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {importRef || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Import list</dt>
          <dd className="mt-0.5">
            {tier != null && TIER_LABEL[tier] ? (
              <Badge variant="outline">{TIER_LABEL[tier]}</Badge>
            ) : (
              <span className="font-medium text-foreground">—</span>
            )}
          </dd>
        </div>
      </dl>

      {isSheet ? (
        isOwnerReady ? (
          <p className="text-xs text-muted-foreground">
            Refreshed by the catalog fill. When this row changes in its
            import-list CSV, the fill rewrites the listing from the CSV — title,
            tagline, description, prices, materials, dimensions, care notes,
            SEO, category, images, timeline, video/3D model URLs, status and
            featured — so manual edits to those fields survive only until then.
            Occasions, customization fields and translations are never
            overwritten by the fill.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Refreshed by the catalog fill. When this row changes in its
            import-list CSV, the fill rewrites title, tagline, description,
            prices, materials, dimensions, care notes, SEO, category, images,
            import list and stock from the CSV, resets status to Published and
            reassigns featured — so manual edits to those fields (including
            category, featured and status) survive only until then. Occasions,
            timeline, video/3D model URLs, customization fields and translations
            are never overwritten by the fill.
          </p>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          Imported by the studio product scraper as reference material. A
          re-import of the same source row updates this product only while it
          still needs a rewrite; once the rewrite is confirmed it is left
          untouched.
        </p>
      )}
    </FormSection>
  );
}
