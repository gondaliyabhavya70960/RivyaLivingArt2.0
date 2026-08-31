# A product's life

From a competitor's page to your final list — and who owns each field along
the way.

```
   the source site
         │  scrape
         ▼
   ScrapedProduct ─────────── immutable. what the site said.
         │  review + promote
         ▼
   Product (DRAFT) ────────── the catalog row. yours to edit.
         │  confirm
         ▼
   CONFIRMED_PRODUCTS ─────── the final list.
```

**There is no path from scrape to confirmed.** Every arrow after the first is a
person pressing something.

---

## The one invariant

```
CONFIRMED_PRODUCTS  ≡  { p : p.confirmedAt IS NOT NULL }
```

Not everything scraped. Not everything in the studio. Not everything sitting in
the sheet. Only rows somebody blessed.

Nothing in the codebase sets `confirmedAt` except the Confirm action. The
mandatory test — 500 scraped, 7 confirmed → 7 — exists because that number
going wrong is the whole feature going wrong.

---

## Who owns a field

Two writers can land on the same catalog row: the deploy-time sheet importer
and the scraper's promote path. Both may legitimately update a product.
**Neither may quietly undo your work.**

| Condition | What a writer may do |
| --- | --- |
| No catalog row | create it |
| **You have edited it** (`ownerTouched`) | **refresh availability. nothing else.** |
| Already rewritten | leave it alone |
| Untouched scraped row | refresh in full |

Owner edits are checked **first**, ahead of every other condition.

> **This was a real bug, fixed in Phase 9.** The sheet importer had always
> followed this rule. The scraper's promote path guarded on `needsRewrite`
> instead — a different question. A studio save sets `ownerTouched` but only
> clears `needsRewrite` when you tick "confirm rewrite", and most edits are not
> rewrites. So an edited-but-still-flagged product fell through to the update
> branch, which overwrites the copy **and deletes the gallery** before
> recreating it from source.

"Nothing else" includes **images** specifically. A rule that protected the
prose but not the pictures would still lose your work, in the least
recoverable way, since the replaced files may be gone.

Rows the merge protected are counted **separately from skipped** ones. "We left
your work alone" and "there was nothing to do" look identical in a total, and
only one is worth telling somebody about.

`src/lib/scraper/merge-policy.ts`

### The two flags

| Field | Says |
| --- | --- |
| `ownerTouched` | *that* a human edited this row |
| `studioEditedAt` | *when* — which is what conflict detection needs to decide whether the sheet or the studio is newer |

---

## Confirming

`/studio/products` → select → **Confirm**.

Refusals are **per row and named**. A batch where three products lack images
confirms the rest and reports those three by title and missing field, rather
than failing the whole press and leaving you to guess which.

They name **every** blocker at once. Somebody fixing one thing per round, told
only about the next failure each time, gives up.

What blocks a confirmation:

- no title
- no image
- no description
- copy still flagged `needsRewrite` — confirming that would put the
  competitor's own prose on your final list
- no price, **but only when the product shows one**. "Price on request" is a
  complete product, not an incomplete one.

These are deliberately the same checks the scraper records as validation
failures, so `/studio/scraper/quality` and this screen agree about what
"incomplete" means.

**Unconfirming** clears the blessing and nothing else — not the product, not
its history, not the activity record of the original confirmation. It is a
correction, not an erasure.

---

## Deletion

Deleting writes a `DeletedImport` tombstone, so the next sheet import does not
resurrect what you removed. It also clears the row from the website mirror and
the confirmed tab — but not from the tier tabs, which record what the source
said rather than what you stock.

Archive rather than delete when the history matters.
