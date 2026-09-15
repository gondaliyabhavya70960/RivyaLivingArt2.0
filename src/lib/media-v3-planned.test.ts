import { describe, expect, it } from "vitest";

import manifest from "../../docs/media-v3-manifest.json";
import {
  describePlanned,
  masterPaths,
  plannedEntries,
  promotePlanned,
  promotedStills,
  promotedVideos,
  tallyPlanned,
} from "../../scripts/lib/media-v3-planned.mjs";

/**
 * The `plannedSets` state machine, which is the only part of the Part 15
 * pipeline that can be tested here at all: everything else in
 * `scripts/media-v3-fetch.mjs` needs the Higgsfield CDN, and the CDN answers
 * 403 to every sandbox this repository is worked on in.
 *
 * What is worth locking down is the promote step — the hinge between "a prompt
 * somebody wrote" and "a row the fetch script builds". It ran silently past all
 * 28 planned entries for a release because nothing connected the two, so the
 * transform's shape, and the fact that promoting any real entry cannot land on
 * a master file that already exists, are asserted rather than assumed.
 */

const plan = (overrides: Record<string, unknown> = {}) => ({
  id: "bench-plank",
  set: "bench-concepts",
  placement: "Large resin art, first tile",
  ratio: "4:5",
  targetWidth: 1200,
  alt: "A bench plank blank with a sapphire resin river",
  prompt: "A long bench-seat plank … no faces.",
  candidates: [],
  keeper: null,
  status: "planned",
  ...overrides,
});

const HF_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_x/hf_20260904_010203_4267ec54-b244-4ba8-8f4f-e222b7fe8cac.png";

describe("describePlanned", () => {
  it("reads an ungenerated row as planned, and says what it needs", () => {
    const described = describePlanned(plan());
    expect(described.state).toBe("planned");
    expect(described.kind).toBe("still");
    expect(described.needs).toContain("generation run");
  });

  it("reads a generated-but-unpromoted row as generated, and names the promote", () => {
    // Where all 28 batch-D rows sit after 2026-09-04: rendered, URLs recorded,
    // still `status: "planned"` because the master cannot be built without the
    // CDN. Reading `status` alone told an owner holding 56 finished renders to
    // run a generation — the one wrong instruction here that costs money.
    const described = describePlanned(plan({ candidates: [{ variant: "a", url: HF_URL }] }));
    expect(described.state).toBe("generated");
    expect(described.needs).toContain("--promote bench-plank");
    expect(described.needs).not.toContain("generation run");
  });

  it("tallies generated rows apart from ungenerated ones", () => {
    const tally = tallyPlanned([
      plan(),
      plan({ id: "bench-side-top", candidates: [{ variant: "a", url: HF_URL }] }),
    ]);
    expect(tally.planned).toBe(1);
    expect(tally.generated).toBe(1);
  });

  it('calls a row that left "planned" with no candidates incomplete', () => {
    // Only reachable by hand-editing the manifest — `promotePlanned` refuses to
    // produce it — which is exactly why the state exists rather than a crash.
    expect(describePlanned(plan({ status: "ready" })).state).toBe("incomplete");
  });

  it("waits for the cull once candidates are recorded", () => {
    const entry = plan({
      status: "ready",
      candidates: [{ variant: "a", url: HF_URL }],
    });
    expect(describePlanned(entry).state).toBe("unculled");
    expect(describePlanned(entry).needs).toContain("--candidates");
  });

  it("is ready once a keeper is chosen", () => {
    const entry = plan({
      status: "ready",
      candidates: [{ variant: "a", url: HF_URL }],
      keeper: "a",
    });
    expect(describePlanned(entry).state).toBe("ready");
  });

  it("sends SET F rows to the video script, not this one", () => {
    const loop = plan({
      id: "video-macro-gild",
      set: "video",
      status: "ready",
      candidates: [{ variant: "a", url: HF_URL }],
    });
    expect(describePlanned(loop).kind).toBe("loop");
    expect(describePlanned(loop).needs).toContain("media-v3-video-fetch.mjs");
  });
});

describe("promotePlanned", () => {
  it("records pasted URLs as lettered candidates and fills in the master path", () => {
    const promoted = promotePlanned(plan(), [
      HF_URL,
      "https://example.com/second.png",
    ]);

    expect(promoted.status).toBe("ready");
    expect(promoted.master).toBe("public/media/v3/bench-plank.avif");
    expect(promoted.candidates.map((c) => c.variant)).toEqual(["a", "b"]);
    // Higgsfield names the file after the job, so the id comes back for free.
    expect(promoted.candidates[0].jobId).toBe(
      "4267ec54-b244-4ba8-8f4f-e222b7fe8cac",
    );
    expect(promoted.candidates[1]).not.toHaveProperty("jobId");
  });

  it("leaves the keeper unset — promotion is not a cull", () => {
    expect(promotePlanned(plan(), [HF_URL]).keeper).toBeNull();
  });

  it("carries the plan through unchanged", () => {
    const entry = plan();
    const promoted = promotePlanned(entry, [HF_URL]);
    for (const field of [
      "id",
      "set",
      "placement",
      "ratio",
      "targetWidth",
      "alt",
      "prompt",
    ] as const) {
      expect(promoted[field], field).toBe(entry[field]);
    }
  });

  it("gives a SET F row all three files the video pipeline writes", () => {
    const promoted = promotePlanned(
      plan({ id: "video-macro-gild", set: "video" }),
      [HF_URL],
    );
    expect(promoted.master).toBe("public/media/v3/video-macro-gild.mp4");
    expect(promoted.masterWebm).toBe("public/media/v3/video-macro-gild.webm");
    expect(promoted.poster).toBe(
      "public/media/v3/video-macro-gild-poster.avif",
    );
  });

  it("keeps candidates already recorded by hand", () => {
    const entry = plan({
      candidates: [{ variant: "a", jobId: "abc", url: HF_URL }],
    });
    expect(promotePlanned(entry).candidates).toHaveLength(1);
  });

  it("refuses a row with nothing to fetch, naming the command that fixes it", () => {
    expect(() => promotePlanned(plan())).toThrow(/--promote bench-plank <url>/);
  });

  it("refuses a URL that is not https", () => {
    // The fetch step downloads these; an http candidate is a downgrade nobody
    // asked for, and the preflight would reject it later anyway.
    expect(() => promotePlanned(plan(), ["http://example.com/a.png"])).toThrow(
      /not https/,
    );
  });

  it('refuses to re-promote a row that has already left "planned"', () => {
    expect(() => promotePlanned(plan({ status: "ready" }), [HF_URL])).toThrow(
      /already left/,
    );
  });
});

