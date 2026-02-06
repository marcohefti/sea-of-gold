# Sea of Gold — Autonomous Evaluation System

This document defines how an agent operates autonomously: playtesting, evaluation, decision-making, and change validation.

## 1) Required Inputs

Before making decisions, agents must load:
1. `acceptance.md`
2. `STATE_SNAPSHOT.md`
3. `GAME_SYSTEM.md`
4. `FUN_UX_UI_RUBRIC.md`
5. `DESIGN_SYSTEM.md`
6. `e2e/action_payloads.json`
7. `AGENTS.md`

If files disagree:
- `acceptance.md` wins for pass/fail.
- `GAME_SYSTEM.md` wins for current gameplay behavior.
- `concept.md` is non-binding vision context.

## 2) Decision Hierarchy

When spec is silent, decide using this order:
1. Keep `acceptance.md` passing.
2. Preserve deterministic simulation and save roundtrip safety.
3. Preserve quality gates (anti-overwhelm, manual->automation, no dead time, unlock avalanche).
4. Preserve progression clarity (always expose a next meaningful goal).
5. Choose smallest shippable implementation over speculative scope.

## 3) Autonomous Work Loop (Mandatory)

1. Pick one concrete change.
2. Implement smallest vertical slice.
3. Update `STATE_SNAPSHOT.md` with:
   - what changed
   - decisions + rationale
   - current evidence path references (no chronological log dump)
4. Run harness immediately and inspect artifacts.
5. Fix first failing expectation or first new console/page error before continuing.
6. Repeat.

## 4) Dev Server And Harness Execution

Dev server policy:
- Start at `5180`, then `5181` ... `5189`.
- If all are occupied, fail with a clear error.
- Keep one selected port for the validation cycle.

Command setup:
```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export IDLE_GAME_CLIENT="$CODEX_HOME/skills/develop-idle-game/scripts/idle_game_playwright_client.js"
```

Single scenario:
```bash
node "$IDLE_GAME_CLIENT" --url http://localhost:5180 --actions-file ./e2e/action_payloads.json --scenario smoke
```

One-command autonomous cycle:
```bash
pnpm check:autonomous
```

Playability rubric score:
```bash
pnpm check:playability-rubric -- --dir .codex-artifacts/idle-game/<run-dir>
```

Contract/lint gate for autonomous inputs:
```bash
pnpm check:autonomy-contract
```

## 5) Validation Tiers

### Tier A — Change Gate (always run)

- `smoke`
- affected subsystem scenarios
- all quality gates:
  - `ui_overwhelm_guard`
  - `progression_manual_to_auto`
  - `quality_no_dead_time_early`
  - `quality_unlock_avalanche_guard`

### Tier B — Release Gate (before declaring done)

- All scenarios in `e2e/action_payloads.json`
- Determinism rerun enabled
- Save roundtrip enabled
- No console errors/warnings/pageerrors in artifacts
- Playability rubric score passes (`check:playability-rubric`)

### Tier C — Repo Gate (before declaring done)

- `pnpm check:determinism`
- `pnpm check:saves`
- `pnpm lint`
- `pnpm build`

## 6) Artifact Triage Order

When a scenario fails:
1. `console.json` and page errors first.
2. failing `state.*.json` (or latest step state).
3. `quality.validation`, `quality.debug.tail`.
4. screenshot at failing step.
5. action payload step index.

Fix order:
1. runtime/console errors
2. determinism drift
3. acceptance assertion mismatch
4. quality gate regressions
5. balancing/pacing refinements

## 7) Autonomous Evaluation Rubric

An agent should explicitly evaluate:

Correctness:
- expected scenario outcomes hold
- no hidden state corruption (`quality.validation.ok`)

Determinism:
- same seed + same inputs => same output
- no forbidden randomness/time calls in engine

Progression quality:
- no early overwhelm
- no forced dead time in intro
- manual to automation beat remains intact
- unlocks are staged, not avalanche bursts

System integrity:
- voyage and logistics loops remain supply-bound
- sinks exist for each new generator
- next goal remains visible (`quality.progression.nextGoalId` / goals UI)

## 8) Economy Audit Addendum (Required For Economy-Touching Changes)

When a change affects economy/progression systems, also run this audit:

1. Faucet/sink map
- List new/changed faucets and verify a matching sink/cap pressure exists.

2. Net-flow pressure check
- Verify the change does not create a single dominant no-cost generator lane.

3. Active vs idle leverage check
- Confirm active play improves outcomes but idle remains viable for baseline progress.

4. Capacity pressure check
- Verify warehouse/hold caps create clear decisions, not silent loss behavior.

5. Re-entry and pacing check
- Verify short and medium horizon goals remain visible after the change.

6. Inflation drift check
- If value velocity increases materially, add sink/cap pressure before adding more generation.

## 9) Allowed Autonomous Changes

Agents may decide and implement without asking if:
- acceptance remains passable
- core identity is preserved
- changes are reversible and migration-safe

Agents must ask only for:
- game identity pivot (theme/core pillar removal)
- architecture shift away from deterministic engine + Playwright harness
- monetization/real-money economy decisions

## 10) Completion Output Standard

A complete autonomous run must include:
- code/doc changes made
- decisions with rationale in `STATE_SNAPSHOT.md`
- exact scenarios/checks executed
- pass/fail status and notable evidence paths
- remaining known gaps (if any)
