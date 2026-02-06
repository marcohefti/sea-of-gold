Original prompt: You are building “Sea of Gold”, a single-player web-based idle/incremental game with modern UI and deep progression.\n\nYou MUST follow these repo docs as the spec:\n- sea-of-gold/AGENTS.md (process + non-negotiables)\n- sea-of-gold/concept.md (design direction)\n- sea-of-gold/acceptance.md (source of truth for Milestone 1)\n\nGOAL: Implement Milestone 1 end-to-end and make the Playwright harness pass with deterministic stepping.\n\nTech / Repo (do this first)\n- Create a pnpm monorepo with:\n  - apps/web: Next.js (App Router) + React + Tailwind + shadcn/ui\n  - packages/engine: pure deterministic sim (no DOM, no timers, no Date.now/Math.random)\n  - packages/shared: types + schemas (Zod) + formatting\n- Add progress.md at repo root:\n  - First line: “Original prompt: <paste this entire prompt>”\n  - Append short notes after each meaningful chunk + each test run.\n\nDeterministic harness contract (mandatory)\nIn the web app, expose:\n- window.render_game_to_text(): string\n  - returns concise JSON with raw values (no “1.2K” formatting)\n  - must include meta{version, nowMs, mode}, resources{gold}, unlocks[]\n  - plus economy{contracts[]} and buffs[] for Milestone 1\n- window.advanceTime(ms): deterministically advances the engine exactly ms\n- window.__idle = { version, exportSave(), importSave(str), hardReset(), setSeed(n) }\n\nNon-negotiables\n- Stable data-testid selectors as listed in sea-of-gold/acceptance.md (do not rename once added).\n- Save system is versioned and deterministic; roundtrip must pass.\n- Simulation is deterministic: inject RNG + clock; no Math.random/Date.now inside engine.\n- After each meaningful change: run the Playwright harness and fix the first failure/console error before continuing.\n\nImplementation plan (Milestone 1 scope)\n1) Engine (packages/engine)\n- Define GameState with:\n  - simNowMs (starts at 0)\n  - resources: gold (integer-like; use BigInt or integer-string)\n  - economy.contracts[] with {commodityId, qty, bidPrice, feePaid, filledQty, status}\n  - buffs[] with {id, remainingMs}\n  - unlocks[] and mode (“title” | “port”)\n- Implement:\n  - applyAction(state, action)\n  - advance(state, dtMs) fixed-step accumulator\n  - seeded RNG (store rng state in save)\n  - deterministic contract filling over time\n  - deterministic dock income (gold/sec)\n  - deterministic buff ticking/expiry\n\n2) UI (apps/web)\n- Title screen with Start button [data-testid='start-new-game'].\n- Port screen with left nav:\n  - nav-port, nav-economy, nav-crew, nav-voyage, nav-politics\n  - economy module with contract form + list:\n    - contracts-open, contracts-place, contracts-collect\n    - contracts-commodity, contracts-qty, contracts-price\n- Minigame entry points:\n  - minigame-cannon-open, minigame-cannon-start\n- Use shadcn/ui components + Tailwind; keep layout “Melvor-like dense panels”.\n\n3) Minigame (Cannon Volley)\n- Implement a simple deterministic 20–40s rhythm/timing minigame.\n- For Milestone 1, it can be “press when indicator is in a zone”.\n- Outcome must deterministically grant either:\n  - buffs include {id:\"cannon_volley\", remainingMs: ...}, OR\n  - a gold burst.\n- Add the required data-testid hooks.\n\n4) Save system\n- exportSave(): string (JSON, versioned)\n- importSave(str)\n- hardReset(): resets to title + clears save state deterministically\n- setSeed(seed): sets RNG seed used for new game / deterministic runs\n- Ensure save roundtrip subset equality passes (resources/unlocks/location when present).\n\n5) E2E actions file\n- Create ./e2e/action_payloads.json with scenarios:\n  - smoke\n  - contracts_basic\n  - minigame_cannon_basic\n- Each scenario MUST include at least one “expect” that proves progress occurred.\n\n6) Verification loop\n- Run (from your environment):\n  export CODEX_HOME=\"${CODEX_HOME:-$HOME/.codex}\"\n  export IDLE_GAME_CLIENT=\"$CODEX_HOME/skills/develop-idle-game/scripts/idle_game_playwright_client.js\"\n  node \"$IDLE_GAME_CLIENT\" --url http://localhost:3000 --actions-file ./e2e/action_payloads.json --scenario smoke\n- Fix the first failing expectation or console error, then re-run.\n- Repeat for contracts_basic and minigame_cannon_basic.\n\nDeliverable definition\n- All Milestone 1 acceptance items pass.\n- Harness exits 0, no console errors.\n- Screenshots show a real title screen, port screen, economy screen, and minigame flow (not blank).\n- progress.md is updated with notes and TODOs.

---

Log:
- 2026-02-04: Initialized project; starting Milestone 1 scaffold.
- 2026-02-04: Scaffolded pnpm workspace + Next.js app (`apps/web`) + engine/shared packages; added port-picker dev script (5180–5189).
- 2026-02-04: Implemented deterministic engine: dock income, contracts filling, buff ticking/expiry, Cannon Volley minigame.
- 2026-02-04: Wired web UI with required `data-testid` selectors + window harness API (`render_game_to_text`, `advanceTime`, `__idle.*`).
- 2026-02-04: Added `e2e/action_payloads.json` with `smoke`, `contracts_basic`, `minigame_cannon_basic`.

Decisions:
- Dock income: 1 gold/sec (simple baseline for deterministic stepping + early progress).
- Contracts: fee = 1 gold per unit requested; fill = 1 unit/sec (keeps early loop cheap + predictable).
- Cannon Volley: 20s duration; always grants `cannon_volley` buff on completion (tiered duration by hits; ensures visible result for Milestone 1).

Harness runs (port 5180):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_212038`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_212049`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_212101`)

- 2026-02-04: Added real-time stepping via `requestAnimationFrame` for human play; auto-disabled when `navigator.webdriver` is true to keep Playwright deterministic.

Harness reruns (determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_213347`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_213402`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_213414`)

- 2026-02-04: Added Phase 0 commodity resources (`wood`, `sugar`, `rum`) and contract `collectedQty`; collecting contracts now transfers filled commodity into resources (partial collection supported).

Harness reruns (post-commodities, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_213657`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_213711`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_213727`)

- 2026-02-04: Added Distillery (sugar → rum over time) + starter Voyage (consumes rum, yields gold; `cannon_volley` buff increases payout by 20%).

Harness reruns (post-distillery+voyage, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_214140`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_214153`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_214206`)

- 2026-02-04: Added `phase0_loop` scenario to exercise the intended Phase 0 loop (contracts → sugar → distillery → rum → voyage, with Cannon Volley buff affecting payout).

Harness run:
- phase0_loop: PASS (determinism-check: full, artifacts: `.codex-artifacts/idle-game/20260204_214344`)

- 2026-02-04: Added warehouse capacity (cap=50, used=wood+sugar+rum) + upgrade sink (+50 cap for 100 gold); contract collection respects free capacity (no loss; uncollected stays on contract).

Harness reruns (post-warehouse, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_214652`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_214707`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_214718`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_214729`)

- 2026-02-04: Added shared data-driven catalogs (commodities/flags/islands/ship classes/routes/recipes) with Zod validation for stable IDs and future expansion.

Harness run:
- smoke: PASS (determinism-check: full, artifacts: `.codex-artifacts/idle-game/20260204_220113`)

- 2026-02-04: Refactored engine + save + UI to introduce ports (location) and per-port warehouses + ship hold (logistics foundation). Fixed Zod `record` schema for warehouse maps.

Harness run:
- smoke: PASS (determinism-check: full, artifacts: `.codex-artifacts/idle-game/20260204_221055`)

Harness reruns (post-ports+warehouses, determinism-check: full):
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_221124`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_221138`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_221151`)

- 2026-02-04: Replaced per-contract fill ticking with port supply spawn (units/min per island commodity) allocated to open contracts by bid priority; added deterministic spawn accumulators to save state.

Harness runs (post-contract-spawn):
- smoke: PASS (determinism-check: full, artifacts: `.codex-artifacts/idle-game/20260204_221540`)
- contracts_basic: PASS (determinism-check: full, artifacts: `.codex-artifacts/idle-game/20260204_221730`)
- phase0_loop: PASS (determinism-check: full, artifacts: `.codex-artifacts/idle-game/20260204_221752`)

- 2026-02-04: Fixed dev port picker to avoid IPv6 false positives (port appears free on 127.0.0.1 but busy on ::); cleaned up a stale `next dev` instance so port selection works reliably.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_222658`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_222712`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_222722`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_222732`)

- 2026-02-04: Implemented basic cargo logistics: transfers between per-port warehouse and ship hold; voyages now consume rum from the hold (not directly from the warehouse).

Decisions:
- Voyages consume supplies from the ship hold to make logistics meaningful early; warehouse remains the long-term storage per port.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_223413`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_223424`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_223436`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_223447`)

- 2026-02-04: Added a minimal politics/influence counter (voyages grant influence) and expanded starter routes to include return trips; voyage UI now lists routes from the current port and locks/unlocks them via `unlocks` (`route:*`).

Decisions:
- Phase 0 starts with a single voyage route (`route:starter_run`); collecting it once unlocks the remaining starter routes between the 3 islands (clear ladder, minimal gating).

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_223901`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_223910`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_223922`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_223935`)

- 2026-02-04: Added ship condition + deterministic wear during voyages, plus a basic gold-based repair action (sink) and ship state in `render_game_to_text`.

Decisions:
- Ship wear: `4 condition / minute` during voyages (keeps early repairs infrequent but meaningful); repair restores `+20` for `50 gold`.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_224547`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_224601`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_224614`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_224627`)

- 2026-02-04: Refactored production into data-driven `production.jobs` keyed by recipeId (with save migration from the old `production.distillery` shape); distilling is now `distill_rum` job toggled via `PRODUCTION_SET_ENABLED`.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_225229`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_225241`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_225254`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_225306`)

- 2026-02-04: Added Phase 1 crafting UI (forge cannonballs, craft parts, assemble repair kits) backed by `production.jobs`; contracts UI now offers commodities produced by the current port; ship repair now prefers consuming `repair_kits` at the current port warehouse.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_225644`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_225655`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_225707`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_225719`)

- 2026-02-04: Moved RNG into engine `GameState.rng` (seeded via `makeInitialState(seed)`); save payload continues to store rng separately and rehydrates state deterministically on import.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_230049`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_230101`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_230115`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_230127`)

- 2026-02-04: Added deterministic voyage encounters (cannonball spend + small penalties) generated from stable keys (seed + routeId + voyageIndex), plus time-based rum consumption during voyages; save now persists `settings.seed`, `stats.voyagesStarted`, and voyage encounter state.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_230913`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_230927`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_230939`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_230953`)

- 2026-02-04: Enabled meaningful early rum upkeep by setting the starter ship (`sloop`) to consume rum over time (`rumPerMinute=2`); updated the Phase 0 e2e loop to distill and load the additional rum needed for the starter voyage.

Harness run (port 5180, determinism-check: full):
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_231254`)

- 2026-02-04: Implemented Phase 1 crew system: hire/fire crew (capacity = ship class crewCap), deterministic wage drain (gold/min per crew), and basic Sailing/Gunnery XP gains from voyages + Cannon Volley.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_231718`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_231735`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_231755`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_231812`)

- 2026-02-04: Extended `render_game_to_text()` to include `voyage.encounters[]` for deterministic assertions in future Phase 1+ scenarios.

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_231906`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260204_231922`)

- 2026-02-04: Added Phase 1 E2E scenario `phase1_cannonballs_encounter` (contracts → rum → unlock routes → travel → forge cannonballs → succeed an encounter deterministically).

Harness run (port 5180, determinism-check: full):
- phase1_cannonballs_encounter: PASS (artifacts: `.codex-artifacts/idle-game/20260204_232306`)

- 2026-02-04: Implemented Phase 2 shipyard: buy `brig`/`galleon` (updates hold cap and ship class; blocks downsizing when over cap).

Harness run (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_232646`)

- 2026-02-04: Scope expanded per user request: implement full `concept.md` (Phases 0–3) while keeping Milestone 1 acceptance passing.

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_233735`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_233748`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_233800`)

TODO (Concept Phase 2+):
- Politics: affiliation + influence actions, make taxes/fees matter, UI (no longer “Coming soon”).
- Second minigame (rigging run or fishing) with deterministic rewards + stacking rules.
- Dye/cloth/cosmetics chain + vanity sink (permanent unlocks).
- Phase 3: fleet management (2–5 ships), route automation presets (“captain’s ledger”), conquest campaigns, endgame sinks (flagship + shipyard upgrades + island taxes).

---

