# 08 — Owner Handbook

Written for the person running the studio, not the person building it. "I want
to change X" → where X lives.

**Everything in this handbook is now ✅.** It was written while the plan was
still being built, with 🅐–🅗 marking the phase that would deliver each row;
all eight shipped, so the markers are gone. A handful of rows carry a note
where what shipped is narrower than what was planned — those say so.

---

## 8.1 "I want to change a word on the site"

| What | Where | Status |
|---|---|---|
| Any headline, paragraph, eyebrow or button label on any page | Site Copy → pick the page → pick the section | ✅ |
| The same words in Hindi, Gujarati, Arabic … | Site Copy → switch the language tab | ✅ |
| Announcement bar message | Site Settings → Announcement | ✅ |
| Announcement that retires itself on a date | Site Settings → Announcement → dates | ✅ |
| A product's name, description, materials, care notes | Products → the product | ✅ |
| A category name and description | Categories | ✅ |
| An FAQ question or answer | FAQs | ✅ |
| Privacy policy, terms | Pages | ✅ |
| A journal post | Journal | ✅ |
| A portfolio case study | Portfolio | ✅ |
| Footer link labels | Site Copy → Footer | ✅ |
| Footer links themselves — add, remove, reorder | Navigation | ✅ |
| Commission form dropdown options (materials, budgets, timelines) | Commission Form | ✅ |
| Studio address, phone, email, WhatsApp number | Site Settings | ✅ |
| Opening hours, response time | Site Settings | ✅ |
| Social media links (Instagram, Facebook, YouTube, Pinterest) | Site Settings → Social — the footer shows only the ones you fill in | ✅ |

**The rule of thumb after Phase A:** if a visitor can read it, you can change
it. If you cannot find it, search Site Copy for the words themselves — the
board searches the text, not just the labels.

---

## 8.2 "I want to change a picture"

| What | Where | Status |
|---|---|---|
| Any hero, process step, material macro, workshop room, mega-menu tile — 57 slots | Site Images → pick the surface | ✅ |
| Put it back the way it was | Site Images → Reset | ✅ |
| The alt text describing that picture | Site Images, right under the picture | ✅ |
| A different crop for phones | Site Images → Mobile crop | ✅ |
| Move the crop so a face is not cut off | Site Images → click the focal point | ✅ |
| Product photos | Products → the product → Media | ✅ |
| A category's tile photo | Categories | ✅ |
| Portfolio case photos | Portfolio | ✅ |
| Journal cover | Journal | ✅ |
| The logo | Site Settings | ✅ |
| Favicon, app icon | — | ✅ |
| The pouring animation on the homepage | — | Not planned. It is 121 frames of one animation; changing it is a design change |

**The one thing to know about Site Images:** every slot has a bundled default
that lives in the code. Replacing a slot never deletes that default, and Reset
always brings it back. You cannot break the site by choosing the wrong picture.

---

## 8.3 "I want to change how a page is put together"

| What | Where | Status |
|---|---|---|
| Hide a section you do not want right now | Page Sections → the page → **Hide** | ✅ |
| Move a section up or down | Page Sections → the ↑ ↓ buttons | ✅ |
| Rearrange a page that is not listed there | **Not possible** — seven pages carry a manifest | — |
| Add a fifth material to a row of four | **Not possible, by design** — see below | — |
| Build a Diwali landing page | Landing Pages → New landing page | ✅ |
| Show 6 products on that page instead of 4 | Landing Pages → the Products block → How many | ✅ |
| Put the picture on the other side | Landing Pages → the Picture block → Picture side | ✅ |
| Schedule that page to go live at 6am | Landing Pages → **Go live at** | ✅ |

Two things worth knowing before you rearrange a page:

- **Some sections will not move or hide, and the screen says which.** Every
  page's opening band carries its heading and stays first. The commission form
  on Bespoke and the message form on Contact cannot be hidden either — they are
  the reason those pages exist.
