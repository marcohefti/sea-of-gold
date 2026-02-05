# Sea of Gold — Acceptance Criteria

This is the single source of truth for “done”.  
If `concept.md` disagrees with this file, this file wins.

## Verification loop (mandatory)

Use the `develop-idle-game` skill harness. The project must provide an actions file and a dev URL.

Dev server port policy:
- Start at `5180`
- If occupied, increment until a free port is found
- Allowed range: `5180–5189`

Example (use the selected port):
```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export IDLE_GAME_CLIENT="$CODEX_HOME/skills/develop-idle-game/scripts/idle_game_playwright_client.js"
node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario smoke
```

Passing requirements:
- The harness run exits `0`.
- No console errors.
- Expectations pass.
- Determinism rerun check passes (enabled by default in the harness).

## Harness contract (must implement in the web app)

Expose on `window`:

1) `window.render_game_to_text(): string`
- Returns a concise JSON string (raw values for assertions; avoid formatted currency strings).
- Must include at minimum:
  - `meta`: `{ version: string, nowMs: number, mode: "title" | "port" | "voyage" | string }`
  - `resources`: `{ gold: string | number }` (integer-like)
  - `unlocks`: `string[]`
  - `economy`: `{ contracts: Array<{ commodityId: string, qty: string|number, filledQty: string|number, status: string }> }`
  - `buffs`: `Array<{ id: string, remainingMs: number }>`
  - `quality` (product-quality regression detectors):
    - `quality.ui`: `{ mode, visibleModuleCount, visibleNavCount, visibleInteractiveCount, primaryActionCount, totalActionCount, tutorialStepId, lastUnlockDeltaModules, lastUnlockDeltaInteractives }`
    - `quality.progression`: `{ goldPassivePerSec, goldManualActionAvailable, goldManualActionCount, automationUnlocked, nextGoalId }`
    - `quality.pacing`: `{ manualActionId, manualActionImmediateReward, manualActionCooldownMs, meaningfulActionCount, timeToNextMeaningfulActionMs, idleGoldPerSec }`
    - `quality.validation`: `{ ok: boolean, errors: string[], warnings: string[] }` (recommended)

2) `window.advanceTime(ms: number): void | Promise<void>`
- Deterministic stepping; does not depend on real-time rAF progression.

3) `window.__idle` namespace:
```js
window.__idle = {
  version: "0.1.0",
  exportSave(): string,
  importSave(save: string): void,
  hardReset(): void,
  setSeed(seed: number): void,
  validate?(): { ok: boolean, errors: string[], warnings: string[] }
}
```

## Required `data-testid` selectors (stable)

These IDs must exist once the corresponding UI exists. Do not rename them after adding.

Global / nav:
- `start-new-game`
- `nav-port`, `nav-voyage`, `nav-crew`, `nav-economy`, `nav-politics`

Dock (onboarding):
- `work-docks`
- `upgrade-auto-dockwork`

Economy (contracts):
- `contracts-open`, `contracts-place`, `contracts-collect`
- `contracts-commodity`, `contracts-qty`, `contracts-price`

Minigame:
- `minigame-cannon-open`, `minigame-cannon-start`

## Milestone 1 — end-to-end vertical slice (must be automated)

Each acceptance item is written so it can be verified with Playwright steps + state assertions.

### AC-M1-001 Start a new game
AUTO:
- Scenario: `smoke`
- Steps:
  - click `[data-testid='start-new-game']`
- Expect:
  - `meta.mode` != `"title"` (or equals `"port"`, if you choose to be strict)

### AC-M1-002 Idle gold increases deterministically
AUTO:
- Scenario: `smoke`
- Steps:
  - advance `5000ms`
  - click `[data-testid='work-docks']`
  - advance `5000ms`
- Expect:
  - `resources.gold` > `0`
  - `meta.nowMs` >= `10000`

### AC-M1-003 Save roundtrip is stable
AUTO:
- Enforced by the harness itself:
  - export → hardReset → import must not crash
  - subset equality must hold (resources/unlocks/location when present)

### AC-M1-004 Determinism rerun passes
AUTO:
- Enforced by the harness itself (same seed + same scenario rerun ⇒ same subset state).

### AC-M1-005 Contracts can be placed and progress deterministically
AUTO:
- Scenario: `contracts_basic`
- Expected state shape (minimum for testing):
  - `economy.contracts[0]` exists after placing
  - `economy.contracts[0].filledQty` is `0` right after placing
  - `economy.contracts[0].filledQty` increases after time advances

### AC-M1-006 Cannon Volley minigame yields a visible result
AUTO:
- Scenario: `minigame_cannon_basic`
- Expected:
  - `buffs` contains `{ id: "cannon_volley" }`
  - and its `remainingMs` is `> 0`

## Product quality regression guards (must stay passing)

These scenarios prevent silent regressions in onboarding clarity and manual→automation pacing.

### AC-PQ-001 UI overwhelm guard
AUTO:
- Scenario: `ui_overwhelm_guard`
- Expected (immediately after starting a new game):
  - `quality.ui.visibleModuleCount` <= `1`
  - `quality.ui.primaryActionCount` <= `2`
  - `quality.ui.totalActionCount` <= `6`

### AC-PQ-002 Manual → automation progression exists
AUTO:
- Scenario: `progression_manual_to_auto`
- Expected:
  - Early: `quality.progression.goldPassivePerSec` == `0` and `resources.gold` does not increase under `advanceTime` alone
  - After manual action: `resources.gold` increases deterministically
- After buying first automation: `quality.progression.goldPassivePerSec` > `0` and gold increases under `advanceTime` without further manual actions

### AC-PQ-003 No dead time (early)
AUTO:
- Scenario: `quality_no_dead_time_early`
- Expected:
  - `quality.pacing.meaningfulActionCount` >= `1` at `tut:dock_intro`
  - `quality.pacing.timeToNextMeaningfulActionMs` == `0` at `tut:dock_intro`
  - `quality.pacing.manualActionCooldownMs` <= `250`
  - After clicking `[data-testid='work-docks']`: `quality.pacing.manualActionImmediateReward` == `true` and `resources.gold` > `0`

### AC-PQ-004 Unlock avalanche guard
AUTO:
- Scenario: `quality_unlock_avalanche_guard`
- Expected (immediately after buying `[data-testid='upgrade-auto-dockwork']`):
  - `quality.ui.lastUnlockDeltaModules` <= `2`
  - `quality.ui.lastUnlockDeltaInteractives` <= `8`
  - `quality.ui.visibleModuleCount` <= `2`
  - `quality.ui.visibleInteractiveCount` <= `30`

## Actions file requirements

The repo must provide `./e2e/action_payloads.json` with scenarios:
- `smoke`
- `contracts_basic`
- `minigame_cannon_basic`
- `ui_overwhelm_guard`
- `progression_manual_to_auto`
- `quality_no_dead_time_early`
- `quality_unlock_avalanche_guard`

Use the step types supported by the harness (`click`, `fill`, `advance`, `expect`, ...).
Each scenario must include at least one `expect` that proves progress occurred (not just navigation/clicks).
