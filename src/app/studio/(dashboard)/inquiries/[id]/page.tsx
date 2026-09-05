import type { ReactNode } from "react";
import { isOptimizableImageSrc } from "@/lib/image-src";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, IdCard, ExternalLink, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { buildWaLink, formatInquiryNumber } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SOURCE_BADGE_VARIANTS,
  SOURCE_LABELS,
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
} from "@/components/studio/inquiries/labels";
import {
  CopyMessageButton,
  InquiryPricingForm,
  InquiryStatusSelect,
} from "@/components/studio/inquiries/inquiry-detail-controls";

export const metadata: Metadata = { title: "Inquiry" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "long",
  timeStyle: "short",
});

/** Json selection values → readable text; arrays are joined. */
const formatSelectionValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(formatSelectionValue).join(", ");
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

function DetailCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-e1">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-foreground">{title}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const inquiry = await db.inquiry.findUnique({
    where: { id },
    include: { product: { select: { id: true, title: true } } },
  });
  if (!inquiry) notFound();

  const selections =
    inquiry.selections &&
    typeof inquiry.selections === "object" &&
    !Array.isArray(inquiry.selections)
      ? Object.entries(inquiry.selections as Record<string, unknown>)
      : [];
  const referenceImages = asStringArray(inquiry.referenceImageUrls);
  const attributionEntries =
    inquiry.attribution &&
    typeof inquiry.attribution === "object" &&
    !Array.isArray(inquiry.attribution)
      ? Object.entries(inquiry.attribution as Record<string, unknown>)
      : [];
  // Reply to the CUSTOMER, not the studio's own number (UIUX-604): build the
  // deep link from inquiry.phone with a short reply opener. CopyMessageButton
  // still copies the customer's original inbound message.
  const firstName =
    inquiry.customerName.trim().split(/\s+/)[0] || inquiry.customerName;
  const replyGreeting = `Hi ${firstName}, thanks for reaching out to Rivya Living Art about your ${SOURCE_LABELS[
    inquiry.source
  ].toLowerCase()}.`;
  const customerWaLink = buildWaLink(
    replyGreeting,
    inquiry.phone.replace(/[^0-9]/g, ""),
  );

  return (
    <div>
      {/* Masthead — inline (not PageHeader) so the RR reference can sit
          beside the name in the A3 mono accent face. */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-3xl text-foreground">
              {inquiry.customerName}
            </h1>
            <span className="font-mono text-sm text-muted-foreground">
              {formatInquiryNumber(inquiry.number)}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {`${SOURCE_LABELS[inquiry.source]} inquiry · received ${dateFormatter.format(inquiry.createdAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Commission card (audit OPS-02) — once the piece is real work. */}
          {["CONFIRMED", "IN_PRODUCTION", "DELIVERED"].includes(
            inquiry.status,
          ) && (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link
                href={`/studio/inquiries/${inquiry.id}/card`}
                target="_blank"
              >
                <IdCard /> Commission card
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="min-h-11">
            <Link href="/studio/inquiries">
              <ArrowLeft /> All inquiries
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <DetailCard
            title="WhatsApp message"
            actions={
              <>
                <CopyMessageButton message={inquiry.whatsappMessage} />
                <Button asChild size="sm" className="min-h-11">
                  <a href={customerWaLink} target="_blank" rel="noreferrer">
                    <MessageCircle /> Reply on WhatsApp
                  </a>
                </Button>
              </>
            }
          >
            <pre className="whitespace-pre-wrap break-words rounded-card bg-muted/60 p-4 font-sans text-sm leading-relaxed text-foreground">
              {inquiry.whatsappMessage}
            </pre>
          </DetailCard>

          {selections.length > 0 && (
            <DetailCard title="Selections">
              <dl className="divide-y divide-border">
                {selections.map(([key, value]) => (
                  <div
                    key={key}
                    className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-3 sm:gap-4"
                  >
                    <dt className="text-sm font-medium text-muted-foreground">
                      {key}
                    </dt>
                    <dd className="text-sm text-foreground sm:col-span-2">
                      {formatSelectionValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </DetailCard>
          )}

          {referenceImages.length > 0 && (
            <DetailCard title="Reference images">
              <div className="flex flex-wrap gap-3">
                {referenceImages.map((url, index) => (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block overflow-hidden rounded-lg border border-border"
                    aria-label={`Open reference image ${index + 1} in a new tab`}
                  >
                    <Image
                      src={url}
                      unoptimized={!isOptimizableImageSrc(url)}
                      alt={`Reference image ${index + 1}`}
                      width={112}
                      height={112}
                      className="size-28 object-cover transition-transform duration-(--dur-fast) group-hover:scale-105"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition-opacity group-hover:bg-foreground/40 group-hover:opacity-100">
                      <ExternalLink className="size-4 text-white" />
                    </span>
                  </a>
                ))}
              </div>
            </DetailCard>
          )}

          {attributionEntries.length > 0 && (
            <DetailCard title="Marketing attribution">
              <dl className="divide-y divide-border">
                {attributionEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-3 sm:gap-4"
                  >
                    <dt className="text-sm font-medium text-muted-foreground">
                      {key}
                    </dt>
                    <dd className="text-sm break-words text-foreground sm:col-span-2">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </DetailCard>
          )}

          {(inquiry.budgetRange || inquiry.timeline || inquiry.notes) && (
            <DetailCard title="Request details">
              <dl className="divide-y divide-border">
                {inquiry.budgetRange && (
                  <div className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-muted-foreground">
                      Budget
                    </dt>
                    <dd className="text-sm text-foreground sm:col-span-2">
                      {inquiry.budgetRange}
                    </dd>
                  </div>
                )}
                {inquiry.timeline && (
                  <div className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-muted-foreground">
                      Timeline
                    </dt>
                    <dd className="text-sm text-foreground sm:col-span-2">
                      {inquiry.timeline}
                    </dd>
                  </div>
                )}
                {inquiry.notes && (
                  <div className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-muted-foreground">
                      Notes
                    </dt>
                    <dd className="whitespace-pre-wrap text-sm text-foreground sm:col-span-2">
                      {inquiry.notes}
                    </dd>
                  </div>
                )}
              </dl>
            </DetailCard>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <DetailCard title="Status">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant={SOURCE_BADGE_VARIANTS[inquiry.source]}>
                {SOURCE_LABELS[inquiry.source]}
              </Badge>
              <Badge variant={STATUS_BADGE_VARIANTS[inquiry.status]}>
                {STATUS_LABELS[inquiry.status]}
              </Badge>
            </div>
            <InquiryStatusSelect id={inquiry.id} status={inquiry.status} />
          </DetailCard>

          <DetailCard title="Pricing & notes">
            <InquiryPricingForm
              id={inquiry.id}
              quotedPrice={inquiry.quotedPrice}
              finalPrice={inquiry.finalPrice}
              staffNotes={inquiry.staffNotes}
            />
          </DetailCard>

          <DetailCard title="Customer">
            <div className="space-y-1.5 text-sm">
              <p className="font-medium text-foreground">
                {inquiry.customerName}
              </p>
              <p>
                <a
                  href={`tel:${inquiry.phone}`}
                  className="text-sapphire-ink hover:underline"
                >
                  {inquiry.phone}
                </a>
              </p>
              {inquiry.email && (
                <p>
                  <a
                    href={`mailto:${inquiry.email}`}
                    className="text-sapphire-ink hover:underline"
                  >
                    {inquiry.email}
                  </a>
                </p>
              )}
            </div>
          </DetailCard>

          {inquiry.productId && inquiry.product && (
            <DetailCard title="Product">
              <Link
                href={`/studio/products/${inquiry.productId}`}
                className="text-sm font-medium text-sapphire-ink hover:underline"
              >
                {inquiry.product.title}
              </Link>
            </DetailCard>
          )}
        </div>
      </div>
    </div>
  );
}
