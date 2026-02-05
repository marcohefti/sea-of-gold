import {
  CHART_BY_ID,
  FLAG_BY_ID,
  FLAGS,
  ISLAND_BY_ID,
  ISLANDS,
  RECIPE_BY_ID,
  ROUTE_BY_ID,
  SHIP_CLASS_BY_ID,
  VANITY_BY_ID,
  clampInt,
} from "@sea-of-gold/shared";
import type { GameAction } from "./actions";
import type {
  AutomationState,
  BuffState,
  CommodityId,
  ContractState,
  FactionStanding,
  FleetShipState,
  GameState,
  Inventory,
  PoliticsCampaignState,
  PortPerkState,
  VoyageEncounterState,
  WarehouseState,
} from "./model";
import { rngFromSeed, rngNextFloat01, rngNextUint32 } from "./rng";

const FIXED_STEP_MS = 100;
const DOCK_GOLD_PER_SEC = 1n;
const CONTRACT_UNIT_INTERVAL_MS = 1000;
const CONTRACT_MAX_ACTIVE_PER_PORT = 4;
const CONTRACT_BID_PREMIUM_DIVISOR = 10n; // extra fee = floor(qty * max(0, bid-1) / divisor)
const CANNON_DURATION_MS = 20_000;
const CANNON_BUFF_MS = 5 * 60_000;
const RIGGING_DURATION_MS = 30_000;
const RIGGING_BUFF_MS = 5 * 60_000;
const MINIGAME_REFRESH_WINDOW_MS = 60_000;
const RIGGING_CYCLE_MS = 1200;
const RIGGING_ZONE_WIDTH_PERMILLE = 200; // 20%
const RIGGING_RUM_EFFICIENCY_PCT = 25; // -25% baseline rum usage on voyages
const RIGGING_SPEED_BONUS_PCT = 10; // +10% voyage speed when rigging_run is active (applies on voyage start)
const DEFAULT_SHIP_SPEED_PCT = 100;
const VANITY_WAREHOUSE_SIGNAGE_CAP_BONUS = 20n;
const VANITY_SHIP_FIGUREHEAD_CONDITION_BONUS = 10;
const VANITY_CAPTAIN_BANNER_VOYAGE_GOLD_BONUS_PCT = 5;
const FLAGSHIP_VOYAGE_GOLD_BONUS_PCT = 20;
const VOYAGE_BONUS_SOFTCAP_START_PCT = 40;
const VOYAGE_BONUS_SOFTCAP_DIVISOR = 2; // each +2% beyond softcap counts as +1%
const FLAGSHIP_CONTRIBUTE_GOLD = 200n;
const FLAGSHIP_CONTRIBUTE_COSMETICS = 5n;
const CONQUEST_STAGE_MS = 60_000;
const CONQUEST_DURATION_MS = 3 * CONQUEST_STAGE_MS;
const CONQUEST_WARCHEST_GOLD_PER_TIER = 200n;
const CONQUEST_INFLUENCE_PER_TIER = 20;
const SHIPYARD_MAX_LEVEL = 4;
const SHIPYARD_UPGRADE_GOLD_PER_LEVEL = 300n;
const STARTING_WAREHOUSE_CAP = 50n;
const WAREHOUSE_UPGRADE_COST = 100n;
const WAREHOUSE_UPGRADE_BONUS = 50n;
const SHIP_MAX_CONDITION = 100;
const SHIP_WEAR_PER_MINUTE = 4;
const SHIP_REPAIR_GOLD_COST = 50n;
const SHIP_REPAIR_CONDITION = 20;
const SHIP_REPAIR_KIT_CONDITION = 50;
const ENCOUNTER_FAIL_CONDITION = 5;
const ENCOUNTER_FAIL_GOLD_PENALTY_PCT = 10;
const CREW_HIRE_COST_GOLD = 25n;
const CREW_WAGE_PER_CREW_PER_MIN = 1n;
const TIER_FEE_BPS_PER_TIER = 500; // +5% per tier above 1
const DONATION_GOLD_PER_INFLUENCE = 10n; // 10g => +1 influence
const TAX_RELIEF_REQUIRED_INFLUENCE = 5;
const TAX_RELIEF_GOLD_COST_PER_TIER = 50n;
const TAX_RELIEF_CAMPAIGN_DURATION_MS = 60_000;
const TAX_RELIEF_PERK_DURATION_MS = 10 * 60_000;
const TAX_RELIEF_TAX_DISCOUNT_BPS = 200;
const TUTORIAL_STEP_DOCK_INTRO = "tut:dock_intro";
const TUTORIAL_STEP_ECONOMY_INTRO = "tut:economy_intro";
const TUTORIAL_STEP_PORT_CORE = "tut:port_core";
const DOCK_WORK_DURATION_MS = 5000;
const DOCK_WORK_REWARD_GOLD = 5n;
const DOCK_WORK_IMMEDIATE_GOLD = 1n;
const DOCK_WORK_COMPLETION_GOLD = DOCK_WORK_REWARD_GOLD - DOCK_WORK_IMMEDIATE_GOLD;
const DOCK_WORK_HUSTLE_REDUCE_MS = 500; // click during a shift to reduce remaining time (min 1ms; reward remains time-based)
const DOCK_AUTOMATE_COST_GOLD = 30n;

const CHART_LOCKED_ROUTE_IDS = new Set(Object.values(CHART_BY_ID).map((c) => c.routeId));

function addUnlockIds(unlocks: string[], ids: string[]): string[] {
  if (ids.length === 0) return unlocks;
  const seen = new Set(unlocks);
  let changed = false;
  const next = [...unlocks];
  for (const id of ids) {
    if (seen.has(id)) continue;
    next.push(id);
    seen.add(id);
    changed = true;
  }
  return changed ? next : unlocks;
}

function unlockRoutesForPort(unlocks: string[], portId: string): string[] {
  const ids: string[] = [];
  for (const rt of Object.values(ROUTE_BY_ID)) {
    if (rt.fromIslandId !== portId) continue;
    if (CHART_LOCKED_ROUTE_IDS.has(rt.id)) continue;
    ids.push(`route:${rt.id}`);
  }
  ids.sort();
  return addUnlockIds(unlocks, ids);
}

function applyVoyageCollectUnlocks(unlocks: string[], routeId: string, arrivalPortId: string): string[] {
  let next = unlockRoutesForPort(unlocks, arrivalPortId);
  if (routeId === "starter_run") {
    next = addUnlockIds(next, ["minigame:rigging", "recipe:forge_cannonballs"]);
  }
  return next;
}

function hasBuff(state: GameState, id: string): BuffState | undefined {
  return state.buffs.find((b) => b.id === id);
}

function getBuffRemainingMs(state: GameState, id: string): number {
  const b = hasBuff(state, id);
  return b ? b.remainingMs : 0;
}

function getBuffPowerBps(state: GameState, id: string, fallbackBps: number): number {
  const b = hasBuff(state, id);
  if (!b) return clampInt(Math.trunc(fallbackBps), 0, 100_000);
  if (typeof b.powerBps !== "number") return clampInt(Math.trunc(fallbackBps), 0, 100_000);
  return clampInt(Math.trunc(b.powerBps), 0, 100_000);
}

function getPermanentVoyageGoldBonusPct(state: GameState): number {
  let pct = 0;
  if (state.unlocks.includes("vanity:captain_banner")) pct += VANITY_CAPTAIN_BANNER_VOYAGE_GOLD_BONUS_PCT;
  if (state.unlocks.includes("flagship_built")) pct += FLAGSHIP_VOYAGE_GOLD_BONUS_PCT;
  return pct;
}

function softcapVoyageBonusPct(extraPctRaw: number): number {
  const extraPct = clampInt(Math.trunc(extraPctRaw), 0, 10_000);
  if (extraPct <= VOYAGE_BONUS_SOFTCAP_START_PCT) return extraPct;
  const over = extraPct - VOYAGE_BONUS_SOFTCAP_START_PCT;
  const softened = Math.floor(over / VOYAGE_BONUS_SOFTCAP_DIVISOR);
  return VOYAGE_BONUS_SOFTCAP_START_PCT + softened;
}

function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  if (a <= 0n) return 0n;
  return (a + b - 1n) / b;
}

function getPortControllerFlagId(state: GameState, portId: string): string {
  return state.world.controllerByIslandId[portId] ?? ISLAND_BY_ID[portId]?.controllerFlagId ?? "player";
}

function getEffectivePortTaxBps(state: GameState, portId: string): number {
  const controllerFlagId = getPortControllerFlagId(state, portId);
  const baseTaxBps = FLAG_BY_ID[controllerFlagId]?.taxBps ?? 0;
  if (baseTaxBps <= 0) return 0;

  let taxBps = baseTaxBps;

  // Affiliation discount: only applies at ports controlled by your affiliated flag.
  if (state.politics.affiliationFlagId === controllerFlagId) {
    const influence = state.politics.influenceByFlagId[controllerFlagId] ?? 0;
    const discountBps = Math.floor(influence / 10) * 100; // 10 influence => -1% tax
    taxBps -= discountBps;
  }

  // Port perk discount: applies regardless of affiliation.
  const perk = state.politics.portPerksByIslandId[portId];
  if (perk && perk.id === "tax_relief" && perk.remainingMs > 0) taxBps -= perk.taxDiscountBps;

  return Math.max(0, taxBps);
}

function computeContractPlacementFee(state: GameState, qty: bigint, bidPrice: bigint): bigint {
  const portId = state.location.islandId;
  const tier = ISLAND_BY_ID[portId]?.tier ?? 1;
  const tierBps = 10_000 + Math.max(0, tier - 1) * TIER_FEE_BPS_PER_TIER;
  const taxBps = getEffectivePortTaxBps(state, portId);

  const bid = bidPrice <= 1n ? 0n : bidPrice - 1n;
  const bidPremium = CONTRACT_BID_PREMIUM_DIVISOR <= 0n ? 0n : (qty * bid) / CONTRACT_BID_PREMIUM_DIVISOR;
  const base = qty + bidPremium; // 1g per unit (+ bid premium)
  const withTier = ceilDiv(base * BigInt(tierBps), 10_000n);
  const withTax = ceilDiv(withTier * BigInt(10_000 + taxBps), 10_000n);
  return withTax;
}

export function getEffectivePortTaxBpsForUi(state: GameState, portId: string): number {
  return getEffectivePortTaxBps(state, portId);
}

export function getContractPlacementFeeForUi(state: GameState, qty: bigint): bigint {
  return computeContractPlacementFee(state, qty, 1n);
}

export function getContractPlacementFeeForUiWithBid(state: GameState, qty: bigint, bidPrice: bigint): bigint {
  return computeContractPlacementFee(state, qty, bidPrice);
}

export function getContractMaxActivePerPortForUi(): number {
  return CONTRACT_MAX_ACTIVE_PER_PORT;
}

export function getActiveContractCountForPortForUi(state: GameState, portId: string): number {
  return state.economy.contracts.filter((c) => c.portId === portId && (c.status === "open" || c.status === "filled")).length;
}

export function getDockGoldPerSecForUi(): bigint {
  return DOCK_GOLD_PER_SEC;
}

export function getDockWorkDurationMsForUi(): number {
  return DOCK_WORK_DURATION_MS;
}

export function getDockWorkHustleReduceMsForUi(): number {
  return DOCK_WORK_HUSTLE_REDUCE_MS;
}

export function getDockPassiveGoldPerSecForUi(state: GameState): bigint {
  return state.dock.passiveEnabled ? DOCK_GOLD_PER_SEC : 0n;
}

export function getDockAutomateCostGoldForUi(): bigint {
  return DOCK_AUTOMATE_COST_GOLD;
}

export function getTutorialStepIdForUi(state: GameState): string {
  return state.tutorial.stepId;
}

export function isDockWorkManualAvailableForUi(state: GameState): boolean {
  return state.mode === "port";
}

export function getCrewHireCostGoldForUi(): bigint {
  return CREW_HIRE_COST_GOLD;
}

export function getCrewWageGoldPerCrewPerMinForUi(): bigint {
  return CREW_WAGE_PER_CREW_PER_MIN;
}

export function getDonationGoldPerInfluenceForUi(): bigint {
  return DONATION_GOLD_PER_INFLUENCE;
}

export function getTaxReliefCampaignForUi(portId: string): {
  requiredInfluence: number;
  goldCost: bigint;
  durationMs: number;
  perkDurationMs: number;
  taxDiscountBps: number;
} {
  const tier = ISLAND_BY_ID[portId]?.tier ?? 1;
  return {
    requiredInfluence: TAX_RELIEF_REQUIRED_INFLUENCE,
    goldCost: BigInt(tier) * TAX_RELIEF_GOLD_COST_PER_TIER,
    durationMs: TAX_RELIEF_CAMPAIGN_DURATION_MS,
    perkDurationMs: TAX_RELIEF_PERK_DURATION_MS,
    taxDiscountBps: TAX_RELIEF_TAX_DISCOUNT_BPS,
  };
}

