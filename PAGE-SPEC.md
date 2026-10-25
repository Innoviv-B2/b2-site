# PAGE-SPEC — how to write one page of the standalone B2 Motorsports site

You are building ONE page. Read this file, `src/pages/home.html` (the precedent), your content
deck, and nothing else unless your brief names it. Output is ONE file in `src/pages/`. Do not
edit any other file. Do not run anything that writes to the live WordPress site.

## 1. File format

```html
<!--meta
{
  "path": "/race-with-us/",                       // final URL, leading and trailing slash
  "order": 20,                                    // sort order in the review picker (home = 10)
  "nav": "race",                                  // which top-nav item is "here": race|storage|owner|calendar|about|contact|""
  "navLabel": "Arrive & Drive",                   // short name for the review picker
  "title": "Spec Racer Ford Arrive-and-Drive Rentals | B2 Motorsports",   // 50–65 chars, ends "| B2 Motorsports"
  "description": "…",                             // 140–159 chars, plain, contains the keyphrase
  "keyphrase": "Spec Racer Ford arrive and drive", // one focus keyphrase, unique across the site
  "ogImage": "/assets/img/hero-car58-checkered-flag.jpg",   // optional; defaults to og-default.jpg
  "breadcrumb": [["Race With Us", "/race-with-us/"]],       // path from Home, excluding Home
  "pageType": "WebPage",                          // or FAQPage, AboutPage, ContactPage, CollectionPage, BlogPosting handled via schema
  "schema": [ { "@context": "https://schema.org", "@type": "Service", … } ]   // optional extra JSON-LD objects
}
-->
<!-- then the page body: sections only. NO <html>, <head>, <body>, <main>, header or footer. -->
<section class="hero">…</section>
<section class="sec">…</section>
```

The build wraps the body in `<main>`, adds the shared header/footer, the `<head>` with
title/meta/canonical/OG/JSON-LD (Organization + BreadcrumbList + WebPage automatically), the
sitemap entry and the review artifact. **Exactly one `<h1>` per page.**

## 2. What the site is

A static site for **B2 Motorsports, Huntsville, AL**: Spec Racer Ford (SRF3) arrive-and-drive
rentals, storage, coaching, member services. Brand: ink ground `#0F0E13`, brand purple `#7C2FF0`
for actions, blaze orange `#FF6A00` for the one number/word that matters, Saira italic 800/900
headings, Saira 400 body, Space Mono labels. **All of that is already in `src/css/site.css`.**
Use its classes; add page-specific CSS only in one `<style>` block at the top of your body, with
every selector scoped under `.pg-<yourfile>` (e.g. `.pg-storage .tiers { … }`). No `*`, `body`,
`html` rules. No new fonts. No emoji. No icon libraries. Unicode glyphs only (→ · ✓ ▾).

## 3. Classes you can use (from site.css)

