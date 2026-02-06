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

Recent Evidence:
- `node scripts/check_autonomy_contract.mjs` -> PASS (2026-02-06)
- `node scripts/run_autonomous_validation.mjs --scenarios smoke --skip-playability-check true --skip-repo-checks true --out-dir .codex-artifacts/idle-game/state_snapshot_refactor_smoke2_20260206` -> PASS
