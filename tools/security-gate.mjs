// The security gate every deploy passes before it goes live. Runs on the built site in dist/, after build.mjs.
//
//   node build.mjs && node tools/security-gate.mjs            # fails (exit 1) on any finding
//   node tools/security-gate.mjs --launch                      # also fails on the build's audit defects and noindex
//
// Owned by TDS-IS (Mike). The Pages build command checks this file's hash before running it, so a change here
// stops deploys until TDS-IS reviews it and updates the hash. It checks, on every page and file in dist/:
//   1. _headers keeps the security headers on /* and the Content-Security-Policy is not loosened
//   2. every external script, frame and form target is on the approved list AND allowed by that policy
//   3. no credential or secret is published (keys, tokens, private keys, .env, server code)
//   4. nothing is served over http://
//   5. with --launch: no noindex reaches production (audit defects are stopped by `node build.mjs --strict`)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const LAUNCH = process.argv.includes("--launch");
const findings = [];
const fail = (file, msg) => findings.push(`${path.relative(ROOT, file) || file}: ${msg}`);

// Hosts the site may load code from, embed, or post forms to. Adding one is a TDS-IS review.
const APPROVED = {
  script: ["link.msgsndr.com", "*.msgsndr.com", "*.leadconnectorhq.com"],
  frame: ["api.leadconnectorhq.com", "*.leadconnectorhq.com", "link.msgsndr.com", "*.msgsndr.com",
    "www.youtube-nocookie.com", "www.google.com"],
  form: ["*.leadconnectorhq.com"],
};
const REQUIRED_HEADERS = ["strict-transport-security", "x-content-type-options", "referrer-policy",
  "permissions-policy", "content-security-policy"];

const SECRETS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/\b(sk|rk)_live_[0-9a-zA-Z]{20,}/, "Stripe live key"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, "GitHub token"],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\bpit-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/, "GoHighLevel private integration token"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "Google API key (allowed only if restricted; review)"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JWT / bearer token"],
  [/\b(api[_-]?key|secret|password|passwd|access[_-]?token)\s*[:=]\s*["'][^"'\s]{12,}["']/i, "hard-coded credential"],
];
const FORBIDDEN_FILES = /(^|\/)(\.env.*|.*\.php|\.git(\/|$)|.*\.sql|.*\.bak|.*\.pem|.*\.key|id_rsa.*|wp-config.*)$/i;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const hostMatch = (host, pattern) => pattern.startsWith("*.") ? host.endsWith(pattern.slice(1)) : host === pattern;
const allowed = (host, list) => list.some((p) => hostMatch(host, p));

if (!fs.existsSync(DIST)) { console.error("security-gate: dist/ not found; run node build.mjs first"); process.exit(1); }
const files = walk(DIST);

