# Sea of Gold — Quality Gates

This file defines product-quality regression gates.

Normative order:
1. `acceptance.md`
2. `QUALITY_GATES.md`

If a threshold here conflicts with acceptance scenario expectations, `acceptance.md` wins.

## Blocking Gates

### Gate 1: Start overwhelm guard
- Scenario: `ui_overwhelm_guard`
- Purpose: prevent feature overload at game start
- Thresholds at `tut:dock_intro`:
  - `quality.ui.visibleModuleCount <= 1`
  - `quality.ui.primaryActionCount <= 2`
  - `quality.ui.totalActionCount <= 6`

### Gate 2: Manual -> automation progression
- Scenario: `progression_manual_to_auto`
- Purpose: preserve onboarding rhythm and agency
- Required behavior:
  - passive gold is zero before automation
  - manual dock action gives deterministic progress
  - passive gold turns on after automation purchase

### Gate 3: No early dead time
- Scenario: `quality_no_dead_time_early`
- Purpose: prevent forced waiting without actions
- Thresholds at `tut:dock_intro`:
  - `quality.pacing.meaningfulActionCount >= 1`
  - `quality.pacing.timeToNextMeaningfulActionMs == 0`
  - `quality.pacing.manualActionCooldownMs <= 250`

### Gate 4: Unlock avalanche guard
- Scenario: `quality_unlock_avalanche_guard`
- Purpose: prevent unlock spikes immediately after first automation purchase
- Thresholds:
  - `quality.ui.lastUnlockDeltaModules <= 2`
  - `quality.ui.lastUnlockDeltaInteractives <= 8`
  - `quality.ui.visibleModuleCount <= 2`
  - `quality.ui.visibleInteractiveCount <= 30`

## Advisory Gate (Warning)

### Gate 5: Unlock-ID burst
- Metric: `quality.ui.lastUnlockDeltaUnlockCount`
- Current warning threshold: `<= 6`
- Intent: catch hidden unlock bursts that UI-count-only metrics can miss.

This gate is currently advisory (warning), not blocking.

### Gate 6: Midgame choice pressure
- Scenario: `playability_choice_pressure_midgame`
- Purpose: ensure the player has multiple meaningful choices after onboarding.
- Target thresholds:
  - `quality.pacing.meaningfulActionCount >= 5`
  - `quality.pacing.decisionActionCount >= 2`
  - `quality.progression.nextGoalCount >= 2`

### Gate 7: Active + idle leverage
- Scenario: `playability_active_idle_leverage`
- Purpose: verify active inputs still matter while idle progression remains active.
- Target thresholds:
  - `quality.pacing.meaningfulActionIds` includes `minigame-cannon-start`
  - `quality.progression.activeBuffCount >= 1` after a cannon run
  - `quality.progression.goldPassivePerSec > 0`

## Invariant Layer

Use `window.__idle.validate()` and `quality.validation` to fail fast on structural state errors during play and fixture imports.
