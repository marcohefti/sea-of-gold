# Sea of Gold — Current Game System

This document describes the currently implemented game system.

Normative order:
1. `acceptance.md` (testable done criteria)
2. `GAME_SYSTEM.md` (implemented gameplay/system behavior)
3. `concept.md` (vision context)

## 1) Product Identity

Sea of Gold is a deterministic single-player idle game where port actions feed voyages, voyages feed influence, and influence unlocks higher-tier systems.

Core pillars:
- Voyages are the value router.
- Logistics (warehouse + hold caps) is gameplay, not decoration.
- Unlocks are staged to avoid overwhelm.
- Idle progress exists, active play accelerates.
- The simulation is deterministic and automation-testable.

## 2) Deterministic Rules

- Engine is pure TypeScript (`packages/engine`), no DOM/timers.
- Simulation steps only through `advance(state, dtMs)` fixed ticks.
- No `Math.random()`/`Date.now()` in engine progression logic.
- RNG is seeded and persisted in saves.
- Contract filling, production, voyage encounters, minigame outcomes, and unlock progression are deterministic under equal seed + action stream.

## 3) Modes And Tutorial Staging

Primary modes:
- `title`
- `port`
- derived view states include `voyage` and `minigame` for UI.

Tutorial progression:
- `tut:dock_intro` -> only Dock Intro actions.
- `tut:economy_intro` -> Economy entry is revealed.
- `tut:port_core` -> broader module stack is revealed.

## 4) Core Loop (Implemented)

1. Manual dock work to earn first gold.
2. Buy dock automation for passive income.
3. Place contracts for raw goods.
4. Distill Rum and move supplies into ship hold.
5. Run voyages for gold + influence.
6. Use minigames for temporary voyage buffs.
7. Build politics standing, port perks, and conquest progress.
8. Expand into fleet, shipyard, vanity, flagship sinks.

## 5) System Mechanics

### Dock And Early Economy

- Manual dock shift:
  - duration: `5000ms`
  - immediate reward on click: `+1 gold`
  - completion reward: `+4 gold`
  - while running, click Hustle reduces remaining time by `500ms`.
  - first hustle click in a fresh shift grants `+1 gold` (active micro-optimization).
- Dock automation:
  - cost: `30 gold`
  - enables passive income: `1 gold/sec`.

### Contracts

- Scope: per-port market contracts.
- Max active contracts per port: `4`.
- Fill source: island deterministic supply rates (units/min) from `islands.json`.
- Fill allocation order: higher `bidPrice` first, tie-break by contract ID.
- Fee model (deterministic):
  - base fee = `qty` + bid premium
  - bid premium = `floor(qty * max(0, bid-1) / 10)`
  - tier multiplier = `+500 bps` per tier above 1
  - port tax applies after tier adjustment
  - all multipliers use integer-safe ceil division.
- Collection:
  - goods transfer into current port warehouse (capped by free space)
  - no silent loss; uncollected quantity remains on contract.
  - first contract collection grants a one-time `+8 gold` early momentum bonus.
- Influence from trade:
  - collecting contracts grants `+1 influence per 20 units` (floored) with current controller.

### Storage / Logistics

- Warehouse exists per island.
- Starting warehouse cap per island: `50`.
- Upgrade cost: `100 gold`; cap gain: `+50` at current port.
- Active ship hold cap from class (`sloop=30`, `brig=60`, `galleon=120`).
- Transfers (`LOAD_TO_HOLD`, `UNLOAD_FROM_HOLD`) are capped by free capacity; no item loss.

### Production

Recipes are data-driven (`recipes.json`), deterministic, and warehouse-cap aware:
- `distill_rum`: sugar -> rum (2s)
- `forge_cannonballs`: iron + wood -> cannonballs (5s)
- `craft_parts`: iron + wood -> parts (7s)
- `assemble_repair_kits`: parts + hemp -> repair kits (9s)
- `brew_dye`: herbs -> dye (4s)
- `weave_cloth`: hemp -> cloth (4s)
- `tailor_cosmetics`: dye + cloth -> cosmetics (6s)

### Voyages

- Start requirements use hold supplies only:
  - fare rum + baseline rum burn (class rum/min, adjusted by rigging buff).
- Encounters:
  - generated deterministically from `seed + routeId + voyageIndex`
  - starter routes are peaceful
  - other routes roll deterministic encounter times and cannonball costs.
