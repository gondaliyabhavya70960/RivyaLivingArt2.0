import type { Metadata } from "next";

import {
  FaqList,
  NewFaqButton,
  type FaqRow,
} from "@/components/studio/faqs/faq-list";
import { PageHeader } from "@/components/studio/page-header";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "FAQs" };

export default async function FaqsPage() {
  const faqs = await db.faq.findMany({
    orderBy: [{ order: "asc" }, { question: "asc" }],
  });

  const rows: FaqRow[] = faqs.map((faq) => ({
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    order: faq.order,
    translations: faq.translations,
  }));

  return (
    <>
      <PageHeader
        title="FAQs"
        description="Answers to the questions shoppers ask most — shown on the public FAQ page."
        actions={<NewFaqButton />}
      />
      <FaqList faqs={rows} />
    </>
  );
}
