"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { Star, StarOff, Video, X } from "lucide-react";
import { toast } from "sonner";

import {
  replaceMediaFile,
  setVideoPoster,
  updateMediaMeta,
} from "@/actions/media";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { formatBytes, formatDuration, usageLink } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { MediaItem } from "./media-grid";

const TYPE_LABELS: Record<MediaItem["type"], string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  MODEL3D: "3D model",
  DOCUMENT: "Document",
};

const PROVENANCE_LABELS: Record<string, string> = {
  UPLOAD: "Uploaded by staff",
  BUNDLED: "Bundled with the site",
  AI: "AI generated",
};

/** Accept narrows the file picker; replaceMediaFile still enforces the same
 *  media-type family server-side regardless of what the browser offered. */
function acceptFor(type: MediaItem["type"]): string {
  if (type === "IMAGE") return "image/jpeg,image/png,image/webp,image/avif";
  if (type === "VIDEO") return "video/mp4,video/webm";
  if (type === "MODEL3D")
    return ".glb,.usdz,model/gltf-binary,model/vnd.usdz+zip";
  return "*/*";
}

/**
 * The media library's detail view (batch D · media system) — a Sheet rather
 * than a route so it opens from either the grid or the list without losing
 * the caller's place, matching the pattern list-detail pairs use elsewhere
 * in the studio.
 */
