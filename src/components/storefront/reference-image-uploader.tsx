"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import {
  MAX_REFERENCE_IMAGE_MB,
  MAX_REFERENCE_IMAGES,
  REFERENCE_IMAGE_TYPES,
} from "@/lib/upload-client";
import { cn } from "@/lib/utils";

type PreviewItem = { file: File; previewUrl: string };
type Rejection = { id: string; name: string; reason: string };

/**
 * `Upload` — REDESIGN.md §4.6.
 *
 * ```
 * + ADD REFERENCES
 *
 * Drop images here or browse
 * JPG · PNG · WEBP · MAX 5 MB          0 / 5
 * ```
 *
 * A dashed 1px hairline zone, 120px tall. Drag-over fills to sand with a
 * sapphire hairline. Accepted files render as 64px thumbnails with a per-file
 * progress hairline and an `×`; rejected files render inline with a `Retry`
 * link. Nothing here is a card, a shadow or an icon-per-benefit — the zone is
 * type and one dashed rule (§3.5, §3.7).
 *
 * ## What this component does not do
 *
 * **It does not upload.** Files stay in the browser until the parent form
 * submits, which is why abandoning a commission brief costs nothing and why
 * the upload endpoint, the 5 MB ceiling and the three accepted MIME types all
 * still live in `@/lib/upload-client` — the single source both public order
 * forms share. This is a visual rebuild of the picker, not a change to the
 * pipeline: the same `File[]` reaches the parent, the same
 * `uploadReferenceImages` call sends it, and the same URLs land on the
 * Inquiry.
 *
 * **The progress hairline is real, not decorative.** `uploadReferenceImages`
 * reports whole files as they complete, so the parent passes that count down
 * as `uploadedCount` and each thumbnail resolves to done, in-flight or
 * waiting. A bar that animates on a timer would be a lie about a network.
 *
 * Copy for the chrome comes from the `Upload` namespace; the three rejection
 * sentences stay on the existing `Product.referenceUploader` keys they have
 * always used, because the order panel shows the identical rejections and the
 * two must not drift.
 */
