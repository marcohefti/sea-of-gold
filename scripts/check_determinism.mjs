#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const TARGET_DIRS = [
  path.join(ROOT, "packages", "engine", "src"),
  path.join(ROOT, "packages", "shared", "src"),
];

const BAN_LIST = [
  { name: "Date.now", re: /\bDate\.now\s*\(/g },
  { name: "new Date(", re: /\bnew\s+Date\s*\(/g },
  { name: "Math.random", re: /\bMath\.random\s*\(/g },
  { name: "performance.now", re: /\bperformance\.now\s*\(/g },
  { name: "crypto.getRandomValues", re: /\bcrypto\.getRandomValues\s*\(/g },
  { name: "setTimeout", re: /\bsetTimeout\s*\(/g },
  { name: "setInterval", re: /\bsetInterval\s*\(/g },
  { name: "requestAnimationFrame", re: /\brequestAnimationFrame\s*\(/g },
];

function isTextFile(filePath) {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath);
}

function listFilesRec(dir) {
  const out = [];
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRec(p));
    else if (e.isFile() && isTextFile(p)) out.push(p);
  }
  return out;
}

function fileLineColForIndex(text, idx) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < idx; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

const findings = [];
for (const dir of TARGET_DIRS) {
  for (const filePath of listFilesRec(dir)) {
    const rel = path.relative(ROOT, filePath);
    const text = fs.readFileSync(filePath, "utf8");
    for (const ban of BAN_LIST) {
      ban.re.lastIndex = 0;
      let m;
      // eslint-disable-next-line no-cond-assign
      while ((m = ban.re.exec(text))) {
        const { line, col } = fileLineColForIndex(text, m.index);
        findings.push({ rel, line, col, rule: ban.name });
      }
    }
  }
}

if (findings.length === 0) {
  process.stdout.write("check:determinism OK (no forbidden time/RNG/timers in engine/shared)\n");
  process.exit(0);
}

process.stderr.write("check:determinism FAILED (forbidden calls found in deterministic code)\n");
for (const f of findings) {
  process.stderr.write(`- ${f.rel}:${f.line}:${f.col}  ${f.rule}\n`);
}
process.exit(1);

