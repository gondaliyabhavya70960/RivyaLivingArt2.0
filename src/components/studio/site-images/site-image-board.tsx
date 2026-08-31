"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  Crosshair,
  Loader2,
  RotateCcw,
  Smartphone,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { uploadMediaFiles } from "@/actions/media";
import {
  importBundledDefaults,
  resetSiteImage,
  setSiteImage,
  setSiteImageFocal,
  setSiteImageMobile,
} from "@/actions/site-images";
import { publishSurface } from "@/actions/publish";
import { setSiteCopy } from "@/actions/site-copy";
import { Input } from "@/components/ui/input";
import { defaultLocale } from "@/i18n/config";
import { needsMobileCrop } from "@/lib/site-images";
import { MediaPicker } from "@/components/studio/media/media-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isOptimizableImageSrc } from "@/lib/image-src";
import type { SiteImageSlot } from "@/lib/site-images";
import { cn } from "@/lib/utils";

export type SiteImageRow = SiteImageSlot & {
  /** What the storefront renders today — the override, or the bundled file. */
  current: string;
  /** True when an owner override exists, i.e. Reset will change something. */
  overridden: boolean;
  /** Separate crop below 768px. Null renders `current` at every width. */
  mobileUrl: string | null;
  /** object-position, 0–1. (0.5, 0.5) is centred, which is CSS's default. */
  focalX: number;
  focalY: number;
  /** The narrowest file that still looks right here — a warning, not a gate. */
  minWidth: number;
  /** English alt text, or null when the picture is deliberately decorative. */
  alt: string | null;
  altOverridden: boolean;
  /**
   * A change is staged and not live yet.
   *
   * Every write here stages; the surface's publish bar (on Site Copy, which
   * publishes copy and images together) promotes it. Without this flag the
   * board looked identical before and after a save, so the only honest read
   * of a successful edit was "nothing happened".
   */
  unpublished: boolean;
};

export type SiteImageGroupRows = { group: string; slots: SiteImageRow[] };

const isVideo = (url: string) => /\.(mp4|webm)(\?|$)/i.test(url);

/**
 * The Site Images board — one row per named slot, grouped by the surface it
 * appears on.
 *
 * The picture is the control: each row shows exactly what the storefront is
 * rendering right now, at the ratio the layout crops to, so the choice is made
 * by looking rather than by reading a filename. "Default" vs "Custom" is a
 * badge and not a colour alone, and Reset is only enabled where it would
 * actually do something.
 */
