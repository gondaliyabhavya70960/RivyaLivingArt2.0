"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { groupForCategorySlug } from "@/lib/catalog-taxonomy";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProducts, upsertProduct } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import {
  DraftPreview,
  DraftPreviewPanel,
} from "@/components/studio/draft-preview";
import { EditorSplit } from "@/components/studio/editor-split";
import { LocalDraftBar } from "@/components/studio/local-draft-bar";
import { scrollToFirstErrorIfUnfocused } from "@/components/studio/scroll-to-first-error";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import {
  buildDefaultValues,
  buildUpsertPayload,
  formSchema,
  type FormValues,
  type ProductFormInitial,
} from "./product-form/schema";
import { RewriteWarning } from "./product-form/rewrite-warning";
import { ProvenanceSection } from "./product-form/provenance-section";
import { EssentialsSection } from "./product-form/essentials-section";
import { PricingSpecsSection } from "./product-form/pricing-specs-section";
import { PrintProductionSection } from "./product-form/print-production-section";
import { LexicalSection } from "./product-form/lexical-section";
import { ProvenanceLinksSection } from "./product-form/provenance-links-section";
import { OccasionsSection } from "./product-form/occasions-section";
import { CareNotesSection } from "./product-form/care-notes-section";
import { MediaSection } from "./product-form/media-section";
import { CustomizationFieldsSection } from "./product-form/customization-fields-section";
import { SeoSection } from "./product-form/seo-section";
import { ProductTranslationsSection } from "./product-form/translations-section";

export type { ProductFormInitial } from "./product-form/schema";

/**
 * §12's product form is twelve stacked sections — the longest scroll in the
 * Studio. The roadmap groups them into five tabs; these are the field names
 * each tab owns, and they exist for one reason beyond layout.
 *
 * **A tab can hide a validation error.** Submit with a bad SEO title while
 * General is showing and, without this map, the form simply refuses to submit
 * with nothing on screen to explain why — the classic way tabbed forms strand
 * people. `onInvalid` below reads the first errored field, finds its tab and
 * switches to it, and every tab with an error is marked in the strip.
 *
 * One pair moves: a PRINT product (tier 4, or a print-group category) carries
 * its video and 3D-model URLs in the General tab's 3D-printing section rather
 * than under Images, so `tabForField` takes that predicate — otherwise a bad
 * URL switched to a tab that did not hold the field and focused an input
 * inside a hidden panel, which is exactly the stranding this map prevents.
 */
const TABS = [
  {
    value: "general",
    label: "General",
    fields: [
      "title",
      "displayName",
      "shortTagline",
      "description",
      "categoryId",
      "featured",
      "status",
      "priceMin",
      "priceMax",
      "showPrice",
      "inStock",
      "tier",
      "timeline",
      "materials",
      "dimensions",
      "occasions",
      "confirmRewrite",
    ],
  },
  {
    value: "images",
    label: "Images",
    fields: ["images", "videoUrl", "model3dUrl"],
  },
  { value: "customization", label: "Customization", fields: ["customFields"] },
  {
    value: "details",
    label: "Details",
    fields: ["lexical", "madeWith", "careNotes", "translations"],
  },
  {
    value: "seo",
    label: "SEO",
    fields: ["seoTitle", "seoDescription", "ogImage"],
  },
] as const;

/** The tab a field belongs to, or undefined for a field no tab claims. */
function tabForField(field: string, isPrint: boolean): string | undefined {
  const root = field.split(".")[0];
  if (isPrint && (root === "videoUrl" || root === "model3dUrl")) {
    return "general";
  }
  return TABS.find((tab) => (tab.fields as readonly string[]).includes(root))
    ?.value;
}

