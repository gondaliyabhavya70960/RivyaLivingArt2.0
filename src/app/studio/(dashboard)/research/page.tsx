import type { Metadata } from "next";

import { PageHeader } from "@/components/studio/page-header";
import { NewResearchButton } from "@/components/studio/research/research-form";
import { ResearchList } from "@/components/studio/research/research-list";
import type { ResearchRow } from "@/components/studio/research/research-form";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Research library" };

function toDateInput(value: Date | null): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function ResearchPage() {
  const records = await db.researchRecord.findMany({
    orderBy: [{ extractedAt: "desc" }, { createdAt: "desc" }],
  });

  const rows: ResearchRow[] = records.map((r) => ({
    id: r.id,
    source: r.source,
    url: r.url,
    title: r.title,
    category: r.category,
    materials: r.materials,
    dimensions: r.dimensions,
    price: r.price,
    images: Array.isArray(r.images)
      ? r.images.filter((v): v is string => typeof v === "string")
      : [],
    description: r.description,
    tags: r.tags,
    notes: r.notes,
    extractedAtInput: toDateInput(r.extractedAt),
    status: r.status as ResearchRow["status"],
    isDemo: r.isDemo,
  }));

  return (
    <>
      <PageHeader
        title="Research library"
        description="Hand-kept reference notes — a maker's photo, a competitor's listing, an idea worth adapting. Never a product; nothing here reaches the catalogue on its own."
        actions={<NewResearchButton />}
      />
      <ResearchList records={rows} />
    </>
  );
}
