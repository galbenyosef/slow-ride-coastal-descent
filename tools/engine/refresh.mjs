// refresh.mjs — one-command mirror refresh after `update.mjs --pull`.
//
// A redeployed bundle invalidates the readable layer: the src/ slices are line
// ranges into the OLD prettified file. This tool closes the loop for a project:
//
//   1. find pulled-but-uncommitted bundles that split-spec sections anchor to;
//   2. prettify each new bundle into readable/<name>.pretty.js;
//   3. reanchor-spec.mjs to move the spec's line ranges onto the new file
//      (old file read from git HEAD; gated: any estimated seam aborts);
//   4. apply-spec.mjs to re-cut src/ from the re-anchored spec;
//   5. verify-all for the project (byte-exact check).
//
// usage:
//   node tools/shared/refresh.mjs <project>            # full loop
//   node tools/shared/refresh.mjs <project> --dry-run  # report only
//
// Exit 0 = refreshed & verified (or nothing to do), 1 = needs manual attention.
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const project = args.find((a) => !a.startsWith("--"));
if (!project) {
  console.error("usage: refresh.mjs <project> [--dry-run]");
  process.exit(2);
}

const dir = path.join(".", project);
const node = (script, a, cwd = ".") =>
  execFileSync(process.execPath, [path.join(here, script), ...a], {
    encoding: "utf8", maxBuffer: 512 * 1024 * 1024, cwd,
  });
