"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Moon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addCustomBlock,
  deleteCustomBlock,
  reorderCustomBlocks,
} from "@/actions/custom-pages";
import { BlockFields } from "@/components/studio/custom-pages/block-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CUSTOM_BLOCKS,
  CUSTOM_BLOCK_TYPES,
  describeBlockArrangementNotice,
  describeBlockArrangementProblem,
  defaultBlockData,
  resolveBlockGrounds,
  type CustomBlockType,
} from "@/lib/custom-blocks";
import { cn } from "@/lib/utils";

export type BlockRow = {
  id: string;
  type: CustomBlockType;
  data: Record<string, unknown>;
  translations: unknown;
};

export type BlockPickers = {
  faqs: { id: string; question: string }[];
  categories: { slug: string; name: string }[];
};

/**
 * The blocks on one landing page, in the order they read.
 *
 * Up/down rather than drag, for the reason the section board gives: a keyboard
 * user gets the same control as a mouse user with no drag library, and the
 * list is six-ish items. The refusal rules run here before the call — the
 * action refuses too, but `runAction` flattens every throw to "something went
 * wrong", and "you cannot do that" with no subject is a dead end.
 *
 * Each block saves itself. A page-wide Save would mean one slip loses six
 * blocks of writing, and there is no publish step to batch them into: the page
 * is already a draft until its status says otherwise.
 */
export function BlockBoard({
  pageId,
  blocks,
  pickers,
}: {
  pageId: string;
  blocks: readonly BlockRow[];
  pickers: BlockPickers;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const grounds = resolveBlockGrounds(blocks);
  const notice = describeBlockArrangementNotice(blocks);

  async function move(id: string, delta: number) {
    const ids = blocks.map((b) => b.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];

    const byId = new Map(blocks.map((b) => [b.id, b]));
    const problem = describeBlockArrangementProblem(
      ids.map((blockId) => byId.get(blockId)!),
    );
    if (problem) {
      toast.error(problem);
      return;
    }

    setBusy(true);
    const res = await reorderCustomBlocks({ pageId, ids });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function add(type: CustomBlockType) {
    const problem = describeBlockArrangementProblem([
      ...blocks,
      { type, data: defaultBlockData(type) },
    ]);
    if (problem) {
      toast.error(problem);
      return;
    }

    setBusy(true);
    const res = await addCustomBlock({ pageId, type });
    setBusy(false);
    setAdding(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) setOpen(res.data.id);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await deleteCustomBlock(id);
    setBusy(false);
    setConfirmDelete(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (open === id) setOpen(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-alert/40 bg-alert/5 p-3 text-small text-foreground"
        >
          {notice}
        </p>
      )}
      {blocks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-small text-graphite">
          No blocks yet. A lander usually opens with a hero and closes with an
          invitation; everything between is up to you.
        </p>
      ) : (
        <ol className="space-y-3">
          {blocks.map((block, index) => {
            const def = CUSTOM_BLOCKS[block.type];
            const expanded = open === block.id;
            return (
              <li
                key={block.id}
                className="rounded-2xl border border-border bg-card"
              >
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-12 text-graphite">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-small font-medium text-foreground">
                        {def.label}
                      </span>
                      {grounds[index] === "obsidian" && (
                        <Badge variant="secondary">
                          <Moon aria-hidden className="me-1 size-3" />
                          Dark band
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-graphite">
                      {summarise(block) || def.description}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy || index === 0}
                      onClick={() => move(block.id, -1)}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                      <span className="sr-only">Move {def.label} up</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy || index === blocks.length - 1}
                      onClick={() => move(block.id, 1)}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                      <span className="sr-only">Move {def.label} down</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : block.id)}
                    >
                      {expanded ? "Close" : "Edit"}
                    </Button>
                    {confirmDelete === block.id ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => remove(block.id)}
                        >
                          Remove it
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setConfirmDelete(null)}
                        >
                          Keep
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmDelete(block.id)}
                      >
                        <Trash2 aria-hidden className="size-4" />
                        <span className="sr-only">Delete {def.label}</span>
                      </Button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-border p-4">
                    <BlockFields block={block} pickers={pickers} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {adding ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-small font-medium text-foreground">
              Add a block
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {CUSTOM_BLOCK_TYPES.map((type) => {
              const def = CUSTOM_BLOCKS[type];
              const used = def.once && blocks.some((b) => b.type === type);
              return (
                <li key={type}>
                  <button
                    type="button"
                    disabled={busy || used}
                    onClick={() => add(type)}
                    className={cn(
                      "w-full rounded-xl border border-border p-3 text-start transition-colors",
                      used
                        ? "cursor-not-allowed opacity-50"
                        : "hover:border-foreground",
                    )}
                  >
                    <span className="block text-small font-medium text-foreground">
                      {def.label}
                      {used ? " — already on this page" : ""}
                    </span>
                    <span className="block text-xs text-graphite">
                      {def.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setAdding(true)}
        >
          <Plus aria-hidden className="size-4" />
          Add a block
        </Button>
      )}
    </div>
  );
}

/** The first words in a block, so a collapsed row says which one it is. */
function summarise(block: BlockRow): string {
  const data = block.data;
  for (const key of ["headline", "heading", "eyebrow"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
