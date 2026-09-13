// Re-anchor a split-spec's line ranges onto a NEW build of the same source.
//
// When a mirrored site redeploys, the bundled chunk is re-minified: the app is
// usually a point release, but every byte offset moves. The readable layer is
// keyed to line ranges in the *old* prettified file, so a refresh cannot just
// re-fetch — the sections have to be found again in the new file.
//
// This does that by content: for each section it takes the old file's line at
// the section boundary, then looks for that same line in the new file, scanning
// forward from the previous section so order is preserved. A boundary whose line
// genuinely changed is reported, not guessed at.
//
// usage:
//   node tools/reanchor-spec.mjs --old <old.pretty.js> --new <new.pretty.js> \
//     --spec <split-spec.json> [--write] [--source-note "<text>"]
//
//   --old-from-git <ref>:<path>   read the old file from git instead of disk
//                                 (when the working copy has been replaced)
//   --write                       rewrite the spec in place; default is a report
//
// Multi-source specs (a section names its own `sourceFile`) are handled by
// pointing --old/--new at one pair at a time and restricting the run:
//
//   --from-source <name>   only re-anchor sections whose sourceFile is <name>
//                          ("" matches sections with no sourceFile)
//   --retarget-to <name>   rewrite those sections' sourceFile to <name> — the
//                          refreshed mirror has new hashed filenames
//
// Exit code 1 if any boundary could not be anchored (so a script can gate on it).
import fs from "fs";
import { execFileSync } from "child_process";

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  if (i === -1) return d;
  // An explicitly empty value (--from-source "") is a value, not a bare flag:
  // it is how you select the sections that have no sourceFile at all.
  return i + 1 < args.length && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};
const WRITE = !!flag("write", false);