export function ProductForm({
  categories,
  product,
}: {
  categories: { id: string; name: string; slug: string }[];
  product?: ProductFormInitial;
}) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  /* Counts successful saves; the docked preview is keyed on it and reloads. */
  const [savedVersion, setSavedVersion] = useState(0);

  const methods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaultValues(product),
  });

  useUnsavedChangesGuard(methods.formState.isDirty && !saving);

  const draft = useLocalDraft<FormValues>({
    key: "product",
    id: product?.id,
    watch: methods.watch,
    reset: methods.reset,
    enabled: !saving,
  });

  const [tab, setTab] = useState<string>(TABS[0].value);

  // The same predicate `useIsPrintProduct` applies inside the sections; it
  // cannot be called here, above the FormProvider, so it is read off
  // `methods.control` directly.
  const tier = useWatch({ control: methods.control, name: "tier" });
  const categoryId = useWatch({ control: methods.control, name: "categoryId" });
  const categorySlug = categories.find((c) => c.id === categoryId)?.slug;
  const isPrint =
    tier === "4" ||
    (categorySlug ? groupForCategorySlug(categorySlug) === "print" : false);

  /* Which tabs are holding an error right now, so the strip can say so
     without the owner opening each one to look. */
  const errored = new Set(
    Object.keys(methods.formState.errors)
      .map((field) => tabForField(field, isPrint))
      .filter((value): value is string => Boolean(value)),
  );

  /** A refused submit lands the owner ON the problem rather than nowhere. */

  function onInvalid(errors: Record<string, unknown>) {
    const first = Object.keys(errors)[0];
    const target = first ? tabForField(first, isPrint) : undefined;
    if (target) setTab(target);
    // An array-level refusal (the lexical rows, the linked products) has no
    // input for RHF to focus, so nothing scrolls and the message can sit far
    // below the fold while the sticky Save bar stays in view.
    scrollToFirstErrorIfUnfocused("studio-product-form");
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const result = await upsertProduct(buildUpsertPayload(values, product));

    if (!result.ok) {
      setSaving(false);
      toast.error(result.error);
      return;
    }
    // The save is the new baseline. `isDirty` compares against the values
    // the form MOUNTED with, so without this the unsaved-changes indicator
    // and the navigation guard stayed armed after a successful save in edit
    // mode. Done while autosave is still off (`enabled: !saving`), so the
    // reset cannot be mistaken for an edit and written back as a draft.
    methods.reset(values);
    draft.discard();
    setSaving(false);
    setSavedVersion((version) => version + 1);
    toast.success(product ? "Product saved." : "Product created.");
    if (!product && result.data) {
      router.push(`/studio/products/${result.data.id}`);
    } else {
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!product) return;
    setDeleting(true);
    const result = await deleteProducts([product.id]);
    setDeleting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDeleteOpen(false);
    // The row is gone; its draft would only ever be an orphan in storage.
    draft.discard();
    toast.success("Product deleted.");
    router.push("/studio/products");
    router.refresh();
  }

  const dirty = methods.formState.isDirty && !saving;

  return (
    <FormProvider {...methods}>
      {/* REDESIGN.md §12.5: "two columns — information left, live preview
          right". The right column is the saved draft in a phone frame, docked
          when the content area is wide enough for both (a container query,
          so it follows the sidebar's collapse); narrower, the footer's Preview
          button and its dialog carry on. A new product has no page yet. */}
      <EditorSplit
        aside={
          product && (
            <DraftPreviewPanel
              path={`/product/${product.slug}`}
              version={savedVersion}
              dirty={dirty}
            />
          )
        }
      >
        <form
          id="studio-product-form"
          onSubmit={methods.handleSubmit(onSubmit, onInvalid)}
          className="space-y-6"
        >
          <LocalDraftBar
            savedAt={draft.savedAt}
            onRestore={draft.restore}
            onDiscard={draft.discard}
            disabled={saving}
            paused={draft.paused}
          />

          {product?.needsRewrite && <RewriteWarning />}
          {product?.importSource && <ProvenanceSection product={product} />}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList aria-label="Product sections">
              {TABS.map((entry) => (
                <TabsTrigger key={entry.value} value={entry.value}>
                  {entry.label}
                  {errored.has(entry.value) && (
                    <>
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-destructive"
                      />
                      <span className="sr-only"> (has an error)</span>
                    </>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* `forceMount` on every panel, which is the whole reason this is
                safe. Radix unmounts an inactive tab by default; these panels
                hold registered form fields, an in-flight upload and a rich-text
                editor, and unmounting them on a tab change would throw away
                editor instances and upload state mid-edit. Mounted-but-`hidden`
                keeps the DOM and the accessibility tree honest. */}
            <TabsContent forceMount value="general" className="space-y-6">
              <EssentialsSection categories={categories} />
              {/* Sections below swap their resin flavor for print fields when
                  the product is tier 4 or filed in a print-group category
                  (M-A3). */}
              <PricingSpecsSection categories={categories} />
              <PrintProductionSection categories={categories} />
              <OccasionsSection categories={categories} />
            </TabsContent>

            <TabsContent forceMount value="images" className="space-y-6">
              <MediaSection
                categories={categories}
                uploading={uploading}
                setUploading={setUploading}
              />
            </TabsContent>

            <TabsContent forceMount value="customization" className="space-y-6">
              <CustomizationFieldsSection categories={categories} />
            </TabsContent>

            <TabsContent forceMount value="details" className="space-y-6">
              <LexicalSection />
              <ProvenanceLinksSection />
              <CareNotesSection categories={categories} />
              <ProductTranslationsSection />
            </TabsContent>

            <TabsContent forceMount value="seo" className="space-y-6">
              <SeoSection slug={product?.slug} />
            </TabsContent>
          </Tabs>

          {/* Sticky save bar */}
          <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-4 shadow-e2">
            <div className="flex flex-wrap items-center gap-3">
              {product && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deleting || saving}
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 /> Delete
                </Button>
              )}
              {/* §12.5's unsaved-changes indicator. A live region that is
                  always mounted, so the first edit is announced once and a
                  save clears it — rather than a node that appears from
                  nowhere, which screen readers do not read. */}
              <span
                role="status"
                className="u-micro inline-flex items-center gap-2 text-graphite"
              >
                {dirty && (
                  <>
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-warning"
                    />
                    Unsaved changes
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {product && (
                // Enables Next draft mode via the staff-gated route handler and
                // frames the public page (audit C2). The dialog keeps the
                // new-tab link inside it, so nothing is lost. Hidden once the
                // docked column is showing — one preview affordance at a time.
                <DraftPreview
                  path={`/product/${product.slug}`}
                  className="@5xl/editor:hidden"
                />
              )}
              <Button type="submit" disabled={saving || uploading}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          <ConfirmDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            count={1}
            noun="Product"
            busy={deleting}
            onConfirm={handleDelete}
            extraWarning="Its gallery images are removed from storage too."
          />
        </form>
      </EditorSplit>
    </FormProvider>
  );
}
