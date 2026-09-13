// refresh.mjs — rebuild the readable layer after `node tools/update.mjs --pull`.
//
// Fully standalone: the engine is vendored in tools/engine/. Probes the exact
// formatter that reproduces the committed pretty file, re-anchors
// split-spec.json onto the new build, re-cuts src/, verifies byte-exact.
// Project-specific hooks (skip-lists, extra verification) go HERE.
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(here);

let engine = path.join(here, "engine", "refresh.mjs");
if (!fs.existsSync(engine)) {
  engine = path.join(project, "..", "tools", "shared", "refresh.mjs");
}
if (!fs.existsSync(engine)) {
  console.error("engine not found: tools/engine/refresh.mjs (and no sibling checkout)");
  process.exit(2);
}

const r = spawnSync(process.execPath, [engine, path.basename(project), ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: path.dirname(project), // the engine resolves the project dir from its cwd
});
process.exit(r.status ?? 1);
