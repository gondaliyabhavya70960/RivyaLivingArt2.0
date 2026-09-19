"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  removeDemoSelectionAction,
  type DemoInventoryEntity,
} from "@/actions/demo";
import {
  DEMO_REMOVAL_PHRASE,
  describeSelectionProblem,
  requiresTypedConfirmation,
  type DemoEntity,
  type DemoRemovalReport,
  type DemoSelection,
} from "@/lib/demo/selective";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PromptDialog } from "@/components/studio/prompt-dialog";

/**
 * The Demo Data Manager.
 *
 * `ActionsPanel`'s Remove button is all-or-nothing; this is the scoped
 * version — tick whole content types, or expand one and tick individual rows.
 *
 * `describeSelectionProblem` is called HERE as well as in the action, for the
 * reason the other studio guardrails give in their own headers: `runAction`
 * reports every throw as "something went wrong", which is the wrong message
 * for "nothing is selected". The action is still the authority; this is the
 * copy of the rule that can speak.
 */
export function DemoManager({
  inventory,
  total,
}: {
  inventory: DemoInventoryEntity[];
  total: number;
}) {
  const router = useRouter();
  const [pending, startRemoving] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [report, setReport] = useState<DemoRemovalReport | null>(null);

  /** Content types selected wholesale. */
  const [entities, setEntities] = useState<DemoEntity[]>([]);
  /** Individually ticked rows, per content type. */
  const [rows, setRows] = useState<Partial<Record<DemoEntity, string[]>>>({});
  const [expanded, setExpanded] = useState<DemoEntity | null>(null);

  const selection: DemoSelection = useMemo(
    () => ({ entities, ids: rows }),
    [entities, rows],
  );

  const selectedCount = useMemo(() => {
    const wholesale = new Set(entities);
    let count = 0;
    for (const item of inventory) {
      if (wholesale.has(item.entity)) count += item.count;
      else count += (rows[item.entity] ?? []).length;
    }
    return count;
  }, [entities, rows, inventory]);

  const problem = describeSelectionProblem(selection, DEMO_REMOVAL_PHRASE);
  const needsPhrase = requiresTypedConfirmation(selection);
  const withData = inventory.filter((item) => item.count > 0);

  function toggleEntity(entity: DemoEntity, on: boolean) {
    setEntities((prev) =>
      on ? [...prev, entity] : prev.filter((e) => e !== entity),
    );
    // Ticking a whole type makes its individual ticks meaningless; clearing
    // them here keeps the count the owner reads equal to the count that runs.
    if (on) setRows((prev) => ({ ...prev, [entity]: [] }));
  }

  function toggleRow(entity: DemoEntity, id: string, on: boolean) {
    setRows((prev) => {
      const current = prev[entity] ?? [];
      return {
        ...prev,
        [entity]: on ? [...current, id] : current.filter((r) => r !== id),
      };
    });
  }

  function selectAll() {
    setEntities(withData.map((item) => item.entity));
    setRows({});
  }

  function clearSelection() {
    setEntities([]);
    setRows({});
    setReport(null);
  }

  function run(typed: string) {
    startRemoving(async () => {
      const result = await removeDemoSelectionAction(selection, typed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // `ActionResult.data` is optional on the ok branch, so the report is
      // narrowed rather than asserted — an ok with no payload should refresh
      // the screen, not crash it.
      const outcome = result.data;
      clearSelection();
      if (outcome) {
        setReport(outcome);
        toast.success(
          `Removed ${outcome.deleted} demo row${outcome.deleted === 1 ? "" : "s"}.`,
        );
      } else {
        toast.success("Demo data removed.");
      }
      router.refresh();
    });
  }

  function onRemoveClick() {
    if (problem) {
      toast.error(problem);
      return;
    }
    if (needsPhrase) {
      setConfirmOpen(true);
      return;
    }
    run("");
  }

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        There is no demo data in this database, so there is nothing to manage.
        Demo rows only exist where Content Lab fixtures have been seeded — this
        screen fills in as soon as they are.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={selectAll}>
          Select all demo data
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          disabled={selectedCount === 0}
        >
          Clear selection
        </Button>
        <span className="font-mono text-12 text-muted-foreground tabular-nums">
          {selectedCount} of {total} selected
        </span>
      </div>

      <ul className="divide-y divide-border rounded-md border border-border">
        {withData.map((item) => {
          const whole = entities.includes(item.entity);
          const ticked = rows[item.entity] ?? [];
          const isOpen = expanded === item.entity;
          return (
            <li key={item.entity} className="p-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`demo-${item.entity}`}
                  checked={whole}
                  onCheckedChange={(v) => toggleEntity(item.entity, v === true)}
                  aria-label={`Select every demo row in ${item.label}`}
                />
                <label
                  htmlFor={`demo-${item.entity}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  {item.label}
                </label>
                <span className="font-mono text-12 text-muted-foreground tabular-nums">
                  {whole
                    ? `${item.count} (all)`
                    : ticked.length > 0
                      ? `${ticked.length} of ${item.count}`
                      : item.count}
                </span>
                {item.rows.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(isOpen ? null : item.entity)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? "Hide rows" : "Pick rows"}
                  </Button>
                )}
              </div>

              {isOpen && (
                <div className="mt-3 ms-7 flex flex-col gap-2">
                  {item.truncated && (
                    <p className="text-xs text-muted-foreground">
                      Showing the first {item.rows.length} of {item.count}. To
                      remove them all, tick the content type itself rather than
                      the rows.
                    </p>
                  )}
                  {item.rows.map((row) => (
                    <div key={row.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`demo-row-${row.id}`}
                        checked={whole || ticked.includes(row.id)}
                        disabled={whole}
                        onCheckedChange={(v) =>
                          toggleRow(item.entity, row.id, v === true)
                        }
                      />
                      <label
                        htmlFor={`demo-row-${row.id}`}
                        className="flex-1 cursor-pointer truncate text-sm"
                        title={row.label}
                      >
                        {row.label}
                      </label>
                      <span className="font-mono text-12 text-muted-foreground">
                        {row.meta}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="destructive"
          onClick={onRemoveClick}
          disabled={pending || selectedCount === 0}
        >
          {pending ? "Removing…" : "Delete selected demo data"}
        </Button>
        {needsPhrase && selectedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Clearing a whole content type asks you to type{" "}
            <span className="font-mono">{DEMO_REMOVAL_PHRASE}</span> first.
          </p>
        )}
      </div>

      {report && (
        <div className="rounded-md border border-border p-3 text-sm">
          <p className="mb-2 font-medium">What happened</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-12 tabular-nums sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Selected</dt>
              <dd>{report.selected}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Deleted</dt>
              <dd>{report.deleted}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Protected</dt>
              <dd>{report.protectedRows}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Already gone</dt>
              <dd>{report.missing}</dd>
            </div>
          </dl>
          {report.protectedRows > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Protected rows are no longer classified as demo, so they were left
              alone.
            </p>
          )}
          {report.sharedMediaPreserved.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">
                {report.sharedMediaPreserved.length} media file
                {report.sharedMediaPreserved.length === 1 ? " is" : "s are"} also
                used by genuine content, so the file was kept:
              </p>
              <ul className="mt-1 list-disc ps-5 text-xs text-muted-foreground">
                {report.sharedMediaPreserved.slice(0, 8).map((m) => (
                  <li key={m.url} className="truncate">
                    {m.url} — {m.usedBy.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {confirmOpen && (
        <PromptDialog
          key="demo-selection-confirm"
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Remove demo data"
          description={`This deletes ${selectedCount} demo row${selectedCount === 1 ? "" : "s"}. Genuine content is never touched, and a media file shared with genuine content is kept.`}
          label={`Type ${DEMO_REMOVAL_PHRASE} to confirm`}
          placeholder={DEMO_REMOVAL_PHRASE}
          submitLabel="Remove"
          validate={(value) =>
            value === DEMO_REMOVAL_PHRASE
              ? null
              : `Type "${DEMO_REMOVAL_PHRASE}" exactly.`
          }
          onSubmit={run}
        />
      )}
    </div>
  );
}