export function SiteImageBoard({
  groups,
  canImport,
  blobReady,
  pendingImport,
}: {
  groups: SiteImageGroupRows[];
  /** Import writes to storage and is ADMIN-only, matching the action's guard. */
  canImport: boolean;
  /** False when no Blob store is connected — importing would save files that
   *  vanish with the serverless invocation, so the action refuses. Say so here
   *  rather than letting the button fail on click. */
  blobReady: boolean;
  /** Slots still pointing at a bundled file — the import button's counter. */
  pendingImport: number;
}) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);

  async function runImport() {
    setImporting(true);
    const res = await importBundledDefaults();
    setImporting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const s = res.data;
    if (!s) return;
    if (s.uploaded === 0 && s.failed.length === 0) {
      toast.info(
        "Nothing to import — every slot already points at the library.",
      );
    } else if (s.failed.length > 0) {
      toast.warning(
        `Imported ${s.uploaded} file${s.uploaded === 1 ? "" : "s"}; ${s.failed.length} failed (${s.failed.join(", ")}).`,
      );
    } else {
      toast.success(
        `Imported ${s.uploaded} file${s.uploaded === 1 ? "" : "s"} into the media library.`,
      );
    }
    router.refresh();
  }

  return (
    <div className="space-y-10">
      {canImport && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-surface p-4">
          <div className="min-w-0 flex-1 basis-80">
            <p className="text-16 font-medium text-foreground">
              Move the bundled pictures into the media library
            </p>
            <p className="mt-1 max-w-[70ch] text-small leading-relaxed text-graphite">
              Uploads every image still shipping with the code, then points its
              slot at the uploaded copy — after this you can swap any of them
              here or from the library. Safe to run more than once: slots you
              have already changed are left alone.
            </p>
            {!blobReady && (
              <p className="mt-2 max-w-[70ch] text-small leading-relaxed text-alert">
                No Blob store is connected to this environment, so an import
                would save files that immediately disappear. Add one to the
                Vercel project (it sets <code>BLOB_READ_WRITE_TOKEN</code>) and
                redeploy — the pictures keep working from their bundled files
                until then.
              </p>
            )}
          </div>
          <Button
            onClick={runImport}
            disabled={importing || pendingImport === 0 || !blobReady}
          >
            {importing ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Importing…
              </>
            ) : (
              `Import ${pendingImport} bundled image${pendingImport === 1 ? "" : "s"}`
            )}
          </Button>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.group} aria-labelledby={`grp-${group.group}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
            <h2
              id={`grp-${group.group}`}
              className="font-display text-25 text-foreground"
            >
              {group.group}
            </h2>
            <GroupPublish
              group={group.group}
              pending={group.slots.filter((s) => s.unpublished).length}
            />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.slots.map((slot) => (
              <SlotCard key={slot.key} slot={slot} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Publish one surface's staged image changes, from the screen that staged them.
 *
 * The publish bar lives on Site Copy and publishes a surface's copy AND its
 * images together — which is right, and is why this is a plain button rather
 * than a second sticky bar competing with it. But two image groups,
 * `Navigation` and `Studio`, have no Site Copy group at all
 * (`site-copy/page.tsx:64` falls back to the first group when `?group=` does
 * not match), so a staged change to a menu tile could be saved and then never
 * released from anywhere. Publishing per group here covers all ten uniformly
 * instead of signposting a route that silently misdirects for two of them.
 *
 * `publishSurface` is transactional and writes a `ContentRevision`, so
 * publishing from here is the same operation with the same history.
 */
function GroupPublish({ group, pending }: { group: string; pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (pending === 0) return null;

  async function run() {
    setBusy(true);
    const res = await publishSurface(group);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      pending === 1
        ? `Published ${group} — 1 image change is now live.`
        : `Published ${group} — ${pending} image changes are now live.`,
    );
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-12 text-muted-foreground">
        {pending} not published
      </span>
      <Button size="sm" onClick={run} disabled={busy}>
        {busy ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Publishing…
          </>
        ) : (
          "Publish"
        )}
      </Button>
    </div>
  );
}

/**
 * Arrow-key nudge for the focal picker, as a fraction of the frame. 2% is a
 * couple of pixels on the preview; Shift jumps in tenths so crossing the whole
 * picture takes ten presses rather than fifty.
 */
const FOCAL_STEP = 0.02;
const FOCAL_STEP_COARSE = 0.1;

/**
 * A focal coordinate, clamped to the frame and rounded to the 1% the picker
 * can express.
 *
 * The rounding matters for more than tidiness: repeated float addition down an
 * arrow-key run produces 0.020000000000000004, which would be stored verbatim
 * and read back out to a screen reader as a twenty-digit percentage.
 * object-position at 1% granularity is imperceptible, and rounding the pointer
 * path the same way keeps both inputs in one value space.
 */
function clampFocal(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

function SlotCard({ slot }: { slot: SiteImageRow }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const focalFrame = useRef<HTMLDivElement>(null);
  const focalButton = useRef<HTMLButtonElement>(null);
  const focalHintId = useId();
  const [busy, setBusy] = useState(false);
  const [focalMode, setFocalMode] = useState(false);
  // The unsaved focal point while picking. Null whenever focal mode is off;
  // seeded from the slot by the button that opens the mode, never in an effect
  // (react-hooks/set-state-in-effect).
  const [focalDraft, setFocalDraft] = useState<{ x: number; y: number } | null>(
    null,
  );
  // null means the alt row is closed; opening seeds it in the click handler,
  // never in an effect (react-hooks/set-state-in-effect).
  const [altDraft, setAltDraft] = useState<string | null>(null);

  async function apply(url: string, mediaId?: string | null) {
    setBusy(true);
    const res = await setSiteImage({ key: slot.key, url, mediaId });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${slot.label} updated.`);
    // The draft describes a point on the OLD picture. Keeping it would let a
    // later Enter commit coordinates measured against an image that is gone.
    closeFocal(false);
    router.refresh();
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setBusy(true);
    const form = new FormData();
    form.append("files", file);
    form.append("folder", "site");
    const res = await uploadMediaFiles(form);
    input.value = "";
    if (!res.ok || !res.data?.[0]) {
      setBusy(false);
      toast.error(
        res.ok
          ? "That file was rejected — check the type and size."
          : res.error,
      );
      return;
    }
    const uploaded = res.data[0];
    setBusy(false);
    await apply(uploaded.url, uploaded.id);
  }

  function openFocal() {
    setFocalDraft({ x: slot.focalX, y: slot.focalY });
    setFocalMode(true);
    // Move focus onto the picture so the keyboard path starts where the
    // pointer path starts. The frame carries tabIndex={-1} even when the mode
    // is off precisely so this call lands without waiting for a re-render.
    focalFrame.current?.focus();
  }

  /**
   * `restoreFocus` is false only when the picture underneath the draft changed
   * (upload, library pick, phone crop, reset) — there the operator's focus is
   * already wherever that control lives and yanking it back would be worse.
   *
   * Otherwise focus goes home to the button that opened the mode. Without this
   * the frame keeps DOM focus while losing its role, name, description and tab
   * stop in the same commit, which leaves focus on an anonymous div and sends
   * the next Tab to the top of the card instead of onward (WCAG 2.4.3).
   */
  function closeFocal(restoreFocus = true) {
    setFocalMode(false);
    setFocalDraft(null);
    if (restoreFocus && focalFrame.current?.contains(document.activeElement)) {
      focalButton.current?.focus();
    }
  }

  async function saveFocal(x: number, y: number) {
    setBusy(true);
    const res = await setSiteImageFocal({
      key: slot.key,
      x,
      y,
      desktopUrl: slot.current,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    closeFocal();
    toast.success(`${slot.label} — focus moved.`);
    router.refresh();
  }

  /**
   * Click the preview to say where the subject is.
   *
   * The coordinates are read off the click and written straight through — no
   * drag handle, no modal. A crop is judged by looking at it, and the preview
   * is already the picture at the ratio the layout uses.
   */
  async function onPickFocal(e: React.MouseEvent<HTMLDivElement>) {
    if (!focalMode || busy) return;
    // A click with no pointer behind it carries clientX/clientY of 0, which
    // this handler would read as "the operator chose the top-left corner" and
    // commit. Chromium synthesises exactly that click when assistive tech
    // invokes an element's default action, so a screen-reader Enter on the
    // frame would silently crop every picture to its corner. detail === 0
    // marks those; a real pointer click always reports at least 1.
    if (e.detail === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    await saveFocal(
      clampFocal((e.clientX - rect.left) / rect.width),
      clampFocal((e.clientY - rect.top) / rect.height),
    );
  }

  /**
   * The same picker for a keyboard, which had none: the frame was a plain div
   * with an onClick, so setting a focal point was unreachable without a mouse
   * (WCAG 2.1.1). Neither gate caught it — Next's eslint preset omits
   * `click-events-have-key-events`, and axe cannot see a React handler.
   *
   * Arrows nudge a draft, Enter commits it, Escape abandons it. Arrow keys are
   * NOT mirrored for RTL because the studio is English-only by design; the
   * storefront's nine locales never reach this screen.
   */
  function onFocalKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!focalMode || busy) return;
    const point = focalDraft ?? { x: slot.focalX, y: slot.focalY };
    const step = e.shiftKey ? FOCAL_STEP_COARSE : FOCAL_STEP;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        // Otherwise the arrow scrolls the board out from under the picture.
        e.preventDefault();
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setFocalDraft({
          x: clampFocal(point.x + dx),
          y: clampFocal(point.y + dy),
        });
        break;
      }
      // Space would scroll; Enter would submit an ancestor form.
      case "Enter":
      case " ":
        e.preventDefault();
        // A native button fires on Enter KEYDOWN, and openFocal() moves focus
        // synchronously — so every auto-repeat of that same held Enter is
        // delivered here and would commit a draft the operator never touched.
        // Arrows deliberately keep their repeat: holding one to travel across
        // the frame is the point.
        if (e.repeat) return;
        void saveFocal(point.x, point.y);
        break;
      case "Escape":
        e.preventDefault();
        closeFocal();
        break;
      default:
        break;
    }
  }

  async function applyMobile(url: string, mediaId?: string | null) {
    setBusy(true);
    const res = await setSiteImageMobile({
      key: slot.key,
      url,
      mediaId,
      desktopUrl: slot.current,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      url
        ? `${slot.label} — phone crop set.`
        : `${slot.label} — phone crop removed.`,
    );
    closeFocal(false);
    router.refresh();
  }

  async function saveAlt() {
    if (altDraft === null || !slot.altKey) return;
    setBusy(true);
    const res = await setSiteCopy({
      key: slot.altKey,
      locale: defaultLocale,
      value: altDraft,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAltDraft(null);
    toast.success(`${slot.label} — description updated.`);
    router.refresh();
  }

  async function onUploadMobile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setBusy(true);
    const form = new FormData();
    form.append("files", file);
    form.append("folder", "site");
    const res = await uploadMediaFiles(form);
    input.value = "";
    if (!res.ok || !res.data?.[0]) {
      setBusy(false);
      toast.error(
        res.ok
          ? "That file was rejected — check the type and size."
          : res.error,
      );
      return;
    }
    const uploaded = res.data[0];
    setBusy(false);
    await applyMobile(uploaded.url, uploaded.id);
  }

  async function onReset() {
    setBusy(true);
    const res = await resetSiteImage(slot.key);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${slot.label} reset to the bundled image.`);
    closeFocal(false);
    router.refresh();
  }

  const video = isVideo(slot.current);

  const focalMoved = slot.focalX !== 0.5 || slot.focalY !== 0.5;
  // What the ring shows: the unsaved draft while picking, the saved point
  // otherwise. Arrow keys have to move something visible or they read as dead.
  const focalPoint = focalDraft ?? { x: slot.focalX, y: slot.focalY };

  return (
    <li className="flex flex-col overflow-hidden rounded-md border border-border bg-surface">
      <div
        ref={focalFrame}
        // -1 when the mode is off so the board does not grow one tab stop per
        // slot; 0 while picking so the frame is the natural next stop.
        tabIndex={focalMode ? 0 : -1}
        // "application", not "group". A grouping role leaves NVDA and JAWS in
        // browse mode, where the virtual cursor eats the arrow keys and this
        // handler is never reached — the keyboard path would work for a
        // sighted Tab user and be dead for the screen-reader user the hint
        // promises it to. "application" is what tells those readers to pass
        // keys through, and the cost APG warns about does not apply here: the
        // subtree is one picture plus two spans, and the instructions are
        // exposed through aria-describedby rather than by browsing into it.
        role={focalMode ? "application" : undefined}
        aria-label={focalMode ? `Focus point for ${slot.label}` : undefined}
        aria-describedby={focalMode ? focalHintId : undefined}
        className={cn(
          // The global :focus-visible outline cannot show on this frame, and
          // both ways of moving it fail: at its own +3px offset the card's
          // overflow-hidden clips it, and pulled inward it lands UNDER the
          // `next/image` fill, which is absolutely positioned and therefore
          // paints after its parent's box decoration. So the ring is suppressed
          // here and drawn by the overlay below, which is a later positioned
          // sibling and paints above the picture — the same reason the hint bar
          // and the crosshair are visible at all.
          "group/focal relative aspect-[16/10] bg-obsidian",
          // Suppressed ONLY while the overlay below is mounted to replace it.
          // Unconditionally, it stripped the ring from a frame that still held
          // focus the instant the mode closed (WCAG 2.4.7).
          focalMode &&
            "cursor-crosshair ring-2 ring-sapphire focus-visible:outline-none",
        )}
        onClick={onPickFocal}
        onKeyDown={onFocalKeyDown}
      >
        {video ? (
          <video
            src={slot.current}
            muted
            playsInline
            loop
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <Image
            src={slot.current}
            alt=""
            fill
            sizes="(min-width:1280px) 22vw, (min-width:640px) 45vw, 90vw"
            unoptimized={!isOptimizableImageSrc(slot.current)}
            className="object-cover"
          />
        )}
        {(focalMoved || focalMode) && !video && (
          <span
            aria-hidden
            className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-mineral shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
            style={{
              left: `${focalPoint.x * 100}%`,
              top: `${focalPoint.y * 100}%`,
            }}
          />
        )}
        {focalMode && (
          <>
            <span
              id={focalHintId}
              className="pointer-events-none absolute inset-x-0 bottom-0 bg-obsidian/80 p-2 text-center font-mono text-12 text-mineral"
            >
              click where the subject is, or arrow keys then Enter
            </span>
            {/* Champagne, not the sapphire --focus resolves to here: Part 16
                names champagne as the companion for exactly this case, because
                sapphire on a dark band is invisible.

                z-10 because the hint bar above is a LATER sibling at z-auto and
                would otherwise composite its 80% obsidian over the ring's
                bottom edge, leaving a three-sided indicator. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-1 z-10 hidden border-2 border-champagne group-focus-visible/focal:block"
            />
          </>
        )}
        {/* Always mounted, text conditional. A live region has to be in the
            tree BEFORE its content changes; inserting it already populated is
            not a mutation, so the position the picker opens on would never be
            announced. Clearing to "" on close is silent, because aria-relevant
            excludes removals by default. */}
        <span aria-live="polite" className="sr-only">
          {focalMode
            ? `Focus ${Math.round(focalPoint.x * 100)}% from the left, ${Math.round(
                focalPoint.y * 100,
              )}% from the top`
            : ""}
        </span>
        <span className="absolute end-2 top-2 flex gap-1.5">
          <Badge variant="outline" className="bg-bg/90 font-mono text-12">
            {slot.ratio}
          </Badge>
          <Badge
            variant={slot.overridden ? "default" : "secondary"}
            className="bg-bg/90 font-mono text-12"
          >
            {slot.overridden ? "Custom" : "Default"}
          </Badge>
          {slot.unpublished && (
            <Badge variant="outline" className="bg-bg/90 font-mono text-12">
              Not published
            </Badge>
          )}
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-obsidian/60">
            <Loader2 aria-hidden className="size-6 animate-spin text-mineral" />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="text-16 font-medium text-foreground">{slot.label}</p>
          <p className="mt-0.5 text-small text-graphite">{slot.where}</p>
          {slot.note && (
            <p className="mt-2 text-small leading-relaxed text-graphite">
              {slot.note}
            </p>
          )}
          <p className="mt-2 font-mono text-12 text-graphite">
            {slot.ratio} · {slot.minWidth}px wide or more
          </p>
        </div>

        {/* ————— alt text, beside the picture it describes ————— */}
        {slot.altKey ? (
          <div className="rounded-md border border-border bg-bg p-3">
            {altDraft === null ? (
              <>
                <p className="u-micro mb-1 text-graphite">Description</p>
                <p className="text-small leading-relaxed text-foreground">
                  {slot.alt || (
                    <span className="text-alert">
                      Missing — screen readers get nothing.
                    </span>
                  )}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-auto p-0 text-small underline"
                  disabled={busy}
                  onClick={() => setAltDraft(slot.alt ?? "")}
                >
                  Edit description
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <Input
                  value={altDraft}
                  autoFocus
                  aria-label={`Description for ${slot.label}`}
                  onChange={(e) => setAltDraft(e.target.value)}
                />
                <p className="text-12 leading-relaxed text-graphite">
                  Describe what the picture shows, in English. The other eight
                  languages fall back to this until they are written on Site
                  Copy.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={saveAlt}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setAltDraft(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-12 leading-relaxed text-graphite">
            Decorative — deliberately has no description, so screen readers skip
            it rather than announcing a picture that carries no meaning.
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {/* A click proxy, not a control. `sr-only` hides it from the eye but
              KEEPS it in the accessibility tree, so a screen-reader user used
              to tab onto 68 unnamed file inputs — axe called it critical. The
              named Button below is the control; this input is removed from
              both the tree and the tab order. */}
          <input
            ref={fileInput}
            type="file"
            accept="image/webp,image/avif,image/jpeg,image/png,video/mp4,video/webm"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onUpload}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            aria-label={`Upload a new image for ${slot.label}`}
            onClick={() => fileInput.current?.click()}
          >
            <Upload aria-hidden className="size-4" />
            Upload
          </Button>
          <MediaPicker
            defaultFolder="site"
            triggerLabel="From library"
            onSelect={(item) => void apply(item.url, item.id)}
          />
          {!video && (
            <Button
              ref={focalButton}
              type="button"
              size="sm"
              variant={focalMode ? "default" : "outline"}
              disabled={busy}
              aria-pressed={focalMode}
              onClick={() => (focalMode ? closeFocal() : openFocal())}
            >
              <Crosshair aria-hidden className="size-4" />
              {focalMoved ? "Focus set" : "Focus"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy || !slot.overridden}
            onClick={onReset}
            className={cn(!slot.overridden && "opacity-50")}
          >
            <RotateCcw aria-hidden className="size-4" />
            Reset
          </Button>
        </div>

        {/* ————— phone crop, only where the frame is wide enough to need one ————— */}
        {needsMobileCrop(slot.ratio) && !video && (
          <div className="rounded-md border border-border bg-bg p-3">
            <p className="u-micro mb-1 flex items-center gap-1.5 text-graphite">
              <Smartphone aria-hidden className="size-3.5" />
              Phone crop
            </p>
            {slot.mobileUrl ? (
              <div className="flex items-center gap-3">
                <span className="relative aspect-[4/5] w-12 shrink-0 overflow-hidden rounded bg-obsidian">
                  <Image
                    src={slot.mobileUrl}
                    alt=""
                    fill
                    sizes="48px"
                    unoptimized={!isOptimizableImageSrc(slot.mobileUrl)}
                    className="object-cover"
                  />
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void applyMobile("")}
                >
                  <RotateCcw aria-hidden className="size-4" />
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <p className="mb-2 text-12 leading-relaxed text-graphite">
                  This frame is {slot.ratio}. On a phone that keeps a narrow
                  band of it — add a taller crop if the subject gets lost.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={mobileInput}
                    type="file"
                    accept="image/webp,image/avif,image/jpeg,image/png"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={onUploadMobile}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    aria-label={`Upload a phone crop for ${slot.label}`}
                    onClick={() => mobileInput.current?.click()}
                  >
                    <Upload aria-hidden className="size-4" />
                    Upload
                  </Button>
                  <MediaPicker
                    defaultFolder="site"
                    triggerLabel="From library"
                    onSelect={(item) => void applyMobile(item.url, item.id)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
