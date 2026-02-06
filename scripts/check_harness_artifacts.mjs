#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    const hasValue = next && !next.startsWith("--");
    out[k] = hasValue ? next : true;
    if (hasValue) i++;
  }
  return out;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function newestSubdir(baseDir) {
  if (!fs.existsSync(baseDir)) return null;
  const entries = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const p = path.join(baseDir, e.name);
      const st = fs.statSync(p);
      return { p, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries.length > 0 ? entries[0].p : null;
}

function main() {
  const args = parseArgs(process.argv);
  const root = process.cwd();
  const base = path.join(root, ".codex-artifacts", "idle-game");
  const dir = args.dir ? path.resolve(root, args.dir) : newestSubdir(base);

  if (!dir) {
    process.stderr.write("check:harness-artifacts FAILED: no artifacts directory found\n");
    process.exit(1);
  }

  if (!fs.existsSync(dir)) {
    process.stderr.write(`check:harness-artifacts FAILED: directory not found: ${dir}\n`);
    process.exit(1);
  }

  const files = walk(dir);
  const consoleFiles = files.filter((p) => path.basename(p) === "console.json");

  if (consoleFiles.length === 0) {
    process.stderr.write(`check:harness-artifacts FAILED: no console.json files under ${dir}\n`);
    process.exit(1);
  }

  const issues = [];
  let totalMessages = 0;

  for (const file of consoleFiles) {
    let arr;
    try {
      arr = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      issues.push({ file, type: "parse_error", text: String(err) });
      continue;
    }

    if (!Array.isArray(arr)) {
      issues.push({ file, type: "shape_error", text: "console.json must be an array" });
      continue;
    }

    totalMessages += arr.length;

    for (const msg of arr) {
      const t = String(msg?.type || "").toLowerCase();
      if (t === "error" || t === "warn" || t === "warning" || t === "pageerror") {
        issues.push({ file, type: t, text: String(msg?.text || "") });
      }
    }
  }

  if (issues.length > 0) {
    process.stderr.write("check:harness-artifacts FAILED\n");
    process.stderr.write(`- dir: ${dir}\n`);
    process.stderr.write(`- console files scanned: ${consoleFiles.length}\n`);
    process.stderr.write(`- issue count: ${issues.length}\n`);
    for (const issue of issues.slice(0, 30)) {
      process.stderr.write(`  - [${issue.type}] ${path.relative(process.cwd(), issue.file)} :: ${issue.text}\n`);
    }
    if (issues.length > 30) {
      process.stderr.write(`  - ... ${issues.length - 30} additional issues omitted\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    [
      "check:harness-artifacts OK",
      `- dir: ${dir}`,
      `- console files scanned: ${consoleFiles.length}`,
      `- messages scanned: ${totalMessages}`,
      "- errors/warnings/pageerrors: 0",
    ].join("\n") + "\n"
  );
}

main();
