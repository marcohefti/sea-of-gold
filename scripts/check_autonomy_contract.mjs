#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ACCEPTANCE_PATH = path.join(ROOT, "acceptance.md");
const ACTIONS_PATH = path.join(ROOT, "e2e", "action_payloads.json");

const REQUIRED_QUALITY_SCENARIOS = [
  "ui_overwhelm_guard",
  "progression_manual_to_auto",
  "quality_no_dead_time_early",
  "quality_unlock_avalanche_guard",
];

const NON_MEANINGFUL_EXPECT_PATHS = new Set([
  "meta.mode",
  "meta.ui.activeNav",
  "meta.ui.openMinigame",
  "meta.ui.isAutomation",
  "meta.ui.realtimeEnabled",
]);

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function unique(arr) {
  return [...new Set(arr)];
}

function extractAcceptanceScenarioIds(text) {
  const startMarker = "## 7) Scenario Suites (Current Release)";
  const endMarker = "## 8) Actions File Requirements";

  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    fail("check:autonomy-contract FAILED: could not find scenario suite section in acceptance.md");
  }

  const block = text.slice(start, end);
  const ids = [];
  const re = /`([a-z][a-z0-9_]*)`/g;
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(block))) ids.push(m[1]);

  const gateIds = [];
  const gateRe = /Scenario:\s*`([a-z][a-z0-9_]*)`/g;
  // eslint-disable-next-line no-cond-assign
  while ((m = gateRe.exec(text))) gateIds.push(m[1]);

  return unique([...ids, ...gateIds]);
}

function readScenarioMap() {
  const raw = JSON.parse(fs.readFileSync(ACTIONS_PATH, "utf8"));
  const scenarios = raw?.scenarios;
  if (!scenarios || typeof scenarios !== "object" || Array.isArray(scenarios)) {
    fail("check:autonomy-contract FAILED: e2e/action_payloads.json must contain a top-level object at .scenarios");
  }
  return scenarios;
}

function normalizeSteps(entry) {
  if (Array.isArray(entry)) return entry;
  if (entry && typeof entry === "object" && Array.isArray(entry.steps)) return entry.steps;
  return null;
}

function formatList(items) {
  return items.map((x) => `- ${x}`).join("\n");
}

function main() {
  if (!fs.existsSync(ACCEPTANCE_PATH)) fail("check:autonomy-contract FAILED: acceptance.md not found");
  if (!fs.existsSync(ACTIONS_PATH)) fail("check:autonomy-contract FAILED: e2e/action_payloads.json not found");

  const acceptanceText = fs.readFileSync(ACCEPTANCE_PATH, "utf8");
  const acceptanceScenarioIds = extractAcceptanceScenarioIds(acceptanceText);
  const scenarioMap = readScenarioMap();
  const actionScenarioIds = Object.keys(scenarioMap);

  const acceptanceSet = new Set(acceptanceScenarioIds);
  const actionSet = new Set(actionScenarioIds);

  const missingInAcceptance = actionScenarioIds.filter((id) => !acceptanceSet.has(id));
  const missingInActions = acceptanceScenarioIds.filter((id) => !actionSet.has(id));

  const contractErrors = [];

  if (missingInAcceptance.length > 0) {
    contractErrors.push(
      [
        "Scenarios present in e2e/action_payloads.json but missing from acceptance.md suite list:",
        formatList(missingInAcceptance),
      ].join("\n")
    );
  }

  if (missingInActions.length > 0) {
    contractErrors.push(
      [
        "Scenarios listed in acceptance.md suite list but missing from e2e/action_payloads.json:",
        formatList(missingInActions),
      ].join("\n")
    );
  }

  for (const required of REQUIRED_QUALITY_SCENARIOS) {
    if (!actionSet.has(required)) contractErrors.push(`Missing required quality scenario in actions file: ${required}`);
    if (!acceptanceSet.has(required)) contractErrors.push(`Missing required quality scenario in acceptance suite list: ${required}`);
  }

  const malformedScenarioIds = [];
  const noExpectScenarioIds = [];
  const noInteractionScenarioIds = [];
  const weakExpectScenarioIds = [];

  for (const id of actionScenarioIds) {
    const steps = normalizeSteps(scenarioMap[id]);
    if (!steps) {
      malformedScenarioIds.push(id);
      continue;
    }

    const hasExpect = steps.some((s) => s && s.type === "expect");
    if (!hasExpect) noExpectScenarioIds.push(id);

    const hasInteraction = steps.some((s) => s && ["click", "fill", "select", "advance", "press"].includes(s.type));
    if (!hasInteraction) noInteractionScenarioIds.push(id);

    const hasMeaningfulExpect = steps.some(
      (s) => s && s.type === "expect" && typeof s.path === "string" && !NON_MEANINGFUL_EXPECT_PATHS.has(s.path)
    );
    if (!hasMeaningfulExpect) weakExpectScenarioIds.push(id);
  }

  if (malformedScenarioIds.length > 0) {
    contractErrors.push(
      ["Scenarios with malformed shape (expected object with .steps[] or steps array):", formatList(malformedScenarioIds)].join("\n")
    );
  }

  if (noExpectScenarioIds.length > 0) {
    contractErrors.push(
      ["Scenarios missing any expect step:", formatList(noExpectScenarioIds)].join("\n")
    );
  }

  if (noInteractionScenarioIds.length > 0) {
    contractErrors.push(
      ["Scenarios missing any interaction/advance step:", formatList(noInteractionScenarioIds)].join("\n")
    );
  }

  if (weakExpectScenarioIds.length > 0) {
    contractErrors.push(
      [
        "Scenarios with only UI-meta expect paths (no progression/state assertion):",
        formatList(weakExpectScenarioIds),
      ].join("\n")
    );
  }

  if (contractErrors.length > 0) {
    process.stderr.write("check:autonomy-contract FAILED\n\n");
    process.stderr.write(contractErrors.join("\n\n") + "\n");
    process.exit(1);
  }

  process.stdout.write(
    [
      "check:autonomy-contract OK",
      `- scenarios in acceptance suite list: ${acceptanceScenarioIds.length}`,
      `- scenarios in actions file: ${actionScenarioIds.length}`,
      `- required quality scenarios present: ${REQUIRED_QUALITY_SCENARIOS.join(", ")}`,
    ].join("\n") + "\n"
  );
}

main();