export function getFactionStandingForUi(state: GameState, flagId: string): FactionStanding {
  if (flagId === "player") return "friendly";
  const inf = state.politics.influenceByFlagId[flagId] ?? 0;
  if (state.politics.affiliationFlagId === flagId) return "friendly";

  const affiliationPenalty =
    state.politics.affiliationFlagId !== "player" && state.politics.affiliationFlagId !== flagId ? 10 : 0;
  const score = inf - affiliationPenalty;
  if (score >= 10) return "friendly";
  if (score >= 0) return "neutral";
  return "hostile";
}

export function getNextGoalsForUi(state: GameState): string[] {
  if (state.mode !== "port") return [];

  const goals: string[] = [];
  const unlocks = new Set(state.unlocks);

  if (!unlocks.has("crew")) {
    goals.push("Unlock Crew: reach 25 gold.");
  } else if (state.crew.hired <= 0) {
    goals.push("Hire 1–2 crew (wages are a sink; watch your net gold/min).");
  }

  if (!unlocks.has("voyage")) {
    goals.push("Unlock Voyages: produce any Rum (contracts → distillery).");
  } else {
    const starterUnlocked = unlocks.has("route:starter_run");
    const moreRoutesUnlocked = unlocks.has("route:home_to_haven");
    if (starterUnlocked && !moreRoutesUnlocked) {
      const req = getVoyageStartRequirements(state, state.ship.classId, "starter_run");
      const needRum = req?.totalRum ?? 6n;
      const holdRum = state.storage.shipHold.inv.rum;
      const wh = getWarehouse(state, state.location.islandId);
      const whRum = wh ? wh.inv.rum : 0n;

      if (state.voyage.status === "completed") {
        goals.push("Collect your completed voyage to unlock more routes.");
      } else if (state.voyage.status === "running") {
        goals.push("Run a minigame during the voyage to boost rewards.");
      } else if (holdRum < needRum) {
        if (whRum > 0n) goals.push(`Load Rum into your hold (need ${needRum.toString(10)} total).`);
        else goals.push("Distill Rum, then load it into your hold.");
      } else {
        goals.push("Start and complete the Starter Run voyage to unlock more routes.");
      }
    }
  }

  if (!unlocks.has("politics")) {
    goals.push("Unlock Politics: reach 100 gold or complete Starter Run.");
  } else if (!unlocks.has("vanity_shop")) {
    goals.push("Pick a flag and donate to reach 10+ influence (unlocks Vanity Shop + cosmetics chain).");
  }

  if (state.fleet.maxShips < 3) {
    goals.push("Upgrade the shipyard to increase fleet capacity.");
  }

  if (!unlocks.has("flagship_built")) {
    goals.push("Build your flagship (3 contributions) for a permanent voyage gold bonus.");
  }

  return goals.slice(0, 5);
}

export function getWarehouseUpgradeForUi(): { costGold: bigint; capBonus: bigint } {
  return { costGold: WAREHOUSE_UPGRADE_COST, capBonus: WAREHOUSE_UPGRADE_BONUS };
}

export function getShipRepairForUi(): { goldCost: bigint; goldRepairCondition: number; kitRepairCondition: number } {
  return {
    goldCost: SHIP_REPAIR_GOLD_COST,
    goldRepairCondition: SHIP_REPAIR_CONDITION,
    kitRepairCondition: SHIP_REPAIR_KIT_CONDITION,
  };
}

export function getShipyardMaxLevelForUi(): number {
  return SHIPYARD_MAX_LEVEL;
}

export function getShipyardUpgradeCostForUi(nextLevelRaw: number): bigint {
  const nextLevel = clampInt(Math.trunc(nextLevelRaw), 1, SHIPYARD_MAX_LEVEL);
  return BigInt(nextLevel) * SHIPYARD_UPGRADE_GOLD_PER_LEVEL;
}

export function getChartCostGoldForUi(chartId: string): bigint {
  const def = CHART_BY_ID[chartId];
  if (!def) return 0n;
  return BigInt(def.costGold);
}

export function getFlagshipForUi(): {
  contributeGold: bigint;
  contributeCosmetics: bigint;
  voyageGoldBonusPct: number;
} {
  return {
    contributeGold: FLAGSHIP_CONTRIBUTE_GOLD,
    contributeCosmetics: FLAGSHIP_CONTRIBUTE_COSMETICS,
    voyageGoldBonusPct: FLAGSHIP_VOYAGE_GOLD_BONUS_PCT,
  };
}

export function getConquestRequirementsForUi(tierRaw: number): {
  requiredInfluence: number;
  warChestGold: bigint;
  durationMs: number;
  stageMs: number;
} {
  const tier = Math.max(1, Math.trunc(tierRaw));
  return {
    requiredInfluence: tier * CONQUEST_INFLUENCE_PER_TIER,
    warChestGold: BigInt(tier) * CONQUEST_WARCHEST_GOLD_PER_TIER,
    durationMs: CONQUEST_DURATION_MS,
    stageMs: CONQUEST_STAGE_MS,
  };
}

export function getCannonVolleyUiForUi(elapsedMsRaw: number): { cycleMs: number; phasePct: number; inZone: boolean } {
  const elapsedMs = Math.max(0, Math.trunc(elapsedMsRaw));
  const cycleMs = 1000;
  const phase = (elapsedMs % cycleMs) / cycleMs;
  const inZone = phase >= 0.4 && phase <= 0.6;
  return { cycleMs, phasePct: Math.round(phase * 100), inZone };
}

export function getCannonVolleyDurationMsForUi(): number {
  return CANNON_DURATION_MS;
}

export function getCannonVolleyRefreshWindowMsForUi(): number {
  return MINIGAME_REFRESH_WINDOW_MS;
}

export function getRiggingRunUiForUi(elapsedMsRaw: number, zoneStartPermilleRaw: number): {
  cycleMs: number;
  widthPermille: number;
  phasePermille: number;
  inZone: boolean;
  zoneEndPermille: number;
} {
  const elapsedMs = Math.max(0, Math.trunc(elapsedMsRaw));
  const zoneStartPermille = Math.max(0, Math.trunc(zoneStartPermilleRaw));
  const cycleMs = RIGGING_CYCLE_MS;
  const widthPermille = RIGGING_ZONE_WIDTH_PERMILLE;
  const phasePermille = Math.floor(((elapsedMs % cycleMs) * 1000) / cycleMs);
  const zoneEndPermille = zoneStartPermille + widthPermille;
  const inZone = phasePermille >= zoneStartPermille && phasePermille <= zoneEndPermille;
  return { cycleMs, widthPermille, phasePermille, inZone, zoneEndPermille };
}

export function getRiggingRunDurationMsForUi(): number {
  return RIGGING_DURATION_MS;
}

export function getRiggingRunRefreshWindowMsForUi(): number {
  return MINIGAME_REFRESH_WINDOW_MS;
}

export function getRiggingRunRumEfficiencyPctForUi(): number {
  return RIGGING_RUM_EFFICIENCY_PCT;
}

export function getPortGoldFlowPerMinForUi(state: GameState): {
  crewTotal: number;
  dockGoldPerMin: bigint;
  wagesGoldPerMin: bigint;
  netGoldPerMin: bigint;
} {
  const crewTotal = state.crew.hired + state.fleet.ships.reduce((acc, s) => acc + s.crew.hired, 0);
  const dockGoldPerMin = getDockPassiveGoldPerSecForUi(state) * 60n;
  const wagesGoldPerMin = BigInt(crewTotal) * CREW_WAGE_PER_CREW_PER_MIN;
  return { crewTotal, dockGoldPerMin, wagesGoldPerMin, netGoldPerMin: dockGoldPerMin - wagesGoldPerMin };
}

function collectContractInPlace(state: GameState, contractId: string): { state: GameState; changed: boolean } {
  const idx = state.economy.contracts.findIndex((c) => c.id === contractId);
  if (idx === -1) return { state, changed: false };
  const c = state.economy.contracts[idx];
  if (c.status === "canceled" || c.status === "collected") return { state, changed: false };
  if (state.location.islandId !== c.portId) return { state, changed: false };

  const available = c.filledQty - c.collectedQty;
  if (available <= 0n) return { state, changed: false };

  const wh = getWarehouse(state, c.portId);
  if (!wh) return { state, changed: false };
  const used = invUsed(wh.inv);
  const free = wh.cap - used;
  const take = free <= 0n ? 0n : available <= free ? available : free;
  if (take <= 0n) return { state, changed: false };

  const nextCollected = c.collectedQty + take >= c.qty ? c.qty : c.collectedQty + take;
  const nextStatus: ContractState["status"] =
    nextCollected >= c.qty ? "collected" : c.filledQty >= c.qty ? "filled" : "open";

  const nextContracts = state.economy.contracts.slice();
  nextContracts[idx] = { ...c, collectedQty: nextCollected, status: nextStatus };

  const nextWh: WarehouseState = {
    ...wh,
    inv: { ...wh.inv, [c.commodityId]: wh.inv[c.commodityId] + take },
  };
  let nextState: GameState = setWarehouse(state, c.portId, nextWh);
  nextState = { ...nextState, economy: { ...nextState.economy, contracts: nextContracts } };

  // Trade influence: collecting goods builds influence with the current controller of this port.
  // Smallest slice: +1 influence per 20 units collected (floored).
  const controllerFlagId = getPortControllerFlagId(nextState, c.portId);
  const gain = take / 20n;
  if (gain > 0n) {
    const gainN = Number(gain);
    const nextInfluenceByFlagId = {
      ...nextState.politics.influenceByFlagId,
      [controllerFlagId]: (nextState.politics.influenceByFlagId[controllerFlagId] ?? 0) + gainN,
    };
    nextState = { ...nextState, politics: { ...nextState.politics, influenceByFlagId: nextInfluenceByFlagId } };
    nextState = maybeUnlockCosmeticsChain(nextState);
  }

  return { state: nextState, changed: true };
}

function maybeUnlockCosmeticsChain(state: GameState): GameState {
  if (state.unlocks.includes("recipe:brew_dye")) return state;
  const aff = state.politics.affiliationFlagId;
  const inf = state.politics.influenceByFlagId[aff] ?? 0;
  if (inf < 10) return state;
  return {
    ...state,
    unlocks: [...state.unlocks, "recipe:brew_dye", "recipe:weave_cloth", "recipe:tailor_cosmetics", "vanity_shop"],
  };
}

function makeEmptyInventory(): Inventory {
  return {
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
}

export function invUsed(inv: Inventory): bigint {
  return (
    inv.wood +
    inv.sugar +
    inv.iron +
    inv.stone +
    inv.hemp +
    inv.herbs +
    inv.rum +
    inv.dye +
    inv.cloth +
    inv.cosmetics +
    inv.cannonballs +
    inv.parts +
    inv.repair_kits
  );
}

function getWarehouse(state: GameState, portId: string): WarehouseState {
  return state.storage.warehouses[portId];
}

function setWarehouse(state: GameState, portId: string, wh: WarehouseState): GameState {
  return { ...state, storage: { ...state.storage, warehouses: { ...state.storage.warehouses, [portId]: wh } } };
}

function makeInitialWarehouses(): Record<string, WarehouseState> {
  const out: Record<string, WarehouseState> = {};
  for (const island of ISLANDS) {
    out[island.id] = { cap: STARTING_WAREHOUSE_CAP, inv: makeEmptyInventory() };
  }
  return out;
}

function makeInitialSpawnAcc(): Record<string, Record<CommodityId, number>> {
  const zero: Record<CommodityId, number> = {
    wood: 0,
    sugar: 0,
    iron: 0,
    stone: 0,
    hemp: 0,
    herbs: 0,
    rum: 0,
    dye: 0,
    cloth: 0,
    cosmetics: 0,
    cannonballs: 0,
    parts: 0,
    repair_kits: 0,
  };
  const out: Record<string, Record<CommodityId, number>> = {};
  for (const island of ISLANDS) {
    out[island.id] = { ...zero };
  }
  return out;
}

function makeInitialProductionJobs(): GameState["production"]["jobs"] {
  return {
    distill_rum: { enabled: true, remainderMs: 0 },
    forge_cannonballs: { enabled: false, remainderMs: 0 },
    craft_parts: { enabled: false, remainderMs: 0 },
    assemble_repair_kits: { enabled: false, remainderMs: 0 },
    brew_dye: { enabled: false, remainderMs: 0 },
    weave_cloth: { enabled: false, remainderMs: 0 },
    tailor_cosmetics: { enabled: false, remainderMs: 0 },
  };
}

function makeInitialInfluenceByFlagId(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of FLAGS) out[f.id] = 0;
  return out;
}