describe("the promoted partition the fetch scripts read", () => {
  const fixture = {
    plannedSets: {
      entries: [
        plan(),
        plan({ id: "art-wall-panel", set: "large-art", status: "ready" }),
        plan({ id: "video-macro-gild", set: "video", status: "ready" }),
      ],
    },
  };

  it("hands stills to media-v3-fetch and loops to media-v3-video-fetch", () => {
    expect(promotedStills(fixture).map((e) => e.id)).toEqual([
      "art-wall-panel",
    ]);
    expect(promotedVideos(fixture).map((e) => e.id)).toEqual([
      "video-macro-gild",
    ]);
  });

  it("holds back everything still planned", () => {
    expect(tallyPlanned(plannedEntries(fixture))).toEqual({
      planned: 1,
      generated: 0,
      incomplete: 2,
      unculled: 0,
      ready: 0,
    });
  });

  it("is total on a manifest with no plannedSets at all", () => {
    // `plannedSets` was added by batch D; an older copy of this file has none,
    // and neither fetch script may crash on one.
    expect(plannedEntries({})).toEqual([]);
    expect(promotedStills({})).toEqual([]);
  });
});

describe("the 55 entries in docs/media-v3-manifest.json", () => {
  const entries = plannedEntries(manifest);

  it("record the queue as it now stands: 40 built, 3 loops queued, 12 ungenerated", () => {
    // This assertion is a DATED RECORD of the queue, and it has now been
    // rewritten twice for the same good reason: the state legitimately moved.
    //
    // It first read `.planned === entries.length`, under a comment saying a
    // failure would be good news, and failed on 2026-09-04 when all 28 were
    // generated. It was rewritten to assert the generated/planned SPLIT and
    // `incomplete + unculled + ready === 0` — "none promoted" — because a
    // promote makes bundled-media.test.ts demand a master ON DISK, and the
    // master could not be built where the CDN answered 403.
    //
    // On 2026-09-15 that stopped being true. The CDN answers 200 again, the 40
    // generated stills were culled to one keeper each, promoted, and their
    // masters built and committed. So the honest state is no longer a split
    // between "generated" and "planned" — it is three groups, and the point of
    // asserting all three is that `--planned`'s instructions stay right:
    //
    //   ready      40  built, on disk, wired or wireable
    //   generated   3  SET F loops — candidates recorded, awaiting a promote
    //                  through media-v3-video-fetch.mjs, NOT this pipeline
    //   planned    12  never rendered; the Higgsfield workspace ran out of
    //                  credits, so these still want a generation run
    //
    // Telling an owner to generate something already rendered is still the one
    // wrong instruction here that costs money, which is why the 3 and the 12
    // are counted apart rather than summed.
    const tally = tallyPlanned(entries);
    expect(entries.length).toBe(55);
    expect(tally.ready).toBe(40);
    expect(tally.generated).toBe(3);
    expect(tally.planned).toBe(12);
    expect(tally.ready + tally.generated + tally.planned).toBe(entries.length);
    // Nothing may sit half-promoted: a row that left "planned" has a keeper and
    // a master path, or the build is broken in a way `--planned` would hide.
    expect(tally.incomplete + tally.unculled).toBe(0);

    for (const entry of entries) {
      const cands = (entry.candidates ?? []).length;
      if (entry.status === "planned") {
        // Still queued: no keeper yet. The 3 loops carry candidates; the 12
        // ungenerated rows must not pretend to.
        expect(entry.keeper, entry.id).toBeNull();
        expect(
          tallyPlanned([entry]).generated === 1 ? cands > 0 : cands === 0,
          entry.id,
        ).toBe(true);
      } else {
        // Promoted: a keeper naming a variant that actually exists, so the
        // master on disk is traceable to the frame somebody chose.
        expect(entry.keeper, entry.id).not.toBeNull();
        expect(cands, entry.id).toBeGreaterThan(0);
        expect(
          (entry.candidates ?? []).map((c) => c.variant),
          entry.id,
        ).toContain(entry.keeper);
      }
    }
  });

  it("can never be promoted onto a master file that already exists", () => {
    // Promotion derives the path from the id. A collision would mean one run
    // silently overwriting another asset's picture, and `--force` would make it
    // permanent.
    const taken = new Set([
      ...manifest.assets.map((a) => a.master),
      ...manifest.videos.flatMap((v) => [v.master, v.masterWebm, v.poster]),
    ]);
    for (const entry of entries) {
      for (const path of Object.values(masterPaths(entry))) {
        expect(taken.has(path), `${entry.id} → ${path}`).toBe(false);
      }
    }
  });
});