- Encounter resolution:
  - if cannonballs available: success, consume cost
  - else: fail, apply condition damage and voyage reward penalty.
- Voyage completion yields pending gold + influence, collected via `VOYAGE_COLLECT`.
- First voyage collection grants a one-time `+12 gold` momentum bonus (manual and automation collections both apply it).
- First arrival at a newly unlocked departure port grants a one-time local reseed package (`+6 sugar`, capacity-capped) to reduce post-arrival deadlock.
- Voyage payout sink model:
  - destination port duty: `2 gold * destination island tier`
  - destination tax applies to voyage payout after duty (using current effective tax).

### Ship Condition And Repair

- Voyage wear: `4 condition/min` while running.
- Repair preference:
  - consume `1 repair kit` for `+50 condition`
  - fallback: `50 gold` for `+20 condition`.

### Crew

- Hire cost: `25 gold` per crew.
- Wage drain: `1 gold/min` per crew (active ship + fleet ships).
- Ship upkeep drain: `1 gold/min` per ship after voyages are unlocked.
- XP gain:
  - sailing XP from voyage duration
  - gunnery XP from encounters and cannon minigame hits.

### Minigames (Optional Accelerators)

Cannon Volley:
- duration: `20s`
- deterministic timing zone
- grants `cannon_volley` buff:
  - base: +10% voyage gold for 5m
  - >=6 hits: +20% and +60s
  - >=12 hits: +35% and +180s
- completion payout: `2 gold + floor(hits / 6)` (banked immediate value).
- replay blocked if existing buff remaining >= 60s.

Rigging Run:
- duration: `30s`
- deterministic moving window + seeded zone start
- grants `rigging_run` buff:
  - baseline rum burn reduction: `30%`
  - voyage speed bonus: `15%`
  - base 5m duration with tiered duration extensions
- completion payout: `3 gold + floor(goodTugs / 5)` (banked immediate value).
- replay blocked if existing buff remaining >= 60s.

### Shipyard, Fleet, Flagship

- Ship classes:
  - Sloop (starter), Brig, Galleon.
- Shipyard:
  - level starts at 1, max 4
  - upgrade cost = `250 gold * nextLevel`
  - each level increases fleet cap by 1 (up to 5 total ships).
- Fleet automation:
  - per-ship route selection + auto-start + optional auto-collect.
  - auto ships pre-load missing rum/cannonballs from their local warehouse before launch (capacity-capped).
- Flagship project:
  - 3 contributions required
  - each contribution costs `200 gold + 5 cosmetics`
  - completion unlocks permanent `+20% voyage gold`.
  - completion grants a one-time launch bonus: `+120 gold` and `+5` influence with your affiliated flag (if selected).

### Politics And Conquest

Affiliation and influence:
- player chooses affiliated flag.
- donations convert `10 gold -> +1 influence` (floored).
- voyages/contracts also grant influence.

Tax Relief campaign (current port):
- requires `5` influence with current controller
- cost: `50 gold * island tier`
- campaign duration: `60s`
- success grants port perk: `-200 bps tax` for `10m`.

Conquest campaign:
- requires attacker influence `20 * island tier`
- war chest cost `200 gold * island tier`
- duration `3 * 60s` stages
- on success, port controller flips to attacker flag.
- conquest victory spoils: `+60 gold * island tier` and `+4 influence * island tier` to attacker.

### Vanity (Cosmetic Sinks With Utility)

Unlock condition:
- cosmetics chain and vanity shop unlock at `>=10 influence` with affiliated flag.

Items:
- `vanity:warehouse_signage` -> `+20 warehouse cap` at every port
- `vanity:ship_figurehead` -> `+10 max condition` (+heal)
- `vanity:captain_banner` -> permanent `+5% voyage gold`.

## 6) Current World And Content

Islands:
- `home_port` (tier 1, produces wood/sugar)
- `turtle_cay` (tier 1, produces sugar/hemp/herbs)
- `ironhaven` (tier 2, produces iron/stone)

Routes include:
- `starter_run`, `turtle_to_home`, `cay_to_haven`, `haven_to_cay`, `home_to_haven`, `haven_to_home`, `merchant_run`.

Chart-locked route:
- `merchant_run` via `chart:merchant_run`.

## 7) Unlock Ladder (Current)

