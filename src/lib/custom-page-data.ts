import "server-only";

import type { BlockExtras } from "@/components/storefront/custom-page-blocks";
import type {
  FaqPickerData,
  ProductGridData,
  RichTextData,
} from "@/lib/custom-blocks";
import type { ResolvedBlock } from "@/lib/custom-pages-server";
import { db } from "@/lib/db";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { buildProductWhere, fetchProductsPage } from "@/lib/shop";
import { renderTiptapToHtml } from "@/lib/tiptap-render";
import { demoWhere } from "@/lib/demo-content";

/**
 * Everything the blocks on one page need beyond their own `data`.
 *
 * Resolved in ONE pass rather than by each block fetching for itself. A block
 * is a server component and could `await` its own query, but a lander with
 * four product grids would then run four round trips in series — the render
 * order is the await order. Collecting the work first and running it through
 * `Promise.all` keeps a six-block page at one round of queries.
 */
export async function resolveBlockExtras(
  blocks: readonly ResolvedBlock[],
  locale: string,
): Promise<Record<string, BlockExtras>> {
  const out: Record<string, BlockExtras> = {};

  // Rich text is pure CPU — no query, so no reason to defer it.
  for (const block of blocks) {
    if (block.type !== "richText") continue;
    const data = block.data as RichTextData;
    out[block.id] = { html: renderTiptapToHtml(data.body) };
  }

  const faqIds = new Set<string>();
  for (const block of blocks) {
    if (block.type !== "faqPicker") continue;
    for (const id of (block.data as FaqPickerData).faqIds) faqIds.add(id);
  }

  const gridBlocks = blocks.filter((b) => b.type === "productGrid");

  const [faqRows, ...grids] = await Promise.all([
    faqIds.size > 0
      ? db.faq.findMany({
          where: {
            id: { in: [...faqIds] },
            status: "PUBLISHED",
            ...(await demoWhere()),
          },
          orderBy: { order: "asc" },
        })
      : Promise.resolve([]),
    ...gridBlocks.map((block) =>
      fetchProductsForGrid(block.data as ProductGridData, locale),
    ),
  ]);

  const faqById = new Map(
    faqRows
      .map((faq) => localize(faq, locale, TRANSLATABLE_FIELDS.faq))
      .map((faq) => [faq.id, faq]),
  );

  for (const block of blocks) {
    if (block.type !== "faqPicker") continue;
    const data = block.data as FaqPickerData;
    out[block.id] = {
      // The owner's order, not the FAQ page's — they chose this sequence.
      faqs: data.faqIds.flatMap((id) => {
        const faq = faqById.get(id);
        return faq
          ? [{ id: faq.id, question: faq.question, answer: faq.answer }]
          : [];
      }),
    };
  }

  gridBlocks.forEach((block, index) => {
    out[block.id] = { products: grids[index] ?? [] };
  });

  return out;
}

/**
 * The products one grid shows.
 *
 * No mode invents a product (HARD RULES §1.1): `manual` is slugs the owner
 * picked, `category` is one category, `featured` is the catalogue's own
 * curated flag. An empty result renders no band at all.
 */
async function fetchProductsForGrid(data: ProductGridData, locale: string) {
  if (data.mode === "manual") {
    if (data.slugs.length === 0) return [];
    const page = await fetchProductsPage({
      where: {
        ...buildProductWhere({}, await demoWhere()),
        slug: { in: data.slugs },
      },
      sort: "featured",
      take: data.limit,
      locale,
      withTotal: false,
    });
    // Restore the owner's order — `where … in` does not preserve it.
    const rank = new Map(data.slugs.map((slug, index) => [slug, index]));
    return [...page.items].sort(
      (a, b) => (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0),
    );
  }

  const page = await fetchProductsPage({
    where: buildProductWhere(
      data.mode === "category" && data.category
        ? { category: data.category }
        : {},
      await demoWhere(),
    ),
    sort: "featured",
    take: data.limit,
    locale,
    withTotal: false,
  });
  return page.items;
}
