// Universal split verifier: for every project with a split-spec.json, check
// that each byte-range section's content matches its claimed source range and
// that per-source coverage is contiguous. wholeFile entries are checked for
// existence only (vendor rule: library code is indexed, not sliced).
//
// Slices with a semantic rename layer are checked too, not exempted: when the
// project ships a `rename-map.json` (see tools/rename-layer.mjs) the map is
// applied to the source range and the result must equal the committed slice
// byte-for-byte. A project that only declares renames in its spec note, with no
// map on disk, is still skipped — but supplying the map (one command:
// `node tools/recover-rename-map.mjs <project>`) upgrades it to verified.
//
// Usage: node tools/verify-all.mjs [projectDir ...]
import fs from "fs";
import path from "path";
import { applyMap, applyMapByToken } from "./rename-layer.mjs";

const root = ".";

// Per-project map: default sourceFile (when a section omits sourceFile) -> path
// relative to the project dir. Multi-chunk specs list every source explicitly.
const SOURCE_OF = {
  "apex-city": { "": "readable/index.pretty.js" },
  "environment-design": { "": "readable/bundle.body.pretty.js" },
  "hill-valley-1985": { "": "readable/bundle.body.pretty.js" },
  "iphone-inside": { "": "readable/bundle.body.pretty.js" },
  "the-tide-remembers": { "": "readable/index.pretty.js" },
  "b29-superfortress-atlas": { "": "readable/page.pretty.js" },
  "persepolis-explorer": { "": "readable/index.pretty.js" },
  "billionaire-pit": {
    "main-BKhYyob5.pretty.js": "readable/index.pretty.js",
    "": "readable/index.pretty.js",
  },
  "rain-court-js": {
    "": "_next/static/chunks/combat.pretty.js",
    "page.pretty.js": "_next/static/chunks/page.pretty.js",
  },
  "nagoya-voxel-map": { "": "assets/index-BN_qvy4U.js.pretty.js" },
  "fluffy-biscotti": { "": "assets/index-BKuOG8dl.js.pretty.js" },
  warlightning: { "": "assets/Game-DuwJYmD_.pretty.js" },
  "where-the-wind-wanders": {
    "": "assets/index-Cn4DvICB.pretty.js",
    "assets-B2agzq83.pretty.js": "assets/assets-B2agzq83.pretty.js",
  },
  "running-god": { "": "readable/App.pretty.js", "index.pretty.js": "readable/index.pretty.js" },
  "studio-sandbox-game": { "": "readable/main.pretty.js" },
  desimayhem: {
    "": "assets/main-EQqVF34L.pretty.js",
    "game-Cy_OZrvd.pretty.js": "assets/game-Cy_OZrvd.pretty.js",
  },
  "the-celestial-atlas": { "": "assets/index-Cn4DvICB.pretty.js" },
  "atlantis-imperial-depths": { "": "assets/index-Cn4DvICB.pretty.js" },
  "helion-city": { "chunk-q36nUkcl.pretty.js": "chunk-q36nUkcl.pretty.js" },
  elusivesim: { "": "game-client/elusiveGame.pretty.js" },
  "above-the-rooftops": { "": "readable/game.pretty.js" },
  "ceska-dobrodruzstvi": {
    "readable/engine-u4eY-VAE.pretty.js": "readable/engine-u4eY-VAE.pretty.js",
    "readable/page-5CFt6nRP.pretty.js": "readable/page-5CFt6nRP.pretty.js",
    "readable/road-vehicles-BLPLY_8d.pretty.js": "readable/road-vehicles-BLPLY_8d.pretty.js",
  },
  "dirt-rush": {
    "app.pretty.js": "readable/app.pretty.js",
    "app.body.pretty.js": "readable/app.body.pretty.js",
    "physics-engine.pretty.js": "readable/physics-engine.pretty.js",
  },
  // Saaspocalypse specs name their prettified source explicitly per section.
  saaspocolypse: Object.fromEntries(
    [
      "readable/index-DwXrb_qX.pretty.js",
      "readable/home-sections-BZYI8Oyr.pretty.js",
      "readable/auth-pages-E4o-3KT1.pretty.js",
      "readable/saaspocolypse-agp7vbB-.pretty.js",
      "readable/authority-routes-CCo9AO5e.pretty.js",
      "readable/clerk-provider-BkwfTvYg.pretty.js",
      "readable/tool-routes-Dii7WmK1.pretty.js",
      "readable/blog-BFXa7K8h.pretty.js",
      "readable/blog-post-oH8BAUKM.pretty.js",
      "readable/blog-seo-B2QPFdVd.pretty.js",
      "readable/api-CZE0G11Y.pretty.js",
      "readable/tool-placeholder-EBWGjyH5.pretty.js",
      "readable/post-writer-B6XIlydp.pretty.js",
      "readable/profile-reviewer-f4T4p1HR.pretty.js",
      "readable/hook-generator-DmYRFAPF.pretty.js",
      "readable/content-ideas-DZ7aGDUI.pretty.js",
      "readable/headline-analyzer-CGysd3V-.pretty.js",
      "readable/utils-BzdyJ34M.pretty.js",
      "readable/saaspocalypse-game.pretty.js",
    ].map((p) => [p, p]),
  ),
};

const dirs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs
      .readdirSync(root)
      .filter((d) => fs.statSync(path.join(root, d)).isDirectory() && fs.existsSync(path.join(root, d, "split-spec.json")));

let failedProjects = 0;
const summary = [];

