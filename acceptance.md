# Sea of Gold — Acceptance Criteria (Current Release)

This file is the single source of truth for "done".
If any other doc conflicts with this file, this file wins.

Release metadata:
- Status: active
- Last revised: 2026-02-06
- Supersedes: prior milestone-specific acceptance notes and historical progress logs

## 0) Freshness And Change Control

- Keep this file aligned with `e2e/action_payloads.json` in the same change set.
- If behavior expectations change, update this file first, then implementation.
- Do not use `progress.md` as an acceptance source.
- Historical notes are non-normative; only this file defines current release pass/fail.

## 1) Verification Loop (Mandatory)

Use the `develop-idle-game` Playwright harness.

Dev server port policy:
- start at `5180`
- if occupied, increment (`5181` ... `5189`)
- if all are occupied, fail with a clear error

Harness command (use selected port):
```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export IDLE_GAME_CLIENT="$CODEX_HOME/skills/develop-idle-game/scripts/idle_game_playwright_client.js"
node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario smoke
```

Passing requirements for every harness run:
- process exits `0`
- no console errors/page errors
- all `expect` steps pass
- determinism rerun check passes (default enabled)
- save roundtrip check passes (default enabled)

## 2) Pass Levels

### Level A — Change Gate (after each meaningful change)

Run:
- `smoke`
- all affected subsystem scenarios
- quality gates:
  - `ui_overwhelm_guard`
  - `progression_manual_to_auto`
  - `quality_no_dead_time_early`
  - `quality_unlock_avalanche_guard`

### Level B — Completion Gate (before declaring done)

Run all scenarios in `e2e/action_payloads.json` and ensure full green.

Also run:
- `pnpm check:determinism`
- `pnpm check:saves`
- `pnpm lint`
- `pnpm build`

## 3) Harness Contract (Required)

The web app must expose:

1. `window.render_game_to_text(): string`
- concise JSON with raw assertion values (no formatted currency strings)
- required minimum fields:
  - `meta`: `{ version, nowMs, mode }`
  - `resources`: includes `gold`
  - `unlocks`: `string[]`
  - `economy.contracts[]`
  - `buffs[]`
  - `quality.ui`
  - `quality.progression`
  - `quality.pacing`
  - `quality.validation` (recommended, currently expected by fixtures/checks)
  - `quality.debug` (recommended; deterministic transition breadcrumbs)

2. `window.advanceTime(ms: number): void | Promise<void>`
- deterministic stepping by exactly `ms`
- tests must not depend on real-time rendering clocks

3. `window.__idle`
```js
window.__idle = {
  version: "0.1.0",
  exportSave(): string,
  importSave(save: string): void,
  hardReset(): void,
  setSeed(seed: number): void,
  validate?(): { ok: boolean, errors: string[], warnings: string[] },
  debug?: {
    getLog(): unknown,
    clear(): void
  }
}
```

## 4) Determinism And Save Semantics

- no `Math.random()` / `Date.now()` in engine simulation logic
- deterministic replay: same seed + same actions + same `advanceTime` -> same state subset
- save payload must preserve simulation and RNG state needed for deterministic continuation
- export/import roundtrip must not crash and must preserve critical state subset
- automated tests must not rely on implicit wall-clock catch-up

## 5) Selector Stability

Stable selectors are contractual.

At minimum, these must remain stable:
- `start-new-game`
- `nav-port`, `nav-economy`, `nav-crew`, `nav-voyage`, `nav-politics`
- `work-docks`
- `upgrade-auto-dockwork`
- `contracts-open`, `contracts-place`, `contracts-collect`
- `contracts-commodity`, `contracts-qty`, `contracts-price`
- `minigame-cannon-open`, `minigame-cannon-start`

Additionally, any selector referenced in `e2e/action_payloads.json` is considered contractual once introduced.

## 6) Quality Gates (Blocking)

### AC-PQ-001 UI overwhelm guard
Scenario: `ui_overwhelm_guard`

Expected right after new game:
- `quality.ui.visibleModuleCount <= 1`
- `quality.ui.primaryActionCount <= 2`
- `quality.ui.totalActionCount <= 6`

### AC-PQ-002 Manual -> automation progression
Scenario: `progression_manual_to_auto`

Expected:
- early: `quality.progression.goldPassivePerSec == 0`
- early: `resources.gold` does not increase under idle `advanceTime` only
- manual dock work increases gold deterministically
- after dock automation: passive gold is positive and increases under `advanceTime`

### AC-PQ-003 No dead time (early)
Scenario: `quality_no_dead_time_early`

Expected at `tut:dock_intro`:
- `quality.pacing.meaningfulActionCount >= 1`
- `quality.pacing.timeToNextMeaningfulActionMs == 0`
- `quality.pacing.manualActionCooldownMs <= 250`
- after clicking dock work: immediate reward signal remains true and gold increases

### AC-PQ-004 Unlock avalanche guard
Scenario: `quality_unlock_avalanche_guard`

Expected immediately after buying dock automation:
- `quality.ui.lastUnlockDeltaModules <= 2`
- `quality.ui.lastUnlockDeltaInteractives <= 8`
- `quality.ui.visibleModuleCount <= 2`
- `quality.ui.visibleInteractiveCount <= 30`

## 7) Scenario Suites (Current Release)

These suites define current release behavior. Each listed scenario must remain passing.

### Suite A — Foundation
- `smoke`
- `mode_state_machine_transitions_basic`
- `unlock_gates_phase0_basic`
- `ui_quick_advance_basic`

### Suite B — Economy / Contracts
- `contracts_basic`
- `contracts_strategy_levers_basic`
- `contracts_cancel_basic`
- `politics_influence_from_contracts_basic`

### Suite C — Voyage / Logistics
- `voyage_prepare_basic`
- `voyage_chart_unlock_basic`
- `voyage_encounters_visible_basic`
- `voyage_ship_speed_basic`
- `phase0_loop`
- `phase1_cannonballs_encounter`
- `fun_phase1_first_voyage_loop`

### Suite D — Minigames
- `minigame_cannon_basic`
- `minigame_cannon_spam_guard`
- `phase2_rigging_run_efficiency`
- `fun_phase3_minigame_loop_3runs`

### Suite E — Politics / Sinks / Late Progression
- `phase2_politics_tax_discount`
- `politics_tax_relief_campaign_basic`
- `phase2_cosmetics_vanity_signage`
- `phase3_shipyard_upgrade_basic`
- `phase3_fleet_automation_basic`
- `phase3_conquest_basic`
- `phase3_flagship_basic`
- `unlock_ladder_basic`

### Suite F — Offline / Save / Migration
- `fun_phase4_offline_2h`
- `fun_phase4_offline_8h`
- `save_import_fresh_fixture`
- `save_import_after_automation_fixture`
- `save_import_after_contracts_fixture`
- `save_import_after_cannon_fixture`
- `save_import_after_starter_voyage_fixture`
- `save_import_legacy_fixture`

### Suite G — Playability Tours
- `fun_phase0_first_5min`
- `playability_tour_short`
- `playability_audit_10min`
- `playability_choice_pressure_midgame`
- `playability_active_idle_leverage`

## 8) Actions File Requirements

The repo must provide `./e2e/action_payloads.json` containing all scenario IDs listed in this document.

Each scenario must:
- include at least one meaningful `expect`
- prove progress or state transition (not click-only navigation)
- remain deterministic under rerun
