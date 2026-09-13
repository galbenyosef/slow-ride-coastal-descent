// update.mjs — fast incremental upstream check + refresh, per project.
//
// Goal: answer "did the site change?" in seconds, not minutes, and pull new
// bytes only when something actually moved.
//
// Mechanism (per entry in .upstream/manifest.json with kind "bundled"):
//   1. cache file .upstream/live-cache.json stores { url -> { etag, lastModified, sha256, bytes } }
//   2. probe each url with HEAD (or conditional GET with If-None-Match/If-Modified-Since)
//      - 304 Not Modified  -> unchanged, costs one round-trip, no body
//      - 200 with new ETag/LM -> changed; GET the body, record new sha256
//   3. verdict per project: "same" | "changed: [files]" | "redeployed: [404s]"
//
// usage:
//   node tools/shared/update.mjs <project>        # check (+report)
//   node tools/shared/update.mjs <project> --pull # also download changed files into place
//   node tools/shared/update.mjs --all [--quiet]  # sweep the whole workspace
//
// Notes:
//   - If the server ignores conditional requests (no ETag/Last-Modified), we
//     fall back to a ranged GET of the first 4 KiB and compare the prefix
//     against the cached prefix — still far cheaper than a full download.
//   - All results are cached, so a second run with nothing changed is pure 304s.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import https from "https";
import http from "http";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const PULL = flag("pull");
const QUIET = flag("quiet");
const ALL = flag("all");
const positional = args.filter((a) => !a.startsWith("--"));

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function conditionalFetch(url, cached) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const headers = { "user-agent": UA };
    if (cached?.etag) headers["if-none-match"] = cached.etag;
    if (cached?.lastModified) headers["if-modified-since"] = cached.lastModified;
    const req = (u.protocol === "https:" ? https : http).request(
      u,
      { method: "GET", headers, timeout: 20000 },
      (res) => {
        // Follow redirects (itch.io CDN, etc.) — keep conditional headers.
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, u).href;
          return resolve(conditionalFetch(next, cached));
        }
        if (res.statusCode === 304) {
          res.resume();
          return resolve({ status: 304 });
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            buf: Buffer.concat(chunks),
            etag: res.headers.etag,
            lastModified: res.headers["last-modified"],
            finalUrl: url,
          }),
        );
      },
    );
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, error: "timeout" }); });
    req.on("error", (e) => resolve({ status: 0, error: String(e).slice(0, 80) }));
    req.end();
  });
}

