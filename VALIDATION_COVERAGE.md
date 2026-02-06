# Sea of Gold — Validation Coverage

Coverage map from gameplay/system criteria to automated checks.

Canonical acceptance list lives in `acceptance.md`.

## Criteria Coverage

| Criteria | Primary scenarios | Required state signals |
|---|---|---|
| Start-state clarity / anti-overwhelm | `ui_overwhelm_guard`, `quality_unlock_avalanche_guard` | `quality.ui.*` |
| Manual -> automation onboarding | `progression_manual_to_auto`, `quality_no_dead_time_early` | `quality.progression.*`, `quality.pacing.*`, `resources.gold` |
| Contract economy correctness | `contracts_basic`, `contracts_strategy_levers_basic`, `contracts_cancel_basic` | `economy.contracts[]`, `economy.contractSlots` |
| Voyage prep and routing | `voyage_prepare_basic`, `voyage_chart_unlock_basic`, `phase0_loop` | `voyage.*`, `hold.*`, `unlocks[]` |
| Encounter resolution | `voyage_encounters_visible_basic`, `phase1_cannonballs_encounter` | `voyage.encounters[]`, `ship.condition`, `hold.cannonballs` |
| Cannon minigame loop | `minigame_cannon_basic`, `minigame_cannon_spam_guard` | `minigames.cannon`, `buffs[]`, `minigameLocks` |
| Rigging minigame loop | `phase2_rigging_run_efficiency`, `fun_phase3_minigame_loop_3runs` | `minigames.rigging`, `buffs[]` |
| Politics + tax perks | `phase2_politics_tax_discount`, `politics_tax_relief_campaign_basic` | `politics.*`, `economy.contracts[].feePaid` |
| Influence via trade | `politics_influence_from_contracts_basic` | `politics.influenceByFlagId` |
| Cosmetics/vanity sinks | `phase2_cosmetics_vanity_signage` | `unlocks[]`, `storage.warehouseCap`, `resources.cosmetics` |
| Fleet + shipyard progression | `phase3_shipyard_upgrade_basic`, `phase3_fleet_automation_basic` | `shipyard.level`, `fleet.*` |
| Conquest loop | `phase3_conquest_basic` | `conquest.*`, `world.controllerByIslandId` |
| Flagship sink/permanent bonus | `phase3_flagship_basic` | `flagship.*`, `unlocks[]` |
| Offline deterministic catch-up | `fun_phase4_offline_2h`, `fun_phase4_offline_8h` | `meta.offline`, `meta.nowMs`, resources |
| Save/import + migrations | `save_import_*`, `save_import_legacy_fixture`, `pnpm check:saves` | `meta.version`, key systems, `quality.validation` |
| Playability choice pressure | `playability_choice_pressure_midgame`, `playability_active_idle_leverage` | `quality.pacing.meaningfulAction*`, `quality.progression.nextGoal*`, `buffs[]` |
| Fun/UX rubric pass | `fun_phase0_first_5min`, `playability_tour_short`, `playability_audit_10min`, `pnpm check:playability-rubric` | `quality.ui`, `quality.progression`, `quality.pacing` |
| Determinism enforcement | harness rerun + `pnpm check:determinism` | deterministic subset equality |

## Quality Instrumentation Required

- `quality.ui`
- `quality.progression`
- `quality.pacing`
- `quality.validation`
- `quality.debug`

## Known Gaps

1. No dedicated DOM-vs-state parity scenario yet (state is authoritative, DOM parity is indirect).
2. Unlock-ID burst is warning-level today; can be promoted to a hard gate if regressions recur.
