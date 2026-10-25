# Hosting b2motorsports.com on Cloudflare Pages

Written 25 Oct 2026 for Mike Ford (the Cloudflare zone and the registrar) and Cliff (GoHighLevel and
the ad accounts). The decisions behind it are in b2-wp-tools `DECISIONS.md`, 25 Oct; the plan with
each step's "done when" is b2-wp-tools `website/plan.md` §Direction 25 Oct. Do the steps in order.
**What the repository already does** is marked *in the repo*; everything else is a dashboard step.

## 0. The repository

`Innoviv-B2/b2-site`, private. Mike is a collaborator here and nowhere else.

## 1. The preview (no DNS change)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → `Innoviv-B2/b2-site`.
   The project goes in the account that will hold the b2motorsports.com zone.
2. Production branch `main`. Framework preset: None. Build command `node build.mjs`. Build output
   directory `dist`. Environment variable `NODE_VERSION` = `20`.
3. Deploy. The site appears at `https://<project>.pages.dev/`.

*In the repo:* `_headers` sends `X-Robots-Tag: noindex` on every `*.pages.dev` address, so the
preview is never indexed; the build scans for the 25 Oct audit's defects and fails the count if any
is present.

**Done when:** every page renders on the preview (click through the menu and the footer, both
themes, a phone and a desktop); `curl -sI https://<project>.pages.dev/ | grep -i x-robots` shows
`noindex`; the build log says "no audit defects".

## 2. Blog posts and redirects

*In the repo:* the seven published posts from the 14 Sep export are pages at their old URLs, and
`src/redirects.txt` (published as `_redirects`) sends every other old WordPress URL to its new page.

Before the switch-over, Cliff takes a fresh WordPress export, it is sanitized
(`node website/wordpress/bin/wxr-sanitize.js <file>` in b2-wp-tools), and any post newer than 14 Sep
is added the same way.

**Done when:** every URL in the export answers 200 or 301 on the preview, zero 404s.

## 3. Search and AI

*In the repo:* a canonical, title, meta and JSON-LD on every page; `sitemap.xml` of the indexable
pages; `robots.txt` that admits the search and AI crawlers by name; `llms.txt`; security headers
(HSTS, nosniff, referrer policy, a content-security policy that allows GoHighLevel, YouTube's
privacy-enhanced player and Google Fonts).

Mike, in the zone:
- Security → Bots: **"Block AI bots" off**, and AI Labyrinth off.
- Security → Settings (or AI Crawl Control): **"Managed robots.txt" off**, so Cloudflare does not put
  its own disallow lines ahead of the site's.
- Leave "Bot Fight Mode" as it is unless it blocks the GoHighLevel embeds.

**Done when:** Lighthouse on the preview gives SEO 100 and mobile performance 90 or better on Home,
Arrive & Drive, the calculator and Storage; securityheaders.com grades the preview A; the browser
console shows no content-security-policy errors on a page with a form and on the calculator. If one
does, add the blocked host to `CSP` in `build.mjs`.

## 4. GoHighLevel forms

*In the repo:* every form is a GoHighLevel embed (ids in `site.json` → `ghl.forms`), with a
call-or-text fallback line under it; the calculator sends its estimate into `general-inquiry`'s
message field; `site.js` turns a form's submit message into a `form_submit` event.

Cliff, in GoHighLevel:
1. Settings → Tracking code (external tracking): copy the tracking id into `site.json` →
   `ghl.trackingId`; the build then adds the script to every page.
2. Each form: spam protection on; notifications to info@ (and storage@ for the storage and member
   forms); the consent checkbox carries B2's approved text.
3. The sending domain for the CRM's email with SPF, DKIM and DMARC (TASKS T-32 in b2-wp-tools).
4. One test submit per form on the preview, with the browser console open and this pasted first:
   `addEventListener("message", e => console.log(e.origin, e.data))`. The message GoHighLevel sends
   on submit is the one `site.js` must match; if the "form_submit" event does not fire, adjust the
   match there to that message.

**Done when:** a test quote from the calculator lands in GoHighLevel with its estimate and source
tags; each form's notification arrives; the submit shows as `form_submit` in Zaraz's debugger.

## 5. Tags through Zaraz, with consent

Mike, in the zone → Zaraz (Cliff gives the ids from each ad account):

| Tool | Id needed | Triggers |
|---|---|---|
| Google Analytics 4 | measurement id `G-…` | Pageview; `form_submit` as an event |
| Google Ads | conversion id and label | `form_submit` as the conversion |
| Meta Pixel | pixel id | Pageview; `form_submit` as Lead |
| Reddit Pixel | pixel id | Pageview; `form_submit` as Lead |
| TikTok Pixel | pixel id | Pageview; `form_submit` as SubmitForm |

- Triggers: one custom trigger "form_submit": *Event Name* equals `form_submit` (the site calls
  `zaraz.track("form_submit", { form, page })`).
- Consent: Zaraz → Consent → enable; purposes "Analytics" (GA4) and "Advertising" (the other four);
  every tool assigned to its purpose so nothing fires before consent where consent is required. The
  footer's "Cookie settings" link opens the consent dialog.
- Another channel's tag is added the day B2 advertises there, not before.

**Done when:** each platform's test tool (Tag Assistant, Meta Events Manager test events, Reddit
Pixel Helper, TikTok Pixel Helper) shows page views and the submit conversion on the preview; with
consent declined, the browser holds no Meta, Reddit, TikTok or Google Ads cookies.

## 6. Privacy policy

*In the repo:* `src/pages/privacy-policy.html` is the rewritten draft (Cloudflare, GoHighLevel, the
four tags, Zaraz consent, SMS terms with no sharing of opt-in data). Its `needs Cliff` and
"needs a lawyer's read" flags show on the page until they are answered.

**Done when:** Cliff approves the text, ideally after a lawyer's read, and the effective date is set.

## 7. Switch-over

Before: Cliff checks EasyCart for open merch orders, takes the fresh export (step 2), and tells
McWilliams the date. Then Mike:

1. Pages project → Custom domains → add `b2motorsports.com` and `www.b2motorsports.com`
   (www redirects to the bare domain, or the reverse; one canonical, matching `site.json` →
   `baseUrl`, which is `https://b2motorsports.com`).
2. **Keep every other DNS record:** email (MX, SPF, DKIM, DMARC), `funnel.b2motorsports.com` (the
   GoHighLevel funnel pages, including the ad landing page), the CRM's sending domain, and any
   verification TXT records. Only the root and www records change.
3. SSL/TLS: Full (strict); Always Use HTTPS on.
4. Google Search Console: verify the domain (DNS TXT), submit `https://b2motorsports.com/sitemap.xml`.
   Bing Webmaster Tools: import from Search Console.

After: watch 404s for two weeks (Search Console's pages report and Cloudflare's analytics) and add a
line to `src/redirects.txt` for any old URL still being asked for. WordPress is exported, sanitized and
kept in b2-wp-tools; it must not answer on b2motorsports.com or on SiteGround's temporary domain, and
its admin accounts are closed when it retires, 30 days after the switch. The Cloudflare and registrar
accounts are in B2's name with two-factor login, and Mike is a user on them.

**Done when:** the live site is served by Pages, the 404 watch is clean, and WordPress is retired.
