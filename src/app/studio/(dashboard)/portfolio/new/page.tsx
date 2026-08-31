import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/studio/page-header";
import { PortfolioForm } from "@/components/studio/portfolio/portfolio-form";

export const metadata: Metadata = { title: "Add portfolio piece" };

export default async function NewPortfolioPage() {
  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader
        title="Add portfolio piece"
        description="New case studies start as drafts — publish when the story is ready."
      />
      <PortfolioForm categories={categories} />
    </div>
  );
}
