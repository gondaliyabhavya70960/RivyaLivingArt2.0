"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { markInquiryContacted } from "@/actions/inquiries";
import { Button } from "@/components/ui/button";
import type { InquirySource, InquiryStatus } from "@/generated/prisma/enums";
import { inquiryReplyWaLink } from "@/lib/inquiry-reply";

/**
 * "Reply on WhatsApp" that also marks the inquiry CONTACTED — plan §3 S3.
 *
 * The two halves already existed and never met: the detail page opened
 * WhatsApp without touching the status, and the status moved from a bulk bar
 * or a board select without opening anything. So an owner who replied and
 * forgot the second step left the queue lying about what was waiting on them,
 * which is the one thing the queue is for.
 *
 * **The window opens FIRST, synchronously in the click handler**, and the
 * Server Action runs after. A `window.open` awaited behind a network round
 * trip has lost its user gesture and is blocked as a popup — the storefront's
 * order flow already learned this and orders its two steps the same way. It
 * also means a failed status write costs the owner nothing: WhatsApp is
 * already open, and the toast says only the bookkeeping missed.
 *
 * The action moves NEW → CONTACTED only, so this is safe to put on every row
 * of a pipeline: replying to a CONFIRMED commission opens the chat and
 * reports nothing.
 */
export function WhatsAppReplyButton({
  inquiry,
  variant = "default",
  size = "sm",
  iconOnly = false,
  className,
}: {
  inquiry: {
    id: string;
    customerName: string;
    phone: string;
    source: InquirySource;
    status: InquiryStatus;
  };
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "icon";
  iconOnly?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = `Reply to ${inquiry.customerName} on WhatsApp`;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={busy}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={() => {
        window.open(
          inquiryReplyWaLink(inquiry),
          "_blank",
          "noopener,noreferrer",
        );
        if (inquiry.status !== "NEW") return;
        setBusy(true);
        void markInquiryContacted(inquiry.id)
          .then((result) => {
            if (!result.ok) {
              toast.error(`WhatsApp opened — ${result.error}`);
              return;
            }
            if (result.data?.moved) {
              toast.success("WhatsApp opened — marked contacted.");
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
    >
      <MessageCircle />
      {iconOnly ? <span className="sr-only">{label}</span> : "Reply on WhatsApp"}
    </Button>
  );
}
