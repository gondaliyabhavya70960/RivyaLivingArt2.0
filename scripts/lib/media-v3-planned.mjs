/**
 * The `plannedSets` half of docs/media-v3-manifest.json, as pure functions.
 *
 * Part 15's 25 committed masters were generated, culled and built before
 * `plannedSets` existed. The 28 entries batch D recorded under that key are the
 * NEXT photography batch — and for a while they were a plan with no path:
 * CLAUDE.md, the roadmap and the changelog all told the owner to "run
 * scripts/media-v3-fetch.mjs on an ordinary machine", but that script iterates
 * `assets`, so a run walked past all 28 without a word. Following the
 * documented instruction produced silence, which is the one failure mode a
 * pipeline script must not have.
 *
 * A planned entry differs from an asset in exactly two fields: it has no
 * `candidates` and no `master`. So promotion is a small pure transform, and the
 * moment it has run the row IS an asset row — the contact sheet, the cull and
 * the master + LQIP build all handle it unchanged.
 *
 * PROMOTION DOES NOT MOVE THE ROW. It flips `status` and fills the two missing
 * fields in place, leaving the entry in `plannedSets.entries`: that array is
 * counted as a set by `bundled-media.test.ts`, and `media-v3-preflight.mjs`
 * already reads `status !== "planned"` as "a real asset from here on". Moving
 * rows out would break the count guard whose whole job is noticing a lost entry.
 *
 * No I/O and no network here on purpose. The three scripts that need to agree
 * on what "promoted" means — media-v3-fetch, media-v3-video-fetch and
 * media-v3-preflight — read it from this one file, and it is testable without a
 * disk or a CDN, which matters because the CDN answers 403 to every sandbox
 * this repository is worked on in.
 *
 * @typedef {{ variant: string, url: string, jobId?: string }} Candidate
 * @typedef {{ id: string, set: string, placement?: string, ratio?: string,
 *             targetWidth?: number, alt?: string, prompt?: string,
 *             candidates?: Candidate[], keeper?: string | null,
 *             status?: string, master?: string, masterWebm?: string,
 *             poster?: string }} PlannedEntry
 * @typedef {PlannedEntry & { candidates: Candidate[], master: string }} PromotedEntry
 * @typedef {{ plannedSets?: { sets?: Record<string, string>,
 *             entries?: PlannedEntry[] } }} Manifest
 */

/** The status a row carries until a generation run has actually happened. */
export const PLANNED = "planned";

/** The status promotion writes. Anything but PLANNED means "a real asset now". */
export const PROMOTED = "ready";

/** Where every Part 15 master lands, mirroring the ids already in `assets`. */
export const MASTER_DIR = "public/media/v3";

/**
 * SET F is the manifest's only motion set and the rows carry no per-entry kind
 * field, so the set name is the discriminator. It decides which script builds
 * the row — stills here, loops in `media-v3-video-fetch.mjs` — and getting it
 * wrong would run an MP4 through sharp.
 */
const VIDEO_SETS = new Set(["video"]);

/** Variant letters, assigned in the order the owner pastes the result URLs. */
const VARIANTS = "abcdefghijkl";

/** @param {Manifest} manifest */
export function plannedEntries(manifest) {
  return manifest.plannedSets?.entries ?? [];
}

/** @param {PlannedEntry} entry */
export function isPlanned(entry) {
  return entry.status === PLANNED;
}

/** @param {PlannedEntry} entry */
export function entryKind(entry) {
  return VIDEO_SETS.has(entry.set) ? "loop" : "still";
}

/**
 * Where a promoted row's files go. Derived from the id rather than stored in
 * the plan, so a planned entry can never name a path before there is a file at
 * it — `bundled-media.test.ts` asserts exactly that.
 *
 * @param {PlannedEntry} entry
 */
export function masterPaths(entry) {
  if (entryKind(entry) === "loop") {
    return {
      master: `${MASTER_DIR}/${entry.id}.mp4`,
      masterWebm: `${MASTER_DIR}/${entry.id}.webm`,
      poster: `${MASTER_DIR}/${entry.id}-poster.avif`,
    };
  }
  return { master: `${MASTER_DIR}/${entry.id}.avif` };
}

/**
 * One row's place in the queue, and the sentence a script prints for it.
 *
 * Five states, and every one of them is a thing the owner can act on:
 * `planned` needs a generation, `generated` a promote, `incomplete` a promote
 * that carried URLs, `unculled` a keeper, `ready` nothing at all.
 *
 * `generated` is the state a row sits in once it has been rendered but the
 * master has not been built — which is where all 28 batch-D rows are, because
 * generating them needs only the API and building them needs the CDN the agent
 * proxy refuses. Before it existed this function read `status` alone and told
 * an owner holding 56 finished renders that every row "needs a generation run",
 * which is the one instruction that costs money to follow twice.
 *
 * @param {PlannedEntry} entry
 */
