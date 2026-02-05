# Sea of Gold — Validation Playbook

This repo’s definition of “done” is **automated**: `acceptance.md` must pass via the Playwright harness, with deterministic stepping and stable selectors.

Use this document to add new systems/modules **without creating false greens** (tests pass while the game is wrong).

## Quick commands (local)

Dev server (must use `5180–5189`):
- `pnpm dev` (auto-picks `5180` first, then increments)

Harness (deterministic; writes screenshots/state/console):
```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export IDLE_GAME_CLIENT="$CODEX_HOME/skills/develop-idle-game/scripts/idle_game_playwright_client.js"
node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario smoke
```

Repo checks:
- `pnpm check:determinism` (static scan: no `Date.now()`/`Math.random()` in engine)
- `pnpm check:saves` (regenerates fixtures + asserts roundtrip + invariants)
- `pnpm lint`
- `pnpm build`

## When a harness scenario fails (triage order)

1) Open `console.json` first (treat any error as P0).
2) Inspect `screens/step_*.png` to confirm what was visible/clicked.
3) Inspect `state.failed.json` (or the latest `state.step_*.json`).
4) Check:
   - `quality.validation.ok` and `quality.validation.errors[]` (engine invariants)
   - `quality.debug.tail[]` (last deterministic actions/transitions)
   - `quality.ui.*` and `quality.progression.*` (product-quality guardrails)
5) Re-run headed + slower if needed:
```bash
node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario <name> --headed true --slow-mo 100 --pause-ms 250
```

## Checklist: adding a new module/system

### 1) Engine (source of truth)
- Pure TS: no DOM/timers; deterministic stepping via `advance(state, dtMs)`.
- Stable IDs: do **not** rename content IDs; migrate on import if needed.
- Unlock rule:
  - Add an explicit unlock requirement (and keep it monotonic).
  - Locked state must be representable in `render_game_to_text()` (no “UI magic”).

### 2) UI (render-only + stable selectors)
- UI may **dispatch actions** and **render derived state** only.
- Do not compute resource deltas or offline gains in UI.
- Add `data-testid` for any new primary action (never rename once added).
- Locked modules must not render “full pages of controls”:
  - show a short locked summary + requirement hint
  - avoid inflating `quality.ui.totalActionCount` early-game

### 3) Instrumentation (assertable state)
Update `render_game_to_text()` to include:
- A concise system summary for new features (raw values only).
- Any fields needed for stable assertions (avoid formatted strings).
- Update product-quality guards as needed:
  - `quality.ui.*` counts (from state/config, not DOM)
  - `quality.progression.*` next-goal + passive/manual signals

If you add invariants, include them in `window.__idle.validate()` (engine-derived).

### 4) Deterministic fixtures
- Update `scripts/stress_saves.mjs` to generate a fixture at the new “interesting” state.
- Run `pnpm check:saves` to regenerate `e2e/fixtures/*.json`.
- Add a fixture import scenario asserting a minimal set of critical fields:
  - mode, location, key unlocks, key resources, and `quality.validation.ok === true`

### 5) E2E scenarios (prevent false greens)
For a new feature, add **at least one** scenario that:
- exercises the loop end-to-end deterministically (`advanceTime` + clicks)
- includes an `expect` proving progress occurred (not just navigation)
- asserts `quality.validation.ok === true` at a meaningful checkpoint

Prefer robust assertions:
- use `gt/gte/includes` over fragile exact numbers
- assert *relative progress* (e.g. “filledQty increased”) rather than exact tick counts

### 6) Coverage map
- Update `VALIDATION_COVERAGE.md`:
  - new criteria/system row
  - which scenario/script covers it
  - which state fields are required for assertions
  - remaining gaps (explicit TODOs)

## Common “false green” patterns to guard against

- UI shows a number but state output is stale (or vice-versa):
  - add a small scenario that asserts both, and keep values raw in state.
- Determinism drift from hidden time sources:
  - keep all progression under `window.advanceTime(ms)` in tests.
- “Works once” but fails on rerun:
  - always keep harness determinism rerun enabled; clear ephemeral debug state on reset.

