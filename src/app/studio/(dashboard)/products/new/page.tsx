import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/studio/page-header";
import { ProductForm } from "@/components/studio/products/product-form";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div>
      <PageHeader
        title="Add product"
        description="New products start as drafts — publish when the listing is ready."
      />
      <ProductForm categories={categories} />
    </div>
  );
}
