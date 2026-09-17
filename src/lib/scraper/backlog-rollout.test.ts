import { describe, expect, it } from "vitest";

import {
  planManualResearch,
  planReferenceRollout,
  ROLLOUT_AUTHORITY,
  ROLLOUT_REVIEWER,
  type RolloutCurrent,
  type RolloutEntry,
} from "./backlog-rollout";
import { REFERENCE_MANUAL, REFERENCE_ROLLOUT, SEED_SOURCES } from "./seed-data";

const NOW = new Date("2026-09-16T20:00:00Z");

const entry: RolloutEntry = {
  key: "probe-source",
  platform: "WOOCOMMERCE",
  maxProducts: 500,
  evidence: "Publishes the WooCommerce Store API; robots.txt allows /.",
};

const untouched: RolloutCurrent = {
  enabled: false,
  platform: "UNKNOWN",
  verifiedAt: null,
  collectionMode: "HTTP",
  policyReviewStatus: "PENDING",
  maxProducts: null,
  hasAnyJob: false,
  hasReviewActivity: false,
};

describe("planReferenceRollout", () => {
  it("rolls out a registered, never-reviewed, never-collected source: review, enable, cap, first job", () => {
    const decision = planReferenceRollout(entry, untouched, NOW);
    expect("update" in decision).toBe(true);
    if (!("update" in decision)) return;
    expect(decision.queueJob).toBe(true);
    expect(decision.update).toMatchObject({
      enabled: true,
      collectionMode: "HTTP",
      policyReviewStatus: "APPROVED",
      policyReviewedAt: NOW,
      policyReviewedBy: ROLLOUT_REVIEWER,
      platform: "WOOCOMMERCE",
      verifiedAt: NOW,
      maxProducts: 500,
      pausedAt: null,
      consecutiveFailures: 0,
    });
    // The record carries the authority AND the evidence — who said so, and
    // what the site itself publishes.
    expect(decision.update.policyReviewNote).toContain(ROLLOUT_AUTHORITY);
    expect(decision.update.policyReviewNote).toContain(entry.evidence);
  });

  it("never touches a source a person has reviewed — whatever they decided", () => {
    for (const policyReviewStatus of [
      "PENDING",
      "APPROVED",
      "BLOCKED",
    ] as const) {
      expect(
        planReferenceRollout(
          entry,
          { ...untouched, policyReviewStatus, hasReviewActivity: true },
          NOW,
        ),
      ).toEqual({
        skip: "a person has recorded a policy review — their decision stands",
      });
    }
  });

  it("never re-decides a source that is not PENDING, even with no activity on record", () => {
    expect(
      planReferenceRollout(
        entry,
        { ...untouched, policyReviewStatus: "BLOCKED" },
        NOW,
      ),
    ).toEqual({ skip: "already blocked" });
    expect(
      planReferenceRollout(
        entry,
        { ...untouched, policyReviewStatus: "APPROVED" },
        NOW,
      ),
    ).toEqual({ skip: "already approved" });
  });

  it("is spent once a source has had any job — the Studio owns the schedule from there", () => {
    expect(
      planReferenceRollout(entry, { ...untouched, hasAnyJob: true }, NOW),
    ).toEqual({
      skip: "already collected once — the Studio owns the schedule now",
    });
  });

  it("keeps a platform verified live and a cap already set, like the registry seed", () => {
    const verifiedAt = new Date("2026-09-15T10:00:00Z");
    const decision = planReferenceRollout(
      entry,
      { ...untouched, platform: "SHOPIFY", verifiedAt, maxProducts: 120 },
      NOW,
    );
    if (!("update" in decision)) throw new Error("expected a rollout");
    expect(decision.update.platform).toBe("SHOPIFY");
    expect(decision.update.verifiedAt).toBe(verifiedAt);
    expect(decision.update.maxProducts).toBe(120);
  });
});

describe("planManualResearch", () => {
  const manual = {
    key: "gated",
    reason: "Cloudflare challenge on every page.",
  };

  it("files a PENDING, automatable-looking source as manual research with the reason", () => {
    const decision = planManualResearch(manual, {
      collectionMode: "HTTP",
      policyReviewStatus: "PENDING",
      hasReviewActivity: false,
    });
    expect(decision).toMatchObject({
      update: { collectionMode: "MANUAL_RESEARCH" },
    });
    if (!("update" in decision)) return;
    expect(decision.update.policyReviewNote).toContain(manual.reason);
  });

  it("leaves a reviewed, decided or already-manual source alone", () => {
    expect(
      planManualResearch(manual, {
        collectionMode: "HTTP",
        policyReviewStatus: "PENDING",
        hasReviewActivity: true,
      }),
    ).toHaveProperty("skip");
    expect(
      planManualResearch(manual, {
        collectionMode: "MANUAL_RESEARCH",
        policyReviewStatus: "PENDING",
        hasReviewActivity: false,
      }),
    ).toEqual({ skip: "already manual research" });
    expect(
      planManualResearch(manual, {
        collectionMode: "HTTP",
        policyReviewStatus: "APPROVED",
        hasReviewActivity: false,
      }),
    ).toEqual({ skip: "already approved" });
  });
});

describe("the rollout lists", () => {
  const keys = new Set(SEED_SOURCES.map((s) => s.key));

  it("name only registered sources, each in exactly one list", () => {
    const all = [
      ...REFERENCE_ROLLOUT.map((e) => e.key),
      ...REFERENCE_MANUAL.map((e) => e.key),
    ];
    for (const key of all) expect(keys.has(key), key).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });

  it("roll out only sources with a verified adapter, a cap and their evidence on record", () => {
    for (const e of REFERENCE_ROLLOUT) {
      expect(e.platform, e.key).not.toBe("UNKNOWN");
      expect(e.maxProducts, e.key).toBeGreaterThan(0);
      expect(e.evidence.length, e.key).toBeGreaterThan(40);
    }
    for (const e of REFERENCE_MANUAL)
      expect(e.reason.length, e.key).toBeGreaterThan(20);
  });
});
