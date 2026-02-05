export type GameMode = "title" | "port";

export type RngState = { algo: "mulberry32"; state: number };

export type CommodityId =
  | "wood"
  | "sugar"
  | "iron"
  | "stone"
  | "hemp"
  | "herbs"
  | "rum"
  | "dye"
  | "cloth"
  | "cosmetics"
  | "cannonballs"
  | "parts"
  | "repair_kits";

export type Inventory = Record<CommodityId, bigint>;

export type ContractStatus = "open" | "filled" | "collected" | "canceled";

export type ContractState = {
  id: string;
  portId: string;
  commodityId: CommodityId;
  qty: bigint;
  bidPrice: bigint;
  feePaid: bigint;
  filledQty: bigint;
  collectedQty: bigint;
  status: ContractStatus;
  fillRemainderMs: number;
};

export type BuffState = { id: string; remainingMs: number; powerBps?: number };

export type ProductionJobState = { enabled: boolean; remainderMs: number };
export type ProductionState = { jobs: Record<string, ProductionJobState> };

export type WarehouseState = { cap: bigint; inv: Inventory };
export type ShipHoldState = { cap: bigint; inv: Inventory };

export type StorageState = {
  warehouses: Record<string, WarehouseState>;
  shipHold: ShipHoldState;
};

export type VoyageStatus = "idle" | "running" | "completed";
export type VoyageEncounterStatus = "pending" | "success" | "fail";
export type VoyageEncounterState = {
  atMs: number;
  cannonballsCost: number;
  status: VoyageEncounterStatus;
};
export type VoyageState = {
  status: VoyageStatus;
  routeId: string | null;
  fromIslandId: string | null;
  toIslandId: string | null;
  remainingMs: number;
  durationMs: number;
  pendingGold: bigint;
  pendingInfluence: number;
  encounters: VoyageEncounterState[];
};

export type AutomationState = {
  enabled: boolean;
  routeId: string | null;
  autoCollect: boolean;
};

export type CannonMinigameState = {
  status: "idle" | "running" | "finished";
  elapsedMs: number;
  durationMs: number;
  hits: number;
  shots: number;
};

export type RiggingMinigameState = {
  status: "idle" | "running" | "finished";
  elapsedMs: number;
  durationMs: number;
  zoneStartPermille: number;
  tugs: number;
  goodTugs: number;
};

export type ShipState = {
  classId: string;
  condition: number;
  maxCondition: number;
};

export type CrewSkillsState = {
  sailingXp: number;
  gunneryXp: number;
};

export type CrewState = {
  hired: number;
  wagesRemainderMs: number;
  skills: CrewSkillsState;
};

export type LocationState = {
  islandId: string;
};

export type FleetShipState = {
  id: string;
  name: string;
  location: LocationState;
  ship: ShipState;
  crew: CrewState;
  hold: ShipHoldState;
  voyage: VoyageState;
  automation: AutomationState;
};

export type FleetState = {
  ships: FleetShipState[];
  nextShipNum: number;
  maxShips: number;
};

export type WorldState = {
  controllerByIslandId: Record<string, string>;
};

export type ConquestCampaignStatus = "idle" | "running" | "success" | "fail";
export type ConquestCampaignState = {
  status: ConquestCampaignStatus;
  targetIslandId: string | null;
  attackerFlagId: string | null;
  remainingMs: number;
  durationMs: number;
  stage: number;
  warChestPaid: bigint;
};

export type ShipyardState = {
  level: number;
};

export type FlagshipProjectState = {
  progress: number;
  required: number;
};

export type FactionStanding = "hostile" | "neutral" | "friendly";

export type PortPerkId = "tax_relief";
export type PortPerkState = {
  id: PortPerkId;
  remainingMs: number;
  taxDiscountBps: number;
};

export type PoliticsCampaignStatus = "idle" | "running" | "success" | "fail";
export type PoliticsCampaignKind = "tax_relief";
export type PoliticsCampaignState = {
  status: PoliticsCampaignStatus;
  kind: PoliticsCampaignKind;
  portId: string | null;
  controllerFlagId: string | null;
  remainingMs: number;
  durationMs: number;
  goldPaid: bigint;
  influenceSpent: number;
};

export type PoliticsState = {
  affiliationFlagId: string;
  influenceByFlagId: Record<string, number>;
  portPerksByIslandId: Record<string, PortPerkState>;
  campaign: PoliticsCampaignState;
};

export type SettingsState = {
  seed: number;
};

export type StatsState = {
  voyagesStarted: number;
};

export type TutorialState = {
  stepId: string;
};

export type GameState = {
  mode: GameMode;
  simNowMs: number;
  stepAccMs: number;
  rng: RngState;
  settings: SettingsState;
  stats: StatsState;
  tutorial: TutorialState;
  resources: { gold: bigint };
  shipId: string;
  shipName: string;
  location: LocationState;
  storage: StorageState;
  ship: ShipState;
  crew: CrewState;
  unlocks: string[];
  automation: AutomationState;
  fleet: FleetState;
  world: WorldState;
  conquest: ConquestCampaignState;
  shipyard: ShipyardState;
  flagship: FlagshipProjectState;
  economy: { contracts: ContractState[]; spawnAcc: Record<string, Record<CommodityId, number>> };
  production: ProductionState;
  voyage: VoyageState;
  politics: PoliticsState;
  buffs: BuffState[];
  minigames: { cannon: CannonMinigameState; rigging: RiggingMinigameState };
  dock: { incomeRemainderMs: number; passiveEnabled: boolean; workRemainingMs: number };
};
