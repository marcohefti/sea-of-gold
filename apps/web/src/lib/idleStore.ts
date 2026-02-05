import {
  applyAction,
  advance,
  getActiveContractCountForPortForUi,
  getCannonVolleyRefreshWindowMsForUi,
  getContractMaxActivePerPortForUi,
  getDockAutomateCostGoldForUi,
  getEffectivePortTaxBpsForUi,
  getFactionStandingForUi,
  getDockPassiveGoldPerSecForUi,
  getDockWorkDurationMsForUi,
  getDockWorkHustleReduceMsForUi,
  getRiggingRunRefreshWindowMsForUi,
  getTutorialStepIdForUi,
  invUsed,
  isCommodityId,
  isDockWorkManualAvailableForUi,
  makeInitialState,
  type GameAction,
  type GameState,
} from "@sea-of-gold/engine";
import { assertGameStateInvariants, validateGameStateInvariants, type GameStateValidationReport } from "@sea-of-gold/engine";
import {
  bigintToJsonNumberString,
  FLAG_BY_ID,
  FLAGS,
  IDLE_API_VERSION,
  ISLAND_BY_ID,
  parseNonNegIntLike,
  parseSavePayload,
  ROUTES,
} from "@sea-of-gold/shared";

type Listener = () => void;

export type OfflineCatchupReport = {
  wallClockDeltaMs: number;
  appliedMs: number;
  capMs: number;
  wasCapped: boolean;
  goldGained: string;
};

export type IdleUiText = {
  activeNav: string;
  openMinigame: string | null;
  realtimeEnabled: boolean;
  isAutomation: boolean;
};

type InvJson = {
  wood: string;
  sugar: string;
  iron: string;
  stone: string;
  hemp: string;
  herbs: string;
  rum: string;
  dye: string;
  cloth: string;
  cosmetics: string;
  cannonballs: string;
  parts: string;
  repair_kits: string;
};

function invToJson(inv: GameState["storage"]["shipHold"]["inv"]): InvJson {
  return {
    wood: bigintToJsonNumberString(inv.wood),
    sugar: bigintToJsonNumberString(inv.sugar),
    iron: bigintToJsonNumberString(inv.iron),
    stone: bigintToJsonNumberString(inv.stone),
    hemp: bigintToJsonNumberString(inv.hemp),
    herbs: bigintToJsonNumberString(inv.herbs),
    rum: bigintToJsonNumberString(inv.rum),
    dye: bigintToJsonNumberString(inv.dye),
    cloth: bigintToJsonNumberString(inv.cloth),
    cosmetics: bigintToJsonNumberString(inv.cosmetics),
    cannonballs: bigintToJsonNumberString(inv.cannonballs),
    parts: bigintToJsonNumberString(inv.parts),
    repair_kits: bigintToJsonNumberString(inv.repair_kits),
  };
}

function invFromJson(raw: InvJson): GameState["storage"]["shipHold"]["inv"] {
  return {
    wood: BigInt(raw.wood),
    sugar: BigInt(raw.sugar),
    iron: BigInt(raw.iron),
    stone: BigInt(raw.stone),
    hemp: BigInt(raw.hemp),
    herbs: BigInt(raw.herbs),
    rum: BigInt(raw.rum),
    dye: BigInt(raw.dye),
    cloth: BigInt(raw.cloth),
    cosmetics: BigInt(raw.cosmetics),
    cannonballs: BigInt(raw.cannonballs),
    parts: BigInt(raw.parts),
    repair_kits: BigInt(raw.repair_kits),
  };
}

