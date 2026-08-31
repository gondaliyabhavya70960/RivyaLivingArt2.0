import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { ContentStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/studio/page-header";
import {
  PortfolioList,
  type PortfolioRow,
} from "@/components/studio/portfolio/portfolio-list";

export const metadata: Metadata = { title: "Portfolio" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;

  const statusFilter =
    status === ContentStatus.DRAFT || status === ContentStatus.PUBLISHED
      ? status
      : undefined;

  const where: Prisma.PortfolioWhereInput = {
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const portfolios = await db.portfolio.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      images: { orderBy: { order: "asc" }, take: 1 },
    },
  });

  const rows: PortfolioRow[] = portfolios.map((portfolio) => ({
    id: portfolio.id,
    title: portfolio.title,
    categoryName: portfolio.category?.name ?? null,
    status: portfolio.status,
    thumbnailUrl: portfolio.images[0]?.url ?? portfolio.afterImageUrl ?? null,
    createdAt: dateFormatter.format(portfolio.createdAt),
  }));

  return (
    <div>
      <PageHeader
        title="Portfolio"
        description="Case studies of finished work — drafts stay invisible on the public site until published."
        actions={
          <Button asChild>
            <Link href="/studio/portfolio/new">
              <Plus /> Add piece
            </Link>
          </Button>
        }
      />

      <PortfolioList portfolios={rows} initialQuery={q ?? ""} />
    </div>
  );
}
