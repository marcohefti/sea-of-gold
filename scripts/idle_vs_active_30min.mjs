#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

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

function toNum(v, fallback = 0) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function msToStamp(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

function pickKeyResources(view) {
  const r = view?.resources || {};
  return {
    gold: toNum(r.gold),
    sugar: toNum(r.sugar),
    rum: toNum(r.rum),
    hemp: toNum(r.hemp),
    herbs: toNum(r.herbs),
    dye: toNum(r.dye),
    cloth: toNum(r.cloth),
    cosmetics: toNum(r.cosmetics),
    cannonballs: toNum(r.cannonballs),
    parts: toNum(r.parts),
    repair_kits: toNum(r.repair_kits),
  };
}

const CANNON_DURATION_MS = 20_000;
const RIGGING_DURATION_MS = 30_000;

async function main() {
  const args = parseArgs(process.argv);
  const url = args.url || "http://localhost:5180";
  const seed = args.seed ? Number(args.seed) : 1;
  const minutes = args.minutes ? Number(args.minutes) : 30;
  const horizonMs = Math.max(1, Math.trunc(minutes * 60_000));
  const logEveryIters = args["log-every-iters"] ? Number(args["log-every-iters"]) : 0;

  const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex");
  const skillClientPath =
    process.env.IDLE_GAME_CLIENT ||
    path.join(codexHome, "skills", "develop-idle-game", "scripts", "idle_game_playwright_client.js");
  const require = createRequire(skillClientPath);

  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    process.stderr.write(
      [
        "Missing dependency: playwright (expected to be installed with the develop-idle-game skill).",
        "",
        `Tried resolving from: ${skillClientPath}`,
      ].join("\n") + "\n"
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(10_000);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(250);

    await page.waitForFunction(
      () =>
        typeof window.render_game_to_text === "function" &&
        typeof window.advanceTime === "function" &&
        window.__idle &&
        typeof window.__idle.exportSave === "function" &&
        typeof window.__idle.importSave === "function" &&
        typeof window.__idle.hardReset === "function" &&
        typeof window.__idle.setSeed === "function",
      null,
      { timeout: 60_000 }
    );

    const readState = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    const advance = async (ms) => page.evaluate((m) => window.advanceTime(m), ms);

    const clickIfEnabled = async (selector) => {
      try {
        if (!(await page.isVisible(selector))) return false;
        if (!(await page.isEnabled(selector))) return false;
        await page.click(selector);
        return true;
      } catch {
        return false;
      }
    };
    const goNav = async (testId) => clickIfEnabled(`[data-testid='${testId}']`);

    const resetAndStart = async () => {
      await page.evaluate((s) => window.__idle.setSeed(s), seed);
      await page.evaluate(() => window.__idle.hardReset());
      await page.waitForTimeout(50);
      await page.waitForSelector("[data-testid='start-new-game']", { timeout: 60_000 });
      await page.click("[data-testid='start-new-game']");
      await page.waitForTimeout(50);
      await goNav("nav-port");
    };

    const placeSugarContract = async (qty, bidPrice) => {
      await goNav("nav-economy");
      await page.selectOption("[data-testid='contracts-commodity']", "sugar");
      await page.fill("[data-testid='contracts-qty']", String(qty));
      await page.fill("[data-testid='contracts-price']", String(bidPrice));
      await page.waitForTimeout(50);
      return await clickIfEnabled("[data-testid='contracts-place']");
    };

    const collectSomeContracts = async () => {
      await goNav("nav-economy");
      let did = false;
      for (let i = 0; i < 3; i++) {
        const ok = await clickIfEnabled("[data-testid='contracts-collect']");
        if (!ok) break;
        did = true;
      }
      return did;
    };

    const maybeStartMinigames = async (state) => {
      // Always start via UI hooks (deterministic stepping via advanceTime).
      const buffs = state.buffs || [];
      const cannon = buffs.find((b) => b.id === "cannon_volley");
      const rigging = buffs.find((b) => b.id === "rigging_run");

      // Heuristic cadence: keep buffs up, refresh only when low.
      if (!cannon || toNum(cannon.remainingMs) < 30_000) {
        await clickIfEnabled("[data-testid='minigame-cannon-open']");
        await page.waitForSelector("[data-testid='minigame-cannon-start']", { state: "visible", timeout: 2_000 }).catch(() => {});
        await clickIfEnabled("[data-testid='minigame-cannon-start']");
      }
      if ((state.unlocks || []).includes("minigame:rigging") && (!rigging || toNum(rigging.remainingMs) < 30_000)) {
        await clickIfEnabled("[data-testid='minigame-rigging-open']");
        await page.waitForSelector("[data-testid='minigame-rigging-start']", { state: "visible", timeout: 2_000 }).catch(() => {});
        await clickIfEnabled("[data-testid='minigame-rigging-start']");
      }
      await page.waitForTimeout(25);
      return await readState();
    };

    const loadRumToHold = async (qty) => {
      if (qty <= 0) return false;
      await goNav("nav-port");
      await page.selectOption("[data-testid='cargo-commodity']", "rum");
      await page.fill("[data-testid='cargo-qty']", String(qty));
      return await clickIfEnabled("[data-testid='cargo-load']");
    };

    const pickVoyageStartSelector = (state) => {
      const portId = state.location?.id ?? "home_port";
      if (portId === "home_port") return "[data-testid='voyage-start']";
      if (portId === "turtle_cay") return "[data-testid='voyage-start-turtle_to_home']";
      if (portId === "ironhaven") return "[data-testid='voyage-start-haven_to_home']";
      return null;
    };

    const runPolicy = async (policyId) => {
      await resetAndStart();
      let state = await readState();
      const startGold = toNum(state.resources?.gold ?? 0);

      const stepMs = 5_000;
      let iters = 0;
      let lastNowMs = toNum(state.meta?.nowMs ?? 0);
      let stallIters = 0;
      while (toNum(state.meta?.nowMs ?? 0) < horizonMs) {
        const nowMs = toNum(state.meta?.nowMs ?? 0);
        iters++;
        if (logEveryIters > 0 && iters % logEveryIters === 0) {
          process.stderr.write(`[${policyId}] t=${msToStamp(nowMs)} gold=${toNum(state.resources?.gold ?? 0)}\n`);
        }

        // Keep one open sugar contract per current port (to sustain rum production everywhere).
        const portId = state.location?.id ?? "home_port";
        const openHere =
          (state.economy?.contracts || []).filter((c) => c.portId === portId && c.status === "open" && c.commodityId === "sugar").length || 0;
        if (openHere < 1 && toNum(state.resources?.gold ?? 0) >= 15) {
          await placeSugarContract(30, 1);
          state = await readState();
        }

        // Collect if possible.
        await collectSomeContracts();
        state = await readState();

        // Keep rum flowing into the hold (so voyages can start).
        const holdRum = toNum(state.hold?.rum ?? 0);
        const whRum = toNum(state.resources?.rum ?? 0);
        if ((state.unlocks || []).includes("voyage") && whRum > 0 && holdRum < 20) {
          await loadRumToHold(Math.min(20 - holdRum, whRum));
          state = await readState();
        }

        // Voyages loop: if a voyage is complete, collect.
        if (state.voyage?.status === "completed") {
          await goNav("nav-voyage");
          await clickIfEnabled("[data-testid='voyage-collect']");
          state = await readState();
          continue;
        }

        // If idle and unlocked, start a return-to-home loop.
        if (state.voyage?.status === "idle" && (state.unlocks || []).includes("voyage")) {
          await goNav("nav-voyage");
          const startSel = pickVoyageStartSelector(state);
          if (startSel) await clickIfEnabled(startSel);
          state = await readState();
        }

        // Active play overlaps with voyages (start minigames while the voyage is running).
        if (policyId === "active" && state.voyage?.status === "running") {
          state = await maybeStartMinigames(state);
        }

        // Advance deterministically. When voyaging, use bigger steps to reduce overhead.
        const dt = state.voyage?.status === "running" ? 30_000 : stepMs;
        await advance(Math.min(dt, Math.max(0, horizonMs - toNum(state.meta?.nowMs ?? 0))));
        state = await readState();

        const nowAfter = toNum(state.meta?.nowMs ?? 0);
        if (nowAfter <= lastNowMs) stallIters++;
        else stallIters = 0;
        lastNowMs = nowAfter;
        if (stallIters >= 20) {
          throw new Error(
            `Simulation time is not advancing (stalled at nowMs=${nowAfter} for ${stallIters} iterations) while running policy '${policyId}'.`
          );
        }

        // Light re-arm contracts when we’re back at Home Port and have spare gold.
        if (nowMs > 120_000 && state.location?.id === "home_port" && toNum(state.resources?.gold ?? 0) >= 30) {
          await placeSugarContract(20, 1);
          state = await readState();
        }
      }

      const endGold = toNum(state.resources?.gold ?? 0);
      const gained = endGold - startGold;
      const perMin = gained / (horizonMs / 60_000);

      return {
        policy: policyId,
        nowMs: toNum(state.meta?.nowMs ?? 0),
        goldStart: startGold,
        goldEnd: endGold,
        goldGained: gained,
        goldPerMin: perMin,
        locationId: state.location?.id ?? null,
        unlocks: state.unlocks || [],
        buffs: state.buffs || [],
        resources: pickKeyResources(state),
      };
    };

    const idle = await runPolicy("idle_only");
    const active = await runPolicy("active");

    const ratio = idle.goldPerMin / Math.max(1e-9, active.goldPerMin);
    const boostPct = (active.goldPerMin / Math.max(1e-9, idle.goldPerMin) - 1) * 100;

    process.stdout.write(
      [
        "# Idle vs Active (30m)",
        "",
        `- url: ${url}`,
        `- seed: ${seed}`,
        `- horizon: ${minutes}m`,
        "",
        `idle_only:  ${idle.goldPerMin.toFixed(2)} gold/min (gained ${idle.goldGained}, end ${idle.goldEnd})`,
        `active:     ${active.goldPerMin.toFixed(2)} gold/min (gained ${active.goldGained}, end ${active.goldEnd})`,
        "",
        `idle / active: ${(ratio * 100).toFixed(1)}%`,
        `active boost: +${boostPct.toFixed(1)}%`,
        "",
        "Idle snapshot:",
        JSON.stringify(idle, null, 2),
        "",
        "Active snapshot:",
        JSON.stringify(active, null, 2),
        "",
      ].join("\n")
    );
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + "\n");
  process.exit(1);
});
