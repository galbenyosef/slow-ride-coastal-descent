// update.mjs — check this project's mirror against the live site.
//
// Fully standalone: the refresh/update engine is vendored in tools/engine/,
// so this repo works after cloning anywhere — no sibling checkout needed.
// Extra behavior (probe lists, cookie headers, post-check hooks) goes HERE,
// not in the engine.
//
// usage:
//   node tools/update.mjs          # check (fast, cached)
//   node tools/update.mjs --pull   # also download changed files
//   node tools/update.mjs --reset  # ignore the probe cache once
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(here); // project root is one level up

// Prefer the vendored engine; fall back to a sibling workspace checkout.
let engine = path.join(here, "engine", "update.mjs");
if (!fs.existsSync(engine)) {
  engine = path.join(project, "..", "tools", "shared", "update.mjs");
}
if (!fs.existsSync(engine)) {
  console.error("engine not found: tools/engine/update.mjs (and no sibling checkout)");
  process.exit(2);
}

const r = spawnSync(process.execPath, [engine, path.basename(project), ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: path.dirname(project), // the engine resolves the project dir from its cwd
});
process.exit(r.status ?? 1);
