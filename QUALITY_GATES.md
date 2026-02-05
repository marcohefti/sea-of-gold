# Sea of Gold — Quality Gates

This repo treats “product quality” regressions as **deterministic test failures**.

All gates are enforced via:
- `window.render_game_to_text()` (machine-readable metrics; raw values)
- Playwright harness scenarios in `e2e/action_payloads.json`
- Optional invariant checks from `window.__idle.validate()`

If you introduce a new system or module, you must:
1) define its unlock requirement in the engine,
2) add a locked-state UI (no action-heavy page while locked),
3) update `quality.ui` / `quality.pacing` metrics, and
4) add at least one scenario assertion.

## Gate 1 — Start overwhelm guard

**Issue class:** Progressive disclosure failure at game start.

**Signals (state):** `quality.ui.{tutorialStepId,visibleModuleCount,primaryActionCount,totalActionCount}`

**Scenario:** `ui_overwhelm_guard`

**Thresholds (at `tut:dock_intro`):**
- `visibleModuleCount <= 1`
- `primaryActionCount <= 2`
- `totalActionCount <= 6`

## Gate 2 — Manual → automation progression

**Issue class:** Passive gold starts immediately, removing the “manual → automate” beat.

**Signals (state):** `quality.progression.*`, `resources.gold`

**Scenario:** `progression_manual_to_auto`

**Rules:**
- Early (`tut:dock_intro`): `goldPassivePerSec == 0` and gold does not increase under `advanceTime` alone.
- Manual action increases gold deterministically.
- After buying Dock Automation: `goldPassivePerSec > 0` and gold increases under `advanceTime` without further clicks.

## Gate 3 — No dead time / agency (early)

**Issue class:** Forced waiting where the player has no meaningful actions available.

**Signals (state):** `quality.pacing.{meaningfulActionCount,timeToNextMeaningfulActionMs,manualActionCooldownMs,manualActionImmediateReward}`

**Scenario:** `quality_no_dead_time_early`

**Thresholds (at `tut:dock_intro`):**
- `meaningfulActionCount >= 1`
- `timeToNextMeaningfulActionMs == 0`
- `manualActionCooldownMs <= 250`

## Gate 4 — Unlock avalanche / overwhelm spike

**Issue class:** One purchase/unlock causes a sudden spike in visible modules/actions.

**Signals (state):** `quality.ui.{lastUnlockDeltaModules,lastUnlockDeltaInteractives,visibleModuleCount,visibleInteractiveCount}`

**Scenario:** `quality_unlock_avalanche_guard`

**Thresholds (immediately after buying Dock Automation):**
- `lastUnlockDeltaModules <= 2`
- `lastUnlockDeltaInteractives <= 8`
- `visibleModuleCount <= 2`
- `visibleInteractiveCount <= 30`

## Invariant self-check (recommended)

Expose `window.__idle.validate(): { ok, errors, warnings }` and include it in `render_game_to_text().quality.validation`.

Minimum expectations:
- `ok === true` during normal play and after fixture imports (`pnpm check:saves` asserts this).
- Early tutorial errors if `meaningfulActionCount === 0`.
- Warnings if unlock delta thresholds are exceeded (helps triage before the gate trips).

