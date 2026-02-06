# Sea of Gold

Single-player deterministic idle game about building a pirate trade empire.

## Canonical Docs (read in this order)

1. `acceptance.md` — release acceptance and deterministic test contract (definition of done).
2. `STATE_SNAPSHOT.md` — single-file current-state snapshot for new-session bootstrap.
3. `GAME_SYSTEM.md` — current implemented game systems and balancing rules.
4. `FUN_UX_UI_RUBRIC.md` — measurable fun/UX/UI evaluation rubric for autonomous playtests.
5. `DESIGN_SYSTEM.md` — UI/component/tokens system and hybrid UI philosophy.
6. `AUTONOMOUS_EVAL_SYSTEM.md` — autonomous agent playtest/evaluation/decision loop.
7. `AGENTS.md` — repository process constraints for coding agents.

`concept.md` is vision context only. If it conflicts with `acceptance.md` or `GAME_SYSTEM.md`, follow those files.

## Quick Start

```bash
pnpm dev
```

Dev server port policy is `5180` to `5189` (first free port).

## Deterministic Harness

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export IDLE_GAME_CLIENT="$CODEX_HOME/skills/develop-idle-game/scripts/idle_game_playwright_client.js"
node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario smoke
```

Run the full release gate in `acceptance.md` before declaring work complete.

## Autonomous Validation Commands

```bash
pnpm check:autonomy-contract
pnpm check:playability-rubric -- --dir .codex-artifacts/idle-game/<run-dir>
pnpm check:autonomous
```

- `check:autonomy-contract` verifies acceptance scenario coverage and scenario quality.
- `check:playability-rubric` scores playability/fun/UX quality from harness artifacts.
- `check:autonomous` runs the autonomous validation cycle:
  - starts dev server on `5180-5189` if needed
  - runs all Playwright scenarios
  - fails on console errors/warnings/pageerrors in artifacts
  - scores the playability rubric when required artifact scenarios are present
  - runs repo checks (`check:determinism`, `check:saves`, `lint`, `build`).
