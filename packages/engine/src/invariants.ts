import type { GameAction } from "./actions";
import type { GameState } from "./model";
import { invUsed } from "./sim";

type InvariantCtx =
  | { kind: "advance"; ms: number }
  | { kind: "action"; action: GameAction }
  | { kind: "unknown" };

export type GameStateValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`Invariant failed: ${msg}`);
}

function assertFiniteInt(name: string, v: number): void {
  assert(Number.isFinite(v), `${name} must be finite`);
  assert(Number.isInteger(v), `${name} must be integer`);
}

function assertNonNegInt(name: string, v: number): void {
  assertFiniteInt(name, v);
  assert(v >= 0, `${name} must be >= 0`);
}

function assertNonNegBig(name: string, v: bigint): void {
  assert(v >= 0n, `${name} must be >= 0`);
}

function toSet(arr: string[]): Set<string> {
  return new Set(arr);
}

function assertNoDuplicates(name: string, arr: string[]): void {
  const set = toSet(arr);
  assert(set.size === arr.length, `${name} must not contain duplicates`);
}

function assertUnlocksMonotonic(prev: GameState, next: GameState, ctx: InvariantCtx): void {
  if (ctx.kind === "action" && ctx.action.type === "START_NEW_GAME") return;
  const prevSet = toSet(prev.unlocks);
  for (const u of prevSet) assert(next.unlocks.includes(u), `unlocks must be monotonic (missing: ${u})`);
}

function assertTimersMonotonic(prev: GameState, next: GameState, ctx: InvariantCtx): void {
  if (ctx.kind === "action" && ctx.action.type === "START_NEW_GAME") return;

  assert(next.simNowMs >= prev.simNowMs, "simNowMs must be monotonic");

  if (prev.voyage.status === "running" && next.voyage.status === "running") {
    assert(next.voyage.remainingMs <= prev.voyage.remainingMs, "voyage.remainingMs must not increase while running");
  }
  if (prev.conquest.status === "running" && next.conquest.status === "running") {
    assert(next.conquest.remainingMs <= prev.conquest.remainingMs, "conquest.remainingMs must not increase while running");
  }

  if (prev.minigames.cannon.status === "running" && next.minigames.cannon.status === "running") {
    assert(next.minigames.cannon.elapsedMs >= prev.minigames.cannon.elapsedMs, "cannon.elapsedMs must not decrease while running");
  }
  if (prev.minigames.rigging.status === "running" && next.minigames.rigging.status === "running") {
    assert(next.minigames.rigging.elapsedMs >= prev.minigames.rigging.elapsedMs, "rigging.elapsedMs must not decrease while running");
  }

  if (prev.buffs.length > 0) {
    const allowIncrease = new Set<string>();
    if (prev.minigames.cannon.status === "running" && next.minigames.cannon.status === "finished") allowIncrease.add("cannon_volley");
    if (prev.minigames.rigging.status === "running" && next.minigames.rigging.status === "finished") allowIncrease.add("rigging_run");

    const prevById = new Map(prev.buffs.map((b) => [b.id, b.remainingMs]));
    for (const b of next.buffs) {
      const prevMs = prevById.get(b.id);
      if (prevMs != null && !allowIncrease.has(b.id)) {
        assert(b.remainingMs <= prevMs, `buff ${b.id} remainingMs must not increase`);
      }
    }
  }
}