| Need | Markup |
|---|---|
| Hero | `<section class="hero"><img class="hero__img" src="/assets/img/x.jpg" alt="…"><div class="hero__shade"></div><div class="wrap hero__in"><nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li>Storage</li></ol></nav><p class="eyebrow">…</p><h1>…</h1><p class="lede">…</p><div class="btns"><a class="btn" href="…"><span>Label</span></a><a class="btn btn--ghost" href="…"><span>Label</span></a></div></div></section>` · add `hero--short` for inner pages |
| Section | `<section class="sec"><div class="wrap">…</div></section>` · `sec--raised` alternate band · `sec--tight` |
| Section head | `<div class="sec__head"><p class="eyebrow">…</p><h2>…</h2><p class="sub">…</p></div>` |
| Columns | `grid grid--2|3|4` · `split` (7/5) · `split--rev` · `split--top` |
| Cards | `<div class="card"><img class="card__img" …><h3>…</h3><p>…</p><a class="more" href="…">Label</a></div>` · `card--accent` (one per page) · `card__k` mono kicker · `card__price` |
| Stats strip | `<section class="stats"><div class="wrap"><div class="stat"><div class="stat__v">30+</div><div class="stat__l">years…</div></div>…</div></section>` (4 stats) |
| Big number | `<div class="big"><span class="tilde">~</span>$4,500</div><p class="mono">two-day track weekend at Barber</p>` |
| Photo band | `<section class="sec band"><img class="band__img" …><div class="band__shade"></div><div class="wrap">…</div></section>` |
| Figures | `<figure class="figure figure--portrait"><img …><figcaption>…</figcaption></figure>` · `photo-grid` |
| Checklist | `<ul class="check"><li><span class="check__tick">✓</span><span class="check__k">Transport</span><p>…</p></li><li class="you">…</li></ul>` |
| Steps | `<div class="steps"><div class="step"><div class="step__n">Step 1</div><h3>…</h3><p>…</p></div>…</div>` |
| Timeline | `<ul class="rail"><li><span class="rail__t">7:00 AM</span><p><b>…</b> …</p></li></ul>` |
| Key/value | `<ul class="kv"><li><span class="k">Label</span><span>Value</span></li></ul>` |
| Table | `<div class="scroll-x"><table class="table"><thead><tr><th>Line</th><th class="amt">Amount</th><th>What</th></tr></thead><tbody><tr><td>…</td><td class="amt">$1,234</td><td class="what">…</td></tr><tr class="total"><td>Total</td><td class="amt">$4,468</td><td></td></tr></tbody></table></div>` |
| FAQ | `<div class="faq"><details id="q-license"><summary>Question?</summary><div class="a"><p>…</p></div></details></div>` (+ FAQPage schema in meta) |
| Chips / tags | `<ul class="chips"><li>…</li></ul>` · `<ul class="tags"><li><span>…</span></li></ul>` |
| Long copy | `<div class="prose">…</div>` (h2/h3/p/ul/blockquote spacing handled) |
| Callout / quote | `<p class="callout"><b>For example:</b> …</p>` · `<blockquote class="quote">…<cite>Name</cite></blockquote>` |
| Closing CTA | `<section class="sec cta"><div class="wrap wrap--narrow"><h2>…</h2><p class="body">…</p><div class="btns"><a class="btn btn--paper" href="…"><span>…</span></a><a class="tel" href="tel:+12569100658">Call or text 256-910-0658</a></div><p class="contact-line"><a href="mailto:info@b2motorsports.com">info@b2motorsports.com</a></p></div></section>` |
| Open item flag | `<span class="note">needs Cliff: …</span>` — inline, next to the affected copy |

## 4. Forms

Every form is a GoHighLevel form, embedded (decided 25 Oct 2026; HubSpot retires at the switch-over).
A page writes the wrapper and a token; the build turns the token into the embed and the call-or-text
fallback line under it. The key must be in `site.json` → `ghl.forms` or the build stops.

```html
<div class="form ghl-form" id="storage-form" data-form="storage-inquiry">
  <div class="form__head"><h3>Ask about a bay</h3><span class="mono">We reply within a business day</span></div>
  {{GHL_FORM:storage-inquiry}}
</div>
```

