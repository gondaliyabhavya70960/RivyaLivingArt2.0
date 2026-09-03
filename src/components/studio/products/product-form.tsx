"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProducts, upsertProduct } from "@/actions/products";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { DraftPreview } from "@/components/studio/draft-preview";
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
 */
const TABS = [
  {
    value: "general",
    label: "General",
    fields: [
      "title", "displayName", "shortTagline", "description", "categoryId",
      "featured", "status", "priceMin", "priceMax", "showPrice", "inStock",
      "tier", "timeline", "materials", "dimensions", "occasions",
      "confirmRewrite",
    ],
  },
  { value: "images", label: "Images", fields: ["images", "videoUrl"] },
  { value: "customization", label: "Customization", fields: ["customFields"] },
  {
    value: "details",
    label: "Details",
    fields: ["lexical", "madeWith", "careNotes", "translations"],
  },
  { value: "seo", label: "SEO", fields: ["seoTitle", "seoDescription", "ogImage"] },
] as const;

/** The tab a field belongs to, or undefined for a field no tab claims. */
function tabForField(field: string): string | undefined {
  const root = field.split(".")[0];
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

  const methods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaultValues(product),
  });

  useUnsavedChangesGuard(methods.formState.isDirty && !saving);

  const [tab, setTab] = useState<string>(TABS[0].value);

  /* Which tabs are holding an error right now, so the strip can say so
     without the owner opening each one to look. */
  const errored = new Set(
    Object.keys(methods.formState.errors)
      .map(tabForField)
      .filter((value): value is string => Boolean(value)),
  );

  /** A refused submit lands the owner ON the problem rather than nowhere. */
  function onInvalid(errors: Record<string, unknown>) {
    const first = Object.keys(errors)[0];
    const target = first ? tabForField(first) : undefined;
    if (target) setTab(target);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const result = await upsertProduct(buildUpsertPayload(values, product));
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
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
    toast.success("Product deleted.");
    router.push("/studio/products");
    router.refresh();
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit, onInvalid)}
        className="space-y-6"
      >
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
            <MediaSection uploading={uploading} setUploading={setUploading} />
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
          <div>
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
          </div>
          <div className="flex items-center gap-2">
            {product && (
              // Enables Next draft mode via the staff-gated route handler and
              // frames the public page (audit C2). The dialog keeps the
              // new-tab link inside it, so nothing is lost.
              <DraftPreview path={`/product/${product.slug}`} />
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
    </FormProvider>
  );
}
