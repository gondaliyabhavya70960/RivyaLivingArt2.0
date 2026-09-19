# Drive `hf_` library — index and grading protocol

_2026-09-19. The historical `images/` and `videos/` folders, enumerated via
the Drive API and organised for the first time. No file was modified, moved
or deleted — this is an index, not a reorganisation (rule 51)._

## What the library actually is

| Folder | Files | Size | Shape |
| --- | ---: | --- | --- |
| `images/` | ~101 enumerated¹ | 5–50 MB each, most 17–31 MB | AI-generated PNG masters, 2026-08-09 → 2026-09-05 |
| `videos/` | 26 (complete listing) | 0.6–5.8 MB each | AI-generated MP4s, 2026-08-12 → 2026-09-04 |

¹ One hundred files on the first API page plus one more found later. The
connector's paged listing repeats earlier pages instead of converging, so
the folder may hold additional files — a complete enumeration is a five-
minute job in the Drive UI (select all → count) or a one-off script, and
this index should be extended the day it is done.

## Generation sessions (by filename timestamp)

Filenames carry their generation moment (`hf_YYYYMMDD_HHMMSS_<uuid>`), so
the library clusters into working sessions:

| Session | Images | Videos | Likely context |
| --- | ---: | ---: | --- |
| 2026-08-09 | 1 | — | First experiments |
| 2026-08-12 | — | 4 | First video batch |
| 2026-08-23 | ≈8 | — | Early concept run |
| 2026-08-26 | — | 2 | Video follow-up |
| 2026-08-28 | ≈31 | 10 | **The big image+video session** |
| 2026-08-29 | ≈4 | — | Same-week continuation |
| 2026-08-31 | ≈1 | — | Odd one out |
| 2026-09-04 | ≈48 | 10 | **The largest session** — the bulk of the library |
| 2026-09-05 | ≈7 | — | Final batch before the `Rivya_All_Generated_Images` set was curated (2026-09-13) |

Counts for images are approximate (see ¹); video counts are exact. The two
big sessions (08-28, 09-04) hold roughly three-quarters of the library —
grading can start there and cover most of the value in one sitting.

## The grading protocol

Per file, three columns and one decision — nothing more, or it never gets
done:

| Column | Values | What it means |
| --- | --- | --- |
| `subject` | e.g. `ocean pour macro` / `varmala frame` / `river table` / `geode coasters` | What the file actually shows, in three to five words |
| `quality` | `A` portfolio-grade · `B` usable with crop/edit · `C` archive | Honest grade at full size, not thumbnail |
| `action` | `KEEP` (grade, name, integrate) · `REVIEW` (needs a second look) · `ARCHIVE` (leave in place, stop considering) | The owner's call — never automatic |

Rules for the pass:

1. Open at 100%, never grade from the grid — these are 17–31 MB masters;
   thumbnails flatter them.
2. **Rename on KEEP** to the `subject-###` convention used by
   `Rivya_All_Generated_Images` (e.g. `product-hero-036-4x5.png`) and log it
   in that folder's `asset-index.csv` — that is the library's existing
   naming contract, and it keeps every future "is this already made?"
   question answerable.
3. `ARCHIVE` means leave exactly where it is and stop re-opening it. The
   retention rule stands: nothing is deleted automatically, ever — the
   decision being made here is *attention*, not deletion.
4. Any KEEP candidate for a live page gets checked against
   `GOOGLE-DRIVE-ASSET-MAP.md` first — if an approved `assets/` or `final/`
   file already covers the job, the approved file wins and the candidate
   stays archived.

## Starter rows (template for the full pass)

```csv
folder,filename,session,subject,quality,action
images,hf_20260904_110116_19d33f63-e469-4f15-bd96-bdd1fed17ac4.png,2026-09-04,,,REVIEW
images,hf_20260828_022514_fc382dea-095e-4d56-bb84-9377cf45c629.png,2026-08-28,,,REVIEW
videos,hf_20260904_122203_c9d86230-7be9-42e9-9a93-293e7cb0a8cb.mp4,2026-09-04,,,REVIEW
```

Everything starts as `REVIEW`; the pass turns each row into a decision. A
full per-file CSV of the ~101 enumerated files (name, size, session) can be
generated on request — it is a mechanical pass over the API listing, not
judgement work.

## Why this index was worth making

Until today nobody could answer "what do we already have?" for the largest
pool of brand visuals the project owns. The answer is now: ~127 files, two
dominant sessions, an average of ~24 MB per image, and a grading pass of
roughly one focused afternoon split across the two big sessions. The
alternative — generating new assets from habit — would have spent money
recreating what may already exist here (rule 37).

## Related

- `docs/content/GOOGLE-DRIVE-ASSET-MAP.md` — the curated library, asset by asset
- `docs/content/OWNER-REVIEW.md` §5 — the decision this index supports
