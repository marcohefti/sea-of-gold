# Sea of Gold — Validation Coverage Map

This document maps **product quality**, **determinism**, and **system correctness** criteria to automated checks.

Goal: reduce “false greens” where tests pass but the game is still wrong.

See also: `VALIDATION_PLAYBOOK.md` (how to add new systems without breaking gates).

## Legend

- **Engine/script**: deterministic Node scripts (no browser) or repo checks.
- **E2E scenario**: Playwright harness scenario in `e2e/action_payloads.json`.
- **State fields**: paths in `render_game_to_text()` required for stable assertions.
- **Gaps**: missing coverage or known weaknesses.

## Coverage table (minimum criteria A–H)

| Criteria | Engine / scripts | E2E scenarios | Required `render_game_to_text` fields | Gaps / notes |
|---|---|---|---|---|
| A) Progressive disclosure / anti-overwhelm | — | `ui_overwhelm_guard`, `quality_unlock_avalanche_guard` | `quality.ui.*`, `meta.mode` | Guards Dock Intro (action count caps) and post-automation unlock spikes (delta/cap metrics). |
| B) Manual → automation progression | — | `progression_manual_to_auto`, `smoke` | `quality.progression.*`, `resources.gold` | Covered as an explicit regression detector. |
| C) Pacing / dead-time bounds (early) | `scripts/pacing_10min.mjs` (analysis; not a hard gate yet) | `quality_no_dead_time_early`, `fun_phase0_first_5min`, `phase0_loop` | `quality.pacing.*`, `quality.progression.nextGoalId`, core resources/unlocks | `quality_no_dead_time_early` is the hard “no forced waiting” guard; budgeted time-to-automation is still analysis-only (TODO). |
| D) Meaningful choice presence (early) | — | (indirect) `phase0_loop` | `quality.progression.nextGoalId`, unlocks/resources | No explicit “≥2 viable actions” detector derived from state (TODO). |
| E) Active minigame: deterministic reward + downstream impact | — | `minigame_cannon_basic`, `fun_phase3_minigame_loop_3runs`, `minigame_cannon_spam_guard` | `buffs[]`, `minigameLocks.*` | Tier/impact assertions are partial; consider adding a “buff changes voyage math” proof if needed. |
| F) Offline catch-up deterministic + capped | — | `fun_phase4_offline_2h`, `fun_phase4_offline_8h` | `meta.offline.*`, `meta.nowMs`, core resources | Covered at UI/state level; cap is in engine/store logic. |
| G) Save/import/export versioning + migrations | `pnpm check:saves` (`scripts/stress_saves.mjs`) + harness roundtrip | `save_import_*_fixture`, `save_import_legacy_fixture` | `meta.version`, core state (resources/unlocks/location/systems), `quality.validation` | `check:saves` regenerates deterministic fixtures and asserts roundtrip + `__idle.validate().ok`. |
| H) No hidden UI/engine mismatch | — | (none dedicated) | UI parity fields + `quality.validation`, `quality.debug` | No DOM↔state parity scenario yet (TODO). |

## Cross-cutting quality instrumentation

| Signal | Where | How it’s used | Notes |
|---|---|---|---|
| Engine invariants | `window.__idle.validate()` + `quality.validation` | Fixture imports and save stress checks assert `ok === true` | Prevents silent negative timers/resources and similar drift. |
| Debug log tail | `quality.debug` | Included in `state.*.json` artifacts | Deterministic action/transition breadcrumbs for faster triage. |

## System correctness (core loops)

| System | Engine / scripts | E2E scenarios | Required state fields | Gaps / notes |
|---|---|---|---|---|
| Determinism “no forbidden calls” | `pnpm check:determinism` (`scripts/check_determinism.mjs`) | Harness determinism rerun (default) | — | Static scan + scenario rerun. |
| Determinism rerun equality | Harness determinism rerun (default `basic`) | All scenarios | Stable subset of state | Use `--determinism-check full` when diagnosing. |
| Save roundtrip | Harness roundtrip check (default `basic`) | All scenarios | `resources/unlocks/location` subset | `pnpm check:saves` provides deeper per-fixture roundtrip comparisons. |
| Contracts placement/fill/collect | — | `contracts_basic`, `contracts_strategy_levers_basic`, `contracts_cancel_basic` | `economy.contracts[]` | Covered for progress + levers; could add more edge cases (cap/full warehouse). |
| Unlock ladder / gating | — | `unlock_ladder_basic`, `unlock_gates_phase0_basic` | `unlocks[]`, `quality.ui.tutorialStepId` | Works; keep IDs stable. |
| Minigame loop + anti-spam | — | `minigame_cannon_basic`, `minigame_cannon_spam_guard` | `buffs[]`, `minigameLocks.*` | Covered. |
| Voyage loop + encounters | `scripts/scaling_audit_60min.mjs` (analysis) | `voyage_prepare_basic`, `voyage_*`, `phase1_cannonballs_encounter` | `voyage.*`, encounters list, ship/hold resources | Covered at a basic level; deeper balancing remains analysis-only. |
| Politics perk loop | — | `phase2_politics_tax_discount`, `politics_tax_relief_campaign_basic` | `politics.*` incl. perk/campaign | Covered. |
| Deterministic fixtures | `pnpm check:saves` | `save_import_*_fixture` | core fields + `quality.validation` | Fixture set includes: fresh, after automation, after contracts, after minigame, after starter voyage, plus legacy. |

## Known gaps / TODOs (explicit)

1) Add a small DOM↔state parity scenario (gold, contract filledQty, buff remaining) to prevent UI drift.
2) Add a hard pacing gate (budgeted “time-to-automation” and “first meaningful choice” bounds) as an engine/script check.
3) Add a state-derived “meaningful choice present” detector for early game (avoid one-path onboarding).
