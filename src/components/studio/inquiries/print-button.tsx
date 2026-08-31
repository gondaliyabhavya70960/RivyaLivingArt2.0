"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Fires the browser print dialog — the commission card page is its own
 *  chrome-free route, so what prints is exactly the card. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button size="sm" className="min-h-11" onClick={() => window.print()}>
      <Printer /> {label}
    </Button>
  );
}
