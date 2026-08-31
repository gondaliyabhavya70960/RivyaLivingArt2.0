# WHATSAPP_ORDER_GUIDE.md — WhatsApp Ordering System

WhatsApp is the **only** ordering channel — no payment gateway, no checkout, no customer accounts. This document is the reference for the exact message format, the link rules, the upload pipeline, the spam protections, and how to test the whole flow. The implementation lives in `src/lib/whatsapp.ts`, `src/actions/order.ts`, `src/app/api/upload/route.ts`, and `src/lib/upload-client.ts`.

## 1. Flow — exact order of operations on "Place Order"

1. Client-side form validation (React Hook Form + Zod) — with a **live preview** of the final WhatsApp message rendered as the customer fills the form (the preview and the server use the same pure `buildOrderMessage` function).
2. Reference images are compressed and **uploaded first** (§4) — their public URLs go into the message.
3. The **Server Action** (`submitProductOrder` / `submitCustomOrder`) re-validates everything with Zod (never trust the client), runs the spam checks (§5), **enforces required customization fields server-side**, rebuilds the message authoritatively, and saves the **Inquiry** row — including the final `whatsappMessage` text. This powers Studio → WhatsApp Orders, so **every order is captured even if WhatsApp never opens**.
4. Analytics events fire: `order_submitted` (a lead event, with the product slug), then `whatsapp_redirected`.
5. `window.open()` on the returned wa.me URL **and** a client-side navigation to the fallback page `/whatsapp-order?i=<inquiryId>&t=<claimToken>` (§7), so a blocked popup never strands the customer.

Note: draft products intentionally accept orders — that's how staff place test orders from the draft preview page (staff draft mode via `/api/draft?redirect=/product/<slug>`).

## 2. Link format (wa.me rules)

```
https://wa.me/917096036250?text=<encodeURIComponent(message)>
```

- The number is international format with **no `+`, spaces, or dashes** (enforced by the Site Settings form: digits only, 8–15, with country code).
- Exactly **one `?text=` parameter**; the entire message is a single `encodeURIComponent` — newlines become `%0A` automatically.
- Built only by `buildWaLink()` in `src/lib/whatsapp.ts` — never assemble wa.me URLs by hand.

## 3. Message template (exact — from `buildOrderMessage`)

```
Hello Rivya Living Art,
I would like to order:
*Product:* Custom Resin Nameplate
*Size:* 24 Inches
*Colour theme:* Sapphire Blue & Gold
*Custom Text:* Bhavya Gondaliya
*Budget:* ₹5,000 – ₹15,000
*Timeline:* 2-3 weeks
*Reference Images:*
https://xxxx.public.blob.vercel-storage.com/refs/ref1.jpg
https://xxxx.public.blob.vercel-storage.com/refs/ref2.jpg
*Additional Notes:* Please create a luxury finish.
*Customer Details:*
Name: Priya Sharma
Phone: +91 98XXXXXXXX
Email: priya@example.com
(#RR-1042 · Sent from store.bhavyagondaliya.co.in)
```

Line-by-line rules:

- `*Product:*` — the product title (custom commissions use "Custom commission"); omitted if absent.
- One `*<Label>:* <value>` line per customization selection, in form order.
- `*Budget:*` and `*Timeline:*` appear only on custom-order messages (when filled).
- `*Reference Images:*` heading + one URL per line — only when images were uploaded.
- `*Additional Notes:*` — only when notes exist. On the custom-order form, the design idea and extra notes are combined into this block.
- `*Customer Details:*` — Name and Phone always; Email only when provided.
- Final (provenance) line: `(#RR-<n> · Sent from store.bhavyagondaliya.co.in)` — the `#RR-<n>` inquiry reference is assigned by the database, so the **server-rebuilt** message carries it; the live client preview shows the line without it.
- **Localization:** on non-English locales the intro is localized and every label renders bilingually as `<localized> / <English>` (so staff can always read the message); the `#RR` reference stays script-neutral.

### Message length — character + encoded-length budgets

The final message is kept ≤ **1,500 characters** (long URLs count) **and** ≤ **7,000 encoded characters** in the wa.me URL (I18N-904 — non-Latin scripts like Hindi/Gujarati/Arabic expand to ~9 encoded bytes per character, and some Android in-app browsers reject very long URLs; Latin messages never hit the encoded cap first). When over budget, **only the notes are trimmed**, ending with `…` — the structured lines and reference URLs always survive intact. If the message is still over even with notes removed entirely (e.g. many long URLs), it is sent as-is without notes: the URLs are the studio's source of truth and are never dropped; wa.me still encodes fine, just longer than ideal.

## 4. Reference images — upload pipeline

wa.me links **cannot attach files**, so images are uploaded first and their public URLs embedded in the message.

**Limits:** max **5 images × 5MB**, **JPG / PNG / WebP** only — enforced client-side (friendly errors), in the Blob upload token, and again in the server fallback.

Pipeline (`src/lib/upload-client.ts`):

