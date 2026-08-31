/**
 * Part 0 data-integrity audit (guide §0.2, adapted to prisma/schema.prisma).
 * READ ONLY — raw SQL via pg (the repo's Prisma 7 client is TS-generated and
 * not importable from a plain .mjs script). External image hosts are
 * proxy-blocked in the sandbox, so URLs are validated by shape and
 * inventoried by host instead of HEAD-checked.
 * Run: DATABASE_URL=... node scripts/audit-data.mjs
 */
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const issues = [];
const hostInventory = new Map();

function noteHost(url) {
  try {
    const h = url.startsWith("/") ? "(local)" : new URL(url).hostname;
    hostInventory.set(h, (hostInventory.get(h) ?? 0) + 1);
  } catch {
    issues.push(`malformed image URL: ${String(url).slice(0, 100)}`);
  }
}

const { rows: products } = await client.query(`
  SELECT p.id, p.slug, p.title, p.description, p."priceMin", p."priceMax",
         p."showPrice", p."categoryId",
         (SELECT count(*)::int FROM "ProductImage" i WHERE i."productId" = p.id) AS imgs
  FROM "Product" p WHERE p.status = 'PUBLISHED'`);
for (const p of products) {
  if (!p.title?.trim()) issues.push(`product ${p.id}: missing title`);
  if (!p.description?.trim()) issues.push(`product ${p.slug}: missing description`);
  if (p.showPrice && p.priceMin == null) issues.push(`product ${p.slug}: showPrice but priceMin null`);
  if (p.priceMin != null && p.priceMin <= 0) issues.push(`product ${p.slug}: non-positive priceMin`);
  if (p.priceMin != null && p.priceMax != null && p.priceMax < p.priceMin)
    issues.push(`product ${p.slug}: priceMax < priceMin`);
  if (!p.imgs) issues.push(`product ${p.slug}: no images`);
  if (!p.categoryId) issues.push(`product ${p.slug}: no category`);
}

const { rows: dupes } = await client.query(
  `SELECT slug, count(*) FROM "Product" GROUP BY slug HAVING count(*) > 1`);
for (const d of dupes) issues.push(`duplicate product slug: ${d.slug} ×${d.count}`);

const { rows: imgs } = await client.query(`SELECT url FROM "ProductImage"`);
for (const i of imgs) noteHost(i.url);

const { rows: posts } = await client.query(
  `SELECT slug, "coverImage", "publishedAt" FROM "BlogPost" WHERE status = 'PUBLISHED'`);
for (const b of posts) {
  if (!b.coverImage) issues.push(`post ${b.slug}: missing cover image`);
  else noteHost(b.coverImage);
  if (!b.publishedAt) issues.push(`post ${b.slug}: missing publishedAt`);
}

const { rows: pf } = await client.query(`
  SELECT p.slug,
         (SELECT count(*)::int FROM "PortfolioImage" i WHERE i."portfolioId" = p.id) AS imgs
  FROM "Portfolio" p`);
for (const x of pf) if (!x.imgs) issues.push(`portfolio ${x.slug}: no images`);
const { rows: pfImgs } = await client.query(`SELECT url FROM "PortfolioImage"`);
for (const i of pfImgs) noteHost(i.url);

const counts = (await client.query(`
  SELECT (SELECT count(*) FROM "Faq") AS faqs,
         (SELECT count(*) FROM "Testimonial") AS testimonials`)).rows[0];

console.log(`products(PUBLISHED)=${products.length} posts(PUBLISHED)=${posts.length} portfolios=${pf.length} faqs=${counts.faqs} testimonials=${counts.testimonials}`);
console.log("\nimage hosts:", Object.fromEntries([...hostInventory.entries()].sort((a, b) => b[1] - a[1])));
console.log(issues.length ? `\n${issues.length} ISSUES:\n${issues.slice(0, 60).join("\n")}` : "\nNo data-integrity issues found");
await client.end();