function makeInitialPoliticsCampaign(): PoliticsCampaignState {
  return {
    status: "idle",
    kind: "tax_relief",
    portId: null,
    controllerFlagId: null,
    remainingMs: 0,
    durationMs: 0,
    goldPaid: 0n,
    influenceSpent: 0,
  };
}

function makeInitialWorldControllers(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const island of ISLANDS) out[island.id] = island.controllerFlagId;
  return out;
}

export function isCommodityId(v: string): v is CommodityId {
  return (
    v === "wood" ||
    v === "sugar" ||
    v === "iron" ||
    v === "stone" ||
    v === "hemp" ||
    v === "herbs" ||
    v === "rum" ||
    v === "dye" ||
    v === "cloth" ||
    v === "cosmetics" ||
    v === "cannonballs" ||
    v === "parts" ||
    v === "repair_kits"
  );
}

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seedForVoyage(seed: number, routeId: string, voyageIndex: number): number {
  const a = seed >>> 0;
  const b = fnv1a32(routeId);
  const c = Math.imul(voyageIndex >>> 0, 0x9e3779b9) >>> 0;
  const mixed = (a ^ b ^ c) >>> 0;
  return mixed || 1;
}

function makeVoyageEncounters({
  seed,
  routeId,
  voyageIndex,
  durationMs,
}: {
  seed: number;
  routeId: string;
  voyageIndex: number;
  durationMs: number;
}): VoyageEncounterState[] {
  // Keep starter routes peaceful; later routes can roll 1–2 encounters.
  if (routeId === "starter_run" || routeId === "turtle_to_home") return [];

  const vrngSeed = seedForVoyage(seed, routeId, voyageIndex);
  let vrng = rngFromSeed(vrngSeed);

  const maxEncounters = Math.max(1, Math.floor(durationMs / 45_000));
  const [u0, vrng1] = rngNextUint32(vrng);
  vrng = vrng1;
  const count = 1 + (u0 % maxEncounters);

  const encounters: VoyageEncounterState[] = [];
  for (let i = 0; i < count; i++) {
    const [f, vrng2] = rngNextFloat01(vrng);
    vrng = vrng2;
    const atMs = Math.max(1000, Math.min(durationMs - 1000, Math.floor(durationMs * (0.25 + 0.6 * f))));

    const [uCost, vrng3] = rngNextUint32(vrng);
    vrng = vrng3;
    const cannonballsCost = 1 + (uCost % 2); // 1–2
    encounters.push({ atMs, cannonballsCost, status: "pending" });
  }

  // Sort by time (stable).
  encounters.sort((a, b) => (a.atMs === b.atMs ? a.cannonballsCost - b.cannonballsCost : a.atMs - b.atMs));
  return encounters;
}

function upsertBuff(state: GameState, buff: BuffState): GameState {
  const idx = state.buffs.findIndex((b) => b.id === buff.id);
  if (idx === -1) return { ...state, buffs: [...state.buffs, buff] };
  const existing = state.buffs[idx];
  const mergedPower = Math.max(existing.powerBps ?? 0, buff.powerBps ?? 0);
  const merged: BuffState = {
    id: buff.id,
    remainingMs: Math.max(existing.remainingMs, buff.remainingMs),
    powerBps: mergedPower > 0 ? mergedPower : undefined,
  };
  const next = state.buffs.slice();
  next[idx] = merged;
  return { ...state, buffs: next };
}

function tickBuffs(state: GameState, dtMs: number): GameState {
  if (state.buffs.length === 0) return state;
  const next = state.buffs
    .map((b) => ({ ...b, remainingMs: Math.max(0, b.remainingMs - dtMs) }))
    .filter((b) => b.remainingMs > 0);
  return { ...state, buffs: next };
}

function upsertPortPerk(state: GameState, portId: string, perk: PortPerkState): GameState {
  const existing = state.politics.portPerksByIslandId[portId];
  const merged: PortPerkState = existing
    ? {
        id: perk.id,
        remainingMs: Math.max(existing.remainingMs, perk.remainingMs),
        taxDiscountBps: Math.max(existing.taxDiscountBps, perk.taxDiscountBps),
      }
    : perk;
  return {
    ...state,
    politics: {
      ...state.politics,
      portPerksByIslandId: { ...state.politics.portPerksByIslandId, [portId]: merged },
    },
  };
}

function tickPoliticsPerks(state: GameState, dtMs: number): GameState {
  const perks = state.politics.portPerksByIslandId;
  const entries = Object.entries(perks);
  if (entries.length === 0) return state;

  let changed = false;
  const next: Record<string, PortPerkState> = {};
  for (const [portId, perk] of entries) {
    const remainingMs = Math.max(0, perk.remainingMs - dtMs);
    if (remainingMs > 0) {
      next[portId] = remainingMs === perk.remainingMs ? perk : { ...perk, remainingMs };
      if (remainingMs !== perk.remainingMs) changed = true;
    } else if (perk.remainingMs > 0) {
      changed = true;
    }
  }

  if (!changed) return state;
  return { ...state, politics: { ...state.politics, portPerksByIslandId: next } };
}

function tickPoliticsCampaign(state: GameState, dtMs: number): GameState {
  const c = state.politics.campaign;
  if (c.status !== "running") return state;
  const remainingMs = Math.max(0, c.remainingMs - dtMs);
  if (remainingMs > 0) {
    if (remainingMs === c.remainingMs) return state;
    return { ...state, politics: { ...state.politics, campaign: { ...c, remainingMs } } };
  }

  const portId = c.portId;
  const controllerFlagId = c.controllerFlagId;
  if (!portId || !controllerFlagId) {
    return { ...state, politics: { ...state.politics, campaign: { ...c, status: "fail", remainingMs: 0 } } };
  }

  const stillControlledBySame = getPortControllerFlagId(state, portId) === controllerFlagId;
  if (!stillControlledBySame) {
    return { ...state, politics: { ...state.politics, campaign: { ...c, status: "fail", remainingMs: 0 } } };
  }

  let next = state;
  if (c.kind === "tax_relief") {
    next = upsertPortPerk(next, portId, {
      id: "tax_relief",
      remainingMs: TAX_RELIEF_PERK_DURATION_MS,
      taxDiscountBps: TAX_RELIEF_TAX_DISCOUNT_BPS,
    });
  }

  return { ...next, politics: { ...next.politics, campaign: { ...c, status: "success", remainingMs: 0 } } };
}

function tickDockIncome(state: GameState, dtMs: number): GameState {
  if (state.mode !== "port") return state;
  if (!state.dock.passiveEnabled) {
    if (state.dock.incomeRemainderMs === 0) return state;
    return { ...state, dock: { ...state.dock, incomeRemainderMs: 0 } };
  }

  const total = state.dock.incomeRemainderMs + dtMs;
  const units = Math.floor(total / 1000);
  const rem = total % 1000;
  const goldGain = BigInt(units) * DOCK_GOLD_PER_SEC;
  if (units === 0) return { ...state, dock: { ...state.dock, incomeRemainderMs: rem } };
  return {
    ...state,
    resources: { ...state.resources, gold: state.resources.gold + goldGain },
    dock: { ...state.dock, incomeRemainderMs: rem },
  };
}

function tickDockWork(state: GameState, dtMs: number): GameState {
  if (state.mode !== "port") return state;
  if (state.dock.workRemainingMs <= 0) return state;
  const nextRemaining = Math.max(0, state.dock.workRemainingMs - dtMs);
  if (nextRemaining > 0) return { ...state, dock: { ...state.dock, workRemainingMs: nextRemaining } };
  return {
    ...state,
    resources: { ...state.resources, gold: state.resources.gold + DOCK_WORK_COMPLETION_GOLD },
    dock: { ...state.dock, workRemainingMs: 0 },
  };
}

function tickCrewWages(state: GameState, dtMs: number): GameState {
  if (state.mode !== "port") return state;

  const tickOne = (crew: GameState["crew"]) => {
    const hired = crew.hired;
    if (hired <= 0) return { crew, pay: 0n, changed: false };

    const total = crew.wagesRemainderMs + dtMs;
    const units = Math.floor(total / 60_000);
    const rem = total % 60_000;
    const pay = units <= 0 ? 0n : BigInt(units) * BigInt(hired) * CREW_WAGE_PER_CREW_PER_MIN;
    const nextCrew = rem === crew.wagesRemainderMs ? crew : { ...crew, wagesRemainderMs: rem };
    return { crew: nextCrew, pay, changed: nextCrew !== crew || pay !== 0n };
  };

  let payTotal = 0n;

  const activeTick = tickOne(state.crew);
  payTotal += activeTick.pay;

  let nextFleetShips = state.fleet.ships;
  let fleetChanged = false;
  if (state.fleet.ships.length > 0) {
    const updated: FleetShipState[] = [];
    for (const s of state.fleet.ships) {
      const t = tickOne(s.crew);
      payTotal += t.pay;
      if (t.changed) fleetChanged = true;
      updated.push(t.changed ? { ...s, crew: t.crew } : s);
    }
    if (fleetChanged) nextFleetShips = updated;
  }

  const nextGold = state.resources.gold >= payTotal ? state.resources.gold - payTotal : 0n;
  const goldChanged = nextGold !== state.resources.gold;
  const activeCrewChanged = activeTick.crew !== state.crew;
  if (!goldChanged && !activeCrewChanged && !fleetChanged) return state;

  return {
    ...state,
    resources: goldChanged ? { ...state.resources, gold: nextGold } : state.resources,
    crew: activeCrewChanged ? activeTick.crew : state.crew,
    fleet: fleetChanged ? { ...state.fleet, ships: nextFleetShips } : state.fleet,
  };
}

function nextContractId(state: GameState): string {
  return `c_${state.economy.contracts.length + 1}`;
}

function tickContracts(state: GameState, dtMs: number): GameState {
  let nextContracts = state.economy.contracts.slice();
  let nextSpawnAcc = state.economy.spawnAcc;
  let changed = false;

  for (const island of ISLANDS) {
    const portId = island.id;
    const prevPortAcc = nextSpawnAcc[portId];
    let portAcc = prevPortAcc;
    let portAccChanged = false;

    for (const [commodityIdRaw, rate] of Object.entries(island.produces)) {
      if (rate <= 0) continue;
      if (!isCommodityId(commodityIdRaw)) continue;
      const commodityId = commodityIdRaw as CommodityId;

      const prevRem = portAcc?.[commodityId] ?? 0;
      const total = prevRem + dtMs * rate;
      const units = Math.floor(total / 60_000);
      const rem = total % 60_000;

      if (rem !== prevRem) {
        if (!portAccChanged) {
          portAcc = { ...(portAcc || makeInitialSpawnAcc()[portId]) };
          portAccChanged = true;
        }
        portAcc[commodityId] = rem;
      }

      if (units <= 0) continue;

      let supply = BigInt(units);
      const candidates: number[] = [];
      for (let i = 0; i < nextContracts.length; i++) {
        const c = nextContracts[i];
        if (c.status !== "open") continue;
        if (c.portId !== portId) continue;
        if (c.commodityId !== commodityId) continue;
        candidates.push(i);
      }
      if (candidates.length === 0) continue;

      candidates.sort((ia, ib) => {
        const a = nextContracts[ia];
        const b = nextContracts[ib];
        if (a.bidPrice !== b.bidPrice) return a.bidPrice > b.bidPrice ? -1 : 1;
        if (a.id === b.id) return 0;
        return a.id < b.id ? -1 : 1;
      });

      for (const idx of candidates) {
        if (supply <= 0n) break;
        const c = nextContracts[idx];
        const qtyLeft = c.qty - c.filledQty;
        if (qtyLeft <= 0n) {
          if (c.status !== "filled") {
            nextContracts[idx] = { ...c, status: "filled" };
            changed = true;
          }
          continue;
        }

        const add = qtyLeft < supply ? qtyLeft : supply;
        if (add <= 0n) continue;

        const nextFilled = c.filledQty + add;
        const nextStatus: ContractState["status"] = nextFilled >= c.qty ? "filled" : "open";
        supply -= add;
        nextContracts[idx] = { ...c, filledQty: nextFilled, status: nextStatus, fillRemainderMs: 0 };
        changed = true;
      }
    }

    if (portAccChanged) {
      if (nextSpawnAcc === state.economy.spawnAcc) nextSpawnAcc = { ...state.economy.spawnAcc };
      nextSpawnAcc[portId] = portAcc!;
      changed = true;
    }
  }

  if (!changed) return state;
  return { ...state, economy: { ...state.economy, contracts: nextContracts, spawnAcc: nextSpawnAcc } };
}

