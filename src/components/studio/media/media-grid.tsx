"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { isOptimizableImageSrc } from "@/lib/image-src";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Box,
  Copy,
  FileText,
  Sparkles,
  Trash2,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteMediaItems,
  setMediaAlt,
  setMediaProvenance,
  uploadMediaFiles,
} from "@/actions/media";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import {
  MEDIA_FOLDERS,
  type MediaFolder,
} from "@/components/studio/media/folders";
import { EmptyState } from "@/components/studio/page-header";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useSelection } from "@/hooks/use-selection";
import { cn } from "@/lib/utils";

export type MediaItem = {
  id: string;
  url: string;
  pathname: string;
  type: "IMAGE" | "VIDEO" | "MODEL3D" | "DOCUMENT";
  folder: string;
  bytes: number;
  /** Pixel dimensions, when the uploader could read them (§12.5's card line). */
  width: number | null;
  height: number | null;
  /** The asset's own description, inherited anywhere it is used. */
  alt: string | null;
  /** The name the file arrived with, kept for search. */
  originalName: string | null;
  /** How the asset got here. Null on rows older than the column — unknown,
      which is shown as nothing rather than as a guess. */
  provenance: "UPLOAD" | "BUNDLED" | "AI" | null;
  /** Labeled reference sites ("Product gallery ×3") — empty = safe to delete. */
  usedIn: string[];
};

export type BehaviourFilter = "missing-alt" | "unused" | "ai-generated";

/**
 * Mirror of ACCEPTED_UPLOAD_TYPES in @/lib/storage — that module pulls
 * in node:fs so it cannot be imported client-side. Extensions are listed
 * too because browsers rarely map .glb/.usdz to their model MIME types
 * in the picker. The server action remains the source of truth.
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

/**
 * §12.5 asks for folder filters named `Products · Studio · Portfolio ·
 * Journal · Video · AI Generated`. Four of those are real folders under a
 * different name, so the spec's vocabulary is mapped onto the existing
 * taxonomy (`MEDIA_FOLDERS`) rather than the taxonomy being renamed — the
 * folder value is persisted on every row and on every upload.
 *
 * `Video` is not a folder at all; it is `MediaType`, so it filters on type.
 *
 * **`AI Generated` is not built.** There is no column on `Media`
 * (prisma/schema.prisma: id · url · pathname · type · folder · bytes · width ·
 * height · createdAt) that records provenance, and nothing anywhere else in
 * the app writes one. A chip that filtered nothing, or a badge that guessed
 * from a filename, would both be worse than its absence. Lighting it up needs
 * a schema field — e.g. `aiGenerated Boolean @default(false)` — set at upload
 * time, which is a data change and outside this redesign's scope.
 */
const FOLDER_LABELS: Record<MediaFolder, string> = {
  products: "Products",
  blog: "Journal",
  portfolio: "Portfolio",
  site: "Studio",
  refs: "References",
  other: "Other",
};

const TYPE_FILTERS = [
  { value: "ALL", label: "All types" },
  { value: "IMAGE", label: "Images" },
  { value: "VIDEO", label: "Video" },
  { value: "MODEL3D", label: "3D models" },
  { value: "DOCUMENT", label: "Documents" },
] as const;

type TypeFilter = (typeof TYPE_FILTERS)[number]["value"];

const TYPE_LABELS: Record<MediaItem["type"], string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  MODEL3D: "3D model",
  DOCUMENT: "Document",
};

const BEHAVIOUR_CHIPS: {
  value: BehaviourFilter;
  label: string;
  help: string;
}[] = [
  {
    value: "missing-alt",
    label: "No description",
    help: "Pictures with no alt text. Anyone using a screen reader hears nothing for these.",
  },
  {
    value: "unused",
    label: "Unused",
    help: "Files nothing on the site points at. These are the ones that are safe to delete.",
  },
];

/** Origin, not a defect — so it sits apart from the two warning chips. */
const ORIGIN_CHIPS: {
  value: BehaviourFilter;
  label: string;
  help: string;
}[] = [
  {
    value: "ai-generated",
    label: "AI generated",
    help: "Pictures a model drew, rather than a camera took.",
  },
];

const CHIP =
  "inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-small outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none";
const CHIP_ON =
  "border-sapphire-ink bg-sapphire-ink/10 font-medium text-sapphire-ink";
