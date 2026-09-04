import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  SHEET_POLICY_LABEL,
  shouldPushOnComplete,
} from "@/lib/scraper/sheet-policy";

describe("shouldPushOnComplete", () => {
  it("pushes a completed job when the source is set to ON_COMPLETE", () => {
    expect(shouldPushOnComplete("DONE", "ON_COMPLETE")).toBe(true);
  });

  it("does not push under MANUAL — the operator says when", () => {
    expect(shouldPushOnComplete("DONE", "MANUAL")).toBe(false);
  });

  it("does not push under OFF", () => {
    expect(shouldPushOnComplete("DONE", "OFF")).toBe(false);
  });

  it("never pushes a FAILED job, even under ON_COMPLETE", () => {
    // A failed job keeps its counts up to the failure point, so its rows are
    // partial by definition. Publishing a partial catalog into the owner's
    // shared sheet unasked is the wrong default.
    expect(shouldPushOnComplete("FAILED", "ON_COMPLETE")).toBe(false);
  });

  it("never pushes a job still in flight", () => {
    expect(shouldPushOnComplete("RUNNING", "ON_COMPLETE")).toBe(false);
    expect(shouldPushOnComplete("QUEUED", "ON_COMPLETE")).toBe(false);
  });

  it("does not push when the source is gone", () => {
    // ScrapeJob.sourceId is onDelete: SetNull, so a job can finish with no
    // source row and therefore no policy to read.
    expect(shouldPushOnComplete("DONE", null)).toBe(false);
    expect(shouldPushOnComplete("DONE", undefined)).toBe(false);
  });

  it("labels every policy — a select with a blank option is a bug", () => {
    expect(Object.keys(SHEET_POLICY_LABEL).sort()).toEqual([
      "MANUAL",
      "OFF",
      "ON_COMPLETE",
    ]);
  });
});

/**
 * D23's regression guard. `shouldPushOnComplete` above is only the policy's
 * OPINION; what makes it authoritative is that nothing writes to the sheet
 * behind its back. A second, un-gated `syncSourceToSheet` used to run after
 * every finished job that staged anything — a FAILED one included — so a
 * MANUAL source was pushed to the owner's shared document on every scrape
 * while every doc and label said it would not be.
 *
 * The truth table cannot catch that: it passed the whole time the bug was
 * live. Only the count of writers can, so it is asserted on the source.
 */
describe("the one-writer invariant (D23)", () => {
  const source = readFileSync("src/actions/scraper-jobs.ts", "utf8");

  it("routes every sheet write in the scrape action through the policy", () => {
    // One call, and the line above it is the policy check.
    const pushCalls = source.match(/\bpushJobToSheet\(/g) ?? [];
    expect(pushCalls).toHaveLength(1);
    expect(source).toMatch(
      /if \(shouldPushOnComplete\(status, source\?\.sheetSyncPolicy\)\) \{\s*const outcome = await pushJobToSheet\(job\.id, await readSheetSettings\(\)\);/,
    );
  });

  it("never reaches the sheet transport directly", () => {
    // `syncRowsToSheet` is the raw write; `sheet-push.ts` is the only module
    // allowed to call it, because that is where the per-row state lives.
    expect(source).not.toMatch(/\bsyncRowsToSheet\b/);
    expect(source).not.toMatch(/\bsyncSourceToSheet\b/);
  });

  it("leaves the job-level synced flag to the gated push", () => {
    // The removed path was the second writer of ScrapeJob.sheetSynced.
    // sheet-push.ts sets it inside the same transaction as the row state, so
    // the studio's "synced" indicator still lights — from one place.
    expect(source).not.toMatch(/sheetSynced/);
    expect(readFileSync("src/lib/scraper/sheet-push.ts", "utf8")).toMatch(
      /data: \{ sheetSynced: true \}/,
    );
  });
});