export type IdleTextState = {
  meta: { version: string; nowMs: number; mode: string; offline: OfflineCatchupReport | null; ui?: IdleUiText };
  quality?: {
    ui: {
      mode: string;
      visibleModuleCount: number;
      visibleNavCount: number;
      visibleInteractiveCount: number;
      primaryActionCount: number;
      totalActionCount: number;
      lastUnlockDeltaModules: number;
      lastUnlockDeltaInteractives: number;
      lastUnlockDeltaUnlockCount: number;
      tutorialStepId: string;
    };
    progression: {
      goldPassivePerSec: string | number;
      goldManualActionAvailable: boolean;
      goldManualActionCount: number;
      automationUnlocked: boolean;
      nextGoalId: string;
    };
    pacing?: {
      manualActionId: string;
      manualActionImmediateReward: boolean;
      manualActionBusyRemainingMs: number;
      manualActionCooldownMs: number;
      manualActionHustleReduceMs: number;
      manualActionDurationMs: number;
      meaningfulActionCount: number;
      timeToNextMeaningfulActionMs: number;
      idleGoldPerSec: string | number;
    };
    validation?: GameStateValidationReport;
    debug?: {
      eventCount: number;
      lastSeq: number;
      tail: DebugEvent[];
    };
  };
  minigameLocks?: { cannonStartBlocked: boolean; riggingStartBlocked: boolean };
  stats?: { voyagesStarted: number };
  activeShip: { id: string; name: string };
  fleet: {
    count: number;
    max: number;
    ships: Array<{
      id: string;
      name: string;
      classId: string;
      locationId: string;
      voyageStatus: string;
      automation: { enabled: boolean; routeId: string | null; autoCollect: boolean };
    }>;
  };
  world: { controllerByIslandId: Record<string, string> };
  conquest: {
    status: string;
    targetIslandId: string | null;
    attackerFlagId: string | null;
    remainingMs: number;
    durationMs: number;
    stage: number;
    warChestPaid: string | number;
  };
  shipyard: { level: number };
  flagship: { progress: number; required: number };
  location: { id: string; name: string };
  ship: { classId: string; condition: number; maxCondition: number };
  crew: { hired: number; sailingXp: number; gunneryXp: number };
  resources: {
    gold: string | number;
    wood: string | number;
    sugar: string | number;
    iron: string | number;
    stone: string | number;
    hemp: string | number;
    herbs: string | number;
    rum: string | number;
    dye: string | number;
    cloth: string | number;
    cosmetics: string | number;
    cannonballs: string | number;
    parts: string | number;
    repair_kits: string | number;
  };
  hold: {
    wood: string | number;
    sugar: string | number;
    iron: string | number;
    stone: string | number;
    hemp: string | number;
    herbs: string | number;
    rum: string | number;
    dye: string | number;
    cloth: string | number;
    cosmetics: string | number;
    cannonballs: string | number;
    parts: string | number;
    repair_kits: string | number;
  };
  storage: {
    warehouseCap: string | number;
    warehouseUsed: string | number;
    holdCap: string | number;
    holdUsed: string | number;
  };
  unlocks: string[];
  politics: {
    affiliationFlagId: string;
    influenceByFlagId: Record<string, number>;
    standingByFlagId?: Record<string, string>;
    campaign?: {
      status: string;
      kind: string;
      portId: string | null;
      controllerFlagId: string | null;
      remainingMs: number;
      durationMs: number;
      goldPaid: string | number;
      influenceSpent: number;
    };
    portPerksByIslandId?: Record<string, { id: string; remainingMs: number; taxDiscountBps: number }>;
    currentPort?: {
      id: string;
      controllerFlagId: string;
      baseTaxBps: number;
      effectiveTaxBps: number;
      perkDiscountBps: number;
    };
  };
  economy: {
    contractSlots?: { used: number; max: number };
    contracts: Array<{
      id?: string;
      portId?: string;
      commodityId: string;
      qty: string | number;
      bidPrice: string | number;
      feePaid: string | number;
      filledQty: string | number;
      collectedQty: string | number;
      status: string;
    }>;
  };
  production: { jobs: Record<string, { enabled: boolean; remainderMs: number }> };
  voyage: {
    status: string;
    routeId: string | null;
    fromIslandId: string | null;
    toIslandId: string | null;
    availableRoutes?: string[];
    remainingMs: number;
    durationMs: number;
    pendingGold: string | number;
    pendingInfluence: number;
    encounters: Array<{ atMs: number; cannonballsCost: number; status: string }>;
  };
  minigames?: {
    cannon: { status: string; elapsedMs: number; durationMs: number; hits: number; shots: number };
    rigging: { status: string; elapsedMs: number; durationMs: number; tugs: number; goodTugs: number; zoneStartPermille: number };
  };
  buffs: Array<{ id: string; remainingMs: number; powerBps?: number }>;
};

function derivedTextMode(state: GameState): string {
  if (state.mode === "title") return "title";
  const cannonRunning = state.minigames.cannon.status === "running";
  const riggingRunning = state.minigames.rigging.status === "running";
  if (cannonRunning || riggingRunning) return "minigame";
  if (state.voyage.status !== "idle") return "voyage";
  return "port";
}