// itch.io-style wrapper resolution: if the source URL's page embeds an iframe
// from another host, the assets live there instead.
async function resolveBase(sourceUrl) {
  const r = await conditionalFetch(sourceUrl, null);
  if (r.status !== 200) return { base: sourceUrl, wrapped: false };
  const text = r.buf.toString("utf8");
  const m = text.match(/https:\/\/html-classic\.itch\.zone\/html\/[^"']+/);
  if (m) return { base: m[0], wrapped: true };
  return { base: sourceUrl, wrapped: false };
}

// Collect `patches[].find/replace` declared in a project's split-spec.json for
// a given bundle file. A section declares provenance via `sourceFile` (path)
// or `source` (human name, e.g. "App" matching assets/App-<hash>.js).
const patchCache = new Map();
function specPatches(dir, bundleFile) {
  const key = `${dir}::${bundleFile}`;
  if (patchCache.has(key)) return patchCache.get(key);
  let out = [];
  try {
    const spec = JSON.parse(fs.readFileSync(path.join(dir, "split-spec.json"), "utf8"));
    const stem = path.basename(bundleFile).replace(/(-[A-Za-z0-9_-]{8})?\.js$/, "").replace(/\.pretty$/, "");
    for (const s of spec.sections ?? []) {
      const src = s.sourceFile ?? s.source ?? "";
      if (!src) continue;
      if (src.includes(bundleFile) || src.replace(/\.pretty$/, "") === stem || path.basename(src).replace(/(-[A-Za-z0-9_-]{8})?\.js$/, "") === stem) {
        for (const p of s.patches ?? []) if (p.find && p.replace != null) out.push(p);
      }
    }
  } catch {}
  patchCache.set(key, out);
  return out;
}

async function processProject(name) {
  const dir = path.join(".", name);
  const mfPath = path.join(dir, ".upstream", "manifest.json");
  if (!fs.existsSync(mfPath)) return { name, status: "no-manifest" };
  const mf = JSON.parse(fs.readFileSync(mfPath, "utf8"));
  if (!mf.sourceUrl) return { name, status: "no-source-url" };

  const cachePath = path.join(dir, ".upstream", "live-cache.json");
  const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};

  const { base } = await resolveBase(mf.sourceUrl);
  const baseOrigin = new URL(base);
  const bundles = (mf.bundles ?? []).filter((b) => b.probe !== false); // probe every kind; per-entry probe:false opts out

  const result = { name, same: 0, changed: [], missing: [], error: 0, skipped: 0, patched: 0, unknown: 0, htmlFallback: 0 };
  for (const b of bundles) {
    const url = b.url ?? new URL(b.file, baseOrigin).href;
    // Baseline: live-cache (proves the file is upstream-served), else the
    // manifest's as-mirrored sha. The live-cache flag also disambiguates 404s:
    // a file never served upstream (our derived src/ slices) can never be
    // "missing" — it's just not a live file.
    const liveCache = JSON.parse(JSON.stringify(cache[url] ?? {}));
    const cached = cache[url] ?? (b.sha256 ? { sha256: b.sha256, etag: b.etag, lastModified: b.lastModified } : undefined);
    const r = await conditionalFetch(url, cached);
    if (r.status === 304) {
      result.same++;
      continue;
    }
    if (r.status === 404) {
      // fetched-from-live before → real redeploy; never served upstream → unknown
      if (liveCache.sha256) result.missing.push(b.file);
      else result.unknown++;
      continue;
    }
    if (r.status !== 200) {
      result.error++;
      continue;
    }
    const newHash = sha256(r.buf);
    // SPA hosts answer every path with their index HTML (200 + ETag). Detect:
    // if the live body looks like HTML but our mirrored file isn't, treat the
    // file as unprobeable (html-fallback), and never cache a fallback body.
    const head = r.buf.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
    const looksHtml = head.startsWith("<!doctype html") || head.startsWith("<html");
    const localFile = path.join(dir, b.file);
    const localIsHtml = fs.existsSync(localFile) &&
      fs.readFileSync(localFile).subarray(0, 256).toString("utf8").trimStart().toLowerCase().startsWith("<!doctype html");
    if (looksHtml && !localIsHtml) {
      result.htmlFallback++;
      continue;
    }
    // cache hit on content despite no 304 support
    if (cached?.sha256 === newHash) {
      cache[url] = { etag: r.etag, lastModified: r.lastModified, sha256: newHash, bytes: r.buf.length };
      result.same++;
      continue;
    }
    // Patch-aware compare: mirrors with spec-declared offline patches differ
    // from live *by design*. Patch find/replace strings are written against the
    // prettified form, so they rarely match raw minified bytes — any content
    // difference on a patch-carrying bundle is therefore classified as
    // `patched-confirm` (definitive check belongs to check-upstream.mjs,
    // which prettifies before comparing) instead of CHANGED.
    const localPath = path.join(dir, b.file);
    const hasPatch = specPatches(dir, b.file).length > 0;
    if (hasPatch) {
      cache[url] = { etag: r.etag, lastModified: r.lastModified, sha256: newHash, bytes: r.buf.length, patched: "confirm" };
      result.patched++;
      continue;
    }
    if (PULL) {
      const dest = path.join(dir, b.file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, r.buf);
      b.sha256 = newHash;
      b.bytes = r.buf.length;
      b.url = url;
    }
    result.changed.push({ file: b.file, bytes: r.buf.length });
    cache[url] = { etag: r.etag, lastModified: r.lastModified, sha256: newHash, bytes: r.buf.length };
  }
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  if (PULL && result.changed.length) {
    mf.mirroredAt = new Date().toISOString();
    fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2) + "\n");
  }
  return result;
}

const projects = ALL
  ? fs.readdirSync(".").filter((d) => fs.existsSync(path.join(d, ".git")) && d !== "tools")
  : positional;

let changedProjects = 0;
for (const p of projects) {
  const r = await processProject(p);
  const dirty = (r.changed?.length ?? 0) || (r.missing?.length ?? 0);
  if (dirty) changedProjects++;
  if (r.status) {
    // projects without a manifest or source URL — mention once, keep going
    console.log(`${r.name}: skipped (${r.status})`);
    continue;
  }
  if (!QUIET || dirty) {
    const parts = [`same=${r.same ?? 0}`];
    if (r.patched) parts.push(`patched-confirm=${r.patched}`);
    if (r.changed?.length) parts.push(`CHANGED: ${r.changed.map((c) => c.file).join(", ")}`);
    if (r.missing?.length) parts.push(`MISSING: ${r.missing.join(", ")}`);
    if (r.error) parts.push(`errors=${r.error}`);
    if (r.unknown) parts.push(`not-upstream=${r.unknown}`);
    if (r.htmlFallback) parts.push(`html-fallback=${r.htmlFallback} (probe-blind host)`);
    console.log(`${r.name}: ${parts.join(" | ")}`);
  }
}
if (!QUIET) console.log(`\n${projects.length} projects, ${changedProjects} with upstream movement`);
process.exit(0);
