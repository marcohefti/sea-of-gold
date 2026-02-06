# Sea of Gold — Fun / UX / UI Rubric

This file defines how agents evaluate player experience quality beyond binary correctness.

Normative order:
1. `acceptance.md`
2. `QUALITY_GATES.md`
3. `FUN_UX_UI_RUBRIC.md`

If this rubric conflicts with acceptance assertions, `acceptance.md` wins.

## 1) What "good" means for this game

For Sea of Gold, a high-quality experience means:
- the player always has a clear next goal
- active play creates meaningful acceleration, but idle still works
- logistics and sinks (storage, wages, repairs, taxes) matter and stay legible
- unlocks reveal depth in staged steps, not information avalanches
- UI keeps focus on a small set of relevant actions for the current phase

## 2) Benchmark-derived principles

These principles are distilled from successful idle/incremental games and mapped to Sea of Gold:

1. **Layered phase shifts** (Universal Paperclips)
- Strong incremental games introduce new verbs/systems in phases rather than exposing everything at once.
- Sea of Gold mapping: keep staged unlock ladders and enforce unlock-burst guards.

2. **Persistent progression + offline trust** (Melvor Idle)
- Players value long-term progress and explicit offline progression semantics.
- Sea of Gold mapping: deterministic offline catch-up with transparent caps and stable save replay.

3. **Resource pressure as strategy** (Kittens Game)
- Capacity limits and bottlenecks create interesting decisions and pacing.
- Sea of Gold mapping: warehouse/hold pressure and sink systems must remain visible and testable.

4. **Minimal reveal and strong early clarity** (A Dark Room)
- Early game should be simple and readable; complexity is earned through play.
- Sea of Gold mapping: onboarding overwhelm guard + explicit next-goal guidance.

5. **Math that sustains choices** (Kongregate idle design essays)
- Geometric costs and controlled multipliers preserve decision value over time.
- Sea of Gold mapping: avoid runaway multiplicative stacking; keep sinks near each generator.

## 3) Telemetry contract for agents

Agents should use these `render_game_to_text()` fields:
- `quality.progression.nextGoalId`
- `quality.progression.nextGoalCount`
- `quality.progression.nextGoals[]`
- `quality.progression.availableRouteCount`
- `quality.progression.startableRouteCount`
- `quality.progression.contractOpenCount`
- `quality.progression.contractCollectableCount`
- `quality.progression.storageFillBps`
- `quality.progression.holdFillBps`
- `quality.progression.netPortGoldPerMin`
- `quality.pacing.meaningfulActionCount`
- `quality.pacing.decisionActionCount`
- `quality.pacing.meaningfulActionIds[]`
- `quality.pacing.timeToNextMeaningfulActionMs`
- `quality.ui.visibleModuleCount`
- `quality.ui.visibleInteractiveCount`

## 4) Scoring dimensions (0-100)

Each dimension scores 0-20.

1. Goal Clarity
- 20: `nextGoalId != goal:next` and `nextGoalCount >= 2`
- 10: goal exists but only one short-term next step
- 0: missing/placeholder goals

2. Choice Pressure
- 20: `meaningfulActionCount >= 6` and `decisionActionCount >= 3`
- 10: at least 3 meaningful actions and 1 decision action
- 0: low-action/low-choice state without timers justifying wait

3. Active vs Idle Harmony
- 20: idle income positive after automation and active levers available (minigame/voyage/market)
- 10: idle works but active leverage is weak
- 0: either idle is dead or active play has no advantage

4. Logistics Friction Quality
- 20: storage/hold pressure and sinks are present but understandable
- 10: sinks exist but are mostly invisible in current state
- 0: runaway generation with no visible friction

5. UI Focus
- 20: modules/actions are staged and not overwhelming for current phase
- 10: usable but cluttered
- 0: high action/module overload

Recommended pass threshold: `>= 70`.
Hard fail threshold: `< 55`.

## 5) Evaluation protocol

For each change affecting progression, economy, voyages, politics, or minigames:
1. Run quality-gate scenarios from `acceptance.md`.
2. Run playability scenarios:
- `fun_phase0_first_5min`
- `playability_tour_short`
- `playability_audit_10min`
3. Score the run with `scripts/check_playability_rubric.mjs`.
4. If score is below threshold, fix the top failing dimension before continuing.

## 6) Sources

- Universal Paperclips (official): <https://www.decisionproblem.com/paperclips/>
- Universal Paperclips mechanics summary: <https://universalpaperclips.fandom.com/wiki/Universal_Paperclips_Wiki>
- Melvor Idle (official): <https://store.steampowered.com/app/1267910/Melvor_Idle/>
- Melvor Idle Wiki (offline progression): <https://wiki.melvoridle.com/w/Offline_Progression>
- Kittens Game design principles (official repo): <https://github.com/nuclear-unicorn/kittensgame>
- Kittens Game mechanics wiki: <https://wiki.kittensgame.com/en/general-information/game-mechanics>
- A Dark Room (official): <https://adarkroom.doublespeakgames.com/>
- A Dark Room mechanics summary: <https://adarkroom.fandom.com/wiki/The_Gathering_Tab>
- Idle balancing reference (Kongregate): <https://blog.kongregate.com/the-math-of-idle-games-part-i/>
