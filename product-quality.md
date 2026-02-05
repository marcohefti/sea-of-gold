# Sea of Gold — Product Quality Guardrails

This document exists to prevent two early-game regressions from silently returning:

1) **Overwhelm at game start** (too many visible screens/options immediately)
2) **Broken manual → automation beat** (passive gold from frame 1)
3) **Dead time / no agency** (forced waiting where the player can’t meaningfully act)
4) **Unlock avalanche / overwhelm spike** (one purchase unlocks too many controls at once)

All checks below are **deterministic** and verified via the Playwright harness.

## Progressive Disclosure Checklist

### Phase 0: Immediately after starting a new game (`tut:dock_intro`)

**What must be visible**
- One module/screen: **Port / Dock intro**
- One clear “what next” CTA: **Work the docks**
- One clear early upgrade: **Buy Dock Automation**

**What must NOT be visible**
- No full Economy/Crew/Voyage/Politics pages
- No minigame panel entry points (until unlocked)
- No “everything at once” dense stack of port panels

**Locked modules behavior**
- Locked modules should be *hidden* or summarized with a single short message (no full pages of controls).

**Action count thresholds (regression detector)**
- `quality.ui.visibleModuleCount <= 1`
- `quality.ui.primaryActionCount <= 2`
- `quality.ui.totalActionCount <= 6`

These thresholds are enforced by `ui_overwhelm_guard`.

### Phase 1: After buying Dock Automation (`tut:economy_intro` and beyond)

**What should unlock**
- Economy navigation and a lightweight contracts intro (one new lane at a time)
- Cannon Volley and distilling unlock **after placing the first contract** (to avoid an unlock avalanche)
- Voyages unlock once you have Rum available (engine ladder), which then unlocks starter routes

**Guideline**
- Prefer **unlocking one new screen at a time**, and avoid introducing multiple new sinks + generators simultaneously.

## Manual → Automation Rule

### Definition

Early gold progression must have a clear beat:

1) **Manual**: player performs a deliberate action that yields gold deterministically.
2) **Automation**: player buys an early upgrade that enables passive gold over `advanceTime` without further clicks.

### Why it matters

- Restores the classic incremental arc: **learn → earn → invest → automate**
- Prevents “nothing I do matters” when passive income starts immediately
- Makes the first upgrade feel like a breakthrough instead of an afterthought

### How to test it (deterministically)

Signals come from `window.render_game_to_text()`:
- `quality.progression.goldPassivePerSec`
- `quality.progression.goldManualActionAvailable`
- `quality.progression.automationUnlocked`
- `resources.gold`

Required scenario: `progression_manual_to_auto`
- Confirms `goldPassivePerSec == 0` at start
- Confirms gold does **not** increase under `advanceTime` alone
- Confirms the manual action increases gold deterministically
- Confirms buying the first automation upgrade makes gold increase under `advanceTime` without additional clicks

## No Dead Time / Agency Gate

### Definition

In the early tutorial, the player must always have at least one meaningful action available. Cooldowns must not create “click → wait → nothing” loops.

### Deterministic signals

From `render_game_to_text()`:
- `quality.pacing.meaningfulActionCount`
- `quality.pacing.timeToNextMeaningfulActionMs`
- `quality.pacing.manualActionCooldownMs`
- `quality.pacing.manualActionImmediateReward`

### How to test it

Scenario: `quality_no_dead_time_early`
- Asserts `meaningfulActionCount >= 1` and `timeToNextMeaningfulActionMs == 0` at `tut:dock_intro`
- Clicks the manual action and asserts immediate reward is visible (`resources.gold > 0`)

## Unlock Avalanche Guard

### Definition

A single unlock/purchase must not explode the UI. Unlocks should be staged (one new lane at a time), with locked modules summarized.

### Deterministic signals

From `render_game_to_text()`:
- `quality.ui.lastUnlockDeltaModules`
- `quality.ui.lastUnlockDeltaInteractives`
- `quality.ui.visibleModuleCount`
- `quality.ui.visibleInteractiveCount`

### How to test it

Scenario: `quality_unlock_avalanche_guard`
- After buying Dock Automation, asserts unlock deltas and visible counts stay under caps:
  - `lastUnlockDeltaModules <= 2`
  - `lastUnlockDeltaInteractives <= 8`
  - `visibleModuleCount <= 2`
  - `visibleInteractiveCount <= 30`

## How to detect overwhelm

### Use `quality.ui` as the guardrail surface

`quality.ui` is computed from **UI configuration/state**, not DOM scraping:
- `visibleNavCount`: nav buttons currently rendered
- `visibleModuleCount`: top-level screens/panels currently visible (active nav + optional minigame panel)
- `primaryActionCount`: main CTA buttons intentionally surfaced for the tutorial phase
- `totalActionCount`: primary actions + nav actions (not every minor widget)
- `tutorialStepId`: onboarding step ID from engine state

When adding new systems, update the counts model so `ui_overwhelm_guard` remains meaningful.

### Adding new guardrails

If a new system increases early complexity, add a new scenario that asserts one of:
- A module remains hidden until its unlock requirement is met
- A tutorial step advances only after a deliberate action
- A “next goal” changes at the intended milestone (`quality.progression.nextGoalId`)

## When adding a new module

Before landing any new module (screen/system), require:

1) **Stable ID**
- New module ID and related unlock IDs must be stable (`unlocks[]`).

2) **Unlock requirement**
- Add a deterministic requirement in the engine (not the UI) that governs when the module becomes available.

3) **Locked-state UI**
- If shown while locked: single-line summary explaining the unlock requirement.
- Do not render the full action-heavy page while locked.

4) **Quality metrics update**
- Update `quality.ui` counting rules to reflect the new module *only when it is actually visible*.

5) **At least one e2e assertion**
- Add a harness scenario (or extend an existing one) that asserts:
  - The unlock appears in `unlocks[]` at the right moment, and
  - The module’s key progression outcome changes deterministically under `advanceTime`.
