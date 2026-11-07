// Keeps the photo notes out of the published site. build.mjs runs it at the end of every build; it also runs on
// its own, on dist/ or on any built folder:
//
//   node tools/check-assets.mjs              # checks dist/
//   node tools/check-assets.mjs <folder>     # checks <folder>, e.g. a scratch copy of dist/
//
// assets/ also holds files for the people who choose photos, not for visitors: assets/img/manifest.json and
// assets/img/README.md carry each photo's subject, source and release notes. The build copies assets/ into
// dist/assets/ without any .json or .md file (NOT_PUBLISHED), and this check fails, exit 1, if one is there all
// the same (B-02, 6 Nov 2026). It is kept apart from tools/security-gate.mjs, whose hash the Pages build checks.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const NOT_PUBLISHED = /\.(json|md)$/i;

// Every .json or .md file under <dist>/assets, as a path relative to <dist>.
export function assetLeaks(dist) {
  const assets = path.join(dist, "assets");
  if (!fs.existsSync(assets)) return [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  return walk(assets).filter((f) => NOT_PUBLISHED.test(f)).map((f) => path.relative(dist, f).split(path.sep).join("/"));
}

const self = fileURLToPath(import.meta.url);
const real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
if (process.argv[1] && real(process.argv[1]) === real(self)) {
  const dist = path.resolve(process.argv[2] || path.join(path.dirname(self), "..", "dist"));
  if (!fs.existsSync(dist)) { console.error(`check-assets: ${dist} not found; run node build.mjs first`); process.exit(1); }
  const leaks = assetLeaks(dist);
  if (leaks.length) {
    console.error(`check-assets: FAILED, ${leaks.length} file(s) under assets/ that are never published:\n${leaks.map((l) => "  " + l).join("\n")}`);
    process.exit(1);
  }
  console.log("check-assets: passed (no .json or .md file under assets/)");
}