- **The studio will refuse an arrangement that breaks the design**, and tell
  you which two sections are the problem. Dark bands may not sit against each
  other, and a page may not have more than three.

**Which seven pages** carry a manifest: the homepage, About, Process, Large
Format, Bespoke, Contact and Workshops. Shop, Journal, Portfolio and the FAQ do
not — each is an opening band plus its listing, and hiding the listing would
leave nothing.

### Why you cannot add a fifth material

The layouts are designed around specific counts — four materials, four
signature stages, six collection tiles. A fifth item does not "just wrap to the
next line"; it changes the rhythm the page was drawn against. Adding one is a
design decision with a code change behind it, and that is deliberate: it is the
difference between a site that stays beautiful and a site that slowly stops
being.

Where the count genuinely is unlimited — products, portfolio cases, journal
posts, FAQs, testimonials — you can already add as many as you like.

---

## 8.4 "I changed something and I want to check before customers see it"

How it works:

1. Make your changes. They save as a **draft** — the live site does not change.
2. Press **Preview**. You see the site exactly as it will be, with a ribbon at
   the top so you know you are in preview.
3. Press **Publish**. Everything on that page goes live together, in one step.
4. If it was wrong, open **History**, find the version before yours, and
   **Restore** — which puts it back as a draft, so you can look before
   publishing again.

Before Phase E, edits go live directly (within about five minutes). Treat the
copy board like editing the live site, because that is what it is.

---

## 8.5 "It will not let me save"

The studio refuses a save only when publishing it would break something a
visitor would see. The messages say what to do, but here is what is behind
them:

| Message | What happened | Fix |
|---|---|---|
| "This text used `{count}`; your version does not." | The original had a live number in it — "3 pieces". Removing the placeholder would delete the number everywhere | Keep `{count}` somewhere in your text |
| "Upload the image or pick it from the library — a URL from another site cannot be rendered." | You pasted a link to someone else's site. It would break, and it is not yours to use | Download it, then upload it |
| "The About page's second material has no alt text." | Alt text is what a blind visitor hears and what Google reads | Describe the picture in a few words |
| "The homepage already has three dark bands." | The design allows three; a fourth flattens the page's rhythm | Hide one before turning this on |
| "This link points at a page that does not exist." | A typo in a link would ship a 404 | Pick the page from the list instead of typing it |

None of these are arbitrary. Each one is a rule the site is already checked
against automatically — the studio just tells you before it goes live instead
of after.

---

## 8.6 "Who can do what"

| | Admin | Editor |
|---|:-:|:-:|
| Change words and pictures | ✅ | ✅ |
| Reorder and hide sections (seven pages) | ✅ | ✅ |
| Products, categories, portfolio, journal, FAQs | ✅ | ✅ |
| Build and publish a custom page | ✅ | ✅ |
| Reset a whole page's copy back to default | ✅ | — |
| Navigation and footer links | ✅ | — |
| Commission form options | ✅ | — |
| Site settings, SEO defaults | ✅ | — |
| Restore an old version | ✅ | — |
| Add or remove staff | ✅ | — |

---

## 8.7 The habits that keep the site good

**Write to the budget.** Each field shows a character count. It is guidance,
not a limit — but a headline written for five words and given fifteen will wrap
badly on a phone, and nobody will tell you.

**Change the alt text when you change the picture.** They sit together on the
same screen for exactly this reason. A photograph described as the one it
replaced is worse than no description.

**Check a phone.** Preview at 360px. Ten of the 57 image slots are wide crops;
if the subject drifts off-centre, set a mobile crop rather than accepting it.

**Edit English first, then the other languages.** The board shows how many
strings you have changed per language. When you improve an English headline,
the other eight still describe the old one until you go back — the "Needs
re-translation" filter is there to find them.

**Reset is free.** Every default is still in the code. If an experiment did not
work, Reset returns the shipped version exactly, on any field, any picture, any
page.

**Nothing here can take an order.** Prices, WhatsApp numbers and the order flow
are business logic, not content. If a price looks wrong, fix it on the product
— never by editing the words around it.
