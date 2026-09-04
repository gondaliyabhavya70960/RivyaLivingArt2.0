"use client";

import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";
import { isOptimizableImageSrc } from "@/lib/image-src";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  FileText,
  LayoutGrid,
  Rows3,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteMediaItems,
  setMediaAlt,
  setMediaProvenance,
  updateMediaMeta,
  type UploadedMedia,
} from "@/actions/media";
import { BulkAltDialog } from "@/components/studio/media/bulk-alt-dialog";
import { MediaDetailDrawer } from "@/components/studio/media/media-detail-drawer";
import { MoveToFolderDialog } from "@/components/studio/media/move-to-folder-dialog";
import {
  UPLOAD_INPUT_ID,
  UploadZone,
} from "@/components/studio/media/upload-zone";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import {
  MEDIA_FOLDERS,
  type MediaFolder,
} from "@/components/studio/media/folders";
import { EmptyState } from "@/components/studio/page-header";
import { StudioRow } from "@/components/studio/studio-row";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { SortHead, type SortState } from "@/components/studio/sort-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useSelection } from "@/hooks/use-selection";
import { formatBytes, formatDuration, SIZE_BANDS } from "@/lib/media";
import { cn } from "@/lib/utils";
import type {
  BehaviourFilter,
  MediaFilters,
  MediaTypeValue,
  OrientationValue,
  SortValue,
  ViewValue,
} from "@/app/studio/(dashboard)/media/query";

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
  caption: string | null;
  tags: string[];
  favourite: boolean;
  /** VIDEO only — whole seconds. */
  duration: number | null;
  /** VIDEO only — the frame shown in place of a raw `<video>` thumbnail. */
  posterUrl: string | null;
  /** The name the file arrived with, kept for search. */
  originalName: string | null;
  /** How the asset got here. Null on rows older than the column — unknown,
      which is shown as nothing rather than as a guess. */
  provenance: "UPLOAD" | "BUNDLED" | "AI" | null;
  checksum: string | null;
  dominantHex: string | null;
  createdAt: string;
  /** Content Lab fixture — its pathname was never written to storage. */
  isDemo: boolean;
  /** Labeled reference sites ("Product gallery ×3") — empty = safe to delete. */
  usedIn: string[];
};

/**
 * §12.5 asks for folder filters named `Products · Studio · Portfolio ·
 * Journal · Video · AI Generated`. Four of those are real folders under a
 * different name, so the spec's vocabulary is mapped onto the existing
 * taxonomy (`MEDIA_FOLDERS`) rather than the taxonomy being renamed — the
 * folder value is persisted on every row and on every upload.
 */
const FOLDER_LABELS: Record<MediaFolder, string> = {
  products: "Products",
  blog: "Journal",
  portfolio: "Portfolio",
  site: "Studio",
  refs: "References",
  other: "Other",
};

const TYPE_LABELS: Record<MediaItem["type"], string> = {
  IMAGE: "Images",
  VIDEO: "Video",
  MODEL3D: "3D models",
  DOCUMENT: "Documents",
};

const ORIENTATION_LABELS: Record<OrientationValue, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
  square: "Square",
};

const SORT_LABELS: Record<SortValue, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  largest: "Largest first",
  name: "Name A–Z",
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

const ORIGIN_CHIP: { value: BehaviourFilter; label: string; help: string } = {
  value: "ai-generated",
  label: "AI generated",
  help: "Pictures a model drew, rather than a camera took.",
};

const CHIP =
  "inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-small outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none";
const CHIP_ON =
  "border-sapphire-ink bg-sapphire-ink/10 font-medium text-sapphire-ink";
const CHIP_OFF =
  "border-border text-graphite hover:border-sapphire-ink/40 hover:text-foreground";