export function ReferenceImageUploader({
  idPrefix,
  onFilesChange,
  disabled = false,
  maxFiles = MAX_REFERENCE_IMAGES,
  uploadedCount = 0,
  uploading = false,
  labelledBy,
  className,
}: {
  /** Unique id prefix so several forms can coexist on one page. */
  idPrefix?: string;
  /** Reports the current file list whenever it changes. */
  onFilesChange?: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  /** Whole files already uploaded by the parent — drives the hairlines. */
  uploadedCount?: number;
  /** True while the parent's upload is in flight. */
  uploading?: boolean;
  /** Id of the visible field label, wired to the file input. */
  labelledBy?: string;
  className?: string;
}) {
  const t = useTranslations("Upload");
  const tErrors = useTranslations("Product.referenceUploader");
  const reactId = useId();
  const inputId = `${idPrefix ?? reactId}-reference-images`;

  const [items, setItems] = useState<PreviewItem[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Revoke every live object URL on unmount (handlers keep this in sync).
  const urlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function commit(next: PreviewItem[]) {
    urlsRef.current = next.map((item) => item.previewUrl);
    setItems(next);
    onFilesChange?.(next.map((item) => item.file));
  }

  /* Identical acceptance rules to the shipped picker — same ceiling, same
     three MIME types, same three sentences, same order of checks. Only the
     presentation of a refusal moved: it used to replace a single shared error
     line, so a second bad file silently erased the first one's reason. */
  function addFiles(incoming: FileList | File[]) {
    const accepted: PreviewItem[] = [];
    const refused: Rejection[] = [];

    for (const file of Array.from(incoming)) {
      if (items.length + accepted.length >= maxFiles) {
        refused.push({
          id: `${file.name}-${file.size}-full`,
          name: file.name,
          reason: tErrors("errorTooMany", { max: maxFiles }),
        });
        break;
      }
      if (!(REFERENCE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        refused.push({
          id: `${file.name}-${file.size}-type`,
          name: file.name,
          reason: tErrors("errorType", { name: file.name }),
        });
        continue;
      }
      if (file.size > MAX_REFERENCE_IMAGE_MB * 1024 * 1024) {
        refused.push({
          id: `${file.name}-${file.size}-size`,
          name: file.name,
          reason: tErrors("errorSize", {
            name: file.name,
            max: MAX_REFERENCE_IMAGE_MB,
          }),
        });
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    setRejections(refused);
    if (accepted.length > 0) commit([...items, ...accepted]);
  }

  function removeAt(index: number) {
    const target = items[index];
    if (target) URL.revokeObjectURL(target.previewUrl);
    setRejections([]);
    commit(items.filter((_, i) => i !== index));
  }

  const atCapacity = items.length >= maxFiles;
  const zoneDisabled = disabled || atCapacity;

  return (
    <div data-slot="sf-upload" className={cn("flex flex-col gap-4", className)}>
      {/* The zone. A <label> wrapping a visually hidden real file input, so
          click, keyboard and screen-reader flows are all native and
          `has-[input:focus-visible]` can paint the focus ring on the zone
          itself (Part 17: focus never removed). */}
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!zoneDisabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!zoneDisabled && event.dataTransfer.files.length > 0) {
            addFiles(event.dataTransfer.files);
          }
        }}
        className={cn(
          "flex min-h-30 cursor-pointer flex-col justify-center gap-2 rounded-input border border-dashed border-hairline px-5 py-6",
          "transition-colors duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:transition-none",
          "hover:border-graphite has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-focus has-[input:focus-visible]:ring-offset-3",
          // Drag-over: fills to sand with a sapphire hairline (§4.6).
          dragging && "border-solid border-sapphire bg-sand",
          zoneDisabled && "cursor-not-allowed opacity-40",
        )}
      >
        <span className="u-micro text-champagne-ink">{t("add")}</span>
        <span className="font-body text-16 text-ink">{t("drop")}</span>
        <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="u-micro">
            {t("formats", { maxMb: MAX_REFERENCE_IMAGE_MB })}
          </span>
          <span className="u-micro" aria-hidden>
            {t("counter", { count: items.length, max: maxFiles })}
          </span>
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={zoneDisabled}
          aria-labelledby={labelledBy}
          aria-describedby={`${inputId}-formats`}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            // Allow re-selecting the same file after a remove.
            event.target.value = "";
          }}
        />
      </label>

      {/* The count again, this time for assistive tech: the visual counter is
          inside the label and would otherwise be read as part of the control's
          name every time it changes. */}
      <p id={`${inputId}-formats`} className="sr-only" aria-live="polite">
        {t("counterLong", { count: items.length, max: maxFiles })}
      </p>

      {rejections.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rejections.map((rejection) => (
            <li
              key={rejection.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-s-2 border-alert ps-3"
            >
              <span role="alert" className="font-body text-14 text-alert">
                {rejection.reason}
              </span>
              {/* Retry re-opens the picker so a refused photo can be swapped
                  for one that fits — the only recovery there is for a file
                  the ceiling rejected. */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setRejections((prev) =>
                    prev.filter((r) => r.id !== rejection.id),
                  );
                  inputRef.current?.click();
                }}
                className="inline-flex min-h-11 items-center font-body text-14 font-medium text-sapphire underline underline-offset-4 outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:text-sapphire-hi focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 motion-reduce:transition-none"
              >
                {t("retry")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-4">
          {items.map((item, index) => {
            const done = uploading && index < uploadedCount;
            const inFlight = uploading && index === uploadedCount;
            return (
              <li key={item.previewUrl} className="flex flex-col gap-1.5">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob: object URLs for local previews; never next/image */}
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="size-16 rounded-input border border-hairline bg-sand object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    disabled={disabled}
                    aria-label={tErrors("remove", { name: item.file.name })}
                    // before: extends the 24px glyph to a 44px hit area.
                    className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-obsidian text-mineral outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) before:absolute before:-inset-2.5 hover:bg-sapphire focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 motion-reduce:transition-none"
                  >
                    <X aria-hidden strokeWidth={1.5} className="size-3.5" />
                  </button>
                </div>
                {/* The per-file progress hairline. A track plus a fill that is
                    full when that file has landed, indeterminate while it is
                    the one in flight, and empty otherwise. */}
                <span
                  aria-hidden
                  className="block h-px w-16 overflow-hidden bg-hairline"
                >
                  <span
                    className={cn(
                      "block h-px bg-sapphire transition-[width] duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
                      done
                        ? "w-full"
                        : inFlight
                          ? "w-1/2 animate-pulse motion-reduce:animate-none"
                          : "w-0",
                    )}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
