# b2-site — the standalone b2motorsports.com

A complete static website for B2 Motorsports. No WordPress, no Elementor, no plugins, no build
dependencies. Plain HTML, one stylesheet, one script. Forms post directly to HubSpot.

## Run it

```bash
node build.mjs            # → dist/ (deployable site) + review/index.html (single-file review build)
node build.mjs --check    # validate every page, write docs/reports/build-check.md
```

Node 18+; no `npm install`. From Windows Git Bash over the `\\wsl.localhost` share call `node`
directly, not `npm run`.

## Layout

| Path | What |
|---|---|
| `site.json` | Name, address, phone, HubSpot portal and form ids, navigation, footer links, consent text, planned URLs |
| `src/pages/*.html` | One file per page: a `<!--meta {…} -->` JSON block (URL, title, description, keyphrase, breadcrumb, schema) followed by the page body (sections only) |
| `src/partials/` | Shared header and footer |
| `src/css/site.css` | The whole design system: tokens, type, components, responsive rules |
| `src/js/site.js` | Menu, dropdowns, form submission (HubSpot Forms API, email fallback) |
| `assets/img/` | Optimized photos (JPEG 1600/800 + WebP) and `manifest.json` with subjects and alt text |
| `build.mjs` | The builder and the checker |
| `PAGE-SPEC.md` | How to write a page: classes, forms, conventions, SEO rules |
| `PLAN.md` | The build plan, the agent split, the review loop |
| `dist/` | Output: `<path>/index.html` per page, `sitemap.xml`, `robots.txt`, `404.html`, `assets/` |
| `review/index.html` | Every page in one file with a hash router, a page picker and an SEO panel; this is what gets published as the review artifact |

## Deploying

`dist/` is a plain static site. Upload it to any static host (Cloudflare Pages, Netlify,
SiteGround's document root, an S3 bucket). URLs match the live WordPress slugs, so no redirects
are needed if the site replaces the WordPress one at the same domain. `sitemap.xml` and
`robots.txt` are generated; submit the sitemap in Search Console after go-live.

## Forms

`site.json → hubspot.forms` maps each form key to a HubSpot form GUID. Keys with an empty GUID fall
back to opening the visitor's email client with the answers filled in, so nothing is lost while the
HubSpot forms are being created. The consent text is B2's approved language and is inserted
verbatim wherever a page writes `{{CONSENT}}`.

## What is checked on every build

One `<h1>`, title and meta lengths, keyphrase in title/meta/H1/body, alt text on every image,
lazy-loading, internal links resolve to real pages, the contact conventions (phone, emails, the shop
address), the tagline's capital M, the brand purple, no dead links from the old site.
