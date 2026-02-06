#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import net from "node:net";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";

const PLAYABILITY_SCENARIOS = [
  "fun_phase0_first_5min",
  "playability_tour_short",
  "playability_audit_10min",
];

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

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function canListen(port) {
  return new Promise((resolve) => {
    const srv = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => srv.close(() => resolve(true)))
      .listen(port);
  });
}

async function pickPort(min = 5180, max = 5189) {
  for (let port = min; port <= max; port++) {
    // eslint-disable-next-line no-await-in-loop
    if (await canListen(port)) return port;
  }
  return null;
}

function waitForHttp(url, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => {
        req.destroy(new Error("timeout"));
      });
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for server: ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };

    tick();
  });
}

function canHttp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy(new Error("timeout"));
      resolve(false);
    });
  });
}

async function findExistingUrl(min = 5180, max = 5189) {
  for (let port = min; port <= max; port++) {
    const url = `http://localhost:${port}`;
    // eslint-disable-next-line no-await-in-loop
    const ok = await canHttp(url);
    if (ok) return url;
  }
  return null;
}

function readScenarioIds(root) {
  const actionsPath = path.join(root, "e2e", "action_payloads.json");
  const raw = JSON.parse(fs.readFileSync(actionsPath, "utf8"));
  const scenarios = raw?.scenarios;
  if (!scenarios || typeof scenarios !== "object" || Array.isArray(scenarios)) {
    throw new Error("Invalid actions payload shape: expected object at .scenarios");
  }
  return Object.keys(scenarios);
}

function run(cmd, args, opts = {}) {
  const pretty = `${cmd} ${args.join(" ")}`;
  process.stdout.write(`\n$ ${pretty}\n`);
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd || process.cwd(),
    env: opts.env || process.env,
    stdio: "inherit",
  });
  return res.status ?? 1;
}

function writeSummary(outDir, summary) {
  const jsonPath = path.join(outDir, "summary.json");
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const md = [];
  md.push("# Autonomous Validation Summary");
  md.push("");
  md.push(`- status: ${summary.ok ? "PASS" : "FAIL"}`);
  md.push(`- url: ${summary.url}`);
  md.push(`- outDir: ${summary.outDir}`);
  md.push(`- scenarios: ${summary.scenarios.total}`);
  md.push(`- scenario failures: ${summary.scenarios.failed.length}`);
  md.push(`- playability rubric: ${summary.playability?.status || "skipped"}`);
  md.push(`- repo checks run: ${summary.repoChecks.run}`);
  md.push(`- repo checks failures: ${summary.repoChecks.failed.length}`);
  md.push("");

  if (summary.scenarios.failed.length > 0) {
    md.push("## Failed Scenarios");
    md.push("");
    for (const id of summary.scenarios.failed) md.push(`- ${id}`);
    md.push("");
  }

  if (summary.repoChecks.failed.length > 0) {
    md.push("## Failed Repo Checks");
    md.push("");
    for (const id of summary.repoChecks.failed) md.push(`- ${id}`);
    md.push("");
  }

  if (summary.playability?.failed) {
    md.push("## Playability Rubric");
    md.push("");
    md.push(`- status: ${summary.playability.status}`);
    md.push(`- reason: ${summary.playability.reason || "rubric check failed"}`);
    md.push("");
  }

  const mdPath = path.join(outDir, "summary.md");
  fs.writeFileSync(mdPath, md.join("\n") + "\n");
}

