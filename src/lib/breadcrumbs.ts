import type { CatalogGroup } from "@/lib/catalog-taxonomy";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Builds visible breadcrumb items for category collections.
 * For non-art ecosystems (supplies and 3D print), an intermediate crumb
 * routes to the filtered ecosystem shelf (`/shop?type=supplies` or `/shop?type=print`)
 * so the trail walks up to the correct shelf rather than defaulting to art.
 */
export function buildCategoryBreadcrumbs(options: {
  homeLabel: string;
  shopLabel: string;
  categoryName: string;
  group: CatalogGroup;
  groupLabel: string;
}): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: options.homeLabel, href: "/" },
    { label: options.shopLabel, href: "/shop" },
  ];

  if (options.group !== "art") {
    items.push({
      label: options.groupLabel,
      href: `/shop?type=${options.group}`,
    });
  }

  items.push({ label: options.categoryName });
  return items;
}

/**
 * Builds visible breadcrumb items for product PDPs.
 * For supplies and 3D print pieces, inserts the ecosystem group crumb
 * between 'Shop' and the category.
 */
export function buildProductBreadcrumbs(options: {
  homeLabel: string;
  shopLabel: string;
  categoryName: string;
  categorySlug: string;
  productTitle: string;
  group: CatalogGroup;
  groupLabel: string;
}): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: options.homeLabel, href: "/" },
    { label: options.shopLabel, href: "/shop" },
  ];

  if (options.group !== "art") {
    items.push({
      label: options.groupLabel,
      href: `/shop?type=${options.group}`,
    });
  }

  items.push({
    label: options.categoryName,
    href: `/shop/${options.categorySlug}`,
  });
  items.push({ label: options.productTitle });

  return items;
}