1. **Validate** the files.
2. **Compress in the browser** (`browser-image-compression`): target ≤ 1.5MB, max 2000px, web worker; if compression fails or doesn't help, the original is used.
3. **Vercel Blob client upload** (preferred): the browser asks `/api/upload` for a scoped token, then uploads **directly to Blob** — files never transit the serverless function, so the 4.5MB body limit doesn't apply. The token is restricted to the `refs/` path prefix, the three image types, and 5MB.
4. **Multipart fallback** (local dev, Blob-less envs, or any client-upload failure): one multipart POST to `/api/upload`, persisted via the storage driver (local disk in dev, Blob in prod).

## 5. Spam protection (all public forms)

- **Honeypot** — a hidden field humans never see; any value = silent rejection with a generic error.
- **Minimum fill time (signed form token)** — on mount, the form fetches an HMAC-SHA256-signed server timestamp from `/api/form-token` (keyed by `AUTH_SECRET`, so it can't be forged). The server action verifies the signature and requires the token to be **≥ 2.5 seconds** old and **≤ 6 hours** old. All public forms pass this `formToken` (order, custom order, contact, newsletter).
- **Per-IP rate limits** (sliding window, in-memory — resets on cold start, which is fine for spam):
  - contact form: **5 / 10 min**
  - order actions (product + custom): **6 / 10 min**
  - newsletter subscribe: **5 / 10 min**
  - upload fallback route: **30 / 10 min**
- All failures return deliberately generic copy (rate-limited orders get a friendlier "wait a little or message us directly on WhatsApp").

## 6. Managing orders in /studio — Inquiry statuses

Every submission creates an **Inquiry** (source: `PRODUCT`, `CUSTOM_ORDER`, or `CONTACT`). Work them through **New → Contacted → Quoted → Confirmed → Delivered** (plus **Closed** for dead/declined leads — kept for history, filtered from the active pipeline) in Studio → WhatsApp Orders: per-status count cards, source/status/search filters, bulk status changes, and a detail view with the customer's contact (tap-to-call), all selections, reference image links, and the exact saved message with **Copy** and **Open in WhatsApp** buttons. Full walkthrough in ADMIN_GUIDE.md §6.

## 7. Fallback page — `/whatsapp-order`

The landing pad after Place Order (`/whatsapp-order?i=<inquiryId>&t=<claimToken>`), for when the popup was blocked or the WhatsApp tab was lost:

- Looks up the inquiry and shows the **saved message** with an **Open WhatsApp** button (fresh wa.me deep link) and a **Copy message** button.
- **Claim token (`t=`)**: the saved message contains the customer's personal details, so it is only served to the holder of the hashed one-time claim token issued with the order (ENG-811) — a guessed or shared inquiry id alone reveals nothing.
- **24-hour window**: order links older than a day (or unknown ids / missing tokens) fall back to a friendly "say hello on WhatsApp" card with the default greeting — the message itself is never lost; it's in the Studio.
- `noindex`, force-dynamic.

## 8. Analytics events

| Event | Fired when |
|---|---|
| `order_submitted` | Place Order submitted successfully (props: product slug) — lead event |
| `whatsapp_redirected` | the wa.me window is opened |
| `whatsapp_cta_click` | any page-level WhatsApp CTA is clicked |
| `custom_order_submitted` | custom-commission form submitted — lead event |
| `contact_submitted` | contact form submitted — lead event |
| `newsletter_subscribe` | newsletter signup submitted (props: source) — lead event |
| `share_product` | share button used (props: slug, channel: whatsapp/copy) |

View them under Vercel → Analytics → Events once Analytics is enabled. Lead events also fire Meta Lead + GA4 `generate_lead` conversions when `NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_GA_ID` are set.

## 9. Testing checklist

- [ ] **iPhone** (Safari): Place Order opens the WhatsApp app with the full message pre-filled; formatting (`*bold*`, line breaks) intact.
- [ ] **Android** (Chrome): same.
- [ ] **Desktop**: opens WhatsApp Web/app with the message intact.
- [ ] **Long message**: fill notes with 2,000+ characters → message arrives ≤ 1,500 chars, notes end with `…`, all reference URLs and customer lines intact.
- [ ] **Blocked popup**: block popups, Place Order → you land on `/whatsapp-order` showing the summary; Open WhatsApp and Copy both work.
- [ ] **Reference images**: upload 5 large JPGs → compressed, uploaded, URLs appear in the message and in the Studio inquiry. A 6th file or a 6MB file is rejected with a friendly error.
- [ ] **Required fields**: leave a required customization empty → server rejects with "Please fill: …".
- [ ] **Draft preview order**: signed in to the Studio, open `/api/draft?redirect=/product/<slug>` and place a staff test order; it appears in Studio → WhatsApp Orders (delete it after).
- [ ] **Inquiry saved regardless**: close the WhatsApp tab immediately — the order is still in the Studio with its full message.
- [ ] **Analytics**: `order_submitted`, `whatsapp_redirected`, `custom_order_submitted`, `contact_submitted` visible in Vercel Analytics events.
