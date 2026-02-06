#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_SCENARIOS = ["fun_phase0_first_5min", "playability_tour_short", "playability_audit_10min"];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    const hasValue = next && !next.startsWith("--");
    out[key] = hasValue ? next : true;
    if (hasValue) i++;
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
      return { p, mtimeMs: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries.length > 0 ? entries[0].p : null;
}

function toNumber(v, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function isTrue(x) {
  return x === true;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function scoreGoalClarity(s) {
  const nextGoalId = String(s?.quality?.progression?.nextGoalId || "");
  const nextGoalCount = toNumber(s?.quality?.progression?.nextGoalCount, 0);
  if (nextGoalId && nextGoalId !== "goal:next" && nextGoalCount >= 2) {
    return { score: 20, note: `clear next goal (${nextGoalId}) with ${nextGoalCount} queued goals` };
  }
  if (nextGoalId && nextGoalId !== "goal:next") {
    return { score: 10, note: `goal exists (${nextGoalId}) but queue depth is low (${nextGoalCount})` };
  }
  return { score: 0, note: "missing goal clarity (placeholder or empty next goal)" };
}

function scoreChoicePressure(s) {
  const meaningfulActionCount = toNumber(s?.quality?.pacing?.meaningfulActionCount, 0);
  const decisionActionCount = toNumber(s?.quality?.pacing?.decisionActionCount, 0);
  const waitMs = toNumber(s?.quality?.pacing?.timeToNextMeaningfulActionMs, 0);

  if (meaningfulActionCount >= 6 && decisionActionCount >= 3) {
    return { score: 20, note: `strong choice pressure (${meaningfulActionCount} meaningful / ${decisionActionCount} decision actions)` };
  }
  if (meaningfulActionCount >= 3 && decisionActionCount >= 1) {
    return { score: 10, note: `moderate choice pressure (${meaningfulActionCount} meaningful / ${decisionActionCount} decision actions)` };
  }
  if (meaningfulActionCount >= 1 && waitMs === 0) {
    return { score: 5, note: `actions available but low decision variety (${meaningfulActionCount})` };
  }
  return { score: 0, note: "insufficient meaningful choices" };
}

function scoreActiveIdleHarmony(s) {
  const passive = toNumber(s?.quality?.progression?.goldPassivePerSec, 0);
  const ids = Array.isArray(s?.quality?.pacing?.meaningfulActionIds) ? s.quality.pacing.meaningfulActionIds : [];
  const activeLeverCount = ids.filter((id) =>
    [
      "contracts-place",
      "voyage-prepare",
      "voyage-start",
      "minigame-cannon-start",
      "minigame-rigging-start",
      "politics-donate",
      "shipyard-upgrade",
      "chart-buy",
    ].includes(id)
  ).length;

  if (passive > 0 && activeLeverCount >= 2) {
    return { score: 20, note: `idle + active both present (passive ${passive}/s, active levers ${activeLeverCount})` };
  }
  if (passive > 0 || activeLeverCount >= 1) {
    return { score: 10, note: `partial active/idle harmony (passive ${passive}/s, active levers ${activeLeverCount})` };
  }
  return { score: 0, note: "no visible active/idle harmony" };
}

function scoreLogisticsFriction(s) {
  const storageFillBps = toNumber(s?.quality?.progression?.storageFillBps, 0);
  const holdFillBps = toNumber(s?.quality?.progression?.holdFillBps, 0);
  const netPortGoldPerMin = toNumber(s?.quality?.progression?.netPortGoldPerMin, 0);
  const ids = Array.isArray(s?.quality?.pacing?.meaningfulActionIds) ? s.quality.pacing.meaningfulActionIds : [];

  const hasPressure = storageFillBps >= 500 || holdFillBps >= 500 || toNumber(s?.quality?.progression?.contractOpenCount, 0) > 0;
  const hasSinkLever = ids.some((id) =>
    ["ship-repair", "crew-hire", "politics-donate", "shipyard-upgrade", "vanity-buy", "flagship-contribute"].includes(id)
  );

  if (hasPressure && hasSinkLever) {
    return {
      score: 20,
      note: `pressure+sinks visible (storage ${storageFillBps}bps / hold ${holdFillBps}bps / net ${netPortGoldPerMin}g/min)`,
    };
  }
  if (hasPressure || hasSinkLever) {
    return {
      score: 10,
      note: `partial logistics friction (pressure=${String(hasPressure)}, sinks=${String(hasSinkLever)}, net ${netPortGoldPerMin}g/min)`,
    };
  }
  return { score: 0, note: "no visible logistics friction" };
}

function scoreUiFocus(s) {
  const modules = toNumber(s?.quality?.ui?.visibleModuleCount, 0);
  const interactives = toNumber(s?.quality?.ui?.visibleInteractiveCount, 0);
  const tutorialStepId = String(s?.quality?.ui?.tutorialStepId || "");

  if (tutorialStepId === "tut:dock_intro") {
    if (modules <= 1 && interactives <= 6) {
      return { score: 20, note: `tight onboarding focus (${modules} modules / ${interactives} interactives)` };
    }
    return { score: 0, note: `onboarding overwhelm (${modules} modules / ${interactives} interactives)` };
  }

  if (modules <= 5 && interactives <= 30) {
    return { score: 20, note: `good UI focus (${modules} modules / ${interactives} interactives)` };
  }
  if (modules <= 8 && interactives <= 45) {
    return { score: 10, note: `acceptable but dense UI (${modules} modules / ${interactives} interactives)` };
  }
  return { score: 0, note: `UI overload risk (${modules} modules / ${interactives} interactives)` };
}

function evaluateScenario(state) {
  const dims = {
    goalClarity: scoreGoalClarity(state),
    choicePressure: scoreChoicePressure(state),
    activeIdleHarmony: scoreActiveIdleHarmony(state),
    logisticsFriction: scoreLogisticsFriction(state),
    uiFocus: scoreUiFocus(state),
  };

  const total = Object.values(dims).reduce((acc, d) => acc + d.score, 0);
  return { total, dimensions: dims };
}

function writeReport(dir, report) {
  const jsonPath = path.join(dir, "playability_rubric_report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const lines = [];
  lines.push("# Playability Rubric Report");
  lines.push("");
  lines.push(`- status: ${report.ok ? "PASS" : "FAIL"}`);
  lines.push(`- artifactDir: ${report.artifactDir}`);
  lines.push(`- scenariosScored: ${report.scenarios.length}`);
  lines.push(`- averageScore: ${report.averageScore}`);
  lines.push(`- thresholdPass: ${report.thresholds.minPass}`);
  lines.push(`- thresholdHardFail: ${report.thresholds.hardFail}`);
  lines.push("");

  for (const s of report.scenarios) {
    lines.push(`## ${s.id}`);
    lines.push("");
    lines.push(`- total: ${s.total}`);
    lines.push(`- goalClarity: ${s.dimensions.goalClarity.score} (${s.dimensions.goalClarity.note})`);
    lines.push(`- choicePressure: ${s.dimensions.choicePressure.score} (${s.dimensions.choicePressure.note})`);
    lines.push(`- activeIdleHarmony: ${s.dimensions.activeIdleHarmony.score} (${s.dimensions.activeIdleHarmony.note})`);
    lines.push(`- logisticsFriction: ${s.dimensions.logisticsFriction.score} (${s.dimensions.logisticsFriction.note})`);
    lines.push(`- uiFocus: ${s.dimensions.uiFocus.score} (${s.dimensions.uiFocus.note})`);
    lines.push("");
  }

  if (report.missing.length > 0) {
    lines.push("## Missing Scenarios");
    lines.push("");
    for (const id of report.missing) lines.push(`- ${id}`);
    lines.push("");
  }

  const mdPath = path.join(dir, "playability_rubric_report.md");
  fs.writeFileSync(mdPath, lines.join("\n") + "\n");
}

function main() {
  const args = parseArgs(process.argv);
  const root = process.cwd();
  const base = path.join(root, ".codex-artifacts", "idle-game");
  const artifactDir = args.dir ? path.resolve(root, args.dir) : newestSubdir(base);
  if (!artifactDir || !fs.existsSync(artifactDir)) {
    process.stderr.write("check:playability-rubric FAILED: artifact directory not found\n");
    process.exit(1);
  }

  const scenarios = args.scenarios
    ? String(args.scenarios)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : DEFAULT_SCENARIOS;
  const minPass = toNumber(args["min-pass"], 70);
  const hardFail = toNumber(args["hard-fail"], 55);
  const allowMissing = isTrue(args["allow-missing"]);

  const missing = [];
  const scored = [];

  for (const id of scenarios) {
    const file = path.join(artifactDir, id, "state.final.json");
    if (!fs.existsSync(file)) {
      missing.push(id);
      continue;
    }
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    const result = evaluateScenario(state);
    scored.push({ id, ...result });
  }

  if (scored.length === 0) {
    process.stderr.write("check:playability-rubric FAILED: no scenarios scored\n");
    process.exit(1);
  }

  const averageScore = Math.round(scored.reduce((acc, s) => acc + s.total, 0) / scored.length);
  const hardFailures = scored.filter((s) => s.total < hardFail).map((s) => s.id);

  const ok = (allowMissing || missing.length === 0) && hardFailures.length === 0 && averageScore >= minPass;

  const report = {
    ok,
    artifactDir,
    thresholds: { minPass, hardFail },
    averageScore,
    scenarios: scored,
    missing,
    hardFailures,
  };

  ensureDir(artifactDir);
  writeReport(artifactDir, report);

  if (ok) {
    process.stdout.write(
      [
        "check:playability-rubric OK",
        `- artifactDir: ${artifactDir}`,
        `- scenarios scored: ${scored.length}`,
        `- average score: ${averageScore}`,
      ].join("\n") + "\n"
    );
    return;
  }

  process.stderr.write("check:playability-rubric FAILED\n");
  process.stderr.write(`- artifactDir: ${artifactDir}\n`);
  process.stderr.write(`- average score: ${averageScore} (min ${minPass})\n`);
  if (hardFailures.length > 0) process.stderr.write(`- hard-fail scenarios (<${hardFail}): ${hardFailures.join(", ")}\n`);
  if (missing.length > 0) process.stderr.write(`- missing scenarios: ${missing.join(", ")}\n`);
  process.exit(1);
}

main();
