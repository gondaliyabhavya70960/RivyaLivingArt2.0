# Media alt-backfill batches (Q2)

Reviewed input for `npm run alt:backfill`. Each file is a JSON array of
`{ "match", "alt" }` entries. Dry-run is the default; `--apply` writes.
The matcher never overwrites an existing alt and never guesses an ambiguous
basename.

| Batch | Entries | What it covers | Grounding |
| --- | --- | --- | --- |
| `batch-01-bundled.json` | 124 | 24 v3 site masters, 55 journal covers, 45 catalog concept PNG renders | v3 manifest alts verbatim; article titles; asset-index titles + "studio concept render" |
| `batch-02-bundled.json` | 117 | 41 remaining v3 variants, 5 category covers, 3 v6 collection tiles, 5 mock studies, `media/hands-polish.webp`, 17 redesign brand stills, 45 catalog concept WebP renders | v3 `plannedSets` alts verbatim + process-pour posterAlt; category/mock/redesign described from the files; catalog WebP reuses batch-01 titles |

```bash
npm run alt:backfill -- docs/alt-backfill/batch-01-bundled.json
npm run alt:backfill -- docs/alt-backfill/batch-01-bundled.json -- --apply
npm run alt:backfill -- docs/alt-backfill/batch-02-bundled.json
npm run alt:backfill -- docs/alt-backfill/batch-02-bundled.json -- --apply
```

## Still not in a batch

- **Owner-uploaded Blob library (~2,700 files).** Those rows live in the
  production media table, not in git. They need folder-by-folder review of
  the actual pictures. Export a pathname list from Studio → Media (or a
  `Media` query) and feed it as batch-03+.
- **`public/sequences/pour-cure/*` (121 frames).** Intentionally not slotted
  as editorial media (`site-images.ts`). They stay bundled animation frames.
- **Video / 3D / documents.** The writer skips non-IMAGE rows.
