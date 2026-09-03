"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { removeDemoData, seedDemoData } from "@/actions/demo";
import { Button } from "@/components/ui/button";
import { PromptDialog } from "@/components/studio/prompt-dialog";

const REMOVE_CONFIRMATION = "REMOVE DEMO DATA";

/**
 * The Content Lab's two write actions. Seed is disabled (with a stated
 * reason) whenever the host guard refuses; Remove always shows, but the
 * typed-confirm dialog is the thing standing between a click and 400+ rows
 * disappearing.
 */
export function ActionsPanel({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [seeding, startSeed] = useTransition();
  const [removing, startRemove] = useTransition();
  const [removeOpen, setRemoveOpen] = useState(false);

  function onSeed() {
    startSeed(async () => {
      const result = await seedDemoData();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Content Lab fixtures seeded.");
      router.refresh();
    });
  }

  function onRemove(typed: string) {
    startRemove(async () => {
      const result = await removeDemoData(typed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Every demo row has been removed.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-1">
        <Button onClick={onSeed} disabled={!canWrite || seeding}>
          {seeding ? "Seeding…" : "Seed demo fixtures"}
        </Button>
        {!canWrite && (
          <p className="text-xs text-muted-foreground">
            Disabled — this database is not allow-listed for demo writes.
          </p>
        )}
      </div>
      <Button
        variant="outline"
        onClick={() => setRemoveOpen(true)}
        disabled={removing}
      >
        {removing ? "Removing…" : "Remove all demo data"}
      </Button>
      <PromptDialog
        key={removeOpen ? "open" : "closed"}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove all demo data"
        description={`This deletes every Content Lab fixture across every table — products, journal posts, case studies, testimonials, FAQs, landing pages, media, inquiries, research notes and scraper staging rows. Type "${REMOVE_CONFIRMATION}" to confirm.`}
        label="Confirmation"
        placeholder={REMOVE_CONFIRMATION}
        submitLabel="Remove"
        validate={(value) =>
          value === REMOVE_CONFIRMATION
            ? null
            : `Type "${REMOVE_CONFIRMATION}" exactly.`
        }
        onSubmit={onRemove}
      />
    </div>
  );
}