// 1. Headers and policy
const headersFile = path.join(DIST, "_headers");
const csp = {};
if (!fs.existsSync(headersFile)) fail(headersFile, "missing; the security headers are not served");
else {
  const block = fs.readFileSync(headersFile, "utf8").split(/\n(?=\S)/).find((b) => b.split("\n")[0].trim() === "/*") || "";
  const headers = Object.fromEntries(block.split("\n").slice(1).map((l) => l.trim()).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]));
  for (const h of REQUIRED_HEADERS) if (!headers[h]) fail(headersFile, `/* is missing ${h}`);
  if (headers["strict-transport-security"] && !/max-age=(\d+)/.test(headers["strict-transport-security"]))
    fail(headersFile, "Strict-Transport-Security has no max-age");
  else if (headers["strict-transport-security"] && Number(/max-age=(\d+)/.exec(headers["strict-transport-security"])[1]) < 15552000)
    fail(headersFile, "Strict-Transport-Security max-age is under 180 days");
  for (const d of (headers["content-security-policy"] || "").split(";").map((s) => s.trim()).filter(Boolean)) {
    const [name, ...vals] = d.split(/\s+/);
    csp[name] = vals;
  }
  const must = { "default-src": "'self'", "object-src": "'none'", "base-uri": "'self'", "frame-ancestors": "'self'" };
  for (const [d, v] of Object.entries(must)) if (!(csp[d] || []).includes(v)) fail(headersFile, `Content-Security-Policy must keep ${d} ${v}`);
  for (const [d, vals] of Object.entries(csp)) {
    if (vals.includes("*")) fail(headersFile, `Content-Security-Policy ${d} allows any host (*)`);
    if (d === "script-src" && vals.includes("'unsafe-eval'")) fail(headersFile, "Content-Security-Policy script-src allows 'unsafe-eval'");
    if (d === "script-src" && vals.some((v) => v === "https:" || v === "http:" || v === "data:")) fail(headersFile, `script-src allows a whole scheme (${vals.join(" ")})`);
  }
}
const cspAllows = (directive, host) => {
  const vals = csp[directive] || csp["default-src"] || [];
  return vals.some((v) => v === "https:" || hostMatch(host, v.replace(/^https?:\/\//, "").replace(/\/.*$/, "")));
};

// 2-5. Every published file
for (const f of files) {
  const rel = path.relative(DIST, f).split(path.sep).join("/");
  if (FORBIDDEN_FILES.test(rel)) fail(f, "a server, config or secret file is in the published site");
  if (!/\.(html|js|mjs|css|json|txt|xml|svg|webmanifest)$/i.test(f) && !rel.startsWith("_")) continue;
  const text = fs.readFileSync(f, "utf8");
  for (const [re, what] of SECRETS) if (re.test(text)) fail(f, `looks like a ${what} is published`);
  if (!/\.html$/i.test(f)) continue;

  for (const m of text.matchAll(/<(script|iframe|form)\b[^>]*?\b(src|action)\s*=\s*["']([^"']+)["']/gi)) {
    const [, tag, , url] = m;
    if (/^http:\/\//i.test(url)) { fail(f, `<${tag}> loads over http: ${url}`); continue; }
    if (!/^https:\/\//i.test(url)) continue;                        // same-origin
    const host = new URL(url).hostname;
    if (host === "b2motorsports.com" || host === "www.b2motorsports.com") continue;
    const kind = { script: "script", iframe: "frame", form: "form" }[tag.toLowerCase()];
    const directive = { script: "script-src", frame: "frame-src", form: "form-action" }[kind];
    if (!allowed(host, APPROVED[kind])) fail(f, `<${tag}> uses ${host}, which is not on the approved ${kind} list`);
    else if (!cspAllows(directive, host)) fail(f, `<${tag}> uses ${host}, which the Content-Security-Policy ${directive} blocks (it will not load)`);
  }
  for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["'](http:\/\/[^"']+)["']/gi)) fail(f, `insecure http:// link ${m[1]}`);
  // Pages that opt out in their own meta ("noindex": true, e.g. the privacy policy) are deliberate; the home page is not.
  if (LAUNCH && rel === "index.html" && /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(text))
    fail(f, "noindex on the home page would hide the site from Google at launch");
}

if (LAUNCH) {
  const robots = path.join(DIST, "robots.txt");
  if (fs.existsSync(robots) && /^\s*Disallow:\s*\/\s*$/im.test(fs.readFileSync(robots, "utf8"))) fail(robots, "blocks the whole site from search engines");
  // Only the *.pages.dev preview rules may carry X-Robots-Tag: noindex.
  const blocks = fs.existsSync(headersFile) ? fs.readFileSync(headersFile, "utf8").split(/\n(?=\S)/) : [];
  for (const blk of blocks) if (/x-robots-tag:\s*noindex/i.test(blk) && !/pages\.dev/.test(blk.split("\n")[0]))
    fail(headersFile, `${blk.split("\n")[0].trim()} sends noindex outside the pages.dev preview`);
}

const pages = files.filter((f) => f.endsWith(".html")).length;
if (findings.length) {
  console.error(`\nSecurity gate: FAILED, ${findings.length} finding(s) across ${files.length} files (${pages} pages). Nothing is deployed.\n`);
  for (const x of findings) console.error("  " + x);
  process.exit(1);
}
console.log(`Security gate: passed (${files.length} files, ${pages} pages${LAUNCH ? ", launch checks on" : ""}).`);