const SELECT_CLASS =
  "h-11 rounded-input border border-field bg-transparent px-3 text-small text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Grid/list view, persisted client-side only — every VIEWER's own choice,
 *  never anything the server needs to know to render the right data (both
 *  views show the same rows). `?view=` in the URL wins when present, so a
 *  shared link opens in the view it was copied from; otherwise this falls
 *  back to what this browser last chose. useSyncExternalStore rather than
 *  state+effect: no synchronous setState-in-effect, and the one-time
 *  server/client mismatch on first paint is corrected by the store contract
 *  itself, not by a manual re-render. */
const VIEW_KEY = "rr-studio-media-view";
const viewListeners = new Set<() => void>();
function subscribeView(onChange: () => void) {
  viewListeners.add(onChange);
  return () => viewListeners.delete(onChange);
}
function getStoredView(): ViewValue {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}
function getServerView(): ViewValue {
  return "grid";
}
function writeStoredView(next: ViewValue) {
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {
    // Storage blocked — the toggle still works for this page view via the URL.
  }
  for (const listener of viewListeners) listener();
}

function formatDateInput(value: string | null): string {
  return value ?? "";
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
    if (item.posterUrl) {
      return (
        <Image
          src={item.posterUrl}
          alt={filename}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
          className="object-cover"
          unoptimized={!isOptimizableImageSrc(item.posterUrl)}
        />
      );
    }
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
 * Media library grid/list — §12.5. Filtering, sorting and pagination are all
 * server-side, driven entirely by the URL (`filters`/`nextCursor` come from
 * the server component); this component's own state is limited to the
 * current page's SELECTION, the drawer/dialog open flags and the view
 * toggle, none of which changes what data is showing.
 */
export function MediaGrid({
  items,
  folderCounts,
  typeCounts,
  total,
  filters,
  nextCursor,
  scan,
}: {
  items: MediaItem[];
  folderCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  total: number;
  filters: MediaFilters;
  /** Cursor for the next `take=60` page, or null when this is the last one. */
  nextCursor: string | null;
  /** How far the "unused" scan got, when that filter is on. */
  scan: { scanned: number; exhausted: boolean } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storedView = useSyncExternalStore(
    subscribeView,
    getStoredView,
    getServerView,
  );
  const view: ViewValue =
    searchParams.get("view") === "list"
      ? "list"
      : searchParams.has("view")
        ? "grid"
        : storedView;

  const [q, setQ] = useState(filters.q);
  const pageIds = useMemo(() => items.map((i) => i.id), [items]);
  const selection = useSelection(pageIds);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [favouriting, setFavouriting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const detailItem = items.find((i) => i.id === detailId) ?? null;

  /** Merges a patch into the current URL search params and navigates. Every
   *  filter/sort change drops `after` (a new query has no continuation of
   *  the OLD one) unless the caller explicitly sets it. */
  const navigate = useCallback(
    (patch: Record<string, string | null>) => {
      selection.clear();
      const next = new URLSearchParams(searchParams.toString());
      if (!("after" in patch)) next.delete("after");
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.push(qs ? `/studio/media?${qs}` : "/studio/media");
    },
    [router, searchParams, selection],
  );

  function toggleParam(key: string, value: string, active: boolean) {
    navigate({ [key]: active ? null : value });
  }

  function setView(next: ViewValue) {
    writeStoredView(next);
    // No selection.clear()/cursor reset needed — the row set is unchanged.
    const params = new URLSearchParams(searchParams.toString());
    if (next === "grid") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.push(qs ? `/studio/media?${qs}` : "/studio/media");
  }

  const loadMoreHref = useMemo(() => {
    if (!nextCursor) return null;
    const params = new URLSearchParams(searchParams.toString());
    params.set("after", nextCursor);
    return `/studio/media?${params.toString()}`;
  }, [nextCursor, searchParams]);

  function onUploaded(uploaded: UploadedMedia[]) {
    if (uploaded.length > 0) router.refresh();
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

  async function toggleFavourite(favourite: boolean) {
    setFavouriting(true);
    const ids = [...selection.selected];
    const results = await Promise.all(
      ids.map((id) => updateMediaMeta({ id, favourite })),
    );
    setFavouriting(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) {
      toast.error(`${failed} of ${ids.length} could not be updated.`);
    } else {
      toast.success(
        favourite
          ? `Marked ${ids.length} favourite.`
          : `Unmarked ${ids.length}.`,
      );
    }
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
      if (skipped.length > 0) {
        toast.warning(
          `Kept ${skipped.length} in-use ${skipped.length === 1 ? "file" : "files"}: ${skipped
            .slice(0, 3)
            .join(", ")}${skipped.length > 3 ? "…" : ""}. Remove ${
            skipped.length === 1 ? "it" : "them"
          } from the pages using ${skipped.length === 1 ? "it" : "them"} first.`,
        );
      }
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const folderChips: {
    value: MediaFolder | null;
    label: string;
    count: number;
  }[] = [
    { value: null, label: "All", count: total },
    ...MEDIA_FOLDERS.map((folder) => ({
      value: folder,
      label: FOLDER_LABELS[folder],
      count: folderCounts[folder] ?? 0,
    })),
  ];

  const sortState: SortState =
    filters.sort === "name"
      ? { key: "name", dir: "asc" }
      : filters.sort === "oldest"
        ? { key: "date", dir: "asc" }
        : filters.sort === "largest"
          ? { key: "size", dir: "desc" }
          : { key: "date", dir: "desc" };

  function handleColumnSort(key: string) {
    // The unused scan has its own fixed newest-first order — see the grid
    // view's disabled Sort select for the same rule stated the other way.
    if (filters.filter === "unused") return;
    if (key === "name") navigate({ sort: "name" });
    else if (key === "size") navigate({ sort: "largest" });
    else if (key === "date")
      navigate({ sort: filters.sort === "newest" ? "oldest" : "newest" });
  }

  return (
    <div className="space-y-5">
      <UploadZone defaultFolder={filters.folder} onUploaded={onUploaded} />

      <form
        className="flex max-w-md items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q: q.trim() || null });
        }}
      >
        <Input
          type="search"
          value={q}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          placeholder="Search by name or description…"
          aria-label="Search media by name or description"
          className="h-11"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0"
        >
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div
            role="group"
            aria-label="Filter by folder"
            className="flex flex-wrap items-center gap-2"
          >
            {folderChips.map((chip) => {
              const active = chip.value === filters.folder;
              return (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    navigate({ folder: active ? null : chip.value })
                  }
                  className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                >
                  {chip.label}
                  <span className="u-num text-12">{chip.count}</span>
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Filter by file type"
            hidden={total === 0}
            className="flex flex-wrap items-center gap-2"
          >
            {(
              ["IMAGE", "VIDEO", "MODEL3D", "DOCUMENT"] as MediaTypeValue[]
            ).map((value) => {
              const active = filters.type === value;
              const count = typeCounts[value] ?? 0;
              if (count === 0 && !active) return null;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => navigate({ type: active ? null : value })}
                  className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                >
                  {TYPE_LABELS[value]}
                  <span className="u-num text-12">{count}</span>
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Filter by orientation"
            hidden={total === 0}
            className="flex flex-wrap items-center gap-2"
          >
            {(["landscape", "portrait", "square"] as OrientationValue[]).map(
              (value) => {
                const active = filters.orientation === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleParam("orientation", value, active)}
                    className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                  >
                    {ORIENTATION_LABELS[value]}
                  </button>
                );
              },
            )}
            <button
              type="button"
              aria-pressed={filters.favourite}
              onClick={() => toggleParam("favourite", "1", filters.favourite)}
              className={cn(CHIP, filters.favourite ? CHIP_ON : CHIP_OFF)}
            >
              <Star className="size-3.5" strokeWidth={1.5} aria-hidden />
              Favourites
            </button>
            <button
              type="button"
              aria-pressed={filters.demo}
              onClick={() => toggleParam("demo", "1", filters.demo)}
              className={cn(CHIP, filters.demo ? CHIP_ON : CHIP_OFF)}
            >
              Demo content
            </button>
          </div>

          <div
            role="group"
            aria-label="Find files that need attention"
            hidden={total === 0}
            className="flex flex-wrap items-center gap-2"
          >
            {BEHAVIOUR_CHIPS.map((chip) => {
              const active = chip.value === filters.filter;
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
            <button
              type="button"
              aria-pressed={filters.filter === ORIGIN_CHIP.value}
              title={ORIGIN_CHIP.help}
              onClick={() =>
                navigate({
                  filter:
                    filters.filter === ORIGIN_CHIP.value
                      ? null
                      : ORIGIN_CHIP.value,
                })
              }
              className={cn(
                CHIP,
                filters.filter === ORIGIN_CHIP.value ? CHIP_ON : CHIP_OFF,
              )}
            >
              <Sparkles className="size-3.5" strokeWidth={1.5} aria-hidden />
              {ORIGIN_CHIP.label}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-small text-graphite">
              <span className="u-micro">Size</span>
              <select
                value={filters.size ?? ""}
                onChange={(e) => navigate({ size: e.target.value || null })}
                aria-label="Filter by file size"
                className={SELECT_CLASS}
              >
                <option value="">Any size</option>
                {SIZE_BANDS.map((band) => (
                  <option key={band.value} value={band.value}>
                    {band.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-small text-graphite">
              <span className="u-micro">From</span>
              <input
                type="date"
                value={formatDateInput(filters.from)}
                onChange={(e) => navigate({ from: e.target.value || null })}
                aria-label="Uploaded from date"
                className={SELECT_CLASS}
              />
            </label>
            <label className="flex items-center gap-2 text-small text-graphite">
              <span className="u-micro">To</span>
              <input
                type="date"
                value={formatDateInput(filters.to)}
                onChange={(e) => navigate({ to: e.target.value || null })}
                aria-label="Uploaded to date"
                className={SELECT_CLASS}
              />
            </label>

            {/* The sort control is redundant with the list view's own
                clickable column headers, so it only appears in grid view —
                two controls doing the same job would just disagree about
                which one is "the" sort. Disabled (not hidden) while
                "Unused" is active: that scan has its own fixed newest-first
                order, and a control that visibly does nothing says so more
                honestly than one quietly ignored. */}
            {view === "grid" && (
              <label className="flex items-center gap-2 text-small text-graphite">
                <span className="u-micro">Sort</span>
                <select
                  value={filters.sort}
                  onChange={(e) => navigate({ sort: e.target.value })}
                  disabled={filters.filter === "unused"}
                  title={
                    filters.filter === "unused"
                      ? "The unused scan always shows newest first"
                      : undefined
                  }
                  aria-label="Sort order"
                  className={cn(SELECT_CLASS, "disabled:opacity-40")}
                >
                  {(["newest", "oldest", "largest", "name"] as SortValue[]).map(
                    (value) => (
                      <option key={value} value={value}>
                        {SORT_LABELS[value]}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}

            <div
              role="group"
              aria-label="Grid or list view"
              className="flex items-center gap-1"
            >
              <button
                type="button"
                aria-pressed={view === "grid"}
                title="Grid view"
                onClick={() => setView("grid")}
                className={cn(
                  "flex size-11 items-center justify-center rounded-input border outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
                  view === "grid" ? CHIP_ON : CHIP_OFF,
                )}
              >
                <LayoutGrid className="size-4" strokeWidth={1.5} aria-hidden />
                <span className="sr-only">Grid view</span>
              </button>
              <button
                type="button"
                aria-pressed={view === "list"}
                title="List view"
                onClick={() => setView("list")}
                className={cn(
                  "flex size-11 items-center justify-center rounded-input border outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
                  view === "list" ? CHIP_ON : CHIP_OFF,
                )}
              >
                <Rows3 className="size-4" strokeWidth={1.5} aria-hidden />
                <span className="sr-only">List view</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {filters.filter === "unused" && scan && (
        <p className="u-micro">
          {scan.exhausted
            ? `EVERY FILE CHECKED · ${items.length} UNUSED`
            : `THE FIRST ${items.length} UNUSED, OUT OF ${scan.scanned} FILES CHECKED · NARROW BY FOLDER TO GO FURTHER`}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          title={
            total === 0
              ? "No files yet"
              : filters.folder
                ? `Nothing in ${FOLDER_LABELS[filters.folder]} matches these filters`
                : "Nothing matches these filters"
          }
          description={
            total === 0
              ? "Upload images, videos or 3D models to use across products, journal posts and pages."
              : "Try clearing a filter or widening the date range."
          }
          action={
            total === 0 ? (
              <Button
                type="button"
                onClick={() =>
                  document.getElementById(UPLOAD_INPUT_ID)?.click()
                }
              >
                Upload files
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  selection.clear();
                  router.push("/studio/media");
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-small text-graphite">
            <Checkbox
              checked={selection.allSelected}
              onCheckedChange={selection.toggleAll}
              aria-label="Select all"
            />
            Select all on this page
          </label>

          {view === "list" ? (
            <>
              <div className="hidden overflow-x-auto rounded-card border border-border md:block">
                <table className="w-full min-w-[720px] border-collapse text-start">
                  <thead>
                    <StudioTableHead>
                      <th className="w-11 px-4 py-3">
                        <span className="sr-only">Select</span>
                      </th>
                      <SortHead
                        label="Name"
                        sortKey="name"
                        sort={sortState}
                        onSort={handleColumnSort}
                      />
                      <th className="px-4 py-3">Folder</th>
                      <th className="px-4 py-3">Type</th>
                      <SortHead
                        label="Size"
                        sortKey="size"
                        sort={sortState}
                        onSort={handleColumnSort}
                        numeric
                      />
                      <SortHead
                        label="Date"
                        sortKey="date"
                        sort={sortState}
                        onSort={handleColumnSort}
                        numeric
                      />
                      <th className="px-4 py-3">Used in</th>
                    </StudioTableHead>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const filename =
                        item.pathname.split("/").pop() ?? item.pathname;
                      const checked = selection.selected.has(item.id);
                      const dimensions =
                        item.width && item.height
                          ? `${item.width}×${item.height}`
                          : null;
                      return (
                        <StudioRow key={item.id} selected={checked}>
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => selection.toggle(item.id)}
                              aria-label={`Select ${filename}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setDetailId(item.id)}
                              className="flex items-center gap-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            >
                              {item.favourite && (
                                <Star
                                  className="size-3.5 shrink-0 fill-current text-sapphire-ink"
                                  strokeWidth={1.5}
                                  aria-hidden
                                />
                              )}
                              <span
                                className="max-w-64 truncate font-medium text-foreground"
                                title={filename}
                              >
                                {filename}
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-graphite">
                            {FOLDER_LABELS[item.folder as MediaFolder] ??
                              item.folder}
                          </td>
                          <td className="px-4 py-3 text-graphite">
                            {TYPE_LABELS[item.type]}
                            {dimensions ? ` · ${dimensions}` : ""}
                          </td>
                          <td className="u-num px-4 py-3 text-end">
                            {formatBytes(item.bytes)}
                          </td>
                          <td className="u-num px-4 py-3 text-end">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                          <td
                            className="max-w-56 truncate px-4 py-3 text-graphite"
                            title={item.usedIn.join(" · ") || undefined}
                          >
                            {item.usedIn.length > 0
                              ? item.usedIn.join(" · ")
                              : "Not referenced"}
                          </td>
                        </StudioRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:hidden">
                {items.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    selected={selection.selected.has(item.id)}
                    onToggle={() => selection.toggle(item.id)}
                    onOpen={() => setDetailId(item.id)}
                  />
                ))}
              </ul>
            </>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  selected={selection.selected.has(item.id)}
                  onToggle={() => selection.toggle(item.id)}
                  onOpen={() => setDetailId(item.id)}
                />
              ))}
            </ul>
          )}

          {loadMoreHref && (
            <div className="flex justify-center">
              <Link
                href={loadMoreHref}
                className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-small text-foreground outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-sapphire-ink/50 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
              >
                Load more
              </Link>
            </div>
          )}
        </>
      )}

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="outline"
          size="sm"
          disabled={favouriting}
          onClick={() => toggleFavourite(true)}
        >
          <Star strokeWidth={1.5} /> Favourite
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={favouriting}
          onClick={() => toggleFavourite(false)}
        >
          Unfavourite
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)}>
          Move
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAltOpen(true)}>
          Description
        </Button>
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

      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        ids={selection.ids}
        onDone={() => {
          selection.clear();
          router.refresh();
        }}
      />

      <BulkAltDialog
        open={altOpen}
        onOpenChange={setAltOpen}
        ids={selection.ids}
        onDone={() => {
          selection.clear();
          router.refresh();
        }}
      />

      <MediaDetailDrawer
        item={detailItem}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      />
    </div>
  );
}

function MediaCard({
  item,
  selected,
  onToggle,
  onOpen,
}: {
  item: MediaItem;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const router = useRouter();
  const filename = item.pathname.split("/").pop() ?? item.pathname;
  const dimensions =
    item.width && item.height ? `${item.width}×${item.height}` : null;
  const duration = formatDuration(item.duration);

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-card border bg-card shadow-e1 transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
        selected ? "border-sapphire-ink" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-square w-full bg-background outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
        aria-label={`Open details for ${filename}`}
      >
        <MediaThumb item={item} filename={filename} />
        {item.provenance === "AI" && (
          <span className="absolute end-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-card/95 px-2 py-1 text-12 text-graphite">
            <Sparkles className="size-3" strokeWidth={1.5} aria-hidden />
            AI
          </span>
        )}
        {item.favourite && (
          <span className="absolute end-2 bottom-2 z-10 flex size-6 items-center justify-center rounded-full bg-card/95">
            <Star
              className="size-3.5 fill-current text-sapphire-ink"
              strokeWidth={1.5}
              aria-hidden
            />
          </span>
        )}
        {duration && (
          <span className="u-num absolute bottom-2 start-2 z-10 rounded-xs bg-obsidian/80 px-1.5 py-0.5 text-12 text-mineral">
            {duration}
          </span>
        )}
      </button>
      <span className="absolute start-2 top-2 z-10 flex size-8 items-center justify-center rounded-input bg-card/95">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${filename}`}
        />
      </span>
      <div className="space-y-1.5 p-3">
        <p
          className="truncate text-small font-medium text-foreground"
          title={filename}
        >
          {filename}
        </p>
        <p className="u-micro">
          {TYPE_LABELS[item.type]}
          {dimensions ? ` · ${dimensions}` : ""} · {formatBytes(item.bytes)}
        </p>
        {item.tags.length > 0 && (
          <p
            className="truncate text-12 text-graphite"
            title={item.tags.join(", ")}
          >
            {item.tags.map((t) => `#${t}`).join(" ")}
          </p>
        )}
        <p
          className="truncate text-small text-graphite"
          title={item.usedIn.join(" · ") || undefined}
        >
          {item.usedIn.length > 0
            ? `Used: ${item.usedIn.join(" · ")}`
            : "Not referenced"}
        </p>
        {item.type === "IMAGE" && (
          <AltField
            id={item.id}
            alt={item.alt}
            name={filename}
            router={router}
          />
        )}
      </div>
    </li>
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
  router,
}: {
  id: string;
  alt: string | null;
  name: string;
  router: ReturnType<typeof useRouter>;
}) {
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