function computeQualityUiCounts(state: GameState, ui: IdleUiText | undefined) {
  const stepId = state.mode === "title" ? "tut:title" : getTutorialStepIdForUi(state);
  const inDockIntro = stepId === "tut:dock_intro";
  const inEconomyIntro = stepId === "tut:economy_intro";
  const activeNav = ui?.activeNav ?? "port";
  const hasOpenMinigame = !!ui?.openMinigame;

  const visibleNavIds: string[] = [];
  if (state.mode !== "title") {
    visibleNavIds.push("port");
    if (!inDockIntro && state.unlocks.includes("economy")) visibleNavIds.push("economy");
    if (!inDockIntro && !inEconomyIntro) {
      if (state.unlocks.includes("crew")) visibleNavIds.push("crew");
      if (state.unlocks.includes("voyage")) visibleNavIds.push("voyage");
      if (state.unlocks.includes("politics")) visibleNavIds.push("politics");
    }
  }

  // "Modules" are major cards/panels visible in the main content area (exclude automation-only debug panels).
  let visibleModuleCount = 0;
  if (state.mode !== "title") {
    if (hasOpenMinigame) visibleModuleCount += 1;
    if (activeNav === "port") {
      if (inDockIntro) {
        visibleModuleCount += 1;
      } else if (inEconomyIntro) {
        visibleModuleCount += 2; // dock summary + economy intro card
      } else {
        const shipPanelVisible = state.unlocks.includes("voyage") || state.ship.condition < state.ship.maxCondition;
        const fleetVisible = state.fleet.maxShips > 2 || state.fleet.ships.length > 0;
        const flagshipVisible = state.unlocks.includes("politics") || state.flagship.progress > 0;
        const hasCrafting =
          state.unlocks.includes("recipe:forge_cannonballs") ||
          state.unlocks.includes("recipe:craft_parts") ||
          state.unlocks.includes("recipe:assemble_repair_kits") ||
          state.unlocks.includes("recipe:brew_dye") ||
          state.unlocks.includes("recipe:weave_cloth") ||
          state.unlocks.includes("recipe:tailor_cosmetics");

        visibleModuleCount +=
          1 + // dock summary
          1 + // next goals
          1 + // warehouse
          (state.unlocks.includes("recipe:distill_rum") ? 1 : 0) +
          (state.unlocks.includes("voyage") ? 1 : 0) + // ship hold
          (shipPanelVisible ? 1 : 0) +
          (state.unlocks.includes("crew") ? 1 : 0) + // shipyard
          (fleetVisible ? 1 : 0) +
          (flagshipVisible ? 1 : 0) +
          (hasCrafting ? 1 : 0) +
          (state.unlocks.includes("vanity_shop") ? 1 : 0);
      }
    } else if (activeNav === "economy") {
      visibleModuleCount += 2;
    } else {
      visibleModuleCount += 1;
    }
  }

  // Primary actions = the main CTA buttons intentionally surfaced for the current tutorial phase.
  const primaryActionCount = inDockIntro ? 2 : inEconomyIntro && activeNav === "port" ? 1 : activeNav === "economy" ? 2 : 0;

  // Total actions = primary actions + visible nav buttons (we do not count every minor widget).
  const totalActionCount = primaryActionCount + visibleNavIds.length;

  // Interactive controls = nav + a curated set of major action controls (not every small widget).
  let visibleInteractiveCount = visibleNavIds.length;
  if (!inDockIntro && !inEconomyIntro) {
    if (state.unlocks.includes("minigame:cannon")) visibleInteractiveCount += 1;
    if (state.unlocks.includes("minigame:rigging")) visibleInteractiveCount += 1;
  }
  if (state.mode !== "title") {
    if (hasOpenMinigame) visibleInteractiveCount += 3; // start/action/close (approx)
    if (activeNav === "port") {
      if (inDockIntro) {
        visibleInteractiveCount += 2; // work + buy automation
      } else if (inEconomyIntro) {
        visibleInteractiveCount += 1; // open economy button
      } else {
        const shipPanelVisible = state.unlocks.includes("voyage") || state.ship.condition < state.ship.maxCondition;
        const fleetVisible = state.fleet.maxShips > 2 || state.fleet.ships.length > 0;
        const flagshipVisible = state.unlocks.includes("politics") || state.flagship.progress > 0;
        const hasCrafting =
          state.unlocks.includes("recipe:forge_cannonballs") ||
          state.unlocks.includes("recipe:craft_parts") ||
          state.unlocks.includes("recipe:assemble_repair_kits") ||
          state.unlocks.includes("recipe:brew_dye") ||
          state.unlocks.includes("recipe:weave_cloth") ||
          state.unlocks.includes("recipe:tailor_cosmetics");

        visibleInteractiveCount +=
          1 + // warehouse upgrade
          (state.unlocks.includes("recipe:distill_rum") ? 1 : 0) + // distillery enable toggle
          (state.unlocks.includes("voyage") ? 4 : 0) + // ship hold transfer (select + qty + load + unload)
          (shipPanelVisible ? 1 : 0) + // ship repair
          (state.unlocks.includes("crew") ? 4 : 0) + // shipyard (upgrade + 3 buy buttons)
          (fleetVisible ? 3 * (1 + state.fleet.ships.length) + 2 : 0) + // per-ship automation + buy buttons
          (flagshipVisible ? 1 : 0) + // flagship contribute
          (hasCrafting ? 6 : 0) + // crafting recipe toggles
          (state.unlocks.includes("vanity_shop") ? 3 : 0); // vanity shop buy buttons (approx)
      }
    } else if (activeNav === "economy") {
      visibleInteractiveCount += 7; // place form + collect/cancel controls (approx)
    } else if (activeNav === "crew") {
      visibleInteractiveCount += 3; // qty + hire + fire
    } else if (activeNav === "voyage") {
      visibleInteractiveCount += 4; // prepare/start/collect + chart buy (approx)
    } else if (activeNav === "politics") {
      visibleInteractiveCount += 7; // affiliation + donate + campaigns (approx)
    }
  }

  return {
    stepId,
    visibleNavCount: visibleNavIds.length,
    visibleModuleCount,
    visibleInteractiveCount,
    primaryActionCount,
    totalActionCount,
  };
}

function computeQualityPacing(state: GameState) {
  const stepId = state.mode === "title" ? "tut:title" : getTutorialStepIdForUi(state);
  const passivePerSec = getDockPassiveGoldPerSecForUi(state);
  const manualAvail = isDockWorkManualAvailableForUi(state);
  const automateCost = getDockAutomateCostGoldForUi();
  const durationMs = getDockWorkDurationMsForUi();
  const hustleReduceMs = getDockWorkHustleReduceMsForUi();
  const canBuyAutomation =
    state.mode === "port" && stepId === "tut:dock_intro" && !state.dock.passiveEnabled && state.resources.gold >= automateCost;

  const meaningfulActionCount =
    stepId === "tut:dock_intro" ? (manualAvail ? 1 : 0) + (canBuyAutomation ? 1 : 0) : 1;

  const timeToNextMeaningfulActionMs =
    meaningfulActionCount > 0 ? 0 : Math.max(0, Math.trunc(state.dock.workRemainingMs));

  const manualActionCooldownMs = manualAvail ? 0 : Math.max(0, Math.trunc(state.dock.workRemainingMs));

  return {
    manualActionId: "work-docks",
    manualActionImmediateReward: true,
    manualActionBusyRemainingMs: Math.max(0, Math.trunc(state.dock.workRemainingMs)),
    manualActionCooldownMs,
    manualActionHustleReduceMs: hustleReduceMs,
    manualActionDurationMs: durationMs,
    meaningfulActionCount,
    timeToNextMeaningfulActionMs,
    idleGoldPerSec: bigintToJsonNumberString(passivePerSec),
  };
}

