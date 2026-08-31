import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/studio/page-header";
import {
  PortfolioForm,
  type PortfolioFormInitial,
} from "@/components/studio/portfolio/portfolio-form";

export const metadata: Metadata = { title: "Edit portfolio piece" };

/** Safely pull a string field out of the resultsMeta Json column. */
const metaString = (meta: unknown, key: string): string => {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const value = (meta as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
};

export default async function EditPortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [portfolio, categories] = await Promise.all([
    db.portfolio.findUnique({
      where: { id },
      include: { images: { orderBy: { order: "asc" } } },
    }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!portfolio) notFound();

  const initial: PortfolioFormInitial = {
    id: portfolio.id,
    slug: portfolio.slug,
    title: portfolio.title,
    story: portfolio.story,
    brief: portfolio.brief ?? "",
    process: portfolio.process ?? "",
    clientNote: portfolio.clientNote ?? "",
    location: portfolio.location ?? "",
    year: portfolio.year != null ? String(portfolio.year) : "",
    beforeImageUrl: portfolio.beforeImageUrl ?? "",
    afterImageUrl: portfolio.afterImageUrl ?? "",
    videoUrl: portfolio.videoUrl ?? "",
    resultsMeta: {
      type: metaString(portfolio.resultsMeta, "type"),
      material: metaString(portfolio.resultsMeta, "material"),
      size: metaString(portfolio.resultsMeta, "size"),
      timeline: metaString(portfolio.resultsMeta, "timeline"),
      technique: metaString(portfolio.resultsMeta, "technique"),
      complexity: metaString(portfolio.resultsMeta, "complexity"),
      tags: Array.isArray(
        (portfolio.resultsMeta as Record<string, unknown> | null)?.["tags"],
      )
        ? (
            (portfolio.resultsMeta as Record<string, unknown>)[
              "tags"
            ] as unknown[]
          )
            .filter((t): t is string => typeof t === "string")
            .join(", ")
        : "",
    },
    categoryId: portfolio.categoryId,
    status: portfolio.status,
    translations: portfolio.translations,
    images: portfolio.images.map((image) => ({
      url: image.url,
      alt: image.alt,
      caption: image.caption,
      translations: image.translations,
      order: image.order,
    })),
  };

  return (
    <div>
      <PageHeader
        title={portfolio.title}
        description="Edit the case study — changes go live only when saved."
      />
      <PortfolioForm categories={categories} portfolio={initial} />
    </div>
  );
}
