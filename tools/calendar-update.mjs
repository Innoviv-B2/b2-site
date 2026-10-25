// Bring the approved event feed into the site: src/data/events.json, which build.mjs renders as the
// race calendar, its Event schema and the next-events rail. The feed is b2-event-calendar's
// published/events.json (Cliff puts events on the website on the proposed-calendar page; its
// publish.py writes the feed). Nothing here edits an event; a wrong fact is fixed at the source.
//
//   node tools/calendar-update.mjs [feed.json]                  check the feed, write events.json, print the diff
//   node tools/calendar-update.mjs [feed.json] --branch         the same on a new branch events/<date>, built, checked, committed
//   node tools/calendar-update.mjs [feed.json] --branch --push  and push the branch: Cloudflare Pages builds its preview
//
// It never touches main: Cliff looks at the preview and merges, and the merge is the publish.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const FEED = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(ROOT, "..", "b2-event-calendar", "published", "events.json"));
const OUT = path.join(ROOT, "src", "data", "events.json");
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
const fail = (msg) => { console.error(msg); process.exit(1); };

/* ---------- the feed, checked ---------- */
if (!fs.existsSync(FEED)) fail(`no feed at ${FEED}; run publish.py in b2-event-calendar first`);
const feed = JSON.parse(fs.readFileSync(FEED, "utf8"));
const errs = [];
if (feed.version !== 1 || !Array.isArray(feed.events)) errs.push("not a version 1 event feed");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
for (const e of feed.events || []) {
  const who = `${e.start} ${e.title}`;
  if (!e.id || !e.title || !e.track) errs.push(`${who}: needs id, title and track`);
  if (!DAY.test(e.start || "") || !DAY.test(e.end || "") || e.end < e.start) errs.push(`${who}: dates must be YYYY-MM-DD, end on or after start`);
  if (!Array.isArray(e.types) || !e.types.length) errs.push(`${who}: no event types`);
  for (const r of e.registrations || []) if (r.registration_url && !/^https:\/\//.test(r.registration_url)) errs.push(`${who}: registration link is not https: ${r.registration_url}`);
  if (/—/.test(`${e.title} ${e.line}`)) errs.push(`${who}: an em dash in the name or line (published copy has none); change it on the proposed-calendar page`);
}
const ids = (feed.events || []).map((e) => e.id);
if (new Set(ids).size !== ids.length) errs.push("an event appears twice");
if (errs.length) fail("The feed has problems; nothing written:\n  " + errs.join("\n  "));

/* ---------- what changes on the site ---------- */
const before = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { events: [] };
const was = new Map(before.events.map((e) => [e.id, e]));
const now = new Map(feed.events.map((e) => [e.id, e]));
const links = (e) => [...new Set(e.registrations.map((r) => r.registration_url).filter(Boolean))].sort().join(" ");
const closes = (e) => e.registrations.map((r) => (r.reg_closes || "").slice(0, 10)).filter(Boolean).sort().join(" ");
const SHOWN = { title: (e) => e.title, line: (e) => e.line, dates: (e) => `${e.start}..${e.end}`, track: (e) => e.track,
  types: (e) => e.types.join(","), "register links": links, "registration closes": closes, "dates TBC": (e) => String(!!e.dates_estimated) };
const lines = [];
for (const [id, e] of now) {
  if (!was.has(id)) { lines.push(`  added    ${e.start}  ${e.title}, ${e.track}`); continue; }
  const d = Object.entries(SHOWN).filter(([, f]) => f(was.get(id)) !== f(e)).map(([k, f]) => `${k}: ${f(was.get(id)) || "none"} -> ${f(e) || "none"}`);
  if (d.length) lines.push(`  changed  ${e.start}  ${e.title}\n             ${d.join("\n             ")}`);
}
for (const [id, e] of was) if (!now.has(id)) lines.push(`  removed  ${e.start}  ${e.title}, ${e.track}${e.end < today ? " (ended)" : ""}`);
for (const e of feed.events) if (e.stale) lines.push(`  STALE    ${e.start}  ${e.title}: not in the latest calendar run; shown with its last facts`);
console.log(`Feed: ${feed.events.length} events, published ${feed.published} from the ${feed.run} run (${FEED})`);
console.log(lines.length ? lines.join("\n") : "  no change to the site's calendar");
const text = JSON.stringify(feed, null, 1) + "\n";
if (!flag("--branch")) {
  if (lines.length) fs.mkdirSync(path.dirname(OUT), { recursive: true }), fs.writeFileSync(OUT, text);
  console.log(lines.length ? `Wrote ${path.relative(ROOT, OUT)}. Build with node build.mjs to see it; --branch to put it on a branch for Cliff.` : "Nothing written.");
  process.exit(0);
}

/* ---------- a branch for Cliff's preview ---------- */
if (!lines.length) { console.log("Nothing to put on a branch."); process.exit(0); }
if (git("status", "--porcelain")) fail("The working tree has uncommitted changes; commit or stash them first, so the branch carries the calendar only.");
const start = git("rev-parse", "--abbrev-ref", "HEAD");
git("fetch", "origin", "main");
if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")) fail(`Start from main, up to date with origin/main (now on ${start}).`);
let branch = `events/${today}`;
for (let n = 2; git("branch", "--list", branch) || git("ls-remote", "--heads", "origin", branch); n++) branch = `events/${today}-${n}`;
git("checkout", "-b", branch);
try {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  // the same build Cloudflare runs, then the check; a page error stops the branch
  execFileSync(process.execPath, ["build.mjs"], { cwd: ROOT, stdio: "inherit" });
  const report = fs.readFileSync(path.join(ROOT, "docs", "reports", "build-check.md"), "utf8");
  const calErr = report.split(/\n(?=## )/).find((s) => /`calendar\.html`/.test(s.split("\n")[0]) && /\*\*ERROR\*\*/.test(s));
  if (calErr) throw new Error("The calendar page has build errors:\n" + calErr);
  git("checkout", "--", "docs");          // the build's reports are committed separately; keep this branch to the calendar
  git("add", path.relative(ROOT, OUT));
  const added = lines.filter((l) => l.startsWith("  added")).length, removed = lines.filter((l) => l.startsWith("  removed")).length;
  git("commit", "-m", `Calendar: ${feed.events.length} events from the ${feed.run} calendar run (${added} added, ${removed} removed, ${lines.length - added - removed} changed)\n\n${lines.join("\n")}`);
  console.log(`Committed on ${branch}.`);
  if (flag("--push")) {
    git("push", "-u", "origin", branch);
    const repo = git("remote", "get-url", "origin").replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
    console.log(`Pushed. Cloudflare Pages builds a preview of ${branch} (Pages project, Deployments).\nTo publish, merge it: ${repo}/compare/main...${branch}?expand=1`);
  } else console.log(`Not pushed. To push: git push -u origin ${branch}`);
} finally {
  git("checkout", start);
}