function tickProduction(state: GameState, dtMs: number): GameState {
  if (state.mode !== "port") return state;

  const portId = state.location.islandId;
  const wh = getWarehouse(state, portId);
  if (!wh) return state;

  let nextWh: WarehouseState = wh;
  let whChanged = false;
  let nextJobs = state.production.jobs;
  let jobsChanged = false;

  for (const [recipeId, job] of Object.entries(state.production.jobs)) {
    if (!job.enabled) continue;
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe) continue;

    const total = job.remainderMs + dtMs;
    const interval = recipe.intervalMs;
    const unitsTime = Math.floor(total / interval);
    let rem = total % interval;

    if (unitsTime <= 0) {
      if (rem !== job.remainderMs) {
        if (!jobsChanged) {
          nextJobs = { ...nextJobs };
          jobsChanged = true;
        }
        nextJobs[recipeId] = { ...job, remainderMs: rem };
      }
      continue;
    }

    let makeUnits = BigInt(unitsTime);

    for (const [inputId, qty] of Object.entries(recipe.input)) {
      if (!isCommodityId(inputId)) {
        makeUnits = 0n;
        break;
      }
      const req = BigInt(qty);
      const avail = nextWh.inv[inputId as CommodityId];
      const possible = avail / req;
      if (possible < makeUnits) makeUnits = possible;
      if (makeUnits <= 0n) break;
    }

    if (makeUnits > 0n) {
      let inputTotal = 0n;
      for (const qty of Object.values(recipe.input)) inputTotal += BigInt(qty);
      let outputTotal = 0n;
      for (const qty of Object.values(recipe.output)) outputTotal += BigInt(qty);
      const net = outputTotal - inputTotal;
      if (net > 0n) {
        const free = nextWh.cap - invUsed(nextWh.inv);
        const maxByCap = free / net;
        if (maxByCap < makeUnits) makeUnits = maxByCap;
      }
    }

    if (makeUnits <= 0n) {
      if (!jobsChanged) {
        nextJobs = { ...nextJobs };
        jobsChanged = true;
      }
      nextJobs[recipeId] = { ...job, remainderMs: rem };
      continue;
    }

    if (makeUnits < BigInt(unitsTime)) rem = 0;

    if (!whChanged) {
      nextWh = { ...nextWh, inv: { ...nextWh.inv } };
      whChanged = true;
    }

    for (const [inputId, qty] of Object.entries(recipe.input)) {
      if (!isCommodityId(inputId)) continue;
      const req = BigInt(qty) * makeUnits;
      nextWh.inv[inputId as CommodityId] = nextWh.inv[inputId as CommodityId] - req;
    }

    for (const [outputId, qty] of Object.entries(recipe.output)) {
      if (!isCommodityId(outputId)) continue;
      const add = BigInt(qty) * makeUnits;
      nextWh.inv[outputId as CommodityId] = nextWh.inv[outputId as CommodityId] + add;
    }

    if (!jobsChanged) {
      nextJobs = { ...nextJobs };
      jobsChanged = true;
    }
    nextJobs[recipeId] = { ...job, remainderMs: rem };
  }

  if (!whChanged && !jobsChanged) return state;
  const nextState = whChanged ? setWarehouse(state, portId, nextWh) : state;
  return jobsChanged ? { ...nextState, production: { jobs: nextJobs } } : nextState;
}

type ShipRuntimeState = {
  locationId: string;
  ship: GameState["ship"];
  crew: GameState["crew"];
  hold: GameState["storage"]["shipHold"];
  voyage: GameState["voyage"];
};

export function getVoyageStartRequirements(
  state: GameState,
  shipClassId: string,
  routeId: string
): { fareRum: bigint; baselineRum: bigint; totalRum: bigint; expectedCannonballs: bigint } | null {
  const route = ROUTE_BY_ID[routeId];
  if (!route) return null;

  const shipDef = SHIP_CLASS_BY_ID[shipClassId];
  const rumPerMinute = shipDef?.rumPerMinute ?? 0;
  const durationMs = getVoyageDurationMsForUi(state, shipClassId, routeId);
  const rigging = hasBuff(state, "rigging_run");
  const rumEfficiencyPct = rigging ? RIGGING_RUM_EFFICIENCY_PCT : 0;
  const baselineRum0 = Math.floor((durationMs * rumPerMinute) / 60_000);
  const baselineRumN = rumEfficiencyPct > 0 ? Math.floor((baselineRum0 * (100 - rumEfficiencyPct)) / 100) : baselineRum0;

  const fareRum = BigInt(route.rumCost);
  const baselineRum = BigInt(Math.max(0, baselineRumN));
  const totalRum = fareRum + baselineRum;

  const voyageIndex = state.stats.voyagesStarted + 1;
  const encounters = makeVoyageEncounters({
    seed: state.settings.seed,
    routeId: route.id,
    voyageIndex,
    durationMs,
  });
  const expectedCannonballs = BigInt(encounters.reduce((acc, e) => acc + e.cannonballsCost, 0));

  return { fareRum, baselineRum, totalRum, expectedCannonballs };
}

export function getShipSpeedPctForUi(shipClassId: string): number {
  const def = SHIP_CLASS_BY_ID[shipClassId];
  const speedPct = def?.speedPct ?? DEFAULT_SHIP_SPEED_PCT;
  return clampInt(Math.trunc(speedPct), 50, 200);
}

export function getVoyageDurationMsForUi(_state: GameState, shipClassId: string, routeId: string): number {
  const route = ROUTE_BY_ID[routeId];
  if (!route) return 0;
  const shipSpeedPct0 = getShipSpeedPctForUi(shipClassId);
  const rigging = hasBuff(_state, "rigging_run");
  const shipSpeedPct = rigging ? Math.floor((shipSpeedPct0 * (100 + RIGGING_SPEED_BONUS_PCT)) / 100) : shipSpeedPct0;
  // Integer-safe ceil(base * 100 / speedPct).
  const base = Math.max(1, Math.trunc(route.durationMs));
  return Math.max(1, Math.floor((base * 100 + shipSpeedPct - 1) / shipSpeedPct));
}

export function getRiggingRunSpeedBonusPctForUi(): number {
  return RIGGING_SPEED_BONUS_PCT;
}

function makeIdleVoyageState(): GameState["voyage"] {
  return {
    status: "idle",
    routeId: null,
    fromIslandId: null,
    toIslandId: null,
    remainingMs: 0,
    durationMs: 0,
    pendingGold: 0n,
    pendingInfluence: 0,
    encounters: [],
  };
}

function tickVoyageRuntime(state: GameState, rt: ShipRuntimeState, dtMs: number): ShipRuntimeState {
  const v = rt.voyage;
  if (v.status !== "running") return rt;
  if (!v.routeId) return { ...rt, voyage: makeIdleVoyageState() };

  const elapsedBefore = v.durationMs - v.remainingMs;
  const nextRemaining = Math.max(0, v.remainingMs - dtMs);
  const elapsedAfter = v.durationMs - nextRemaining;
  const shipDef = SHIP_CLASS_BY_ID[rt.ship.classId];
  const rumPerMinute = shipDef?.rumPerMinute ?? 0;
  const rigging = hasBuff(state, "rigging_run");
  const rumEfficiencyPct = rigging ? RIGGING_RUM_EFFICIENCY_PCT : 0;

  const wearBefore = Math.floor((elapsedBefore * SHIP_WEAR_PER_MINUTE) / 60_000);
  const wearAfter = Math.floor((elapsedAfter * SHIP_WEAR_PER_MINUTE) / 60_000);
  const wearDelta = Math.max(0, wearAfter - wearBefore);

  const rumBefore0 = Math.floor((elapsedBefore * rumPerMinute) / 60_000);
  const rumAfter0 = Math.floor((elapsedAfter * rumPerMinute) / 60_000);
  const rumBefore =
    rumEfficiencyPct > 0 ? Math.floor((rumBefore0 * (100 - rumEfficiencyPct)) / 100) : rumBefore0;
  const rumAfter =
    rumEfficiencyPct > 0 ? Math.floor((rumAfter0 * (100 - rumEfficiencyPct)) / 100) : rumAfter0;
  const rumDelta = Math.max(0, rumAfter - rumBefore);

  let nextCondition = wearDelta > 0 ? Math.max(0, rt.ship.condition - wearDelta) : rt.ship.condition;

  let nextHold = rt.hold;
  let nextHoldInv = nextHold.inv;
  let holdCopied = false;

  const ensureHoldCopy = () => {
    if (holdCopied) return;
    nextHoldInv = { ...nextHoldInv };
    nextHold = { ...nextHold, inv: nextHoldInv };
    holdCopied = true;
  };

  if (rumDelta > 0) {
    ensureHoldCopy();
    const cost = BigInt(rumDelta);
    nextHoldInv.rum = nextHoldInv.rum >= cost ? nextHoldInv.rum - cost : 0n;
  }

  let nextEncounters = v.encounters;
  let encountersCopied = false;
  const ensureEncountersCopy = () => {
    if (encountersCopied) return;
    nextEncounters = nextEncounters.slice();
    encountersCopied = true;
  };

  if (nextEncounters.length > 0) {
    for (let i = 0; i < nextEncounters.length; i++) {
      const e = nextEncounters[i];
      if (e.status !== "pending") continue;
      if (e.atMs > elapsedAfter) continue;

      const need = BigInt(e.cannonballsCost);
      if (need > 0n && nextHoldInv.cannonballs >= need) {
        ensureHoldCopy();
        nextHoldInv.cannonballs -= need;
        ensureEncountersCopy();
        nextEncounters[i] = { ...e, status: "success" };
      } else {
        // Failure: no hard-block. Spend what you have and take a small penalty.
        if (nextHoldInv.cannonballs > 0n) {
          ensureHoldCopy();
          nextHoldInv.cannonballs = 0n;
        }
        nextCondition = Math.max(0, nextCondition - ENCOUNTER_FAIL_CONDITION);
        ensureEncountersCopy();
        nextEncounters[i] = { ...e, status: "fail" };
      }
    }
  }

  const nextShip = nextCondition === rt.ship.condition ? rt.ship : { ...rt.ship, condition: nextCondition };
  const nextVoyageRunning =
    nextEncounters === v.encounters
      ? { ...v, remainingMs: nextRemaining }
      : { ...v, remainingMs: nextRemaining, encounters: nextEncounters };

  if (nextRemaining > 0) {
    if (nextShip === rt.ship && nextHold === rt.hold && nextVoyageRunning === v) return rt;
    return { ...rt, ship: nextShip, hold: nextHold, voyage: nextVoyageRunning };
  }

  const route = ROUTE_BY_ID[v.routeId];
  if (!route) return { ...rt, ship: nextShip, hold: nextHold, voyage: makeIdleVoyageState() };

  const cannon = hasBuff(state, "cannon_volley");
  const baseReward = BigInt(route.goldReward);
  const permPct = getPermanentVoyageGoldBonusPct(state);
  let multBps = 10_000;
  if (cannon) {
    const cannonBps = getBuffPowerBps(state, "cannon_volley", 12_000);
    multBps = Math.floor((multBps * cannonBps) / 10_000);
  }
  if (permPct > 0) multBps = Math.floor((multBps * (100 + permPct)) / 100);
  const extraPct = Math.max(0, Math.floor((multBps - 10_000) / 100));
  const cappedExtraPct = softcapVoyageBonusPct(extraPct);
  const cappedMultBps = 10_000 + cappedExtraPct * 100;
  const reward0 = cappedMultBps !== 10_000 ? (baseReward * BigInt(cappedMultBps)) / 10_000n : baseReward;
  const fails = nextEncounters.reduce((acc, e) => acc + (e.status === "fail" ? 1 : 0), 0);
  const penaltyPct = Math.min(80, fails * ENCOUNTER_FAIL_GOLD_PENALTY_PCT);
  const reward1 = (reward0 * BigInt(100 - penaltyPct)) / 100n;
  const reward = reward1;

  const sailingXpGain = Math.max(1, Math.round(route.durationMs / 1000));
  const gunneryXpGain = nextEncounters.reduce(
    (acc, e) => acc + (e.status === "success" ? 10 : e.status === "fail" ? 5 : 0),
    0
  );
  const nextCrew = {
    ...rt.crew,
    skills: {
      sailingXp: rt.crew.skills.sailingXp + sailingXpGain,
      gunneryXp: rt.crew.skills.gunneryXp + gunneryXpGain,
    },
  };

  return {
    ...rt,
    locationId: route.toIslandId,
    ship: nextShip,
    crew: nextCrew,
    hold: nextHold,
    voyage: {
      ...v,
      status: "completed",
      fromIslandId: route.fromIslandId,
      toIslandId: route.toIslandId,
      remainingMs: 0,
      durationMs: route.durationMs,
      pendingGold: reward,
      pendingInfluence: route.influenceReward,
      encounters: nextEncounters,
    },
  };
}