2026-02-05: Added smallest viable Politics perk loop: **Tax Relief Campaign**.
- Engine: `POLITICS_CAMPAIGN_START_TAX_RELIEF` / `POLITICS_CAMPAIGN_ABORT`; deterministic 60s campaign, then applies `tax_relief` perk (-200bps effective tax) for 10m at the current port.
- Engine: `getFactionStandingForUi()` now reports `hostile|neutral|friendly` and `getTaxReliefCampaignForUi()` provides campaign numbers for UI.
- Engine: port tax now accounts for `politics.portPerksByIslandId[portId]` (no effect unless perk exists).
- UI: Politics panel now includes “Tax Relief Campaign” card with stable selectors:
  - `politics-taxrelief-start`
  - `politics-taxrelief-abort`
- Harness state: `render_game_to_text()` now includes `politics.standingByFlagId`, `politics.campaign`, `politics.portPerksByIslandId`, and `politics.currentPort.{baseTaxBps,effectiveTaxBps,perkDiscountBps}` for deterministic assertions.

Decisions:
- Tax relief campaign: requires 5 influence with the current controller + costs `50g * portTier` (non-refundable); duration 60s; perk duration 10m; perk discount 200bps.
- Standing thresholds: friendly at score >= 10 (or affiliated), neutral at score >= 0, hostile otherwise; score includes a small penalty when affiliated with a different non-player flag.

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_065609`, `.codex-artifacts/idle-game/20260205_070705`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_065610`, `.codex-artifacts/idle-game/20260205_070747`, `.codex-artifacts/idle-game/20260205_071015`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_065611`, `.codex-artifacts/idle-game/20260205_070749`)
- phase2_politics_tax_discount: PASS (artifacts: `.codex-artifacts/idle-game/20260205_065634`, `.codex-artifacts/idle-game/20260205_070750`, `.codex-artifacts/idle-game/20260205_071016`)
- politics_tax_relief_campaign_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_065754`, `.codex-artifacts/idle-game/20260205_070638`)
- playability_audit_10min: PASS (artifacts: `.codex-artifacts/idle-game/20260205_065839`)
- contracts_strategy_levers_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_070203`)
- voyage_chart_unlock_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_070227`)
- minigame_cannon_spam_guard: PASS (artifacts: `.codex-artifacts/idle-game/20260205_070248`)
- save_import_legacy_fixture: PASS (artifacts: `.codex-artifacts/idle-game/20260205_070313`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260205_070337`)
- phase1_cannonballs_encounter: PASS (artifacts: `.codex-artifacts/idle-game/20260205_070338`)

2026-02-05: UX improvement: surfaced port perks and politics campaign timers in the top bar (port perk pill + `campaign …ms` timer string).
- Rerun: politics_tax_relief_campaign_basic PASS (artifacts: `.codex-artifacts/idle-game/20260205_070638`)

2026-02-05: Connected Economy → Politics by granting **trade influence** when collecting contract goods.
- Rule: +1 influence per 20 units collected (floored) with the current controller of the port.
- New E2E: `politics_influence_from_contracts_basic` PASS (artifacts: `.codex-artifacts/idle-game/20260205_070951`)

Build/Checks:
- `pnpm -r build`: PASS
- `pnpm check:determinism`: PASS
- `pnpm check:saves`: PASS (regenerated `e2e/fixtures/*`)

Headed playtest (scripted, slow-mo):
- playability_tour_short: PASS (artifacts: `.codex-artifacts/idle-game/20260205_071308`)

Playtest audit — top gaps (as of 2026-02-05):

Acceptance failures:
- None observed; Milestone 1 scenarios and determinism/save roundtrip checks are passing.

Concept coverage gaps:
1) Faction standing has limited gameplay impact (mostly taxes/labels); needs more tangible levers (prices, access, voyage modifiers, etc.).
2) Contracts market is static (fixed supply rates); no competing demand/price movement (still deterministic, but less “market feel”).
3) Crew XP has no level-ups/perks yet (XP accrues but doesn’t unlock modifiers or choices).
4) Ship class tradeoffs are still light (hold/condition exist; needs clearer speed/operating-cost/combat differentiation and meaningful choices).
5) “Captain’s ledger” / automation presets are minimal (automation exists but lacks saved presets / route priorities / QoL).
6) Logistics tension could be sharper (warehouse/hold caps exist; still missing an explicit overflow buffer rule + better “blocked by capacity” feedback).

UX clarity gaps:
1) Taxes are presented in bps; add clearer percent labeling and “before/after” explanations at point-of-decision (contracts/voyage).
2) Contract placement failures are mostly silent (e.g., slot cap) — show a deterministic, non-spam feedback line on no-op actions.
3) Storage pressure is easy to miss; surface “free space” and “blocked collection/production” more prominently.

---

2026-02-05: Regression sweep (all e2e scenarios).
- Ran all 26 scenarios with `--determinism-check full` (artifacts root: `.codex-artifacts/idle-game/regression_20260205_071642`).
- Console scan: no `warning`/`error` entries across scenarios.

Visual fixes:
1) Top bar pills were overly wide and wrapped awkwardly (especially perk/buff durations).
   - Switched perk/buff pills to compact duration formatting and `whitespace-nowrap`.
   - Made the right side of the top bar `flex-wrap` to avoid overflow/clipping on narrower widths.
   - Verified via reruns:
     - politics_tax_relief_campaign_basic PASS (artifacts: `.codex-artifacts/idle-game/20260205_072342`, `.codex-artifacts/idle-game/20260205_072717`)
     - minigame_cannon_basic PASS (artifacts: `.codex-artifacts/idle-game/20260205_072420`)

---

- 2026-02-04: Implemented Politics UI (affiliation + donations + influence table) and wired engine actions.
- 2026-02-04: Contracts now charge tier+tax adjusted placement fees (still deterministic; home port remains 1g/unit).

Decisions:
- Contract fee model: base = 1g/unit, then apply +5% per island tier above 1 and controller tax (bps). If affiliated with the controller flag, tax discount = 10 influence ⇒ -1% tax (floored), capped at removing all tax.
- Donations: 10g ⇒ +1 influence (floored); donations spend only full 10g blocks.

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_234142`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_234154`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_234208`)

- 2026-02-04: Added Phase 2 e2e scenario `phase2_politics_tax_discount` (affiliation + donation increases influence; contract fee reflects discounted tax).

Harness run (port 5180, determinism-check: full):
- phase2_politics_tax_discount: PASS (artifacts: `.codex-artifacts/idle-game/20260204_234358`)

- 2026-02-04: Implemented Phase 2 minigame “Rigging Run” (deterministic window from seeded RNG; yields `rigging_run` buff).

Decisions:
- Rigging Run reward: grants `rigging_run` buff (base 5m, tiered duration by good tugs) and adds Sailing XP = good tugs.
- `rigging_run` effect: -25% baseline rum usage during voyages; stacking rule matches other buffs (refresh to max remaining).

Harness runs (port 5180, determinism-check: full):
- phase2_rigging_run_efficiency: PASS (artifacts: `.codex-artifacts/idle-game/20260204_234911`)
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260204_234925`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_234938`)
- minigame_cannon_basic: FAIL (engine error: `tickCannonMinigame` overwrote `minigames` and dropped `rigging`; fixed by spreading `state.minigames`).
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260204_235138`)

- 2026-02-05: Added dye/cloth/cosmetics commodities + recipes and a Vanity Shop sink (Phase 2).

Decisions:
- Cosmetics chain: `herbs -> dye`, `hemp -> cloth`, `dye + cloth -> cosmetics` (all deterministic via production jobs).
- Unlock ladder: cosmetics chain + `vanity_shop` unlock when influence with your affiliated flag reaches 10+ (checked on donations, affiliation changes, and voyage influence gains).
- Vanity items (stable IDs): `vanity:warehouse_signage` (+20 cap all ports), `vanity:ship_figurehead` (+10 max ship condition), `vanity:captain_banner` (+5% voyage gold permanently).

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_000150`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_000208`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_000220`)
- phase2_cosmetics_vanity_signage: PASS (artifacts: `.codex-artifacts/idle-game/20260205_000259`)

- 2026-02-05: Implemented Phase 3 fleet management (2–5 ships), per-ship automation presets, and a “Fleet” ledger panel.

Decisions:
- Fleet model: one active ship + additional ships stored in `state.fleet.ships`; switching active ship swaps all per-ship state (location/hold/crew/voyage/automation) deterministically.
- Automation preset: choose a base route; when docked at the “other end”, the engine auto-picks the return route if unlocked. Auto-start requires rum in that ship’s hold; auto-collect applies rewards/unlocks/influence immediately.

Harness runs (port 5180, determinism-check: full):
- phase3_fleet_automation_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_002054`)
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_002114`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_002125`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_002137`)

---

- 2026-02-05: Implemented Phase 3 conquest campaigns + endgame sinks (shipyard upgrades, flagship construction) and added UI wiring + E2E scenarios.

Decisions:
- Conquest campaign: 3 staged minutes (3 × 60s). Requirements: tier × 20 influence; cost: tier × 200 gold war chest (non-refundable). Victory updates `world.controllerByIslandId` and unlocks `conquest:<islandId>`.
- Shipyard upgrades: level 1–4, cost = nextLevel × 300 gold; each upgrade increases `fleet.maxShips` by +1 (cap 5).
- Flagship: 3 contributions; each costs 200 gold + 5 cosmetics; unlocks `flagship_built` (+20% voyage gold permanently).
- New stable selectors added: `conquest-target`, `conquest-start`, `conquest-abort`, `shipyard-upgrade`, `flagship-contribute`.

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_003611`)
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004223`)
- phase3_shipyard_upgrade_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004427`)
- phase3_conquest_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004439`)
- phase3_flagship_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004450`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004527`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004539`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004554`)
- phase1_cannonballs_encounter: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004608`)
- phase2_politics_tax_discount: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004641`)
- phase2_rigging_run_efficiency: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004659`)
- phase2_cosmetics_vanity_signage: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004712`)
- phase3_fleet_automation_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_004735`)

---

- 2026-02-05: QoL + economy friction pass to better match concept pillars (clear goals, offline-like quick advance, contract cancel sink).

Decisions:
- Added “Captain’s Ledger” quick-advance (minutes → deterministic `advanceTime`, capped at 24h) as a testable offline surrogate without wall-clock coupling.
- Added “Next Goals” panel that derives the next objective from raw state (no delta math in UI).
- Added contract cancellation: marks contract as `canceled` (fee remains sunk), and canceled contracts no longer fill.

Harness runs (port 5180, determinism-check: full):
- ui_quick_advance_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_005711`)
- contracts_cancel_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_005842`)
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_005907`)
- phase3_conquest_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_005920`)
- phase3_shipyard_upgrade_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_005926`)
- phase3_flagship_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_005929`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_010155`)

---

- 2026-02-05: Voyage clarity pass (prep + encounter timeline) to reinforce “voyages are the hub” and reduce confusion about hidden baseline rum costs.

Decisions:
- Exposed engine helper `getVoyageStartRequirements()` for UI: consistent rum total (fare + baseline + rigging efficiency) and expected cannonballs.
- Added `VOYAGE_PREPARE` action to auto-load missing rum/cannonballs from the current port warehouse into the hold (deterministic, respects capacities, no loss).
- Voyage panel now renders encounter schedule + status during a running voyage.

Harness runs (port 5180, determinism-check: full):
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260205_010724`)
- voyage_prepare_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011012`)
- voyage_encounters_visible_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011502`)
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011542`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011545`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011549`)
- phase3_conquest_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011553`)

---

- 2026-02-05: Economy QoL: “Collect Available” now collects all collectible contracts at the current port in one click (still deterministic and capacity-respecting).

Decisions:
- Added engine action `COLLECT_CONTRACT_ALL` to avoid UI loops and keep “warehouse capacity pressure” visible (collect stops when warehouse is full).

Harness runs (port 5180, determinism-check: full):
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011730`)
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011734`)
- phase2_cosmetics_vanity_signage: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011743`)
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011815`)
- contracts_cancel_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011829`)
- phase2_rigging_run_efficiency: PASS (artifacts: `.codex-artifacts/idle-game/20260205_011850`)

---

- 2026-02-05: UI clarity improvements (nav/minigame lock states from `unlocks`, per-contract collect button, and warehouse-full warning during contract collection).

Decisions:
- Nav/minigame buttons now reflect `state.unlocks` (still keeps acceptance selectors stable); rigging minigame is explicitly unlocked at game start for current test coverage.
- Economy contract list now supports per-contract collect, and shows “Warehouse full” when free space is 0 to avoid silent no-ops.

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_012513`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_012533`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_012538`)

---

- 2026-02-05: Further UX clarity: contract fee/tax preview, manual realtime toggle (disabled under automation), and explicit minigame stacking rules.

Decisions:
- Economy form shows computed placement fee from engine (`getContractPlacementFeeForUi`) including tier + effective tax bps; Place is disabled when gold is insufficient to avoid silent no-ops.
- Added `realtime-toggle` so humans can pause/enable rAF stepping; harness stays deterministic because it disables realtime under `navigator.webdriver`.
- Minigame descriptions now state what the buffs do and the stacking rule (refresh to max remaining).

Harness runs (port 5180, determinism-check: full):
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_012741`)
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_012757`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_012801`)

---

- 2026-02-05: Economy panel improvements to better match concept “contracts” framing (market supply, bid priority visibility, lightweight filtering).

Decisions:
- Economy panel now shows current port supply rates (units/min) and displays bid priority rank per open contract (higher bid fills first; tie by contract id).
- Added a status filter to keep the contracts list usable as it grows; does not affect engine determinism.

Harness runs (port 5180, determinism-check: full):
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_012915`)
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_012920`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_012923`)

---

- 2026-02-05: Playtest baseline + re-verified Milestone 1 scenarios before new feature work.

Notes:
- Fixed a stale dev server instance holding port 5180 (killed `next-server` PID 33810) and removed the `.next/dev/lock` so `node scripts/dev.mjs` can restart cleanly on port 5180.

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_013312`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_013325`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_013337`)

Harness runs (additional playtest scenarios, port 5180, determinism-check: full):
- phase0_loop: PASS (artifacts: `.codex-artifacts/idle-game/20260205_013623`)
- phase2_rigging_run_efficiency: PASS (artifacts: `.codex-artifacts/idle-game/20260205_013638`)
- voyage_encounters_visible_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_013700`)

---

- 2026-02-05: Added deterministic-safe offline catch-up summary.

Decisions:
- Save payload now includes `client.wallClockMs` (0 under automation) and import applies an optional offline catch-up (capped at 24h) only when not running under Playwright (`navigator.webdriver`).
- Offline summary is displayed in the top bar and stored only as UI metadata (`meta.offline`), so harness determinism subsets remain stable.

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_014326`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_014339`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_014354`)

---

- 2026-02-05: Economy contracts list clarity (scope + sorting) to better match concept “tables with sorting/filtering” and reduce confusion.

Decisions:
- Contract list now defaults to showing only the current port (toggleable to “All ports”), and supports sorting by newest / priority / commodity / status.
- Priority rank is now computed once per port+commodity and displayed consistently; open contracts show a “behind N” hint when not top-priority.

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_014632`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_014643`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_014657`)

---

- 2026-02-05: Playability audit (headed, ~10m flow) + top friction fixes.

Headed flow:
- `playability_audit_10min`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_020455`) — used as the repeatable “manual-ish” playthrough.

Friction points (top 5):
- Production panels were opaque (jobs could be enabled but silently blocked by missing inputs/capacity; timers were internal `remainderMs`).
- Voyage panel didn’t clearly show “hold vs warehouse” supplies, leading to confusion about why Start is disabled.
- Contracts could feel “stuck” without understanding bid priority (“behind N”) and how to resolve it (raise bid or wait).
- Unlock/tooltips were generic in places (“via progression”), not stating specific next actions.
- Next Goals list was helpful, but not always aligned with the player’s *current* blocker (e.g., missing sugar vs missing hold rum vs warehouse cap).

Implemented fixes:
- Production clarity: Distillery + Crafting now show a user-facing status (running/blocked/disabled/locked), next tick countdown, and concrete missing-input / warehouse-full reasons.
- Voyage clarity: Voyage panel now displays hold/warehouse rum + cannonballs and adds a “Prepare” tooltip + contextual tips when rum is missing.
- Also unlocked `recipe:forge_cannonballs` at game start so the “encounters consume cannonballs” loop is actionable earlier (without changing any existing stable IDs/selectors).

Verification:
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_020440`)
- `contracts_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_020547`)
- `minigame_cannon_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_020604`)

---

- 2026-02-05: Unlock ladder audit + e2e assertions.

Changes:
- Progression gates aligned so `minigame:rigging` and `recipe:forge_cannonballs` unlock after the first `Starter Run` completion (instead of at game start).
- UI now explains locked crafting recipes more precisely (Starter Run vs 10+ influence), and the Rigging button shows a concrete “complete Starter Run” lock hint.

Unlock table (engine `state.unlocks` IDs):
- Start New Game:
  - Modules: `port`, `economy`, `crew`, `voyage`, `politics`
  - Minigames: `minigame:cannon`
  - Routes: `route:starter_run`
  - Recipes: `recipe:distill_rum`
- After collecting `Starter Run` once:
  - Routes: `route:turtle_to_home`, `route:home_to_haven`, `route:cay_to_haven`, `route:haven_to_home`, `route:haven_to_cay`
  - Minigames: `minigame:rigging`
  - Recipes: `recipe:forge_cannonballs`, `recipe:craft_parts`, `recipe:assemble_repair_kits`
- After reaching **10+ influence** with your affiliated flag (donations or voyage influence):
  - Recipes: `recipe:brew_dye`, `recipe:weave_cloth`, `recipe:tailor_cosmetics`
  - Feature: `vanity_shop`
- On vanity purchases (requires `vanity_shop` + cosmetics):
  - `vanity:warehouse_signage`, `vanity:ship_figurehead`, `vanity:captain_banner`
- On conquest success:
  - `conquest:<islandId>` (e.g. `conquest:turtle_cay`)
- On flagship completion:
  - `flagship_built`

Harness runs (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_021752`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_021753`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_021755`)
- unlock_ladder_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_021525`)
- phase2_rigging_run_efficiency: PASS (artifacts: `.codex-artifacts/idle-game/20260205_021727`)

---

- 2026-02-05: Determinism audit.

Determinism rerun:
- `unlock_ladder_basic` with seed `4242` + `--determinism-check full`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_022350`, includes `determinism_run2/`).

Hidden nondeterminism scan:
- `packages/engine` + `packages/shared`: no `Date.now`, `Math.random`, timers, or rAF calls (guarded by new script below).
- `apps/web`: `Date.now` is used only for the **offline catch-up** save metadata, and is explicitly disabled under automation via `navigator.webdriver` (so Playwright determinism is unaffected).

Invariant added:
- `pnpm check:determinism` (script: `scripts/check_determinism.mjs`) fails if forbidden time/RNG/timer APIs appear in `packages/engine/src` or `packages/shared/src`.

---

- 2026-02-05: Save stress test + fixture imports.

Fixtures generated (deterministic, seed `123`):
- `e2e/fixtures/save_fresh.json`
- `e2e/fixtures/save_after_contracts.json`
- `e2e/fixtures/save_after_cannon.json`
- `e2e/fixtures/save_after_starter_voyage.json`

Legacy/migration fixture:
- `e2e/fixtures/save_legacy_v1.json` simulates older payload shapes (no `client`, `production.distillery` v1, `politics.influence` v1, inventory v1 without newer commodities, no `minigames.rigging`).

Verification:
- `node scripts/stress_saves.mjs --url http://localhost:5180 --seed 123` exports each progression save, then `hardReset`→`importSave` and checks key state equality (resources/unlocks/location + contracts/buffs/production/voyage summaries).
- Added title-screen fixture importer UI to exercise import via Playwright selectors:
  - `fixture-select`, `fixture-load`, `save-import-input`, `save-import-submit`

Harness runs (port 5180, determinism-check: full):
- save_import_legacy_fixture: PASS (artifacts: `.codex-artifacts/idle-game/20260205_023209`)
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_023210`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_023211`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_023212`)

---

- 2026-02-05: `render_game_to_text` mismatch audit (UI vs state output).

Audit items (UI element ⇒ `render_game_to_text` path):
- Gold in top bar ⇒ `resources.gold`
- Current port name ⇒ `location.name`
- Warehouse used/cap ⇒ `storage.warehouseUsed` / `storage.warehouseCap`
- Key warehouse commodities (wood/sugar/rum) ⇒ `resources.wood` / `resources.sugar` / `resources.rum`
- Contract row “filled x/y” ⇒ `economy.contracts[i].filledQty` / `economy.contracts[i].qty`
- Buff pill / timers ⇒ `buffs[]` (`remainingMs`)
- Voyage panel status/timer ⇒ `voyage.status` / `voyage.remainingMs`
- Active module + open minigame (was missing) ⇒ `meta.ui.*`

Fix:
- Added deterministic `meta.ui` snapshot to `render_game_to_text`:
  - `meta.ui.activeNav`, `meta.ui.openMinigame`, `meta.ui.realtimeEnabled`, `meta.ui.isAutomation`
- Extended e2e expects to assert those UI state hooks.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_024430`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_024447`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_024503`)

---

- 2026-02-05: Dock/Crew clarity (income vs wages).

Fix:
- Exported engine constants for UI via helpers:
  - `getDockGoldPerSecForUi`, `getCrewHireCostGoldForUi`, `getCrewWageGoldPerCrewPerMinForUi`
- Dock panel now shows income, wages, and net gold/min using engine-sourced values (avoids UI/engine drift).

Harness rerun:
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_025123`)

---

- 2026-02-05: Politics/tax UX clarity.

Fix:
- Politics → Port Control now shows both controller tax and your **effective** tax per island (after affiliation + influence discount).
- Politics → Affiliation now shows a “current port tax summary” (base vs effective, discount bps).

Harness rerun:
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_025325`)

Post-UX regression:
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_025403`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_025405`)

---

- 2026-02-05: Playability tour (short automated “normal flow”).

Scenario:
- `playability_tour_short`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_025645`)

Notes:
- Early gold gate for crew hire was real; scenario now advances 60s before hiring to reflect intended pacing.

---

- 2026-02-05: Sanity checks after UX changes.

Harness:
- smoke (seed 1337): PASS (artifacts: `.codex-artifacts/idle-game/20260205_025816`)

Local checks:
- `pnpm check:determinism`: PASS
- `pnpm check:saves`: PASS

Fixture regression:
- save_import_legacy_fixture: PASS (artifacts: `.codex-artifacts/idle-game/20260205_025918`)

---

- 2026-02-05: Architecture boundary audit (engine as single source of truth).

UI gameplay formulas found (moved into `packages/engine` as pure UI helpers/selectors):
- Inventory capacity math: `invUsed(...)` (UI previously duplicated; risk when adding commodities)
- Minigame timing windows:
  - Cannon Volley in-zone computation + duration
  - Rigging Run phase/window computation + duration + rum efficiency %
- Economy/politics constants:
  - Donation conversion (gold ⇒ influence)
  - Conquest requirements (influence + war chest + timings)
- Port/ship progression constants:
  - Warehouse upgrade cost/bonus
  - Ship repair kit/gold rules
  - Shipyard max level + upgrade cost
  - Flagship contribution costs + permanent voyage bonus
- Port gold flow summary (dock income vs wages) moved to `getPortGoldFlowPerMinForUi(state)` to prevent UI/engine drift.

Refactor:
- `apps/web` now renders these values via engine helpers and only dispatches actions (no simulation math in UI).
- `apps/web/src/lib/idleStore.ts` uses engine `invUsed(...)` for `render_game_to_text` capacity fields.

Harness (port 5180):
- smoke (full): PASS (artifacts: `.codex-artifacts/idle-game/20260205_030703`)
- contracts_basic (full): PASS (artifacts: `.codex-artifacts/idle-game/20260205_030721`)
- minigame_cannon_basic (full): PASS (artifacts: `.codex-artifacts/idle-game/20260205_030743`)

All scenarios sweep (default determinism+roundtrip checks): PASS
- artifacts: `.codex-artifacts/idle-game/20260205_030841` … `.codex-artifacts/idle-game/20260205_031132`

---

- 2026-02-05: Data-driven content catalogs (JSON + Zod).

Catalogs moved from inline TS into JSON (validated on import via Zod + cross-ref checks):
- `packages/shared/src/content/commodities.json`
- `packages/shared/src/content/flags.json`
- `packages/shared/src/content/islands.json`
- `packages/shared/src/content/ship_classes.json`
- `packages/shared/src/content/routes.json`
- `packages/shared/src/content/recipes.json`
- `packages/shared/src/content/vanity_items.json`
- Added UI-facing catalogs for growth:
  - `packages/shared/src/content/unlocks.json` (lock hints by stable id)
  - `packages/shared/src/content/upgrades.json` (upgrade/project ids + hints)

Validation:
- `packages/shared/src/catalog.ts` now imports JSON and validates:
  - duplicate IDs
  - route/island refs
  - island produces refs
  - recipe input/output refs

Save/migration hardening (catalog growth safe):
- `packages/shared/src/save.ts` now merges default per-island warehouse entries on import (missing ports get an empty warehouse with cap 50).

Engine/UI typing fix:
- Exported `isCommodityId(...)` from engine and used it when deserializing contracts from saves (`apps/web/src/lib/idleStore.ts`) so unknown commodities are dropped instead of violating engine types.

E2E stable-id assertion:
- `smoke` now asserts stable IDs appear in `render_game_to_text` (`location.id == "home_port"`, `ship.classId == "sloop"`).

Build:
- `apps/web/tsconfig.json` target bumped to `ES2022` (BigInt support); `pnpm build` now passes.

Harness reruns (port 5180, determinism-check: full):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_032548`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_032609`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_032629`)
- save_import_legacy_fixture: PASS (artifacts: `.codex-artifacts/idle-game/20260205_032647`)

Local check:
- `pnpm check:determinism`: PASS

---

- 2026-02-05: “No behavior change” cleanup pass.

Refactor (behavior-preserving):
- Removed a small duplication in engine buff ticking (`packages/engine/src/sim.ts`).
- Tightened catalogs/save safety:
  - `packages/shared/src/save.ts` now merges default warehouses per island (missing ports don’t break saves).
  - `apps/web/src/lib/idleStore.ts` drops contracts with unknown commodities on import (type-safe growth).

Invariants (dev-only; throws on violation, no clamping):
- Added `packages/engine/src/invariants.ts` with checks for:
  - no negative resources/inventory, used <= cap
  - no NaN / non-integer counters
  - timers monotonic while running (`voyage`, `conquest`, minigame elapsed)
  - unlocks monotonic + no duplicates
- Wired invariant checks in `apps/web/src/lib/idleStore.ts` after every `dispatch` and `advanceTime`.

Deterministic debug log (capped, not included in `render_game_to_text`):
- `apps/web/src/lib/idleStore.ts` records a capped (200) event stream of:
  - actions, advances, status transitions, newly added unlocks
- Exposed via `window.__idle.debug.getLog()` / `window.__idle.debug.clear()` (typing updated in `apps/web/src/types/global.d.ts`).

Proof (determinism subset unchanged):
- Full rerun sweep of every scenario with `--determinism-check full`: PASS
  - artifacts: `.codex-artifacts/idle-game/20260205_033739` … `.codex-artifacts/idle-game/20260205_034032`

---

- 2026-02-05: Playability + unlock ladder + pacing pass (Phase 0–2 clarity).

Port / server:
- Found an existing `next dev` instance already running on port `5180` (kept using `5180` for all harness runs).

Unlock ladder adjustments (engine-driven, UI still shows locked modules with tooltips):
- `crew` unlock: when `gold >= 25`.
- `voyage` unlock: when any `rum` exists in warehouse or hold.
- `politics` unlock: when `gold >= 100` **or** you arrive at a non-home port.
- Updated unlock hints in `packages/shared/src/content/unlocks.json` to match.

Architecture boundary cleanup:
- Moved “Next Goals” logic out of the UI into `@sea-of-gold/engine` as `getNextGoalsForUi(state)`.

Pacing trace (10m, minimal clicks) — `scripts/pacing_10min.mjs --url http://localhost:5180 --seed 1`:
- worst gap (event-to-event): `15s`
| t | Δt | kind | detail |
|---:|---:|---|---|
| 0:00 | 0s | start | Start new game |
| 0:10 | 10s | decision | Placed sugar contract at home_port (10 @ 1) |
| 0:15 | 5s | decision | Collected contract output at home_port |
| 0:20 | 5s | unlock | + voyage |
| 0:30 | 15s | decision | Placed sugar contract at home_port (10 @ 1) |
| 0:30 | 0s | decision | Collected contract output at home_port |
| 0:30 | 0s | decision | Prepared route starter_run |
| 0:30 | 0s | decision | Started route starter_run |
| 0:45 | 15s | milestone | Reached 25g (crew hire available) |
| 0:45 | 0s | unlock | + crew |
| 0:45 | 0s | decision | Collected contract output at home_port |
| 0:45 | 0s | decision | Hired 1 crew |
| 0:55 | 10s | decision | Placed sugar contract at home_port (10 @ 1) |
| 1:00 | 5s | unlock | + politics |
| 2:40 | 10s | milestone | Reached 100g (warehouse upgrade / 10 influence donation available) |
| 10:00 | 15s | summary | End @ 10:00 |

Harness reruns (port 5180):
- smoke: PASS (artifacts: `.codex-artifacts/idle-game/20260205_042340`)
- contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_042341`)
- minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/20260205_042342`)
- Full suite rerun: PASS after fixing `phase3_conquest_basic` politics gate (artifacts include `.codex-artifacts/idle-game/20260205_042756`).

Additional verification:
- `unlock_gates_phase0_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_043912`)
- `pnpm check:determinism`: PASS (static scan for forbidden nondeterminism)
- `pnpm check:saves`: PASS (wrote/updated fixtures under `e2e/fixtures/`)

Harness sweep rerun (port 5180):
- Full suite (all scenarios in `e2e/action_payloads.json`): PASS
  - artifacts: `.codex-artifacts/idle-game/20260205_044015` … `.codex-artifacts/idle-game/20260205_044321`

---

- 2026-02-05: Multipliers + scaling audit (runaway risk mitigation).

Multipliers inventory (by system):
- Voyages (gold reward):
  - `cannon_volley` buff: +20% (multiplicative).
  - Permanent voyage gold bonuses (multiplicative):
    - `vanity:captain_banner`: +5%
    - `flagship_built`: +20%
  - Encounter failures: -10% reward per failed encounter (multiplicative), capped at 80% total penalty.
- Voyages (cost / throughput):
  - `rigging_run` buff: -25% baseline rum usage (multiplicative on baseline cost).
- Economy (cost):
  - Contract placement fee: base `1g/unit` then multiplied by:
    - island tier fee (+5% per tier above 1)
    - effective port tax (bps), which can be reduced by affiliation + influence.
- Crew:
  - Wages: -1 gold/min per crew (subtractive sink against dock income).
- Fleet:
  - More ships increase output roughly linearly (multiple concurrent voyages), which can amplify any *global* voyage multipliers.

Runaway stacking risk:
- Voyage reward bonuses were stacking multiplicatively (buff * permanent bonuses), and fleet count scales voyages linearly; together this can compound strongly as more bonus sources are added.

Mitigation (softcap):
- Added a softcap on the **combined voyage gold bonus** in `packages/engine/src/sim.ts`:
  - Compute effective “extra %” from cannon + permanent bonuses, then apply:
    - up to +40%: full value
    - above +40%: diminishing returns (each +2% only counts as +1%)
  - Keeps early-game `+20%` Cannon Volley intact (Milestone 1 expects `50 -> 60` on Starter Run).

Proof (deterministic 60m sim; measure window = 30m):
- Baseline (before softcap): `60.13 gold/min` (saved to `scripts/scaling_audit_baseline.json`)
- After softcap: `58.67 gold/min` (delta `-2.4%`)
  - Run script: `node scripts/scaling_audit_60min.mjs --url http://localhost:5180 --seed 1 --minutes 60 --measureMinutes 30`

Harness verification (port 5180):
- `phase0_loop`: PASS (still asserts `voyage.pendingGold == 60`) (artifacts: `.codex-artifacts/idle-game/20260205_045820`)
- Full suite rerun: PASS (artifacts: `.codex-artifacts/idle-game/20260205_045937` … `.codex-artifacts/idle-game/20260205_050243`)

---

- 2026-02-05: Idle vs active balance + minigame anti-spam.

Idle vs active target:
- Idle-only should yield ~60–80% of progress; active minigames should accelerate by ~20–40% without being mandatory.

Added/updated:
- `scripts/idle_vs_active_30min.mjs`: deterministic A/B sim (seeded) that loops contracts → distillery → voyages, and (for the active policy) starts minigames during voyages.
- Engine minigame start guard (`packages/engine/src/sim.ts`):
  - Added `MINIGAME_REFRESH_WINDOW_MS = 60000`.
  - `CANNON_START` and `RIGGING_START` are no-ops while the corresponding buff has >= 60s remaining.
  - This prevents spamming minigames to continuously refresh a high-duration buff (active play banks value, but can’t be wasted).
- UI clarity:
  - Cannon Volley now exposes `data-testid='minigame-cannon-fire'`.
  - Cannon/Rigging Start buttons are disabled while blocked and show a short lock hint.
- Harness/state visibility:
  - `render_game_to_text` now includes `minigameLocks.{cannonStartBlocked,riggingStartBlocked}` to allow E2E assertions.
  - Added scenario `minigame_cannon_spam_guard` in `e2e/action_payloads.json`.

Measured (dev server port 5180, seed 1, horizon 30m):
- idle_only: `64.00 gold/min` (end gold `1920`)
- active: `79.53 gold/min` (end gold `2386`)
- idle / active: `80.5%`  (active boost: `+24.3%`)
- Determinism: repeated script run produced identical output (diff clean).

Harness verification (port 5180):
- `smoke`, `contracts_basic`, `minigame_cannon_basic`, `minigame_cannon_spam_guard`, `phase0_loop`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_054513` … `20260205_054530`)

---

- 2026-02-05: Voyages — route unlocks via Charts (one increment).

Voyage playtest (scenario: `voyage_encounters_visible_basic`, headed) — top missing mechanics:
1) Route unlocks are mostly implicit; no “charts” purchase/collection loop for unlocking better routes.
2) Encounters have no player-facing choice/outcome beyond success/fail; no deterministic “loot” or cargo consequences.
3) Supplies are mostly just rum/cannonballs; there’s no broader “voyage prep checklist” or route-specific cargo requirements.

Implemented (exactly one mechanic): **Charts unlock a new route**.
- Added `chart:merchant_run` (cost `50g`) which unlocks `route:merchant_run` (Home Port → Turtle Cay, 45s, 6 rum, 80g).
  - Content: `packages/shared/src/content/charts.json`, `packages/shared/src/content/routes.json`
  - Engine action: `BUY_CHART` (deducts gold; adds unlocks `chart:*` + `route:*`) in `packages/engine/src/sim.ts`
  - UI: Voyage panel “Charts” section + buy button `data-testid='voyage-buy-chart-chart:merchant_run'`
- `render_game_to_text` now includes `voyage.availableRoutes[]` for deterministic route list assertions.

E2E proof:
- Added scenario `voyage_chart_unlock_basic` (buys chart, asserts unlock + `voyage.availableRoutes` includes the route, prepares and starts the route).

Harness verification (port 5180):
- `smoke`, `contracts_basic`, `minigame_cannon_basic`, `minigame_cannon_spam_guard`, `phase0_loop`, `voyage_prepare_basic`, `voyage_encounters_visible_basic`, `voyage_chart_unlock_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_061039` … `20260205_061117`)

---

- 2026-02-05: Contracts — add strategy levers (bid premium + slot cap).

What made contracts trivial/boring:
- Bid price had no cost tradeoff (always “bid high” once you had income).
- You could spam unlimited active contracts at a port, turning contracts into “free extra storage” and removing pressure to choose.
- Fees existed, but were too linear and didn’t meaningfully interact with bidding decisions.

New contract rules (engine-driven):
- **Active contract slots per port:** max `4` active (status `open|filled`) at a port. Collect/cancel to free a slot.
- **Bid premium fee:** placement fee is still `1g/unit`, tier+tax adjusted, plus a premium for bids above 1:
  - `premium = floor(qty * max(0, bidPrice-1) / 10)`
  - `fee = ceilDiv((qty + premium) * tierBps * (10000+taxBps), 10000*10000)`
  - At `home_port` (tier 1, tax 0): qty `10`, bid `1` ⇒ fee `10`; qty `10`, bid `5` ⇒ fee `14`.
- Priority model unchanged: port supply allocates to higher bids first (ties by contract id).

UI/State:
- Economy panel now shows slot usage and whether a fee includes a bid premium.
- `render_game_to_text` includes `economy.contractSlots.{used,max}` for deterministic assertions.

E2E proof:
- Added scenario `contracts_strategy_levers_basic` asserting:
  - `feePaid` differs for bid `1` vs bid `5` at the same qty.
  - contract slot cap prevents adding a 5th active contract at the same port.

Harness verification (port 5180):
- `smoke`, `contracts_basic`, `contracts_strategy_levers_basic`, `phase0_loop`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_062509` … `20260205_062524`)

---

Harness verification (port 5180, determinism-check: full):
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_074437`)
- `contracts_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_074504`)
- `minigame_cannon_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_074537`)

- 2026-02-05: UI — add close buttons for minigame panels (`minigame-cannon-close`, `minigame-rigging-close`) to support safe view transitions.

Harness verification (port 5180, determinism-check: full):
- `minigame_cannon_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_075129`)

---

- 2026-02-05: Mode/state-machine audit — add explicit UI close transitions and deterministic invalid-transition guards.

Modes (as exposed via `render_game_to_text().meta.mode`):
- `title`: before `START_NEW_GAME` / after `hardReset()`
- `port`: default in-port state (no voyage running, no minigame running)
- `voyage`: `voyage.status !== "idle"` and no minigame is currently running
- `minigame`: a minigame status is `"running"` (takes precedence over `voyage`)

Key transitions (valid):
- `title -> port`: `START_NEW_GAME` / `importSave()`
- `port -> voyage`: `VOYAGE_START` (requirements met)
- `voyage -> port`: `VOYAGE_COLLECT` (after completion)
- `port -> minigame`: `CANNON_START` / `RIGGING_START`
- `minigame -> port`: minigame timer completes (status becomes `finished`), or player closes the panel view (UI-only)

Invalid transition handling (must be safe/no-op):
- `CANNON_FIRE` when cannon is not running ⇒ no-op (shots stay 0)
- `VOYAGE_START` while a voyage is already running ⇒ no-op (voyagesStarted does not increment)

E2E proof:
- Added scenario `mode_state_machine_transitions_basic` asserting:
  - minigame panel open/close toggles `meta.ui.openMinigame`
  - invalid dispatches above are deterministic no-ops
  - `meta.mode` transitions `port -> voyage -> port` on a starter run

Harness verification (port 5180, determinism-check: full):
- `mode_state_machine_transitions_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_075434`)

Harness verification (port 5180, determinism-check: full):
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_075538`)
- `contracts_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_075602`)
- `minigame_cannon_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_075628`)

---

- 2026-02-05: Voyages — add ship speed as a real tradeoff.
  - Content: `packages/shared/src/content/ship_classes.json` now includes `speedPct` (sloop 100, brig 105, galleon 95).
  - Engine: voyage `durationMs` is now computed from `route.durationMs` scaled by ship speed (`getVoyageDurationMsForUi`), and the same effective duration is used for baseline rum math + encounter timing.
  - UI: Shipyard and Voyage panels display effective voyage time and ship speed stat.

Harness verification (port 5180, determinism-check: full):
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_081721`)
- `voyage_prepare_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_081653`)
- `phase2_rigging_run_efficiency`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_081748`)

- 2026-02-05: Rigging Run buff now also improves voyage speed (+10% at voyage start), matching concept (“speed / rum efficiency”).

Harness verification (port 5180, determinism-check: full):
- `phase2_rigging_run_efficiency`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_081925`)
- `voyage_encounters_visible_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_082020`)
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_081951`)

Playtest notes (via `playability_tour_short` screenshots + state):
- Missing vs `concept.md` (top 3):
  1) Ship classes had no **voyage speed** tradeoff (route times were fixed).
  2) Rigging Run buff was **rum-only**, missing the “speed” component implied by the concept.
  3) Voyages still lack **loot/cargo outcomes** (beyond gold/influence); no route-specific commodity drops yet.

E2E proof:
- Added scenario `voyage_ship_speed_basic` asserting `brig` makes the same base-30s route start with `voyage.durationMs < 30000`.

Harness verification (port 5180, determinism-check: full):
- `voyage_ship_speed_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_082139`)
- `contracts_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_082209`)
- `minigame_cannon_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_082236`)

---

- 2026-02-05: Fun Evaluation scaffolding — added deterministic phase scenarios + automation-only offline simulation.
  - Automation-only debug buttons:
    - `debug-offline-2h`, `debug-offline-8h`, `debug-offline-clear`
    - backed by `store.simulateOfflineCatchup(ms)` (explicit delta; no `Date.now()` inside engine)
  - Added phase scenarios:
    - `fun_phase0_first_5min`
    - `fun_phase1_first_voyage_loop`
    - `fun_phase3_minigame_loop_3runs`
    - `fun_phase4_offline_2h`, `fun_phase4_offline_8h`

Harness verification (port 5180, determinism-check: full):
- `fun_phase0_first_5min`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_083015`)
- `fun_phase1_first_voyage_loop`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_083148`)
- `fun_phase3_minigame_loop_3runs`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_083213`)
- `fun_phase4_offline_2h`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_083241`)
- `fun_phase4_offline_8h`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_083304`)

- 2026-02-05: Fun Improvement 1 — Cannon Volley now has visible reward tiers + persists buff potency.
  - Engine buff state now includes optional `powerBps` (save-safe).
  - Cannon Volley tiers (deterministic):
    - 0–5 hits: +10% voyage gold
    - 6+ hits: +20% voyage gold (+60s duration)
    - 12+ hits: +35% voyage gold (+180s duration)
  - Stacking: keeps the best tier and the longer duration.

Harness verification (port 5180, determinism-check: full):
- `fun_phase3_minigame_loop_3runs`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_084148`)
- `minigame_cannon_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_084218`)

- 2026-02-05: Fun Improvement 2 — Voyage cards now explain why requirements are what they are.
  - Voyage UI shows rum breakdown (fare + baseline) and time (effective vs base).

Harness verification (port 5180, determinism-check: full):
- `fun_phase1_first_voyage_loop`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_084315`)
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_084344`)
- `fun_phase4_offline_2h`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_084424`)
- `contracts_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_084544`)

---

- 2026-02-05: Issue Evidence — product-quality regression reproduction (no code changes).

Harness reproduction (headed, clean seed/save):
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_125346`)

Overwhelm evidence (post-start, default Port screen):
- Visible nav modules: Port, Economy, Crew (Locked), Voyage (Locked), Politics (Locked) + 2 minigame buttons (Cannon Volley, Rigging Run).
- Primary actions visible immediately: Advance minutes, contract form controls, cargo load/unload, production toggles, ship repair, shipyard, fleet automation, etc. (dense “everything at once” panel stack).
- Screenshot: `.codex-artifacts/idle-game/20260205_125346/screens/step_001_click.png`

Progression evidence (manual→automation beat missing):
- Gold increases with no player-initiated action: after `advance 5000ms` gold becomes `5` in `smoke`.
- Evidence state: `.codex-artifacts/idle-game/20260205_125346/state.final.json` shows `resources.gold = "5"` at `meta.nowMs=5000`.
- This removes the “manual → automate” progression beat from the first frame.

---

- 2026-02-05: Spec correction + fix-in-progress — manual→automation onboarding.
  - Updated `acceptance.md` AC-M1-002 + `e2e/action_payloads.json` `smoke` to require the manual dock action (`work-docks`) before asserting gold increases.
  - Implemented Dock Intro onboarding:
    - Start new game now begins with **no passive gold** (dock automation is an early upgrade).
    - New stable selectors: `work-docks`, `upgrade-auto-dockwork`.
    - UI hides most modules/panels during `tut:dock_intro` to reduce overwhelm.

Harness run (expected fail before updating scenarios):
- `smoke`: FAIL (passive gold removed; artifacts: `.codex-artifacts/idle-game/20260205_164634`)

- 2026-02-05: Product-quality regression fix — progressive disclosure + manual→automation.
  - Engine:
    - Added `tutorial.stepId` to state (save-safe).
    - Added manual dock shift (`DOCK_WORK_START`) and automation purchase (`DOCK_AUTOMATE_BUY`).
    - Passive dock income now starts at 0 and only enables after automation (cost 30g).
  - UI:
    - New Dock Intro panel in `tut:dock_intro` shows only the Dock loop + 2 CTAs.
    - Nav/minigame buttons and dense port panels are hidden during Dock Intro.
  - Harness contract:
    - Added `quality.ui` + `quality.progression` to `render_game_to_text()` for regression detection.
  - Docs:
    - Added `product-quality.md` with concrete guardrails and required checks.

Harness verification gate (port 5180, determinism-check: full):
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_170301`)
- `contracts_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_170337`)
- `minigame_cannon_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_170405`)
- `ui_overwhelm_guard`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_170432`)
- `progression_manual_to_auto`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_170501`)

- 2026-02-05: Save migration tweak — removed gold-based inference for `dock.passiveEnabled` (now inferred only from unlocks when missing).
  - Rerun: `smoke` PASS (artifacts: `.codex-artifacts/idle-game/20260205_170851`)

Final verification gate (post-migration tweak, port 5180):
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_170851`)
- `contracts_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_170952`)
- `minigame_cannon_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_171030`)
- `ui_overwhelm_guard`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_171102`)
- `progression_manual_to_auto`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_171130`)

---

- 2026-02-05: Self-Validation Report — full suite run (evidence-first; no fixes yet).

Dev server:
- `pnpm dev` → http://localhost:5180

Playwright suite run (all scenarios in `e2e/action_payloads.json`):
- Command:
  - `OUT_ROOT=".codex-artifacts/idle-game/self_validation_$(date +%Y%m%d_%H%M%S)" ... node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario <scenario> --out-dir "$OUT_ROOT/<scenario>"`
- Artifacts root:
  - `.codex-artifacts/idle-game/self_validation_20260205_175415`
- Result:
  - PASS: 6 / 35
    - `contracts_basic`, `minigame_cannon_basic`, `progression_manual_to_auto`, `save_import_legacy_fixture`, `smoke`, `ui_overwhelm_guard`
  - FAIL: 29 / 35
    - Most common failure modes:
      - selector timeout: `[data-testid='nav-economy']` / `[data-testid='minigame-cannon-open']` not visible during Dock Intro (expected; scenarios not yet updated)
      - early expectations assume passive gold at t=0 (now removed by design)
      - missing selector: `[data-testid='quick-advance-minutes']` (UI no longer exposes this control / selector changed)
      - unlock expectations assume `route:starter_run` unlocked immediately (now gated behind dock automation)

Artifacts inspection summary:
- No console warnings/errors in any scenario (`errors=0`, `warnings=0` across all `console.json`).
- Many failing scenarios exit before `state.final.json` is written (timeouts/expect failures); step snapshots exist (e.g. `state.step_00N.json`).
- Audit table written:
  - `.codex-artifacts/idle-game/self_validation_20260205_175415/artifact_audit.tsv`

Non-Playwright checks:
- `pnpm check:determinism`: PASS
- `pnpm build`: PASS
- `pnpm lint`: FAIL
  - `apps/web/src/components/ui/input.tsx`: `@typescript-eslint/no-empty-object-type`
  - warnings: unused vars in `apps/web/src/components/game/GameClient.tsx` and `apps/web/src/lib/idleStore.ts`
- `pnpm check:saves`: FAIL (save fixture generator outdated vs Dock Intro gate)
  - timeout waiting for `[data-testid='nav-economy']`

Top false-green risks (tests can pass while the game is wrong):
1) UI↔state drift: we rarely assert UI-displayed numbers vs `render_game_to_text()`, so stale UI could slip through.
2) Invariant breaks (negative resources/timers): no engine `validate()` gate is asserted in scenarios; failures could hide until late.
3) Progression pacing regressions: no baseline “first 10 minutes” deterministic sim test with bounds (time-to-automation, next-goal ETA).
4) Save/migration coverage: harness roundtrip checks same-version saves; legacy fixtures/migrations are only lightly covered and `check:saves` is currently broken.
5) Overwhelm/progressive disclosure: only guarded at tutorial step 0/1; no ongoing guardrails when new modules are introduced (could regress silently post-automation).

---

- 2026-02-05: Validation instrumentation — added engine invariant report surface.
  - Engine exports `validateGameStateInvariants()` returning `{ ok, errors[], warnings[] }`.
  - Web exposes `window.__idle.validate()` and `render_game_to_text().quality.validation`.

Harness verification (port 5180):
- `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1805_instrumentation_smoke`)

- 2026-02-05: E2E suite maintenance — updated stale scenarios for Dock Intro gate (manual→automation).
  - Updated scenarios: `contracts_cancel_basic`, `contracts_strategy_levers_basic`, `minigame_cannon_spam_guard`, `ui_quick_advance_basic`.

Harness verification (port 5180):
- `contracts_cancel_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1806_contracts_cancel_basic`)
- `contracts_strategy_levers_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1806_contracts_strategy_levers_basic`)
- `minigame_cannon_spam_guard`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1807_minigame_cannon_spam_guard`)
- `ui_quick_advance_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1807_ui_quick_advance_basic`)

- 2026-02-05: E2E suite maintenance — updated gating/unlock scenarios for Dock Intro prelude.

Harness verification (port 5180):
- `mode_state_machine_transitions_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1809_mode_state_machine`)
- `unlock_ladder_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1810_unlock_ladder_basic`)
- `unlock_gates_phase0_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1810_unlock_gates_phase0_basic`)
- `voyage_prepare_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1811_voyage_prepare_basic`)
- `voyage_chart_unlock_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1811_voyage_chart_unlock_basic`)
- `voyage_encounters_visible_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1812_voyage_encounters_visible_basic`)
- `voyage_ship_speed_basic`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_1812_voyage_ship_speed_basic`)

---

- 2026-02-05: Self-validation baseline rerun (evidence-first).
  - `pnpm lint`: FAIL
    - error: `apps/web/src/components/ui/input.tsx` (`@typescript-eslint/no-empty-object-type`)
    - warnings: unused vars in `apps/web/src/components/game/GameClient.tsx` and `apps/web/src/lib/idleStore.ts`
  - `pnpm check:saves`: FAIL
    - `scripts/stress_saves.mjs` timed out waiting for `[data-testid='nav-economy']` (Dock Intro gate not completed)
  - Harness rerun (determinism-check: full):
    - `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/self_validation_baseline_20260205_203321_smoke`)

- 2026-02-05: Fixed save fixture generator + save stress checks.
  - Updated `scripts/stress_saves.mjs` to complete Dock Intro (manual shifts → buy automation) before navigating, plus waits/retries for React re-renders.
  - `check:saves` now also asserts `window.__idle.validate().ok === true` after import (catches invariant breaks in fixtures).
  - `pnpm check:saves`: PASS (fixtures regenerated under `e2e/fixtures/`).
  - Harness verification (determinism-check: full):
    - `save_import_legacy_fixture`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_2051_save_import_legacy_fixture`)

- 2026-02-05: Fixture coverage — expanded deterministic fixture set + import scenarios.
  - Added fixture: `save_after_automation` (post Dock Intro + passive dock enabled).
  - Web title fixture loader updated to include `save_after_automation`.
  - Added E2E scenarios asserting fixture imports + core fields:
    - `save_import_fresh_fixture`
    - `save_import_after_automation_fixture`
    - `save_import_after_contracts_fixture`
    - `save_import_after_cannon_fixture`
    - `save_import_after_starter_voyage_fixture`
  - Harness verification (determinism-check: full):
    - `save_import_fresh_fixture`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_2056_save_import_fresh_fixture`)
    - `save_import_after_automation_fixture`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_2056_save_import_after_automation_fixture`)
    - `save_import_after_contracts_fixture`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_2057_save_import_after_contracts_fixture`)
    - `save_import_after_cannon_fixture`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_2057_save_import_after_cannon_fixture`)
    - `save_import_after_starter_voyage_fixture`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_2057_save_import_after_starter_voyage_fixture`)

- 2026-02-05: Debugging artifacts — exposed deterministic debug log tail in text state.
  - `render_game_to_text().quality.debug` now includes `{ eventCount, lastSeq, tail[] }` (deterministic, no DOM scraping).
  - `hardReset()` now clears debug log + seq to keep harness determinism reruns stable.
  - `smoke` scenario asserts `quality.debug.eventCount > 0` (guards against silent debug/instrumentation regressions).
  - Harness verification (determinism-check: full):
    - `smoke`: PASS (artifacts: `.codex-artifacts/idle-game/20260205_2101_debug_smoke`)

- 2026-02-05: Process docs — added `VALIDATION_PLAYBOOK.md` with concrete checklists + triage steps.

- 2026-02-05: Lint cleanup — fixed ESLint error + warnings.
  - `apps/web/src/components/ui/input.tsx`: replaced empty interface with `type` alias.
  - Removed unused imports/locals in `apps/web/src/components/game/GameClient.tsx` and `apps/web/src/lib/idleStore.ts`.
  - `pnpm lint`: PASS

- 2026-02-05: Validation suite — full green run + repo checks.
  - Full Playwright suite (all scenarios, determinism-check: full): PASS
    - artifacts: `.codex-artifacts/idle-game/self_validation_final_20260205_211612`
    - console scan: `errors=0`, `warnings=0`, `pageerror=0` across 40 `console.json`
  - Repo checks:
    - `pnpm check:determinism`: PASS
    - `pnpm check:saves`: PASS
    - `pnpm build`: PASS
  - Docs refreshed:
    - `VALIDATION_COVERAGE.md` updated to reflect current coverage + remaining TODOs.

---

- 2026-02-05: Review feedback reproduction (evidence-first; **no fixes yet**).
  - Dev server: `pnpm dev` → http://localhost:5180
  - Harness (headed) commands:
    - `node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario smoke --headed true --slow-mo 100 --pause-ms 250 --determinism-check none --out-dir .codex-artifacts/idle-game/review_feedback_evidence_20260205_214348/smoke`
    - `node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario contracts_basic --headed true --slow-mo 100 --pause-ms 250 --determinism-check none --out-dir .codex-artifacts/idle-game/review_feedback_evidence_20260205_214348/contracts_basic`

  Dead Time / No Agency evidence:
  - Manual action does **not** change gold on click (requires time to complete):
    - After click: `resources.gold == 0` at `nowMs == 5000` (state: `.codex-artifacts/idle-game/review_feedback_evidence_20260205_214348/smoke/state.step_010.json`).
  - The only meaningful action becomes unavailable during the shift:
    - Before click: `quality.progression.goldManualActionAvailable == true` (state: `.codex-artifacts/idle-game/review_feedback_evidence_20260205_214348/smoke/state.step_009.json`)
    - Immediately after click: `quality.progression.goldManualActionAvailable == false` (state: `.codex-artifacts/idle-game/review_feedback_evidence_20260205_214348/smoke/state.step_010.json`)
  - Forced wait to reach automation:
    - Work Shift is a 5s job that pays 5g; automation costs 30g ⇒ 6 shifts ⇒ **30s of forced waiting** with no other meaningful actions.
  - Screenshots:
    - Post-start: `.codex-artifacts/idle-game/review_feedback_evidence_20260205_214348/smoke/screens/step_001_click.png`
    - “Stuck / cooldown”: `.codex-artifacts/idle-game/review_feedback_evidence_20260205_214348/smoke/screens/step_010_click.png`

  Unlock Avalanche / Overwhelm Spike evidence:
  - Immediately after buying Dock Automation, multiple systems unlock at once:
    - `unlocks` includes `crew`, `economy`, `minigame:cannon`, `route:starter_run`, `recipe:distill_rum` (state: `.codex-artifacts/idle-game/review_feedback_evidence_20260205_214348/contracts_basic/state.step_014.json`)
    - `quality.ui.visibleNavCount` jumps to `3` (`port`, `economy`, `crew`) at the same moment (same state file).
  - Screenshots:
    - Post-automation moment: `.codex-artifacts/idle-game/review_feedback_evidence_20260205_214348/contracts_basic/screens/step_014_click.png`

---

- 2026-02-05: Baseline harness run before implementing dead-time / unlock-avalanche fixes.
  - smoke: PASS (artifacts: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/smoke`)
  - contracts_basic: PASS (artifacts: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/contracts_basic`)
  - minigame_cannon_basic: PASS (artifacts: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/minigame_cannon_basic`)

- 2026-02-05: Added new quality instrumentation (metrics-first; still no gameplay fixes yet).
  - `render_game_to_text()` additions:
    - `quality.ui.visibleInteractiveCount`
    - `quality.ui.lastUnlockDeltaModules`
    - `quality.ui.lastUnlockDeltaInteractives`
    - `quality.pacing.{manualActionId,manualActionImmediateReward,manualActionCooldownMs,meaningfulActionCount,timeToNextMeaningfulActionMs,idleGoldPerSec}`
  - `window.__idle.validate()` now includes quality gate checks:
    - error if `meaningfulActionCount == 0` during `tut:dock_intro`
    - warning if the last unlock spike exceeds thresholds (delta interactives/modules)
  - Harness reruns (port 5180): PASS
    - smoke: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/smoke_after_metrics`
    - ui_overwhelm_guard: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/ui_overwhelm_guard_after_metrics`
    - progression_manual_to_auto: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/progression_manual_to_auto_after_metrics`

- 2026-02-05: Fixed early-game dead time by making dock work always actionable + giving immediate feedback.
  - Engine: `DOCK_WORK_START` now:
    - grants immediate gold on shift start
    - stays clickable during the shift (clicks “hustle” reduce remaining time; cannot finish the shift without at least 1ms of time passing)
  - UI/metrics:
    - `quality.pacing.manualActionImmediateReward` set true
    - `quality.pacing.manualActionCooldownMs` now `0` in `tut:dock_intro`
  - Harness reruns: PASS
    - quality_no_dead_time_early: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/quality_no_dead_time_early_after_dock_fix`
    - smoke: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/smoke_after_dock_fix`
    - progression_manual_to_auto: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/progression_manual_to_auto_after_dock_fix`

- 2026-02-05: Fixed unlock avalanche via staged unlock ladder + Economy Intro progressive disclosure.
  - Engine staging (tutorial steps):
    - Dock Automation purchase ⇒ unlock `economy` only (`tut:economy_intro`)
    - First contract placed ⇒ unlock `minigame:cannon` + `recipe:distill_rum` (`tut:port_core`)
    - Voyages unlock only once Rum exists (prevents voyage UI early while still “stuck”)
    - Crew unlock is staged behind Economy intro completion (avoids nav avalanche)
  - UI staging:
    - In `tut:economy_intro`, only `Port` + `Economy` are surfaced; other modules are hidden/locked summaries.
    - Port page renders the dense “Melvor stack” only after `tut:port_core`.
  - Harness reruns: PASS
    - quality_unlock_avalanche_guard: `.codex-artifacts/idle-game/dead_time_avalanche_cycle_20260205_221252/quality_unlock_avalanche_guard_after_staging`

- 2026-02-05: Validation maintenance — updated self-validation scenarios + save stress generator to respect staged unlocks.
  - Updated E2E scenarios that assumed “minigame/crew/politics is visible immediately after automation”:
    - `minigame_cannon_spam_guard`, `mode_state_machine_transitions_basic`, `fun_phase3_minigame_loop_3runs`
    - `playability_tour_short`, `ui_quick_advance_basic`, `unlock_ladder_basic`
    - Phase 3: `phase3_fleet_automation_basic`, `phase3_shipyard_upgrade_basic`, `phase3_conquest_basic`, `phase3_flagship_basic`
  - Updated `pnpm check:saves` generator (`scripts/stress_saves.mjs`) to unlock Cannon Volley via first contract before snapshotting `save_after_cannon`.
  - Full Playwright suite (42 scenarios): PASS
    - artifacts: `.codex-artifacts/idle-game/validation_cycle_20260205_2230_fix9_full`

- 2026-02-05: Repo checks (post-fix): PASS
  - `pnpm check:determinism`: PASS
  - `pnpm check:saves`: PASS (fixtures regenerated under `e2e/fixtures/`)
  - `pnpm lint`: PASS
  - `pnpm build`: PASS

- 2026-02-05: Final acceptance + quality gate proof (port 5180, determinism-check: basic).
  - Artifacts: `.codex-artifacts/idle-game/final_green_20260205_2303`
  - Scenarios: `smoke`, `contracts_basic`, `minigame_cannon_basic`, `ui_overwhelm_guard`, `progression_manual_to_auto`, `quality_no_dead_time_early`, `quality_unlock_avalanche_guard`
  - Fixture sanity: `save_import_after_cannon_fixture`, `save_import_legacy_fixture`
  - Full suite rerun: `.codex-artifacts/idle-game/full_suite_final_20260205_2310` (all scenarios PASS; fixtures include the updated `save_after_cannon`)

TODO (remaining validation gaps):
- Add a small DOM↔state parity scenario (gold, contract filledQty, buff remaining) to prevent UI drift (see `VALIDATION_COVERAGE.md`).
- Add a hard “time-to-automation budget” pacing gate as an engine/script check (analysis exists in `scripts/pacing_10min.mjs`).

---

- 2026-02-06: Progression/Pacing improvement cycle (evidence-first).
  - Full harness suite (42 scenarios): PASS (no console errors/warnings/pageerrors).
    - Command: `node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario <each>`
    - Artifacts: `.codex-artifacts/idle-game/pacing_cycle_full_suite_20260206_010743`
  - Headed 10-min playthrough (automation script): PASS
    - Command: `node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario playability_audit_10min --headed true --slow-mo 100 --pause-ms 250 --determinism-check none --roundtrip-check none`
    - Artifacts: `.codex-artifacts/idle-game/pacing_cycle_headed_20260206_011412/playability_audit_10min`

  Top progression/pacing problems (with evidence):
  1) Early “Work shift” still reads as forced waiting / low agency.
     - UI shows `Working… 5s` during the only visible action; if the player waits instead of interacting, automation becomes “click → wait → click…”.
     - Evidence: `.codex-artifacts/idle-game/pacing_cycle_headed_20260206_011412/playability_audit_10min/screens/step_005_click.png`
  2) We lack a regression detector for “work is busy but still actionable”.
     - Current quality gates don’t assert that clicking during `Working…` is possible / changes state.
     - Evidence: `quality_no_dead_time_early` only checks `manualActionCooldownMs` + `meaningfulActionCount`, which are currently too coarse.
  3) Unlock burst after the first Starter Run collect is a pacing spike.
     - `VOYAGE_COLLECT` for `starter_run` adds 9 unlock IDs at once (routes + rigging + recipes).
     - Evidence: `.codex-artifacts/idle-game/pacing_cycle_full_suite_20260206_010743/unlock_ladder_basic/state.step_047.json` (`quality.debug.tail` unlock event with 9 ids)
  4) Current “unlock spike” metrics are view-dependent and missed the above burst.
     - `quality.ui.lastUnlockDeltaInteractives` stays small even when many unlock IDs are granted (because the active nav doesn’t render them yet).
     - Evidence: same `state.step_047.json` shows `lastUnlockDeltaInteractives: 1` alongside the 9-id unlock event.
  5) `quality.pacing.meaningfulActionCount` is too simplistic beyond the intro, so we can’t validate “meaningful choices” or dead-time later.
     - Evidence: `.codex-artifacts/idle-game/pacing_cycle_headed_20260206_011412/playability_audit_10min/state.final.json` has `quality.pacing.meaningfulActionCount: 1` at `tut:port_core`.

  Next fixes (targeted, with new metrics + E2E guardrails):
  - Make “Work shift” explicitly actionable while running (hustle), and add a test that fails if it becomes a disabled wait.
  - Add an unlock-burst detector based on unlock IDs (not UI counts), and stage Starter Run unlocks to prevent avalanche.
  - Improve `meaningfulActionCount` to reflect real available actions and add a “meaningful choice” assertion at a key milestone.

- 2026-02-06: Added unlock-burst metric based on unlock IDs (not UI visibility).
  - New metric: `quality.ui.lastUnlockDeltaUnlockCount` (counts unlock IDs granted on the most recent unlock event).
  - Harness rerun: PASS
    - smoke: `.codex-artifacts/idle-game/pacing_cycle_unlock_metrics_20260206_023334/smoke`

- 2026-02-06: Iteration closeout — finished current pacing/validation cycle and resolved stale scenario blockers.
  - Baseline full harness sweep (determinism-check: full): `39/42` PASS.
    - Artifacts: `.codex-artifacts/idle-game/finish_iteration_full_20260206_025725`
    - First failing expectation (fixed first): scenarios expected `route:home_to_haven` immediately after first Starter Run collect, but current staged unlock behavior grants `route:cay_to_haven`/`route:turtle_to_home` at Turtle Cay.

Decisions:
- Updated E2E expectations to match current deterministic route-unlock staging at Turtle Cay (`route:cay_to_haven` after first Starter Run collect). Rationale: keeps tests aligned with actual unlock policy and avoids false failures.
- Added a defensive null guard in `collectVoyageRuntime()` for `rt.voyage.routeId` before calling unlock logic. Rationale: satisfies strict TypeScript and safely resets to idle in impossible/legacy edge states.

Harness reruns:
- Targeted failed scenarios after E2E fix: PASS
  - `fun_phase1_first_voyage_loop`, `unlock_ladder_basic`, `phase3_fleet_automation_basic`
  - Artifacts: `.codex-artifacts/idle-game/finish_iteration_fix_routes_20260206_030421`
- Full harness suite rerun (42 scenarios, determinism-check: full): PASS (`42/42`)
  - Artifacts: `.codex-artifacts/idle-game/finish_iteration_full_rerun_20260206_030509`
  - Console scan summary across 42 `console.json`: errors=0, warnings=0, pageerrors=0

Post-fix quality/acceptance proof (required scenarios):
- `smoke`, `contracts_basic`, `minigame_cannon_basic`, `ui_overwhelm_guard`, `progression_manual_to_auto`, `quality_no_dead_time_early`, `quality_unlock_avalanche_guard`: PASS
- Artifacts: `.codex-artifacts/idle-game/finish_iteration_final_acceptance_20260206_031227`

Repo checks (final):
- `pnpm check:determinism`: PASS
- `pnpm check:saves`: PASS
- `pnpm lint`: PASS
- `pnpm build`: PASS

---

- 2026-02-06: Repository documentation system cleanup for autonomous agent operation.
  - Added canonical docs:
    - `README.md` (entry/index)
    - `GAME_SYSTEM.md` (current implemented gameplay/system contract)
    - `AUTONOMOUS_EVAL_SYSTEM.md` (autonomous run/evaluate/decide workflow)
  - Rebased/aligned legacy docs to prevent stale acceptance drift:
    - `acceptance.md` rewritten from Milestone-1 framing to current release acceptance suites.
    - `concept.md` reduced to non-binding vision context and now explicitly defers to acceptance/system docs.
    - `QUALITY_GATES.md`, `VALIDATION_PLAYBOOK.md`, `VALIDATION_COVERAGE.md`, and `product-quality.md` aligned to the same canonical hierarchy.
    - `AGENTS.md` updated to read-order include `GAME_SYSTEM.md` + `AUTONOMOUS_EVAL_SYSTEM.md` and require gameplay-doc updates when behavior changes.

Decisions:
- Promoted `acceptance.md` to release-level scenario source-of-truth (all current scenarios), not Milestone 1 only. Rationale: avoids autonomous agents making decisions from outdated completion criteria.
- Introduced explicit doc precedence (`acceptance.md` -> `GAME_SYSTEM.md` -> `AUTONOMOUS_EVAL_SYSTEM.md` -> `concept.md`). Rationale: removes ambiguity when docs disagree.
- Updated stale legacy fixture expectation in `e2e/action_payloads.json`: `save_import_legacy_fixture` now expects `route:cay_to_haven` (current staged unlock policy), not `route:home_to_haven`.

Validation (port 5180):
- Full scenario sweep (42 scenarios): initially FAIL at `save_import_legacy_fixture` (stale expectation).
- Post-fix targeted rerun:
  - `save_import_legacy_fixture`: PASS (artifacts: `.codex-artifacts/idle-game/docs_cleanup_fix_20260206_034242_save_legacy`)
- Required gate set rerun: PASS
  - `smoke`, `ui_overwhelm_guard`, `progression_manual_to_auto`, `quality_no_dead_time_early`, `quality_unlock_avalanche_guard`, `save_import_legacy_fixture`
  - artifacts: `.codex-artifacts/idle-game/docs_cleanup_gate_20260206_034254`
- Full scenario sweep rerun (42/42): PASS
  - artifacts: `.codex-artifacts/idle-game/docs_cleanup_full_rerun_20260206_034330`

Repo checks (post-fix):
- `pnpm check:determinism`: PASS
- `pnpm check:saves`: PASS (fixtures regenerated)
- `pnpm lint`: PASS
- `pnpm build`: PASS

---

- 2026-02-06: Autonomy hardening cycle (system evaluation + implementation).

Evaluation — top 5 autonomy improvements:
1) Add a one-command autonomous validation runner that orchestrates server lifecycle, harness sweep, artifact log gate, and repo checks.
2) Add a strict acceptance↔scenario contract check to prevent doc/test drift.
3) Add an artifact console/pageerror checker so autonomous runs fail on hidden runtime log regressions.
4) Add a machine-readable acceptance manifest to remove markdown parsing ambiguity (not implemented in this cycle).
5) Add a hard deterministic pacing-budget script (time-to-automation / meaningful-choice budgets) as a blocking check (not implemented in this cycle).

Implemented (top 3):
- New script: `scripts/run_autonomous_validation.mjs`
  - Runs `check_autonomy_contract` first.
  - Reuses an already-running dev server on `5180–5189` when present; otherwise starts one.
  - Runs selected/all Playwright scenarios.
  - Runs artifact log gate (`check_harness_artifacts`).
  - Optionally runs repo checks (`check:determinism`, `check:saves`, `lint`, `build`).
  - Writes `summary.json` + `summary.md` to run artifact directory.
- New script: `scripts/check_autonomy_contract.mjs`
  - Verifies acceptance scenario coverage vs `e2e/action_payloads.json` (42/42).
  - Verifies required quality scenarios are present.
  - Verifies each scenario has at least one `expect`, at least one interaction/advance step, and at least one non-meta meaningful assertion.
- New script: `scripts/check_harness_artifacts.mjs`
  - Scans harness artifact trees for `console.json`.
  - Fails on `error`, `warn`/`warning`, or `pageerror` message types.
  - Supports explicit `--dir` or defaults to latest `.codex-artifacts/idle-game/*` run.

Package scripts added:
- `check:autonomy-contract`
- `check:harness-artifacts`
- `check:autonomous`

Docs updated for autonomous usage:
- `README.md`
- `AUTONOMOUS_EVAL_SYSTEM.md`

Validation evidence:
- Harness after chunk 1: smoke PASS
  - `.codex-artifacts/idle-game/autonomy_tools_chunk1_smoke_20260206_035938`
- Harness after chunk 2: smoke PASS
  - `.codex-artifacts/idle-game/autonomy_tools_chunk2_smoke_20260206_040007`
- Autonomous runner (URL mode, smoke only, skip repo checks): PASS
  - `.codex-artifacts/idle-game/autonomy_tools_runner_smoke_20260206_040021`
- `pnpm check:autonomy-contract`: PASS
- `pnpm check:harness-artifacts -- --dir .codex-artifacts/idle-game/autonomy_tools_runner_smoke_20260206_040021`: PASS
- Autonomous runner (auto-discover existing server, smoke only, skip repo checks): PASS
  - `.codex-artifacts/idle-game/autonomy_tools_runner_autostart_fix_20260206_040148`
- Final post-fix harness check: smoke PASS
  - `.codex-artifacts/idle-game/autonomy_tools_chunk3_smoke_20260206_040218`
- 2026-02-06: Autonomous runner robustness fix.
  - `run_autonomous_validation` now auto-detects and reuses an existing dev server on ports `5180–5189` before attempting to spawn `next dev`.
  - This avoids `.next/dev/lock` failures when a dev server is already running.

Harness / command validation:
- `node scripts/run_autonomous_validation.mjs --scenarios smoke --skip-repo-checks true --out-dir .codex-artifacts/idle-game/autonomy_tools_runner_autostart_fix_20260206_040148`: PASS
- `pnpm check:autonomous -- --url http://localhost:5180 --scenarios smoke --skip-repo-checks true --out-dir .codex-artifacts/idle-game/autonomy_tools_pkg_smoke_20260206_040308`: PASS
- 2026-02-06: Full autonomous cycle verification (new tooling).
  - Command: `pnpm check:autonomous -- --url http://localhost:5180 --out-dir .codex-artifacts/idle-game/autonomy_tools_full_20260206_040429`
  - Result: PASS
    - Harness scenarios: `42/42` PASS
    - Artifact log gate: PASS (`console files scanned: 42`, `errors/warnings/pageerrors: 0`)
    - Repo checks: PASS (`check:determinism`, `check:saves`, `lint`, `build`)
  - Artifacts: `.codex-artifacts/idle-game/autonomy_tools_full_20260206_040429`
- 2026-02-06: Playtest + autonomy-quality upgrade cycle (human-play mapping + benchmark-informed autonomy hardening).

Playtest evidence (fresh):
- Focused playability suite PASS (5 scenarios):
  - `fun_phase0_first_5min`, `playability_tour_short`, `playability_audit_10min`, `fun_phase1_first_voyage_loop`, `fun_phase3_minigame_loop_3runs`
  - Artifacts: `.codex-artifacts/idle-game/playtest_audit_baseline_20260206`
- Key baseline finding before telemetry upgrade: `quality.pacing.meaningfulActionCount` stayed too flat for midgame evaluation (`1` in multiple tours), which limited autonomous fun/UX diagnosis quality.

Benchmark research used for autonomous rubric design:
- Universal Paperclips (phase-shift layering)
- Melvor Idle (long-horizon + offline trust)
- Kittens Game (resource pressure + design principles)
- A Dark Room (minimal reveal / staged complexity)
- Kongregate idle math essays (sustainable scaling and decision value)

Decisions (top priorities selected and implemented):
1) Expand deterministic quality telemetry for autonomy-grade playability evaluation.
2) Add a canonical fun/UX/UI rubric doc tied to measurable state fields.
3) Add an automated rubric scorer for harness artifacts.
4) Add dedicated playability scenarios for midgame choice pressure and active-vs-idle leverage.
5) Integrate rubric checks into the autonomous validation runner and docs.

Implemented:
- Engine/UI text-state telemetry upgrade (`apps/web/src/lib/idleStore.ts`):
  - richer `quality.progression` fields (`nextGoalCount`, `nextGoals`, unlock-state flags, route/contract/storage/flow metrics, buff count)
  - richer `quality.pacing` fields (`meaningfulActionIds`, `decisionActionCount`, timer blockers)
  - upgraded `deriveNextGoalId()` to avoid placeholder/stuck goal behavior
- New canonical rubric doc:
  - `FUN_UX_UI_RUBRIC.md`
- New rubric checker script:
  - `scripts/check_playability_rubric.mjs`
- New playability scenarios:
  - `playability_choice_pressure_midgame`
  - `playability_active_idle_leverage`
  - added to `acceptance.md` suite list
- Autonomous runner integration:
  - `scripts/run_autonomous_validation.mjs` now runs `check_playability_rubric` automatically when required playability scenarios are present
  - skip behavior for focused scenario runs (no false failures on smoke-only runs)
- Script wiring / docs updates:
  - `package.json` (`check:playability-rubric`)
  - `README.md`, `AGENTS.md`, `AUTONOMOUS_EVAL_SYSTEM.md`, `VALIDATION_PLAYBOOK.md`, `VALIDATION_COVERAGE.md`, `QUALITY_GATES.md`

Regression found/fixed during this cycle:
- Runtime error in telemetry path: `ReferenceError: getBuffRemainingMs is not defined`.
- Fix: local helper `getBuffRemainingMsForQuality` in `idleStore.ts`.

Validation runs:
- Chunk 1 quality-gate rerun PASS:
  - `.codex-artifacts/idle-game/autonomy_upgrade_chunk1_gates_20260206`
- Probe rerun for fixed runtime regression PASS:
  - `.codex-artifacts/idle-game/autonomy_upgrade_chunk1_probe_fix_20260206`
- Fresh playability trio rerun PASS:
  - `.codex-artifacts/idle-game/autonomy_upgrade_chunk2_playability_20260206`
- Rubric scoring PASS on upgraded artifacts:
  - average score `93`
- Expanded gate set + new scenarios PASS:
  - `.codex-artifacts/idle-game/autonomy_upgrade_chunk3_gates_plus_playability_20260206`
- Full release gate PASS (44 scenarios + artifact checks + rubric + repo checks):
  - `.codex-artifacts/idle-game/autonomy_upgrade_full_20260206`
  - `check:determinism` PASS
  - `check:saves` PASS
  - `lint` PASS
  - `build` PASS

- 2026-02-06: UI/design-system + autonomous playtest cycle (benchmark-informed).

Playtest + benchmark evidence:
- Focused playability suite PASS (9 scenarios):
  - `fun_phase0_first_5min`, `playability_tour_short`, `playability_audit_10min`, `playability_choice_pressure_midgame`, `playability_active_idle_leverage`, `ui_overwhelm_guard`, `progression_manual_to_auto`, `quality_no_dead_time_early`, `quality_unlock_avalanche_guard`
  - Artifacts: `.codex-artifacts/idle-game/design_system_playtest_current_20260206`
- Benchmark references used for UI/loop evaluation:
  - Universal Paperclips, Melvor Idle, Kittens Game, A Dark Room, Kongregate idle math.

Top-5 prioritized gaps (this cycle):
1) Primary-action clarity drift in midgame.
2) Weak immediate feedback narrative after actions.
3) Inconsistent visual language/token usage across UI controls.
4) Logistics pressure readability uneven in some loops.
5) Limited explicit DOM↔state UX parity checks.

Implemented (top 3):
- Added canonical UI design system doc: `DESIGN_SYSTEM.md`.
- Implemented tokenized visual foundation + typography system:
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/app/globals.css`
  - `apps/web/src/components/ui/{card,button,input}.tsx`
- Implemented action/feedback UX scaffolding in game UI:
  - `Command Deck` panel (primary objective + recommended actions)
  - `Captain's Log` panel (deterministic recent event feedback)
  - file: `apps/web/src/components/game/GameClient.tsx`
- Wired canonical docs so autonomous agents read the new system:
  - `README.md`, `AGENTS.md`, `AUTONOMOUS_EVAL_SYSTEM.md`.

Decisions:
- Adopted a hybrid UI strategy: Melvor-style modern shell + Paperclips/Kittens system-first readability + A Dark Room staged reveal.
- Prioritized deterministic UX guidance/feedback panels over decorative changes to improve autonomous and human evaluability.
- Kept all new changes selector-safe and acceptance-compatible; no `data-testid` renames.

Validation runs (port policy respected; settled on `5180`):
- Chunk 1 (tokens + quality gates): PASS
  - `.codex-artifacts/idle-game/design_system_chunk1_gates_20260206`
- Chunk 2/3 (Command Deck + Captain's Log + playability suite): PASS
  - `.codex-artifacts/idle-game/design_system_chunk2_3_gates_playability_20260206`
- Full release gate rerun (after transient stale server timeout issue): PASS
  - `.codex-artifacts/idle-game/design_system_full_rerun_20260206`
  - scenarios: `44/44` PASS
  - `check:harness-artifacts`: PASS (`errors/warnings/pageerrors: 0`)
  - `check:playability-rubric`: PASS (average `93`)
  - `check:determinism`: PASS
  - `check:saves`: PASS
  - `lint`: PASS
  - `build`: PASS

- 2026-02-06: Icon/SVG/motion system expansion + design-system rewrite.

Evaluation (design guide -> implementation gaps):
- Reviewed existing `DESIGN_SYSTEM.md` and found missing canonical guidance for icon semantics, SVG usage patterns, and motion rules.
- Prioritized 10 implementation gaps focused on scan speed, feedback clarity, and long-session usability while keeping deterministic testability unchanged.

Top 10 gaps implemented (this cycle):
1) Canonical icon language was missing -> added mapped icon semantics for nav/resources/actions.
2) Resource pills were text-heavy -> added iconized pills + deterministic sparkline SVG.
3) Warehouse pressure lacked compact urgency -> added storage ring gauge.
4) Nav lacked wayfinding cues -> added iconized nav, active chevron/rail, lock icon cue.
5) No branded SVG layer -> added Harbor Sigil SVG on title.
6) Voyage lacked topology cue -> added route mini-map SVG from current port.
7) Primary CTA emphasis inconsistent -> iconized/pulsed command-primary action.
8) Captain’s Log lacked semantic feedback -> icon + tone-coded event rows.
9) Minigame visual feedback was plain -> iconized controls + shimmer/pulse progress cues.
10) Motion system undocumented/unstable -> added motion tokens, keyframes, stagger utility, reduced-motion guard.

Implemented files:
- `apps/web/src/components/game/GameClient.tsx`
- `apps/web/src/app/globals.css`
- `DESIGN_SYSTEM.md`

Decisions:
- Used `lucide-react` + inline deterministic SVG (no new runtime dependencies) to keep UI extensible and acceptance-safe.
- Kept all existing `data-testid` selectors unchanged; only added visuals/motion and non-contractual helper UI.
- Motion is intentionally subtle and entirely CSS-based with `prefers-reduced-motion` fallback.

Validation runs:
- Change gate after chunk 1: PASS
  - `.codex-artifacts/idle-game/icons_motion_chunk1_gates_20260206`
- Change gate after chunk 2: PASS
  - `.codex-artifacts/idle-game/icons_motion_chunk2_gates_20260206`
- Change gate after lint-fix chunk: PASS
  - `.codex-artifacts/idle-game/icons_motion_chunk3_lintfix_gates_20260206`
- Focused playability/minigame/voyage suite: PASS (8 scenarios)
  - `.codex-artifacts/idle-game/icons_motion_chunk4_playability_20260206`
  - rubric: PASS, average `93`
- Full completion gate: PASS
  - `.codex-artifacts/idle-game/icons_motion_full_20260206`
  - scenarios: `44/44` PASS
  - `check:harness-artifacts`: PASS (`errors/warnings/pageerrors: 0`)
  - `check:playability-rubric`: PASS (average `93`)
  - `check:determinism`: PASS
  - `check:saves`: PASS
  - `lint`: PASS
  - `build`: PASS

- 2026-02-06: Midgame playtest + autonomy hardening cycle (progression/scaling focus).

Playtest + mapping evidence:
- Baseline midgame suite (8 scenarios): PASS
  - `.codex-artifacts/idle-game/midgame_eval_baseline_20260206`
- Post-change midgame suite (8 scenarios): PASS
  - `.codex-artifacts/idle-game/midgame_eval_post_20260206`
- Human-play mapping snapshots:
  - politics-heavy midgame: `.codex-artifacts/idle-game/midgame_eval_post_20260206/playability_audit_10min/screens/step_058_expect.png`
  - economy/contract pressure state: `.codex-artifacts/idle-game/midgame_eval_post_20260206/playability_choice_pressure_midgame/screens/step_027_expect.png`
  - active+idle leverage state: `.codex-artifacts/idle-game/midgame_eval_post_20260206/playability_active_idle_leverage/screens/step_030_expect.png`

Top 10 prioritized gaps (this cycle):
1) Midgame goals can become stale or generic after route unlock branching.
2) Route progression metrics mix global and current-port scope, reducing autonomous diagnosis quality.
3) Midgame bottlenecks (rum gap, chart affordability, sink pressure) are not consolidated in one panel.
4) Command Deck can suggest navigation detours instead of directly unblocking stalled voyage flow.
5) Choice-pressure telemetry undercounts real decisions (dock hustle/work, hold transfer, rigging start).
6) Route branch expansion readiness is hard to infer quickly from existing UI cards.
7) Human/agent evaluation loop lacks explicit route-scope metrics for “why voyages are idle”.
8) Midgame progression health is spread across many cards (contracts, hold, voyages, politics).
9) Goal text in voyage branch states did not always explain chart-vs-rum next step cleanly.
10) Autonomy diagnostics need stronger parity between human “what feels blocked” and machine-readable state.

Implemented top 5:
1) Reworked engine next-goal generation for dynamic route/chart/rum states.
   - file: `packages/engine/src/sim.ts` (`getNextGoalsForUi`)
2) Expanded decision-pressure telemetry action set to better reflect meaningful options.
   - file: `apps/web/src/lib/idleStore.ts` (`DECISION_ACTION_IDS`)
3) Added route-scope progression telemetry (global vs current port, rum gap, chart affordability).
   - file: `apps/web/src/lib/idleStore.ts` (`quality.progression.*`)
4) Added a `Midgame Scaling Radar` panel for bottlenecks and expansion windows.
   - file: `apps/web/src/components/game/GameClient.tsx`
5) Upgraded Command Deck to directly execute voyage preparation when rum-gated.
   - file: `apps/web/src/components/game/GameClient.tsx`

Decisions:
- Prioritized autonomy-visible diagnostics (route scope + rum gap + chart affordability) over adding new content systems, because acceptance already passes and the larger gap was evaluation fidelity.
- Treated voyage stalls as the dominant midgame friction to solve first: this improves both human readability and agent decision quality without changing deterministic core rules.

Validation runs after each meaningful change:
- Change gate A (post engine/telemetry edits): PASS
  - `.codex-artifacts/idle-game/midgame_eval_change_gate_20260206_a`
- Change gate B (post deriveNextGoalId + route-scope metrics): PASS
  - `.codex-artifacts/idle-game/midgame_eval_change_gate_20260206_b`
- Change gate C (post Midgame Scaling Radar UI): PASS
  - `.codex-artifacts/idle-game/midgame_eval_change_gate_20260206_c`
- Change gate D (post Command Deck prepare action): PASS
  - `.codex-artifacts/idle-game/midgame_eval_change_gate_20260206_d`

Completion gate:
- Full acceptance + repo gate: PASS
  - `.codex-artifacts/idle-game/midgame_eval_full_20260206`
  - scenarios: `44/44` PASS
  - `check:harness-artifacts`: PASS (`errors/warnings/pageerrors: 0`)
  - `check:playability-rubric`: PASS (average `93`)
  - `check:determinism`: PASS
  - `check:saves`: PASS
  - `lint`: PASS
  - `build`: PASS

- 2026-02-06: Player UI cleanup via explicit debug-display mode (same core sim).

Problem statement:
- Midgame/autonomy diagnostics were visible in normal player flow (e.g., scaling radar, contract technical IDs like `#c_2`), which cluttered player UX.

Decision:
- Split display concerns, not game logic:
  - Normal mode: player-clean UI (hide debug-heavy surfaces/IDs).
  - Debug mode: reveal additional diagnostics for autonomous/human evaluation.
- Debug mode activation policy:
  - automatic when `navigator.webdriver === true` (harness/agent runs)
  - optional for humans via URL param: `?debug=1` (also accepts `true` / `on`)

Implemented:
- `apps/web/src/components/game/GameClient.tsx`
  - Added `debugUi` gate (`isAutomation || forceDebugUi`).
  - Added URL-based debug toggle parsing from `window.location.search`.
  - Gated debug-heavy panels in normal mode:
    - `CaptainsLogPanel`
    - `MidgameScalingPanel`
    - `Captain’s Ledger`
    - `DebugDispatchPanel`
  - Kept these visible in debug mode and in automation.
  - Economy row cleanup:
    - show commodity display name in normal mode
    - hide contract technical IDs/priority hints unless in debug mode
    - keeps strategy details available when debugging.

Regression and fix during cycle:
- Initial attempt used `useSearchParams`, which caused Next build failure without Suspense boundary.
- Replaced with client-only `window.location.search` parse to keep static build green.

Validation runs:
- Change gate attempt A: failed due misplaced variable scope compile error (`searchParams` undefined).
  - killed stuck process and fixed scope.
- Change gate B: stale server timeout (`page.goto`); reran clean on fixed port.
- Change gate C (clean rerun): PASS
  - `.codex-artifacts/idle-game/debug_ui_split_change_gate_20260206_c`
  - scenarios: `smoke`, `contracts_basic`, `contracts_strategy_levers_basic`, quality gates, `playability_choice_pressure_midgame`
- Smoke after `useSearchParams` removal: PASS
  - `.codex-artifacts/idle-game/debug_ui_split_smoke_fix_20260206`
- Explicit URL debug-mode probe (`?debug=1`): PASS
  - `.codex-artifacts/idle-game/debug_ui_param_smoke_20260206`
- Full completion gate rerun: PASS
  - `.codex-artifacts/idle-game/debug_ui_split_full_rerun_20260206`
  - scenarios: `44/44` PASS
  - `check:harness-artifacts`: PASS (`errors/warnings/pageerrors: 0`)
  - `check:playability-rubric`: PASS (average `93`)
  - `check:determinism`: PASS
  - `check:saves`: PASS
  - `lint`: PASS
  - `build`: PASS
