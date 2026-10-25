// Add a track the calendar run has found to the calculator's track list, so its Price it link prices transport.
//
//   node tools/add-track.mjs "<track>" --lat 35.352 --lng -80.683 [--reg SE] [--label "Charlotte Motor Speedway (Roval)"] [--write]
//
// <track> is the name b2-event-calendar's data/tracks.json uses (the calendar's own name for it). The line takes
// the city and state from there, and miles = 2 x its one-way miles from the shop, which must be a measured road
// route (basis "osrm-route …" or "2026-workbook"); an estimate is refused, because the calculator prices transport
// from these miles and a guessed distance would be a guessed quote. lat/lng are the track's own coordinates;
// --reg is the SCCA division (SE, NE, North, South, Mid-States, West, SE/NE), or "club". Prints the line and where
// it goes (the list is nearest-first); --write puts it there. Adding a track changes quotes: Cliff OKs it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CALC = path.join(ROOT, "src", "pages", "rental-pricing-calculator.html");
const TRACKS = path.join(ROOT, "..", "b2-event-calendar", "data", "tracks.json");
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const fail = (m) => { console.error(m); process.exit(1); };
const name = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && argv[i - 1] !== "--write"));
if (!name) fail('usage: node tools/add-track.mjs "<track>" --lat <n> --lng <n> [--reg SE] [--label "..."] [--write]');

const tracks = JSON.parse(fs.readFileSync(TRACKS, "utf8")).tracks;
const key = Object.keys(tracks).find((k) => k.toLowerCase() === name.toLowerCase() || tracks[k].aliases.some((a) => a.toLowerCase() === name.toLowerCase()));
if (!key) fail(`"${name}" is not in ${TRACKS}. The calendar run adds a track there first (its name, aliases, city, state, and the road route from the shop).`);
const t = tracks[key];
if (!/route|workbook/i.test(t.basis || "")) fail(`${key}: its miles are "${t.basis}", not a measured road route. Measure the route from 2919A Bob Wallace Ave and update tracks.json first.`);
const lat = Number(opt("--lat")), lng = Number(opt("--lng"));
if (!isFinite(lat) || !isFinite(lng)) fail("--lat and --lng (the track's coordinates) are required; the Maps proxy uses them for door-to-door miles");

const src = fs.readFileSync(CALC, "utf8");
const lines = src.split("\n");
const rows = lines.map((l, i) => ({ i, m: l.match(/^\s*\{ name:"([^"]+)".*?miles:(\d+)/) })).filter((r) => r.m);
const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((w) => w.length > 3);
const already = rows.find((r) => words(key).every((w) => r.m[1].toLowerCase().includes(w)));
if (already) fail(`Already in the calculator: ${lines[already.i].trim()}`);

const miles = 2 * t.miles;
const label = opt("--label") || key;
const alias = [...new Set([...words(key), ...t.aliases.flatMap((a) => a.toLowerCase().split(/\s+/)), t.city.toLowerCase()])].join(" ");
const nameField = `name:"${label} \\u2014 ${t.city} ${t.state}",`;
const line = `    { ${nameField.padEnd(57)} reg:${JSON.stringify(opt("--reg") || "club")},${" ".repeat(Math.max(1, 5 - (opt("--reg") || "club").length))}lat:${lat.toFixed(3)}, lng:${lng.toFixed(3)}, miles:${String(miles) + ",".padEnd(1)} alias:"${alias}", src:"road" },   // 2 x ${t.miles} mi road route (b2-event-calendar tracks.json, ${t.basis})`;
const after = [...rows].reverse().find((r) => +r.m[2] <= miles);
const at = after ? after.i + 1 : rows[0].i;
console.log(line);
console.log(`goes ${after ? "after: " + lines[after.i].trim().slice(0, 70) + "…" : "first in the list"}`);
if (!argv.includes("--write")) { console.log("Not written; add --write to put it in the calculator."); process.exit(0); }
lines.splice(at, 0, line);
fs.writeFileSync(CALC, lines.join("\n"));
console.log(`Written to ${path.relative(ROOT, CALC)}. Build, check the calendar page passes, and price one weekend there before committing.`);
