// refresh.mjs — rebuild the readable layer after `node tools/update.mjs --pull`.
//
// Per-project wrapper over the shared refresh engine. Same contract as the
// shared one: probe the exact formatter that reproduces the committed pretty
// file, re-anchor split-spec.json onto the new build, re-cut src/, verify
// byte-exact. Customize here (extra sections, skip-lists, project-specific
// verification) — never in the shared engine.
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(here);
const SHARED_ENGINE = path.join(project, "..", "tools", "shared", "refresh.mjs");

if (!fs.existsSync(SHARED_ENGINE)) {
  console.error(`shared engine not found at ${SHARED_ENGINE}`);
  console.error("clone the astra-mirror-tools checkout as a sibling directory, or edit SHARED_ENGINE here");
  process.exit(2);
}

const r = spawnSync(process.execPath, [SHARED_ENGINE, path.basename(project), ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: path.dirname(project), // the engine resolves the project dir from its cwd
});
process.exit(r.status ?? 1);