export function assertGameStateInvariants(args: {
  prev?: GameState;
  next: GameState;
  ctx?: InvariantCtx;
}): void {
  const { prev, next, ctx = { kind: "unknown" } } = args;

  assertNonNegInt("simNowMs", next.simNowMs);
  assertNonNegInt("stepAccMs", next.stepAccMs);
  assertNonNegInt("dock.incomeRemainderMs", next.dock.incomeRemainderMs);
  assertNonNegInt("dock.workRemainingMs", next.dock.workRemainingMs);
  assertNonNegInt("crew.wagesRemainderMs", next.crew.wagesRemainderMs);

  assertNonNegBig("resources.gold", next.resources.gold);

  assertNoDuplicates("unlocks", next.unlocks);

  // Politics
  for (const [flagId, inf] of Object.entries(next.politics.influenceByFlagId)) {
    assertNonNegInt(`politics.influenceByFlagId.${flagId}`, inf);
  }
  for (const [portId, perk] of Object.entries(next.politics.portPerksByIslandId)) {
    assertNonNegInt(`politics.perk.${portId}.remainingMs`, perk.remainingMs);
    assert(perk.remainingMs > 0, `politics.perk.${portId}.remainingMs must be > 0`);
    assertNonNegInt(`politics.perk.${portId}.taxDiscountBps`, perk.taxDiscountBps);
  }
  assertNonNegInt("politics.campaign.remainingMs", next.politics.campaign.remainingMs);
  assertNonNegInt("politics.campaign.durationMs", next.politics.campaign.durationMs);
  assert(next.politics.campaign.remainingMs <= next.politics.campaign.durationMs, "politics.campaign.remainingMs must be <= durationMs");
  assertNonNegBig("politics.campaign.goldPaid", next.politics.campaign.goldPaid);
  assertNonNegInt("politics.campaign.influenceSpent", next.politics.campaign.influenceSpent);

  // Storage invariants
  assertNonNegBig("shipHold.cap", next.storage.shipHold.cap);
  assertNonNegBig("shipHold.used", invUsed(next.storage.shipHold.inv));
  assert(invUsed(next.storage.shipHold.inv) <= next.storage.shipHold.cap, "shipHold used must be <= cap");
  for (const [portId, wh] of Object.entries(next.storage.warehouses)) {
    assertNonNegBig(`warehouse.${portId}.cap`, wh.cap);
    const used = invUsed(wh.inv);
    assertNonNegBig(`warehouse.${portId}.used`, used);
    assert(used <= wh.cap, `warehouse ${portId} used must be <= cap`);
  }

  // Voyage invariants
  assertNonNegInt("voyage.remainingMs", next.voyage.remainingMs);
  assertNonNegInt("voyage.durationMs", next.voyage.durationMs);
  assert(next.voyage.remainingMs <= next.voyage.durationMs, "voyage.remainingMs must be <= durationMs");
  assertNonNegBig("voyage.pendingGold", next.voyage.pendingGold);
  assertNonNegInt("voyage.pendingInfluence", next.voyage.pendingInfluence);
  for (const e of next.voyage.encounters) {
    assertNonNegInt("voyage.encounter.atMs", e.atMs);
    assertNonNegInt("voyage.encounter.cannonballsCost", e.cannonballsCost);
  }

  // Conquest invariants
  assertNonNegInt("conquest.remainingMs", next.conquest.remainingMs);
  assertNonNegInt("conquest.durationMs", next.conquest.durationMs);
  assert(next.conquest.remainingMs <= next.conquest.durationMs, "conquest.remainingMs must be <= durationMs");
  assertNonNegBig("conquest.warChestPaid", next.conquest.warChestPaid);

  // Minigames
  assertNonNegInt("cannon.elapsedMs", next.minigames.cannon.elapsedMs);
  assertNonNegInt("cannon.durationMs", next.minigames.cannon.durationMs);
  assert(next.minigames.cannon.elapsedMs <= next.minigames.cannon.durationMs, "cannon elapsedMs must be <= durationMs");
  assertNonNegInt("rigging.elapsedMs", next.minigames.rigging.elapsedMs);
  assertNonNegInt("rigging.durationMs", next.minigames.rigging.durationMs);
  assert(next.minigames.rigging.elapsedMs <= next.minigames.rigging.durationMs, "rigging elapsedMs must be <= durationMs");
  assertNonNegInt("rigging.zoneStartPermille", next.minigames.rigging.zoneStartPermille);

  // Buffs
  for (const b of next.buffs) {
    assertNonNegInt(`buff.${b.id}.remainingMs`, b.remainingMs);
    assert(b.remainingMs > 0, `buff.${b.id}.remainingMs must be > 0`);
  }

  if (prev) {
    assertUnlocksMonotonic(prev, next, ctx);
    assertTimersMonotonic(prev, next, ctx);
  }
}

export function validateGameStateInvariants(args: {
  prev?: GameState;
  next: GameState;
  ctx?: InvariantCtx;
}): GameStateValidationReport {
  try {
    assertGameStateInvariants(args);
    return { ok: true, errors: [], warnings: [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [msg], warnings: [] };
  }
}