function readSource(spec) {
  const fromGit = flag("old-from-git");
  if (fromGit) {
    const [ref, ...rest] = String(fromGit).split(":");
    return execFileSync("git", ["show", `${ref}:${rest.join(":")}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  }
  if (!spec) throw new Error("--old is required (or use --old-from-git)");
  return fs.readFileSync(spec, "utf8");
}

const oldText = readSource(flag("old"));
const newPath = flag("new");
const specPath = flag("spec");
if (!newPath || !specPath) {
  console.error("usage: reanchor-spec.mjs --old <old> --new <new> --spec <spec.json> [--write]");
  process.exit(2);
}
const newText = fs.readFileSync(newPath, "utf8");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

const oldLines = oldText.split("\n");
const newLines = newText.split("\n");

// A boundary line is usually punctuation (`});`) and matches thousands of times,
// so position matters far more than content: search a window around where the
// line used to be and take the first match in it. Only widen when nothing
// matches, and treat a runaway delta as "needs attention" rather than a result.
const tokenOf = (line) => {
  const tokens = line.trim().match(/[A-Za-z_$][A-Za-z0-9_$]{11,}/g) || [];
  return tokens.sort((a, b) => b.length - a.length)[0] || null;
};

// Anchors for a boundary: the line itself plus a long identifier from the first
// few lines of the section, so a boundary whose own line was reformatted still
// resolves through the code that follows it.
function anchorCandidates(lines, idx) {
  const out = [];
  for (let k = 0; k < 5 && idx + k < lines.length; k++) {
    const t = lines[idx + k].trim();
    if (!t) continue;
    out.push({ kind: "line", value: t });
    const tok = tokenOf(lines[idx + k]);
    if (tok) out.push({ kind: "token", value: tok });
    if (out.length >= 8) break;
  }
  return out;
}

// expectedLine is 1-based in the old file. Take the match CLOSEST to where the
// line used to be, not the first one in the window: a boundary made of
// punctuation can match hundreds of lines early, and "first in window" silently
// reports that as a huge shift. `floor` keeps the result after the previous
// boundary so sections stay ordered.
function findNear(lines, idx, expectedLine, window, floor) {
  const cands = anchorCandidates(lines, idx);
  const expected0 = expectedLine - 1;
  for (const w of [window, window * 4, window * 20, Infinity]) {
    const lo = Math.max(floor == null ? 0 : floor, expected0 - w);
    const hi = Math.min(newLines.length - 1, expected0 + w);
    let best = -1;
    let bestD = Infinity;
    for (const cand of cands) {
      for (let i = lo; i <= hi; i++) {
        if (i < 0) continue;
        const line = newLines[i];
        const hit = cand.kind === "line" ? line.trim() === cand.value : line.includes(cand.value);
        if (!hit) continue;
        const d = Math.abs(i - expected0);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0 && bestD === 0) return best; // an exact position match wins
    }
    if (best >= 0) return best;
    if (!Number.isFinite(w)) break;
  }
  return -1;
}

// How far a boundary may slide before the match is treated as unreliable.
const WINDOW = Number(flag("window", 400));
// A boundary that moved further than this is a failed match, not an edit.
const MAX_DELTA = Number(flag("max-delta", 0)) || Math.max(200, Math.round(newLines.length * 0.02));

const FROM_SOURCE = flag("from-source", null);
const RETARGET = flag("retarget-to", null);
const inScope = (s) => {
  if (s.wholeFile || s.startLine == null) return false;
  if (FROM_SOURCE === null) return true;
  return String(s.sourceFile ?? "") === String(FROM_SOURCE);
};

const scoped = (spec.sections || []).filter(inScope);
// Last line that actually has content (both files end with a newline).
const lastContent = (ls) => (ls[ls.length - 1] === "" ? ls.length - 1 : ls.length);
const OLD_EOF = lastContent(oldLines);
const NEW_EOF = lastContent(newLines);

// Anchor the SEAMS, not the sections. The committed ranges tile the source
// exactly (section i starts where i-1 ended), so starts carry no independent
// information — anchoring them separately is what introduced gaps. Anchor each
// end, then let the next section begin one line after it.
const report = [];
let prevEnd = 0;
for (let i = 0; i < scoped.length; i++) {
  const s = scoped[i];
  let end = null;
  let note = null;
  let estimated = false;
  if (s.endLine >= OLD_EOF) {
    end = NEW_EOF; // a section that ran to EOF still runs to EOF
  } else {
    const ne = findNear(oldLines, s.endLine - 1, s.endLine, WINDOW, prevEnd);
    if (ne < 0) note = "seam not found";
    else {
      const cand = ne + 1;
      const shift = Math.abs(cand - s.endLine);
      if (shift > MAX_DELTA) note = `seam shift ${shift} exceeds guard ${MAX_DELTA}`;
      else if (cand <= prevEnd) note = `seam lands at ${cand}, at or before previous end ${prevEnd}`;
      else end = cand;
    }
  }
  if (end == null) {
    // Keep the tiling honest: scale the old seam by how much the file grew, and
    // flag it. A guessed seam that is reported beats a gap that is not.
    end = Math.min(NEW_EOF, Math.max(prevEnd + 1, Math.round((s.endLine / OLD_EOF) * NEW_EOF)));
    estimated = true;
  }
  report.push({
    file: s.file,
    old: [s.startLine, s.endLine],
    next: [prevEnd + 1, end],
    delta: 0,
    note,
    estimated,
  });
  prevEnd = end;
}

const unanchored = report.filter((r) => r.estimated).length;
for (const r of report) r.delta = r.next[0] - r.old[0];

const width = Math.max(...report.map((r) => r.file.length), 12);
for (const r of report) {
  const mark = r.estimated ? "ESTIMATED" : "ok";
  console.log(
    `  ${mark.padEnd(9)}   ${r.file.padEnd(width)}  ${r.old.join("-")} -> ${r.next.join("-")}  (${r.delta >= 0 ? "+" : ""}${r.delta})` +
      (r.estimated ? `  <-- ${r.note}` : ""),
  );
}
console.log(
  `\n${report.length} sections: ${report.length - unanchored} seams anchored, ${unanchored} estimated` +
    `${FROM_SOURCE !== null ? ` [source: ${FROM_SOURCE || "(default)"}]` : ""}` +
    `\nnew source: ${newLines.length} lines (old: ${oldLines.length})`,
);

if (WRITE) {
  for (const r of report) {
    const s = spec.sections.find((x) => x.file === r.file);
    s.startLine = r.next[0];
    s.endLine = r.next[1];
    if (RETARGET !== null) s.sourceFile = String(RETARGET);
  }
  const note = flag("source-note");
  if (note) spec.source = note;
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n");
  console.log(`wrote ${specPath}${note ? " (source note updated)" : ""}`);
}
// Exit 1 when a seam had to be estimated, so a caller can gate on it.
process.exit(unanchored ? 1 : 0);