const git = (a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

// Discover the formatter command that reproduces `committedPretty` from
// `rawSource` byte-for-byte, then run it over `text`. Returns { out, matched }.
function prettify(text, rawSource, committedPretty) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pretty-")), "in.js");
  fs.writeFileSync(tmp, text);
  try {
    // Formatter discovery is not guesswork: probe-pretty-config.mjs renders
    // `rawSource` with a range of formatter invocations and reports the one
    // that reproduces `committedPretty` byte-for-byte (js-beautify for most
    // projects, a specific prettier version/width for the rest). The probe
    // is slow (minutes), so cache the discovered signature per project in
    // .upstream/formatter.txt — invalidated when the pretty file changes hash.
    const cacheKey = path.join(dir, ".upstream", "formatter.txt");
    // Hash the COMMITTED pretty (git HEAD), never the working file: the caller
    // overwrites the working copy before this runs, so a working-file hash is
    // sequence-dependent and would miss the cache every other run.
    const prettyHash = crypto.createHash("sha256").update(git(["show", `HEAD:${path.relative(dir, committedPretty).replace(/\\/g, "/")}`])).digest("hex").slice(0, 16);
    const cached = fs.existsSync(cacheKey) ? fs.readFileSync(cacheKey, "utf8").trim().split(/\s+/) : null;
    if (cached && cached[0] === prettyHash && cached.length > 1) {
      const sig = cached.slice(1).join(" ").trim();
      const cmd = `npx --yes ${sig} ${tmp}`;
      const out = execFileSync("cmd", ["/c", cmd], {
        encoding: "utf8", maxBuffer: 512 * 1024 * 1024,
      });
      return { out, matched: true };
    }
    const probe = execFileSync(
      process.execPath,
      [path.join(here, "probe-pretty-config.mjs"), rawSource, committedPretty],
      { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
    );
    const m = probe.match(/^MATCH\s+(.+)$/m);
    if (m) {
      // The probe's MATCH line is the bare formatter invocation (no path):
      // "js-beautify --type js" or "prettier@X --parser Y --print-width Z".
      const sig = m[1].trim().replace(/^working copy:\s*/, "");
      if (!/^(js-beautify|prettier@)\S*/.test(sig)) {
        throw new Error(`unrecognized formatter signature: ${sig}`);
      }
      fs.mkdirSync(path.dirname(cacheKey), { recursive: true });
      fs.writeFileSync(cacheKey, `${prettyHash} ${sig}\n`); // hash of HEAD pretty (stable across runs)
      const cmd = `npx --yes ${sig} ${tmp}`; // cmd /c handles spaced paths; no inner quotes
      const out = execFileSync("cmd", ["/c", cmd], {
        encoding: "utf8", maxBuffer: 512 * 1024 * 1024,
      });
      return { out, matched: true };
    }
    // No exact match (the committed pretty may predate a config change) —
    // fall back to js-beautify, the dominant formatter in this workspace.
    console.log("  (no formatter match probed — falling back to js-beautify)");
    const out = execFileSync("cmd", ["/c", "npx", "--yes", "js-beautify", "--type", "js", tmp], {
      encoding: "utf8", maxBuffer: 512 * 1024 * 1024,
    });
    return { out, matched: false };
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

const prettyName = (bundleFile) => path.basename(bundleFile).replace(/\.js$/, "") + ".pretty.js";

// --- what changed? -----------------------------------------------------------
let dirty;
try {
  // NOTE: no .trim() — it would eat the leading status byte of the first line.
  dirty = git(["status", "--porcelain"]).replace(/\n$/, "");
} catch {
  console.error(`${project}: not a git repo`);
  process.exit(1);
}
if (!dirty) {
  console.log(`${project}: working tree clean — nothing was pulled`);
  process.exit(0);
}
// Porcelain: XY<space>path (also "?? path"), so the path is always offset 3.
const changedFiles = dirty.split("\n").map((l) => l.slice(3).replace(/\r$/, "")).filter(Boolean);

// --- which changed files does the spec anchor to? ----------------------------
const specPath = path.join(dir, "split-spec.json");
if (!fs.existsSync(specPath)) {
  console.log(`${project}: no split-spec.json — nothing to re-anchor`);
  process.exit(0);
}
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

// Map every sourceFile the spec names -> list of sections (default-source
// sections carry no sourceFile; they follow --source, default readable/index).
const DEFAULT_SOURCE = "readable/index.pretty.js";
const sectionsBySource = new Map();
for (const s of spec.sections || []) {
  if (s.wholeFile || s.startLine == null) continue;
  const src = s.sourceFile ?? DEFAULT_SOURCE;
  if (!sectionsBySource.has(src)) sectionsBySource.set(src, []);
  sectionsBySource.get(src).push(s);
}

// A spec source names a prettified file; the raw upstream bundle backing it
// comes from the spec's `source` note ("prettified chunk: assets/index-X.js ->
// readable/index.pretty.js") when present, else from the pretty-name stem.
const mf = JSON.parse(fs.readFileSync(path.join(dir, ".upstream", "manifest.json"), "utf8"));
const noteMatch = (spec.source ?? "").match(/([A-Za-z0-9_./-]+\.js)\s*->/);
const defaultRaw = noteMatch ? noteMatch[1] : null;
const targets = [];
for (const [src, secs] of sectionsBySource) {
  let raw;
  if (src === DEFAULT_SOURCE) {
    raw = defaultRaw;
  } else {
    const rawRel = src.replace(/^readable\//, "").replace(/\.pretty\.js$/, ".js");
    raw = fs.existsSync(path.join(dir, rawRel)) ? rawRel : null;
  }
  if (!raw) continue;
  if (!changedFiles.includes(raw)) continue;
  targets.push({ src, raw, secs });
}

if (!targets.length) {
  console.log(`${project}: pulled files touch no spec-anchored source — no re-anchor needed`);
  process.exit(0);
}

console.log(`${project}: re-anchoring ${targets.length} refreshed source(s)`);

for (const t of targets) {
  const prettyAbs = path.join(dir, t.src);
  const rawAbs = path.join(dir, t.raw);

  // 1. old pretty text from git HEAD (the working copy is being replaced).
  let oldText;
  try {
    oldText = git(["show", `HEAD:${t.src}`]);
  } catch {
    console.error(`  ${t.src} has no committed version — cannot re-anchor; refresh manually`);
    process.exit(1);
  }

  // 2. prettify the new raw bundle into the readable path. The formatter is
  //    discovered by probing the COMMITTED raw against the COMMITTED pretty —
  //    that pair must reproduce byte-for-byte — then applied to the new raw.
  if (!DRY) {
    const committedRaw = path.join(dir, ".probe-raw.tmp");
    // Materialize the HEAD blob with the working-copy EOL convention: the
    // original pretty was rendered from the CRLF working copy, and js-beautify
    // output tracks input line endings, so an LF probe input never matches.
    const eol = fs.existsSync(rawAbs) && fs.readFileSync(rawAbs).includes(Buffer.from("\r\n")) ? "\r\n" : "\n";
    fs.writeFileSync(committedRaw, git(["show", `HEAD:${t.raw}`]).replace(/\r?\n/g, eol));
    const { out } = prettify(fs.readFileSync(rawAbs, "utf8"), committedRaw, prettyAbs);
    fs.writeFileSync(prettyAbs, out);
    fs.rmSync(committedRaw, { force: true });
    console.log(`  prettified ${t.raw} -> ${t.src} (${t.secs.length} sections)`);
  }

  // 3. re-anchor the spec onto the new file. Any estimated seam aborts: a
  // guessed range produces an unverifiable slice, and silent drift is worse
  // than a loud stop. Run from the project dir so reanchor's own
  // `--old-from-git` (git show) resolves against the project repo.
  // `--from-source ""` selects default-source sections (no sourceFile).
  const out = node(
    "reanchor-spec.mjs",
    [
      "--old-from-git", `HEAD:${t.src}`,
      "--new", t.src,
      "--spec", "split-spec.json",
      t.src === DEFAULT_SOURCE ? "--from-source" : "--from-source", t.src === DEFAULT_SOURCE ? "" : t.src,
      ...(DRY ? [] : ["--write"]),
    ],
    dir,
  );
  const last = out.split("\n").filter(Boolean).slice(-2).join("\n");
  console.log(last.split("\n").map((l) => "  " + l).join("\n"));
  if (out.includes("estimated") && !/0 estimated/.test(out)) {
    console.error(`  ${t.raw}: seams could not all be anchored — manual attention needed`);
    process.exit(1);
  }
}

// 4. re-cut src/ from the re-anchored spec.
if (!DRY) {
  const out = node("apply-spec.mjs", [project]);
  console.log("  " + out.split("\n").filter(Boolean).slice(-1)[0]);
} else {
  console.log("  (dry-run: apply-spec skipped)");
}

// 5. verify byte-exactness.
const vOut = node("verify-all.mjs", [project]);
const ok = vOut.includes(`OK  ${project}`);
console.log(vOut.split("\n").filter((l) => l.includes(project)).join("\n"));
console.log(DRY ? `${project}: dry-run complete` : ok ? `${project}: refreshed & verified` : `${project}: VERIFICATION FAILED`);
process.exit(ok ? 0 : 1);