function tickVoyages(state: GameState, dtMs: number): GameState {
  let s = state;

  const activeRt: ShipRuntimeState = {
    locationId: s.location.islandId,
    ship: s.ship,
    crew: s.crew,
    hold: s.storage.shipHold,
    voyage: s.voyage,
  };
  const nextActive = tickVoyageRuntime(s, activeRt, dtMs);
  if (nextActive.locationId !== activeRt.locationId) s = { ...s, location: { islandId: nextActive.locationId } };
  if (nextActive.ship !== activeRt.ship) s = { ...s, ship: nextActive.ship };
  if (nextActive.crew !== activeRt.crew) s = { ...s, crew: nextActive.crew };
  if (nextActive.hold !== activeRt.hold) s = { ...s, storage: { ...s.storage, shipHold: nextActive.hold } };
  if (nextActive.voyage !== activeRt.voyage) s = { ...s, voyage: nextActive.voyage };

  if (s.fleet.ships.length === 0) return s;

  let changed = false;
  const updated: FleetShipState[] = [];
  for (const fs of s.fleet.ships) {
    const rt: ShipRuntimeState = {
      locationId: fs.location.islandId,
      ship: fs.ship,
      crew: fs.crew,
      hold: fs.hold,
      voyage: fs.voyage,
    };
    const next = tickVoyageRuntime(s, rt, dtMs);
    const shipChanged =
      next.locationId !== rt.locationId || next.ship !== fs.ship || next.crew !== fs.crew || next.hold !== fs.hold || next.voyage !== fs.voyage;
    if (shipChanged) {
      changed = true;
      updated.push({
        ...fs,
        location: { islandId: next.locationId },
        ship: next.ship,
        crew: next.crew,
        hold: next.hold,
        voyage: next.voyage,
      });
    } else {
      updated.push(fs);
    }
  }
  return changed ? { ...s, fleet: { ...s.fleet, ships: updated } } : s;
}

function findReturnRouteId(routeId: string): string | null {
  const base = ROUTE_BY_ID[routeId];
  if (!base) return null;
  for (const r of Object.values(ROUTE_BY_ID)) {
    if (r.fromIslandId === base.toIslandId && r.toIslandId === base.fromIslandId) return r.id;
  }
  return null;
}

function pickAutomationRouteId(state: GameState, rt: ShipRuntimeState, configuredRouteId: string | null): string | null {
  if (!configuredRouteId) return null;
  const base = ROUTE_BY_ID[configuredRouteId];
  if (!base) return null;

  if (rt.locationId === base.fromIslandId && state.unlocks.includes(`route:${base.id}`)) return base.id;

  if (rt.locationId === base.toIslandId) {
    const ret = findReturnRouteId(base.id);
    if (ret && state.unlocks.includes(`route:${ret}`)) return ret;
  }

  return null;
}

function startVoyageRuntime(state: GameState, rt: ShipRuntimeState, routeId: string): { state: GameState; rt: ShipRuntimeState } {
  if (rt.voyage.status !== "idle") return { state, rt };
  if (rt.ship.condition <= 0) return { state, rt };
  const route = ROUTE_BY_ID[routeId];
  if (!route) return { state, rt };
  if (!state.unlocks.includes(`route:${route.id}`)) return { state, rt };
  if (route.fromIslandId !== rt.locationId) return { state, rt };

  const req = getVoyageStartRequirements(state, rt.ship.classId, routeId);
  if (!req) return { state, rt };
  if (rt.hold.inv.rum < req.totalRum) return { state, rt };

  const nextHold = { ...rt.hold, inv: { ...rt.hold.inv, rum: rt.hold.inv.rum - req.fareRum } };
  const voyageIndex = state.stats.voyagesStarted + 1;
  const durationMs = getVoyageDurationMsForUi(state, rt.ship.classId, route.id);
  const encounters = makeVoyageEncounters({
    seed: state.settings.seed,
    routeId: route.id,
    voyageIndex,
    durationMs,
  });
  const nextRt: ShipRuntimeState = {
    ...rt,
    hold: nextHold,
    voyage: {
      status: "running",
      routeId: route.id,
      fromIslandId: route.fromIslandId,
      toIslandId: route.toIslandId,
      remainingMs: durationMs,
      durationMs,
      pendingGold: 0n,
      pendingInfluence: 0,
      encounters,
    },
  };
  const nextState: GameState = { ...state, stats: { ...state.stats, voyagesStarted: voyageIndex } };
  return { state: nextState, rt: nextRt };
}

function collectVoyageRuntime(state: GameState, rt: ShipRuntimeState): { state: GameState; rt: ShipRuntimeState } {
  if (rt.voyage.status !== "completed") return { state, rt };
  const routeId = rt.voyage.routeId;
  if (!routeId) {
    return { state, rt: { ...rt, voyage: makeIdleVoyageState() } };
  }
  const nextUnlocks = applyVoyageCollectUnlocks(state.unlocks, routeId, rt.locationId);

  const controllerFlagId = getPortControllerFlagId(state, rt.locationId) ?? state.politics.affiliationFlagId;
  const nextInfluenceByFlagId = {
    ...state.politics.influenceByFlagId,
    [controllerFlagId]: (state.politics.influenceByFlagId[controllerFlagId] ?? 0) + rt.voyage.pendingInfluence,
  };

  const nextState0: GameState = {
    ...state,
    resources: { ...state.resources, gold: state.resources.gold + rt.voyage.pendingGold },
    politics: { ...state.politics, influenceByFlagId: nextInfluenceByFlagId },
    unlocks: nextUnlocks,
  };
  const nextState = maybeUnlockCosmeticsChain(nextState0);

  return { state: nextState, rt: { ...rt, voyage: makeIdleVoyageState() } };
}

function tickAutomation(state: GameState): GameState {
  if (state.mode !== "port") return state;

  let s = state;

  // Active ship automation
  {
    let rt: ShipRuntimeState = {
      locationId: s.location.islandId,
      ship: s.ship,
      crew: s.crew,
      hold: s.storage.shipHold,
      voyage: s.voyage,
    };
    let auto: AutomationState = s.automation;

    if (auto.autoCollect && rt.voyage.status === "completed") {
      const res = collectVoyageRuntime(s, rt);
      s = res.state;
      rt = res.rt;
    }

    if (auto.enabled && rt.voyage.status === "idle") {
      const chosen = pickAutomationRouteId(s, rt, auto.routeId);
      if (chosen) {
        const res = startVoyageRuntime(s, rt, chosen);
        s = res.state;
        rt = res.rt;
      }
    }

    if (rt.locationId !== s.location.islandId) s = { ...s, location: { islandId: rt.locationId } };
    if (rt.ship !== s.ship) s = { ...s, ship: rt.ship };
    if (rt.crew !== s.crew) s = { ...s, crew: rt.crew };
    if (rt.hold !== s.storage.shipHold) s = { ...s, storage: { ...s.storage, shipHold: rt.hold } };
    if (rt.voyage !== s.voyage) s = { ...s, voyage: rt.voyage };
    if (auto !== s.automation) s = { ...s, automation: auto };
  }

  if (s.fleet.ships.length === 0) return s;

  let changed = false;
  const nextShips: FleetShipState[] = [];
  for (const fs of s.fleet.ships) {
    let rt: ShipRuntimeState = {
      locationId: fs.location.islandId,
      ship: fs.ship,
      crew: fs.crew,
      hold: fs.hold,
      voyage: fs.voyage,
    };
    let auto: AutomationState = fs.automation;

    if (auto.autoCollect && rt.voyage.status === "completed") {
      const res = collectVoyageRuntime(s, rt);
      s = res.state;
      rt = res.rt;
    }

    if (auto.enabled && rt.voyage.status === "idle") {
      const chosen = pickAutomationRouteId(s, rt, auto.routeId);
      if (chosen) {
        const res = startVoyageRuntime(s, rt, chosen);
        s = res.state;
        rt = res.rt;
      }
    }

    const updatedShip: FleetShipState =
      rt.locationId !== fs.location.islandId || rt.ship !== fs.ship || rt.crew !== fs.crew || rt.hold !== fs.hold || rt.voyage !== fs.voyage || auto !== fs.automation
        ? {
            ...fs,
            location: { islandId: rt.locationId },
            ship: rt.ship,
            crew: rt.crew,
            hold: rt.hold,
            voyage: rt.voyage,
            automation: auto,
          }
        : fs;

    if (updatedShip !== fs) changed = true;
    nextShips.push(updatedShip);
  }

  return changed ? { ...s, fleet: { ...s.fleet, ships: nextShips } } : s;
}

function tickConquest(state: GameState, dtMs: number): GameState {
  const c = state.conquest;
  if (c.status !== "running") return state;

  const nextRemaining = Math.max(0, c.remainingMs - dtMs);
  const elapsed = Math.max(0, c.durationMs - nextRemaining);
  const stage = Math.min(2, Math.floor(elapsed / CONQUEST_STAGE_MS));

  if (nextRemaining > 0) {
    if (nextRemaining === c.remainingMs && stage === c.stage) return state;
    return { ...state, conquest: { ...c, remainingMs: nextRemaining, stage } };
  }

  if (!c.targetIslandId || !c.attackerFlagId) {
    return { ...state, conquest: { ...c, status: "fail", remainingMs: 0, stage } };
  }

  const target = c.targetIslandId;
  const attacker = c.attackerFlagId;
  const nextControllers = { ...state.world.controllerByIslandId, [target]: attacker };
  const nextUnlocks = state.unlocks.includes(`conquest:${target}`) ? state.unlocks : [...state.unlocks, `conquest:${target}`];
  return {
    ...state,
    world: { ...state.world, controllerByIslandId: nextControllers },
    unlocks: nextUnlocks,
    conquest: { ...c, status: "success", remainingMs: 0, stage: 3 },
  };
}

function tickCannonMinigame(state: GameState, dtMs: number): GameState {
  const mg = state.minigames.cannon;
  if (mg.status !== "running") return state;

  const nextElapsed = mg.elapsedMs + dtMs;
  if (nextElapsed < mg.durationMs) {
    return { ...state, minigames: { ...state.minigames, cannon: { ...mg, elapsedMs: nextElapsed } } };
  }

  // Finish and grant reward deterministically (buff always, tiered by hits).
  const hits = mg.hits;
  const tierBonus = hits >= 12 ? 180_000 : hits >= 6 ? 60_000 : 0;
  const buffMs = CANNON_BUFF_MS + tierBonus;
  const powerBps = hits >= 12 ? 13_500 : hits >= 6 ? 12_000 : 11_000;
  let nextState: GameState = {
    ...state,
    minigames: { ...state.minigames, cannon: { ...mg, status: "finished", elapsedMs: mg.durationMs } },
  };
  nextState = upsertBuff(nextState, { id: "cannon_volley", remainingMs: buffMs, powerBps });
  nextState = {
    ...nextState,
    crew: {
      ...nextState.crew,
      skills: { ...nextState.crew.skills, gunneryXp: nextState.crew.skills.gunneryXp + hits },
    },
  };
  return nextState;
}

function tickRiggingMinigame(state: GameState, dtMs: number): GameState {
  const mg = state.minigames.rigging;
  if (mg.status !== "running") return state;

  const nextElapsed = mg.elapsedMs + dtMs;
  if (nextElapsed < mg.durationMs) {
    return { ...state, minigames: { ...state.minigames, rigging: { ...mg, elapsedMs: nextElapsed } } };
  }

  const good = mg.goodTugs;
  const tierBonus = good >= 12 ? 180_000 : good >= 6 ? 60_000 : 0;
  const buffMs = RIGGING_BUFF_MS + tierBonus;

  let nextState: GameState = {
    ...state,
    minigames: { ...state.minigames, rigging: { ...mg, status: "finished", elapsedMs: mg.durationMs } },
  };
  nextState = upsertBuff(nextState, { id: "rigging_run", remainingMs: buffMs });
  nextState = {
    ...nextState,
    crew: {
      ...nextState.crew,
      skills: { ...nextState.crew.skills, sailingXp: nextState.crew.skills.sailingXp + good },
    },
  };
  return nextState;
}

function tickOnce(state: GameState, dtMs: number): GameState {
  // Order: expire buffs -> income -> contracts -> distillery -> minigame -> voyage
  let s = state;
  s = tickBuffs(s, dtMs);
  s = tickPoliticsPerks(s, dtMs);
  s = tickPoliticsCampaign(s, dtMs);
  s = tickDockWork(s, dtMs);
  s = tickDockIncome(s, dtMs);
  s = tickCrewWages(s, dtMs);
  s = tickContracts(s, dtMs);
  s = tickProduction(s, dtMs);
  s = tickCannonMinigame(s, dtMs);
  s = tickRiggingMinigame(s, dtMs);
  s = tickVoyages(s, dtMs);
  s = tickAutomation(s);
  s = tickConquest(s, dtMs);
  s = tickUnlocks(s);
  return s;
}

