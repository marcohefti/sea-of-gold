# Sea of Gold — Validation Playbook

Operational guide for validating code changes.

Primary references:
- `acceptance.md`
- `STATE_SNAPSHOT.md`
- `AUTONOMOUS_EVAL_SYSTEM.md`

## 1) Local Commands

Start dev server (`5180` to `5189` auto policy):
```bash
pnpm dev
```

Harness setup:
```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export IDLE_GAME_CLIENT="$CODEX_HOME/skills/develop-idle-game/scripts/idle_game_playwright_client.js"
```

Run one scenario:
```bash
node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario smoke
```

Repo checks:
- `pnpm check:determinism`
- `pnpm check:saves`
- `pnpm lint`
- `pnpm build`
- `pnpm check:playability-rubric -- --dir .codex-artifacts/idle-game/<run-dir>`

## 2) Required Validation Levels

After each meaningful change:
- `smoke`
- affected subsystem scenarios
- all quality-gate scenarios

Before done:
- full scenario sweep (`e2e/action_payloads.json`)
- repo checks listed above
- playability scenarios and rubric score:
  - `fun_phase0_first_5min`
  - `playability_tour_short`
  - `playability_audit_10min`
  - `playability_choice_pressure_midgame`
  - `playability_active_idle_leverage`

## 3) Triage Order On Failure

1. `console.json` (errors/pageerrors first)
2. failing `state.*.json`
3. `quality.validation` + `quality.debug.tail`
4. screenshot at fail step
5. update/fix the first failing assertion cause

## 4) Adding New Systems Safely

When adding new gameplay:
1. Add deterministic engine behavior first.
2. Add stable `data-testid` selectors for primary actions.
3. Expose needed raw state fields in `render_game_to_text()`.
4. Add at least one scenario with progress assertions.
5. Re-run quality gates to ensure no onboarding regressions.

## 5) Anti False-Green Rules

- Never rely on formatted UI values for assertions.
- Never rely on wall-clock progression in automation tests.
- Keep determinism rerun enabled except during temporary diagnosis.
- Treat warning-level invariant drift as a pre-regression signal.
