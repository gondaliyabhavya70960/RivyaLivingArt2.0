import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/studio/inquiries/print-button";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { editorialName } from "@/lib/product-name";
import { formatInquiryNumber } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Commission card" };

/**
 * Printable Commission Card (external audit OPS-02) — the authenticity card
 * that travels with a confirmed commission: reference number, piece, client,
 * material and care, on the studio's letterhead register. Lives OUTSIDE the
 * (dashboard) group on purpose: the studio root layout carries no sidebar
 * chrome, so the browser's print dialog captures exactly the card (the
 * toolbar hides itself with print:hidden). Route is still under /studio, so
 * the proxy auth guard applies unchanged.
 *
 * Every line is real data from the inquiry/product/settings rows — fields
 * without data simply don't print (no-invented-content rule).
 */
export default async function CommissionCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [inquiry, settings] = await Promise.all([
    db.inquiry.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            title: true,
            displayName: true,
            materials: true,
            careNotes: true,
            timeline: true,
          },
        },
      },
    }),
    db.siteSettings.findUnique({
      where: { id: "main" },
      select: { defaultCareNotes: true },
    }),
  ]);
  if (!inquiry) notFound();

  const pieceName = inquiry.product
    ? editorialName(inquiry.product.displayName, inquiry.product.title)
    : "Custom commission";
  const careNotes =
    inquiry.product?.careNotes?.trim() ||
    settings?.defaultCareNotes?.trim() ||
    null;
  const rows: { label: string; value: string }[] = [
    { label: "Piece", value: pieceName },
    { label: "Commissioned by", value: inquiry.customerName },
    {
      label: "Commissioned",
      value: new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(
        inquiry.createdAt,
      ),
    },
    ...(inquiry.product?.materials?.trim()
      ? [{ label: "Material", value: inquiry.product.materials.trim() }]
      : []),
    ...(inquiry.product?.timeline?.trim()
      ? [{ label: "Crafting time", value: inquiry.product.timeline.trim() }]
      : []),
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      {/* Screen-only toolbar. */}
      <div className="mb-8 flex items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link href={`/studio/inquiries/${inquiry.id}`}>
            <ArrowLeft /> Back to inquiry
          </Link>
        </Button>
        <PrintButton label="Print card" />
      </div>

      {/* The card itself — hairline frame on the studio's paper. */}
      <section
        aria-label="Commission card"
        className="border border-border bg-card px-10 py-12 shadow-sm print:border-foreground/30 print:shadow-none"
      >
        <p className="font-mono text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
          Commission card
        </p>
        <h1 className="mt-3 font-display text-4xl text-foreground">
          Rivya Living Art
        </h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {formatInquiryNumber(inquiry.number)}
        </p>

        <dl className="mt-10 border-t border-border">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[10rem_1fr] gap-x-6 border-b border-border py-3.5"
            >
              <dt className="pt-0.5 font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
                {row.label}
              </dt>
              <dd className="min-w-0 text-sm leading-relaxed text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        {careNotes && (
          <div className="mt-8">
            <h2 className="font-mono text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
              Care
            </h2>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-foreground/80">
              {careNotes}
            </p>
          </div>
        )}

        <p className="mt-10 border-t border-border pt-6 font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
          Hand poured · Made to order · store.bhavyagondaliya.co.in
        </p>
      </section>
    </main>
  );
}
