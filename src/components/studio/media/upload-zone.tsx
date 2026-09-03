"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { uploadMediaFiles, type UploadedMedia } from "@/actions/media";
import {
  MEDIA_FOLDERS,
  type MediaFolder,
} from "@/components/studio/media/folders";
import { cn } from "@/lib/utils";

/** One `UploadZone` per page (the media library mounts exactly one), so a
 *  fixed id — rather than `useId()` — is safe and lets the empty state's
 *  "Upload files" CTA open the SAME picker without prop-drilling a ref
 *  through the page. */
export const UPLOAD_INPUT_ID = "media-upload-input";

/**
 * Mirror of ACCEPTED_UPLOAD_TYPES in @/lib/storage — that module pulls in
 * node:fs so it cannot be imported client-side. Extensions are listed too
 * because browsers rarely map .glb/.usdz to their model MIME types in the
 * picker. The server action remains the source of truth.
 */
const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "model/gltf-binary",
  "model/vnd.usdz+zip",
  ".glb",
  ".usdz",
].join(",");

const FOLDER_LABELS: Record<MediaFolder, string> = {
  products: "Products",
  blog: "Journal",
  portfolio: "Portfolio",
  site: "Studio",
  refs: "References",
  other: "Other",
};

/**
 * Drag-and-drop (plus click-to-browse) upload surface (batch D · media
 * system). The old media page had a single small "Upload" button with no
 * drop target and no visible destination folder — this replaces it.
 *
 * Owns no state about the library itself: it uploads, reports what happened
 * through a toast, and hands the caller `onUploaded` so the page can decide
 * what a fresh set of files means for its own list (usually `router.refresh`).
 */
export function UploadZone({
  defaultFolder,
  onUploaded,
}: {
  defaultFolder?: MediaFolder | null;
  onUploaded: (uploaded: UploadedMedia[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<MediaFolder>(defaultFolder ?? "other");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const runUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploading(true);
      setProgress({ done: 0, total: files.length });

      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      formData.append("folder", folder);

      // uploadMediaFiles processes the whole batch server-side in one call —
      // there is no per-file progress event to surface, so the bar shows
      // "in flight" rather than a count climbing file by file. Real per-file
      // progress would need one request per file, which would cost the
      // dedupe-by-checksum step (finalizeAsset must see the whole batch) —
      // not a trade worth making for a bar that fills faster than it can be
      // read on a staff connection.
      const result = await uploadMediaFiles(formData);
      setUploading(false);
      setProgress(null);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const uploaded = result.data ?? [];
      if (uploaded.length === files.length) {
        toast.success(
          `Uploaded ${uploaded.length} ${uploaded.length === 1 ? "file" : "files"} to ${FOLDER_LABELS[folder]}.`,
        );
      } else {
        toast.warning(
          `Uploaded ${uploaded.length} of ${files.length} files — the rest were rejected (unsupported type or too large).`,
        );
      }
      onUploaded(uploaded);
    },
    [folder, onUploaded],
  );

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    void runUpload(files);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop files here, or press Enter to browse"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-2 rounded-input border border-dashed px-4 text-small outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
          dragging
            ? "border-sapphire-ink bg-sapphire-ink/10 text-sapphire-ink"
            : "border-hairline-dk text-graphite hover:border-sapphire-ink/50 hover:text-foreground",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        <UploadCloud
          className="size-4 shrink-0"
          strokeWidth={1.5}
          aria-hidden
        />
        <span>
          {uploading
            ? progress
              ? `Uploading ${progress.total} ${progress.total === 1 ? "file" : "files"}…`
              : "Uploading…"
            : "Drop files, or click to browse"}
        </span>
        <input
          ref={inputRef}
          id={UPLOAD_INPUT_ID}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void runUpload(files);
          }}
        />
      </div>

      <label className="flex min-h-11 items-center gap-2 text-small text-graphite">
        <span className="u-micro">Into</span>
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value as MediaFolder)}
          disabled={uploading}
          aria-label="Folder to upload into"
          className="h-11 rounded-input border border-field bg-transparent px-3 text-small text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {MEDIA_FOLDERS.map((value) => (
            <option key={value} value={value}>
              {FOLDER_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
