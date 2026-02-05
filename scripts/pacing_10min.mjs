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

function msToStamp(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

function toNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return NaN;
}

function toBig(v) {
  try {
    return typeof v === "bigint" ? v : BigInt(v);
  } catch {
    return 0n;
  }
}

function deltaRows(events) {
  const rows = [];
  let prevMs = 0;
  for (const e of events) {
    rows.push({ ...e, dtMs: e.nowMs - prevMs });
    prevMs = e.nowMs;
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv);
  const url = args.url || "http://localhost:5180";
  const seed = args.seed ? Number(args.seed) : 1;
  const headed = args.headed === "true";

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

  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 30 : 0 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(10_000);

  const events = [];
  const addEvent = (nowMs, kind, detail) => events.push({ nowMs, kind, detail });

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

    await page.evaluate((s) => window.__idle.setSeed(s), seed);
    await page.evaluate(() => window.__idle.hardReset());
    await page.waitForTimeout(50);
    await page.click("[data-testid='start-new-game']");
    await page.waitForTimeout(50);
    await page.evaluate(() => window.__idle.debug?.clear?.());

    async function readState() {
      const txt = await page.evaluate(() => window.render_game_to_text());
      return JSON.parse(txt);
    }

    async function clickIfEnabled(selector) {
      try {
        if (!(await page.isVisible(selector))) return false;
        if (!(await page.isEnabled(selector))) return false;
        await page.click(selector);
        return true;
      } catch {
        return false;
      }
    }

    async function goNav(navTestId) {
      return clickIfEnabled(`[data-testid='${navTestId}']`);
    }

    let state = await readState();
    addEvent(state.meta.nowMs, "start", "Start new game");

    const flags = {
      contractPlaced: false,
      warehouseUpgraded: false,
      crewHired: false,
      affiliationSet: false,
      donated10inf: false,
      voyageStarted: 0,
      voyageCollected: 0,
      shipyardUpgraded: false,
    };

    let prevUnlocks = new Set(state.unlocks || []);
    let lastCollectLogMs = -1e9;
    let loggedMilestones = new Set();
    let lastMinuteLogged = -1;
    let lastNowMs = -1;
    let sameNowLoops = 0;

    // Minimal-click autoplayer loop: do the next meaningful action as soon as it becomes possible.
    // Time advances in 5s chunks to stay cheap, but actions are taken immediately when checks pass.
    const horizonMs = 600_000;
    const stepMs = 5_000;
    while (toNum(state.meta.nowMs) < horizonMs) {
      const nowMs = toNum(state.meta.nowMs);
      const minute = Math.floor(nowMs / 60_000);
      if (minute !== lastMinuteLogged) {
        lastMinuteLogged = minute;
        process.stderr.write(`... t=${msToStamp(nowMs)}\n`);
      }
      if (nowMs === lastNowMs) {
        sameNowLoops += 1;
        if (sameNowLoops >= 25) {
          await page.evaluate((ms) => window.advanceTime(ms), stepMs);
          state = await readState();
          sameNowLoops = 0;
          continue;
        }
      } else {
        lastNowMs = nowMs;
        sameNowLoops = 0;
      }

      const gold = toBig(state.resources?.gold ?? 0);
      const portId = state.location?.id ?? "home_port";
      const holdRum = toBig(state.hold?.rum ?? 0);
      const whRum = toBig(state.resources?.rum ?? 0);
      const whCap = toBig(state.storage?.warehouseCap ?? 0);
      const whUsed = toBig(state.storage?.warehouseUsed ?? 0);
      const canWarehouseUpgrade = !flags.warehouseUpgraded && whCap > 0n && gold >= 100n;

      if (!loggedMilestones.has("milestone_gold_25") && gold >= 25n) {
        loggedMilestones.add("milestone_gold_25");
        addEvent(nowMs, "milestone", "Reached 25g (crew hire available)");
      }
      if (!loggedMilestones.has("milestone_gold_100") && gold >= 100n) {
        loggedMilestones.add("milestone_gold_100");
        addEvent(nowMs, "milestone", "Reached 100g (warehouse upgrade / 10 influence donation available)");
      }

      const unlocks = new Set(state.unlocks || []);
      const newUnlocks = [];
      for (const u of unlocks) if (!prevUnlocks.has(u)) newUnlocks.push(u);
      if (newUnlocks.length) {
        addEvent(nowMs, "unlock", `+ ${newUnlocks.join(", ")}`);
        prevUnlocks = unlocks;
      }

      // Decision: place first sugar contract as soon as we can afford it.
      // Keep qty small so the initial placement fee is always affordable early-game.
      if (!flags.contractPlaced && gold >= 10n) {
        await goNav("nav-economy");
        await page.selectOption("[data-testid='contracts-commodity']", "sugar");
        await page.fill("[data-testid='contracts-qty']", "10");
        await page.fill("[data-testid='contracts-price']", "1");
        await page.waitForTimeout(50);
        const ok = await clickIfEnabled("[data-testid='contracts-place']");
        if (ok) {
          flags.contractPlaced = true;
          addEvent(nowMs, "decision", `Placed sugar contract at ${portId} (10 @ 1)`);
          state = await readState();
          continue;
        }
      }

      // Decision: collect contracts when something is available and space exists.
      const hasCollectable = (state.economy?.contracts || []).some((c) => toBig(c.filledQty) > toBig(c.collectedQty));
      const hasWarehouseSpace = whCap > 0n && whUsed < whCap;
      if (hasCollectable && hasWarehouseSpace) {
        await goNav("nav-economy");
        const ok = await clickIfEnabled("[data-testid='contracts-collect']");
        if (ok) {
          if (nowMs - lastCollectLogMs >= 15_000) {
            lastCollectLogMs = nowMs;
            addEvent(nowMs, "decision", `Collected contract output at ${portId}`);
          }
          state = await readState();
          continue;
        }
      }

      // Decision: load rum to hold when enough exists for starter run.
      // The engine may require more than route.rumCost (baseline burn); treat 6 as the early target.
      const needRum = unlocks.has("route:starter_run") ? 6n : 0n;
      const vStatus = state.voyage?.status ?? "idle";
      const routeId =
        portId === "home_port" ? "starter_run" : portId === "turtle_cay" ? "turtle_to_home" : portId === "ironhaven" ? "haven_to_home" : null;
      const canUseRoute = routeId ? unlocks.has(`route:${routeId}`) : false;
      const startSel =
        routeId === "starter_run" ? "[data-testid='voyage-start']" : routeId ? `[data-testid='voyage-start-${routeId}']` : null;
      const prepSel =
        routeId === "starter_run" ? "[data-testid='voyage-prepare-starter_run']" : routeId ? `[data-testid='voyage-prepare-${routeId}']` : null;

      const remainingRumNeeded = needRum > holdRum ? needRum - holdRum : 0n;
      if (routeId && canUseRoute && vStatus === "idle" && remainingRumNeeded > 0n && whRum >= remainingRumNeeded && prepSel) {
        await goNav("nav-voyage");
        const ok = await clickIfEnabled(prepSel);
        if (ok) {
          addEvent(nowMs, "decision", `Prepared route ${routeId}`);
          state = await readState();
          continue;
        }
      }

      // Decision: start and collect the first voyage as soon as we can.
      if (routeId && canUseRoute && vStatus === "idle" && startSel && holdRum >= needRum) {
        await goNav("nav-voyage");
        const ok = await clickIfEnabled(startSel);
        if (ok) {
          flags.voyageStarted += 1;
          addEvent(nowMs, "decision", `Started route ${routeId}`);
          state = await readState();
          continue;
        }
      }

      if (state.voyage?.status === "completed") {
        await goNav("nav-voyage");
        const ok = await clickIfEnabled("[data-testid='voyage-collect']");
        if (ok) {
          flags.voyageCollected += 1;
          addEvent(nowMs, "decision", `Collected voyage rewards (voyages=${flags.voyageCollected})`);
          state = await readState();
          continue;
        }
      }

      // Decision: warehouse upgrade as soon as affordable.
      if (canWarehouseUpgrade) {
        await goNav("nav-port");
        const ok = await clickIfEnabled("[data-testid='warehouse-upgrade']");
        if (ok) {
          flags.warehouseUpgraded = true;
          addEvent(nowMs, "decision", "Upgraded warehouse");
          state = await readState();
          continue;
        }
      }

      // Decision: hire 1 crew once affordable.
      if (!flags.crewHired && unlocks.has("crew") && gold >= 25n) {
        await goNav("nav-crew");
        await page.fill("[data-testid='crew-qty']", "1");
        const ok = await clickIfEnabled("[data-testid='crew-hire']");
        if (ok) {
          flags.crewHired = true;
          addEvent(nowMs, "decision", "Hired 1 crew");
          state = await readState();
          continue;
        }
      }

      // Decision: set affiliation and donate for first 10 influence (unlocks cosmetics chain / vanity shop).
      if (unlocks.has("politics")) {
        const inf = state.politics?.influenceByFlagId?.merchants ?? 0;
        if (!flags.affiliationSet) {
          await goNav("nav-politics");
          await page.selectOption("[data-testid='politics-affiliation-flag']", "merchants");
          const ok = await clickIfEnabled("[data-testid='politics-affiliation-set']");
          if (ok) {
            flags.affiliationSet = true;
            addEvent(nowMs, "decision", "Set affiliation: merchants");
            state = await readState();
            continue;
          }
        }
        if (!flags.donated10inf && gold >= 100n && inf < 10) {
          await goNav("nav-politics");
          await page.selectOption("[data-testid='politics-donate-flag']", "merchants");
          await page.fill("[data-testid='politics-donate-gold']", "100");
          const ok = await clickIfEnabled("[data-testid='politics-donate-submit']");
          if (ok) {
            flags.donated10inf = true;
            addEvent(nowMs, "decision", "Donated 100g (aim: 10 influence)");
            state = await readState();
            continue;
          }
        }
      }

      // Decision: shipyard upgrade when affordable (likely later).
      if (!flags.shipyardUpgraded) {
        const nextLevel = (state.shipyard?.level ?? 1) + 1;
        const cost = BigInt(nextLevel) * 300n;
        if (gold >= cost) {
          await goNav("nav-port");
          const ok = await clickIfEnabled("[data-testid='shipyard-upgrade']");
          if (ok) {
            flags.shipyardUpgraded = true;
            addEvent(nowMs, "decision", `Upgraded shipyard to level ${nextLevel}`);
            state = await readState();
            continue;
          }
        }
      }

      await page.evaluate((ms) => window.advanceTime(ms), stepMs);
      state = await readState();

      // Reset one-time contractPlaced flag when no open sugar contract exists at current port (re-arm).
      const hasOpenSugarHere = (state.economy?.contracts || []).some(
        (c) => c.portId === portId && c.commodityId === "sugar" && c.status === "open" && toBig(c.qty) > toBig(c.filledQty)
      );
      if (!hasOpenSugarHere) flags.contractPlaced = false;
    }

    addEvent(toNum(state.meta.nowMs), "summary", `End @ ${msToStamp(toNum(state.meta.nowMs))}`);

    const rows = deltaRows(events);
    const worstGap = rows.reduce((acc, r) => Math.max(acc, r.dtMs), 0);

    process.stdout.write(`# Pacing Trace (10m)\n\n`);
    process.stdout.write(`- url: ${url}\n- seed: ${seed}\n- worst gap: ${Math.round(worstGap / 1000)}s\n\n`);
    process.stdout.write(`| t | Δt | kind | detail |\n|---:|---:|---|---|\n`);
    for (const r of rows) {
      process.stdout.write(`| ${msToStamp(r.nowMs)} | ${Math.round(r.dtMs / 1000)}s | ${r.kind} | ${r.detail} |\n`);
    }
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + "\n");
  process.exit(1);
});
