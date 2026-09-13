// Shared rename-layer logic: recover, apply and verify a semantic rename map.
//
// A "rename layer" is what turns a raw bundle region into a readable src/ slice.
// The pass that created them rewrote identifiers with a word-boundary map, so the
// relationship is exact and invertible:
//
//     committed slice  ==  source range with identifiers substituted
//
// Recovering the map is therefore mechanical: tokenize both sides (comments and
// whitespace dropped, string/template literals atomic) and require the
// *non-identifier* token streams to be identical. Identifiers then pair up
// positionally and every differing pair is a rename.
//
// This is deliberately not a heuristic. If the non-identifier streams disagree,
// the slice is not a rename of its source range and the recovery *fails* rather
// than inventing a plausible map — which is the difference between a verified
// readable layer and one that merely looks right.
//
// The map is recovered per file: the historical pass was not applied uniformly,
// so the same minified name can stay minified in one slice and be renamed in
// another. `toMap()` merges into a flat map for the many cases where the
// per-file distinction does not matter.
import fs from "fs";
import path from "path";

// ---- scanner ---------------------------------------------------------------
// Tokenize JS, dropping whitespace and comments. A string literal is one token.
// A *template* literal is split, because `${...}` holds real code: literal runs
// are emitted as `lit` and each substitution is tokenized recursively. That
// distinction matters — an identifier inside `${}` is legitimately renamed, while
// one in the literal *text* is not, and lumping a whole template into a single
// token conflates the two and hides real corruption.
const ID_START = /[A-Za-z_$]/;
const ID_PART = /[\w$]/;

/** Tokenize a whole source text. */
export function tokens(text) {
  const st = { i: 0, text, out: [] };
  scan(st, undefined);
  return st.out;
}

// Every token carries its source span (`s`..`e`) so a token stream can be
// rewritten back into text — which is how a rename is applied without touching
// literal text, and how an aligned token pair becomes a splice.
function emit(st, t, v, s, e) {
  st.out.push({ t, v, s, e: e === undefined ? s + v.length : e });
}

// Scan until end of input, or — when `stop` is set — until that closing token is
// reached (used for `${ ... }`, which ends at its matching `}`).
function scan(st, stop) {
  const { text } = st;
  const n = text.length;
  while (st.i < n) {
    const c = text[st.i];
    const start = st.i;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      st.i++;
      continue;
    }
    if (c === "/" && text[st.i + 1] === "/") {
      while (st.i < n && text[st.i] !== "\n") st.i++;
      continue;
    }
    if (c === "/" && text[st.i + 1] === "*") {
      st.i += 2;
      while (st.i < n && !(text[st.i] === "*" && text[st.i + 1] === "/")) st.i++;
      st.i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = st.i + 1;
      while (j < n) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === c) {
          j++;
          break;
        }
        j++;
      }
      emit(st, "lit", text.slice(st.i, j), start);
      st.i = j;
      continue;
    }
    if (c === "`") {
      scanTemplate(st);
      continue;
    }
    if (stop === "}" && c === "}") {
      st.i++;
      return;
    }
    if (ID_START.test(c)) {
      let j = st.i + 1;
      while (j < n && ID_PART.test(text[j])) j++;
      emit(st, "id", text.slice(st.i, j), start);
      st.i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = st.i + 1;
      while (j < n && /[\w.]/.test(text[j])) j++;
      emit(st, "num", text.slice(st.i, j), start);
      st.i = j;
      continue;
    }
    emit(st, "pun", c, start);
    st.i++;
  }
}

