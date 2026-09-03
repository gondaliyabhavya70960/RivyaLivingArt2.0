import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/studio/page-header";
import {
  ProductForm,
  type ProductFormInitial,
} from "@/components/studio/products/product-form";

export const metadata: Metadata = { title: "Edit product" };

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: "asc" } },
        customFields: { orderBy: { order: "asc" } },
        madeWith: { select: { id: true, title: true, tier: true } },
      },
    }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  if (!product) notFound();

  const initial: ProductFormInitial = {
    id: product.id,
    slug: product.slug,
    title: product.title,
    displayName: product.displayName,
    shortTagline: product.shortTagline ?? "",
    description: product.description,
    priceMin: product.priceMin,
    priceMax: product.priceMax,
    showPrice: product.showPrice,
    timeline: product.timeline ?? "",
    materials: product.materials ?? "",
    dimensions: product.dimensions ?? "",
    occasions: asStringArray(product.occasions),
    lexical: Array.isArray(product.lexical)
      ? product.lexical.flatMap((row) =>
          row &&
          typeof row === "object" &&
          "label" in row &&
          "value" in row &&
          typeof row.label === "string" &&
          typeof row.value === "string"
            ? [{ label: row.label, value: row.value }]
            : [],
        )
      : [],
    madeWith: product.madeWith.map((link) => ({
      linkId: link.id,
      title: link.title,
      tier: link.tier,
    })),
    careNotes: product.careNotes ?? "",
    categoryId: product.categoryId,
    featured: product.featured,
    status: product.status,
    videoUrl: product.videoUrl ?? "",
    model3dUrl: product.model3dUrl ?? "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    ogImage: product.ogImage ?? "",
    translations: product.translations,
    needsRewrite: product.needsRewrite,
    tier: product.tier,
    inStock: product.inStock,
    importSource: product.importSource,
    importRef: product.importRef,
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.alt,
      order: image.order,
      role: image.role,
    })),
    customFields: product.customFields.map((field) => ({
      label: field.label,
      type: field.type,
      options: asStringArray(field.options),
      required: field.required,
      helpText: field.helpText ?? "",
      order: field.order,
    })),
  };

  return (
    <div>
      <PageHeader
        title={product.title}
        description="Edit the listing — changes go live only when saved."
      />
      <ProductForm categories={categories} product={initial} />
    </div>
  );
}
