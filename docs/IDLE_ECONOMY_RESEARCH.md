# Sea of Gold — Idle Economy Research Notes

Date:
- 2026-02-06

Scope:
- distill what makes a strong idle/incremental economy
- map findings to Sea of Gold documentation and operating checks
- avoid changing acceptance assertions unless behavior contracts change

Method:
1. Reviewed project docs in required order (`acceptance.md` through `concept.md`).
2. Reviewed external references focused on incremental-game math, value-chain design, and virtual economy stability.
3. Converted findings into implementation-agnostic economy rules and doc coverage updates.

## 1) Distilled Principles

1. Use layered growth curves, not one linear lane.
- Incremental economies stay interesting when generators and costs scale with different exponents and unlock in layers.

2. Keep economy loops as value chains.
- Value should move through source -> conversion -> routing -> sink loops, not raw generation only.

3. Pair every faucet with pressure.
- New generation should introduce a sink, cap, or routing tradeoff in the same phase.

4. Make active play acceleration, not obligation.
- Active actions should boost outcomes meaningfully, while idle remains a viable baseline.

5. Prevent runaway multiplier stacks.
- Multipliers are high risk for pacing collapse if stacked in one lane without sink/cap counterweight.

6. Protect offline trust.
- Offline gains should be deterministic, capped, and transparent about blocked gains/cap effects.

7. Avoid inflation by design.
- If value accumulation outruns spend opportunities, players hoard and decision quality drops.

8. Preserve re-entry clarity.
- Players returning after a break should quickly find immediate and medium-horizon actions.

## 2) Sea Of Gold Mapping

Current Sea of Gold systems already fit the model:
- sources: dock work, contracts, voyages
- converters: production recipes
- routers: voyage route choice, contract pricing/selection
- buffers: warehouse and hold caps
- sinks: wages, repairs, taxes, upgrades, campaigns, vanity, flagship contributions

Documentation strengthened in this change:
- `GAME_SYSTEM.md` now defines explicit economy balancing guardrails.
- `FUN_UX_UI_RUBRIC.md` now includes an economy addendum and recommended economy telemetry.
- `AUTONOMOUS_EVAL_SYSTEM.md` now includes a required economy audit addendum for economy-touching changes.
- `STATE_SNAPSHOT.md` records the autonomous decision and rationale.

## 3) Coverage Checklist

Use this checklist before introducing any new economy feature:

1. Faucet-sink pairing exists.
2. Capacity interaction is explicit.
3. Pacing target band is identified (early/mid/late).
4. Multiplier lane impact reviewed.
5. Active-vs-idle leverage is bounded.
6. Save/offline determinism is preserved.
7. Test/rubric scenario coverage exists.

## 4) External Sources

Idle balancing math:
- [Kongregate: The Math of Idle Games, Part I](https://blog.kongregate.com/the-math-of-idle-games-part-i/)
- [Kongregate: The Math of Idle Games, Part II](https://blog.kongregate.com/the-math-of-idle-games-part-ii/)
- [Kongregate: The Math of Idle Games, Part III](https://blog.kongregate.com/the-math-of-idle-games-part-iii/)

Value-chain and sink framing:
- [Lost Garden: Value chains](https://lostgarden.home.blog/2021/12/12/value-chains/)

Inflation and hoarding behavior:
- [Castronova et al. (2006): The In-Game Economics of Ultima Online](https://econpapers.repec.org/RePEc:wsi:igtrxx:v:05:y:2006:i:03:n:s0219198906000987)

Idle player behavior taxonomy:
- [CHI 2019: Playing to Wait](https://dl.acm.org/doi/10.1145/3311350.3347183)

Offline progression transparency reference:
- [Melvor Idle Wiki: Offline Progression](https://wiki.melvoridle.com/w/Offline_Progression)
