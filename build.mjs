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

/* ---------- the race calendar: src/data/events.json is the one source of truth ----------
   The approved event feed from b2-event-calendar (Cliff puts events on the website on its proposed-calendar
   page; publish.py writes the feed; tools/calendar-update.mjs copies it here). Never edited by hand: a wrong
   fact is fixed at the source. It renders the calendar page's rows ({{CAL_ROWS}}) and its Event schema, and on
   other pages {{EVENTS_COUNT}} (events not finished that start in the next 12 months) and {{EVENTS_NEXT}} (rail rows, the first four shown).
   The calendar only ever shows dates still to come (Cliff, 25 Oct 2026): the build renders upcoming events only,
   and site.js drops whatever has passed since, because the site rebuilds only on a push. So every row and rail
   item carries its last day as data-end="YYYY-MM-DD", and the count carries every end date. The rows keep the
   headers and the Price it links the calculator's race-weekend picker parses, so the picker follows the calendar. */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtDay = (d) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;
const fmtRange = (s, e) => !e || e === s ? fmtDay(s) : s.slice(5, 7) === e.slice(5, 7) ? `${fmtDay(s)}–${+e.slice(8, 10)}` : `${fmtDay(s)}–${fmtDay(e)}`;
// The calendar's dates name their year (Cliff, 25 Oct 2026); its address, title and labels still don't
const fmtRangeY = (s, e) => !e || s.slice(0, 4) === e.slice(0, 4) ? `${fmtRange(s, e)}, ${s.slice(0, 4)}` : `${fmtDay(s)}, ${s.slice(0, 4)}–${fmtDay(e)}, ${e.slice(0, 4)}`;
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATE = { AL: "Alabama", AR: "Arkansas", FL: "Florida", GA: "Georgia", IL: "Illinois", IN: "Indiana", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", MD: "Maryland",
  MI: "Michigan", MO: "Missouri", MS: "Mississippi", NC: "North Carolina", NJ: "New Jersey", NY: "New York", OH: "Ohio", OK: "Oklahoma", PA: "Pennsylvania", SC: "South Carolina",
  TN: "Tennessee", TX: "Texas", VA: "Virginia", WI: "Wisconsin", WV: "West Virginia" };
const eventDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });   // B2's day, not the build server's
const dayN = (d) => Date.parse(d.slice(0, 10) + "T12:00:00Z") / 864e5;
const eventsFile = path.join(SRC, "data", "events.json");
const feed = fs.existsSync(eventsFile) ? JSON.parse(read(eventsFile)) : { events: [] };
const upcoming = feed.events.filter((e) => e.end >= eventDay).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
const calPage = pages.find((p) => p.meta.nav === "calendar" && p.meta.schema);
const RACE = ["race", "enduro", "time_trial", "CRE"];
const has = (e, ts) => e.types.some((t) => ts.includes(t));
const COLS = [["track_day", "test_day", "school"], ["time_trial"], ["race", "CRE"], ["enduro"]];   // Track Day, Time Trial, Road Race, Enduro
// Track time is B2's estimate model (the footnote): race weekends about 4 h over 8 sessions, track days 2 h over
// 4 sessions a day. The feed also carries each registration's published hours, but sources mean different things
// by them (a provider's whole day, SRF3's own sessions), so they stay out of the Price it links until they agree.
const trackTime = (e, days) => has(e, RACE) ? [4, 8] : [2 * Math.min(days, 3), 4 * Math.min(days, 3)];
function licenseCell(e) {
  const race = /SVRA/i.test(`${e.sanctioning_body} ${e.organizer}`) ? "SVRA or Comp" : "Comp";
  const open = ["track_day", "test_day", "school"].find((t) => e.types.includes(t));
  const openName = { track_day: "track day", test_day: "test day", school: "school" }[open];
  if (has(e, ["race", "enduro"])) return open ? `None (${openName}) &middot; ${race} (race)` : race;
  if (e.types.includes("CRE")) return "None (CRE)";
  if (e.types.includes("time_trial")) return open ? `None (${openName}) &middot; Time Trials (TT)` : "Time Trials";
  return "None";
}
function registerCell(e) {
  const NAME = { race: "Race", enduro: "Enduro", time_trial: "Time Trial", track_day: "Track day", test_day: "Test day", school: "School", CRE: "CRE" };
  const urls = new Map();
  for (const r of e.registrations) if (r.registration_url && !urls.has(r.registration_url)) urls.set(r.registration_url, r.event_type);
  const links = [...urls].map(([u, t]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${urls.size > 1 ? NAME[t] || "Link" : "Link"}</a>`);
  return `<td class="cal-register">${links.length ? links.join(" &middot; ") : `<a href="sms:${site.phoneTel}">Text us</a>`}${e.checked ? `<br><span>checked ${fmtDay(e.checked)}</span>` : ""}</td>`;
}
function calRow(e) {
  const days = dayN(e.end) - dayN(e.start) + 1, [hours, sessions] = trackTime(e, days);
  const closes = e.registrations.map((r) => (r.reg_closes || "").slice(0, 10)).filter((d) => d && d >= eventDay).sort()[0];
  const off = e.registrations.find((r) => ["cancelled", "postponed"].includes(r.status));
  const badges = [off ? off.status.toUpperCase() : "", closes && dayN(closes) - dayN(eventDay) <= 21 ? `REG CLOSES ${fmtDay(closes).toUpperCase()}` : "",
    !e.seeded && e.approved_at && dayN(eventDay) - dayN(e.approved_at) <= 21 ? "NEW" : ""].filter(Boolean).map((b) => ` <span class="est">${b}</span>`).join("");
  const sic = /SARRC Invitational|\bSIC\b/i.test(`${e.title} ${e.event_name}`) ? "&sup3;" : "";
  const ticks = COLS.map((ts, i) => {
    if (!has(e, ts)) return "<td></td>";
    const mark = i === 1 ? "&sup1;" : i === 0 && !e.types.includes("track_day") && has(e, RACE) ? "&sup2;" : i === 2 ? sic : "";
    return `<td class="cal-tick">&#10003;${mark}</td>`;
  }).join("");
  const q = new URLSearchParams({ event: e.title, track: e.track, date: fmtRangeY(e.start, e.end), days: String(days), hours: String(hours), sessions: String(sessions) });
  const at = `${esc(e.track)}${e.city ? ` (${esc(e.city)}, ${esc(e.state)})` : ""}${e.line ? ` &middot; ${esc(e.line)}` : ""}`;
  // data-types and data-state drive the page's filter (site.js); data-license is the lowest bar to get on track that weekend
  const lic = e.types.some((t) => ["track_day", "test_day", "school", "CRE"].includes(t)) ? "none" : e.types.includes("time_trial") ? "tt" : "comp";
  return `          <tr data-end="${e.end}" data-types="${e.types.join(" ")}" data-license="${lic}" data-state="${esc(e.state || "")}">
            <td><b><time datetime="${e.start}">${fmtRangeY(e.start, e.end).replace("–", "&ndash;")}</time></b>${days === 1 ? ` (${DOW[new Date(e.start + "T12:00:00Z").getUTCDay()]})` : ""}${e.dates_estimated ? `<br><span class="cal-register"><span>dates TBC</span></span>` : ""}</td>
            <td class="cal-event">${esc(e.title)}<br><span class="cal-at">${at}</span>${badges}</td>
            ${ticks}
            <td class="cal-time">${hours} h &middot; ${sessions} sessions<br><a href="/rental-pricing-calculator/?${esc(q.toString())}#quote">Price it</a></td>
            <td>${licenseCell(e)}</td>
            ${registerCell(e)}
          </tr>`;
}
if (calPage) {
  const url = site.baseUrl + calPage.meta.path;
  // a month row heads each month's events (one cell, so the calculator's picker skips it); site.js hides it with its rows
  const monthRow = (ym) => `          <tr class="cal-month"><td colspan="9"><time datetime="${ym}">${MONTH[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}</time></td></tr>`;
  calPage.body = calPage.body.replace("{{CAL_ROWS}}", upcoming.map((e, i) => (i && upcoming[i - 1].start.slice(0, 7) === e.start.slice(0, 7) ? "" : monthRow(e.start.slice(0, 7)) + "\n") + calRow(e)).join("\n"))
    .replace("{{CAL_STATES}}", [...new Set(upcoming.map((e) => e.state).filter(Boolean))].sort((a, b) => (STATE[a] || a).localeCompare(STATE[b] || b))
      .map((s) => `<option value="${esc(s)}">${esc(STATE[s] || s)}</option>`).join(""));
  if (!upcoming.length) calPage.body = calPage.body.replace(/ data-upcoming-empty hidden/, " data-upcoming-empty");
  calPage.meta.schema[0].itemListElement = upcoming.map((e, i) => ({ "@type": "ListItem", position: i + 1, item: {
    "@type": "Event", name: `${e.title} at ${e.track}`, startDate: e.start, endDate: e.end,
    eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: e.track, ...(e.city ? { address: { "@type": "PostalAddress", addressLocality: e.city, addressRegion: e.state, addressCountry: "US" } } : {}) },
    ...(e.organizer ? { organizer: { "@type": "Organization", name: e.organizer } } : {}), url } }));
}
// Every calendar track must be one the calculator knows, or its Price it link opens with no transport price.
// The match is the calculator's own (distinctive words of name + alias), and the state must agree. A new track
// is added with tools/add-track.mjs (README §Adding a track); until then the calendar page fails the check.
const calcPage = pages.find((p) => p.meta.file === "rental-pricing-calculator.html");
const STOP = new Set("international intl raceway speedway park motorsports motorsport motor racing complex the of and at circuit".split(" "));
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((w) => w.length > 1 && !STOP.has(w));
const calcTracks = calcPage ? [...calcPage.body.matchAll(/\{ name:"([^"]+)"[^}]*?alias:"([^"]*)"/g)].map(([, n, a]) => ({ name: n.replace(/\\u2014/g, "—"), alias: a })) : [];
const calTrackErrs = [];
for (const t of [...new Set(upcoming.map((e) => e.track))]) {
  const hay = new Set(words(t));
  let best = null, score = 0;
  for (const c of calcTracks) { const s = [...new Set([...words(c.name.split("—")[0]), ...words(c.alias)])].filter((w) => hay.has(w)).length; if (s > score) { score = s; best = c; } }
  const state = (upcoming.find((e) => e.track === t) || {}).state;
  if (!best) calTrackErrs.push(`"${t}" is on the calendar but not in the calculator's track list: add it with node tools/add-track.mjs "${t}" (README, Adding a track)`);
  else if (state && !best.name.endsWith(" " + state)) calTrackErrs.push(`"${t}" (${state}) matches the calculator's "${best.name}", a different state: add the real track with tools/add-track.mjs`);
}
const eventRow = (e, i) => `<li data-end="${e.end}"${i >= 4 ? " hidden" : ""}><span class="rail__t">${fmtRange(e.start, e.end)}</span><p><b>${esc(e.title)}</b>, ${esc(e.track)}</p></li>`;
// The home page counts the events in the next 12 months (Cliff, 25 Oct 2026): not finished, and starting within a
// year of today. The span carries every event as start/end so site.js can recount the same way between builds.
const yearOut = `${+eventDay.slice(0, 4) + 1}${eventDay.slice(4)}`;
const countHtml = `<span data-upcoming-count="${upcoming.map((e) => `${e.start}/${e.end}`).join(" ")}">${upcoming.filter((e) => e.start < yearOut).length}</span>`;
for (const p of pages) p.body = p.body.replace(/{{EVENTS_COUNT}}/g, countHtml).replace(/{{EVENTS_NEXT}}/g, upcoming.map(eventRow).join("\n        "));
// The privacy policy's effective date is the go-live date, set once in site.json on launch day.
for (const p of pages) p.body = p.body.replace(/{{PRIVACY_EFFECTIVE}}/g, site.privacyEffective || "[set at launch]");
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
const optional = (p) => fs.existsSync(p) ? read(p) : "";
const themeInit = optional(path.join(SRC, "js", "theme-init.js")).trim();   // inlined in <head> so the first paint has the right theme
const themeJs = optional(path.join(SRC, "js", "theme.js"));
const redirects = optional(path.join(SRC, "redirects.txt"));                // Cloudflare Pages _redirects syntax
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
${themeInit ? `<script>${themeInit}</script>` : ""}
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
const CONFIG_JS = `<script>window.B2_CONFIG=${JSON.stringify({ consentText: site.consentText, email: site.email, phoneDisplay: site.phoneDisplay })};</script>`;

/* ---------- GoHighLevel forms ----------
   A page writes {{GHL_FORM:<key>}}; the key maps to a form id in site.json → ghl.forms. The live build
   embeds the form; the review build shows a placeholder (frames from the CRM do not load in the artifact).
   The call-or-text line under every form is the fallback if the embed does not load. */
function ghlEmbed(key, review) {
  const id = site.ghl.forms[key];
  if (!id) throw new Error(`unknown GoHighLevel form "${key}" (add it to site.json → ghl.forms)`);
  const email = /^(storage|member)/.test(key) ? site.storageEmail : site.email;
  const fallback = `<p class="form__fallback">Form not loading? Call or text <a href="tel:${site.phoneTel}">${site.phoneDisplay}</a> or email <a href="mailto:${email}">${email}</a>.</p>`;
  if (review) return `<div class="ghl-embed ghl-embed--review"><p class="mono">The GoHighLevel form “${key}” loads here on the live site.</p>${fallback}</div>`;
  return `<div class="ghl-embed"><iframe src="${site.ghl.formBase}${id}" id="inline-${id}" data-layout="{'id':'INLINE'}" data-trigger-type="alwaysShow" data-trigger-value="" data-activation-type="alwaysActivated" data-activation-value="" data-deactivation-type="neverDeactivate" data-deactivation-value="" data-form-name="${key}" data-layout-iframe-id="inline-${id}" data-form-id="${id}" data-b2-form="${key}" title="${key.replace(/-/g, " ")} form"></iframe>${fallback}</div>`;
}
/* A booking calendar is the same idea: {{GHL_CAL:<key>}}, the key maps to the calendar's slug in
   site.json → ghl.calendars. The storage tour is booked straight on the calendar (Cliff, 25 Oct 2026). */
function ghlCalendar(key, review) {
  const slug = site.ghl.calendars[key];
  if (!slug) throw new Error(`unknown GoHighLevel calendar "${key}" (add it to site.json → ghl.calendars)`);
  const url = site.ghl.calendarBase + slug;
  const email = /^(storage|member)/.test(key) ? site.storageEmail : site.email;
  const fallback = `<p class="form__fallback">Calendar not loading? <a href="${url}" target="_blank" rel="noopener">Open it in a new tab</a>, call or text <a href="tel:${site.phoneTel}">${site.phoneDisplay}</a> or email <a href="mailto:${email}">${email}</a>.</p>`;
  if (review) return `<div class="ghl-embed ghl-embed--review"><p class="mono">The GoHighLevel calendar “${key}” loads here on the live site.</p>${fallback}</div>`;
  return `<div class="ghl-embed ghl-embed--calendar"><iframe src="${url}" id="${slug}_cal" scrolling="no" data-b2-form="${key}" title="${key.replace(/-/g, " ")} calendar"></iframe>${fallback}</div>`;
}
const withForms = (body, review) => body
  .replace(/{{GHL_FORM:([a-z0-9-]+)}}/g, (_, k) => ghlEmbed(k, review))
  .replace(/{{GHL_CAL:([a-z0-9-]+)}}/g, (_, k) => ghlCalendar(k, review));
const usesGhl = (body) => /{{GHL_(FORM|CAL):|leadconnectorhq\.com\/widget\/(form|bookings?)\//.test(body);

/* ---------- checks ---------- */
const FORBIDDEN = [
  [/256-692-3996/, "old phone number"], [/2820 15th/i, "office address (site shows the shop: 2919A Bob Wallace Ave)"],
  [/mcwilliamsmarketing/i, "agency email"], [/dollars per (smile|Smile|mile)\b/, "tagline must read 'dollars per sMile'"],
  [/staging2|\/race-simulator\//i, "dead link"], [/\/20\d\d-race-calendar/i, "calendar link with a year in it (the calendar has no year)"], [/#833CA3/i, "old purple; use #7C2FF0"],
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
  if (meta.nav === "calendar") {
    errs.push(...calTrackErrs);
    // the calendar shows only the dates still to come, so nothing on it, or in a menu that names it, says a year;
    // only its dates do, each inside a <time> element (Cliff, 25 Oct 2026)
    const labels = [...site.nav.flatMap((n) => [n, ...(n.children || [])]).filter((n) => n.href === meta.path).map((n) => n.label),
      ...[...site.footer.race, ...site.footer.more].filter(([, h]) => h === meta.path).map(([l]) => l)];
    const undated = body.replace(/<time\b[^>]*>[^<]*<\/time>/g, " ").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
    const named = [undated, meta.title, meta.description, meta.navLabel, meta.keyphrase, JSON.stringify(meta.breadcrumb), meta.schema[0].name, ...labels].join(" ");
    if (/\b20\d\d\b/.test(named)) errs.push("the calendar or a menu link to it names a year");
  }
  const internal = (body.match(/href="\/(?!assets)/g) || []).length;
  if (internal < 3 && !meta.noindex) warns.push(`only ${internal} internal links`);
  return { errs, warns, words, h1, imgs: (body.match(/<img\b/g) || []).length, internal };
}

/* ---------- Cloudflare Pages: headers, crawlers, llms.txt ---------- */
// Hosts the pages load from: GoHighLevel's forms and embed script, YouTube's privacy-enhanced player,
// Google Maps (the calendar's track map and the contact page's shop map), Google Fonts. Zaraz is
// served from this origin (/cdn-cgi/zaraz/), so 'self' covers it.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://link.msgsndr.com https://*.msgsndr.com https://*.leadconnectorhq.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "frame-src https://api.leadconnectorhq.com https://*.leadconnectorhq.com https://link.msgsndr.com https://*.msgsndr.com https://www.youtube-nocookie.com https://www.google.com",
  "connect-src 'self' https:",
  "form-action 'self' https://*.leadconnectorhq.com",
  "frame-ancestors 'self'", "base-uri 'self'", "object-src 'none'", "upgrade-insecure-requests"
].join("; ");
const HEADERS = `/*
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: ${CSP}

/assets/img/*
  Cache-Control: public, max-age=604800

# The *.pages.dev addresses are previews and never indexed; only b2motorsports.com is.
https://:project.pages.dev/*
  X-Robots-Tag: noindex
https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex
`;
// Search and AI answer engines are welcome (plan §Direction 25 Oct: "optimized for SEO AI").
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "Amazonbot", "Meta-ExternalAgent", "Bytespider"];
function robotsTxt() {
  return `User-agent: *\nAllow: /\n\n# AI search and answer engines\n${AI_CRAWLERS.map((b) => `User-agent: ${b}`).join("\n")}\nAllow: /\n\nSitemap: ${site.baseUrl}/sitemap.xml\n`;
}
function llmsTxt() {
  const line = (p) => `- [${p.meta.navLabel || p.meta.title.split("|")[0].trim()}](${site.baseUrl}${p.meta.path}): ${p.meta.description}`;
  const live = pages.filter((p) => !p.meta.noindex);
  const groups = [["Race With Us", (p) => p.meta.nav === "race" || p.meta.nav === "calendar"], ["Storage and DIY Garage", (p) => p.meta.nav === "storage"],
    ["Blog", (p) => /^post-|^blog/.test(p.meta.file)], ["About and contact", () => true]];
  const seen = new Set(), out = [];
  for (const [h, test] of groups) {
    const rows = live.filter((p) => p.meta.path !== "/" && !seen.has(p) && test(p));
    rows.forEach((p) => seen.add(p));
    if (rows.length) out.push(`## ${h}\n\n${rows.map(line).join("\n")}`);
  }
  const home = pages.find((p) => p.meta.path === "/");
  return `# ${site.name}\n\n> ${home ? home.meta.description : site.tagline}\n\n${site.legalName}, ${site.address.street}, ${site.address.city}, ${site.address.region} ${site.address.postal}. Call or text ${site.phoneDisplay}; ${site.email} (storage: ${site.storageEmail}). ${site.hours}. Prices on these pages are B2's published rates; the calculator gives a line-item estimate.\n\n${out.join("\n\n")}\n`;
}

/* ---------- the built site, scanned for the 25 Oct audit's defects (slice 1 "done when") ---------- */
const DIST_FORBIDDEN = [
  [/256-692-3996|2566923996/, "old phone number"], [/2820 15th/i, "office address"], [/staging/i, "staging reference"],
  [/\b(src|href)="http:\/\//i, "http:// asset or link"], [/debug\s*:\s*true/, "debug logging on"],
  [/crewLeadPerHour|60,?000\s*\/\s*2,?080|1\.15\s*[–-]\s*1\.50|\bmargin(Range|Low|High|Min|Max|Pct)\b|margin range/i, "internal cost model in the source"],
  [/hsforms|hubspot/i, "HubSpot leftovers (forms are GoHighLevel's)"], [/<!--\s*CLIFF/i, "internal note in the output"]
];
const OTHER_TEL = ["+18007702055"];   // SCCA's member line, linked on Paths Into Racing; every other phone link is B2's
const openNotes = (s) => (s.match(/class="note"/g) || []).length;   // needs-Cliff flags still on a page; they ship if left
function scanDist(DIST) {
  const found = [], notes = [];
  const walk = (d) => fs.readdirSync(d).forEach((f) => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== "img") walk(p); return; }
    if (!/\.(html|js|txt)$/.test(f) && f !== "_headers" && f !== "_redirects") return;
    const s = read(p), rel = path.relative(DIST, p).replace(/\\/g, "/");
    for (const [re, why] of DIST_FORBIDDEN) if (re.test(s)) found.push(`${rel}: ${why}`);
    for (const m of s.matchAll(/href="tel:([^"]*)"/g)) if (m[1] !== site.phoneTel && !OTHER_TEL.includes(m[1])) found.push(`${rel}: phone link tel:${m[1]}`);
    if (openNotes(s)) notes.push(`${rel} (${openNotes(s)})`);
  });
  walk(DIST);
  if (!site.privacyEffective) found.push("privacy-policy/index.html: effective date not set (site.json → privacyEffective, on launch day)");
  return { found, notes };
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
${withForms(body, false).replace(/<!--[\s\S]*?-->\n?/g, "")}
</main>
${fill(footerTpl)}
${CONFIG_JS}
<script src="/assets/site.js" defer></script>
${themeJs ? `<script src="/assets/theme.js" defer></script>` : ""}
${usesGhl(body) && !/form_embed\.js/.test(body) ? `<script src="${site.ghl.embedScript}" defer></script>` : ""}
${site.ghl.trackingId ? `<script src="${site.ghl.trackingScript}" data-tracking-id="${site.ghl.trackingId}" defer></script>` : ""}
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
  if (themeJs) fs.writeFileSync(path.join(DIST, "assets", "theme.js"), themeJs);
  fs.writeFileSync(path.join(DIST, "robots.txt"), robotsTxt());
  fs.writeFileSync(path.join(DIST, "llms.txt"), llmsTxt());
  fs.writeFileSync(path.join(DIST, "_headers"), HEADERS);
  if (redirects) fs.writeFileSync(path.join(DIST, "_redirects"), redirects);
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
${rel(withForms(p.body, true))}
</main>
</section>`;
  }).join("\n");
  const picker = pages.map((p) => `<option value="${p.meta.path}">${esc(p.meta.navLabel || p.meta.title.split("|")[0].trim())}</option>`).join("");
  return `<title>B2 Motorsports Site Draft</title>
${themeInit ? `<script>${themeInit}</script>` : ""}
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
${themeJs ? `<script>\n${themeJs}\n</script>` : ""}
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
    var q = raw.indexOf("?");            // the calendar's "Price it" links carry ?event=… for the calculator
    if (q >= 0) raw = raw.slice(0, q);
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
// Every needs-Cliff flag still on a page, in one list: each one ships visibly until it is resolved.
const noteLines = [`# Open notes — ${today}`, "", "Each `<span class=\"note\">` below shows on the live page until it is answered and removed.", ""];
let noteCount = 0;
for (const p of pages) {
  const ns = [...p.body.matchAll(/<span class="note">([\s\S]*?)<\/span>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  if (!ns.length) continue;
  noteCount += ns.length;
  noteLines.push(`## ${p.meta.path} — \`${p.meta.file}\``, ...ns.map((n) => `- ${n}`), "");
}
noteLines.splice(3, 0, `**${noteCount} notes on ${noteLines.filter((l) => l.startsWith("## ")).length} pages.**`, "");
fs.writeFileSync(path.join(ROOT, "docs", "reports", "open-notes.md"), noteLines.join("\n") + "\n");
console.log(lines.join("\n"));
if (!CHECK_ONLY) {
  const dist = buildDist();
  const { found: defects, notes } = scanDist(dist);
  console.log(defects.length ? `\nBuilt site: ${defects.length} audit defects\n${defects.map((d) => "  " + d).join("\n")}` : "\nBuilt site: no audit defects");
  console.log(notes.length ? `Needs-Cliff notes that would ship: ${notes.join(", ")}` : "No needs-Cliff notes left.");
  errCount += defects.length;
  fs.mkdirSync(path.join(ROOT, "review"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "review", "index.html"), reviewHtml(reports));
  copyDir(path.join(ROOT, "assets", "img"), path.join(ROOT, "review", "assets", "img")); // so the review file also works locally
  console.log(`\nWrote ${dist} (${pages.length} pages) and review/index.html`);
}
if (errCount && args.has("--strict")) process.exit(1);