const CHIP_OFF =
  "border-border text-graphite hover:border-sapphire-ink/40 hover:text-foreground";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function MediaThumb({ item, filename }: { item: MediaItem; filename: string }) {
  if (item.type === "IMAGE") {
    return (
      <Image
        src={item.url}
        alt={filename}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
        className="object-cover"
        unoptimized={!isOptimizableImageSrc(item.url)}
      />
    );
  }
  if (item.type === "VIDEO") {
    return (
      <video
        src={item.url}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }
  const Icon = item.type === "MODEL3D" ? Box : FileText;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-graphite">
      <Icon className="size-8" strokeWidth={1.5} aria-hidden />
      <span className="u-micro">{TYPE_LABELS[item.type]}</span>
    </div>
  );
}

/**
 * Media library grid — §12.5. "Visual asset grid, filters … card shows image,
 * filename, type, dimensions, used-in."
 *
 * Folder filtering stays server-side through the URL (it is the query the page
 * already runs). Type filtering is client-side over the rows already loaded,
 * the same scope the existing pagination works in — the counts beside each
 * type chip therefore describe what is on screen, and say so.
 */
export function MediaGrid({
  items,
  counts,
  total,
  activeFolder,
  activeFilter,
  query,
  truncated,
  visibleTotal,
  scan,
}: {
  items: MediaItem[];
  counts: Record<string, number>;
  total: number;
  activeFolder: MediaFolder | null;
  activeFilter: BehaviourFilter | null;
  query: string;
  truncated: boolean;
  visibleTotal: number;
  /** How far the unused scan got, when that filter is on. */
  scan: { scanned: number; exhausted: boolean } | null;
}) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const filtered = useMemo(
    () =>
      typeFilter === "ALL"
        ? items
        : items.filter((item) => item.type === typeFilter),
    [items, typeFilter],
  );

  const {
    pageRows,
    page,
    setPage,
    pageCount,
    total: pageTotal,
    pageSize,
  } = usePagination(
    filtered,
    PAGE_SIZE,
    `${activeFolder ?? "all"}:${typeFilter}`,
  );

  // Selection is scoped to the visible page.
  const pageIds = useMemo(() => pageRows.map((i) => i.id), [pageRows]);
  const selection = useSelection(pageIds);
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>([["ALL", items.length]]);
    for (const item of items) {
      map.set(item.type, (map.get(item.type) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const folderChips: {
    value: MediaFolder | null;
    label: string;
    count: number;
  }[] = [
    { value: null, label: "All", count: total },
    ...MEDIA_FOLDERS.map((folder) => ({
      value: folder,
      label: FOLDER_LABELS[folder],
      count: counts[folder] ?? 0,
    })),
  ];

  /** Folder, behaviour filter and search all live in the URL together. */
  function navigate(next: {
    folder?: MediaFolder | null;
    filter?: BehaviourFilter | null;
  }) {
    selection.clear();
    const folder = next.folder === undefined ? activeFolder : next.folder;
    const filter = next.filter === undefined ? activeFilter : next.filter;
    const search = new URLSearchParams();
    if (folder) search.set("folder", folder);
    if (filter) search.set("filter", filter);
    if (query) search.set("q", query);
    const qs = search.toString();
    router.replace(qs ? `/studio/media?${qs}` : "/studio/media");
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    formData.append("folder", activeFolder ?? "other");
    const res = await uploadMediaFiles(formData);
    setUploading(false);
    input.value = "";

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const uploaded = res.data ?? [];
    if (uploaded.length === files.length) {
      toast.success(
        `Uploaded ${uploaded.length} ${uploaded.length === 1 ? "file" : "files"}.`,
      );
    } else {
      toast.warning(
        `Uploaded ${uploaded.length} of ${files.length} files — the rest were rejected (unsupported type or too large).`,
      );
    }
    router.refresh();
  }

  async function copyUrl(url: string) {
    const absolute = url.startsWith("/")
      ? `${window.location.origin}${url}`
      : url;
    try {
      await navigator.clipboard.writeText(absolute);
      toast.success("URL copied to clipboard.");
    } catch {
      toast.error("Could not copy — your browser blocked clipboard access.");
    }
  }

  async function markProvenance(provenance: "AI" | "UPLOAD") {
    setMarking(true);
    const res = await setMediaProvenance({
      ids: [...selection.selected],
      provenance,
    });
    setMarking(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      provenance === "AI" ? "Marked AI generated." : "Mark removed.",
    );
    selection.clear();
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteMediaItems(selection.ids);
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) {
      const { deleted, skipped } = res.data ?? { deleted: 0, skipped: [] };
      if (deleted > 0) {
        toast.success(
          `Deleted ${deleted} ${deleted === 1 ? "file" : "files"}.`,
        );
      }
      // In-use files are kept, not silently removed (ENG-806 / UIUX-605).
      if (skipped.length > 0) {
        toast.warning(
          `Kept ${skipped.length} in-use ${
            skipped.length === 1 ? "file" : "files"
          }: ${skipped.slice(0, 3).join(", ")}${
            skipped.length > 3 ? "…" : ""
          }. Remove ${skipped.length === 1 ? "it" : "them"} from the pages using ${
            skipped.length === 1 ? "it" : "them"
          } first.`,
        );
      }
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const uploadControl = (
    <Button asChild>
      <label
        className={cn(
          "cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
          uploading && "pointer-events-none opacity-40",
        )}
      >
        <UploadCloud aria-hidden strokeWidth={1.5} />
        {uploading ? "Uploading…" : "Upload"}
        <input
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          disabled={uploading}
          onChange={handleUpload}
        />
      </label>
    </Button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div
            role="group"
            aria-label="Filter by folder"
            className="flex flex-wrap items-center gap-2"
          >
            {folderChips.map((chip) => {
              const active = chip.value === activeFolder;
              return (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => navigate({ folder: chip.value })}
                  className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                >
                  {chip.label}
                  <span className="u-num text-12">{chip.count}</span>
                </button>
              );
            })}
          </div>
          {/* Part 16: a control with nothing to control must not render — an
              empty library has no types to filter by. */}
          <div
            role="group"
            aria-label="Filter by file type"
            hidden={items.length === 0}
            className="flex flex-wrap items-center gap-2"
          >
            {TYPE_FILTERS.map((chip) => {
              const active = chip.value === typeFilter;
              const count = typeCounts.get(chip.value) ?? 0;
              if (chip.value !== "ALL" && count === 0 && !active) return null;
              return (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    selection.clear();
                    setTypeFilter(chip.value);
                  }}
                  className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                >
                  {chip.label}
                  <span className="u-num text-12">{count}</span>
                </button>
              );
            })}
          </div>
          {/* The two filters that change behaviour rather than convenience
              (docs/studio-cms §3.4). Server-side, because "unused" is
              computed live from a dozen tables and "missing alt" should
              sweep the whole library rather than the page on screen. */}
          <div
            role="group"
            aria-label="Find files that need attention"
            hidden={total === 0}
            className="flex flex-wrap items-center gap-2"
          >
            {BEHAVIOUR_CHIPS.map((chip) => {
              const active = chip.value === activeFilter;
              return (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={active}
                  title={chip.help}
                  onClick={() =>
                    navigate({ filter: active ? null : chip.value })
                  }
                  className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                >
                  <TriangleAlert
                    className="size-3.5"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  {chip.label}
                </button>
              );
            })}
          </div>
          {/* Origin. Separate group and no warning icon: an AI-generated
              picture is not a problem to fix, and filing it beside "no
              description" would say it was. */}
          <div
            role="group"
            aria-label="Filter by where a file came from"
            hidden={total === 0}
            className="flex flex-wrap items-center gap-2"
          >
            {ORIGIN_CHIPS.map((chip) => {
              const active = chip.value === activeFilter;
              return (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={active}
                  title={chip.help}
                  onClick={() =>
                    navigate({ filter: active ? null : chip.value })
                  }
                  className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                >
                  <Sparkles className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
        {uploadControl}
      </div>

      {activeFilter === "unused" && scan && (
        <p className="u-micro">
          {scan.exhausted
            ? `EVERY FILE CHECKED · ${items.length} UNUSED`
            : `THE FIRST ${items.length} UNUSED, OUT OF ${scan.scanned} FILES CHECKED · NARROW BY FOLDER TO GO FURTHER`}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={
            items.length === 0
              ? activeFolder
                ? `Nothing in ${FOLDER_LABELS[activeFolder]} yet`
                : "No files yet"
              : "No files of that type here"
          }
          description={
            items.length === 0
              ? "Upload images, videos or 3D models to use across products, journal posts and pages."
              : "Every file in this folder is a different type. Clear the type filter to see them."
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-small text-graphite">
              <Checkbox
                checked={selection.allSelected}
                onCheckedChange={selection.toggleAll}
                aria-label="Select all"
              />
              Select all on this page
            </label>
            {truncated && (
              <p className="u-micro">
                SHOWING THE {items.length} MOST RECENT OF {visibleTotal} ·
                FILTER BY FOLDER TO NARROW DOWN
              </p>
            )}
          </div>

          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pageRows.map((item) => {
              const filename = item.pathname.split("/").pop() ?? item.pathname;
              const checked = selection.selected.has(item.id);
              const dimensions =
                item.width && item.height
                  ? `${item.width}×${item.height}`
                  : null;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "overflow-hidden rounded-card border bg-card shadow-e1 transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                    checked ? "border-sapphire-ink" : "border-border",
                  )}
                >
                  <div className="relative aspect-square bg-background">
                    <MediaThumb item={item} filename={filename} />
                    {/* §12.5's indicator. Only AI is marked: "uploaded" and
                        "bundled" are the unremarkable cases, and badging every
                        card would make the one that matters harder to see. */}
                    {item.provenance === "AI" && (
                      <span className="absolute end-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-card/95 px-2 py-1 text-12 text-graphite">
                        <Sparkles
                          className="size-3"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        AI
                      </span>
                    )}
                    <span className="absolute start-2 top-2 z-10 flex size-8 items-center justify-center rounded-input bg-card/95">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => selection.toggle(item.id)}
                        aria-label={`Select ${filename}`}
                      />
                    </span>
                  </div>
                  <div className="space-y-1.5 p-3">
                    <p
                      className="truncate text-small font-medium text-foreground"
                      title={filename}
                    >
                      {filename}
                    </p>
                    <p className="u-micro">
                      {TYPE_LABELS[item.type]}
                      {dimensions ? ` · ${dimensions}` : ""} ·{" "}
                      {formatBytes(item.bytes)}
                    </p>
                    {/* Where the file is live — the delete guard's labeled
                        view, so cleanup decisions need no guessing. */}
                    <p
                      className={cn(
                        "truncate text-small",
                        item.usedIn.length > 0
                          ? "text-graphite"
                          : "text-graphite",
                      )}
                      title={item.usedIn.join(" · ") || undefined}
                    >
                      {item.usedIn.length > 0
                        ? `Used: ${item.usedIn.join(" · ")}`
                        : "Not referenced"}
                    </p>
                    {item.type === "IMAGE" && (
                      <AltField id={item.id} alt={item.alt} name={filename} />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ms-3 gap-2"
                      onClick={() => copyUrl(item.url)}
                    >
                      <Copy
                        className="size-3.5"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      Copy URL
                      <span className="sr-only"> for {filename}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={pageTotal}
            pageSize={pageSize}
            onPageChange={setPage}
            unit="files"
          />
        </>
      )}

      <BulkBar count={selection.count} onClear={selection.clear}>
        {/* Nothing in a file's bytes says a model drew it, so this is the
            owner's to declare — in bulk, because it is almost always a batch
            of them at once. */}
        <Button
          variant="outline"
          size="sm"
          disabled={marking}
          onClick={() => markProvenance("AI")}
        >
          <Sparkles strokeWidth={1.5} /> Mark AI generated
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={marking}
          onClick={() => markProvenance("UPLOAD")}
        >
          Not AI
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 strokeWidth={1.5} /> Delete
        </Button>
      </BulkBar>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={selection.count}
        noun="file"
        onConfirm={handleDelete}
        busy={deleting}
        extraWarning="Files still used by a product, portfolio, category, journal cover or the site chrome are kept and skipped automatically. Only unused files are permanently removed from storage."
      />
    </div>
  );
}

/**
 * The picture's own description, edited where the picture is.
 *
 * On the card rather than behind a dialog because the job it serves is a
 * sweep: filter to "No description", then work down the grid. A dialog per
 * file would make that forty clicks instead of ten.
 */
function AltField({
  id,
  alt,
  name,
}: {
  id: string;
  alt: string | null;
  name: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (draft === null) return;
    setBusy(true);
    const res = await setMediaAlt({ id, alt: draft });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDraft(null);
    router.refresh();
  }

  if (draft === null) {
    return alt ? (
      <p className="truncate text-small text-graphite" title={alt}>
        {alt}{" "}
        <button
          type="button"
          className="underline"
          onClick={() => setDraft(alt)}
        >
          edit
        </button>
      </p>
    ) : (
      <button
        type="button"
        className="flex items-center gap-1.5 text-small text-alert underline"
        onClick={() => setDraft("")}
      >
        <TriangleAlert className="size-3.5" strokeWidth={1.5} aria-hidden />
        Add a description
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        autoFocus
        aria-label={`Description of ${name}`}
        placeholder="What the picture shows"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setDraft(null);
        }}
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={busy}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setDraft(null)}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