function deriveNextGoalId(state: GameState): string {
  if (state.mode === "title") return "goal:start_new_game";

  const stepId = getTutorialStepIdForUi(state);
  if (stepId === "tut:dock_intro") {
    if (state.resources.gold <= 0n && state.dock.workRemainingMs <= 0) return "goal:earn_first_gold";
    return "goal:buy_auto_dockwork";
  }

  if (!state.unlocks.includes("economy")) return "goal:unlock_economy";
  if (state.unlocks.includes("economy") && state.economy.contracts.length === 0) return "goal:place_first_contract";
  if (state.unlocks.includes("minigame:cannon") && !state.buffs.some((b) => b.id === "cannon_volley")) return "goal:play_cannon_volley";
  return "goal:next";
}

function serializeStateForSave(state: GameState) {
  // Save payload stores rng separately for deterministic roundtrips.
  const { rng: _rng, ...rest } = state;
  void _rng;
  return {
    ...rest,
    resources: {
      gold: bigintToJsonNumberString(state.resources.gold),
    },
    storage: {
      warehouses: Object.fromEntries(
        Object.entries(state.storage.warehouses).map(([id, wh]) => [
          id,
          { cap: bigintToJsonNumberString(wh.cap), inv: invToJson(wh.inv) },
        ])
      ),
      shipHold: { cap: bigintToJsonNumberString(state.storage.shipHold.cap), inv: invToJson(state.storage.shipHold.inv) },
    },
    economy: {
      contracts: state.economy.contracts.map((c) => ({
        ...c,
        qty: bigintToJsonNumberString(c.qty),
        bidPrice: bigintToJsonNumberString(c.bidPrice),
        feePaid: bigintToJsonNumberString(c.feePaid),
        filledQty: bigintToJsonNumberString(c.filledQty),
        collectedQty: bigintToJsonNumberString(c.collectedQty),
      })),
      spawnAcc: state.economy.spawnAcc,
    },
    voyage: {
      ...state.voyage,
      pendingGold: bigintToJsonNumberString(state.voyage.pendingGold),
    },
    politics: {
      ...state.politics,
      campaign: {
        ...state.politics.campaign,
        goldPaid: bigintToJsonNumberString(state.politics.campaign.goldPaid),
      },
    },
    fleet: {
      ...state.fleet,
      ships: state.fleet.ships.map((s) => ({
        ...s,
        hold: { cap: bigintToJsonNumberString(s.hold.cap), inv: invToJson(s.hold.inv) },
        voyage: { ...s.voyage, pendingGold: bigintToJsonNumberString(s.voyage.pendingGold) },
      })),
    },
    conquest: {
      ...state.conquest,
      warChestPaid: bigintToJsonNumberString(state.conquest.warChestPaid),
    },
  };
}

function deserializeStateFromSave(raw: ReturnType<typeof parseSavePayload>["state"], rng: GameState["rng"]): GameState {
  return {
    ...raw,
    rng,
    resources: {
      gold: BigInt(raw.resources.gold),
    },
    storage: {
      warehouses: Object.fromEntries(
        Object.entries(raw.storage.warehouses).map(([id, wh]) => [
          id,
          { cap: BigInt(wh.cap), inv: invFromJson(wh.inv) },
        ])
      ),
      shipHold: { cap: BigInt(raw.storage.shipHold.cap), inv: invFromJson(raw.storage.shipHold.inv) },
    },
    economy: {
      contracts: raw.economy.contracts.flatMap((c) => {
        if (!isCommodityId(c.commodityId)) return [];
        return [
          {
            ...c,
            commodityId: c.commodityId,
            qty: BigInt(c.qty),
            bidPrice: BigInt(c.bidPrice),
            feePaid: BigInt(c.feePaid),
            filledQty: BigInt(c.filledQty),
            collectedQty: BigInt(c.collectedQty),
          },
        ];
      }),
      spawnAcc: raw.economy.spawnAcc,
    },
    voyage: {
      ...raw.voyage,
      pendingGold: BigInt(raw.voyage.pendingGold),
    },
    politics: {
      ...raw.politics,
      campaign: {
        ...raw.politics.campaign,
        goldPaid: BigInt(raw.politics.campaign.goldPaid),
      },
    },
    fleet: {
      ...raw.fleet,
      ships: raw.fleet.ships.map((s) => ({
        ...s,
        hold: { cap: BigInt(s.hold.cap), inv: invFromJson(s.hold.inv) },
        voyage: { ...s.voyage, pendingGold: BigInt(s.voyage.pendingGold) },
      })),
    },
    conquest: {
      ...raw.conquest,
      warChestPaid: BigInt(raw.conquest.warChestPaid),
    },
  };
}

export type IdleStore = {
  getState(): GameState;
  getOfflineCatchupReport(): OfflineCatchupReport | null;
  clearOfflineCatchupReport(): void;
  simulateOfflineCatchup(wallClockDeltaMs: number): void;
  getDebugLog(): DebugEvent[];
  clearDebugLog(): void;
  validate(opts?: { ui?: IdleUiText }): GameStateValidationReport;
  subscribe(listener: Listener): () => void;
  dispatch(action: GameAction): void;
  advanceTime(ms: number): void;
  renderGameToText(opts?: { ui?: IdleUiText }): string;
  exportSave(): string;
  importSave(save: string): void;
  hardReset(): void;
  setSeed(seed: number): void;
};