function unlockIfMissing(state: GameState, id: string): GameState {
  if (state.unlocks.includes(id)) return state;
  return { ...state, unlocks: [...state.unlocks, id] };
}

function tickUnlocks(state: GameState): GameState {
  if (state.mode !== "port") return state;

  let s = state;

  // Always ensure the current mode exists.
  s = unlockIfMissing(s, "port");

  // Tutorial progression is deterministic and stored in state. Keep it monotonic.
  if (s.tutorial.stepId === TUTORIAL_STEP_DOCK_INTRO && (s.dock.passiveEnabled || s.unlocks.includes("upgrade:auto_dockwork"))) {
    s = { ...s, tutorial: { ...s.tutorial, stepId: TUTORIAL_STEP_ECONOMY_INTRO } };
  }
  if (s.tutorial.stepId === TUTORIAL_STEP_ECONOMY_INTRO && s.economy.contracts.length > 0) {
    s = { ...s, tutorial: { ...s.tutorial, stepId: TUTORIAL_STEP_PORT_CORE } };
  }

  // Phase 0: after buying Dock Automation, unlock Economy first (avoid “unlock avalanches”).
  if (s.dock.passiveEnabled || s.unlocks.includes("upgrade:auto_dockwork")) {
    s = unlockIfMissing(s, "economy");
  }

  // Phase 0: after the first contract is placed, unlock the first active accelerator + distillery.
  if (s.unlocks.includes("economy") && s.economy.contracts.length > 0) {
    s = unlockIfMissing(s, "minigame:cannon");
    s = unlockIfMissing(s, "recipe:distill_rum");
  }

  // Phase 1: crew after first meaningful cash milestone.
  if (s.unlocks.includes("economy") && s.economy.contracts.length > 0 && s.resources.gold >= 25n) {
    s = unlockIfMissing(s, "crew");
  }

  // Phase 1: voyages after the player has produced any rum (shows the module once it matters).
  const hereWh = getWarehouse(s, s.location.islandId);
  const rumInWarehouse = hereWh ? hereWh.inv.rum : 0n;
  const rumInHold = s.storage.shipHold.inv.rum;
  if (rumInWarehouse + rumInHold > 0n) {
    s = unlockIfMissing(s, "voyage");
    s = unlockIfMissing(s, "route:starter_run");
  }

  // Phase 2: politics after the first successful voyage (arrival at a non-home port).
  // Also unlocks once the player can afford a meaningful donation sink.
  if (s.location.islandId !== "home_port" || s.resources.gold >= 100n) s = unlockIfMissing(s, "politics");

  return s;
}

