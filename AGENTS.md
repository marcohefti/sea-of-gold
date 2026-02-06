# Sea of Gold — Agent Instructions

Read docs in this order:
1) `acceptance.md`
2) `GAME_SYSTEM.md`
3) `FUN_UX_UI_RUBRIC.md`
4) `DESIGN_SYSTEM.md`
5) `AUTONOMOUS_EVAL_SYSTEM.md`
6) `concept.md` (vision context only)

If docs conflict, follow that order.

## Development Loop (mandatory)

- Use the `develop-idle-game` skill workflow (deterministic simulation + Playwright harness).
- Create/update `progress.md` (keep `Original prompt:` at the top).
- After each meaningful change: run the Playwright harness, inspect artifacts, and fix the first failing expectation or new console error before continuing.
- Before declaring anything “done”: ensure all `acceptance.md` scenarios pass, including the product-quality gates in `QUALITY_GATES.md` (`ui_overwhelm_guard`, `progression_manual_to_auto`, `quality_no_dead_time_early`, `quality_unlock_avalanche_guard`).

## Dev Server Port Policy (mandatory)

- The dev server must start at port `5180`.
- If `5180` is occupied, try `5181`, then `5182`, … up to `5189`.
- If none of `5180–5189` are available, fail with a clear error.
- Use the selected port consistently for Playwright harness runs (`--url http://localhost:<port>`), and record it in `progress.md` when it changes.

## Architecture Non‑Negotiables

- Engine/UI separation:
  - Keep the simulation core pure TypeScript (no DOM, no timers, no React).
  - UI only dispatches actions and renders derived state; UI must not compute resource deltas.
- Deterministic simulation:
  - No `Math.random()` / `Date.now()` inside the simulation core.
  - RNG + clock are injected.
  - Tests advance via `window.advanceTime(ms)` only.
- Stable IDs:
  - Content IDs (resources, upgrades, ships, islands, modules) never change once introduced.
  - If renaming is needed, keep an alias and migrate on `importSave()`.
- Text state is for assertions:
  - `window.render_game_to_text()` returns concise JSON with raw values (no formatted strings like `1.2K` for currencies).
- Stable selectors:
  - Once a `data-testid` is added, do not rename it (update acceptance only if truly necessary).

## Save / Offline Semantics

- Save is versioned and deterministic:
  - Export/import roundtrip must pass (harness enforces subset equality).
  - Store simulation time (`nowMs`) and RNG state (or seed + cursor) in the save payload.
- No implicit wall-clock catch-up in tests:
  - Offline progress (if implemented) is a deterministic calculation from an explicit delta, not `Date.now()` inside the engine.

## Autonomous Decision Policy (when the spec is silent)

Default stance: **decide, implement, test, and document**. Only ask the user when a decision is irreversible *and* materially changes the game’s identity.

### Decision priorities (highest wins)

1) `acceptance.md` must pass (tests > ideas).
2) Determinism + testability (engine purity, seeded RNG, stable selectors, raw state for assertions).
3) “Stickiness” pillars from `GAME_SYSTEM.md`:
   - Voyages are the hub
   - Logistics/storage is gameplay
   - Clear unlock ladder
   - Idle works; active accelerates (bank value; no wasted buffs)
4) Simplicity first: implement the smallest shippable slice; avoid feature creep.
5) Extensibility: prefer data-driven catalogs with stable IDs + schema validation.

### Inspiration + research policy (how to fill gaps)

- Use Puzzle Pirates as **structural inspiration** (economy, voyages, politics), not as content to copy.
- If a mechanic is unclear or you need more “design levers”, do a quick lookup on the Puzzle Pirates wiki and distill it into a **simplified single-player** rule. Do not copy text; keep names generic.
- For minigames, prefer patterns proven in hyper-casual / arcade loops (timing windows, endless runner micro, tension bar, push-your-luck). They must fit the pirate ecosystem and remain optional.
- Prefer Playwright (not Puppeteer). If you introduce any new verification tooling, it must integrate with the existing harness contract.

### When adding or changing game design (un-specified details)

Use these heuristics (inspired by Puzzle Pirates + Melvor patterns, without copying content):

- **Progression**: always add a next goal (unlock, capacity upgrade, new route, ship tier, QoL automation). If there isn’t one, create it.
- **Friction/sinks**: every new generator should introduce or strengthen at least one sink (fees, taxes, storage limits, upkeep, repair costs) to prevent runaway.
- **Capacity pressure**: default to adding/using warehouse + ship hold caps early. If choosing overflow behavior, prefer an explicit overflow queue over silent loss.
- **Voyages as router**: when in doubt, route value through voyages (they should consume supplies and be the main reason to craft/refine/contract).
- **Politics**: when unclear, translate multiplayer politics into single-player timers + deposits + staged rounds; make rewards tangible (tax perks, new commodities/routes).

### Minigame decisions (active play)

- Pick minigames that are **easy to learn, one primary input pattern**, and fit the pirate ecosystem.
- Duration target: 15–60s. Never mandatory.
- Rewards should be **banked** (charges) or clearly time-boxed; define stacking rules explicitly.
- Scoring and outcomes must be deterministic with the same seed + inputs.

### Content decisions (resources, ships, upgrades, encounters)

- Prefer data-driven catalogs (JSON + schema validation). IDs are forever.
- Use generic names unless a name is purely thematic and doesn’t affect saves/tests.
- If something is missing, add the smallest new resource/upgrade that completes the loop (e.g., add “repair parts” as a sink if hull repair is needed).

### Balancing decisions (numbers)

- Default pacing targets:
  - early: 10–60s to a meaningful upgrade/unlock
  - mid: 2–10m
  - late: 30–120m
- Prefer geometric scaling; avoid stacking multiple multiplicative lanes.
- Keep tests asserting **relative** progress (>, >=, includes) rather than fragile exact values.

### When to ask the user (rare)

Ask only if needed for:
- Renaming the game, core theme pivot, or removing a core pillar (voyages/storage/politics/minigames).
- Switching stack/architecture away from deterministic + Playwright workflow.
- Monetization / real-money economy (not assumed).

### Documentation requirement

Whenever you make an autonomous choice:
- Record it in `progress.md` under a “Decisions” note with 1–2 lines of rationale.
- If it affects tests or selectors, update `acceptance.md` first, then implement, then rerun the harness.
- If it changes gameplay behavior, update `GAME_SYSTEM.md` in the same iteration.
