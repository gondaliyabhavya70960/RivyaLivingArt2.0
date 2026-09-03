"use client";

import { useState } from "react";
import { Eye, ExternalLink } from "lucide-react";

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
 * The iframe mounts only while the dialog is open — `key` on the source means
 * reopening refetches rather than showing a stale render of an older draft.
 */
const WIDTHS = [
  { label: "Phone", value: 390 },
  { label: "Tablet", value: 768 },
  { label: "Desktop", value: 1280 },
] as const;

export function DraftPreview({
  path,
  label = "Preview",
}: {
  /** Public path to preview, e.g. `/product/varmala-frame`. */
  path: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<number>(390);

  const src = `/api/draft?redirect=${encodeURIComponent(path)}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11">
          <Eye aria-hidden className="size-4" /> {label}
        </Button>
      </DialogTrigger>
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
                onClick={() => setWidth(entry.value)}
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
