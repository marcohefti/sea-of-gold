#!/usr/bin/env node
import fs from "node:fs";
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

function stableResultShape(r) {
  return {
    url: r.url,
    seed: r.seed,
    horizonMin: r.horizonMin,
    measureMin: r.measureMin,
    setupNowMs: r.setupNowMs,
    measureStartNowMs: r.measureStartNowMs,
    measureEndNowMs: r.measureEndNowMs,
    goldStart: r.goldStart,
    goldEnd: r.goldEnd,
    goldDelta: r.goldDelta,
    goldPerMin: r.goldPerMin,
    unlocks: r.unlocks,
    notes: r.notes,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const url = args.url || "http://localhost:5180";
  const seed = args.seed ? Number(args.seed) : 1;
  const horizonMin = args.minutes ? Number(args.minutes) : 60;
  const measureMin = args.measureMinutes ? Number(args.measureMinutes) : 30;
  const outFile = args.outFile ? path.resolve(process.cwd(), String(args.outFile)) : path.resolve(process.cwd(), "scripts", "scaling_audit_baseline.json");
  const write = args.write === "true";

  const horizonMs = Math.max(1, Math.trunc(horizonMin * 60_000));
  const measureMs = Math.max(1, Math.trunc(measureMin * 60_000));

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

    const ensureStarted = async () => {
      await page.evaluate((s) => window.__idle.setSeed(s), seed);
      await page.evaluate(() => window.__idle.hardReset());
      await page.waitForTimeout(50);
      await page.click("[data-testid='start-new-game']");
      await page.waitForTimeout(50);
    };

    const placeContract = async (commodityId, qty, bidPrice) => {
      await goNav("nav-economy");
      await page.selectOption("[data-testid='contracts-commodity']", commodityId);
      await page.fill("[data-testid='contracts-qty']", String(qty));
      await page.fill("[data-testid='contracts-price']", String(bidPrice));
      await page.waitForTimeout(50);
      return await clickIfEnabled("[data-testid='contracts-place']");
    };

    const collectContracts = async () => {
      await goNav("nav-economy");
      let did = false;
      for (let i = 0; i < 4; i++) {
        const ok = await clickIfEnabled("[data-testid='contracts-collect']");
        if (!ok) break;
        did = true;
      }
      return did;
    };

    const loadRumToHold = async (qty) => {
      await goNav("nav-port");
      await page.selectOption("[data-testid='cargo-commodity']", "rum");
      await page.fill("[data-testid='cargo-qty']", String(qty));
      return await clickIfEnabled("[data-testid='cargo-load']");
    };

    const startVoyageHere = async (state) => {
      await goNav("nav-voyage");
      const portId = state.location?.id ?? "home_port";
      if (portId === "home_port") return await clickIfEnabled("[data-testid='voyage-start']");
      if (portId === "turtle_cay") return await clickIfEnabled("[data-testid='voyage-start-turtle_to_home']");
      if (portId === "ironhaven") return await clickIfEnabled("[data-testid='voyage-start-haven_to_home']");
      return false;
    };

    const prepareVoyageHere = async (state) => {
      await goNav("nav-voyage");
      const portId = state.location?.id ?? "home_port";
      if (portId === "home_port") return await clickIfEnabled("[data-testid='voyage-prepare-starter_run']");
      if (portId === "turtle_cay") return await clickIfEnabled("[data-testid='voyage-prepare-turtle_to_home']");
      if (portId === "ironhaven") return await clickIfEnabled("[data-testid='voyage-prepare-haven_to_home']");
      return false;
    };

    const collectVoyage = async () => {
      await goNav("nav-voyage");
      return await clickIfEnabled("[data-testid='voyage-collect']");
    };

    const ensureCannonBuff = async (state) => {
      const buff = (state.buffs || []).find((b) => b.id === "cannon_volley");
      if (buff && toNum(buff.remainingMs, 0) > 10_000) return false;
      await clickIfEnabled("[data-testid='minigame-cannon-open']");
      const ok = await clickIfEnabled("[data-testid='minigame-cannon-start']");
      if (ok) {
        await advance(25_000);
        return true;
      }
      return false;
    };

    const toggleRecipe = async (recipeId) => {
      await goNav("nav-port");
      return await clickIfEnabled(`[data-testid='recipe-toggle-${recipeId}']`);
    };

    const donateForCosmeticsChain = async (flagId) => {
      await goNav("nav-politics");
      await page.selectOption("[data-testid='politics-affiliation-flag']", flagId);
      await clickIfEnabled("[data-testid='politics-affiliation-set']");
      await page.selectOption("[data-testid='politics-donate-flag']", flagId);
      await page.fill("[data-testid='politics-donate-gold']", "100");
      await clickIfEnabled("[data-testid='politics-donate-submit']");
    };

    const buyVanity = async (itemId) => {
      await goNav("nav-port");
      return await clickIfEnabled(`[data-testid='vanity-buy-${itemId}']`);
    };

    const contributeFlagshipTimes = async (n) => {
      await goNav("nav-port");
      let did = 0;
      for (let i = 0; i < n; i++) {
        const ok = await clickIfEnabled("[data-testid='flagship-contribute']");
        if (!ok) break;
        did++;
      }
      return did;
    };

    await ensureStarted();
    let state = await readState();

    const notes = [];
    const startNowMs = toNum(state.meta?.nowMs ?? 0);
    if (startNowMs !== 0) notes.push(`nonzero start nowMs=${startNowMs}`);

    // Setup: reach Turtle Cay, unlock cosmetics chain, buy banner, build flagship.
    // 1) Get rum and complete starter run to Turtle Cay.
    await advance(12_000);
    state = await readState();
    if (toNum(state.resources?.gold ?? 0) >= 10) {
      await placeContract("sugar", 10, 1);
      await advance(25_000);
      await collectContracts();
      await advance(20_000); // distill
      await loadRumToHold(6);
      await goNav("nav-voyage");
      await clickIfEnabled("[data-testid='voyage-start']");
      await advance(35_000);
      await collectVoyage();
    }

    // 2) Ensure politics is unlocked and unlock cosmetics chain via donation.
    await advance(120_000);
    state = await readState();
    if ((state.unlocks || []).includes("politics")) {
      await donateForCosmeticsChain("freebooters");
    } else {
      notes.push("politics not unlocked during setup; skipping donation");
    }

    // 3) At Turtle Cay, stock hemp+herbs and run cosmetics production.
    state = await readState();
    if (state.location?.id !== "turtle_cay") {
      // try to reach turtle cay quickly
      await goNav("nav-voyage");
      await clickIfEnabled("[data-testid='voyage-start']");
      await advance(35_000);
      await collectVoyage();
    }

    // Place contracts (costly), advance to fill, collect.
    await placeContract("hemp", 30, 1);
    await placeContract("herbs", 30, 1);
    await advance(120_000);
    await collectContracts();
    await collectContracts();

    // Enable cosmetics recipes if unlocked.
    state = await readState();
    if ((state.unlocks || []).includes("recipe:brew_dye")) {
      await toggleRecipe("brew_dye");
      await toggleRecipe("weave_cloth");
      await toggleRecipe("tailor_cosmetics");
      await advance(420_000);
    } else {
      notes.push("cosmetics chain not unlocked; skipping production setup");
    }

    // Push cosmetics high enough for banner + flagship contributions (65).
    state = await readState();
    const cosmetics = toNum(state.resources?.cosmetics ?? 0);
    if (cosmetics < 65) {
      await placeContract("hemp", 50, 1);
      await placeContract("herbs", 50, 1);
      await advance(180_000);
      await collectContracts();
      await collectContracts();
      await advance(420_000);
    }

    // Buy banner if available.
    await buyVanity("captain_banner");

    // Ensure enough cosmetics for flagship and contribute 3x.
    await advance(60_000);
    await contributeFlagshipTimes(3);

    state = await readState();
    const setupNowMs = toNum(state.meta?.nowMs ?? 0);
    if (!(state.unlocks || []).includes("flagship_built")) notes.push("flagship not built in setup window");
    if (!(state.unlocks || []).includes("vanity:captain_banner")) notes.push("captain_banner not purchased in setup window");

    // Measurement segment: run repeated short voyages with cannon buff uptime.
    const measureStartNowMs = toNum(state.meta?.nowMs ?? 0);
    const goldStart = toNum(state.resources?.gold ?? 0);

    // Ensure we stay within total horizon.
    const hardStopNowMs = Math.min(horizonMs, measureStartNowMs + measureMs);
    while (toNum(state.meta?.nowMs ?? 0) < hardStopNowMs) {
      // Maintain some sugar supply for rum at Turtle Cay and Home Port.
      await placeContract("sugar", 30, 1);
      await collectContracts();

      await ensureCannonBuff(state);
      state = await readState();

      if (state.voyage?.status === "completed") {
        await collectVoyage();
        state = await readState();
        continue;
      }
      if (state.voyage?.status === "running") {
        await advance(30_000);
        state = await readState();
        continue;
      }

      // Prepare hold to the minimum required and start the local return loop.
      await prepareVoyageHere(state);
      state = await readState();
      const started = await startVoyageHere(state);
      if (!started) {
        // If we couldn't start (likely rum shortage), give the sim time to produce more.
        await advance(15_000);
        state = await readState();
      } else {
        await advance(30_000);
        state = await readState();
      }
    }

    state = await readState();
    const measureEndNowMs = toNum(state.meta?.nowMs ?? 0);
    const goldEnd = toNum(state.resources?.gold ?? 0);
    const goldDelta = goldEnd - goldStart;
    const dtMin = Math.max(1e-9, (measureEndNowMs - measureStartNowMs) / 60_000);
    const goldPerMin = goldDelta / dtMin;

    const result = stableResultShape({
      url,
      seed,
      horizonMin,
      measureMin,
      setupNowMs,
      measureStartNowMs,
      measureEndNowMs,
      goldStart,
      goldEnd,
      goldDelta,
      goldPerMin,
      unlocks: state.unlocks || [],
      notes,
    });

    if (write) {
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    }

    const prev = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : null;
    if (!write && prev && prev.seed === seed && prev.url === url && prev.measureMin === measureMin) {
      const before = prev.goldPerMin;
      const after = result.goldPerMin;
      process.stdout.write(
        [
          "# Scaling Audit",
          "",
          `- measure: ${measureMin}m (${msToStamp(result.measureStartNowMs)} → ${msToStamp(result.measureEndNowMs)})`,
          `- gold/min (baseline file): ${Number(before).toFixed(2)}`,
          `- gold/min (current): ${Number(after).toFixed(2)}`,
          `- delta: ${(after - before).toFixed(2)} (${(((after - before) / before) * 100).toFixed(1)}%)`,
          "",
          "Current run JSON:",
          JSON.stringify(result, null, 2),
          "",
        ].join("\n")
      );
    } else {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
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

