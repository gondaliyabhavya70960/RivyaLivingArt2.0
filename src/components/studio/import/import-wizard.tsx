"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Link2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  previewImport,
  runImport,
  type ImportPreview,
  type ImportReport,
} from "@/actions/import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  IMPORT_TEMPLATES,
  MAX_IMPORT_ROWS,
  templateColumns,
  type ImportTemplate,
  type ImportTypeKey,
} from "@/lib/import/templates";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

// ————————————————————— Module-level helpers —————————————————————

const csvEscape = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

function templateCsv(template: ImportTemplate): string {
  const columns = templateColumns(template);
  const header = columns.map(csvEscape).join(",");
  const example = columns
    .map((column) => csvEscape(template.example[column] ?? ""))
    .join(",");
  return `${header}\n${example}\n`;
}

function downloadTemplate(template: ImportTemplate) {
  const blob = new Blob([templateCsv(template)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rivya-living-art-${template.key}-template.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000; // btoa in chunks — spreading 8 MB overflows the stack
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const rowIdentifier = (data: Record<string, string>) =>
  data.slug || data.title || data.name || data.question || "—";

// ————————————————————— Small presentational pieces —————————————————————

function StepRail({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Content type", "Source", "Review & import"] as const;
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      {steps.map((label, i) => {
        const number = (i + 1) as 1 | 2 | 3;
        const state =
          number < step ? "done" : number === step ? "active" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className="text-foreground/20">—</span>}
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                state === "active" && "bg-primary text-primary-foreground",
                state === "done" && "bg-sand text-sapphire-ink",
                state === "todo" && "bg-muted text-muted-foreground",
              )}
            >
              {number}
            </span>
            <span
              className={cn(
                state === "active"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StatusBadge({ status }: { status: "create" | "update" | "error" }) {
  if (status === "create") return <Badge>Create</Badge>;
  if (status === "update") return <Badge variant="secondary">Update</Badge>;
  return (
    <Badge variant="outline" className="border-destructive/40 text-destructive">
      Error
    </Badge>
  );
}

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm shadow-e1">
      <span className="font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

// ————————————————————— Wizard —————————————————————

export function ImportWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [typeKey, setTypeKey] = useState<ImportTypeKey | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [file, setFile] = useState<{ name: string; b64: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  // products only: the operator's explicit opt-in to overwrite rows the
  // owner has edited in the studio — off by default, so a stale export
  // re-run through this screen never silently clobbers a hand-edited product.
  const [overwriteOwnerEdited, setOverwriteOwnerEdited] = useState(false);

  const template = IMPORT_TEMPLATES.find((t) => t.key === typeKey) ?? null;

  function reset() {
    setStep(1);
    setTypeKey(null);
    setSheetUrl("");
    setFile(null);
    setPreview(null);
    setReport(null);
  }

  async function acceptFile(picked: File | undefined) {
    if (!picked) return;
    if (!/\.(csv|xlsx?)$/i.test(picked.name)) {
      toast.error("Pick a .csv or .xlsx file.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      toast.error("That file is too large — keep imports under 8 MB.");
      return;
    }
    try {
      const b64 = await fileToBase64(picked);
      setFile({ name: picked.name, b64 });
      setSheetUrl(""); // one source at a time
    } catch {
      toast.error("Could not read that file. Try again.");
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    void acceptFile(event.target.files?.[0]);
    event.target.value = ""; // allow re-picking the same file
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void acceptFile(event.dataTransfer.files?.[0]);
  }

  async function handlePreview() {
    if (!typeKey) return;
    const url = sheetUrl.trim();
    if (!url && !file) {
      toast.error("Paste a Google Sheets link or pick a file first.");
      return;
    }
    setPreviewing(true);
    const res = await previewImport({
      typeKey,
      source: url ? { kind: "sheet", url } : { kind: "file" },
      fileName: file?.name,
      fileB64: file?.b64,
    });
    setPreviewing(false);
    if (res.ok && res.data) {
      setPreview(res.data);
      setReport(null);
      setOverwriteOwnerEdited(false);
      setStep(3);
      if (res.data.truncated) {
        toast.warning(
          `The file has ${res.data.totalRows} rows — only the first ${MAX_IMPORT_ROWS} were read. Split the rest into another file.`,
        );
      }
    } else if (!res.ok) {
      toast.error(res.error);
    }
  }

  async function handleImport() {
    if (!typeKey || !preview) return;
    const validRows = preview.rows.filter((row) => row.status !== "error");
    if (validRows.length === 0) return;
    setImporting(true);
    const res = await runImport({
      typeKey,
      rows: validRows.map((row) => row.data),
      overwriteOwnerEdited,
    });
    setImporting(false);
    if (res.ok && res.data) {
      setReport(res.data);
      const imported = res.data.created + res.data.updated;
      if (imported > 0) {
        toast.success(
          `Imported ${imported} ${imported === 1 ? "row" : "rows"}.` +
            (res.data.protectedCount > 0
              ? ` ${res.data.protectedCount} ${res.data.protectedCount === 1 ? "row was" : "rows were"} left as ${res.data.protectedCount === 1 ? "it is" : "they are"} — owner-edited, or the catalog fill's own.`
              : ""),
        );
      } else {
        toast.error("Nothing was imported — check the error list.");
      }
    } else if (!res.ok) {
      toast.error(res.error);
    }
  }

  return (
    <div>
      <StepRail step={step} />

      {step === 1 && (
        <div className="space-y-6">
          <div
            role="radiogroup"
            aria-label="Content type"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {IMPORT_TEMPLATES.map((t) => {
              const selected = typeKey === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTypeKey(t.key)}
                  className={cn(
                    "rounded-card border bg-card p-5 text-left shadow-e1 transition-colors",
                    selected
                      ? "border-sapphire-ink ring-2 ring-sapphire-ink/30"
                      : "border-border hover:border-sapphire-ink/40",
                  )}
                >
                  <p className="font-display text-lg text-foreground">
                    {t.label}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {t.docs}
                  </p>
                  <p className="mt-3 font-mono text-12 text-muted-foreground">
                    Required: {t.requiredColumns.join(", ")}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!template}
              onClick={() => template && downloadTemplate(template)}
            >
              <Download /> Download template
            </Button>
            <Button size="sm" disabled={!typeKey} onClick={() => setStep(2)}>
              Continue <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && template && (
        <div className="space-y-6">
          <div className="rounded-card border border-border bg-card p-6 shadow-e1">
            <p className="mb-4 text-sm text-muted-foreground">
              Importing{" "}
              <span className="font-medium text-foreground">
                {template.label}
              </span>{" "}
              — up to {MAX_IMPORT_ROWS} rows per run.
            </p>

            <div className="space-y-1.5">
              <Label
                htmlFor="import-sheet-url"
                className="flex items-center gap-1.5"
              >
                <Link2 className="size-4" /> Google Sheet link
              </Label>
              <Input
                id="import-sheet-url"
                type="url"
                value={sheetUrl}
                onChange={(event) => {
                  setSheetUrl(event.target.value);
                  if (event.target.value.trim()) setFile(null);
                }}
                placeholder="https://docs.google.com/spreadsheets/d/…"
              />
              <p className="text-xs text-muted-foreground">
                The sheet must be shared as “Anyone with the link can view”. The
                first tab is used unless the link has a #gid.
              </p>
            </div>

            <div className="my-5 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                or
              </span>
              <Separator className="flex-1" />
            </div>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-foreground/15 bg-muted/30 px-6 py-8 text-center"
            >
              {file ? (
                <>
                  <FileSpreadsheet className="size-6 text-sapphire-ink" />
                  <p className="text-sm font-medium text-foreground">
                    {file.name}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    Remove file
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop a .csv or .xlsx file here, or
                  </p>
                  <label className="cursor-pointer rounded-sm text-sm font-medium text-sapphire-ink underline-offset-4 hover:underline has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                    browse files
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="sr-only"
                      onChange={handleFileInput}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">Up to 8 MB.</p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              disabled={previewing}
            >
              <ArrowLeft /> Back
            </Button>
            <Button
              size="sm"
              onClick={handlePreview}
              disabled={previewing || (!sheetUrl.trim() && !file)}
            >
              {previewing ? "Reading…" : "Preview"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && template && preview && !report && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <CountChip label="rows" value={preview.counts.total} />
            <CountChip label="new" value={preview.counts.create} />
            <CountChip label="updates" value={preview.counts.update} />
            <CountChip label="errors" value={preview.counts.error} />
          </div>

          {preview.origin === "scraper" && preview.scrapeExport && (
            <div
              role="note"
              aria-label="Product Scraper export"
              className="rounded-card border border-sapphire-ink/30 bg-sapphire-ink/5 p-4 text-sm"
            >
              <p className="font-medium text-foreground">
                This file is a Product Scraper export
              </p>
              <p className="mt-1 text-muted-foreground">
                Every row will be saved as a draft with the rewrite guard on, so
                nothing reaches the storefront until you rewrite it and publish
                it from the product editor. The file&rsquo;s status and list
                cells are ignored. A row already in the catalogue from the same
                source is updated in place — its copy flagged for rewrite
                again, its status and product tier kept — never duplicated.
              </p>
              <ul className="mt-3 space-y-1 text-muted-foreground">
                <li>
                  <span className="font-semibold tabular-nums text-foreground">
                    {preview.scrapeExport.autoMappedCategories}
                  </span>{" "}
                  {preview.scrapeExport.autoMappedCategories === 1
                    ? "category was"
                    : "categories were"}{" "}
                  matched automatically from the source&rsquo;s own category
                  names.
                </li>
                <li>
                  <span className="font-semibold tabular-nums text-foreground">
                    {preview.scrapeExport.suggestedTiers}
                  </span>{" "}
                  product{" "}
                  {preview.scrapeExport.suggestedTiers === 1
                    ? "tier was"
                    : "tiers were"}{" "}
                  suggested from each listing&rsquo;s words and size. Check them
                  in the product editor before publishing.
                </li>
                {preview.productMerge &&
                  preview.productMerge.sheetTwinCount > 0 && (
                    <li>
                      <span className="font-semibold tabular-nums text-foreground">
                        {preview.productMerge.sheetTwinCount}
                      </span>{" "}
                      {preview.productMerge.sheetTwinCount === 1
                        ? "row is"
                        : "rows are"}{" "}
                      already in the catalogue from the catalog fill (your own
                      import lists) and will be left as{" "}
                      {preview.productMerge.sheetTwinCount === 1
                        ? "it is"
                        : "they are"}
                      ; their staged rows are marked imported.
                    </li>
                  )}
                {preview.scrapeExport.unmappedCategories > 0 && (
                  <li className="text-destructive">
                    <span className="font-semibold tabular-nums">
                      {preview.scrapeExport.unmappedCategories}
                    </span>{" "}
                    {preview.scrapeExport.unmappedCategories === 1
                      ? "row still needs a category and is"
                      : "rows still need a category and are"}{" "}
                    marked as errors below. To import them, add a{" "}
                    <code className="font-mono text-12">category_slug</code>{" "}
                    column to the file, fill it with one of your category slugs
                    for those rows, and upload the file again.
                  </li>
                )}
              </ul>
            </div>
          )}

          {preview.productMerge &&
            preview.productMerge.ownerEditedCount > 0 && (
              <div className="flex flex-wrap items-start gap-3 rounded-card border border-alert/40 bg-alert/5 p-4 text-sm">
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    Will overwrite {preview.productMerge.ownerEditedCount}{" "}
                    owner-edited{" "}
                    {preview.productMerge.ownerEditedCount === 1
                      ? "product"
                      : "products"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    These rows were edited in the studio since they were last
                    imported. By default this run only refreshes their stock
                    status — check the box to replace their content instead.
                  </p>
                  <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={overwriteOwnerEdited}
                      onCheckedChange={(checked) =>
                        setOverwriteOwnerEdited(checked === true)
                      }
                    />
                    Overwrite owner-edited products with this file
                  </label>
                </div>
              </div>
            )}

          <div
            tabIndex={0}
            role="region"
            aria-label="Rows to import"
            className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <table className="w-full text-sm">
              <thead>
                <StudioTableHead>
                  <th scope="col" className="w-14 px-4 py-3 font-medium">
                    #
                  </th>
                  <th scope="col" className="w-28 px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Item
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Notes
                  </th>
                </StudioTableHead>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <StudioRow key={row.index}>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {row.index}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="max-w-60 truncate px-4 py-3 font-medium text-foreground">
                      {rowIdentifier(row.data)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-xs",
                        row.status === "error"
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {row.messages.length > 0 ? row.messages.join("; ") : "—"}
                    </td>
                  </StudioRow>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(2)}
              disabled={importing}
            >
              <ArrowLeft /> Back
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={
                importing || preview.counts.create + preview.counts.update === 0
              }
            >
              {importing
                ? "Importing…"
                : `Import ${preview.counts.create + preview.counts.update} ${
                    preview.counts.create + preview.counts.update === 1
                      ? "row"
                      : "rows"
                  }`}
            </Button>
            {preview.counts.error > 0 && (
              <p className="text-xs text-muted-foreground">
                Rows marked as errors are skipped.
              </p>
            )}
          </div>
        </div>
      )}

      {step === 3 && report && (
        <div className="space-y-6">
          <div className="rounded-card border border-border bg-card p-6 shadow-e1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-sapphire-ink" />
              <h2 className="font-display text-xl text-foreground">
                Import finished
              </h2>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CountChip label="created" value={report.created} />
              <CountChip label="updated" value={report.updated} />
              {report.protectedCount > 0 && (
                <CountChip
                  label="owner-edited, left alone"
                  value={report.protectedCount}
                />
              )}
              <CountChip label="skipped" value={report.skipped} />
              <CountChip label="failed" value={report.errors.length} />
            </div>

            {report.errors.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-foreground">
                  Rows that did not import
                </p>
                <ul className="mt-2 space-y-1.5">
                  {report.errors.map((error) => (
                    <li
                      key={`${error.row}-${error.message}`}
                      className="text-xs text-destructive"
                    >
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Button size="sm" onClick={reset}>
            <RotateCcw /> Import another file
          </Button>
        </div>
      )}
    </div>
  );
}
