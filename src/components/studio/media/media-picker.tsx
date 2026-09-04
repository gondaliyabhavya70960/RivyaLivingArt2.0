"use client";

import type { ReactNode } from "react";

import Image from "next/image";
import { useCallback, useState } from "react";
import { FileVideo, ImageIcon, Loader2, Search } from "lucide-react";

import { listMediaForPicker, type PickerMediaItem } from "@/actions/media";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MEDIA_FOLDERS } from "@/components/studio/media/folders";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { formatDuration } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * Media-picker dialog (audit §32 / FINDINGS media-picker item): reuse an
 * image already in the library from any studio form instead of re-uploading.
 * Staff-only by construction — the listing action requires a session. The
 * consumer passes `onSelect(url)`; the dialog closes itself on pick.
 */
export function MediaPicker({
  onSelect,
  defaultFolder,
  accept = "IMAGE",
  triggerLabel,
  trigger,
}: {
  onSelect: (item: PickerMediaItem) => void;
  /** Pre-selected folder tab (e.g. "products" in the product form). */
  defaultFolder?: string;
  /** What the picker lists. Defaults to IMAGE — every pre-existing call site
   *  wants a picture and none passes this. */
  accept?: "IMAGE" | "VIDEO";
  triggerLabel?: string;
  /**
   * Replaces the default outline button. The rich-text toolbar needs an icon
   * button that matches its neighbours, and the picker owns its own dialog
   * state, so the trigger is passed in rather than the open state passed out.
   * Must accept a ref and spread props — it goes through `asChild`.
   */
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [folder, setFolder] = useState<string | undefined>(defaultFolder);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickerMediaItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (forFolder: string | undefined, cursor?: string) => {
      setLoading(true);
      setError(null);
      const result = await listMediaForPicker({
        folder: forFolder,
        q: q.trim() || undefined,
        cursor,
        type: accept,
      });
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const data = result.data ?? { items: [], nextCursor: null };
      setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    },
    [q, accept],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Fetch when the dialog opens — an event, not an effect.
        if (next) void load(folder);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
          >
            {accept === "VIDEO" ? <FileVideo /> : <ImageIcon />}{" "}
            {triggerLabel ??
              (accept === "VIDEO" ? "Choose video" : "From library")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>
            {accept === "VIDEO"
              ? "Pick a video already in the library — no re-upload, no duplicate file."
              : "Pick an image already in the library — no re-upload, no duplicate file."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFolder(undefined);
              void load(undefined);
            }}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3 text-sm",
              !folder
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {MEDIA_FOLDERS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setFolder(name);
                void load(name);
              }}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-3 text-sm",
                folder === name
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void load(folder);
          }}
        >
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search by file name…"
            aria-label="Search media"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="min-h-11"
          >
            <Search /> Search
          </Button>
        </form>

        {error && <p className="text-sm text-alert">{error}</p>}

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item) => {
            const duration = formatDuration(item.duration);
            const thumb = item.type === "VIDEO" ? item.posterUrl : item.url;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                title={item.pathname}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {thumb ? (
                  <Image
                    src={thumb}
                    alt=""
                    fill
                    sizes="140px"
                    unoptimized={!isOptimizableImageSrc(thumb)}
                    className="object-cover transition-transform duration-150 group-hover:scale-105 motion-reduce:transition-none"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <FileVideo
                      className="size-6 text-muted-foreground"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                )}
                {item.type === "VIDEO" && duration && (
                  <span className="u-num absolute end-1 bottom-1 z-10 rounded-xs bg-obsidian/80 px-1.5 py-0.5 text-12 text-mineral">
                    {duration}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {items.length === 0 && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            No {accept === "VIDEO" ? "videos" : "images"} here yet — upload from
            the Media page or a form&apos;s upload button.
          </p>
        )}

        <div className="flex justify-center">
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : nextCursor ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => void load(folder, nextCursor)}
            >
              Load more
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
