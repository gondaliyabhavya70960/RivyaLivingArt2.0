# Data quality audit — NOT AUDITED

No database was queried. No production or local data was inspected. Execution
and database access were both unavailable.

Per brief §44: the queries below **detect** gaps. Owner-authored content that is
simply missing is content debt (P3), not a code bug. **No content was invented.**

## Queries to run

Against a read replica or a local restore — not production write access.

```sql
-- Published products with no description
SELECT id, slug, title FROM "Product"
WHERE status = 'PUBLISHED' AND (description IS NULL OR trim(description) = '');

-- Published products with no image
SELECT p.id, p.slug, p.title FROM "Product" p
LEFT JOIN "ProductImage" i ON i."productId" = p.id
WHERE p.status = 'PUBLISHED' GROUP BY p.id HAVING count(i.id) = 0;

-- Published products still hot-linking external image hosts.
-- Mirrors externalCatalogImageWhere in src/lib/catalog-mirror.ts.
SELECT count(*) FROM "ProductImage" i
JOIN "Product" p ON p.id = i."productId"
WHERE p.status = 'PUBLISHED' AND i.url LIKE 'http%'
  AND i.url NOT LIKE '%.public.blob.vercel-storage.com%'
  AND i.url NOT LIKE '%res.cloudinary.com%'
  AND i.url NOT LIKE '%kanhakreation.com%';

-- Same for portfolio galleries and category covers
SELECT count(*) FROM "PortfolioImage" pi
JOIN "Portfolio" p ON p.id = pi."portfolioId"
WHERE p.status = 'PUBLISHED' AND pi.url LIKE 'http%'
  AND pi.url NOT LIKE '%.public.blob.vercel-storage.com%'
  AND pi.url NOT LIKE '%res.cloudinary.com%'
  AND pi.url NOT LIKE '%kanhakreation.com%';

SELECT count(*) FROM "Category" WHERE image LIKE 'http%'
  AND image NOT LIKE '%.public.blob.vercel-storage.com%'
  AND image NOT LIKE '%res.cloudinary.com%'
  AND image NOT LIKE '%kanhakreation.com%';

-- Duplicate slugs (should be impossible if uniquely constrained — verify)
SELECT slug, count(*) FROM "Product" GROUP BY slug HAVING count(*) > 1;

-- Category translation coverage
SELECT id, slug FROM "Category" WHERE translations IS NULL OR translations::text = '{}';

-- Confirmed-products invariant: CONFIRMED == confirmedAt IS NOT NULL
SELECT count(*) FROM "Product" WHERE "confirmedAt" IS NOT NULL;
```

## Classification rule

| Symptom | Class |
|---|---|
| Published product with no description | P3 content debt — owner fills it |
| Studio **refuses to save** a description | P1 code bug — fix it |
| Published product with no image | P2 — bad storefront impression |
| External image host on a published row | See `08-IMAGE-MIGRATION-AUDIT.md` |
| Duplicate slug | P1 code bug — routing is ambiguous |
| Missing category translation | P3 content debt |

## Known gaps — already documented, do not re-report

`CLAUDE.md` records these as schema-cannot-express, each rendering nothing
rather than inventing content:

- No portfolio row carries `beforeImageUrl`, so the before/after slider never
  renders on current data. Column exists; data does not.
- `Inquiry` has no priority column and no cure tracking.
- Commission "from" prices are omitted deliberately — the catalogue floor in
  those categories is a Rs 7 bezel finding, so a derived figure would be a real
  number attached to the wrong thing.
