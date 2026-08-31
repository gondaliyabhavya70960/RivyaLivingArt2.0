import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * v2.0 Order-summary preview card (DESIGN.md B3 · B2 order flow step 5):
 * the live preview that mirrors the EXACT WhatsApp message — `message` is
 * rendered verbatim (whitespace preserved, Plex Mono per A3 microcopy) so
 * what the customer reads here is what wa.me receives. Server component:
 * purely presentational; the parent order flow owns state and passes the
 * built message down. No buttons here — the Place Order action (Server
 * Action → Inquiry record → wa.me redirect, Part 0 journey steps 4–5) lands
 * with the Phase 2/3 order flow. Price never appears unless the flow puts it
 * in the message; the final price is quoted in WhatsApp (Part 0).
 */
export function OrderSummaryPreview({
  message,
  productTitle,
  selections,
  customer,
  className,
}: {
  message: string;
  productTitle: string;
  selections: { label: string; value: string }[];
  customer: { name: string; phone: string; email?: string };
  className?: string;
}) {
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Product", value: productTitle },
    ...selections,
    { label: "Name", value: customer.name },
    { label: "Phone", value: customer.phone, mono: true },
    ...(customer.email ? [{ label: "Email", value: customer.email }] : []),
  ];

  return (
    <section
      data-slot="sf-order-summary-preview"
      aria-label="Your order summary"
      className={cn(
        "overflow-hidden rounded-card border border-hairline bg-sand",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-6 py-4">
        <h3 className="font-body text-14 font-medium text-ink">
          Your order summary
        </h3>
        <MessageCircle
          aria-hidden
          strokeWidth={1.5}
          className="size-4 shrink-0 text-sapphire"
        />
      </header>

      <div className="grid gap-6 p-6">
        <dl className="grid gap-4">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-0.5">
              <dt className="font-body text-12 tracking-[0.08em] text-graphite uppercase">
                {row.label}
              </dt>
              <dd
                className={cn(
                  "text-14 text-ink",
                  row.mono ? "font-mono" : "font-body",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-2">
          <p className="font-body text-12 text-graphite">
            WhatsApp message preview
          </p>
          <p className="rounded-input bg-sand/60 p-4 font-mono text-12 break-words whitespace-pre-wrap text-ink">
            {message}
          </p>
        </div>
      </div>
    </section>
  );
}
