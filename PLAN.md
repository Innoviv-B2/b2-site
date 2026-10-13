# b2-site — build plan for the standalone site

**Goal.** A complete, fully functioning b2motorsports.com that depends on nothing: no WordPress,
no Elementor, no plugins. Static HTML, one stylesheet, one small script, real photos, forms that
post straight to HubSpot. SEO built in per page and site-wide. Reviewed as a Claude artifact
where Cliff comments on copy, photos and navigation, then finalized.

Written 18 Sep 2026. Orchestrator: this session (Fable). The WordPress site and McWilliams'
platform are untouched; this repo is a parallel build that can be hosted anywhere static
(Cloudflare Pages, Netlify, SiteGround static folder) when Cliff decides.

## What is being built

| Layer | Where | Notes |
|---|---|---|
| Design tokens + components | `src/css/site.css` | The adopted brand system (ink, purple, blaze, Saira, Space Mono, the skew). One file, ~450 lines. |
| Shared header / footer | `src/partials/` | Nav from `site.json`. Call-or-text, Get a quote, tagline in the footer. |
| Page bodies | `src/pages/<name>.html` | One file per page, meta JSON on top (title, description, keyphrase, breadcrumb, schema). |
| Behaviour | `src/js/site.js` | Menu, dropdowns, forms → HubSpot Forms API (falls back to mailto when a form has no GUID yet). |
| Build | `build.mjs` | `dist/` multi-page site + `sitemap.xml` + `robots.txt` + `404.html`; `review/index.html` single-file review build with a hash router and an SEO panel; `--check` validates every page. |
| Photos | `assets/img/` + `manifest.json` | Real B2 photos from the redesign mockups and the Shop Photos set, resized, WebP + JPEG. |

## Site map (plan of record §6, plus the three pieces from §7a placed under Race With Us)

```
/                                   Home                          (Fable — the precedent page)
Race With Us ▾
  /race-with-us/                    Arrive & Drive, flagship      (Opus)
  /the-cars/                        The Cars                      (Sonnet)
  /srf3-fit-check/                  Do You Fit?                   (Sonnet)
  /rental-pricing-calculator/       What It Costs (live calculator, ported intact)   (Sonnet)
  /2026-race-calendar-…/            2026 Calendar                 (Sonnet)
  /how-to-get-a-racing-license/     Licence path                  (Sonnet)
  /paths-into-racing/               Paths Into Racing             (Sonnet)
Storage & DIY Garage ▾
  /services/storage/                Storage landing               (Sonnet)
  /services/storage/equipment/      The Equipment
  /services/storage/membership/     How Membership Works
  /services/performance-shop/       Member Services (was top-level Owner Services; see note)
  /services/storage/sign-up/        Sign Me Up
About ▾
  /about-us/  /faq/  /blog/         About, FAQ, Blog index        (Sonnet ×2)
  /blog/buying-safety-gear/         Safety gear post              (with Blog)
/contact-us/                        Contact                       (Sonnet, with the five secondary pages)
Secondary (footer + homepage tiles): /driver-development-program/ /simulator-and-sim-training/
  /sponsors/ /media-packages/ /product-development/ /privacy-policy/   (Sonnet, one agent)
```

**Member Services, decided 11 Oct 2026 (Cliff).** The old Owner Services page repeated the rental
price list ($600 prep, $600/day trackside, transport per mile) for people who own their own SRF.
There is no price difference between the two, so the list now lives in one place: the calculator,
whose "Whose car?" switch drops the car-rental line for an owner's SRF. `/services/performance-shop/`
became Member Services under Storage & DIY Garage: exclusive access to the race mechanics for
garage and storage members (alignment, track prep to their checklist, track-day inspections, dyno,
repair, parts through MotorState/PGP, Lane, Sabelt America, SCCA Enterprises), quoted per car, no
posted prices. Dyno and alignment are members only, so the street-car section and form are gone.
The slug stays so no redirect is needed; page file is `member-services.html`.

URLs keep the live site's slugs so nothing Google already knows is orphaned. The old
`/services/` hub, `/store/`, `/storage-form/` and `/sitemap` page are not rebuilt.

## Agents, waves and token budget

Principle: **the expensive model does the first-of-kind work once; everything else copies it.**
Every page agent reads exactly four things: `PAGE-SPEC.md`, `src/pages/home.html`, its own deck in
`b2-wp-tools/website/pages/`, and `assets/img/manifest.json`. Nothing else. Reports are ~15 lines.

| Wave | Who | Work | Reads | Runs alongside |
|---|---|---|---|---|
| 0 | Sonnet, 1 agent | Photo library: decode the mockup photos, resize the 17 shop photos, manifest with alt text | two mockup HTML files, the zip | wave 0 orchestrator |
| 0 | Fable (orchestrator) | Repo, tokens, partials, build script, PAGE-SPEC, the Home page | plan of record, brand system, decks 01 | — |
| 1 | Opus ×1, Sonnet ×12, in parallel | One page each (see map). Calculator agent ports `b2-wp-tools/website/wordpress/payloads/srf3-rental-estimate.html` region by region, keeping `CONFIG` and `compute()` byte-for-byte. Secondary-pages agent ports the live copy of five pages from the WordPress export outline. | PAGE-SPEC, home.html, one deck, manifest | all 13 at once |
| 2 | Sonnet ×1 | Site QA: `node build.mjs --check`, fix mechanical defects in any page, cross-page keyphrase collisions, internal-link audit, alt-text audit, schema validity | build report, all pages | after wave 1 |
| 2 | Fable | Review the QA report, spot-check the four money pages (Home, Arrive & Drive, What It Costs, Storage), build, publish the review artifact | — | — |
| 3 | Cliff | Comments on the artifact (copy, photos, navigation) | the artifact | — |
| 3 | Sonnet per page | Apply Cliff's comments to the affected `src/pages/` file, rebuild, republish | one page + the comments | as comments arrive |

Estimated cost: wave 1 is 13 agents × roughly 60–90K input tokens (spec 4K + precedent 4K +
deck 5–40K + tool overhead) and 5–15K output each. Wave 0 and 2 are small. The orchestrator holds
only this plan, the reports, and the build output.

## Rules every agent carries

1. One page per agent; two agents never write the same file.
2. Nothing here writes to WordPress. `b2-wp-tools` is read-only source material.
3. Open items stay open: the deck's "needs Cliff" items become inline `<span class="note">`
   flags, visible in the review artifact, never invented copy.
4. Conventions (`PAGE-SPEC.md` §5) are enforced by `node build.mjs --check`; a page with errors
   is not done.
5. The $4,468 two-day Barber benchmark is the only headline weekend price.

## Review and finalization loop

1. `node build.mjs` → `review/index.html` is published as the artifact **B2 Motorsports Site
   Draft** with the photos as supporting files. The review bar has a page picker and an SEO panel
   (title/meta/keyphrase/H1/word count/build checks per page).
2. Cliff selects text and comments. Comments sent to Claude wake this session.
3. Each comment is applied to the one page file it concerns; rebuild; republish to the same URL.
4. When Cliff says "final": `node build.mjs` produces `dist/`, which is the deployable site.

## Not in scope, and why

- Hosting and DNS: Cliff's decision with McWilliams; `dist/` works on any static host.
- HubSpot form GUIDs: eight of nine forms still have to be created in the HubSpot UI
  (`b2-wp-tools/integrations/hubspot/forms.md`). Until then those forms fall back to email.
- The EasyCart store: stays on WordPress; the footer links to it.
- Blog beyond the one drafted post: the index lists it and the existing prep-shop post as a link.
