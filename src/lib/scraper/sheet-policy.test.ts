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
