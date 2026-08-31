"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { InquiryStatus } from "@/generated/prisma/enums";
import { setInquiriesStatus, updateInquiryPricing } from "@/actions/inquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SELECTABLE_STATUSES,
  STATUS_LABELS,
} from "@/components/studio/inquiries/labels";

/** Copies the exact WhatsApp message so staff can paste it anywhere. */
export function CopyMessageButton({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Message copied to clipboard.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the text manually.");
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="min-h-11"
      onClick={handleCopy}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** "" ⇒ null (clears the field); digits only, whole rupees, 1-crore cap. */
const parsePriceInput = (raw: string): number | null | "invalid" => {
  const digits = raw.trim().replace(/[,\s]/g, "");
  if (!digits) return null;
  if (!/^\d{1,8}$/.test(digits)) return "invalid";
  const value = Number(digits);
  return value > 10_000_000 ? "invalid" : value;
};

/**
 * Records the price agreed in the WhatsApp thread (DESIGN.md C1). Pure
 * bookkeeping — no payment machinery exists anywhere on the site (Part 0).
 */
export function InquiryPricingForm({
  id,
  quotedPrice,
  finalPrice,
  staffNotes,
}: {
  id: string;
  quotedPrice: number | null;
  finalPrice: number | null;
  staffNotes: string | null;
}) {
  const router = useRouter();
  const [quoted, setQuoted] = useState(quotedPrice?.toString() ?? "");
  const [final, setFinal] = useState(finalPrice?.toString() ?? "");
  const [notes, setNotes] = useState(staffNotes ?? "");
  const [busy, setBusy] = useState(false);

  // Live per-field validity → inline errors announced via aria-describedby,
  // instead of a toast a screen-reader user can't tie back to the field.
  const quotedInvalid = parsePriceInput(quoted) === "invalid";
  const finalInvalid = parsePriceInput(final) === "invalid";

  async function handleSave() {
    if (busy) return; // Save stays focusable (aria-disabled), so guard here.
    const nextQuoted = parsePriceInput(quoted);
    const nextFinal = parsePriceInput(final);
    if (nextQuoted === "invalid" || nextFinal === "invalid") {
      toast.error("Prices must be whole rupees, up to ₹1,00,00,000.");
      return;
    }

    setBusy(true);
    const result = await updateInquiryPricing(id, {
      quotedPrice: nextQuoted,
      finalPrice: nextFinal,
      staffNotes: notes.trim() ? notes.trim() : null,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pricing & notes saved.");
    router.refresh();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inquiry-quoted-price">Quoted price</Label>
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground"
            >
              ₹
            </span>
            <Input
              id="inquiry-quoted-price"
              inputMode="numeric"
              autoComplete="off"
              value={quoted}
              onChange={(e) => setQuoted(e.target.value)}
              placeholder="—"
              disabled={busy}
              aria-invalid={quotedInvalid || undefined}
              aria-describedby={
                quotedInvalid ? "inquiry-quoted-price-error" : undefined
              }
              className="pl-8 font-mono"
            />
          </div>
          {quotedInvalid && (
            <p
              id="inquiry-quoted-price-error"
              className="text-xs text-destructive"
            >
              Whole rupees only, up to ₹1,00,00,000.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inquiry-final-price">Final price</Label>
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground"
            >
              ₹
            </span>
            <Input
              id="inquiry-final-price"
              inputMode="numeric"
              autoComplete="off"
              value={final}
              onChange={(e) => setFinal(e.target.value)}
              placeholder="—"
              disabled={busy}
              aria-invalid={finalInvalid || undefined}
              aria-describedby={
                finalInvalid ? "inquiry-final-price-error" : undefined
              }
              className="pl-8 font-mono"
            />
          </div>
          {finalInvalid && (
            <p
              id="inquiry-final-price-error"
              className="text-xs text-destructive"
            >
              Whole rupees only, up to ₹1,00,00,000.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inquiry-staff-notes">Staff notes</Label>
        <Textarea
          id="inquiry-staff-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={5000}
          placeholder="Delivery details, agreed timeline, follow-ups…"
          disabled={busy}
        />
      </div>

      <Button type="submit" aria-disabled={busy} className="min-h-11 w-full">
        {busy ? "Saving…" : "Save pricing & notes"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Recorded from your WhatsApp conversation — nothing is charged here.
      </p>
    </form>
  );
}

/** Single-inquiry status workflow — reuses the bulk action with one id. */
export function InquiryStatusSelect({
  id,
  status,
}: {
  id: string;
  status: InquiryStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleChange(value: string) {
    const next = value as InquiryStatus;
    if (next === status) return;
    setBusy(true);
    const result = await setInquiriesStatus([id], next);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Marked as ${STATUS_LABELS[next].toLowerCase()}.`);
    router.refresh();
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={busy}>
      <SelectTrigger aria-label="Update status" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SELECTABLE_STATUSES.map((option) => (
          <SelectItem key={option} value={option}>
            {STATUS_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
