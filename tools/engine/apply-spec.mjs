// Regenerate a project's src/ slices from its split-spec.
//
// The per-project splitters (split-<project>.mjs) each hard-code a seam table.
// Once reanchor-spec.mjs has moved the spec's line ranges onto a new build, the
// slices can just be re-cut from the spec — no seam table to maintain, and the
// vendor rule is respected: a section with `wholeFile` is indexed whole and gets
// no src/ slice.
//
// usage:
//   node tools/apply-spec.mjs <projectDir> [--spec split-spec.json] \
//     [--source readable/index.pretty.js] [--src src] [--dry-run]
//
// A section that names its own `sourceFile` is cut from that file; --source is
// the fallback for sections that do not. `sourceFile` values are real paths
// relative to the project (the reanchor step retargets them when a chunk's
// hashed filename changes).
//
// Each slice is written as `// <title>\n// <desc>\n<body>\n`, matching the
// per-project splitters so verify-all.mjs sees the same thing.
//
// --rename-map <file> re-applies the readable-name layer after cutting, so a
// refreshed slice keeps the names its predecessors had. The map is applied the
// way the historical pass applied it (word boundaries over raw text), which is
// what makes the result verifiable: `recover-rename-map.mjs` must reproduce the
// slice from the source range plus the map. A map entry that leaks into string
// or template *text* is reported by the verifier as a literal rewrite — treat any
// of those as a defect to fix rather than accept.
import fs from "fs";
import path from "path";
import { applyMap } from "./rename-layer.mjs";

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};
const projectDir = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
if (!projectDir) {
  console.error("usage: apply-spec.mjs <projectDir> [--spec ...] [--source ...] [--src ...]");
  process.exit(2);
}

const specPath = path.join(projectDir, String(flag("spec", "split-spec.json")));
const sourceRel = String(flag("source", "readable/index.pretty.js"));
const srcDir = path.join(projectDir, String(flag("src", "src")));
const DRY = !!flag("dry-run", false);

const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

// Rename layer: only an *explicit* --rename-map is applied. A spec's own
// `renameMap` is deliberately NOT used: it is a historical, partial record whose
// keys belong to the build it was made from, so re-applying it to a refreshed
// source silently relabels unrelated symbols (and the verifier, which checks the
// same map, cannot see it).
const renameMapFile = flag("rename-map", null);
let renameFiles = null;
let renameFlat = null;
if (typeof renameMapFile === "string") {
  const rm = JSON.parse(fs.readFileSync(renameMapFile, "utf8"));
  renameFiles = rm.files || null;
  renameFlat = rm.union || null;
}
const mapFor = (file) => (renameFiles ? renameFiles[file] || null : renameFlat);
const lineCache = new Map();
function linesOf(rel) {
  if (!lineCache.has(rel)) lineCache.set(rel, fs.readFileSync(path.join(projectDir, rel), "utf8").split("\n"));
  return lineCache.get(rel);
}

let written = 0;
let whole = 0;
let skippedMissing = 0;
for (const s of spec.sections || []) {
  if (s.wholeFile) {
    whole++;
    continue;
  }
  if (s.startLine == null || s.endLine == null) {
    console.log(`  SKIP  ${s.file} (no range)`);
    skippedMissing++;
    continue;
  }
  const rel = s.sourceFile ? String(s.sourceFile) : sourceRel;
  if (!fs.existsSync(path.join(projectDir, rel))) {
    console.log(`  SKIP  ${s.file} (source missing: ${rel})`);
    skippedMissing++;
    continue;
  }
  const sourceLines = linesOf(rel);
  if (s.endLine > sourceLines.length) {
    console.log(`  SKIP  ${s.file} (endLine ${s.endLine} past EOF of ${rel}: ${sourceLines.length})`);
    skippedMissing++;
    continue;
  }
  let body = sourceLines.slice(s.startLine - 1, s.endLine).join("\n");
  const rm = mapFor(s.file);
  if (rm && Object.keys(rm).length) body = applyMap(body, rm);
  const header = `// ${s.title || s.file}\n${s.desc ? `// ${s.desc}\n` : ""}`;
  const out = path.join(srcDir, s.file);
  if (!DRY) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${header}${body}\n`);
  }
  written++;
}
console.log(
  `${path.relative(process.cwd(), specPath)}: ${written} slices rewritten from ${sourceRel} (+ per-section sourceFile),` +
    ` ${whole} vendor whole-file section(s) untouched${skippedMissing ? `, ${skippedMissing} skipped` : ""}` +
    `${DRY ? " (dry run)" : ""}`,
);
process.exit(skippedMissing ? 1 : 0);
