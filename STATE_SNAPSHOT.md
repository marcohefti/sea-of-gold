# Sea of Gold — State Snapshot

Purpose:
- Single-file current-state bootstrap for new sessions.
- No chronological logs. No historical prompts. No stale milestone notes.
- Update this file in place when behavior, rules, or workflow expectations change.

Last Updated:
- 2026-02-06

Normative Doc Order:
1. `acceptance.md` (release pass/fail contract)
2. `STATE_SNAPSHOT.md` (current state + operating snapshot)
3. `GAME_SYSTEM.md` (implemented mechanics and balance rules)
4. `FUN_UX_UI_RUBRIC.md` (fun/UX evaluation rubric)
5. `DESIGN_SYSTEM.md` (UI system + design constraints)
6. `AUTONOMOUS_EVAL_SYSTEM.md` (autonomous execution loop)
7. `AGENTS.md` (agent workflow constraints)

Current Release Health:
- Acceptance scope: active and aligned with `e2e/action_payloads.json`.
- Determinism workflow: active (`window.advanceTime(ms)` + deterministic replay).
- Save workflow: versioned export/import with roundtrip gate.
- Validation workflow: Playwright harness + artifact checks + rubric checks.

Current UX/Validation Mode Split:
- Player mode: clean UI (debug-heavy telemetry hidden).
- Debug mode: extra telemetry for automation/diagnosis.
- Debug mode activation:
  - automatic in automation (`navigator.webdriver === true`)
  - manual via URL query: `?debug=1` (also `true`/`on`)

Operational Rules:
- Browser automation must run headless for validation.
- Use port policy `5180..5189` (first free).
- Keep engine deterministic and UI as a pure projection of state/actions.
- Never rename stable selectors/IDs without explicit migration + acceptance updates.

Required Validation Levels:
- Change gate: `smoke` + affected scenarios + all quality gates.
- Completion gate: full `e2e/action_payloads.json` suite + repo checks:
  - `pnpm check:determinism`
  - `pnpm check:saves`
  - `pnpm lint`
  - `pnpm build`

Update Policy (Important):
- Do not use `progress.md` for active decision-making.
- Record autonomous decisions and rationale in this snapshot under concise bullets.
- If gameplay behavior changes, update `GAME_SYSTEM.md` in the same iteration.
- If pass/fail expectations change, update `acceptance.md` first.
- Historical logs are archived at `docs/archive/progress_legacy_20260206.md`.

Decisions (Current):
- Validation defaults to headless browser automation.
- Snapshot-based context replaces long historical progress logs for new-session startup quality.
- `check:autonomy-contract` enforces snapshot + acceptance freshness metadata presence.
- Title screen copy and hierarchy are release-based (not milestone-based), with player-first onboarding and debug-only harness metadata.
- Economy documentation now includes a research-backed contract (faucets/sinks, pacing bands, multiplier controls, offline trust, inflation guards) to keep balancing decisions consistent and testable.
- Economy rebalance now includes banked active-play value (minigame completion gold payouts), destination voyage payout sinks (duty + tax), and post-voyage ship upkeep to improve sink coverage without breaking early pacing.
- Early-game fun tuning now emphasizes short-horizon goals and momentum moments: one-time first trade/voyage bonuses, optional hustle micro-bonus, and less early long-horizon goal clutter.
- Midgame fun tuning now includes: manual voyage-collect parity for the first-voyage bonus, first-arrival local sugar reseed to reduce post-arrival supply deadlocks, stronger rigging leverage, and lower early shipyard step cost to keep 10-minute sessions goal-rich.
- Midgame goal scaffolding now guarantees at least three actionable guidance lines in `tut:port_core` voyage states (tax relief, shipyard progress, local contract continuity) to avoid low-option stalls.

Recent Evidence:
- `node scripts/check_autonomy_contract.mjs` -> PASS (2026-02-06)
- `node scripts/run_autonomous_validation.mjs --scenarios smoke --skip-playability-check true --skip-repo-checks true --out-dir .codex-artifacts/idle-game/state_snapshot_refactor_smoke2_20260206` -> PASS
- `node scripts/run_autonomous_validation.mjs --scenarios smoke,ui_overwhelm_guard --skip-playability-check true --skip-repo-checks true --out-dir .codex-artifacts/idle-game/title_screen_refresh_change_gate_20260206` -> PASS
- `node scripts/run_autonomous_validation.mjs --scenarios smoke,ui_overwhelm_guard,progression_manual_to_auto,quality_no_dead_time_early,quality_unlock_avalanche_guard,contracts_strategy_levers_basic,phase0_loop,minigame_cannon_spam_guard,playability_active_idle_leverage,playability_choice_pressure_midgame --skip-playability-check true --skip-repo-checks true --out-dir .codex-artifacts/idle-game/economy_improve_change_gate_20260206_r2` -> PASS
- `pnpm check:autonomous -- --out-dir .codex-artifacts/idle-game/economy_improve_full_gate_20260206` -> PASS
- `node scripts/run_autonomous_validation.mjs --scenarios smoke,ui_overwhelm_guard,progression_manual_to_auto,quality_no_dead_time_early,quality_unlock_avalanche_guard,minigame_cannon_basic,phase0_loop,fun_phase0_first_5min,playability_tour_short,playability_audit_10min,playability_active_idle_leverage --skip-repo-checks true --out-dir .codex-artifacts/idle-game/early_fun_change_gate_20260206_r1` -> PASS
- `pnpm check:autonomous -- --out-dir .codex-artifacts/idle-game/early_fun_full_gate_20260206` -> PASS
- `node scripts/run_autonomous_validation.mjs --scenarios smoke,ui_overwhelm_guard,progression_manual_to_auto,quality_no_dead_time_early,quality_unlock_avalanche_guard,fun_phase1_first_voyage_loop,phase2_politics_tax_discount,phase2_cosmetics_vanity_signage,playability_audit_10min --skip-repo-checks true --out-dir .codex-artifacts/idle-game/mid_fun_change_gate2_20260206` -> PASS
- `pnpm check:autonomous -- --out-dir .codex-artifacts/idle-game/mid_fun_full_gate_r2_20260206` -> PASS
