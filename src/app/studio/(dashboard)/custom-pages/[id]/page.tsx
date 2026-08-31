import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";

import { PageHeader } from "@/components/studio/page-header";
import {
  BlockBoard,
  type BlockRow,
} from "@/components/studio/custom-pages/block-board";
import {
  CustomPageForm,
  type CustomPageFormInitial,
} from "@/components/studio/custom-pages/custom-page-form";
import { Button } from "@/components/ui/button";
import { isCustomBlockType, parseBlockData } from "@/lib/custom-blocks";
import { getCustomPageForStudio } from "@/lib/custom-pages-server";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit landing page" };

/**
 * Render a Date as the value a `datetime-local` input wants.
 *
 * Deliberately in UTC, matching what is stored, and the form says so. Encoding
 * it in the server's local time would silently shift a launch by hours when
 * the runtime region changes.
 */
function toLocalInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 16);
}

export default async function EditCustomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [page, faqs, categories] = await Promise.all([
    getCustomPageForStudio(id),
    db.faq.findMany({
      orderBy: { order: "asc" },
      select: { id: true, question: true },
    }),
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
  ]);
  if (!page) notFound();

  const initial: CustomPageFormInitial = {
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    publishAt: toLocalInputValue(page.publishAt),
    noindex: page.noindex,
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
    ogImage: page.ogImage ?? "",
    translations: page.translations,
  };

  const blocks: BlockRow[] = page.blocks.flatMap((block) =>
    isCustomBlockType(block.type)
      ? [
          {
            id: block.id,
            type: block.type,
            data: parseBlockData<Record<string, unknown>>(
              block.type,
              block.data,
            ),
            translations: block.translations,
          },
        ]
      : [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Landing page"
        title={page.title}
        description="Blocks read top to bottom. The grounds alternate on their own, so the page keeps the site's rhythm whatever order you put them in."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/studio/custom-pages">
                <ArrowLeft aria-hidden className="size-4" />
                All landing pages
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/draft?redirect=${encodeURIComponent(`/p/${page.slug}`)}`}
              >
                <Eye aria-hidden className="size-4" />
                Preview
              </a>
            </Button>
          </div>
        }
      />

      <div className="space-y-10">
        <section className="space-y-4">
          <h2 className="font-display text-lg text-foreground">The blocks</h2>
          <BlockBoard
            pageId={page.id}
            blocks={blocks}
            pickers={{ faqs, categories }}
          />
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-foreground">
            The page&rsquo;s own details
          </h2>
          <CustomPageForm page={initial} />
        </section>
      </div>
    </div>
  );
}
