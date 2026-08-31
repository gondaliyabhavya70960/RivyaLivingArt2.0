import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/studio/page-header";
import {
  PageForm,
  type PageFormInitial,
} from "@/components/studio/pages/page-form";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();

  const initial: PageFormInitial = {
    id: page.id,
    slug: page.slug,
    title: page.title,
    content: page.content,
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
    translations: page.translations,
  };

  return (
    <div>
      <PageHeader
        title={page.title}
        description="Edit the page — changes go live when saved."
      />
      <PageForm page={initial} />
    </div>
  );
}
