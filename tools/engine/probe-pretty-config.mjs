// Which formatter + settings produced a committed `*.pretty.*` file?
//
// A pretty file is only reproducible if you know the exact invocation, and a
// refresh that re-renders with the wrong one silently rewrites tens of thousands
// of lines (and, for a spec keyed to it, every anchor). This probe renders a
// source with a range of prettier versions/widths/parsers and reports which, if
// any, reproduce the committed bytes exactly — then tries js-beautify, which is
// what several of these projects actually used.
//
// usage:
//   node tools/probe-pretty-config.mjs <source.js> <committed.pretty.js> [--type js|css]
import fs from "fs";
import { execFileSync, execSync } from "child_process";
import path from "path";

const args = process.argv.slice(2);
const [source, committedFile] = args.filter((a) => !a.startsWith("--"));
const typeFlag = args.indexOf("--type");
const type = typeFlag === -1 ? "js" : args[typeFlag + 1];
if (!source || !committedFile) {
  console.error("usage: probe-pretty-config.mjs <source> <committedPretty> [--type js|css]");
  process.exit(2);
}

// npx is a shell script / .cmd shim depending on the platform, so the render
// commands go through a shell; paths are quoted and use forward slashes, which
// both sh and cmd.exe accept.
const sh = (pathname) => `"${path.resolve(pathname).replace(/\\/g, "/")}"`;
const run = (commandLine) => {
  try {
    return execSync(commandLine, { maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"], shell: true });
  } catch {
    return null;
  }
};
const runGit = (cmdArgs) => {
  try {
    return execFileSync("git", cmdArgs, { maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};

// Committed bytes as git sees them (LF), so a CRLF working copy does not read as
// a mismatch that is really a line-ending artifact.
const committed = fs.readFileSync(committedFile);
const gitBlob = runGit(["show", `HEAD:${path.relative(process.cwd(), committedFile).replace(/\\/g, "/")}`]);
const candidates = [["working copy", committed]];
if (gitBlob) candidates.push(["HEAD blob", gitBlob]);

const widths = [];
for (let w = 40; w <= 260; w += 10) widths.push(w);
for (const w of [96, 104, 112, 116, 128, 132, 144]) widths.push(w);
widths.sort((a, b) => a - b);

const hits = [];
for (const [label, bytes] of candidates) {
  for (const version of ["3", "2"]) {
    for (const parser of type === "css" ? ["css"] : ["babel", "babel-flow"]) {
      for (const width of widths) {
        const out = run(`npx -y prettier@${version} --parser ${parser} --print-width ${width} ${sh(source)}`);
        if (out && out.equals(bytes)) hits.push(`${label}: prettier@${version} --parser ${parser} --print-width ${width}`);
      }
    }
  }
  for (const extra of [[], ["-s", "2", "-w", "0"]]) {
    const out = run(`npx -y js-beautify --type ${type}${extra.length ? " " + extra.join(" ") : ""} ${sh(source)}`);
    if (out && out.equals(bytes)) hits.push(`${label}: js-beautify --type ${type}${extra.length ? " " + extra.join(" ") : ""}`);
  }
}

if (hits.length) for (const h of hits) console.log(`MATCH  ${h}`);
else console.log(`no prettier version/width/parser or js-beautify default reproduced ${committedFile}`);