async function main() {
  const root = process.cwd();
  const args = parseArgs(process.argv);

  const outDir = args["out-dir"]
    ? path.resolve(root, args["out-dir"])
    : path.join(root, ".codex-artifacts", "idle-game", `autonomous_validation_${timestamp()}`);
  mkdirp(outDir);

  const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex");
  const clientPath =
    process.env.IDLE_GAME_CLIENT ||
    path.join(codexHome, "skills", "develop-idle-game", "scripts", "idle_game_playwright_client.js");

  if (!fs.existsSync(clientPath)) {
    throw new Error(`Playwright harness client not found: ${clientPath}`);
  }

  const allScenarioIds = readScenarioIds(root);
  const selectedScenarioIds = args.scenarios
    ? args.scenarios
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : allScenarioIds;

  for (const id of selectedScenarioIds) {
    if (!allScenarioIds.includes(id)) throw new Error(`Unknown scenario: ${id}`);
  }

  let url = args.url ? String(args.url) : null;
  let startedServer = null;

  try {
    if (!url) {
      const existingUrl = await findExistingUrl(5180, 5189);
      if (existingUrl) {
        url = existingUrl;
        process.stdout.write(`Using existing dev server: ${url}\n`);
      }
    }

    if (!url) {
      const requestedPort = args.port ? Number(args.port) : null;
      let port = requestedPort;
      if (requestedPort != null) {
        if (!Number.isFinite(requestedPort) || requestedPort < 5180 || requestedPort > 5189) {
          throw new Error("--port must be between 5180 and 5189");
        }
        const free = await canListen(requestedPort);
        if (!free) throw new Error(`Requested port is not free: ${requestedPort}`);
      } else {
        port = await pickPort(5180, 5189);
        if (port == null) throw new Error("No free port found in range 5180-5189");
      }

      const devLogPath = path.join(outDir, "dev-server.log");
      const devLog = fs.createWriteStream(devLogPath, { flags: "a" });
      const dev = spawn(
        "pnpm",
        ["--filter", "@sea-of-gold/web", "exec", "next", "dev", "-p", String(port)],
        { cwd: root, env: process.env }
      );
      dev.stdout.on("data", (buf) => {
        process.stdout.write(buf);
        devLog.write(buf);
      });
      dev.stderr.on("data", (buf) => {
        process.stderr.write(buf);
        devLog.write(buf);
      });

      startedServer = { child: dev, log: devLog };
      url = `http://localhost:${port}`;

      process.stdout.write(`\nWaiting for dev server: ${url}\n`);
      await waitForHttp(url, 90_000);
    }

    // 1) Contract checks (docs/scenarios sanity)
    const contractStatus = run("node", [path.join("scripts", "check_autonomy_contract.mjs")], { cwd: root });
    if (contractStatus !== 0) {
      const summary = {
        ok: false,
        url,
        outDir,
        scenarios: { total: selectedScenarioIds.length, failed: selectedScenarioIds },
        repoChecks: { run: false, failed: [] },
        failure: "check_autonomy_contract_failed",
      };
      writeSummary(outDir, summary);
      process.exit(1);
    }

    // 2) Harness scenario sweep
    const scenarioFailed = [];
    for (const id of selectedScenarioIds) {
      const scenarioOut = path.join(outDir, id);
      mkdirp(scenarioOut);
      const status = run("node", [clientPath, "--url", url, "--actions-file", "./e2e/action_payloads.json", "--scenario", id, "--out-dir", scenarioOut], {
        cwd: root,
        env: { ...process.env, CODEX_HOME: codexHome, IDLE_GAME_CLIENT: clientPath },
      });
      if (status !== 0) scenarioFailed.push(id);
    }

    // 3) Artifact log gate
    const artifactStatus = run("node", [path.join("scripts", "check_harness_artifacts.mjs"), "--dir", outDir], {
      cwd: root,
    });

    // 4) Playability rubric gate (only when required scenarios are present in this run)
    const skipPlayability = args["skip-playability-check"] === true || args["skip-playability-check"] === "true";
    const playabilityCoverage =
      !skipPlayability &&
      PLAYABILITY_SCENARIOS.every((id) => selectedScenarioIds.includes(id)) &&
      PLAYABILITY_SCENARIOS.every((id) => !scenarioFailed.includes(id));

    let playabilityStatus = 0;
    const playability = {
      run: false,
      status: "skipped",
      failed: false,
      reason: skipPlayability
        ? "disabled by --skip-playability-check"
        : !PLAYABILITY_SCENARIOS.every((id) => selectedScenarioIds.includes(id))
          ? "required scenarios not included in this run"
          : PLAYABILITY_SCENARIOS.some((id) => scenarioFailed.includes(id))
            ? "required scenarios failed before rubric scoring"
            : undefined,
    };

    if (playabilityCoverage) {
      playability.run = true;
      playabilityStatus = run(
        "node",
        [path.join("scripts", "check_playability_rubric.mjs"), "--dir", outDir, "--scenarios", PLAYABILITY_SCENARIOS.join(",")],
        { cwd: root }
      );
      playability.status = playabilityStatus === 0 ? "pass" : "fail";
      playability.failed = playabilityStatus !== 0;
      playability.reason = playabilityStatus === 0 ? undefined : "score below threshold or rubric hard-fail";
    }

    // 5) Repo checks
    const repoChecksToRun = [
      "check:determinism",
      "check:saves",
      "lint",
      "build",
    ];
    const skipRepoChecks = args["skip-repo-checks"] === true || args["skip-repo-checks"] === "true";
    const repoFailed = [];

    if (!skipRepoChecks) {
      for (const scriptName of repoChecksToRun) {
        const status = run("pnpm", [scriptName], { cwd: root });
        if (status !== 0) repoFailed.push(scriptName);
      }
    }

    const ok =
      scenarioFailed.length === 0 &&
      artifactStatus === 0 &&
      playabilityStatus === 0 &&
      (skipRepoChecks || repoFailed.length === 0);

    const summary = {
      ok,
      url,
      outDir,
      scenarios: {
        total: selectedScenarioIds.length,
        failed: scenarioFailed,
      },
      artifacts: {
        checkStatus: artifactStatus === 0 ? "pass" : "fail",
      },
      playability,
      repoChecks: {
        run: !skipRepoChecks,
        failed: repoFailed,
      },
    };

    writeSummary(outDir, summary);

    if (ok) {
      process.stdout.write(`\nAUTONOMOUS VALIDATION PASS\n- out: ${outDir}\n- scenarios: ${selectedScenarioIds.length}/${selectedScenarioIds.length}\n`);
      process.exit(0);
    }

    process.stderr.write(`\nAUTONOMOUS VALIDATION FAILED\n- out: ${outDir}\n`);
    if (scenarioFailed.length > 0) process.stderr.write(`- failed scenarios: ${scenarioFailed.join(", ")}\n`);
    if (artifactStatus !== 0) process.stderr.write("- artifact log check failed\n");
    if (playabilityStatus !== 0) process.stderr.write("- playability rubric check failed\n");
    if (repoFailed.length > 0) process.stderr.write(`- failed repo checks: ${repoFailed.join(", ")}\n`);
    process.exit(1);
  } finally {
    if (startedServer) {
      startedServer.child.kill("SIGTERM");
      startedServer.log.end();
    }
  }
}

main().catch((err) => {
  process.stderr.write(`run_autonomous_validation FAILED: ${String(err?.stack || err)}\n`);
  process.exit(1);
});