export function MediaDetailDrawer({
  item,
  onOpenChange,
}: {
  /** null closes the sheet — its own state is otherwise fully derived so a
   *  stale item never flashes while the close transition plays. */
  item: MediaItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {item && <DrawerBody item={item} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  item,
  onClose,
}: {
  item: MediaItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const filename = item.pathname.split("/").pop() ?? item.pathname;
  const dimensions =
    item.width && item.height ? `${item.width}×${item.height}` : null;
  const duration = formatDuration(item.duration);

  const [alt, setAlt] = useState(item.alt ?? "");
  const [caption, setCaption] = useState(item.caption ?? "");
  const [tags, setTags] = useState<string[]>(item.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [favourite, setFavourite] = useState(item.favourite);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const replaceInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  function addTag() {
    const value = tagDraft.trim();
    setTagDraft("");
    if (!value || tags.length >= 20 || tags.includes(value)) return;
    setTags([...tags, value.slice(0, 32)]);
  }

  function onTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && tagDraft === "" && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateMediaMeta({
      id: item.id,
      alt,
      caption,
      tags,
      favourite,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Saved.");
    router.refresh();
  }

  async function handleReplace(file: File) {
    setReplacing(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await replaceMediaFile(item.id, formData);
    setReplacing(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      "File replaced — every place already using it now shows the new version.",
    );
    router.refresh();
  }

  async function capturePoster() {
    const video = videoRef.current;
    if (!video) return;
    setCapturing(true);
    try {
      await seekVideo(video, 1);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser cannot capture a video frame.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("Could not capture that frame.");

      const formData = new FormData();
      formData.append("file", blob, "poster.jpg");
      if (Number.isFinite(video.duration)) {
        formData.append("durationSeconds", String(Math.round(video.duration)));
      }
      const result = await setVideoPoster(item.id, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Poster captured.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not capture a poster frame from this video.",
      );
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <SheetHeader className="p-0">
        <SheetTitle className="truncate" title={filename}>
          {filename}
        </SheetTitle>
        <SheetDescription>{TYPE_LABELS[item.type]}</SheetDescription>
      </SheetHeader>

      <div className="relative aspect-video overflow-hidden rounded-card border border-border bg-background">
        {item.type === "IMAGE" ? (
          <Image
            src={item.url}
            alt=""
            fill
            sizes="400px"
            unoptimized={!isOptimizableImageSrc(item.url)}
            className="object-contain"
          />
        ) : item.type === "VIDEO" ? (
          // crossOrigin="anonymous" is required for "Capture poster" to read
          // the frame back off the <canvas> at all — without it the browser
          // fetches the video in no-cors mode and the canvas is tainted
          // regardless of what the server sends. Vercel Blob's public
          // objects answer with Access-Control-Allow-Origin: *, and local
          // /uploads is same-origin either way, so this does not block
          // playback in either environment this repo actually serves from;
          // capturePoster's try/catch still surfaces a clear error if some
          // future host does not cooperate, rather than hanging.
          <video
            ref={videoRef}
            src={item.url}
            poster={item.posterUrl ?? undefined}
            muted
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-graphite">
            {TYPE_LABELS[item.type]}
          </div>
        )}
      </div>

      {item.type === "VIDEO" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={capturing}
          onClick={capturePoster}
        >
          <Video strokeWidth={1.5} />
          {capturing ? "Capturing…" : "Capture poster from 1s"}
        </Button>
      )}

      {/* Read-only metadata (§12.5's checklist: dimensions, bytes, checksum,
          provenance). */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-small">
        <dt className="u-micro">Folder</dt>
        <dd className="text-foreground">{item.folder}</dd>
        {dimensions && (
          <>
            <dt className="u-micro">Dimensions</dt>
            <dd className="u-num text-foreground">{dimensions}px</dd>
          </>
        )}
        <dt className="u-micro">Size</dt>
        <dd className="u-num text-foreground">{formatBytes(item.bytes)}</dd>
        {duration && (
          <>
            <dt className="u-micro">Duration</dt>
            <dd className="u-num text-foreground">{duration}</dd>
          </>
        )}
        <dt className="u-micro">Checksum</dt>
        <dd
          className="truncate text-graphite"
          title={item.checksum ?? undefined}
        >
          {item.checksum ? `${item.checksum.slice(0, 12)}…` : "Not recorded"}
        </dd>
        <dt className="u-micro">Origin</dt>
        <dd className="text-foreground">
          {item.provenance
            ? PROVENANCE_LABELS[item.provenance]
            : "Not recorded"}
        </dd>
        <dt className="u-micro">Added</dt>
        <dd className="u-num text-foreground">
          {new Date(item.createdAt).toLocaleDateString()}
        </dd>
        {item.isDemo && (
          <>
            <dt className="u-micro">Content Lab</dt>
            <dd className="text-foreground">
              Demo fixture — no file in storage to replace
            </dd>
          </>
        )}
      </dl>

      {/* Usage — the delete guard's labeled view, with a best-effort deep
          link per usage type (§ the exact row would need media-usages.ts to
          carry an id, out of this batch's file ownership). */}
      <div>
        <p className="u-micro mb-2">Used in</p>
        {item.usedIn.length === 0 ? (
          <p className="text-small text-graphite">
            Not referenced anywhere — safe to delete.
          </p>
        ) : (
          <ul className="space-y-1">
            {item.usedIn.map((label) => {
              const href = usageLink(label);
              return (
                <li key={label} className="text-small">
                  {href ? (
                    <Link
                      href={href}
                      className="text-sapphire-ink underline underline-offset-2"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="text-foreground">{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Editable metadata. */}
      <div className="space-y-4">
        <label className="block">
          <span className="u-micro mb-1.5 block">Description (alt text)</span>
          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="What the picture shows"
            disabled={item.type !== "IMAGE"}
          />
        </label>

        <label className="block">
          <span className="u-micro mb-1.5 block">Caption</span>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            placeholder="Optional caption shown alongside the picture"
          />
        </label>

        <div>
          <span className="u-micro mb-1.5 block">Tags</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-12"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  className="text-graphite hover:text-foreground"
                >
                  <X className="size-3" strokeWidth={1.5} aria-hidden />
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={onTagKeyDown}
              onBlur={addTag}
              placeholder={tags.length < 20 ? "Add a tag…" : "20 tags max"}
              disabled={tags.length >= 20}
              className="h-8 min-w-24 flex-1 bg-transparent text-small outline-none placeholder:text-graphite"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFavourite((f) => !f)}
          aria-pressed={favourite}
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-input border px-4 text-small outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
            favourite
              ? "border-sapphire-ink bg-sapphire-ink/10 font-medium text-sapphire-ink"
              : "border-border text-foreground hover:border-sapphire-ink/40",
          )}
        >
          {favourite ? (
            <Star
              className="size-4 fill-current"
              strokeWidth={1.5}
              aria-hidden
            />
          ) : (
            <StarOff className="size-4" strokeWidth={1.5} aria-hidden />
          )}
          {favourite ? "Favourite" : "Mark as favourite"}
        </button>

        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="border-t border-border pt-4">
        <p className="u-micro mb-2">Replace file</p>
        <p className="mb-2 text-small text-graphite">
          Swaps the bytes behind this exact file — every place already using it
          updates automatically, with no re-select needed.
          {item.isDemo &&
            " A demo fixture has no storage file to swap; replacing turns it into a real upload."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={replacing}
          onClick={() => replaceInputRef.current?.click()}
        >
          {replacing ? "Replacing…" : "Choose a replacement file"}
        </Button>
        <input
          ref={replaceInputRef}
          type="file"
          accept={acceptFor(item.type)}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleReplace(file);
          }}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="mt-auto"
      >
        Close
      </Button>
    </div>
  );
}

/** Resolves once `video` has seeked to `seconds` (clamped to the clip's own
 *  length, so a poster capture on a very short clip never hangs waiting for
 *  a `seeked` event that can't fire). */
function seekVideo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const seekTo = () => {
      const target =
        video.duration > 0 ? Math.min(seconds, video.duration - 0.05) : seconds;
      video.currentTime = Math.max(0, target);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not load this video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    if (video.readyState >= 1) seekTo();
    else video.addEventListener("loadedmetadata", seekTo, { once: true });
  });
}
