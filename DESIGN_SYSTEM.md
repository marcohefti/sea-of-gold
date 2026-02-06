# Sea of Gold — Design System

This document defines the UI system for Sea of Gold and how it should evolve.

Normative order for product decisions:
1. `acceptance.md`
2. `GAME_SYSTEM.md`
3. `FUN_UX_UI_RUBRIC.md`
4. `DESIGN_SYSTEM.md`

If this file conflicts with acceptance criteria, `acceptance.md` wins.

## 1) UI Direction

Target outcome:
- Keep a **modern, readable, panel-based shell** like Melvor Idle.
- Keep a **minimal, system-first core** like Universal Paperclips and Kittens Game.
- Keep **staged reveal and low early cognitive load** like A Dark Room.

Design thesis:
- Modern chrome improves long-session readability.
- Core loop communication remains direct and mechanically transparent.
- Player can always answer: what to do now, why it matters, what changed.

## 2) What Makes Idle UI Successful

A successful idle/incremental UI for this game must:
1. Prioritize one dominant action while preserving strategic context.
2. Surface pressure systems (storage, supplies, wages, tax, timers) as first-class visuals.
3. Show immediate action feedback (state movement + event narrative).
4. Keep complexity legible through consistent visual language.
5. Support long sessions without visual fatigue.

## 3) Iconography System

### Icon goals
- Speed recognition of systems, status, and action type.
- Reduce text scanning cost in dense panels.
- Provide consistent semantics across nav, pills, controls, and logs.

### Icon rules
1. Use icons from a single family (`lucide-react`) for consistency.
2. Pair every icon with text; icons are accelerators, not replacements.
3. Keep size predictable (`14–16px` in controls, `12–14px` in metadata).
4. Use tone intentionally:
- neutral: routine state
- accent: recommended/primary
- positive: success/completion
- warning/danger: blocker/risk

### Canonical mappings
- `Port` -> `Anchor`
- `Economy` -> `TrendingUp`
- `Crew` -> `Users`
- `Voyage` -> `Sailboat`
- `Politics` -> `Flag`
- `Gold` -> `Coins`
- `Warehouse` -> `Warehouse`
- `Minigame (Cannon)` -> `Crosshair`
- `Minigame (Rigging)` -> `Wind`

## 4) SVG System

### SVG goals
- Use compact, deterministic visuals to explain state at a glance.
- Favor inline SVG for component-level diagnostics and identity.

### SVG patterns
1. **Brand SVG**: small thematic sigil, lightweight animation.
2. **Capacity SVG**: ring/arc for storage or durability pressure.
3. **Flow SVG**: sparkline for tiny trend cues on resource pills.
4. **Topology SVG**: mini route/map sketch for voyage comprehension.

### SVG constraints
- No random rendering behavior.
- Keep SVG purely presentational; game logic remains in engine state.
- Prefer < 2kb per inline SVG component.

## 5) Motion System

### Motion goals
- Reinforce hierarchy and feedback.
- Never obstruct deterministic simulation or testability.

### Motion tokens (CSS variables)
- `--sog-motion-fast`
- `--sog-motion-base`
- `--sog-motion-slow`
- `--sog-ease-standard`
- `--sog-ease-soft`

### Motion primitives
- `sog-fade-in-up`: panel/row entrance
- `sog-soft-pulse`: primary action emphasis
- `sog-shimmer`: active progress/energy
- `sog-float`: subtle hero/sigil movement
- `sog-stagger`: sequential panel reveal

### Accessibility
- All motion utilities must respect `prefers-reduced-motion: reduce`.

## 6) Successful UI Composition Rules

1. Top rail exposes current economy truth (gold, storage, buffs, timers).
2. Left nav remains icon+label; locked state must be obvious.
3. Port core always includes:
- primary objective panel
- next goals
- recent event feedback
4. Active loop panels (minigames, voyage, production) must show:
- status
- timer/progress
- blocker reason (if blocked)
5. Any major action button should include a semantic icon.

## 7) Top 10 Gaps (Priority) And Implementation

1. **No canonical icon language**
- Implemented: canonical icon mappings + reusable glyph usage in game UI.
- Files: `apps/web/src/components/game/GameClient.tsx`

2. **Resource pills are text-heavy and slow to scan**
- Implemented: icon-enhanced pills + deterministic micro sparklines.
- Files: `apps/web/src/components/game/GameClient.tsx`

3. **Warehouse pressure lacks compact visual urgency**
- Implemented: warehouse ring gauge in top pill.
- Files: `apps/web/src/components/game/GameClient.tsx`

4. **Nav lacks rapid visual wayfinding**
- Implemented: iconized nav + active-state chevron/rail + lock icon.
- Files: `apps/web/src/components/game/GameClient.tsx`, `apps/web/src/app/globals.css`

5. **No branded SVG identity layer**
- Implemented: Harbor Sigil SVG on title surface.
- Files: `apps/web/src/components/game/GameClient.tsx`

6. **Voyage overview missing topology cue**
- Implemented: route mini-map SVG with unlocked-vs-locked styling.
- Files: `apps/web/src/components/game/GameClient.tsx`

7. **Primary CTA emphasis inconsistent**
- Implemented: iconized command action + pulse emphasis.
- Files: `apps/web/src/components/game/GameClient.tsx`, `apps/web/src/app/globals.css`

8. **Event log lacks semantic event cues**
- Implemented: icon + tone-coded Captain’s Log rows.
- Files: `apps/web/src/components/game/GameClient.tsx`

9. **Minigame feedback too plain**
- Implemented: iconized minigame headers/actions + shimmer/pulse progress cues.
- Files: `apps/web/src/components/game/GameClient.tsx`, `apps/web/src/app/globals.css`

10. **No formalized motion system**
- Implemented: motion tokens, keyframes, reduced-motion guard, stagger utility.
- Files: `apps/web/src/app/globals.css`, `apps/web/src/components/game/GameClient.tsx`

## 8) Implementation References

Core implementation files:
- `apps/web/src/components/game/GameClient.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/ui/card.tsx`
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/input.tsx`

## 9) Validation Contract

Validation remains acceptance-first:
- run quality gates after meaningful UI change:
  - `ui_overwhelm_guard`
  - `progression_manual_to_auto`
  - `quality_no_dead_time_early`
  - `quality_unlock_avalanche_guard`
- before done: full acceptance suite + determinism/save/lint/build.

## 10) Sources

- Universal Paperclips (official): <https://www.decisionproblem.com/paperclips/>
- Melvor Idle (official): <https://store.steampowered.com/app/1267910/Melvor_Idle/>
- Kittens Game (official web client): <http://kittensgame.com/web/#>
- Kittens Game mechanics wiki: <https://wiki.kittensgame.com/en/general-information/game-mechanics>
- A Dark Room (official): <https://adarkroom.doublespeakgames.com/>
- A Dark Room overview: <https://en.wikipedia.org/wiki/A_Dark_Room>
- Idle design math reference: <https://blog.kongregate.com/the-math-of-idle-games-part-i/>
