"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProducts, upsertProduct } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
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
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        {product?.needsRewrite && <RewriteWarning />}
        {product?.importSource && <ProvenanceSection product={product} />}

        <EssentialsSection categories={categories} />
        {/* Sections below swap their resin flavor for print fields when the
            product is tier 4 or filed in a print-group category (M-A3). */}
        <PricingSpecsSection categories={categories} />
        <PrintProductionSection categories={categories} />
        <OccasionsSection categories={categories} />
        <LexicalSection />
        <ProvenanceLinksSection />
        <CareNotesSection categories={categories} />
        <MediaSection uploading={uploading} setUploading={setUploading} />
        <CustomizationFieldsSection categories={categories} />
        <SeoSection slug={product?.slug} />
        <ProductTranslationsSection />

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
              <Button asChild variant="link" size="sm">
                <a
                  // Enables Next draft mode via the staff-gated route handler,
                  // then lands on the public page (audit C2).
                  href={`/api/draft?redirect=${encodeURIComponent(`/product/${product.slug}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View draft preview ↗
                </a>
              </Button>
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
