"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SummaryRow = {
  label: string;
  /** Empty, null or undefined renders as an em dash in graphite — the point
   *  of the card is that the visitor can see what is still missing. */
  value?: string | null;
};

/**
 * WhatsAppSummaryCard — REDESIGN.md §4.6, §9.2, §10.4.
 *
 * The live summary is genuinely good UX and the spec keeps the functionality
 * untouched; what changes is the presentation:
 *
 * - Mono text on a sand ground, radius `4px 4px 4px 0` — the square corner is
 *   the tail of a chat bubble, and it is the only asymmetric radius on the
 *   site.
 * - **Empty fields render as `Name: —`** in graphite, so the card doubles as a
 *   checklist of what the message is still missing.
 * - **Collapsed by default** behind `Preview your message ▾`. It used to sit
 *   open beneath the CTA, pushing the action off screen on a phone.
 *
 * The message body is rendered verbatim, whitespace preserved: what the
 * visitor reads here is exactly what `wa.me` receives (Part 0). This component
 * never builds or mutates the message — the order flow owns that.
 *
 * Placement is the caller's job: a sticky right column on desktop, an
 * expandable bottom sheet on mobile.
 */
export function WhatsAppSummaryCard({
  title,
  toggleLabel,
  rows,
  message,
  messageLabel,
  note,
  defaultOpen = false,
  className,
}: {
  /** Visually hidden section label, e.g. "Your order summary". */
  title: string;
  /** The disclosure trigger, e.g. "Preview your message". */
  toggleLabel: string;
  rows: SummaryRow[];
  /** The exact WhatsApp message. */
  message: string;
  /** Mono caption above the message body. */
  messageLabel: string;
  /** Optional lead line — e.g. the out-of-stock availability note. */
  note?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      data-slot="sf-wa-summary"
      aria-label={title}
      className={cn(
        "overflow-hidden rounded-[4px_4px_4px_0] border border-hairline bg-sand",
        className,
      )}
    >
      {note ? (
        <p className="u-micro border-b border-hairline px-5 py-3 text-champagne-ink">
          {note}
        </p>
      ) : null}

      <dl className="grid gap-3 p-5">
        {rows.map((row) => {
          const value = row.value?.trim();
          return (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4"
            >
              <dt className="u-micro shrink-0">{row.label}</dt>
              <dd
                className={cn(
                  "u-num text-end text-14 break-words",
                  value ? "text-ink" : "text-graphite",
                )}
              >
                {value || "—"}
              </dd>
            </div>
          );
        })}
      </dl>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="u-micro flex min-h-14 w-full items-center justify-between gap-3 border-t border-hairline px-5 text-start text-ink outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:text-sapphire focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset motion-reduce:transition-none"
      >
        {toggleLabel}
        <ChevronDown
          aria-hidden
          strokeWidth={1.5}
          className={cn(
            "size-4 shrink-0 transition-transform duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {/* grid-template-rows 0fr → 1fr, the site's one accordion mechanism
          (§4.6). `hidden` on the closed panel keeps it out of the tab order
          and out of the accessibility tree. */}
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden" hidden={!open}>
          <div className="border-t border-hairline px-5 py-4">
            <p className="u-micro mb-2">{messageLabel}</p>
            <p className="font-mono text-12 leading-relaxed break-words whitespace-pre-wrap text-ink">
              {message}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
