# ADMIN_GUIDE.md — ResinRiva Studio Guide (for the owner)

Welcome! This is the plain-language manual for **your** admin panel — the Studio — at
**https://store.bhavyagondaliya.co.in/studio**. Everything you can do on the website, you do from here. No coding needed.

A few things to know up front:

- **The Studio login is yours (and your team's) only.** Customers never log in anywhere — they browse, customize, and order on WhatsApp.
- **The website never takes payments.** Every order arrives as a WhatsApp message; price and payment are agreed in chat.
- **Nothing is ever added to your catalog automatically.** Products only appear when you add them — by hand, by Bulk Import, or by approving items in the Product Scraper.

---

## 1. Logging in

Go to `/studio`, enter your admin email and password, and you land on the Dashboard. If you're ever locked out, another admin can reset your password from **Users**; if you're the only admin, use the **"Forgot password?"** link on the login page — it emails you a single-use reset link (valid one hour) when Resend is configured, and otherwise writes the link to the Vercel runtime logs so the developer can fetch it for you. (Re-running the seed with a new `ADMIN_PASSWORD` does **not** reset an existing account's password.)

## 2. The Dashboard

Your at-a-glance view: counts of products, this week's inquiries and blog posts, the six most recent WhatsApp orders with their status, and quick links to common jobs. The sidebar groups everything: **Catalog** (Products, Categories, Media Library), **Orders & Content** (WhatsApp Orders, Subscribers, Blog, Portfolio, Testimonials, FAQs, Pages), **Growth** (Sheet Import, Bulk Import, Product Scraper, SEO — SEO is admins-only), and **System** (Site Settings, Users, Activity).

## 3. Adding a product (step by step)

Go to **Products → New product**.

1. **Essentials** — Title (the web address is created from it once and never changes afterwards), category, a short tagline, and the full description.
2. **Pricing** — a price band in ₹ (minimum–maximum). Turn **Show price** off if you'd rather the page say "Enquire for price". Prices are indicative; the final quote always happens on WhatsApp.
3. **Details** — timeline (e.g. "7–10 days"), materials, dimensions, and **occasions** (tap the chips: Wedding, Anniversary, Diwali, Birthday, Corporate, Housewarming, Baby — these power the shop filters).
4. **Care notes** — optional; if you leave them empty, the site shows your default care notes from Site Settings.
5. **Gallery** — upload photos (the first one is the main image; the second appears on hover in the shop). Give each an alt text (a one-line description — good for Google and accessibility) and reorder with the arrow buttons.
6. **Video & 3D** — optionally paste a video URL and/or a 3D model URL (GLB/USDZ). The product page shows a video slot and an interactive 3D viewer when these are set.
7. **Customization form (the Custom Form Builder)** — this is the form customers fill before ordering. Add as many fields as you need: a **label** (e.g. Size, Colour theme, Custom text), a **type** — Dropdown (SELECT), Text (TEXT), Colour swatch (SWATCH), Size picker (SIZE), Number (NUMBER), or File (FILE) — the **options** list (for dropdowns/swatches/sizes), whether it's **required**, an optional help text, and the display order. Every answer flows automatically into the WhatsApp order message.
8. **SEO** — optional custom search title, description, and social-share image for this product. Leave blank to use sensible defaults.
9. **Save as Draft first.** Use the **draft preview link** on the product form (`/api/draft?redirect=/product/your-product`) to see the real page before anyone else can — it only works while you're signed in to the Studio, and adding `&disable=1` exits preview mode. You can even place a test order from the preview. When happy, switch the status to **Published** and save.

On the Products list you can search, filter by status or category, star items as **Featured** (they appear on the home page), and select rows for bulk Publish / Draft / Delete.

## 4. Managing categories

**Categories** holds your 16 collections (Varmala Preservation, Resin Trays, Wall Clocks…). You can add more, edit names/descriptions/images, and reorder with the arrows (this order is used across the site). Two safety rules: a category's web address is fixed once created, and a category **cannot be deleted while it still has products** — move or delete the products first.

## 5. Media Library

Every image, video, and 3D file you've ever uploaded lives here (stored on Vercel Blob), organized into folders: **products, blog, portfolio, site, refs** (customer reference photos), and **other**. You can upload straight into a folder, copy any file's URL, and bulk-delete. **Deleting a file is permanent** — there is no trash bin — so the usual delete warning applies (see §16).

Accepted files: images (JPG, PNG, WebP, AVIF) up to 8 MB; videos (MP4, WebM) and 3D models (GLB, USDZ) up to 16 MB. SVG is blocked for security (an SVG file can carry scripts).

## 6. WhatsApp Orders (Inquiries)

**Every "Place Order" click is saved here — even if WhatsApp never opened on the customer's phone.** Nothing gets lost.

Each order shows the customer's name and phone (tap to call), their email if given, every customization they picked, links to their reference photos, and the **exact WhatsApp message** that was generated — with a **Copy** button and an **Open in WhatsApp** button so you can restart the conversation from your side any time.

Work each order through the statuses: **New → Contacted → Quoted → Confirmed → Delivered** (plus **Closed** for dead or declined leads — kept for history, filtered out of the active pipeline). The list page shows a count card per status, filters by source (Product order / Custom order / Contact form) and status, plus bulk status changes. Custom-order inquiries also carry the customer's design idea, budget range, and timeline.

## 7. Writing a blog post

**Blog** has three tabs: Posts, Categories, and Tags. When writing a post you get a proper rich-text editor (headings, bold, lists, links, images), an excerpt, a cover image, an author name, a category and tags (type a new one and it's created automatically), SEO fields, and Draft/Published status. Publishing stamps the publish date automatically. Like products, drafts have a preview link (`/api/draft?redirect=/blog/your-post` — works only while signed in to the Studio).

## 8. Portfolio (case studies)

Show off finished commissions. Each portfolio item has a story, an optional **Before & After** photo pair (the public page turns them into a draggable slider when both are set), a photo gallery with lightbox, an optional video, and the "results" details — Type, Material, Size, Timeline — displayed in an elegant summary. Assign a category if you like, keep it as Draft while preparing, and preview before publishing.

## 9. Testimonials

Name, quote, city, a 1–5 star rating, an optional photo, and display order (arrows). Published testimonials rotate in the carousel on the home page.

## 10. FAQs

Simple question + answer + order. Six honest FAQs are pre-loaded (delivery, packaging, photo quality, care, price/payment, returns) — edit them freely. They appear on the FAQ page and as a teaser on Contact.

## 11. Pages (Privacy, Terms & more)

**Pages** holds the site's standalone pages, edited with the same rich editor as the blog. Your **Privacy Policy** and **Terms & Conditions** come pre-written (full, India-appropriate originals) — you can edit them but the Studio **refuses to delete them**, because the site legally needs both. New pages you create appear at `store.bhavyagondaliya.co.in/their-slug`.

## 12. Site Settings

The one form that controls site-wide details:

- **Brand** — name, tagline, logo, hero video.
- **Announcement bar** — the short strip at the very top of every page (max 300 characters). Clear it to hide the bar.
- **Contact** — phone, email, maps link, address.
- **WhatsApp number** — this becomes the `wa.me` link behind every order button. It must be **digits only, with the country code, no + or spaces** (e.g. `917096036250`) — the form shows a live preview of the resulting link and won't let you save an invalid one.
- **Socials** — put your real Instagram handle here before launch (the footer icon uses it).
- **Default SEO** and **default care notes** — the fallbacks used when a product or page has none of its own.

## 13. SEO defaults

The **SEO** section edits the site-wide fallback title and description used in Google results and link previews, and reminds you where per-item SEO lives: on each product, blog post, and page form. Details and strategy live in SEO_GUIDE.md.

## 14. Users & roles

(Admins only.) Add teammates as **Editor** (can manage content) or **Admin** (can also manage users). You can change roles and reset passwords here. Two guardrails protect you: you **cannot delete your own account**, and the Studio **refuses to demote or delete the last remaining admin** — promote someone else first.

## 15. Activity log

A read-only diary of who changed what and when (50 entries per page, filterable by type). Handy for "who deleted that product?" moments.

## 16. Deleting things safely

Whenever you delete, a warning states the exact count and type of what's about to go (e.g. "Delete 14 products?"). **For more than 10 items you must type `DELETE`** to arm the button. Deletions are **permanent** — database rows and their uploaded files are removed together, and there is no undo. Before any big cleanup, take a backup (BACKUP_GUIDE.md, two minutes).

## 17. Bulk Import (Google Sheets or CSV)

For adding lots of content at once — products, categories, blog posts, FAQs, testimonials, portfolio items, or pages.

1. **Studio → Bulk Import** → pick the content type → **download its template** (a CSV with every column and one example row — the exact columns are documented in CONTENT_GUIDE.md).
2. Fill it in — in Google Sheets or Excel. Products support up to six customization fields per row via the `custom1_…` to `custom6_…` columns.
3. **Feed it in**, either way:
   - **Google Sheet link** — the sheet must be shared as **"Anyone with the link can view"** (or published to the web), or the import will tell you it can't read it.
   - **Upload a .csv or .xlsx file** directly.
4. **Review the preview.** Every row is checked *before anything is written*: rows are marked **Create** (new), **Update** (a row with the same slug already exists — importing updates it), or **Error** with a plain-English reason (unknown category, bad price, duplicate slug in the file, etc.). Error rows are simply skipped; they never block the good rows.
5. **Run the import** and read the report: created / updated / skipped counts and any per-row errors.

Good to know: up to **500 rows** per file; image columns take public URLs which are downloaded and re-uploaded into your own media storage; blog/page content columns are written in Markdown and converted to the rich editor format automatically.

> ⚠️ **Scraper files are rejected here on purpose.** If a file contains scraper columns (`sourceKey`, `externalId`, `contentHash`…), Bulk Import refuses the whole file and points you to the Scraper review flow — that's the only door for competitor-sourced content, because it enforces the rewrite rule below.

## 18. Product Scraper (research tool)

The scraper collects competitor products **for research and cataloging speed** — never for copying. Three screens:

**Sources** — a registry of scrape-ready sites in four tiers: Tier 1 (Owner-priority sites), Tier 2 (Resin goods stores), Tier 3 (Supplies), Tier 4 (3D printing). Around 120 curated sources come pre-loaded (the registry is reconciled on every deploy, preserving your verify results and enable/disable choices). Each row shows the detected platform and has a **Verify** button that re-checks the site live. You can add a new source by URL — the Studio fingerprints it automatically; marketplaces (Amazon, Etsy, Flipkart, Meesho, IndiaMART…) are blocked by design, and sites the scraper can't read are saved as disabled with a note.

**Scrape** (the main Scraper page) — two ways to run:
- **Scrape a website:** paste a store URL, pick its tier, go.
- **Tier runs:** queue every enabled source in a tier (or "Scrape ALL" in tier order). Jobs run one at a time in small chunks, show live progress, and are **resumable** — if one stops, press Resume. Each finished job has its own **Export CSV** button.

**Review** — every scraped product lands here as a card (title, photos, price, source). Filter by source or status, open a card for full detail, then **Approve** or **Reject** (in bulk if you like). Approving opens the import dialog: pick which **ResinRiva category** they belong to, and keep **"Mirror images"** on (it copies the photos into your own storage so review works even if the source site changes).

> ⚠️ **The rewrite rule (copyright — not optional).** Approved items are imported as **Drafts** flagged **"needs rewrite"**. Scraped titles, text and photos are the competitor's copyrighted material — reference only. Before publishing you must **rewrite every description in your own words and replace all images with real ResinRiva photos**, then tick the confirm-rewrite box on the product form. Until then, publishing is blocked — even bulk publish skips flagged products and tells you how many it skipped.

**Exports & the Google Sheet** — any set of scraped rows can be exported as a **ScrapeDeck CSV** (26 fixed columns — see CONTENT_GUIDE.md). If the Google keys are configured, a **Sync to Sheet** button pushes rows into your designated Google Sheet, one tab per tier (Tier1_Owner, Tier2_ResinGoods, Tier3_Supplies, Tier4_3DPrint), updating changed rows and appending new ones. And remember: those CSVs are for the review workflow only — Bulk Import will reject them.

## 19. Subscribers

**Subscribers** collects the email addresses people leave in the newsletter signup forms on the website (footer and content pages). The list page shows every subscriber with their signup date, and an **Export CSV** button downloads the whole list so you can use it in any mailing tool. No emails are ever sent automatically — the site only collects; sending is up to you.

## 20. Sheet Import (your four-tier catalog sheet)

**Sheet Import** is the status page for the catalog that loads automatically from your master Google Sheet's four tier tabs — **Tier1_Owner** (all rows), **Tier2_ResinGoods** (top 1,000), **Tier3_Supplies** (top 2,500), **Tier4_3DPrint** (top 500). The import runs on every deploy; this page shows per-tier counts, the last run's created/updated/failed numbers, and how many imported product images still point at external sites. Imported images are copied ("mirrored") into your own storage in batches — a nightly job works through the backlog, and a button on this page runs the next batch on demand.

---

*Companion guides: CONTENT_GUIDE.md (image standards + every import template), WHATSAPP_ORDER_GUIDE.md (how ordering works under the hood), SEO_GUIDE.md, BACKUP_GUIDE.md.*