type DebugEvent =
  | { kind: "action"; seq: number; nowMs: number; action: { type: string; payload?: Record<string, unknown> } }
  | { kind: "advance"; seq: number; nowMs: number; ms: number }
  | { kind: "unlock"; seq: number; nowMs: number; added: string[] }
  | { kind: "status"; seq: number; nowMs: number; system: string; from: string; to: string };

function toDebugPayload(action: GameAction): { type: string; payload?: Record<string, unknown> } {
  const t = action.type;
  switch (t) {
    case "PLACE_CONTRACT":
      return {
        type: t,
        payload: {
          commodityId: action.commodityId,
          qty: action.qty.toString(10),
          bidPrice: action.bidPrice.toString(10),
        },
      };
    case "LOAD_TO_HOLD":
    case "UNLOAD_FROM_HOLD":
      return { type: t, payload: { commodityId: action.commodityId, qty: action.qty.toString(10) } };
    case "POLITICS_DONATE":
      return { type: t, payload: { flagId: action.flagId, gold: action.gold.toString(10) } };
    case "CREW_HIRE":
    case "CREW_FIRE":
      return { type: t, payload: { qty: action.qty } };
    case "FLEET_SET_AUTOMATION":
      return {
        type: t,
        payload: { shipId: action.shipId, enabled: action.enabled, routeId: action.routeId, autoCollect: action.autoCollect },
      };
    case "FLEET_BUY_SHIP":
    case "SHIP_BUY_CLASS":
      return { type: t, payload: { classId: action.classId } };
    case "VANITY_BUY":
      return { type: t, payload: { itemId: action.itemId } };
    case "POLITICS_SET_AFFILIATION":
      return { type: t, payload: { flagId: action.flagId } };
    case "VOYAGE_START":
      return { type: t, payload: { routeId: action.routeId } };
    case "VOYAGE_PREPARE":
      return { type: t, payload: { routeId: action.routeId } };
    case "CONQUEST_START":
      return { type: t, payload: { targetIslandId: action.targetIslandId } };
    default:
      return { type: t };
  }
}

