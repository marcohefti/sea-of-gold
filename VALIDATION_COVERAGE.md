# Sea of Gold — Validation Coverage Map

This document maps **product quality**, **determinism**, and **system correctness** criteria to the current automated checks.

Goal: reduce “false greens” where tests pass but the game is still wrong.

## Legend

- **Engine/script**: deterministic Node scripts (no browser) or repo checks.
- **E2E scenario**: Playwright harness scenario in `e2e/action_payloads.json`.
- **State fields**: paths in `render_game_to_text()` required for stable assertions.
- **Gaps**: missing coverage or known weaknesses.

## Coverage table (minimum criteria A–H)

| Criteria | Engine / scripts | E2E scenarios | Required `render_game_to_text` fields | Gaps / notes |
|---|---|---|---|---|
| A) Progressive disclosure / anti-overwhelm | — | `ui_overwhelm_guard` | `quality.ui.*`, `meta.mode` | Only guards tutorial step 0/1; no guard once Port expands post-automation. |
| B) Manual → automation progression | — | `progression_manual_to_auto`, `smoke` (manual action) | `quality.progression.*`, `resources.gold` | No invariant check that passive stays 0 until automation; depends on scenario only. |
| C) Pacing / dead-time bounds (early) | `scripts/pacing_10min.mjs` (exists; not yet a hard gate) | `fun_phase0_first_5min`, `playability_audit_10min` (currently failing) | `quality.progression.nextGoalId`, core resources/unlocks | Needs deterministic baseline assertions with explicit time budgets (e.g., time-to-automation ≤ 90s). |
| D) Meaningful choice presence (early) | — | (none dedicated) | `quality.progression.nextGoalId`, unlocks | Needs a “choice gate” (≥2 viable actions) derived from state, not DOM. |
| E) Active minigame: deterministic tiered reward + downstream impact | — | `minigame_cannon_basic` | `buffs[]` (and buff raw fields), resources/unlocks | Lacks explicit tier assertion + “impact proof” (e.g., voyage income changed while buff active). |
| F) Offline catch-up deterministic + capped (if implemented) | — | `fun_phase4_offline_2h`, `fun_phase4_offline_8h` (currently failing) | `meta.nowMs`, offline summary fields (if any) | Needs a dedicated `offline` summary in state + a cap assertion. |
| G) Save/import/export versioning + migrations | `scripts/stress_saves.mjs` (**currently failing**) + harness roundtrip | `save_import_legacy_fixture` | `meta.version`, core state (resources/unlocks/location/systems), save schema version | `check:saves` fixture generator must be updated for Dock Intro; need more fixture points + migration assertions. |
| H) No hidden UI/engine mismatch | — | (none dedicated) | UI-display parity fields + `quality.ui` / `quality.validation` | Needs a dedicated scenario that compares a small set of DOM numbers vs state, plus engine invariants in `quality.validation`. |

## System correctness (core loops)

| System | Engine / scripts | E2E scenarios | Required state fields | Gaps / notes |
|---|---|---|---|---|
| Determinism “no forbidden calls” | `pnpm check:determinism` (`scripts/check_determinism.mjs`) | (indirect; harness determinism rerun) | — | Only static scan; add runtime invariants for timers/step sizes where possible. |
| Determinism rerun equality | Harness determinism rerun (default `basic`) | All scenarios (when they pass) | Stable subset of state | Many scenarios currently fail before completion; need to update scenarios to new onboarding gates. |
| Contracts placement/fill/collect | — | `contracts_basic` (PASS), `contracts_cancel_basic` (FAIL), `contracts_strategy_levers_basic` (FAIL) | `economy.contracts[]` including `filledQty`, `status`, `feePaid`, `portId` | Several contract scenarios are stale vs Dock Intro and must unlock automation first. |
| Unlock ladder / gating | — | `unlock_gates_phase0_basic`, `unlock_ladder_basic` (FAIL) | `unlocks[]`, `quality.ui.tutorialStepId`, next-goal fields | Needs a single authoritative “unlock table” in state for assertions (stable IDs). |
| Minigame loop + anti-spam | — | `minigame_cannon_spam_guard` (FAIL) | `buffs[]`, minigame cooldown/fatigue fields (if any) | Needs gating-aware scenario (unlock first) + explicit anti-spam invariant (cooldown/diminishing returns). |
| Voyage loop + encounters | `scripts/scaling_audit_60min.mjs` (exists; not a gate) | `phase1_cannonballs_encounter`, `voyage_*` (FAIL) | `voyage.*`, encounters list, ship/hold resources | Scenarios need Dock Intro unlock and updated route unlock expectations. |
| Politics perk loop | — | `politics_tax_relief_campaign_basic` (FAIL) | `politics.*`, tax perk fields | Scenario stale vs Dock Intro (must unlock nav first). |
| Save fixtures | `scripts/stress_saves.mjs` (FAIL) | `save_import_legacy_fixture` (PASS) | save payload + core state | Need deterministic fixture snapshots across phases (fresh, post-auto, post-contracts, post-minigame, post-voyage). |

## Current gaps (summary)

1) Most scenarios are **stale** vs the Dock Intro gate (they must perform `work-docks` / buy automation before expecting other nav/actions).
2) No central **engine validation** surface (invariants) is asserted via `quality.validation`.
3) No stable **pacing baseline** test with explicit time budgets and “dead-time” detection.
4) Save fixture generation (`check:saves`) is broken; migrations are under-tested.
5) No dedicated UI↔state parity checks (small set) to prevent drift.