// `{` opens a brace group: recurse at no stop token so its `}` is emitted here.
// `${` opens a substitution: recurse with stop="}" so the brace is not emitted
// twice, then emit it ourselves.
function scanTemplate(st) {
  const { text } = st;
  const n = text.length;
  emit(st, "pun", "`", st.i);
  st.i++;
  let run = "";
  let runStart = st.i;
  const flush = () => {
    if (run) emit(st, "lit", run, runStart);
    run = "";
  };
  while (st.i < n) {
    const c = text[st.i];
    if (c === "\\") {
      if (!run) runStart = st.i;
      run += text.slice(st.i, st.i + 2);
      st.i += 2;
      continue;
    }
    if (c === "`") {
      flush();
      emit(st, "pun", "`", st.i);
      st.i++;
      return;
    }
    if (c === "$" && text[st.i + 1] === "{") {
      flush();
      emit(st, "pun", "${", st.i);
      st.i += 2;
      scan(st, "}");
      emit(st, "pun", "}", st.i - 1);
      runStart = st.i;
      continue;
    }
    if (!run) runStart = st.i;
    run += c;
    st.i++;
  }
  flush();
}

// ---- slice headers ---------------------------------------------------------
// The refactor prepended a `// title` comment header to each slice. It is not part
// of the source range, so verification and recovery both strip it.
export function stripHeader(committed) {
  const m = committed.match(/^(?:\/\/[^\n]*\n)+/);
  const body = m ? committed.slice(m[0].length) : committed;
  // Trailing blank lines are a slice-write artifact (some splitters emit a final
  // newline, some don't); they carry no code, so normalization is safe.
  return body.replace(/[\n\s]+$/, "");
}

// ---- source resolution -----------------------------------------------------
/**
 * Locate the prettified source for a spec section.
 * `spec.source` names the chunks it indexes; the first `*.pretty.js` in it is the
 * default for sections that do not name their own sourceFile.
 */
export function sourceResolver(dir, spec, { assetsDir = "assets" } = {}) {
  const defaultSource =
    (String(spec.source || "").match(/[\w.-]+\.pretty\.js/) || [])[0] || null;
  const cache = new Map();
  return (section) => {
    const rel = section.sourceFile || defaultSource;
    if (!rel) throw new Error(`no source for ${section.file}: no sourceFile and no *.pretty.js in spec.source`);
    if (cache.has(rel)) return cache.get(rel);
    const cands = [
      path.join(dir, assetsDir, rel),
      path.join(dir, rel),
      // Next.js mirrors keep prettified chunks under _next/static/chunks.
      path.join(dir, "_next/static/chunks", rel),
      path.join(dir, "_next/static/chunks", path.basename(rel)),
      path.join(dir, "readable", path.basename(rel)),
      path.join(dir, path.basename(rel)),
    ];
    const hit = cands.find((c) => fs.existsSync(c));
    if (!hit) throw new Error(`source not found for ${section.file}: ${rel}`);
    const lines = fs.readFileSync(hit, "utf8").split(/\r?\n/);
    cache.set(rel, lines);
    return lines;
  };
}

/** The raw text of a section's source range (with the trailing newline). */
export function rangeText(prettyFor, section) {
  return prettyFor(section).slice(section.startLine - 1, section.endLine).join("\n") + "\n";
}

// ---- apply -----------------------------------------------------------------
/** Apply a rename map the way the original pass did: word boundaries, longest key first. */
export function compileMap(map) {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  if (!keys.length) return null;
  return new RegExp(`\\b(${keys.map((k) => k.replace(/\$/g, "\\$")).join("|")})\\b`, "g");
}

export function applyMap(text, map) {
  const re = compileMap(map);
  return re ? text.replace(re, (m) => map[m]) : text;
}

/**
 * Apply a rename map to identifier tokens only, using token spans.
 * Unlike applyMap this cannot touch string or template *text*, and it can
 * distinguish an identifier from a property name — `obj.J` keeps `J` while a
 * bare `J` is renamed — which is what a name-keyed regex cannot do.
 */
export function applyMapByToken(text, map) {
  const toks = tokens(text);
  const reps = [];
  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k];
    if (tk.t !== "id") continue;
    if (!(tk.v in map)) continue;
    // A property access (`x.J`) or an object key (`J:`) is a name, not a binding.
    const prev = toks[k - 1];
    if (prev && prev.t === "pun" && (prev.v === "." || prev.v === "?.")) continue;
    const next = toks[k + 1];
    if (next && next.t === "pun" && next.v === ":") continue;
    reps.push({ s: tk.s, e: tk.e, to: map[tk.v] });
  }
  return spliceTokens(text, reps);
}

