"use client";

/**
 * The Recompute button for the similarity surface (B9). Explicit by design —
 * embeddings only move when the owner asks — so the button reports exactly
 * what the run did: how many rows were rewritten, how many were kept
 * unchanged, how many products had no signal to embed.
 */

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { recomputeScraperEmbeddings } from "@/actions/scraper-embeddings";
import { Button } from "@/components/ui/button";

export function RecomputeEmbeddingsButton() {
  const [pending, startTransition] = useTransition();
  const [lastReport, setLastReport] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      const res = await recomputeScraperEmbeddings();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const report = res.data!;
      const summary = `${report.written} embedded · ${report.unchanged} unchanged · ${report.noSignal} no signal`;
      setLastReport(summary);
      toast.success(`Embeddings recomputed — ${summary}.`);
    });

  return (
    <div className="flex items-center gap-3">
      {lastReport && (
        <p className="text-xs text-muted-foreground">{lastReport}</p>
      )}
      <Button onClick={run} disabled={pending} size="sm" variant="outline">
        <RefreshCw className={pending ? "animate-spin" : undefined} />
        {pending ? "Recomputing…" : "Recompute embeddings"}
      </Button>
    </div>
  );
}
