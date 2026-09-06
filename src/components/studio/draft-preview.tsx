"use client";

import { useId, useState, type ReactNode } from "react";
import { ExternalLink, Eye, RotateCw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The draft, in a device frame, without leaving the editor.
 *
 * Every editing screen already links to `/api/draft?redirect=…` in a new tab.
 * That answers "how does this read" but not "how does this read ON A PHONE",
 * which is the question that actually bites: the storefront's own definition
 * of done names 360px and 1280px, and checking the small end previously meant
 * a new tab plus devtools plus a device-toolbar toggle. Most people do not,
 * so long headlines and wrapped buttons ship.
 *
 * Framing is same-origin: the storefront carries `X-Frame-Options: SAMEORIGIN`
 * and `frame-ancestors 'self'`. **The Studio itself is `DENY`** and must stay
 * that way — this frames public pages only, never an admin screen.
 *
 * The frame is not scaled. A scaled desktop preview reads as "roughly right"
 * and hides exactly the crowding it is meant to reveal, so the widths render
 * 1:1 and the desktop one scrolls if the dialog is narrower than 1280. The
 * new-tab link stays for a full-size look.
 *
 * Three pieces:
 *
 * - `DraftPreviewDialog` — the device-frame dialog, controlled.
 * - `DraftPreview` — that dialog behind a trigger button, for the footer of
 *   any editor. The iframe mounts only while the dialog is open, and `key`
 *   on the source means reopening refetches rather than showing a stale
 *   render of an older draft.
 * - `DraftPreviewPanel` — the DOCKED column REDESIGN.md §12.5 asks for on the
 *   product and journal editors ("information left, live preview right").
 *   It shows the phone width inline and sends the two wider ones to the
 *   dialog, because a 26rem column cannot hold 768 or 1280 pixels unscaled
 *   and scaling is the one thing this preview refuses to do.
 */
const WIDTHS = [
  { label: "Phone", value: 390 },
  { label: "Tablet", value: 768 },
  { label: "Desktop", value: 1280 },
] as const;

type PreviewWidth = (typeof WIDTHS)[number]["value"];

/** The docked frame's width — the phone entry, and the column is sized to it. */
const DOCKED_WIDTH: PreviewWidth = 390;

/** The staff-gated route that mints the draft cookie and lands on `path`. */
function draftSrc(path: string): string {
  return `/api/draft?redirect=${encodeURIComponent(path)}`;
}

export function DraftPreviewDialog({
  path,
  open,
  onOpenChange,
  width,
  onWidthChange,
  trigger,
}: {
  /** Public path to preview, e.g. `/product/varmala-frame`. */
  path: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width: PreviewWidth;
  onWidthChange: (width: PreviewWidth) => void;
  /** Rendered as the dialog's trigger when given; omit for a controlled open. */
  trigger?: ReactNode;
}) {
  const src = draftSrc(path);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] w-[min(96vw,1360px)] max-w-none overflow-hidden sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Draft preview</DialogTitle>
          <DialogDescription>
            {path} — as a visitor would see it once published. Unsaved edits in
            the form are not here yet; save first.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Preview width"
            className="flex flex-wrap gap-2"
          >
            {WIDTHS.map((entry) => (
              <Button
                key={entry.value}
                type="button"
                size="sm"
                variant={width === entry.value ? "default" : "outline"}
                aria-pressed={width === entry.value}
                onClick={() => onWidthChange(entry.value)}
              >
                {entry.label}
                <span className="u-num ms-1 text-12 opacity-70">
                  {entry.value}
                </span>
              </Button>
            ))}
          </div>
          <Button asChild variant="ghost" size="sm" className="ms-auto">
            <a href={src} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden className="size-4" /> Open in a new tab
            </a>
          </Button>
        </div>

        <div className="mt-2 overflow-auto rounded-card border border-border bg-background p-3">
          <iframe
            // Remounts per open and per width, so the frame always shows the
            // current draft rather than a cached earlier render.
            key={`${open}-${width}`}
            src={src}
            title={`Draft preview of ${path} at ${width} pixels wide`}
            className={cn(
              "mx-auto block h-[70vh] border border-hairline bg-white",
            )}
            style={{ width }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DraftPreview({
  path,
  label = "Preview",
  className,
}: {
  /** Public path to preview, e.g. `/product/varmala-frame`. */
  path: string;
  label?: string;
  /** Extra classes for the trigger button. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<PreviewWidth>(DOCKED_WIDTH);

  return (
    <DraftPreviewDialog
      path={path}
      open={open}
      onOpenChange={setOpen}
      width={width}
      onWidthChange={setWidth}
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("min-h-11", className)}
        >
          <Eye aria-hidden className="size-4" /> {label}
        </Button>
      }
    />
  );
}

/**
 * The docked preview column. Shows the saved draft at phone width, 1:1,
 * beside the form; the editor mounts it in `EditorSplit`'s aside.
 *
 * `version` is the editor's count of successful saves. The frame is keyed on
 * it, so every save reloads the draft — which is what makes the column a
 * preview of the work rather than of whatever the page looked like when it
 * was opened. `dirty` is the form's own unsaved state, and the note under
 * the heading says so plainly: the frame shows the LAST SAVE, and edits that
 * have not been saved are not in it. That is the one honest thing a draft
 * preview can say; a "live" frame of unsaved form state would mean rendering
 * the storefront's product page from the form's values, a second renderer to
 * keep true, and the spec's word is read as "the current draft, without a
 * round trip", which this is.
 *
 * The iframe is `loading="lazy"`. `EditorSplit` hides the aside with
 * `display: none` below its container threshold and a lazy iframe that never
 * intersects never fetches, so a phone editing a product does not also load
 * the whole product page it cannot see. Without lazy loading it would.
 */
export function DraftPreviewPanel({
  path,
  version,
  dirty,
}: {
  /** Public path to preview, e.g. `/product/varmala-frame`. */
  path: string;
  /** Bumped by the editor after each successful save; reloads the frame. */
  version: number;
  /** The form holds edits that have not been saved. */
  dirty: boolean;
}) {
  const headingId = useId();
  const [reloads, setReloads] = useState(0);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<PreviewWidth>(768);

  const src = draftSrc(path);

  function openWider(next: PreviewWidth) {
    setWidth(next);
    setOpen(true);
  }

  return (
    <div
      aria-labelledby={headingId}
      className="rounded-card border border-border bg-card p-3 shadow-e1"
    >
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-lg text-foreground">
            Draft preview
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {path} ·{" "}
            <span className="u-num">{DOCKED_WIDTH}</span> pixels wide
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Reload the preview"
          onClick={() => setReloads((count) => count + 1)}
        >
          <RotateCw aria-hidden className="size-4" />
        </Button>
      </div>

      <p className="mt-2 px-1 text-xs text-muted-foreground">
        {dirty
          ? "Showing the last save. Unsaved edits are not here yet — save to refresh it."
          : "Showing the last save."}
      </p>

      <div className="mt-3 overflow-hidden rounded-card border border-border bg-background">
        <iframe
          // Keyed on the save count and the reload button, so each save (and
          // each press) refetches the draft rather than showing the render the
          // column opened with.
          key={`${version}-${reloads}`}
          src={src}
          loading="lazy"
          title={`Draft preview of ${path} at ${DOCKED_WIDTH} pixels wide`}
          className="block h-[min(844px,calc(100svh-17rem))] border-0 bg-white"
          style={{ width: DOCKED_WIDTH }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
        <span className="u-micro text-graphite">Wider</span>
        {WIDTHS.filter((entry) => entry.value !== DOCKED_WIDTH).map(
          (entry) => (
            <Button
              key={entry.value}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openWider(entry.value)}
            >
              {entry.label}
              <span className="u-num ms-1 text-12 opacity-70">
                {entry.value}
              </span>
            </Button>
          ),
        )}
        <Button asChild variant="ghost" size="sm" className="ms-auto">
          <a href={src} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden className="size-4" /> New tab
          </a>
        </Button>
      </div>

      <DraftPreviewDialog
        path={path}
        open={open}
        onOpenChange={setOpen}
        width={width}
        onWidthChange={setWidth}
      />
    </div>
  );
}
