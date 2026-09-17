# ADMIN_GUIDE.md — Rivya Living Art Studio Guide (for the owner)

Welcome! This is the plain-language manual for **your** admin panel — the Studio — at
**https://www.rivyalivingart.com/studio**. Everything you can do on the website, you do from here. No coding needed.

A few things to know up front:

- **The Studio login is yours (and your team's) only.** Customers never log in anywhere — they browse, customize, and order on WhatsApp.
- **The website never takes payments.** Every order arrives as a WhatsApp message; price and payment are agreed in chat.
- **Nothing is ever added to your catalog automatically.** Products only appear when you add them — by hand, by Bulk Import, or by approving items in the Product Scraper.

---

## 1. Logging in

Go to `/studio`, enter your admin email and password, and you land on the Dashboard. If you're ever locked out, another admin can reset your password from **Users**; if you're the only admin, use the **"Forgot password?"** link on the login page — it emails you a single-use reset link (valid one hour) when Resend is configured, and otherwise writes the link to the Vercel runtime logs so the developer can fetch it for you. (Re-running the seed with a new `ADMIN_PASSWORD` does **not** reset an existing account's password.)

## 2. The Dashboard

Your at-a-glance view: counts of products, this week's inquiries and blog posts, the six most recent WhatsApp orders with their status, and quick links to common jobs. The sidebar groups everything: **Catalog** (Products, Categories, Media Library), **Orders & Content** (WhatsApp Orders, Subscribers, Blog, Portfolio, Testimonials, FAQs, Pages), **Growth** (Catalog fill, Bulk Import, Product Scraper, SEO — SEO is admins-only), and **System** (Site Settings, Users, Activity).

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

The library is a proper asset manager now: drag files onto the page to upload, page through it sixty at a time, sort and filter by type, orientation, date, size, favourites or demo rows, switch between grid and list, and open any file in the **details drawer** — its size and dimensions, every place on the site that uses it (with links), tags, a caption, a favourite star, the alt text, **Replace file**, **Move to folder**, and for a video a **Capture poster** button that takes a still from the film. Select several files to set their alt text in one go. Every upload is checked against its own bytes, not just the name it claims — a file that says it is a JPEG but is not is refused.

## 6. WhatsApp Orders (Inquiries)

**Every "Place Order" click is saved here — even if WhatsApp never opened on the customer's phone.** Nothing gets lost.

Each order shows the customer's name and phone (tap to call), their email if given, every customization they picked, links to their reference photos, and the **exact WhatsApp message** that was generated — with a **Copy** button and an **Open in WhatsApp** button so you can restart the conversation from your side any time.

Work each order through the statuses: **New → Contacted → Quoted → Confirmed → Delivered** (plus **Closed** for dead or declined leads — kept for history, filtered out of the active pipeline). The list page shows a count card per status, filters by source (Product order / Custom order / Contact form) and status, plus bulk status changes. Custom-order inquiries also carry the customer's design idea, budget range, and timeline.

## 7. Writing a blog post

**Blog** has three tabs: Posts, Categories, and Tags. When writing a post you get a proper rich-text editor (headings, bold, lists, links, images), an excerpt, a cover image, an author name, a category and tags (type a new one and it's created automatically), SEO fields, and Draft/Published status. Publishing stamps the publish date automatically. Like products, drafts have a preview link (`/api/draft?redirect=/blog/your-post` — works only while signed in to the Studio).

## 8. Portfolio (case studies)

Show off finished commissions. Each portfolio item has a story, an optional **Before & After** photo pair (the public page turns them into a draggable slider when both are set), a photo gallery with lightbox, an optional video, and the "results" details — Type, Material, Size, Timeline — displayed in an elegant summary. Assign a category if you like, keep it as Draft while preparing, and preview before publishing.

## 9. Testimonials

Each testimonial is its own page now (Quote · Attribution · Links · Media · Review). Beyond the name, quote, city and rating you can record the customer's designation, the piece or the project it belongs to (the product page then shows it), a photograph of the piece in their home, a short film with its poster, the date and the language it was given in, private notes, and — the part that matters — **permission**. A testimonial cannot be **Published** until Permission is **Granted** on the Review tab; the studio refuses the save and says so. Statuses run Draft → Pending review → Verified → Published, plus Archived; **Featured** picks the ones the big quote band shows. The list can be searched, sorted and filtered by status, and rows imported from a file arrive as Draft.

Demo testimonials (from the Content Lab, see §21) are always marked "demo" on the site and never count as real reviews in Google's data.

## 10. FAQs

Simple question + answer + order. Six honest FAQs are pre-loaded (delivery, packaging, photo quality, care, price/payment, returns) — edit them freely. They appear on the FAQ page and as a teaser on Contact.

## 11. Pages (Privacy, Terms & more)

**Pages** holds the site's standalone pages, edited with the same rich editor as the blog. Your **Privacy Policy** and **Terms & Conditions** come pre-written (full, India-appropriate originals) — you can edit them but the Studio **refuses to delete them**, because the site legally needs both. New pages you create appear at `www.rivyalivingart.com/their-slug`.

## 12. Site Settings

The one form that controls site-wide details:

- **Brand** — name, tagline, logo, hero video.
- **Announcement bar** — the short strip at the very top of every page (max 300 characters). Clear it to hide the bar.
- **Contact** — phone, email, maps link, address.
- **WhatsApp number** — this becomes the `wa.me` link behind every order button. It must be **digits only, with the country code, no + or spaces** (e.g. `917096036250`) — the form shows a live preview of the resulting link and won't let you save an invalid one.
- **Socials** — put your real Instagram handle here before launch (the footer icon uses it).
- **Default SEO** and **default care notes** — the fallbacks used when a product or page has none of its own.
- **Demo content** — the switch that lets the Content Lab's demo pieces show on the live site, marked "DEMO CONTENT" (see §21). Off by default; leave it off unless you are showing the site to someone.

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
4. **Review the preview.** Every row is checked _before anything is written_: rows are marked **Create** (new), **Update** (a row with the same slug already exists — importing updates it), or **Error** with a plain-English reason (unknown category, bad price, duplicate slug in the file, etc.). Error rows are simply skipped; they never block the good rows. For products the preview also counts the rows you have **edited in the studio** since they were last imported: those are left alone (only their stock status refreshes) unless you tick **Overwrite owner-edited products** — the same rule the scraper and the catalog fill follow, so an import can never silently undo your hand edits.
5. **Run the import** and read the report: created / updated / skipped counts and any per-row errors.

Good to know: up to **500 rows** per file; image columns take public URLs which are downloaded and re-uploaded into your own media storage; blog/page content columns are written in Markdown and converted to the rich editor format automatically.

Two of the product columns are both called "tier", and they are different things: `product_tier` is the **product tier** — what the piece is, Large / Medium / Small (Tier 1 Collectible · Tier 2 Memory · Tier 3 Personal) — and `tier` is the **import list** the row came from, 1–4 (see §20). Leave `tier` blank for a product you made yourself; CONTENT_GUIDE.md has the exact spellings.

> ⚠️ **A scraper file is competitor content, and it can only ever land as drafts.** A Product Scraper CSV (it carries `sourceKey` and `externalId` columns) is accepted here as **Products only**: every row arrives as a Draft flagged "needs rewrite", categories and product tiers are filled in where the listing makes them clear, and the file's status and import-list cells are ignored. Pick any other content type for such a file and Bulk Import refuses the whole file — the rewrite rule below is the only door for competitor-sourced content.

## 18. Product Scraper (research tool)

The scraper collects competitor products **for research and cataloging speed** — never for copying. Three screens:

**Sources** — a registry of scrape-ready sites, each filed under a **source tier**: which supplier list we went looking in — Large-format, Medium-format or Small-format sellers, plus the four older lists (Owner's store, Resin goods, Supplies, 3D print). A source tier says where a site was found, never what any piece from it is — a large-format studio sells coasters too, so the **product tier** is set per product, not per source. The curated registry comes pre-loaded (it is reconciled on every deploy, preserving your verify results and enable/disable choices). Each row shows the detected platform and has a **Verify** button that re-checks the site live. You can add a new source by URL — the Studio fingerprints it automatically; marketplaces (Amazon, Etsy, Flipkart, Meesho, IndiaMART…) are blocked by design, and sites the scraper can't read are saved as disabled with a note.

**Scrape** (the main Scraper page) — two ways to run:

- **Scrape a website:** paste a store URL, pick its source tier, go.
- **Source-tier runs:** queue every enabled source in a source tier (or **Scrape ALL (source-tier order)**). Jobs run one at a time in small chunks, show live progress, and are **resumable** — if one stops, press Resume. Each finished job has its own **CSV** button.

**Review** — every scraped product lands here as a card (title, photos, price, source). Filter by source or status, open a card for full detail, then **Approve** or **Reject** (in bulk if you like). Approving opens the import dialog: pick which **Rivya Living Art category** they belong to, and keep **"Mirror images"** on (it copies the photos into your own storage so review works even if the source site changes).

> ⚠️ **The rewrite rule (copyright — not optional).** Approved items are imported as **Drafts** flagged **"needs rewrite"**. Scraped titles, text and photos are the competitor's copyrighted material — reference only. Before publishing you must **rewrite every description in your own words and replace all images with real Rivya Living Art photos**, then tick the confirm-rewrite box on the product form. Until then, publishing is blocked — even bulk publish skips flagged products and tells you how many it skipped.

**Exports** — three files, three places, and each says what its columns mean:

- **Scraped rows** leave as a **ScrapeDeck CSV** (26 fixed columns — see CONTENT_GUIDE.md): the **CSV** button on a finished job or a source, or — admins only — the **Scraped products** row on **Studio → Exports**, which takes the whole research corpus (capped at 5,000 rows). This file can go back in through Bulk Import as Products, and only as drafts (§17).
- The scraper's own **confirmed shortlist** — the rows you confirmed one by one in the review inbox — downloads as CSV or XLSX from **Scraper → Confirmed products**.
- Your **catalogue's confirmed products** download as CSV or Excel from **Studio → Exports → Confirmed products** (24 fixed columns — see CONTENT_GUIDE.md). Two of its columns are both called "tier", and the screen spells out which is which: `product_tier` is the **product tier** — what the piece is, written `LARGE_FORMAT`, `MEDIUM_FORMAT` or `SMALL_FORMAT` (Tier 1 Collectible · Tier 2 Memory · Tier 3 Personal) and blank until someone files it — and `tier` is the **import list** the row came from, `1`–`4` (1 Owner's store · 2 Resin goods · 3 Supplies · 4 3D printing), blank for a product made in the Studio. Quote-only pieces export an empty price, never a zero.

Every export is a snapshot, not a connection: nothing syncs back, and editing a downloaded file never changes the catalogue. (Until 2026-09-15 a **Sync to Sheet** button also pushed rows into a Google Sheet; that integration was removed, and you take a file when you want one instead.)

## 19. Subscribers

**Subscribers** collects the email addresses people leave in the newsletter signup forms on the website (footer and content pages). The list page shows every subscriber with their signup date, and an **Export CSV** button downloads the whole list so you can use it in any mailing tool. No emails are ever sent automatically — the site only collects; sending is up to you.

## 20. Catalog fill (the four import lists)

**Catalog fill** is the status page for the catalogue that loads from the **four import lists** — CSV files committed to the repository under `data/tiers/`, one per list: **List 1 — Owner's store** (`Tier1_Owner`, all rows), **List 2 — Resin goods** (`Tier2_ResinGoods`, top 1,000), **List 3 — Supplies** (`Tier3_Supplies`, top 2,500) and **List 4 — 3D printing** (`Tier4_3DPrint`, top 500). The file names keep their old "Tier" spelling because they are the stored read path; everything you read on screen says **list**. A list says **where a row came from — never what the piece is.** The **product tier** (Collectible · Memory · Personal — the **Product tier** field on the product form) is a separate field: the fill never sets it, and the page's **Would file as** column is only a forecast of what the rule (below) would decide for the rows the last fill placed.

The fill can run on every deploy; this page shows a row per import list (linked to the products it produced — the Products screen filters by **Import list** and, separately, by **Product tier**), the last run's created/updated/unchanged/failed numbers, and how many imported product images still point at external sites. Imported images are copied ("mirrored") into your own storage in batches — a nightly job works through the backlog, and **Mirror next batch (200)** runs the next batch on demand.

What the page lets you do:

- **Preview** runs the whole four-list fill as a dry run — nothing is written — and shows exactly what a real run would create, update and skip, with the reason for every dropped row. **Run now** does the real thing without waiting for a deploy. Both honour the policy card on this same page: **Fill the catalogue from the import-list CSVs** is the master switch (off stops it everywhere, deploys included), **Fill when the site deploys** is the deploy-time trigger, and **Stop if it would add more than** caps how many products one run may create.
- **Conflicts** — when a list's CSV and a Studio edit changed the same field of the same product between fills, the fill no longer picks a side quietly. Each conflict is listed by field with both values, and you choose **Keep mine**, **Take imported** or **Skip**.
- **Product tiers are filed by rule, after the fill**, not by the fill: on production and local builds a deploy-time pass, and at any time the **Suggest tiers** button on the Products screen (it shows the plan before it writes), file untiered rows from their category first and their own words second — and leave supplies untiered, because a mold or a pigment is not a piece. Neither ever touches a row you have already tiered.

## 20b. Emptying the catalogue

Deleting products from the Products screen is not enough on its own, and this
is worth understanding before you try it: the catalog fill runs on **every
deploy**, so the catalogue refills unless the fill itself is switched off.

There is a script for it. Someone with the production `DATABASE_URL` runs:

```
npm run products:purge                      # shows the blast radius, writes nothing
npm run products:purge -- --confirm         # does it
```

The dry run comes first and always. It prints how many products go, how many
images and customization fields go with them (cascade), and — the part worth
reading — what is **kept**: every WhatsApp order and every testimonial
survives, simply unlinked from the product it pointed at. A customer's order
history and a customer's own words are never deleted by this.

A `--confirm` run also switches the automatic fill **off**, and that is
deliberate. Deletions are remembered permanently (a "tombstone" per row), but
Lists 2–4 hold far more rows than their caps — 35,128 rows against a cap of
1,000, for instance — so deleting the current 1,000 just promotes the next
1,000 on the following deploy. Only switching the fill off actually empties the
catalogue. Turn it back on from **Catalog fill** whenever you want one again.

Flags: `--imported-only` spares products you made by hand, `--keep-demo` spares
the Content Lab set, `--keep-fill-on` leaves the fill running (the catalogue
will not stay empty).

Images already copied into Blob storage are **not** deleted — a mass delete of
shared files is how a blog post loses its picture. The script reports how many
there are; clear them from the Media Library if you want the space back.

## 21. Content Lab (demo content)

**Content Lab** loads a full set of _demo_ content — a hundred concept pieces, thirty journal posts, twelve case studies, forty testimonials, FAQs, landing pages, media, enquiries and research notes — so you can see every screen of the studio and the site full, edit real rows, and rehearse the flows without inventing anything by hand. Every demo row is marked as such everywhere it appears (a small "DEMO CONTENT" mark on the site, a **demo** badge in the studio, a **Demo only** filter on every list).

- **Seed** loads the set; **Remove** deletes every demo row (it asks you to type a confirmation). Neither touches a real product, post or enquiry.
- **Show demo content on the live site** is a switch in Content Lab and in Settings. Off, the demo pieces exist only inside the studio. On, they render on the site marked "DEMO CONTENT" — but they are never in the sitemap, never in Google's structured data, never exported and never mirrored, whatever the switch says. A demo order still opens WhatsApp, with the message prefixed **[DEMO]**, and is saved as a demo enquiry.
- The loader refuses to write into a production database unless it is told to twice, so the demo set cannot land on the live site by accident.

## 22. Process steps, materials and sections that ship off

**Page Sections** gained two dedicated screens: **Process Steps** (the ten stages the Process page tells, each with its words and picture, reorderable and hideable — but never all hidden) and **Materials** (the four materials both the Process and the About page show; reordering one moves it on both). The homepage's **What we commission** (furniture) and **In the room** bands, and the Large Format page's **pieces** band, ship **switched off** — they are commission framing with concept pictures and no prices, and they appear only when you turn them on in Page Sections.

---

_Companion guides: CONTENT_GUIDE.md (image standards + every import template), WHATSAPP_ORDER_GUIDE.md (how ordering works under the hood), SEO_GUIDE.md, BACKUP_GUIDE.md._