- Start game -> `port`
- Buy dock automation -> `economy`
- Place first contract -> `minigame:cannon`, `recipe:distill_rum`
- Reach early gold threshold -> `crew`
- Produce/load any rum -> `voyage` + `route:starter_run`
- Complete first expansion beats -> broader route unlocks + rigging/cannonball crafting
- Reach politics trigger (first expansion or higher gold) -> `politics`
- Reach affiliation influence threshold -> cosmetics chain + vanity shop

## 8) How To Play (Reference Path)

Early game (0-15m):
1. Work docks until 30g.
2. Buy automation.
3. Place sugar/wood contracts.
4. Produce rum, load hold.
5. Run and collect Starter Run.
6. Use Cannon Volley before high-value voyages.

Mid game:
1. Build cannonball and repair-kit loops.
2. Manage crew wages vs passive/route income.
3. Unlock additional routes/charts.
4. Use rigging buffs for rum-efficient shipping.
5. Grow influence and reduce taxes with campaigns.

Late game:
1. Upgrade shipyard and expand fleet.
2. Configure automation per ship.
3. Pursue conquest loops.
4. Complete vanity and flagship sinks.

## 9) Agent Constraints

- Never rename stable IDs/selectors without migration and acceptance updates.
- All balancing or design changes must preserve deterministic replay and save compatibility.
- Any autonomous design decision must be logged in `STATE_SNAPSHOT.md` with rationale.

## 10) Economy Design Contract (Research-Backed)

This section is a balancing contract for future economy/content changes. It does not override acceptance criteria; it defines how new economy features should be shaped.

### Economy Graph Rules

- Model every economy addition as a combination of:
  - faucet (resource source)
  - transformer (recipe or conversion)
  - router (voyages/contracts deciding destination/value)
  - buffer (warehouse/hold capacity)
  - sink (upkeep, fees, upgrades, campaigns, vanity, repairs)
- Every new faucet should ship with at least one visible sink or capacity pressure in the same phase.
- Prefer strategic sinks (tradeoffs and routing decisions) over pure deletion sinks.

### Pacing Bands (Target)

- Early game: `10-60s` to meaningful upgrade/unlock.
- Mid game: `2-10m` between meaningful economy beats.
- Late game: `30-120m` for long projects (fleet/flagship/conquest-scale goals).
- Keep at least two visible next-goal options when possible to avoid single-path stalls.

### Scaling And Multiplier Guardrails

- Use geometric scaling for major costs.
- Keep multiplier stacking controlled:
  - avoid adding more than two multiplicative boosts in the same value lane
  - prefer additive bonuses when layering systems in the same phase
- When adding a permanent multiplier, add or strengthen at least one sink/cap in that phase.

### Inflation And Sink Coverage Guardrails

- Treat economy health as `gross production - sink pressure`.
- Midgame target: sustain visible sink pressure (wages, tax, repairs, upgrades, campaigns, logistics limits) so growth remains decision-driven.
- If net value growth outruns target pacing bands, add sink/cap pressure before adding new generators.

### Active Versus Idle Harmony

- Idle must remain viable for core progression.
- Active play should accelerate outcomes without invalidating idle:
  - target burst leverage roughly `1.5x-3x` equivalent idle interval value
  - reward active play via banked or time-boxed effects
- Avoid buff designs that are silently wasted because of full storage/hold state.

### Offline And Save Trust

- Offline progress must be deterministic from explicit time delta and deterministic state.
- Offline payout messaging should expose gains and bottlenecks (caps/blocked transfers) clearly.
- Save payload should always preserve simulation time and RNG continuation state.

### Prestige/Reset Policy (When Introduced)

- Resets should unlock new decisions/automation layers, not just larger numbers.
- First reset target window should be in the long-session band (roughly `30-90m`), not the tutorial window.
- Reset rewards must preserve deterministic replay and save migration safety.

### Research Anchors

- Kongregate idle math balancing:
  - <https://blog.kongregate.com/the-math-of-idle-games-part-i/>
  - <https://blog.kongregate.com/the-math-of-idle-games-part-ii/>
  - <https://blog.kongregate.com/the-math-of-idle-games-part-iii/>
- Value-chain and sink framing:
  - <https://lostgarden.home.blog/2021/12/12/value-chains/>
- Virtual economy inflation/hoarding risks:
  - <https://econpapers.repec.org/RePEc:wsi:igtrxx:v:05:y:2006:i:03:n:s0219198906000987>
- Idle game player behavior taxonomy:
  - <https://dl.acm.org/doi/10.1145/3311350.3347183>