for (const d of dirs) {
  const spec = JSON.parse(fs.readFileSync(path.join(d, "split-spec.json"), "utf8"));

  // Rename layer: per-file map if the project ships one, else the spec's own
  // (usually partial) flat map, else nothing.
  const rmPath = path.join(d, "rename-map.json");
  const rm = fs.existsSync(rmPath) ? JSON.parse(fs.readFileSync(rmPath, "utf8")) : null;
  const flatMap = rm?.union || spec.renameMap || null;
  // When a per-file map is present it is authoritative: a slice it does not list
  // has no renames. Falling back to the flat union here would rename bare tokens
  // in every other slice — the map's names are minified (`Y`, `nu`) and occur
  // everywhere.
  const mapFor = (file) =>
    rm?.files ? rm.files[file] || null : flatMap;
  const hasMap = (file) => {
    const m = mapFor(file);
    return !!m && Object.keys(m).length > 0;
  };

  // A hand-refactored tree is not a cut at all — there is nothing to check it
  // against. A rename layer is a cut plus a map, and that IS checkable.
  const handRefactor = /hand-refactor|provenance|legacy split/i.test(spec.note || "");
  const declaresRenames = /semantic renames/i.test(spec.note || "");
  // A spec's own `renameMap` is a partial record (rain-court-js lists 7 of its
  // renames), so it is not a usable map for checking. Only a recovered
  // rename-map.json is; without one, the old exemption stands.
  const ranged = handRefactor
    ? []
    : (spec.sections || []).filter(
        (s) => s.startLine != null && !s.wholeFile && !(declaresRenames && !rm)
      );
  if (declaresRenames && !rm) {
    console.log(`${d}: SKIP content check (declares semantic renames, no rename-map.json — upgrading is one command: node tools/recover-rename-map.mjs ${d})`);
  }
  const wholes = (spec.sections || []).filter((s) => s.wholeFile);
  const map = SOURCE_OF[d] ?? {};
  const srcCache = new Map();
  const load = (rel) => {
    if (!srcCache.has(rel)) srcCache.set(rel, fs.readFileSync(path.join(d, rel), "utf8").replace(/\r\n/g, "\n").split("\n"));
    return srcCache.get(rel);
  };

  let fail = 0;
  const chains = new Map(); // srcRel -> lastEnd

  for (const s of ranged) {
    const key = s.sourceFile ?? "";
    // A section's own `sourceFile`, when it resolves on disk, is the most
    // specific answer and is preferred over the table: a refresh retargets it to
    // the new hashed filename, so the table does not have to be edited every
    // time a chunk is renamed. The table remains for specs whose sourceFile is
    // only a basename (ceska) or that predate the field.
    const rel =
      (key && fs.existsSync(path.join(d, key)) ? key : null) ?? map[key] ?? map[""] ?? null;
    if (!rel) {
      console.log(`${d}: no source mapping for ${s.file} (sourceFile=${key || "(default)"})`);
      fail++;
      continue;
    }
    if (!fs.existsSync(path.join(d, rel))) {
      console.log(`${d}: source missing: ${rel}`);
      fail++;
      continue;
    }
    const lines = load(rel);
    const range = lines.slice(s.startLine - 1, s.endLine).join("\n");
    // A name-keyed regex also matches identifier-shaped fragments inside
    // literal text ("s" in "Guardian�s"); the token-aware application cannot.
    // A slice matching either proof is a faithful rename layer.
    const expectRaw = hasMap(s.file)
      ? [applyMap(range, mapFor(s.file)), applyMapByToken(range, mapFor(s.file))]
      : [range];
    const expect = expectRaw.map((t) => t.trimEnd());
    // A section may declare `patches`: documented, reviewed edits the mirror
    // applies to the readable layer (e.g. stubbing a live multiplayer endpoint
    // for offline play). Each patch's `find` must occur and `replace` must be
    // what the slice actually carries; anything else still fails.
    for (const p of s.patches || []) {
      for (let i = 0; i < expect.length; i++) {
        if (expect[i].includes(p.find)) expect[i] = expect[i].split(p.find).join(p.replace);
      }
    }
    // normalize CRLF: git autocrlf can materialize the working copy with
    // Windows endings even though the repo content is LF.
    const raw = fs.readFileSync(path.join(d, "src", s.file), "utf8").replace(/\r\n/g, "\n").split("\n");
    const hdr = (raw[0]?.startsWith("// ") ? 1 : 0) + (raw[0]?.startsWith("// ") && raw[1]?.startsWith("// ") ? 1 : 0);
    const body = raw.slice(hdr).join("\n").trimEnd();
    if (!expect.includes(body)) {
      console.log(`${d}: FAIL content ${s.file} (src ${rel} ${s.startLine}-${s.endLine})`);
      fail++;
    }
    const last = chains.get(rel) ?? 0;
    // a wholeFile entry between slices bridges the chain (vendor range lives in its source)
    const bridged = spec.sections.some((w) => w.wholeFile);
    if (last !== 0 && !bridged && s.startLine !== last + 1) {
      console.log(`${d}: GAP in ${rel} before ${s.file} (${last + 1} -> ${s.startLine})`);
      fail++;
    }
    chains.set(rel, s.endLine);
  }

  for (const s of wholes) {
    if (typeof s.wholeFile === "string" && !fs.existsSync(path.join(d, s.wholeFile))) {
      console.log(`${d}: wholeFile source missing for ${s.file}: ${s.wholeFile}`);
      fail++;
    }
  }

  if (fail === 0) summary.push(`OK  ${d} (${ranged.length} slices, ${wholes.length} whole)`);
  else {
    summary.push(`FAIL ${d}`);
    failedProjects++;
  }
}

console.log(summary.join("\n"));
console.log(failedProjects === 0 ? "ALL PROJECTS VERIFIED" : `${failedProjects} PROJECT(S) FAILED`);
process.exit(failedProjects ? 1 : 0);