export function describePlanned(entry) {
  const kind = entryKind(entry);
  const candidates = entry.candidates ?? [];
  const base = { id: entry.id, set: entry.set, kind };

  if (isPlanned(entry)) {
    return candidates.length > 0
      ? {
          ...base,
          state: "generated",
          needs:
            `a promote — ${candidates.length} candidate URL(s) already recorded: ` +
            `media-v3-fetch.mjs --promote ${entry.id}`,
        }
      : { ...base, state: PLANNED, needs: "a generation run — no candidate URLs recorded" };
  }
  if (candidates.length === 0) {
    return {
      ...base,
      state: "incomplete",
      needs: 'candidate URLs — it left "planned" with none recorded',
    };
  }
  if (!entry.keeper) {
    return {
      ...base,
      state: "unculled",
      needs:
        kind === "loop"
          ? 'a cull — media-v3-video-fetch.mjs --candidates, then set "keeper"'
          : 'a cull — media-v3-fetch.mjs --candidates, then set "keeper"',
    };
  }
  return {
    ...base,
    state: "ready",
    needs:
      kind === "loop"
        ? "nothing — media-v3-video-fetch.mjs builds it"
        : "nothing — the next media-v3-fetch.mjs run builds it",
  };
}

/**
 * How many rows sit in each state. The one number a run has to report.
 *
 * @param {PlannedEntry[]} entries
 */
export function tallyPlanned(entries) {
  const tally = { planned: 0, generated: 0, incomplete: 0, unculled: 0, ready: 0 };
  for (const entry of entries) tally[describePlanned(entry).state] += 1;
  return tally;
}

/**
 * The promoted still rows, shaped exactly like `manifest.assets` entries so the
 * fetch script can concatenate the two lists and change nothing else.
 *
 * @param {Manifest} manifest
 */
export function promotedStills(manifest) {
  return plannedEntries(manifest).filter(
    (entry) => !isPlanned(entry) && entryKind(entry) === "still",
  );
}

/**
 * The promoted loops, shaped like `manifest.videos` entries.
 *
 * @param {Manifest} manifest
 */
export function promotedVideos(manifest) {
  return plannedEntries(manifest).filter(
    (entry) => !isPlanned(entry) && entryKind(entry) === "loop",
  );
}

/**
 * Higgsfield names every result file after its job id, so the id the manifest
 * records by hand for the 2026-08 sets can be read back out of a pasted URL —
 * one less thing for the owner to copy across, and the contact sheet captions
 * with it. Absent when the URL comes from anywhere else, which is fine: nothing
 * downstream requires it.
 *
 * @param {string} url
 */
export function jobIdFromUrl(url) {
  const match = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(url);
  return match?.[0];
}

/**
 * A planned row, promoted: candidates recorded and the master path filled in.
 *
 * Pure — it returns the new row and writes nothing. The caller owns the
 * manifest file, because a script that mutates JSON on disk inside a transform
 * is a script nobody can test offline.
 *
 * Throws with the exact next command rather than a validation code: this is the
 * one step an owner runs by hand, months after reading the plan.
 *
 * @param {PlannedEntry} entry a row whose `status` is still "planned"
 * @param {string[]} urls candidate result URLs, in variant order
 * @returns {PromotedEntry}
 */
export function promotePlanned(entry, urls = []) {
  if (!isPlanned(entry)) {
    throw new Error(
      `${entry.id} has already left "planned" (status: ${entry.status}). ` +
        "Edit the entry in docs/media-v3-manifest.json directly.",
    );
  }
  if (urls.length > VARIANTS.length) {
    throw new Error(`${entry.id}: ${urls.length} candidates is more than the ${VARIANTS.length} variant letters.`);
  }
  for (const url of urls) {
    if (!/^https:\/\//.test(url)) {
      throw new Error(`${entry.id}: candidate URL is not https — ${url}`);
    }
  }

  const candidates = urls.length
    ? urls.map((url, index) => {
        const jobId = jobIdFromUrl(url);
        return jobId
          ? { variant: VARIANTS[index], jobId, url }
          : { variant: VARIANTS[index], url };
      })
    : (entry.candidates ?? []);

  if (candidates.length === 0) {
    throw new Error(
      `${entry.id} has no candidates. Generate it from the prompt in ` +
        "docs/media-v3-manifest.json, then pass the result URLs:\n" +
        `  node scripts/media-v3-fetch.mjs --promote ${entry.id} <url> [<url>]`,
    );
  }

  // Field order mirrors an `assets` row so the manifest diff reads as one.
  return {
    id: entry.id,
    set: entry.set,
    placement: entry.placement,
    ratio: entry.ratio,
    targetWidth: entry.targetWidth,
    ...masterPaths(entry),
    alt: entry.alt,
    prompt: entry.prompt,
    candidates,
    keeper: entry.keeper ?? null,
    status: PROMOTED,
  };
}