export function createIdleStore(): IdleStore {
  let seed = 1;
  let state: GameState = makeInitialState(seed);
  let offlineCatchupReport: OfflineCatchupReport | null = null;
  const OFFLINE_CATCHUP_CAP_MS = 24 * 60 * 60 * 1000;

  const ENABLE_INVARIANTS = process.env.NODE_ENV !== "production";
  const DEBUG_LOG_MAX = 200;
  let debugSeq = 0;
  let debugLog: DebugEvent[] = [];
  const DEFAULT_QUALITY_UI: IdleUiText = {
    activeNav: "port",
    openMinigame: null,
    realtimeEnabled: false,
    isAutomation: true,
  };
  let lastQualityUi: IdleUiText = DEFAULT_QUALITY_UI;
  let lastUnlockDeltaModules = 0;
  let lastUnlockDeltaInteractives = 0;
  let lastUnlockDeltaUnlockCount = 0;

  const listeners = new Set<Listener>();
  const emit = () => {
    for (const l of listeners) l();
  };

  const pushDebug = (evt: DebugEvent) => {
    debugLog = debugLog.length >= DEBUG_LOG_MAX ? [...debugLog.slice(1), evt] : [...debugLog, evt];
  };

  const noteTransitions = (prev: GameState, next: GameState) => {
    const nowMs = next.simNowMs;
    if (prev.voyage.status !== next.voyage.status) {
      pushDebug({ kind: "status", seq: ++debugSeq, nowMs, system: "voyage", from: prev.voyage.status, to: next.voyage.status });
    }
    if (prev.conquest.status !== next.conquest.status) {
      pushDebug({
        kind: "status",
        seq: ++debugSeq,
        nowMs,
        system: "conquest",
        from: prev.conquest.status,
        to: next.conquest.status,
      });
    }
    if (prev.minigames.cannon.status !== next.minigames.cannon.status) {
      pushDebug({
        kind: "status",
        seq: ++debugSeq,
        nowMs,
        system: "minigame:cannon",
        from: prev.minigames.cannon.status,
        to: next.minigames.cannon.status,
      });
    }
    if (prev.minigames.rigging.status !== next.minigames.rigging.status) {
      pushDebug({
        kind: "status",
        seq: ++debugSeq,
        nowMs,
        system: "minigame:rigging",
        from: prev.minigames.rigging.status,
        to: next.minigames.rigging.status,
      });
    }
    if (prev.unlocks !== next.unlocks) {
      const prevSet = new Set(prev.unlocks);
      const added = next.unlocks.filter((u) => !prevSet.has(u));
      lastUnlockDeltaUnlockCount = added.length;
      if (added.length > 0) pushDebug({ kind: "unlock", seq: ++debugSeq, nowMs, added });
    }

    const stepChanged = prev.tutorial.stepId !== next.tutorial.stepId;
    const unlocksChanged = prev.unlocks !== next.unlocks;
    if (stepChanged || unlocksChanged) {
      const before = computeQualityUiCounts(prev, lastQualityUi);
      const after = computeQualityUiCounts(next, lastQualityUi);
      lastUnlockDeltaModules = Math.max(0, after.visibleModuleCount - before.visibleModuleCount);
      lastUnlockDeltaInteractives = Math.max(0, after.visibleInteractiveCount - before.visibleInteractiveCount);
    }
  };

  const validateWithQuality = (): GameStateValidationReport => {
    const base = validateGameStateInvariants({ next: state });
    const errors = [...base.errors];
    const warnings = [...base.warnings];

    const pacing = computeQualityPacing(state);
    if (state.mode !== "title" && state.tutorial.stepId === "tut:dock_intro" && pacing.meaningfulActionCount === 0) {
      errors.push("Quality gate: dead time — no meaningful actions available in tut:dock_intro.");
    }

    if (lastUnlockDeltaInteractives > 8) {
      warnings.push(
        `Quality gate: unlock spike — +${lastUnlockDeltaInteractives} interactives became visible on the last unlock.`
      );
    }
    if (lastUnlockDeltaModules > 2) {
      warnings.push(`Quality gate: unlock spike — +${lastUnlockDeltaModules} modules became visible on the last unlock.`);
    }
    if (lastUnlockDeltaUnlockCount > 6) {
      warnings.push(`Quality gate: unlock burst — +${lastUnlockDeltaUnlockCount} unlock IDs granted on the last unlock.`);
    }

    return { ok: errors.length === 0, errors, warnings };
  };

  const store: IdleStore = {
    getState() {
      return state;
    },
    getOfflineCatchupReport() {
      return offlineCatchupReport;
    },
    clearOfflineCatchupReport() {
      if (offlineCatchupReport == null) return;
      offlineCatchupReport = null;
      emit();
    },
    simulateOfflineCatchup(wallClockDeltaMsRaw) {
      const wallClockDeltaMs = Math.max(0, Math.trunc(wallClockDeltaMsRaw));
      const appliedMs = Math.min(wallClockDeltaMs, OFFLINE_CATCHUP_CAP_MS);
      const wasCapped = wallClockDeltaMs > OFFLINE_CATCHUP_CAP_MS;

      const goldBefore = state.resources.gold;
      if (appliedMs > 0) state = advance(state, appliedMs);
      const goldAfter = state.resources.gold;

      offlineCatchupReport = {
        wallClockDeltaMs,
        appliedMs,
        capMs: OFFLINE_CATCHUP_CAP_MS,
        wasCapped,
        goldGained: bigintToJsonNumberString(goldAfter - goldBefore),
      };
      emit();
    },
    getDebugLog() {
      return debugLog;
    },
    clearDebugLog() {
      if (debugLog.length === 0) return;
      debugLog = [];
      emit();
    },
    validate() {
      return validateWithQuality();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(action) {
      const prev = state;
      pushDebug({ kind: "action", seq: ++debugSeq, nowMs: prev.simNowMs, action: toDebugPayload(action) });
      state = applyAction(state, action);
      noteTransitions(prev, state);
      if (ENABLE_INVARIANTS) assertGameStateInvariants({ prev, next: state, ctx: { kind: "action", action } });
      emit();
    },
    advanceTime(ms) {
      const prev = state;
      pushDebug({ kind: "advance", seq: ++debugSeq, nowMs: prev.simNowMs, ms: Math.max(0, Math.trunc(ms)) });
      state = advance(state, ms);
      noteTransitions(prev, state);
      if (ENABLE_INVARIANTS) assertGameStateInvariants({ prev, next: state, ctx: { kind: "advance", ms } });
      emit();
    },
    renderGameToText(opts) {
      if (opts?.ui) lastQualityUi = opts.ui;
      const portId = state.location.islandId;
      const island = ISLAND_BY_ID[portId] || { id: portId, name: portId };
      const wh = state.storage.warehouses[portId];
      const whInv = wh?.inv || {
        wood: 0n,
        sugar: 0n,
        iron: 0n,
        stone: 0n,
        hemp: 0n,
        herbs: 0n,
        rum: 0n,
        dye: 0n,
        cloth: 0n,
        cosmetics: 0n,
        cannonballs: 0n,
        parts: 0n,
        repair_kits: 0n,
      };
      const holdInv = state.storage.shipHold.inv;
      const cannonRefreshWindowMs = getCannonVolleyRefreshWindowMsForUi();
      const riggingRefreshWindowMs = getRiggingRunRefreshWindowMsForUi();
      const cannonBuff = state.buffs.find((b) => b.id === "cannon_volley");
      const riggingBuff = state.buffs.find((b) => b.id === "rigging_run");
      const contractSlots = {
        used: getActiveContractCountForPortForUi(state, portId),
        max: getContractMaxActivePerPortForUi(),
      };

      const controllerFlagId = state.world.controllerByIslandId[portId] ?? ISLAND_BY_ID[portId]?.controllerFlagId ?? "player";
      const baseTaxBps = FLAG_BY_ID[controllerFlagId]?.taxBps ?? 0;
      const effectiveTaxBps = getEffectivePortTaxBpsForUi(state, portId);
      const perkHere = state.politics.portPerksByIslandId[portId];
      const perkDiscountBps = perkHere && perkHere.remainingMs > 0 ? perkHere.taxDiscountBps : 0;
      const standingByFlagId = Object.fromEntries(FLAGS.map((f) => [f.id, getFactionStandingForUi(state, f.id)]));

      const view: IdleTextState = {
        meta: {
          version: IDLE_API_VERSION,
          nowMs: state.simNowMs,
          mode: derivedTextMode(state),
          offline: offlineCatchupReport,
          ui: opts?.ui,
        },
        quality: (() => {
          const ui = opts?.ui;
          const counts = computeQualityUiCounts(state, ui);
          const pacing = computeQualityPacing(state);
          const passivePerSec = getDockPassiveGoldPerSecForUi(state);
          const manualAvail = isDockWorkManualAvailableForUi(state);
          const validation = validateWithQuality();
          const tail = debugLog.slice(-8);
          return {
            ui: {
              mode: derivedTextMode(state),
              visibleModuleCount: counts.visibleModuleCount,
              visibleNavCount: counts.visibleNavCount,
              visibleInteractiveCount: counts.visibleInteractiveCount,
              primaryActionCount: counts.primaryActionCount,
              totalActionCount: counts.totalActionCount,
              lastUnlockDeltaModules,
              lastUnlockDeltaInteractives,
              lastUnlockDeltaUnlockCount,
              tutorialStepId: counts.stepId,
            },
            progression: {
              goldPassivePerSec: bigintToJsonNumberString(passivePerSec),
              goldManualActionAvailable: manualAvail,
              goldManualActionCount: manualAvail ? 1 : 0,
              automationUnlocked: state.dock.passiveEnabled,
              nextGoalId: deriveNextGoalId(state),
            },
            pacing,
            validation,
            debug: {
              eventCount: debugLog.length,
              lastSeq: debugSeq,
              tail,
            },
          };
        })(),
        minigameLocks: {
          cannonStartBlocked: cannonBuff ? cannonBuff.remainingMs >= cannonRefreshWindowMs : false,
          riggingStartBlocked: riggingBuff ? riggingBuff.remainingMs >= riggingRefreshWindowMs : false,
        },
        stats: { voyagesStarted: state.stats.voyagesStarted },
        activeShip: { id: state.shipId, name: state.shipName },
        fleet: {
          count: 1 + state.fleet.ships.length,
          max: state.fleet.maxShips,
          ships: [
            {
              id: state.shipId,
              name: state.shipName,
              classId: state.ship.classId,
              locationId: state.location.islandId,
              voyageStatus: state.voyage.status,
              automation: { ...state.automation },
            },
            ...state.fleet.ships.map((s) => ({
              id: s.id,
              name: s.name,
              classId: s.ship.classId,
              locationId: s.location.islandId,
              voyageStatus: s.voyage.status,
              automation: { ...s.automation },
            })),
          ],
        },
        world: { controllerByIslandId: { ...state.world.controllerByIslandId } },
        conquest: {
          status: state.conquest.status,
          targetIslandId: state.conquest.targetIslandId,
          attackerFlagId: state.conquest.attackerFlagId,
          remainingMs: state.conquest.remainingMs,
          durationMs: state.conquest.durationMs,
          stage: state.conquest.stage,
          warChestPaid: bigintToJsonNumberString(state.conquest.warChestPaid),
        },
        shipyard: { level: state.shipyard.level },
        flagship: { progress: state.flagship.progress, required: state.flagship.required },
        location: { id: portId, name: island.name },
        ship: { ...state.ship },
        crew: {
          hired: state.crew.hired,
          sailingXp: state.crew.skills.sailingXp,
          gunneryXp: state.crew.skills.gunneryXp,
        },
        resources: {
          gold: bigintToJsonNumberString(state.resources.gold),
          wood: bigintToJsonNumberString(whInv.wood),
          sugar: bigintToJsonNumberString(whInv.sugar),
          iron: bigintToJsonNumberString(whInv.iron),
          stone: bigintToJsonNumberString(whInv.stone),
          hemp: bigintToJsonNumberString(whInv.hemp),
          herbs: bigintToJsonNumberString(whInv.herbs),
          rum: bigintToJsonNumberString(whInv.rum),
          dye: bigintToJsonNumberString(whInv.dye),
          cloth: bigintToJsonNumberString(whInv.cloth),
          cosmetics: bigintToJsonNumberString(whInv.cosmetics),
          cannonballs: bigintToJsonNumberString(whInv.cannonballs),
          parts: bigintToJsonNumberString(whInv.parts),
          repair_kits: bigintToJsonNumberString(whInv.repair_kits),
        },
        hold: {
          wood: bigintToJsonNumberString(holdInv.wood),
          sugar: bigintToJsonNumberString(holdInv.sugar),
          iron: bigintToJsonNumberString(holdInv.iron),
          stone: bigintToJsonNumberString(holdInv.stone),
          hemp: bigintToJsonNumberString(holdInv.hemp),
          herbs: bigintToJsonNumberString(holdInv.herbs),
          rum: bigintToJsonNumberString(holdInv.rum),
          dye: bigintToJsonNumberString(holdInv.dye),
          cloth: bigintToJsonNumberString(holdInv.cloth),
          cosmetics: bigintToJsonNumberString(holdInv.cosmetics),
          cannonballs: bigintToJsonNumberString(holdInv.cannonballs),
          parts: bigintToJsonNumberString(holdInv.parts),
          repair_kits: bigintToJsonNumberString(holdInv.repair_kits),
        },
        storage: {
          warehouseCap: bigintToJsonNumberString(wh?.cap ?? 0n),
          warehouseUsed: bigintToJsonNumberString(invUsed(whInv)),
          holdCap: bigintToJsonNumberString(state.storage.shipHold.cap),
          holdUsed: bigintToJsonNumberString(invUsed(holdInv)),
        },
        unlocks: state.unlocks,
        politics: {
          affiliationFlagId: state.politics.affiliationFlagId,
          influenceByFlagId: { ...state.politics.influenceByFlagId },
          standingByFlagId,
          campaign: {
            status: state.politics.campaign.status,
            kind: state.politics.campaign.kind,
            portId: state.politics.campaign.portId,
            controllerFlagId: state.politics.campaign.controllerFlagId,
            remainingMs: state.politics.campaign.remainingMs,
            durationMs: state.politics.campaign.durationMs,
            goldPaid: bigintToJsonNumberString(state.politics.campaign.goldPaid),
            influenceSpent: state.politics.campaign.influenceSpent,
          },
          portPerksByIslandId: { ...state.politics.portPerksByIslandId },
          currentPort: {
            id: portId,
            controllerFlagId,
            baseTaxBps,
            effectiveTaxBps,
            perkDiscountBps,
          },
        },
        economy: {
          contractSlots,
          contracts: state.economy.contracts.map((c) => ({
            id: c.id,
            portId: c.portId,
            commodityId: c.commodityId,
            qty: bigintToJsonNumberString(c.qty),
            bidPrice: bigintToJsonNumberString(c.bidPrice),
            feePaid: bigintToJsonNumberString(c.feePaid),
            filledQty: bigintToJsonNumberString(c.filledQty),
            collectedQty: bigintToJsonNumberString(c.collectedQty),
            status: c.status,
          })),
        },
        production: { jobs: { ...state.production.jobs } },
        voyage: {
          status: state.voyage.status,
          routeId: state.voyage.routeId,
          fromIslandId: state.voyage.fromIslandId,
          toIslandId: state.voyage.toIslandId,
          availableRoutes: ROUTES.filter((r) => r.fromIslandId === portId && state.unlocks.includes(`route:${r.id}`)).map((r) => r.id),
          remainingMs: state.voyage.remainingMs,
          durationMs: state.voyage.durationMs,
          pendingGold: bigintToJsonNumberString(state.voyage.pendingGold),
          pendingInfluence: state.voyage.pendingInfluence,
          encounters: state.voyage.encounters.map((e) => ({
            atMs: e.atMs,
            cannonballsCost: e.cannonballsCost,
            status: e.status,
          })),
        },
        minigames: {
          cannon: {
            status: state.minigames.cannon.status,
            elapsedMs: state.minigames.cannon.elapsedMs,
            durationMs: state.minigames.cannon.durationMs,
            hits: state.minigames.cannon.hits,
            shots: state.minigames.cannon.shots,
          },
          rigging: {
            status: state.minigames.rigging.status,
            elapsedMs: state.minigames.rigging.elapsedMs,
            durationMs: state.minigames.rigging.durationMs,
            zoneStartPermille: state.minigames.rigging.zoneStartPermille,
            tugs: state.minigames.rigging.tugs,
            goodTugs: state.minigames.rigging.goodTugs,
          },
        },
        buffs: state.buffs.map((b) => ({ id: b.id, remainingMs: b.remainingMs, powerBps: b.powerBps })),
      };
      return JSON.stringify(view);
    },
    exportSave() {
      const isAutomation = typeof navigator !== "undefined" && !!navigator.webdriver;
      const wallClockMs = isAutomation ? 0 : Date.now();
      return JSON.stringify({
        version: IDLE_API_VERSION,
        client: { wallClockMs },
        rng: state.rng,
        state: serializeStateForSave(state),
      });
    },
    importSave(save) {
      const parsed = parseSavePayload(save);
      offlineCatchupReport = null;
      let next = deserializeStateFromSave(parsed.state, parsed.rng);

      const isAutomation = typeof navigator !== "undefined" && !!navigator.webdriver;
      const wallClockMs = parsed.client.wallClockMs;
      if (!isAutomation && next.mode !== "title" && wallClockMs > 0) {
        const now = Date.now();
        const wallClockDeltaMs = Math.max(0, now - wallClockMs);
        const capMs = 24 * 60 * 60 * 1000;
        const appliedMs = Math.min(wallClockDeltaMs, capMs);
        if (appliedMs > 0) {
          const goldBefore = next.resources.gold;
          next = advance(next, appliedMs);
          const goldGained = next.resources.gold - goldBefore;
          offlineCatchupReport = {
            wallClockDeltaMs,
            appliedMs,
            capMs,
            wasCapped: wallClockDeltaMs > capMs,
            goldGained: goldGained.toString(10),
          };
        }
      }

      state = next;
      emit();
    },
    hardReset() {
      state = makeInitialState(seed);
      offlineCatchupReport = null;
      debugSeq = 0;
      debugLog = [];
      lastQualityUi = DEFAULT_QUALITY_UI;
      lastUnlockDeltaModules = 0;
      lastUnlockDeltaInteractives = 0;
      lastUnlockDeltaUnlockCount = 0;
      emit();
    },
    setSeed(nextSeed) {
      const s = Number.isFinite(nextSeed) ? Math.trunc(nextSeed) : 1;
      seed = s === 0 ? 1 : s;
    },
  };

  return store;
}

export function parseBigintFromUi(value: string): bigint | null {
  return parseNonNegIntLike(value);
}
