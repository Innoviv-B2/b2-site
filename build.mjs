#!/usr/bin/env node
/* B2 Motorsports static site builder.
   node build.mjs          → dist/ (multi-page static site) + review/index.html (single-file review build)
   node build.mjs --check  → validate pages only, write docs/reports/build-check.md
   No dependencies. Node 18+. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "src");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site.json"), "utf8"));
const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has("--check");
const today = new Date().toISOString().slice(0, 10);
const YEAR = String(new Date().getFullYear());

const read = (p) => fs.readFileSync(p, "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- pages ---------- */
function parsePage(file) {
  const raw = read(file);
  const m = raw.match(/^\s*<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error(`${path.basename(file)}: missing <!--meta {...} --> block at top`);
  let meta;
  try { meta = JSON.parse(m[1]); } catch (e) { throw new Error(`${path.basename(file)}: meta JSON invalid — ${e.message}`); }
  const body = raw.slice(m[0].length).trim();
  meta.file = path.basename(file);
  if (!meta.path || !meta.title || !meta.description) throw new Error(`${meta.file}: meta needs path, title, description`);
  if (!meta.path.startsWith("/") || (!meta.path.endsWith("/") && !meta.path.endsWith(".html"))) throw new Error(`${meta.file}: path must start and end with /`);
  return { meta, body };
}
const pageFiles = fs.existsSync(path.join(SRC, "pages")) ? fs.readdirSync(path.join(SRC, "pages")).filter((f) => f.endsWith(".html")).sort() : [];
const pages = pageFiles.map((f) => parsePage(path.join(SRC, "pages", f)));

/* ---------- event feed: the calendar page's Event schema is the one source of truth ----------
   {{EVENTS_COUNT}} = events not yet finished as of the build date; {{EVENTS_NEXT}} = rail rows for the next four.
   Rebuilding the site refreshes both, so nothing on other pages goes stale when the calendar changes. */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (d) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;
const fmtRange = (s, e) => !e || e === s ? fmtDay(s) : s.slice(5, 7) === e.slice(5, 7) ? `${fmtDay(s)}–${+e.slice(8, 10)}` : `${fmtDay(s)}–${fmtDay(e)}`;
const calPage = pages.find((p) => p.meta.nav === "calendar" && p.meta.schema);
const upcoming = ((calPage && calPage.meta.schema[0].itemListElement) || []).map((x) => x.item)
  .filter((e) => (e.endDate || e.startDate) >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
const eventRow = (e) => { const [who, ...where] = e.name.split(" — "); return `<li><span class="rail__t">${fmtRange(e.startDate, e.endDate)}</span><p><b>${who}</b>${where.length ? ", " + where.join(" — ") : ""}</p></li>`; };
for (const p of pages) p.body = p.body.replace(/{{EVENTS_COUNT}}/g, String(upcoming.length)).replace(/{{EVENTS_NEXT}}/g, upcoming.slice(0, 4).map(eventRow).join("\n        "));
const knownPaths = new Set([...pages.map((p) => p.meta.path), ...(site.plannedPaths || [])]);
const nav = site.nav;
const orderKey = (p) => (p.meta.order ?? 500);
pages.sort((a, b) => orderKey(a) - orderKey(b) || a.meta.path.localeCompare(b.meta.path));

/* ---------- partials ---------- */
function fill(tpl, activeKey) {
  return tpl
    .replace("{{NAV}}", navHtml(activeKey))
    .replace("{{FOOT_RACE}}", site.footer.race.map(([l, h]) => `<li><a href="${h}">${l}</a></li>`).join(""))
    .replace("{{FOOT_MORE}}", site.footer.more.map(([l, h]) => `<li><a href="${h}">${l}</a></li>`).join(""))
    .replace(/{{PHONE_TEL}}/g, site.phoneTel).replace(/{{PHONE}}/g, site.phoneDisplay)
    .replace(/{{EMAIL}}/g, site.email).replace(/{{STORAGE_EMAIL}}/g, site.storageEmail)
    .replace(/{{ADDR_STREET}}/g, site.address.street).replace(/{{ADDR_CITY}}/g, site.address.city)
    .replace(/{{ADDR_REGION}}/g, site.address.region).replace(/{{ADDR_POSTAL}}/g, site.address.postal)
    .replace(/{{HOURS}}/g, site.hours).replace(/{{YEAR}}/g, YEAR);
}
function navHtml(activeKey) {
  return nav.map((item) => {
    const here = item.key === activeKey ? " nav__item--here" : "";
    if (!item.children) return `<div class="nav__item${here}"><a class="nav__link" href="${item.href}">${item.label}</a></div>`;
    return `<div class="nav__item nav__item--has-menu${here}" aria-expanded="false"><a class="nav__link" href="${item.href}">${item.label}<button class="caret" type="button" aria-label="Open ${item.menuName || item.label} menu">&#9662;</button></a><ul class="nav__menu">${item.children.map((c) => `<li><a href="${c.href}">${c.label}</a></li>`).join("")}</ul></div>`;
  }).join("\n      ");
}
const headerTpl = read(path.join(SRC, "partials", "header.html"));
const footerTpl = read(path.join(SRC, "partials", "footer.html"));
const css = read(path.join(SRC, "css", "site.css"));
const js = read(path.join(SRC, "js", "site.js"));
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira:ital,wght@0,400;0,600;0,800;1,800;1,900&family=Space+Mono:wght@400;700&display=swap">`;

/* ---------- SEO head ---------- */
function orgSchema() {
  return {
    "@context": "https://schema.org", "@type": ["LocalBusiness", "AutoRepair"], "@id": site.baseUrl + "/#org",
    name: site.name, legalName: site.legalName, url: site.baseUrl + "/", telephone: site.phoneTel, email: site.email,
    image: site.baseUrl + site.ogDefault, slogan: site.tagline,
    address: { "@type": "PostalAddress", streetAddress: site.address.street, addressLocality: site.address.city, addressRegion: site.address.region, postalCode: site.address.postal, addressCountry: site.address.country },
    geo: { "@type": "GeoCoordinates", latitude: site.address.lat, longitude: site.address.lng },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "17:00" }],
    areaServed: ["Alabama", "Georgia", "Tennessee", "Florida", "Southeast United States"],
    sameAs: Object.values(site.social || {})
  };
}
function breadcrumbSchema(meta) {
  const crumbs = [["Home", "/"], ...(meta.breadcrumb || [])];
  if (!meta.breadcrumb || meta.path === "/") return null;
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: site.baseUrl + href })) };
}
function headHtml(meta) {
  const url = site.baseUrl + meta.path;
  const og = site.baseUrl + (meta.ogImage || site.ogDefault);
  const schemas = [orgSchema(), breadcrumbSchema(meta), ...(Array.isArray(meta.schema) ? meta.schema : meta.schema ? [meta.schema] : [])].filter(Boolean);
  const webPage = { "@context": "https://schema.org", "@type": meta.pageType || "WebPage", "@id": url + "#webpage", url, name: meta.title, description: meta.description, isPartOf: { "@id": site.baseUrl + "/#website" }, about: { "@id": site.baseUrl + "/#org" }, inLanguage: "en-US", ...(meta.datePublished ? { datePublished: meta.datePublished } : {}), dateModified: today };
  schemas.push(webPage);
  if (meta.path === "/") schemas.push({ "@context": "https://schema.org", "@type": "WebSite", "@id": site.baseUrl + "/#website", url: site.baseUrl + "/", name: site.name, publisher: { "@id": site.baseUrl + "/#org" } });
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${meta.noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">
<meta name="theme-color" content="#0F0E13">
<meta property="og:type" content="${meta.ogType || "website"}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(meta.ogTitle || meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.ogTitle || meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
${FONTS}
<link rel="stylesheet" href="/assets/site.css">
${schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n")}`;
}
const CONFIG_JS = `<script>window.B2_CONFIG=${JSON.stringify({ hubspot: site.hubspot, consentText: site.consentText, email: site.email, phoneDisplay: site.phoneDisplay })};</script>`;

/* ---------- checks ---------- */
const FORBIDDEN = [
  [/256-692-3996/, "old phone number"], [/2820 15th/i, "office address (site shows the shop: 2919A Bob Wallace Ave)"],
  [/mcwilliamsmarketing/i, "agency email"], [/dollars per (smile|Smile|mile)\b/, "tagline must read 'dollars per sMile'"],
  [/staging2|\/race-simulator\//i, "dead link"], [/2025-race-calendar/i, "2025 calendar link"], [/#833CA3/i, "old purple; use #7C2FF0"],
  [/lorem ipsum/i, "placeholder text"], [/<html\b|<body\b|<head\b|<\/head>|<\/body>/i, "page fragments must not contain html/head/body"]
];
function checkPage(p) {
  const { meta, body } = p;
  const errs = [], warns = [];
  const text = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const words = text.trim().split(" ").filter(Boolean).length;
  const h1s = body.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) errs.push(`expected exactly one <h1>, found ${h1s.length}`);
  const h1 = (body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || ["", ""])[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (meta.title.length < 40 || meta.title.length > 70) warns.push(`title is ${meta.title.length} chars (aim 50–65)`);
  if (meta.description.length < 110 || meta.description.length > 160) warns.push(`description is ${meta.description.length} chars (aim 140–159)`);
  if (meta.keyphrase) {
    const k = meta.keyphrase.toLowerCase();
    const stem = k.split(" ").filter((w) => w.length > 3);
    const has = (s) => stem.every((w) => s.toLowerCase().includes(w));
    if (!has(meta.title)) warns.push(`keyphrase "${meta.keyphrase}" not in title`);
    if (!has(meta.description)) warns.push(`keyphrase not in description`);
    if (!has(h1)) warns.push(`keyphrase not in H1 ("${h1}")`);
    const occ = (text.toLowerCase().match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    if (occ === 0) warns.push(`keyphrase never appears verbatim in body`);
  } else if (!meta.noindex) warns.push("no keyphrase set");
  if (words < 250 && !meta.noindex) warns.push(`only ${words} words`);
  for (const m of body.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\balt=/.test(tag)) errs.push(`img without alt: ${tag.slice(0, 80)}`);
    const src = (tag.match(/\bsrc="([^"]+)"/) || [])[1];
    if (src && src.startsWith("/assets/img/") && !fs.existsSync(path.join(ROOT, src))) warns.push(`missing image ${src}`);
    if (!/\bloading=/.test(tag) && !/hero__img/.test(tag)) warns.push(`img without loading="lazy": ${src}`);
  }
  for (const m of body.matchAll(/\bhref="([^"]+)"/g)) {
    const h = m[1];
    if (h.startsWith("/") && !h.startsWith("/assets/") && !h.startsWith("/sitemap")) {
      const clean = h.split("#")[0].split("?")[0];
      if (clean && !knownPaths.has(clean)) errs.push(`internal link to unknown page ${h}`);
    }
  }
  for (const [re, why] of FORBIDDEN) {
    if (meta.allowOfficeAddress && /2820/.test(String(re))) continue; // privacy policy keeps the mailing address
    if (re.test(body)) errs.push(`forbidden: ${why} (${re})`);
  }
  if (/dollars per/i.test(body) && !/dollars per <b>sMile<\/b>|dollars per sMile/.test(body)) errs.push("tagline present but not spelled 'dollars per sMile'");
  const internal = (body.match(/href="\/(?!assets)/g) || []).length;
  if (internal < 3 && !meta.noindex) warns.push(`only ${internal} internal links`);
  return { errs, warns, words, h1, imgs: (body.match(/<img\b/g) || []).length, internal };
}

/* ---------- dist ---------- */
function pageHtml(p) {
  const { meta, body } = p;
  return `<!doctype html>
<html lang="en">
<head>
${headHtml(meta)}
</head>
<body>
${fill(headerTpl, meta.nav)}
<main id="main" class="pg pg-${meta.file.replace(/\.html$/, "")}">
${body}
</main>
${fill(footerTpl)}
${CONFIG_JS}
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}
function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const s = path.join(from, f), d = path.join(to, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
function buildDist() {
  const DIST = path.join(ROOT, "dist");
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, "assets"), { recursive: true });
  copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
  fs.writeFileSync(path.join(DIST, "assets", "site.css"), css);
  fs.writeFileSync(path.join(DIST, "assets", "site.js"), js);
  for (const p of pages) {
    const dir = path.join(DIST, p.meta.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), pageHtml(p));
  }
  const urls = pages.filter((p) => !p.meta.noindex).map((p) => `  <url><loc>${site.baseUrl}${p.meta.path}</loc><lastmod>${today}</lastmod><changefreq>${p.meta.changefreq || "monthly"}</changefreq><priority>${p.meta.priority ?? (p.meta.path === "/" ? "1.0" : "0.7")}</priority></url>`);
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`);
  fs.writeFileSync(path.join(DIST, "404.html"), pageHtml({ meta: { path: "/404.html", title: "Page not found | B2 Motorsports", description: "That page is not here. Try the menu, or call or text 256-910-0658.", noindex: true, file: "404.html" }, body: `<section class="sec"><div class="wrap wrap--narrow"><p class="eyebrow">404</p><h1>Off track.</h1><p class="lede" style="margin-top:18px">That page is not here. Try the menu, or <a href="/contact-us/">get in touch</a>.</p></div></section>` }));
  return DIST;
}

/* ---------- review build (single file, hash router) ---------- */
function reviewHtml(reports) {
  const rel = (html) => html
    .replace(/(href|src|poster)="\/assets\//g, '$1="assets/')
    .replace(/srcset="\/assets\//g, 'srcset="assets/').replace(/,\s*\/assets\//g, ', assets/')
    .replace(/url\((['"]?)\/assets\//g, "url($1assets/")
    .replace(/href="\/(?!assets\/|sitemap)/g, 'href="#/');
  const sections = pages.map((p, i) => {
    const r = reports[i];
    return `<section class="page" data-path="${p.meta.path}" data-nav="${p.meta.nav || ""}" data-title="${esc(p.meta.title)}" data-desc="${esc(p.meta.description)}" data-key="${esc(p.meta.keyphrase || "")}" data-h1="${esc(r.h1)}" data-words="${r.words}" data-imgs="${r.imgs}" data-links="${r.internal}" data-file="${p.meta.file}" data-issues="${esc([...r.errs.map((e) => "ERROR " + e), ...r.warns].join(" | "))}" hidden>
<main class="pg pg-${p.meta.file.replace(/\.html$/, "")}">
${rel(p.body)}
</main>
</section>`;
  }).join("\n");
  const picker = pages.map((p) => `<option value="${p.meta.path}">${esc(p.meta.navLabel || p.meta.title.split("|")[0].trim())}</option>`).join("");
  return `<title>B2 Motorsports Site Draft</title>
${FONTS}
<style>
${css}
/* ---- review chrome, not part of the site ---- */
body { background: var(--ink); }
.rv { position: sticky; top: 0; z-index: 60; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 8px 16px; background: #1D1C24; color: #E8E6EF; border-bottom: 1px solid #3A3946; font: 12px/1.4 var(--font-mono); }
.rv b { color: #FF8A3A; }
.rv select, .rv button { font: inherit; color: #E8E6EF; background: #2B2738; border: 1px solid #433D57; border-radius: 3px; padding: 5px 8px; cursor: pointer; }
.rv button[aria-pressed="true"] { background: #7C2FF0; border-color: #7C2FF0; }
.rv .sp { flex: 1; }
.rv .path { color: #9A97AB; }
.seo { display: none; background: #14131A; color: #CFC7E8; border-bottom: 1px solid #3A3946; padding: 12px 16px; font: 12px/1.6 var(--font-mono); }
.seo[data-open="true"] { display: grid; grid-template-columns: 140px 1fr; gap: 4px 16px; }
.seo dt { color: #9A97AB; text-transform: uppercase; letter-spacing: 1px; font-size: 10px; padding-top: 3px; }
.seo dd { margin: 0; word-break: break-word; }
.seo .ok { color: #A8FF1A; } .seo .warn { color: #E0A100; } .seo .bad { color: #FF6B5E; }
.hdr { top: 0; }
@media (max-width: 760px) { .rv .sp, .rv .path { display: none; } .seo[data-open="true"] { grid-template-columns: 1fr; } }
</style>

<div class="rv" role="toolbar" aria-label="Review controls">
  <span><b>B2 Motorsports</b> · standalone site draft · ${today}</span>
  <label>Page <select id="rv-pick" aria-label="Jump to page">${picker}</select></label>
  <button type="button" id="rv-seo" aria-pressed="false">SEO panel</button>
  <span class="sp"></span>
  <span class="path" id="rv-path"></span>
  <span class="path">select any text to comment</span>
</div>
<dl class="seo" id="seo" data-open="false"></dl>

${rel(fill(headerTpl, ""))}
<div id="pages">
${sections}
</div>
${rel(fill(footerTpl))}
${CONFIG_JS}
<script>window.B2_REVIEW = true;</script>
<script>
${js}
</script>
<script>
(function () {
  var pages = Array.prototype.slice.call(document.querySelectorAll(".page"));
  var pick = document.getElementById("rv-pick"), seoBtn = document.getElementById("rv-seo"), seo = document.getElementById("seo"), pathEl = document.getElementById("rv-path");
  function parse() {
    var h = location.hash || "#/";
    var raw = h.slice(1);
    var anchor = "";
    var i = raw.indexOf("#");
    if (i >= 0) { anchor = raw.slice(i + 1); raw = raw.slice(0, i); }
    if (!raw.startsWith("/")) raw = "/" + raw;
    if (!raw.endsWith("/")) raw += "/";
    return { path: raw, anchor: anchor };
  }
  function len(n, lo, hi) { return n < lo || n > hi ? "warn" : "ok"; }
  function show() {
    var r = parse();
    var page = pages.find(function (p) { return p.dataset.path === r.path; }) || pages[0];
    pages.forEach(function (p) { p.hidden = p !== page; });
    document.title = page.dataset.title + " · draft";
    pick.value = page.dataset.path;
    pathEl.textContent = "b2motorsports.com" + page.dataset.path + "  ·  src/pages/" + page.dataset.file;
    document.querySelectorAll(".nav__item").forEach(function (n) { n.classList.remove("nav__item--here"); });
    var hdr = document.getElementById("hdr"); if (hdr) { hdr.classList.remove("hdr--open"); var mb = hdr.querySelector("[data-menu]"); if (mb) { mb.setAttribute("aria-expanded", "false"); mb.textContent = "Menu"; } }
    document.querySelectorAll(".nav__item[aria-expanded='true']").forEach(function (o) { o.setAttribute("aria-expanded", "false"); });
    var navKey = page.dataset.nav;
    if (navKey) document.querySelectorAll(".nav__item").forEach(function (n) { var a = n.querySelector(".nav__link"); if (a && a.getAttribute("href") === "#" + keyHref(navKey)) n.classList.add("nav__item--here"); });
    var t = page.dataset.title.length, d = page.dataset.desc.length;
    var issues = page.dataset.issues ? page.dataset.issues.split(" | ") : [];
    seo.innerHTML = [
      ["URL", "<span class='ok'>" + page.dataset.path + "</span>"],
      ["Title (" + t + ")", "<span class='" + len(t, 40, 70) + "'>" + escapeHtml(page.dataset.title) + "</span>"],
      ["Meta (" + d + ")", "<span class='" + len(d, 110, 160) + "'>" + escapeHtml(page.dataset.desc) + "</span>"],
      ["Focus keyphrase", escapeHtml(page.dataset.key || "—")],
      ["H1", escapeHtml(page.dataset.h1)],
      ["Body", page.dataset.words + " words · " + page.dataset.imgs + " images · " + page.dataset.links + " internal links"],
      ["Build checks", issues.length ? issues.map(function (s) { return "<span class='" + (s.indexOf("ERROR") === 0 ? "bad" : "warn") + "'>" + escapeHtml(s) + "</span>"; }).join("<br>") : "<span class='ok'>clean</span>"]
    ].map(function (row) { return "<dt>" + row[0] + "</dt><dd>" + row[1] + "</dd>"; }).join("");
    if (r.anchor) { var el = page.querySelector("#" + CSS.escape(r.anchor)); if (el) { el.scrollIntoView(); return; } }
    window.scrollTo(0, 0);
  }
  function keyHref(key) { var map = ${JSON.stringify(Object.fromEntries(nav.map((n) => [n.key, n.href])))}; return map[key]; }
  function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  window.addEventListener("hashchange", show);
  pick.addEventListener("change", function () { location.hash = "#" + pick.value; });
  seoBtn.addEventListener("click", function () { var open = seo.dataset.open !== "true"; seo.dataset.open = String(open); seoBtn.setAttribute("aria-pressed", String(open)); });
  // in-page anchors inside the current page (href="#foo") keep working; router links look like href="#/path/"
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href^='#']"); if (!a) return;
    var h = a.getAttribute("href");
    if (h.length > 1 && h[1] !== "/") { e.preventDefault(); var cur = parse(); location.hash = "#" + cur.path + "#" + h.slice(1); }
  });
  show();
})();
</script>
`;
}

/* ---------- run ---------- */
const reports = pages.map(checkPage);
let errCount = 0, warnCount = 0;
const lines = [`# Build check — ${today}`, "", `${pages.length} pages.`, ""];
pages.forEach((p, i) => {
  const r = reports[i];
  errCount += r.errs.length; warnCount += r.warns.length;
  lines.push(`## ${p.meta.path} — \`${p.meta.file}\``, `- ${r.words} words · H1: "${r.h1}" · ${r.imgs} images · ${r.internal} internal links`);
  r.errs.forEach((e) => lines.push(`- **ERROR** ${e}`));
  r.warns.forEach((w) => lines.push(`- warn: ${w}`));
  lines.push("");
});
lines.push(`**${errCount} errors, ${warnCount} warnings.**`);
fs.mkdirSync(path.join(ROOT, "docs", "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs", "reports", "build-check.md"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
if (!CHECK_ONLY) {
  const dist = buildDist();
  fs.mkdirSync(path.join(ROOT, "review"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "review", "index.html"), reviewHtml(reports));
  copyDir(path.join(ROOT, "assets", "img"), path.join(ROOT, "review", "assets", "img")); // so the review file also works locally
  console.log(`\nWrote ${dist} (${pages.length} pages) and review/index.html`);
}
if (errCount && args.has("--strict")) process.exit(1);