export function makeInitialState(seed = 1): GameState {
  return {
    mode: "title",
    simNowMs: 0,
    stepAccMs: 0,
    rng: rngFromSeed(seed),
    settings: { seed },
    stats: { voyagesStarted: 0 },
    tutorial: { stepId: "tut:title" },
    resources: { gold: 0n },
    shipId: "s_1",
    shipName: "Sloop #1",
    location: { islandId: "home_port" },
    storage: {
      warehouses: makeInitialWarehouses(),
      shipHold: { cap: BigInt(SHIP_CLASS_BY_ID.sloop.holdCap), inv: makeEmptyInventory() },
    },
    ship: { classId: "sloop", condition: SHIP_MAX_CONDITION, maxCondition: SHIP_MAX_CONDITION },
    crew: { hired: 0, wagesRemainderMs: 0, skills: { sailingXp: 0, gunneryXp: 0 } },
    unlocks: [],
    automation: { enabled: false, routeId: null, autoCollect: false },
    fleet: { ships: [], nextShipNum: 2, maxShips: 2 },
    world: { controllerByIslandId: makeInitialWorldControllers() },
    conquest: {
      status: "idle",
      targetIslandId: null,
      attackerFlagId: null,
      remainingMs: 0,
      durationMs: 0,
      stage: 0,
      warChestPaid: 0n,
    },
    shipyard: { level: 1 },
    flagship: { progress: 0, required: 3 },
    economy: { contracts: [], spawnAcc: makeInitialSpawnAcc() },
    production: { jobs: makeInitialProductionJobs() },
    voyage: {
      status: "idle",
      routeId: null,
      fromIslandId: null,
      toIslandId: null,
      remainingMs: 0,
      durationMs: 0,
      pendingGold: 0n,
      pendingInfluence: 0,
      encounters: [],
    },
    politics: {
      affiliationFlagId: "player",
      influenceByFlagId: makeInitialInfluenceByFlagId(),
      portPerksByIslandId: {},
      campaign: makeInitialPoliticsCampaign(),
    },
    buffs: [],
    minigames: {
      cannon: { status: "idle", elapsedMs: 0, durationMs: CANNON_DURATION_MS, hits: 0, shots: 0 },
      rigging: { status: "idle", elapsedMs: 0, durationMs: RIGGING_DURATION_MS, zoneStartPermille: 400, tugs: 0, goodTugs: 0 },
    },
    dock: { incomeRemainderMs: 0, passiveEnabled: false, workRemainingMs: 0 },
  };
}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_NEW_GAME": {
      return {
        ...state,
        mode: "port",
        simNowMs: 0,
        stepAccMs: 0,
        rng: rngFromSeed(state.settings.seed),
        settings: { seed: state.settings.seed },
        stats: { voyagesStarted: 0 },
        tutorial: { stepId: TUTORIAL_STEP_DOCK_INTRO },
        resources: { gold: 0n },
        shipId: "s_1",
        shipName: "Sloop #1",
        location: { islandId: "home_port" },
        storage: {
          warehouses: makeInitialWarehouses(),
        shipHold: { cap: BigInt(SHIP_CLASS_BY_ID.sloop.holdCap), inv: makeEmptyInventory() },
      },
      ship: { classId: "sloop", condition: SHIP_MAX_CONDITION, maxCondition: SHIP_MAX_CONDITION },
      crew: { hired: 0, wagesRemainderMs: 0, skills: { sailingXp: 0, gunneryXp: 0 } },
        unlocks: ["port"],
        automation: { enabled: false, routeId: null, autoCollect: false },
        fleet: { ships: [], nextShipNum: 2, maxShips: 2 },
        world: { controllerByIslandId: makeInitialWorldControllers() },
        conquest: {
          status: "idle",
          targetIslandId: null,
          attackerFlagId: null,
          remainingMs: 0,
          durationMs: 0,
          stage: 0,
          warChestPaid: 0n,
        },
        shipyard: { level: 1 },
        flagship: { progress: 0, required: 3 },
        economy: { contracts: [], spawnAcc: makeInitialSpawnAcc() },
        production: { jobs: makeInitialProductionJobs() },
        voyage: {
          status: "idle",
          routeId: null,
          fromIslandId: null,
          toIslandId: null,
          remainingMs: 0,
          durationMs: 0,
          pendingGold: 0n,
          pendingInfluence: 0,
          encounters: [],
        },
        politics: {
          affiliationFlagId: "player",
          influenceByFlagId: makeInitialInfluenceByFlagId(),
          portPerksByIslandId: {},
          campaign: makeInitialPoliticsCampaign(),
        },
        buffs: [],
        minigames: {
          cannon: {
            status: "idle",
            elapsedMs: 0,
            durationMs: CANNON_DURATION_MS,
            hits: 0,
            shots: 0,
          },
          rigging: { status: "idle", elapsedMs: 0, durationMs: RIGGING_DURATION_MS, zoneStartPermille: 400, tugs: 0, goodTugs: 0 },
        },
        dock: { incomeRemainderMs: 0, passiveEnabled: false, workRemainingMs: 0 },
      };
    }
    case "DOCK_WORK_START": {
      if (state.mode !== "port") return state;
      if (state.dock.workRemainingMs > 0) {
        const reduced = Math.max(1, state.dock.workRemainingMs - DOCK_WORK_HUSTLE_REDUCE_MS);
        return { ...state, dock: { ...state.dock, workRemainingMs: reduced } };
      }
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold + DOCK_WORK_IMMEDIATE_GOLD },
        dock: { ...state.dock, workRemainingMs: DOCK_WORK_DURATION_MS },
      };
    }
    case "DOCK_AUTOMATE_BUY": {
      if (state.mode !== "port") return state;
      if (state.dock.passiveEnabled) return state;
      if (state.resources.gold < DOCK_AUTOMATE_COST_GOLD) return state;
      const nextGold = state.resources.gold - DOCK_AUTOMATE_COST_GOLD;
      const unlocks = state.unlocks.includes("upgrade:auto_dockwork") ? state.unlocks : [...state.unlocks, "upgrade:auto_dockwork"];
      // Buying automation is a deliberate tutorial milestone. Unlock Economy next (avoid unlock avalanches).
      const nextUnlocks = unlocks.includes("economy") ? unlocks : [...unlocks, "economy"];
      return {
        ...state,
        resources: { ...state.resources, gold: nextGold },
        tutorial: { ...state.tutorial, stepId: TUTORIAL_STEP_ECONOMY_INTRO },
        dock: { ...state.dock, passiveEnabled: true },
        unlocks: nextUnlocks,
      };
    }
    case "BUY_CHART": {
      if (state.mode !== "port") return state;
      if (state.voyage.status === "running") return state;
      const def = CHART_BY_ID[action.chartId];
      if (!def) return state;
      const chartUnlock = def.id;
      const routeUnlock = `route:${def.routeId}`;
      if (state.unlocks.includes(chartUnlock) || state.unlocks.includes(routeUnlock)) return state;
      const cost = BigInt(def.costGold);
      if (state.resources.gold < cost) return state;
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        unlocks: [...state.unlocks, chartUnlock, routeUnlock],
      };
    }
    case "PLACE_CONTRACT": {
      if (state.mode !== "port") return state;
      const qty = action.qty < 0n ? 0n : action.qty;
      const bid = action.bidPrice < 0n ? 0n : action.bidPrice;
      if (qty <= 0n) return state;
      const portId = state.location.islandId;
      const activeHere = state.economy.contracts.filter((c) => c.portId === portId && (c.status === "open" || c.status === "filled")).length;
      if (activeHere >= CONTRACT_MAX_ACTIVE_PER_PORT) return state;

      const rawCommodity = action.commodityId;
      if (!isCommodityId(rawCommodity)) return state;
      const commodityId: CommodityId = rawCommodity;
      if (
        commodityId === "rum" ||
        commodityId === "dye" ||
        commodityId === "cloth" ||
        commodityId === "cosmetics" ||
        commodityId === "cannonballs" ||
        commodityId === "parts" ||
        commodityId === "repair_kits"
      )
        return state;

      const feePaid = computeContractPlacementFee(state, qty, bid);
      if (state.resources.gold < feePaid) return state;

      const c: ContractState = {
        id: nextContractId(state),
        portId,
        commodityId,
        qty,
        bidPrice: bid,
        feePaid,
        filledQty: 0n,
        collectedQty: 0n,
        status: "open",
        fillRemainderMs: 0,
      };
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - feePaid },
        economy: { ...state.economy, contracts: [...state.economy.contracts, c] },
      };
    }
    case "POLITICS_SET_AFFILIATION": {
      if (state.mode !== "port") return state;
      const nextId = action.flagId;
      if (!FLAG_BY_ID[nextId]) return state;
      if (nextId === state.politics.affiliationFlagId) return state;
      return maybeUnlockCosmeticsChain({ ...state, politics: { ...state.politics, affiliationFlagId: nextId } });
    }
    case "POLITICS_DONATE": {
      if (state.mode !== "port") return state;
      const flagId = action.flagId;
      if (!FLAG_BY_ID[flagId]) return state;
      const want = action.gold < 0n ? 0n : action.gold;
      if (want < DONATION_GOLD_PER_INFLUENCE) return state;
      if (state.resources.gold < DONATION_GOLD_PER_INFLUENCE) return state;

      const afford = state.resources.gold < want ? state.resources.gold : want;
      const gain = afford / DONATION_GOLD_PER_INFLUENCE;
      if (gain <= 0n) return state;

      const spend = gain * DONATION_GOLD_PER_INFLUENCE;
      const gainN = Number(gain);
      const nextInfluenceByFlagId = {
        ...state.politics.influenceByFlagId,
        [flagId]: (state.politics.influenceByFlagId[flagId] ?? 0) + gainN,
      };
      const nextState: GameState = {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - spend },
        politics: { ...state.politics, influenceByFlagId: nextInfluenceByFlagId },
      };
      return maybeUnlockCosmeticsChain(nextState);
    }
    case "POLITICS_CAMPAIGN_START_TAX_RELIEF": {
      if (state.mode !== "port") return state;
      if (state.politics.campaign.status === "running") return state;

      const portId = state.location.islandId;
      const controllerFlagId = getPortControllerFlagId(state, portId);
      const baseTaxBps = FLAG_BY_ID[controllerFlagId]?.taxBps ?? 0;
      if (baseTaxBps <= 0) return state;

      const controllerInf = state.politics.influenceByFlagId[controllerFlagId] ?? 0;
      if (controllerInf < TAX_RELIEF_REQUIRED_INFLUENCE) return state;

      const tier = ISLAND_BY_ID[portId]?.tier ?? 1;
      const goldCost = BigInt(tier) * TAX_RELIEF_GOLD_COST_PER_TIER;
      if (state.resources.gold < goldCost) return state;

      const nextInfluenceByFlagId = {
        ...state.politics.influenceByFlagId,
        [controllerFlagId]: Math.max(0, controllerInf - TAX_RELIEF_REQUIRED_INFLUENCE),
      };
      const nextCampaign: PoliticsCampaignState = {
        status: "running",
        kind: "tax_relief",
        portId,
        controllerFlagId,
        remainingMs: TAX_RELIEF_CAMPAIGN_DURATION_MS,
        durationMs: TAX_RELIEF_CAMPAIGN_DURATION_MS,
        goldPaid: goldCost,
        influenceSpent: TAX_RELIEF_REQUIRED_INFLUENCE,
      };
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - goldCost },
        politics: { ...state.politics, influenceByFlagId: nextInfluenceByFlagId, campaign: nextCampaign },
      };
    }
    case "POLITICS_CAMPAIGN_ABORT": {
      if (state.mode !== "port") return state;
      if (state.politics.campaign.status !== "running") return state;
      return { ...state, politics: { ...state.politics, campaign: makeInitialPoliticsCampaign() } };
    }
    case "COLLECT_CONTRACT": {
      const res = collectContractInPlace(state, action.contractId);
      return res.changed ? res.state : state;
    }
    case "COLLECT_CONTRACT_ALL": {
      if (state.mode !== "port") return state;
      const here = state.location.islandId;
      const ids = state.economy.contracts
        .filter((c) => c.portId === here && c.status !== "canceled" && c.status !== "collected" && c.filledQty > c.collectedQty)
        .map((c) => c.id);
      if (ids.length === 0) return state;
      let s = state;
      let changed = false;
      for (const id of ids) {
        const res = collectContractInPlace(s, id);
        s = res.state;
        if (res.changed) changed = true;
      }
      return changed ? s : state;
    }
    case "CANCEL_CONTRACT": {
      if (state.mode !== "port") return state;
      const idx = state.economy.contracts.findIndex((c) => c.id === action.contractId);
      if (idx === -1) return state;
      const c = state.economy.contracts[idx];
      if (c.status !== "open" && c.status !== "filled") return state;
      if (state.location.islandId !== c.portId) return state;
      const next = state.economy.contracts.slice();
      next[idx] = { ...c, status: "canceled" };
      return { ...state, economy: { ...state.economy, contracts: next } };
    }
    case "LOAD_TO_HOLD": {
      if (state.mode !== "port") return state;
      const qty = action.qty < 0n ? 0n : action.qty;
      if (qty <= 0n) return state;
      if (!isCommodityId(action.commodityId)) return state;

      const portId = state.location.islandId;
      const wh = getWarehouse(state, portId);
      if (!wh) return state;

      const available = wh.inv[action.commodityId];
      if (available <= 0n) return state;

      const hold = state.storage.shipHold;
      const free = hold.cap - invUsed(hold.inv);
      if (free <= 0n) return state;

      const take = qty <= available ? (qty <= free ? qty : free) : available <= free ? available : free;
      if (take <= 0n) return state;

      const nextWh: WarehouseState = { ...wh, inv: { ...wh.inv, [action.commodityId]: available - take } };
      const nextHold = { ...hold, inv: { ...hold.inv, [action.commodityId]: hold.inv[action.commodityId] + take } };
      const nextState = setWarehouse(state, portId, nextWh);
      return { ...nextState, storage: { ...nextState.storage, shipHold: nextHold } };
    }
    case "UNLOAD_FROM_HOLD": {
      if (state.mode !== "port") return state;
      const qty = action.qty < 0n ? 0n : action.qty;
      if (qty <= 0n) return state;
      if (!isCommodityId(action.commodityId)) return state;

      const portId = state.location.islandId;
      const wh = getWarehouse(state, portId);
      if (!wh) return state;

      const hold = state.storage.shipHold;
      const available = hold.inv[action.commodityId];
      if (available <= 0n) return state;

      const free = wh.cap - invUsed(wh.inv);
      if (free <= 0n) return state;

      const take = qty <= available ? (qty <= free ? qty : free) : available <= free ? available : free;
      if (take <= 0n) return state;

      const nextHold = { ...hold, inv: { ...hold.inv, [action.commodityId]: available - take } };
      const nextWh: WarehouseState = { ...wh, inv: { ...wh.inv, [action.commodityId]: wh.inv[action.commodityId] + take } };
      const nextState = setWarehouse(state, portId, nextWh);
      return { ...nextState, storage: { ...nextState.storage, shipHold: nextHold } };
    }
    case "CREW_HIRE": {
      if (state.mode !== "port") return state;
      const qtyReq = clampInt(Math.trunc(action.qty), 0, 999);
      if (qtyReq <= 0) return state;
      const cap = SHIP_CLASS_BY_ID[state.ship.classId]?.crewCap ?? 0;
      const free = cap - state.crew.hired;
      if (free <= 0) return state;

      const want = Math.min(qtyReq, free);
      const affordable = state.resources.gold / CREW_HIRE_COST_GOLD;
      const hire = affordable <= 0n ? 0 : Number(affordable < BigInt(want) ? affordable : BigInt(want));
      if (hire <= 0) return state;

      const cost = BigInt(hire) * CREW_HIRE_COST_GOLD;
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        crew: { ...state.crew, hired: state.crew.hired + hire },
      };
    }
    case "CREW_FIRE": {
      if (state.mode !== "port") return state;
      const qtyReq = clampInt(Math.trunc(action.qty), 0, 999);
      if (qtyReq <= 0) return state;
      const fire = Math.min(qtyReq, state.crew.hired);
      if (fire <= 0) return state;
      return { ...state, crew: { ...state.crew, hired: state.crew.hired - fire } };
    }
    case "PRODUCTION_SET_ENABLED": {
      if (state.mode !== "port") return state;
      const recipeId = action.recipeId;
      const enabled = !!action.enabled;
      const job = state.production.jobs[recipeId];
      if (!job) return state;
      if (job.enabled === enabled) return state;
      return { ...state, production: { jobs: { ...state.production.jobs, [recipeId]: { ...job, enabled } } } };
    }
    case "VOYAGE_START": {
      if (state.mode !== "port") return state;
      if (state.voyage.status !== "idle") return state;
      if (state.ship.condition <= 0) return state;
      const route = ROUTE_BY_ID[action.routeId];
      if (!route) return state;
      if (!state.unlocks.includes(`route:${route.id}`)) return state;
      if (route.fromIslandId !== state.location.islandId) return state;

      const req = getVoyageStartRequirements(state, state.ship.classId, route.id);
      if (!req) return state;
      const hold = state.storage.shipHold;
      if (hold.inv.rum < req.totalRum) return state;

      const nextHold = { ...hold, inv: { ...hold.inv, rum: hold.inv.rum - req.fareRum } };
      const nextState = { ...state, storage: { ...state.storage, shipHold: nextHold } };
      const voyageIndex = state.stats.voyagesStarted + 1;
      const durationMs = getVoyageDurationMsForUi(state, state.ship.classId, route.id);
      const encounters = makeVoyageEncounters({
        seed: state.settings.seed,
        routeId: route.id,
        voyageIndex,
        durationMs,
      });
      return {
        ...nextState,
        stats: { ...state.stats, voyagesStarted: voyageIndex },
        voyage: {
          status: "running",
          routeId: route.id,
          fromIslandId: route.fromIslandId,
          toIslandId: route.toIslandId,
          remainingMs: durationMs,
          durationMs,
          pendingGold: 0n,
          pendingInfluence: 0,
          encounters,
        },
      };
    }
    case "VOYAGE_PREPARE": {
      if (state.mode !== "port") return state;
      if (state.voyage.status !== "idle") return state;
      const route = ROUTE_BY_ID[action.routeId];
      if (!route) return state;
      if (!state.unlocks.includes(`route:${route.id}`)) return state;
      if (route.fromIslandId !== state.location.islandId) return state;

      const req = getVoyageStartRequirements(state, state.ship.classId, route.id);
      if (!req) return state;

      const portId = state.location.islandId;
      const wh = getWarehouse(state, portId);
      if (!wh) return state;

      let nextWh: WarehouseState = wh;
      let nextHold = state.storage.shipHold;
      let whCopied = false;
      let holdCopied = false;

      const ensureWhCopy = () => {
        if (whCopied) return;
        nextWh = { ...nextWh, inv: { ...nextWh.inv } };
        whCopied = true;
      };
      const ensureHoldCopy = () => {
        if (holdCopied) return;
        nextHold = { ...nextHold, inv: { ...nextHold.inv } };
        holdCopied = true;
      };

      const transferToHold = (commodityId: CommodityId, want: bigint) => {
        if (want <= 0n) return;
        const available = nextWh.inv[commodityId];
        if (available <= 0n) return;
        const free = nextHold.cap - invUsed(nextHold.inv);
        if (free <= 0n) return;
        const take = want <= available ? (want <= free ? want : free) : available <= free ? available : free;
        if (take <= 0n) return;
        ensureWhCopy();
        ensureHoldCopy();
        nextWh.inv[commodityId] -= take;
        nextHold.inv[commodityId] += take;
      };

      const missingRum = req.totalRum > nextHold.inv.rum ? req.totalRum - nextHold.inv.rum : 0n;
      const missingCannonballs =
        req.expectedCannonballs > nextHold.inv.cannonballs ? req.expectedCannonballs - nextHold.inv.cannonballs : 0n;

      transferToHold("rum", missingRum);
      transferToHold("cannonballs", missingCannonballs);

      if (!whCopied && !holdCopied) return state;
      const nextState = whCopied ? setWarehouse(state, portId, nextWh) : state;
      return holdCopied ? { ...nextState, storage: { ...nextState.storage, shipHold: nextHold } } : nextState;
    }
    case "VOYAGE_COLLECT": {
      if (state.mode !== "port") return state;
      if (state.voyage.status !== "completed") return state;
      const routeId = state.voyage.routeId;
      const nextUnlocks = routeId ? applyVoyageCollectUnlocks(state.unlocks, routeId, state.location.islandId) : state.unlocks;
      const controllerFlagId = getPortControllerFlagId(state, state.location.islandId) ?? state.politics.affiliationFlagId;
      const nextInfluenceByFlagId = {
        ...state.politics.influenceByFlagId,
        [controllerFlagId]: (state.politics.influenceByFlagId[controllerFlagId] ?? 0) + state.voyage.pendingInfluence,
      };
      return maybeUnlockCosmeticsChain({
        ...state,
        resources: { ...state.resources, gold: state.resources.gold + state.voyage.pendingGold },
        politics: { ...state.politics, influenceByFlagId: nextInfluenceByFlagId },
        unlocks: nextUnlocks,
        voyage: {
          status: "idle",
          routeId: null,
          fromIslandId: null,
          toIslandId: null,
          remainingMs: 0,
          durationMs: 0,
          pendingGold: 0n,
          pendingInfluence: 0,
          encounters: [],
        },
      });
    }
    case "SHIP_REPAIR": {
      if (state.mode !== "port") return state;
      if (state.voyage.status === "running") return state;
      if (state.ship.condition >= state.ship.maxCondition) return state;
      const portId = state.location.islandId;
      const wh = getWarehouse(state, portId);
      if (wh && wh.inv.repair_kits > 0n) {
        const nextWh: WarehouseState = { ...wh, inv: { ...wh.inv, repair_kits: wh.inv.repair_kits - 1n } };
        const nextState = setWarehouse(state, portId, nextWh);
        const nextCondition = Math.min(state.ship.maxCondition, state.ship.condition + SHIP_REPAIR_KIT_CONDITION);
        return { ...nextState, ship: { ...state.ship, condition: nextCondition } };
      }

      if (state.resources.gold < SHIP_REPAIR_GOLD_COST) return state;
      const nextCondition = Math.min(state.ship.maxCondition, state.ship.condition + SHIP_REPAIR_CONDITION);
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - SHIP_REPAIR_GOLD_COST },
        ship: { ...state.ship, condition: nextCondition },
      };
    }
    case "SHIP_BUY_CLASS": {
      if (state.mode !== "port") return state;
      if (state.voyage.status === "running") return state;
      const def = SHIP_CLASS_BY_ID[action.classId];
      if (!def) return state;
      if (def.id === state.ship.classId) return state;

      const cost = BigInt(def.buyCostGold);
      if (state.resources.gold < cost) return state;

      const nextCap = BigInt(def.holdCap);
      if (invUsed(state.storage.shipHold.inv) > nextCap) return state;
      if (state.crew.hired > def.crewCap) return state;

      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        ship: { ...state.ship, classId: def.id },
        storage: { ...state.storage, shipHold: { ...state.storage.shipHold, cap: nextCap } },
      };
    }
    case "FLEET_BUY_SHIP": {
      if (state.mode !== "port") return state;
      if (state.voyage.status === "running") return state;
      if (state.fleet.ships.length + 1 >= state.fleet.maxShips) return state;
      const def = SHIP_CLASS_BY_ID[action.classId];
      if (!def) return state;
      if (def.id === "sloop") return state;

      const cost = BigInt(def.buyCostGold);
      if (state.resources.gold < cost) return state;

      const idNum = state.fleet.nextShipNum;
      const id = `s_${idNum}`;
      const ship: FleetShipState = {
        id,
        name: `${def.name} #${idNum}`,
        location: { islandId: state.location.islandId },
        ship: { classId: def.id, condition: SHIP_MAX_CONDITION, maxCondition: SHIP_MAX_CONDITION },
        crew: { hired: 0, wagesRemainderMs: 0, skills: { sailingXp: 0, gunneryXp: 0 } },
        hold: { cap: BigInt(def.holdCap), inv: makeEmptyInventory() },
        voyage: makeIdleVoyageState(),
        automation: { enabled: false, routeId: null, autoCollect: true },
      };

      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        fleet: { ...state.fleet, ships: [...state.fleet.ships, ship], nextShipNum: idNum + 1 },
      };
    }
    case "FLEET_SET_ACTIVE_SHIP": {
      if (state.mode !== "port") return state;
      if (state.voyage.status === "running") return state;
      const idx = state.fleet.ships.findIndex((s) => s.id === action.shipId);
      if (idx === -1) return state;
      const target = state.fleet.ships[idx];
      if (target.voyage.status === "running") return state;

      const activeAsFleet: FleetShipState = {
        id: state.shipId,
        name: state.shipName,
        location: state.location,
        ship: state.ship,
        crew: state.crew,
        hold: state.storage.shipHold,
        voyage: state.voyage,
        automation: state.automation,
      };

      const nextShips = state.fleet.ships.slice();
      nextShips[idx] = activeAsFleet;
      return {
        ...state,
        shipId: target.id,
        shipName: target.name,
        location: target.location,
        ship: target.ship,
        crew: target.crew,
        storage: { ...state.storage, shipHold: target.hold },
        voyage: target.voyage,
        automation: target.automation,
        fleet: { ...state.fleet, ships: nextShips },
      };
    }
    case "FLEET_SET_AUTOMATION": {
      if (state.mode !== "port") return state;
      const enabled = !!action.enabled;
      const autoCollect = !!action.autoCollect;
      const routeId = action.routeId;
      const nextAuto: AutomationState = { enabled, routeId, autoCollect };

      if (action.shipId === state.shipId) {
        if (
          state.automation.enabled === nextAuto.enabled &&
          state.automation.autoCollect === nextAuto.autoCollect &&
          state.automation.routeId === nextAuto.routeId
        )
          return state;
        return { ...state, automation: nextAuto };
      }

      const idx = state.fleet.ships.findIndex((s) => s.id === action.shipId);
      if (idx === -1) return state;
      const ship = state.fleet.ships[idx];
      if (
        ship.automation.enabled === nextAuto.enabled &&
        ship.automation.autoCollect === nextAuto.autoCollect &&
        ship.automation.routeId === nextAuto.routeId
      )
        return state;
      const nextShips = state.fleet.ships.slice();
      nextShips[idx] = { ...ship, automation: nextAuto };
      return { ...state, fleet: { ...state.fleet, ships: nextShips } };
    }
    case "CONQUEST_START": {
      if (state.mode !== "port") return state;
      if (state.conquest.status === "running") return state;
      const targetId = action.targetIslandId;
      const island = ISLAND_BY_ID[targetId];
      if (!island) return state;

      const attackerFlagId = state.politics.affiliationFlagId;
      const currentController = getPortControllerFlagId(state, targetId);
      if (attackerFlagId === currentController) return state;

      const requiredInf = island.tier * CONQUEST_INFLUENCE_PER_TIER;
      const inf = state.politics.influenceByFlagId[attackerFlagId] ?? 0;
      if (inf < requiredInf) return state;

      const warChest = BigInt(island.tier) * CONQUEST_WARCHEST_GOLD_PER_TIER;
      if (state.resources.gold < warChest) return state;

      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - warChest },
        conquest: {
          status: "running",
          targetIslandId: targetId,
          attackerFlagId,
          remainingMs: CONQUEST_DURATION_MS,
          durationMs: CONQUEST_DURATION_MS,
          stage: 0,
          warChestPaid: warChest,
        },
      };
    }
    case "CONQUEST_ABORT": {
      if (state.mode !== "port") return state;
      if (state.conquest.status !== "running") return state;
      return {
        ...state,
        conquest: {
          status: "fail",
          targetIslandId: null,
          attackerFlagId: null,
          remainingMs: 0,
          durationMs: 0,
          stage: 0,
          warChestPaid: 0n,
        },
      };
    }
    case "SHIPYARD_UPGRADE": {
      if (state.mode !== "port") return state;
      if (state.voyage.status === "running") return state;
      if (state.shipyard.level >= SHIPYARD_MAX_LEVEL) return state;
      const nextLevel = state.shipyard.level + 1;
      const cost = BigInt(nextLevel) * SHIPYARD_UPGRADE_GOLD_PER_LEVEL;
      if (state.resources.gold < cost) return state;
      const nextMaxShips = Math.min(5, state.fleet.maxShips + 1);
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        shipyard: { level: nextLevel },
        fleet: { ...state.fleet, maxShips: nextMaxShips },
      };
    }
    case "FLAGSHIP_CONTRIBUTE": {
      if (state.mode !== "port") return state;
      if (state.voyage.status === "running") return state;
      if (state.flagship.progress >= state.flagship.required) return state;
      if (state.resources.gold < FLAGSHIP_CONTRIBUTE_GOLD) return state;

      const portId = state.location.islandId;
      const wh = getWarehouse(state, portId);
      if (!wh) return state;
      if (wh.inv.cosmetics < FLAGSHIP_CONTRIBUTE_COSMETICS) return state;

      const nextWh: WarehouseState = {
        ...wh,
        inv: { ...wh.inv, cosmetics: wh.inv.cosmetics - FLAGSHIP_CONTRIBUTE_COSMETICS },
      };
      let nextState = setWarehouse(state, portId, nextWh);

      const nextProgress = state.flagship.progress + 1;
      nextState = {
        ...nextState,
        resources: { ...nextState.resources, gold: nextState.resources.gold - FLAGSHIP_CONTRIBUTE_GOLD },
        flagship: { ...nextState.flagship, progress: nextProgress },
      };

      if (nextProgress >= nextState.flagship.required && !nextState.unlocks.includes("flagship_built")) {
        nextState = { ...nextState, unlocks: [...nextState.unlocks, "flagship_built"] };
      }
      return nextState;
    }
    case "UPGRADE_WAREHOUSE": {
      if (state.mode !== "port") return state;
      if (state.resources.gold < WAREHOUSE_UPGRADE_COST) return state;
      const portId = state.location.islandId;
      const wh = getWarehouse(state, portId);
      if (!wh) return state;
      const nextWh: WarehouseState = { ...wh, cap: wh.cap + WAREHOUSE_UPGRADE_BONUS };
      const nextState = setWarehouse(state, portId, nextWh);
      return {
        ...nextState,
        resources: { ...state.resources, gold: state.resources.gold - WAREHOUSE_UPGRADE_COST },
      };
    }
    case "CANNON_START": {
      if (state.mode !== "port") return state;
      const mg = state.minigames.cannon;
      if (mg.status === "running") return state;
      if (getBuffRemainingMs(state, "cannon_volley") >= MINIGAME_REFRESH_WINDOW_MS) return state;
      return {
        ...state,
        minigames: {
          ...state.minigames,
          cannon: { ...mg, status: "running", elapsedMs: 0, hits: 0, shots: 0, durationMs: CANNON_DURATION_MS },
        },
      };
    }
    case "CANNON_FIRE": {
      const mg = state.minigames.cannon;
      if (mg.status !== "running") return state;

      // Indicator position is a deterministic saw wave based on elapsed time.
      const cycleMs = 1000;
      const phase = (mg.elapsedMs % cycleMs) / cycleMs;
      const inZone = phase >= 0.4 && phase <= 0.6;
      return {
        ...state,
        minigames: {
          ...state.minigames,
          cannon: {
            ...mg,
            shots: mg.shots + 1,
            hits: mg.hits + (inZone ? 1 : 0),
          },
        },
      };
    }
    case "RIGGING_START": {
      if (state.mode !== "port") return state;
      if (!state.unlocks.includes("minigame:rigging")) return state;
      const mg = state.minigames.rigging;
      if (mg.status === "running") return state;
      if (getBuffRemainingMs(state, "rigging_run") >= MINIGAME_REFRESH_WINDOW_MS) return state;
      const [u, rng] = rngNextUint32(state.rng);
      const zoneStartPermille = 100 + (u % 701); // 100..800 inclusive (width=200)
      return {
        ...state,
        rng,
        minigames: {
          ...state.minigames,
          rigging: {
            ...mg,
            status: "running",
            elapsedMs: 0,
            durationMs: RIGGING_DURATION_MS,
            zoneStartPermille,
            tugs: 0,
            goodTugs: 0,
          },
        },
      };
    }
    case "RIGGING_TUG": {
      if (!state.unlocks.includes("minigame:rigging")) return state;
      const mg = state.minigames.rigging;
      if (mg.status !== "running") return state;
      const phasePermille = Math.floor(((mg.elapsedMs % RIGGING_CYCLE_MS) * 1000) / RIGGING_CYCLE_MS);
      const zoneEnd = mg.zoneStartPermille + RIGGING_ZONE_WIDTH_PERMILLE;
      const inZone = phasePermille >= mg.zoneStartPermille && phasePermille <= zoneEnd;
      return {
        ...state,
        minigames: {
          ...state.minigames,
          rigging: {
            ...mg,
            tugs: mg.tugs + 1,
            goodTugs: mg.goodTugs + (inZone ? 1 : 0),
          },
        },
      };
    }
    case "VANITY_BUY": {
      if (state.mode !== "port") return state;
      if (state.voyage.status === "running") return state;
      if (!state.unlocks.includes("vanity_shop")) return state;
      const def = VANITY_BY_ID[action.itemId];
      if (!def) return state;
      if (state.unlocks.includes(def.id)) return state;

      const portId = state.location.islandId;
      const wh = getWarehouse(state, portId);
      if (!wh) return state;
      const cost = BigInt(def.costCosmetics);
      if (wh.inv.cosmetics < cost) return state;

      const nextWh: WarehouseState = { ...wh, inv: { ...wh.inv, cosmetics: wh.inv.cosmetics - cost } };
      let nextState = setWarehouse(state, portId, nextWh);
      nextState = { ...nextState, unlocks: [...nextState.unlocks, def.id] };

      if (def.id === "vanity:warehouse_signage") {
        const nextWarehouses: Record<string, WarehouseState> = {};
        for (const [id, w] of Object.entries(nextState.storage.warehouses)) {
          nextWarehouses[id] = { ...w, cap: w.cap + VANITY_WAREHOUSE_SIGNAGE_CAP_BONUS };
        }
        nextState = { ...nextState, storage: { ...nextState.storage, warehouses: nextWarehouses } };
      } else if (def.id === "vanity:ship_figurehead") {
        const nextMax = nextState.ship.maxCondition + VANITY_SHIP_FIGUREHEAD_CONDITION_BONUS;
        const nextCond = Math.min(nextMax, nextState.ship.condition + VANITY_SHIP_FIGUREHEAD_CONDITION_BONUS);
        nextState = { ...nextState, ship: { ...nextState.ship, maxCondition: nextMax, condition: nextCond } };
      }

      return nextState;
    }
    default:
      return state;
  }
}

export function advance(state: GameState, dtMs: number): GameState {
  const dt = clampInt(dtMs, 0, 86_400_000);
  if (dt === 0) return state;

  let s: GameState = { ...state, simNowMs: state.simNowMs + dt, stepAccMs: state.stepAccMs + dt };
  while (s.stepAccMs >= FIXED_STEP_MS) {
    s = { ...s, stepAccMs: s.stepAccMs - FIXED_STEP_MS };
    s = tickOnce(s, FIXED_STEP_MS);
  }
  return s;
}
