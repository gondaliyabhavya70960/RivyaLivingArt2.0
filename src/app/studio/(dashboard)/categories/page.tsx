import type { Metadata } from "next";

import { PageHeader } from "@/components/studio/page-header";
import {
  CategoryList,
  NewCategoryButton,
  type CategoryRow,
} from "@/components/studio/categories/category-list";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  const rows: CategoryRow[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    order: category.order,
    productCount: category._count.products,
    translations: category.translations,
  }));

  return (
    <>
      <PageHeader
        title="Categories"
        description="Collections that group products and portfolio pieces across the storefront."
        actions={<NewCategoryButton />}
      />
      <CategoryList categories={rows} />
    </>
  );
}