/** Rewrite text by replacing the spans in `reps` (any order). */
export function spliceTokens(text, reps) {
  if (!reps.length) return text;
  const sorted = [...reps].sort((a, b) => a.s - b.s);
  let out = "";
  let last = 0;
  for (const r of sorted) {
    if (r.s < last) throw new Error(`overlapping splice at ${r.s}`);
    out += text.slice(last, r.s) + r.to;
    last = r.e;
  }
  return out + text.slice(last);
}

// ---- recovery --------------------------------------------------------------
/**
 * Recover per-file rename maps for a spec.
 * Returns { files, union, conflicts, sections, misaligned, exact, checked }.
 * `sections` is the per-slice report; `exact`/`checked` are the round-trip proof.
 */
export function recover(dir, { spec, srcDir = "src", assetsDir = "assets" } = {}) {
  const specPath = path.join(dir, spec || "split-spec.json");
  spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const prettyFor = sourceResolver(dir, spec, { assetsDir });
  const sections = (spec.sections || []).filter(
    (s) => !s.wholeFile && typeof s.startLine === "number" && s.endLine > s.startLine
  );

  const files = new Map();
  const report = [];
  let misaligned = 0;

  for (const s of sections) {
    const srcPath = path.join(dir, srcDir, s.file);
    if (!fs.existsSync(srcPath)) {
      report.push({ file: s.file, status: "missing" });
      continue;
    }
    const map = new Map();
    // Seed with the spec's own (usually partial) renameMap first: a name the
    // historical pass applied but that never appears as an identifier *pair*
    // inside this particular range (e.g. `C` -> React, which occurs only inside
    // string literals here) would otherwise be missing and the literal-diff
    // check would report the slice as genuinely changed.
    for (const [from, to] of Object.entries(spec.renameMap || {})) map.set(from, to);
    const committed = stripHeader(fs.readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n"));
    const raw = rangeText(prettyFor, s).replace(/[\n\s]+$/, "");
    const a = tokens(raw);
    const b = tokens(committed);

    let mismatch = null;
    let pairs = 0;
    const literalRewrites = [];
    if (a.length !== b.length) {
      mismatch = `token count ${a.length} vs ${b.length}`;
    } else {
      // Pass 1: identifiers. A change inside literal text is a different thing
      // entirely — the historical pass matched on word boundaries over raw text,
      // so it also rewrote identifiers that happen to appear inside strings and
      // template literal text. Those are defects in the readable layer (the text
      // no longer says what the bundle says), so they are held back and judged
      // against the *complete* map in pass 2 rather than folded into it.
      const literalCandidates = [];
      const structural = [];
      for (let k = 0; k < a.length; k++) {
        if (a[k].t === b[k].t && a[k].v === b[k].v) continue;
        if (a[k].t === "id" && b[k].t === "id") {
          const prev = map.get(a[k].v);
          if (prev !== undefined && prev !== b[k].v) {
            mismatch = `conflicting rename ${a[k].v}: ${prev} vs ${b[k].v}`;
            break;
          }
          map.set(a[k].v, b[k].v);
          pairs++;
          continue;
        }
        if (a[k].t === b[k].t && (a[k].t === "lit" || a[k].t === "num")) {
          literalCandidates.push({ k, from: a[k].v, to: b[k].v });
          continue;
        }
        structural.push({ k, a: a[k], b: b[k] });
        break;
      }
      if (!mismatch && structural.length) {
        const { k, a: x, b: y } = structural[0];
        mismatch = `token ${k}: ${x.t}(${JSON.stringify(x.v.slice(0, 40))}) vs ${y.t}(${JSON.stringify(y.v.slice(0, 40))})`;
      }
      // Pass 2: is each literal difference explained by the map? If not, the
      // slice genuinely differs from its source range and must not be trusted.
      if (!mismatch) {
        for (const c of literalCandidates) {
          if (mappedText(c.from, c.to, map)) {
            literalRewrites.push({ at: c.k, from: c.from.slice(0, 60), to: c.to.slice(0, 60) });
          } else {
            mismatch = `literal ${c.k}: ${JSON.stringify(c.from.slice(0, 50))} vs ${JSON.stringify(c.to.slice(0, 50))}`;
            break;
          }
        }
      }
    }
    if (mismatch) misaligned++;
    files.set(s.file, map);
    report.push({
      file: s.file,
      status: mismatch ? "MISALIGNED" : "ok",
      detail: mismatch,
      tokens: a.length,
      renames: pairs,
      literalRewrites,
    });
  }

  // Round-trip proof: applying each file's own map must reproduce the slice.
  let exact = 0;
  let checked = 0;
  let literalRewrites = 0;
  for (const s of sections) {
    const srcPath = path.join(dir, srcDir, s.file);
    if (!fs.existsSync(srcPath)) continue;
    checked++;
    literalRewrites += (report.find((r) => r.file === s.file)?.literalRewrites || []).length;
    const committed = stripHeader(fs.readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n"));
    const flat = Object.fromEntries(files.get(s.file) || []);
    // A name-keyed map applied with word boundaries also matches identifier-
    // shaped fragments inside literal text (`s` matches the "s" in
    // "Guardian’s", `C` matches "USB-C"), so the regex proof can corrupt text
    // the committed slice has intact. The token-aware application cannot touch
    // literal text by construction; a slice that matches under EITHER proof is
    // a faithful rename layer.
    const renamed = applyMap(rangeText(prettyFor, s), flat).replace(/[\n\s]+$/, "");
    const renamedTok = applyMapByToken(rangeText(prettyFor, s), flat).replace(/[\n\s]+$/, "");
    if (renamed === committed || renamedTok === committed) exact++;
    else {
      const la = renamed.split("\n");
      const lb = committed.split("\n");
      let line = 1;
      for (let k = 0; k < Math.max(la.length, lb.length); k++) {
        if (la[k] !== lb[k]) {
          line = k + 1;
          break;
        }
      }
      const r = report.find((x) => x.file === s.file);
      if (r) r.proof = `line ${line}: map'${(la[line - 1] ?? "<eof>").slice(0, 70)}' committed'${(lb[line - 1] ?? "<eof>").slice(0, 70)}'`;
    }
  }

  const union = new Map();
  let conflicts = 0;
  for (const [, m] of files) {
    for (const [from, to] of m) {
      const prev = union.get(from);
      if (prev !== undefined && prev !== to) conflicts++;
      union.set(from, to);
    }
  }

  return {
    files,
    union,
    conflicts,
    sections: report,
    misaligned,
    literalRewrites,
    exact,
    checked,
    total: sections.length,
  };
}

// Does `to` look like `from` with the recovered identifier substitutions applied
// — i.e. is this literal difference the rename pass leaking into literal text
// rather than a real content change? Only identifiers the map knows are excused;
// anything else is a genuine difference and fails alignment.
function mappedText(from, to, map) {
  const re = compileMap(Object.fromEntries(map));
  return (re ? from.replace(re, (m) => map.get(m)) : from) === to;
}

/** Serialise a recovery result for storage next to the project. */
export function serialize(result) {
  return {
    note:
      "Per-file rename maps, recovered by anchor alignment from the committed slices. " +
      "`files` is authoritative (the historical pass was not applied uniformly); " +
      "`union` merges names for reading. Regenerate with tools/recover-rename-map.mjs.",
    files: Object.fromEntries(
      [...result.files]
        .filter(([, m]) => m.size)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([f, m]) => [f, Object.fromEntries([...m].sort())])
    ),
    union: Object.fromEntries([...result.union].sort()),
  };
}
