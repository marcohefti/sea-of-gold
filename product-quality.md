# Sea of Gold — Product Quality Notes

This document is explanatory context.

Canonical quality pass/fail criteria are defined in:
- `acceptance.md` (authoritative)
- `QUALITY_GATES.md` (gate definitions and thresholds)

Use this file only for implementation notes and rationale.

## Quality Objectives

1. Intro is not overwhelming.
2. Manual -> automation progression remains clear.
3. Early game has no dead time.
4. Unlocks are staged and avoid avalanche spikes.

## Implementation Guidance

- Keep unlock logic in engine state, not UI-only checks.
- Keep quality metrics derived from deterministic state.
- Add scenario assertions for every new early-game surface.

If any guidance here conflicts with acceptance scenarios, follow `acceptance.md`.