The fields, the consent checkbox (B2's approved text, verbatim) and the thank-you message live in
the GoHighLevel form, not on the page; change them there. Keys: `general-inquiry` and its page
variants (`-calendar`, `-paths`, `-sim`, `-media`, `-race-with-us`), `fit-check`,
`fit-check-short`, `storage-inquiry`, `storage-tour`, `storage-signup`, `member-services`,
`corporate`, `safety-gear`, `testimonial`. A field can be prefilled by adding its key to the
iframe's URL (`?storage_position=3T`). `src/js/site.js` turns a submit into a `form_submit`
conversion for the tags in Zaraz. The calculator embeds `quote-request` (GoHighLevel's "SRF3 Estimate") with the
estimate in its hidden `estimate_*` fields and, as text, in `inquiry_message`.

## 5. Conventions that are checked mechanically (the build fails on these)

- Phone: **call or text 256-910-0658**, link `tel:+12569100658`. Never 256-692-3996.
- Email: `info@b2motorsports.com` (default) or `storage@b2motorsports.com` (storage). Plain, linked.
- Address: **2919A Bob Wallace Ave, Huntsville, AL 35805**. Never 2820 15th Ave.
- Tagline: *The best dollars per sMile.* Capital M. Markup: `dollars per <b>sMile</b>`.
- Purple `#7C2FF0`, never `#833CA3`. Every `<img>` has `alt` and (except hero) `loading="lazy"`.
- Internal links are root-relative to pages that exist (see §7). No links to 2025 calendars,
  `staging2`, `/shop/`, `/race-simulator/`.
- **The one number that matters:** the two-day Barber track weekend benchmark is **$4,468**,
  "around $4,500". Any other headline weekend cost is a defect.
- Coaching: race weekends include Cliff at the track; track-day and time-trial coaching is
  arranged in advance. Never publish coaching as a customer tier.

## 6. SEO, per page

- One keyphrase, in the title, the meta description, the H1 and naturally 3–6 times in the body.
- Title 50–65 chars, house pattern `<Specific offer + qualifier> | B2 Motorsports`, geography
  where it fits ("Huntsville, AL").
- Meta 140–159 chars, a real sentence, no ellipsis.
- Heading hierarchy in order: one h1, h2 per section, h3 inside. Headings carry meaning, not decoration.
- At least 3 internal links to other pages, in the copy where they earn it: the funnel is
  Arrive & Drive → Do You Fit? → What It Costs → Calendar → Contact.
- Images: descriptive `alt` (name Spec Racer Ford / B2 Motorsports / Huntsville where true),
  `width`/`height` attributes if you know them, `loading="lazy"`.
- Body ≥ 300 words for pages meant to rank. Schema in `meta.schema` where the type is obvious:
  `Service` (rentals, storage, member services), `FAQPage`, `Event` list (calendar), `AboutPage`,
  `ContactPage`, `BlogPosting`, `HowTo` (licence path).

## 7. Pages that exist (link only to these)

`/` `/race-with-us/` `/the-cars/` `/srf3-fit-check/` `/rental-pricing-calculator/`
`/2026-race-calendar-spec-racer-ford-rentals-trackside-support/` `/services/storage/`
`/services/performance-shop/` `/about-us/` `/faq/` `/contact-us/` `/blog/`
`/blog/buying-safety-gear/` `/how-to-get-a-racing-license/` `/paths-into-racing/`
`/driver-development-program/` `/simulator-and-sim-training/` `/sponsors/` `/media-packages/`
`/product-development/` `/privacy-policy/`. Anchors: `/contact-us/#quote` is the general form,
`/services/performance-shop/#member-form` the member-services form.

## 8. Photos

Use `assets/img/manifest.json` (read it) to pick real B2 photos by `suggestedUse` and `subject`;
use the `file` name, root-relative: `/assets/img/<file>`. Prefer `<picture>` with the `.webp`
first when you use a large image. If no photo fits, use
`<div class="card__img card__img--empty">Photo needed: <subject></div>` and say so in your report.
Never invent a photo path.

## 9. Open items stay open

Your deck marks things "Open for Cliff" / "needs Cliff". Do not invent an answer. Keep the safest
existing wording, mark it inline with `<span class="note">needs Cliff: …</span>`, and list it in
your report. Never state a price, a name or a policy the deck does not give you.

## 10. Report back (this is all the orchestrator reads)

```
page: <path>  file: src/pages/<name>.html
words: <n>  h1: "<text>"  keyphrase: "<…>"
photos used: <files> · photos needed: <subjects>
open items (inline notes): <numbered list>
deviations from the deck and why: <list or none>
```
Then run `node build.mjs --check` from the repo root and paste the lines for your page.
