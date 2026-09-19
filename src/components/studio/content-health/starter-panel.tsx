"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { applyStarterContentAction, getStarterPlan } from "@/actions/starter";
import type { StarterReport } from "@/lib/starter/apply";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const ENTITY_LABELS: Record<string, string> = {
  Faq: "FAQs",
  Portfolio: "Concept studies",
  ResearchRecord: "Research records",
};

/**
 * Seed the genuine starter content, plan first.
 *
 * The plan is a separate round trip rather than server-rendered with the
 * page, because it is the answer to "what would this do to the live site
 * right now" and a cached one is worth less than no answer at all.
 */
export function StarterPanel({ counts }: { counts: Record<string, number> }) {
  const router = useRouter();
  const [planning, startPlanning] = useTransition();
  const [applying, startApplying] = useTransition();
  const [plan, setPlan] = useState<StarterReport | null>(null);
  const [publishFaqs, setPublishFaqs] = useState(true);

  function onPlan() {
    startPlanning(async () => {
      const result = await getStarterPlan();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data) setPlan(result.data);
    });
  }

  function onApply() {
    startApplying(async () => {
      const result = await applyStarterContentAction(publishFaqs);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const outcome = result.data;
      if (outcome) {
        setPlan(outcome);
        toast.success(
          `Added ${outcome.created} item${outcome.created === 1 ? "" : "s"}. ${outcome.skipped} already present and left alone.`,
        );
      } else {
        toast.success("Starter content applied.");
      }
      router.refresh();
    });
  }

  const totalAvailable = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-4 text-sm">
        {Object.entries(counts).map(([entity, count]) => (
          <div key={entity}>
            <dt className="text-muted-foreground">
              {ENTITY_LABELS[entity] ?? entity}
            </dt>
            <dd className="font-mono tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onPlan}
          disabled={planning || totalAvailable === 0}
        >
          {planning ? "Checking…" : "Preview what would be added"}
        </Button>
        <Button
          type="button"
          onClick={onApply}
          disabled={applying || !plan || plan.created === 0}
        >
          {applying ? "Adding…" : "Add the missing content"}
        </Button>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <Checkbox
          checked={publishFaqs}
          onCheckedChange={(v) => setPublishFaqs(v === true)}
        />
        <span>
          Publish the FAQs immediately
          <span className="block text-xs text-muted-foreground">
            On, they appear on the public FAQ page as soon as they are added.
            Off, they are created as drafts for you to review one by one.
            Concept studies are always created as drafts — they need
            photography before they are worth showing.
          </span>
        </span>
      </label>

      {plan && (
        <div className="rounded-md border border-border p-3 text-sm">
          <p className="mb-2 font-medium">
            {plan.applied ? "What was added" : "What would be added"}
          </p>
          <ul className="space-y-1 font-mono text-12 tabular-nums">
            {plan.byEntity.map((outcome) => (
              <li key={outcome.entity} className="flex justify-between gap-4">
                <span>{ENTITY_LABELS[outcome.entity] ?? outcome.entity}</span>
                <span>
                  {outcome.created} {plan.applied ? "added" : "to add"} ·{" "}
                  {outcome.skipped} already there
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing that already exists is changed. Anything you have edited
            stays exactly as you left it — this only ever adds what is missing.
          </p>
        </div>
      )}
    </div>
  );
}
