# b2-site — b2motorsports.com

The whole B2 Motorsports website: a static site served by **Cloudflare Pages** (decided 25 Oct 2026),
with GoHighLevel's forms embedded and the ad and analytics tags loaded through Cloudflare Zaraz. No
WordPress, no plugins, no build dependencies. Plain HTML, one stylesheet, two small scripts.

How to set up and switch over the hosting, step by step, is [`docs/cloudflare.md`](docs/cloudflare.md).

## Run it

```bash
node build.mjs            # → dist/ (the deployable site) + review/index.html (single-file review build)
node build.mjs --check    # validate every page, write docs/reports/build-check.md
```

Node 18+; no `npm install`. From Windows Git Bash over the `\\wsl.localhost` share call `node`
directly, not `npm run`. Every build also scans `dist/` for the defects of the 25 Oct audit (old phone,
office address, cost-model leaks, debug logging, `http://` links, HubSpot leftovers) and writes the
needs-Cliff flags still on the pages to `docs/reports/open-notes.md`.

## Layout

| Path | What |
|---|---|
| `site.json` | Name, address, phone, GoHighLevel form ids and tracking id, navigation, footer links, consent text, planned URLs |
| `src/pages/*.html` | One file per page: a `<!--meta {…} -->` JSON block (URL, title, description, keyphrase, breadcrumb, schema) followed by the page body (sections only) |
| `src/pages/post-*.html` | The blog posts migrated from WordPress, at their old URLs |
| `src/partials/` | Shared header and footer |
| `src/css/site.css` | The whole design system: tokens for the dark and light themes, type, components, responsive rules |
| `src/js/site.js` | Menu, dropdowns, the form-submit conversion event, the Cookie settings link, YouTube tiles |
| `src/js/theme-init.js`, `theme.js` | The light/dark toggle: the first is inlined in `<head>` so there is no flash of the wrong theme |
| `src/data/events.json` | The race calendar: the approved event feed from b2-event-calendar, which the build renders as the calendar table, its Event schema and the next-events rail. Never edited by hand |
| `tools/calendar-update.mjs` | Copies that feed in and prints what changes; `--branch --push` puts the change on `events/<date>` for a Cloudflare preview (never on `main`; the merge is the publish) |
| `src/redirects.txt` | Every old WordPress URL → its new page, in Cloudflare's `_redirects` syntax |
| `assets/img/` | Optimized photos (JPEG 1600/800 + WebP) and `manifest.json` with subjects and alt text |
| `build.mjs` | The builder and the checker |
| `PAGE-SPEC.md` | How to write a page: classes, forms, conventions, SEO rules |
| `docs/cloudflare.md` | Hosting: Pages, Zaraz, the switch-over |
| `dist/` | Output (not committed): `<path>/index.html` per page, `sitemap.xml`, `robots.txt`, `llms.txt`, `_headers`, `_redirects`, `404.html`, `assets/` |
| `review/index.html` | Every page in one file with a hash router, a page picker and an SEO panel; published as the review artifact |

## Deploying

Cloudflare Pages builds from this repository's `main` branch through its own GitHub connection
(build command `node build.mjs`, output `dist`); there is no GitHub Actions workflow and there should
not be one. A push to `main` deploys; any other branch gets a preview at a `*.pages.dev` address,
which `_headers` marks noindex.

## Forms

Every form is a GoHighLevel embed: a page writes `{{GHL_FORM:<key>}}` and `site.json → ghl.forms`
gives the form id. The fields, B2's consent text and the thank-you message live in GoHighLevel.
Under every embed the build adds "call or text 256-910-0658" and the email, so a visitor is never
stuck if the frame does not load.

## Updating the race calendar

The calendar is generated from `src/data/events.json`; events are approved on b2-event-calendar's
proposed-calendar page and published there (its skill, step 8). Then, from the repo root on `main`:

```bash
node tools/calendar-update.mjs                    # check the feed, write events.json, print what changes
node tools/calendar-update.mjs --branch --push    # the same on events/<date>, built and checked, pushed for a preview
```

Cliff looks at the branch's Cloudflare preview and merges it; the merge is the publish.

## Adding a track

When the calendar gains an event at a track the calculator doesn't know, the calendar page fails the
build check ("… is not in the calculator's track list") and `calendar-update.mjs` won't make a branch,
because that event's Price it link would open with no transport price. To add the track:

1. **The calendar run names it.** b2-event-calendar's `data/tracks.json` has the track: its name,
   aliases, city, state, and the one-way **road route** miles and hours from the shop (basis
   `osrm-route <date>` or the workbook; an estimate is not enough, since transport is priced from it).
2. **Add it to the calculator:** `node tools/add-track.mjs "<track>" --lat <n> --lng <n> --reg <division>`
   prints the line (round-trip miles = 2 × one-way, `src:"road"`) and where it goes in the
   nearest-first list; add `--write` to put it there. `--lat/--lng` are the track's own coordinates.
3. **Build and check:** `node build.mjs --check`, the calendar page clean; price one weekend there.
4. **Cliff OKs it** before it ships, because it changes quotes; record it in b2-wp-tools `DECISIONS.md`.

## What is checked on every build

One `<h1>`, title and meta lengths, keyphrase in title/meta/H1/body, alt text on every image,
lazy-loading, internal links resolve to real pages, the contact conventions (phone, emails, the shop
address), the tagline's capital M, the brand purple, no dead links from the old site; and on the
built site, the 25 Oct audit's defects.
