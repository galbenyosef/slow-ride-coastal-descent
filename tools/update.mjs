// update.mjs — check this project's mirror against the live site.
//
// Thin wrapper over the shared conditional-GET engine, so the project stays
// self-contained: clone this repo anywhere and run `node tools/update.mjs`.
// Extra behavior goes HERE (or in this project's tools/), not in the shared
// engine — per-project probe lists, cookie headers, or post-check hooks all
// belong in this file.
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

// The shared engine lives in ../tools/shared next to the workspace checkout.
// If this repo is cloned standalone, set SHARED_ENGINE below to an absolute
// path (or a git submodule URL) — the wrapper is the only place to change.
const SHARED_ENGINE = path.join(project, "..", "tools", "shared", "update.mjs");

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
