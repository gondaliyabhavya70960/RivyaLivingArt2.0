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

const PORTFOLIO_STATUS_VALUES: readonly ContentStatus[] = [
  ContentStatus.DRAFT,
  ContentStatus.REVIEW,
  ContentStatus.PUBLISHED,
  ContentStatus.ARCHIVED,
];

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; demo?: string }>;
}) {
  const { q, status, demo } = await searchParams;

  // Same convention as products/blog: an absent `status` means PUBLISHED;
  // "ALL" is explicit.
  const statusFilter =
    status === "ALL"
      ? undefined
      : PORTFOLIO_STATUS_VALUES.includes(status as ContentStatus)
        ? (status as ContentStatus)
        : ContentStatus.PUBLISHED;

  const where: Prisma.PortfolioWhereInput = {
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(demo === "1" ? { isDemo: true } : {}),
  };

  const [portfolios, statusGroups] = await Promise.all([
    db.portfolio.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        images: { orderBy: { order: "asc" }, take: 1 },
      },
    }),
    db.portfolio.groupBy({
      by: ["status"],
      where: {
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(demo === "1" ? { isDemo: true } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const rows: PortfolioRow[] = portfolios.map((portfolio) => ({
    id: portfolio.id,
    title: portfolio.title,
    categoryName: portfolio.category?.name ?? null,
    status: portfolio.status,
    isDemo: portfolio.isDemo,
    thumbnailUrl: portfolio.images[0]?.url ?? portfolio.afterImageUrl ?? null,
    createdAt: dateFormatter.format(portfolio.createdAt),
  }));

  const statusCounts = Object.fromEntries(
    PORTFOLIO_STATUS_VALUES.map((value) => [
      value,
      statusGroups.find((g) => g.status === value)?._count._all ?? 0,
    ]),
  ) as Record<ContentStatus, number>;

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

      <PortfolioList
        portfolios={rows}
        initialQuery={q ?? ""}
        statusCounts={statusCounts}
      />
    </div>
  );
}
