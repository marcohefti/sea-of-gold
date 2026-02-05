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

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stableKeyState(view) {
  return {
    meta: { version: view?.meta?.version, nowMs: view?.meta?.nowMs, mode: view?.meta?.mode },
    resources: view?.resources,
    location: view?.location,
    unlocks: view?.unlocks,
    economy: {
      contracts: (view?.economy?.contracts || []).map((c) => ({
        id: c.id,
        portId: c.portId,
        commodityId: c.commodityId,
        qty: c.qty,
        bidPrice: c.bidPrice,
        feePaid: c.feePaid,
        filledQty: c.filledQty,
        collectedQty: c.collectedQty,
        status: c.status,
      })),
    },
    production: view?.production,
    voyage: view?.voyage,
    buffs: view?.buffs,
  };
}

function inventoryToV1(inv) {
  return {
    wood: inv.wood,
    sugar: inv.sugar,
    iron: inv.iron,
    stone: inv.stone,
    hemp: inv.hemp,
    rum: inv.rum,
    cannonballs: inv.cannonballs,
    parts: inv.parts,
    repair_kits: inv.repair_kits,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const url = args.url || "http://localhost:5180";
  const seed = args.seed ? Number(args.seed) : 123;
  const outDir = path.resolve(process.cwd(), "e2e", "fixtures");
  const write = args.write !== "false";

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

  mkdirp(outDir);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

    async function readState() {
      const txt = await page.evaluate(() => window.render_game_to_text());
      return JSON.parse(txt);
    }

    async function reset() {
      await page.evaluate((s) => window.__idle.setSeed(s), seed);
      await page.evaluate(() => window.__idle.hardReset());
      await page.waitForSelector("[data-testid='start-new-game']", { state: "visible", timeout: 30_000 });
      await page.waitForTimeout(50);
    }

    async function click(sel) {
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await page.locator(sel).click({ timeout: 30_000 });
          return;
        } catch (err) {
          const msg = String(err?.message || err);
          const retryable = msg.includes("detached from the DOM");
          if (retryable && attempt < maxAttempts) {
            await page.waitForTimeout(100);
            continue;
          }
          throw err;
        }
      }
    }
    async function fill(sel, v) {
      await page.fill(sel, String(v));
    }
    async function select(sel, v) {
      await page.selectOption(sel, String(v));
    }
    async function advance(ms) {
      await page.evaluate((m) => window.advanceTime(m), ms);
    }

    async function waitForUnlock(unlockId) {
      await page.waitForFunction(
        (id) => {
          try {
            const txt = window.render_game_to_text();
            const st = JSON.parse(txt);
            return Array.isArray(st?.unlocks) && st.unlocks.includes(id);
          } catch {
            return false;
          }
        },
        unlockId,
        { timeout: 30_000 }
      );
    }

    async function startNewGame() {
      await click("[data-testid='start-new-game']");
      await page.waitForSelector("[data-testid='work-docks']", { state: "visible", timeout: 30_000 });
    }

    async function completeDockIntro() {
      await startNewGame();
      for (let i = 0; i < 6; i++) {
        await click("[data-testid='work-docks']");
        await advance(5_000);
      }
      await click("[data-testid='upgrade-auto-dockwork']");
      await advance(10_000);
      await page.waitForSelector("[data-testid='nav-economy']", { state: "visible", timeout: 30_000 });
    }

    async function exportSave() {
      return await page.evaluate(() => window.__idle.exportSave());
    }
    async function importSave(save) {
      await page.evaluate((s) => window.__idle.importSave(s), save);
      await page.waitForTimeout(50);
    }

    async function makeSnapshot(name, run) {
      await reset();
      await run();
      const save = await exportSave();
      const before = await readState();

      await page.evaluate(() => window.__idle.hardReset());
      await importSave(save);
      const after = await readState();

      const validation = await page.evaluate(() =>
        typeof window.__idle?.validate === "function" ? window.__idle.validate() : null
      );
      if (!validation || validation.ok !== true) {
        const failPath = path.join(outDir, `${name}.validation_failed.json`);
        fs.writeFileSync(failPath, JSON.stringify({ validation, state: stableKeyState(after) }, null, 2));
        throw new Error(`Engine validation failed for "${name}" (see ${failPath})`);
      }

      const a = stableKeyState(before);
      const b = stableKeyState(after);
      const ok = JSON.stringify(a) === JSON.stringify(b);
      if (!ok) {
        const failPath = path.join(outDir, `${name}.roundtrip_failed.json`);
        fs.writeFileSync(failPath, JSON.stringify({ before: a, after: b }, null, 2));
        throw new Error(`Save roundtrip mismatch for "${name}" (see ${failPath})`);
      }

      const payload = { name, seed, save };
      if (write) {
        const p = path.join(outDir, `${name}.json`);
        fs.writeFileSync(p, JSON.stringify(payload, null, 2));
      }
      return { name, seed, save, view: before };
    }

    const fixtures = [];

    fixtures.push(
      await makeSnapshot("save_fresh", async () => {
        await startNewGame();
      })
    );

    fixtures.push(
      await makeSnapshot("save_after_automation", async () => {
        await completeDockIntro();
      })
    );

    fixtures.push(
      await makeSnapshot("save_after_contracts", async () => {
        await completeDockIntro();
        await click("[data-testid='nav-economy']");
        await select("[data-testid='contracts-commodity']", "wood");
        await fill("[data-testid='contracts-qty']", "10");
        await fill("[data-testid='contracts-price']", "1");
        await sleep(100);
        await click("[data-testid='contracts-place']");
        await advance(5_000);
      })
    );

    fixtures.push(
      await makeSnapshot("save_after_cannon", async () => {
        await completeDockIntro();
        await click("[data-testid='nav-economy']");
        await select("[data-testid='contracts-commodity']", "wood");
        await fill("[data-testid='contracts-qty']", "1");
        await fill("[data-testid='contracts-price']", "0");
        await sleep(100);
        await click("[data-testid='contracts-place']");
        await advance(1_000);
        await waitForUnlock("minigame:cannon");
        await click("[data-testid='minigame-cannon-open']");
        await click("[data-testid='minigame-cannon-start']");
        await advance(25_000);
      })
    );

    fixtures.push(
      await makeSnapshot("save_after_starter_voyage", async () => {
        await completeDockIntro();
        await click("[data-testid='nav-economy']");
        await select("[data-testid='contracts-commodity']", "sugar");
        await fill("[data-testid='contracts-qty']", "10");
        await fill("[data-testid='contracts-price']", "1");
        await sleep(100);
        await click("[data-testid='contracts-place']");
        await advance(25_000);
        await click("[data-testid='contracts-collect']");
        await advance(20_000);
        await waitForUnlock("voyage");
        await page.waitForSelector("[data-testid='nav-voyage']", { state: "visible", timeout: 30_000 });
        await click("[data-testid='nav-voyage']");
        await click("[data-testid='voyage-prepare-starter_run']");
        await click("[data-testid='voyage-start']");
        await advance(35_000);
        await click("[data-testid='voyage-collect']");
      })
    );

    // Legacy fixture: remove newer fields but keep version literal the same.
    // Uses the "starter voyage" fixture as the base.
    const base = JSON.parse(fixtures[fixtures.length - 1].save);
    const legacy = JSON.parse(JSON.stringify(base));
    delete legacy.client;

    // production v1 shape
    if (legacy.state?.production?.jobs?.distill_rum) {
      legacy.state.production = { distillery: legacy.state.production.jobs.distill_rum };
    }

    // politics v1 shape
    if (legacy.state?.politics?.affiliationFlagId && legacy.state?.politics?.influenceByFlagId) {
      const aff = legacy.state.politics.affiliationFlagId;
      const inf = legacy.state.politics.influenceByFlagId?.[aff] ?? 0;
      legacy.state.politics = { affiliationFlagId: aff, influence: inf };
    }

    // inventory v1 shape (drop later commodities)
    if (legacy.state?.storage?.shipHold?.inv) {
      legacy.state.storage.shipHold.inv = inventoryToV1(legacy.state.storage.shipHold.inv);
    }
    if (legacy.state?.storage?.warehouses) {
      for (const wh of Object.values(legacy.state.storage.warehouses)) {
        if (wh?.inv) wh.inv = inventoryToV1(wh.inv);
      }
    }

    // minigames v1 shape (no rigging)
    if (legacy.state?.minigames?.cannon) legacy.state.minigames = { cannon: legacy.state.minigames.cannon };

    if (write) {
      fs.writeFileSync(path.join(outDir, "save_legacy_v1.json"), JSON.stringify({ name: "save_legacy_v1", seed, save: JSON.stringify(legacy) }, null, 2));
    }

    process.stdout.write(`Stress saves OK. Wrote fixtures to ${outDir}\n`);
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + "\n");
  process.exit(1);
});
