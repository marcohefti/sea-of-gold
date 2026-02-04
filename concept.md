# Sea of Gold — Game Concept (Implementable Spec)

Single-player, web-based idle/incremental game.
Theme: pirate captain + crew, ships, islands, voyages, and faction politics (Puzzle-Pirates-inspired *structure*, not puzzle gameplay).

Primary currency: **Gold**.

## Design pillars (what makes it “stick”)

1) **Voyages are the hub**: everything you do in port is in service of the next voyage (supplies, contracts, crew, politics).
2) **Logistics is gameplay**: storage + ship hold capacity create tension and decisions.
3) **Clear unlock ladder**: there is always an obvious next module/upgrade/system.
4) **Idle works, active accelerates**: minigames are optional and bank value (no wasted buffs).
5) **Deterministic & testable**: every system steps via sim time and can be asserted via Playwright.

## Game modes

- `title`: start/import/reset
- `port`: main hub UI (modules/panels)
- Optional later: `voyage` as its own view (can start as a panel within `port`)

## Core loops

### Idle loop (always running)
1) Earn baseline gold in port (dock jobs / crew wages vs income)
2) Place market contracts to acquire raw commodities over time
3) Convert commodities + labor into refined goods (rum, cannonballs, parts)
4) Run voyages between islands for larger gold + influence gains
5) Spend gold/goods/influence to unlock upgrades, ships, routes, and politics

### Active loop (optional acceleration, 15–60s)
Minigames grant **banked charges** (player-triggered) or **time-boxed buffs** with clear stacking rules.
They should never hard-block progress; baseline idle progress is always viable.

## Progression ladder (explicit)

### Phase 0 (0–15 minutes)
Unlocked:
- Home port + dock income
- Market contracts for `wood` + `sugar`
- Distillery: `sugar -> rum`
- Minigame: Cannon Volley (yields a buff)
Goal:
- First small ship class (starter / sloop-class equivalent) and first short voyage route

### Phase 1 (15 minutes – 4 hours)
Unlocked:
- Voyages between 3 starter islands
- Rum consumption + ship condition (repairs as a sink)
- `iron + wood -> cannonballs`
- Crew hiring + basic skill XP

### Phase 2 (day 1–3)
Unlocked:
- Warehousing (capacity pressure) + larger ships
- Second minigame (rigging run or fishing)
- Dye/cloth chain (cosmetics as sink)
- Flag affiliation + influence meter

### Phase 3 (week 1+)
Unlocked:
- Fleet management (2–5 ships)
- Route automation presets + “captain’s ledger” QoL upgrades
- Politics map + conquest campaigns (blockade-inspired)
- Endgame sinks (flagship construction, shipyard upgrades, island taxes)

## World model

### Islands (ports)
Each island has:
- `id`, `name`
- `tier` (affects prices, contract volume, voyage payouts)
- `produces`: raw commodities with base supply rates
- `controllerFlagId` (NPC faction)

### Storage (first-class constraint)
Two capacities:
- **Warehouse capacity** (global storage at the current port)
- **Ship hold capacity** (per ship, used for voyages / deliveries)

Overflow rule (pick one and keep consistent):
- A) overflow queue (time-limited, collect later), or
- B) overflow loss (hard sink; clearly messaged)

Storage upgrades are major early goals and gold sinks (Melvor-like pressure).

## Economy (Puzzle-Pirates-inspired contracts, simplified)

### Contracts (“bid tickets”)
Contract fields:
- `commodityId`, `qty`, `bidPrice`
- `feePaid` (non-refundable sink)
- `filledQty`, `status` (`open|filled|collected|canceled`)

Deterministic fill model:
- Each port+commodity has a `spawnRate` (units/min).
- Spawn is allocated to contracts by bid priority (higher `bidPrice` fills faster).
- Partial fills are normal; collection can be partial or only when filled (design choice).

Friction levers (use at least 1 early):
- placement fee is lost on cancel
- fill rate depends on bid competitiveness (cheap bids fill slower)
- taxes/fees vary by island tier/controller

## Commodities & production

Raw (start): wood, iron, stone, hemp, sugar cane.  
Later: herbs (dyes), minerals/gems, fruit/spices.

Refined (early/mid):
- rum (voyage fuel)
- cannonballs (combat supply)
- parts/repair kits (maintenance sink)
- dyes + cloth → cosmetics (optional sink)

## Ships (tradeoffs matter)

Ship classes should differ meaningfully by:
- crew cap
- hold cap
- voyage speed
- combat rating
- operating cost (rum baseline)

The ladder should create real choices (small/fast vs big/slow vs war-capable).

## Voyages (the content router)

A voyage is a timed activity between islands:
- consumes rum baseline per time
- may consume cannonballs on combat encounters
- yields gold + loot + influence

Determinism:
- Encounters are generated from seeded RNG using stable keys (seed + routeId + voyageIndex).

Routes:
- Start with 2–3 known islands.
- Unlock new routes via charts (gold purchase or rare voyage reward).

## Politics (single-player translation)

Goal: make “influence” matter before conquest exists.

- NPC flags can be neutral/allied/hostile.
- Player gains influence via trade runs, patrol/raid voyages, donations, and service contracts.
- Late game: conquest campaigns:
  - requires influence threshold
  - pay a war chest (gold sink)
  - resolves in staged rounds/timers
  - victory changes controller and unlocks port perks/resources

## Minigames (arcadey, deterministic scoring)

### Minigame 1: Cannon Volley (timing/rhythm)
- 20–40s
- Deterministic pattern from seeded RNG.
- Score tiers map to buff tiers.

Reward (example; tune later):
- Tier 1: `cannon_volley` buff (+10% voyage gold) for 5m
- Tier 2: (+20%) for 5m
- Tier 3: (+35%) for 5m

Stacking rules must be explicit and testable (e.g., refresh duration, take max tier, or add charges).

Planned later:
- Rigging Run ⇒ speed / rum efficiency buff
- Harpoon Fishing ⇒ food supplies / morale
- Dockside Haggling ⇒ contract fee reduction / better prices window

## UI/UX direction

Melvor-like dense panels, modern:
- Left nav modules with lock states + tooltips (“Unlock by reaching X”)
- Top bar: gold, current port, active timers (contracts/voyages/buffs), offline summary
- Tables with sorting/filtering; clear bottleneck messaging (“bid too low”, “storage full”)

## Tech + architecture target

TypeScript monorepo (recommended):
- `apps/web`: Next.js (App Router) + React + Tailwind + shadcn/ui
- `packages/engine`: pure deterministic sim (`advance(state, dtMs)`, `applyAction(state, action)`), seeded RNG, offline catch-up
- `packages/shared`: shared types/schemas (Zod) + number formatting helpers

Automation:
- Playwright harness via the `develop-idle-game` contract (`window.advanceTime`, `window.render_game_to_text`, `window.__idle`).
